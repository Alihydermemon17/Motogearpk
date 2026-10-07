alter table public.reviews
	add column if not exists order_id uuid references public.orders(id) on delete set null;

create unique index if not exists reviews_order_product_customer_uidx
	on public.reviews(order_id, product_id, customer_id)
	where order_id is not null and customer_id is not null;

create or replace function public.set_review_purchase_verification()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
	new.verified_purchase := exists (
		select 1
		from public.orders o
		join public.order_items oi on oi.order_id = o.id
		where o.id = new.order_id
			and o.customer_id = new.customer_id
			and o.status in ('DELIVERED', 'RETURNED', 'REFUNDED')
			and oi.product_id = new.product_id
	);
	return new;
end;
$$;

drop trigger if exists reviews_set_purchase_verification on public.reviews;
create trigger reviews_set_purchase_verification
before insert or update of product_id, customer_id, order_id, verified_purchase on public.reviews
for each row execute function public.set_review_purchase_verification();

drop policy if exists reviews_customer_insert on public.reviews;
create policy reviews_customer_insert on public.reviews
for insert to authenticated
with check (
	customer_id = (select auth.uid())
	and is_visible = false
	and exists (
		select 1 from public.orders o
		join public.order_items oi on oi.order_id = o.id
		where o.id = reviews.order_id
			and o.customer_id = (select auth.uid())
			and o.status = 'DELIVERED'
			and oi.product_id = reviews.product_id
	)
);

drop policy if exists reviews_public_visible on public.reviews;
create policy reviews_public_visible on public.reviews
for select to anon, authenticated using (is_visible = true);

create policy reviews_customer_update_own on public.reviews
for update to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

revoke all on public.reviews from anon, authenticated;
grant select (id, product_id, rating, title, body, verified_purchase, is_visible, created_at) on public.reviews to anon;
grant select on public.reviews to authenticated;
grant insert (product_id, customer_id, order_id, rating, title, body) on public.reviews to authenticated;
grant update (rating, title, body) on public.reviews to authenticated;
grant update (is_visible) on public.reviews to authenticated;

create or replace view public.public_product_reviews
with (security_invoker = true)
as
select id, product_id, rating, title, body, verified_purchase, created_at
from public.reviews
where is_visible = true;

grant select on public.public_product_reviews to anon, authenticated;

alter table public.order_items add column if not exists warranty text;

create or replace function public.snapshot_order_item_warranty()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
	if new.product_id is not null then
		select p.warranty into new.warranty
		from public.products p
		where p.id = new.product_id;
	end if;
	return new;
end;
$$;

drop trigger if exists order_items_snapshot_warranty on public.order_items;
create trigger order_items_snapshot_warranty
before insert on public.order_items
for each row execute function public.snapshot_order_item_warranty();

create table if not exists public.return_requests (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders(id) on delete cascade,
	order_item_id uuid not null references public.order_items(id) on delete cascade,
	customer_id uuid not null references auth.users(id) on delete cascade,
	reason text not null check (reason in ('DAMAGED', 'NOT_WORKING', 'WRONG_PRODUCT', 'COMPATIBILITY', 'DIFFERENT_FROM_LISTING', 'MISSING_ITEM', 'OTHER')),
	description text not null default '',
	status text not null default 'REQUESTED' check (status in ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'REFUNDED', 'REPLACEMENT_SENT', 'CLOSED')),
	internal_notes text,
	decided_by uuid references auth.users(id) on delete set null,
	decided_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists return_requests_customer_created_idx on public.return_requests(customer_id, created_at desc);
create index if not exists return_requests_status_created_idx on public.return_requests(status, created_at desc);
create unique index if not exists return_requests_one_open_per_item_uidx
	on public.return_requests(order_item_id)
	where status in ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'RETURNED');

alter table public.return_requests enable row level security;
create policy return_requests_admin_all on public.return_requests
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy return_requests_read_own on public.return_requests
for select to authenticated using (customer_id = (select auth.uid()));
create policy return_requests_insert_own on public.return_requests
for insert to authenticated
with check (
	customer_id = (select auth.uid())
	and status = 'REQUESTED'
	and exists (
		select 1 from public.orders o
		join public.order_items oi on oi.order_id = o.id
		where o.id = return_requests.order_id
			and o.customer_id = (select auth.uid())
			and o.status = 'DELIVERED'
			and oi.id = return_requests.order_item_id
	)
);

revoke all on public.return_requests from public, anon, authenticated;
grant select on public.return_requests to authenticated;
grant insert (order_id, order_item_id, customer_id, reason, description) on public.return_requests to authenticated;
grant update (status, internal_notes, decided_by, decided_at) on public.return_requests to authenticated;

drop trigger if exists return_requests_updated_at on public.return_requests;
create trigger return_requests_updated_at before update on public.return_requests
for each row execute function public.set_updated_at();

alter table public.customer_feedback add column if not exists rating smallint check (rating is null or rating between 1 and 5);
drop policy if exists feedback_insert_own on public.customer_feedback;
create policy feedback_insert_own on public.customer_feedback
for insert to authenticated
with check (
	customer_id = (select auth.uid())
	and (
		order_id is null
		or exists (
			select 1 from public.orders o
			where o.id = customer_feedback.order_id and o.customer_id = (select auth.uid())
		)
	)
	and (
		product_id is null
		or order_id is null
		or exists (
			select 1 from public.order_items oi
			where oi.order_id = customer_feedback.order_id and oi.product_id = customer_feedback.product_id
		)
	)
);
grant insert (customer_id, product_id, order_id, category, message, rating) on public.customer_feedback to authenticated;

