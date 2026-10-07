alter table public.categories
  add column if not exists active boolean not null default true,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.products add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists internal_notes text;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  title text not null default '',
  body text not null,
  verified_purchase boolean not null default false,
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  category text not null default 'GENERAL',
  message text not null,
  status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','RESOLVED','CLOSED')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('PRODUCT_PUBLICATION','SUPPLIER_PURCHASE','REFUND','MAJOR_PRICE_CHANGE','PRODUCT_REMOVAL','OTHER')),
  subject text not null,
  details text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decision_notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  task text not null,
  action text not null,
  status text not null check (status in ('RUNNING','SUCCESS','FAILED','WAITING_APPROVAL','ESCALATED')),
  error text,
  approval_status text check (approval_status is null or approval_status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.business_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index reviews_product_visible_created_idx on public.reviews(product_id, is_visible, created_at desc);
create index feedback_customer_created_idx on public.customer_feedback(customer_id, created_at desc);
create index feedback_status_created_idx on public.customer_feedback(status, created_at desc);
create index approval_status_created_idx on public.approval_requests(status, created_at desc);
create index automation_logs_created_idx on public.automation_logs(created_at desc);
create index automation_logs_status_created_idx on public.automation_logs(status, created_at desc);

alter table public.reviews enable row level security;
alter table public.customer_feedback enable row level security;
alter table public.approval_requests enable row level security;
alter table public.automation_logs enable row level security;
alter table public.business_settings enable row level security;

create policy reviews_admin_all on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy reviews_public_visible on public.reviews for select to anon, authenticated
  using (is_visible = true);
create policy reviews_customer_insert on public.reviews for insert to authenticated
  with check (customer_id = (select auth.uid()) and verified_purchase = false and is_visible = false);

create policy feedback_admin_all on public.customer_feedback for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy feedback_read_own on public.customer_feedback for select to authenticated
  using (customer_id = (select auth.uid()));
create policy feedback_insert_own on public.customer_feedback for insert to authenticated
  with check (customer_id = (select auth.uid()));

create policy approval_requests_admin_all on public.approval_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy automation_logs_admin_all on public.automation_logs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy business_settings_admin_all on public.business_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy business_settings_public_read on public.business_settings for select to anon, authenticated
  using (is_public = true);

revoke all privileges on table public.reviews, public.customer_feedback, public.approval_requests,
  public.automation_logs, public.business_settings from public, anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (product_id, customer_id, rating, title, body) on public.reviews to authenticated;
grant update (is_visible) on public.reviews to authenticated;
grant select, insert on public.customer_feedback to authenticated;
grant update on public.customer_feedback to authenticated;
grant select, insert, update, delete on public.approval_requests to authenticated;
grant select on public.automation_logs to authenticated;
grant select on public.business_settings to anon, authenticated;
grant insert, update, delete on public.business_settings to authenticated;

create or replace view public.public_products as
select
  p.id, p.name, p.slug, p.sku, p.category_id, p.brand, p.short_description, p.description,
  p.specifications, p.selling_price, p.discount_price, p.availability_status,
  p.warranty, p.return_eligibility, p.seo_title, p.seo_description, p.published,
  p.created_at, p.updated_at,
  c.name as category_name,
  c.slug as category_slug
from public.products p
left join public.categories c on c.id = p.category_id
where p.published = true
  and p.archived_at is null
  and (p.category_id is null or c.active = true);

grant select on public.public_products to anon, authenticated;

create or replace view public.public_product_images as
select i.id, i.product_id, i.image_url, i.alt_text, i.sort_order
from public.product_images i
join public.products p on p.id = i.product_id
where p.published = true and p.archived_at is null;

grant select on public.public_product_images to anon, authenticated;

create or replace view public.public_product_bikes as
select pc.product_id, b.id as bike_model_id, b.name, b.slug, b.brand, b.engine_capacity
from public.product_bike_compatibility pc
join public.products p on p.id = pc.product_id and p.published = true and p.archived_at is null
join public.bike_models b on b.id = pc.bike_model_id and b.active = true;

grant select on public.public_product_bikes to anon, authenticated;

revoke insert, update, delete on public.orders, public.order_items, public.order_status_history from authenticated;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status public.order_status,
  p_tracking_number text default null,
  p_courier text default null,
  p_internal_notes text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_transition_allowed boolean;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) is not true then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if p_status = 'REFUNDED' and v_order.payment_status <> 'PAID' then
    raise exception 'Only a paid order can be marked refunded.' using errcode = '22023';
  end if;
  v_transition_allowed := p_status = v_order.status or
    (v_order.status = 'PENDING' and p_status in ('CONFIRMED','CANCELLED')) or
    (v_order.status = 'CONFIRMED' and p_status in ('SUPPLIER_PROCESSING','CANCELLED')) or
    (v_order.status = 'SUPPLIER_PROCESSING' and p_status in ('SUPPLIER_SHIPPED','CANCELLED')) or
    (v_order.status = 'SUPPLIER_SHIPPED' and p_status = 'IN_TRANSIT') or
    (v_order.status = 'IN_TRANSIT' and p_status in ('DELIVERED','RETURNED')) or
    (v_order.status = 'DELIVERED' and p_status = 'RETURNED') or
    (v_order.status = 'RETURNED' and p_status = 'REFUNDED');
  if not v_transition_allowed then
    raise exception 'This order status transition is not allowed.' using errcode = '22023';
  end if;
  update public.orders
  set status = p_status,
      tracking_number = nullif(trim(coalesce(p_tracking_number, '')), ''),
      courier = nullif(trim(coalesce(p_courier, '')), ''),
      internal_notes = nullif(trim(coalesce(p_internal_notes, '')), '')
  where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.admin_update_order(uuid, public.order_status, text, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, public.order_status, text, text, text) to authenticated;