create table if not exists public.faq_entries (
	id uuid primary key default gen_random_uuid(),
	topic text not null check (topic in ('ORDERS', 'DELIVERY', 'RETURNS', 'WARRANTY', 'COMPATIBILITY', 'INSTALLATION', 'PAYMENT', 'SUPPLIER_FULFILLMENT')),
	question text not null,
	answer text not null,
	active boolean not null default false,
	sort_order integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists faq_entries_active_sort_idx on public.faq_entries(active, sort_order, created_at);
alter table public.faq_entries enable row level security;
create policy faq_entries_public_read on public.faq_entries
for select to anon, authenticated using (active = true);
create policy faq_entries_admin_all on public.faq_entries
for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.faq_entries from public, anon, authenticated;
grant select on public.faq_entries to anon, authenticated;
grant insert, update on public.faq_entries to authenticated;
drop trigger if exists faq_entries_updated_at on public.faq_entries;
create trigger faq_entries_updated_at before update on public.faq_entries
for each row execute function public.set_updated_at();

create table if not exists public.support_conversations (
	id uuid primary key default gen_random_uuid(),
	customer_id uuid not null references auth.users(id) on delete cascade,
	related_order_id uuid references public.orders(id) on delete set null,
	category text not null check (category in ('PRODUCT_QUESTION', 'COMPATIBILITY', 'ORDER_STATUS', 'DELIVERY', 'WARRANTY', 'RETURN', 'REFUND', 'COMPLAINT', 'OTHER')),
	subject text not null,
	status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists support_conversations_customer_updated_idx on public.support_conversations(customer_id, updated_at desc);
create index if not exists support_conversations_status_updated_idx on public.support_conversations(status, updated_at desc);
alter table public.support_conversations enable row level security;
create policy support_conversations_admin_all on public.support_conversations
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy support_conversations_read_own on public.support_conversations
for select to authenticated using (customer_id = (select auth.uid()));
create policy support_conversations_insert_own on public.support_conversations
for insert to authenticated
with check (
	customer_id = (select auth.uid())
	and status = 'OPEN'
	and (
		related_order_id is null
		or exists (
			select 1 from public.orders o
			where o.id = support_conversations.related_order_id and o.customer_id = (select auth.uid())
		)
	)
);
revoke all on public.support_conversations from public, anon, authenticated;
grant select on public.support_conversations to authenticated;
grant insert (customer_id, related_order_id, category, subject) on public.support_conversations to authenticated;
grant update (status) on public.support_conversations to authenticated;
drop trigger if exists support_conversations_updated_at on public.support_conversations;
create trigger support_conversations_updated_at before update on public.support_conversations
for each row execute function public.set_updated_at();

create table if not exists public.support_messages (
	id uuid primary key default gen_random_uuid(),
	conversation_id uuid not null references public.support_conversations(id) on delete cascade,
	sender_id uuid not null references auth.users(id) on delete cascade,
	sender_role text not null check (sender_role in ('CUSTOMER', 'ADMIN')),
	body text not null check (length(trim(body)) > 0),
	is_internal boolean not null default false,
	created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_created_idx on public.support_messages(conversation_id, created_at);
alter table public.support_messages enable row level security;
create policy support_messages_admin_all on public.support_messages
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy support_messages_read_own on public.support_messages
for select to authenticated
using (
	is_internal = false
	and exists (
		select 1 from public.support_conversations c
		where c.id = support_messages.conversation_id and c.customer_id = (select auth.uid())
	)
);
create policy support_messages_insert_own on public.support_messages
for insert to authenticated
with check (
	is_internal = false
	and sender_id = (select auth.uid())
	and sender_role = 'CUSTOMER'
	and exists (
		select 1 from public.support_conversations c
		where c.id = support_messages.conversation_id and c.customer_id = (select auth.uid())
	)
);
revoke all on public.support_messages from public, anon, authenticated;
grant select on public.support_messages to authenticated;
grant insert (conversation_id, sender_id, sender_role, body, is_internal) on public.support_messages to authenticated;

create table if not exists public.support_internal_notes (
	id uuid primary key default gen_random_uuid(),
	conversation_id uuid not null references public.support_conversations(id) on delete cascade,
	author_id uuid not null references auth.users(id) on delete cascade,
	body text not null check (length(trim(body)) > 0),
	created_at timestamptz not null default now()
);

create index if not exists support_internal_notes_conversation_created_idx on public.support_internal_notes(conversation_id, created_at);
alter table public.support_internal_notes enable row level security;
create policy support_internal_notes_admin_all on public.support_internal_notes
for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.support_internal_notes from public, anon, authenticated;
grant select, insert on public.support_internal_notes to authenticated;

create or replace function public.set_support_message_sender()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
	new.sender_id := auth.uid();
	new.sender_role := case when public.is_admin() then 'ADMIN' else 'CUSTOMER' end;
	return new;
end;
$$;

drop trigger if exists support_messages_set_sender on public.support_messages;
create trigger support_messages_set_sender
before insert on public.support_messages
for each row execute function public.set_support_message_sender();

create or replace function public.set_support_note_author()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
	new.author_id := auth.uid();
	return new;
end;
$$;

drop trigger if exists support_internal_notes_set_author on public.support_internal_notes;
create trigger support_internal_notes_set_author
before insert on public.support_internal_notes
for each row execute function public.set_support_note_author();
