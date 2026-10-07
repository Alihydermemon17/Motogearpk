alter table public.support_conversations
	add column if not exists related_product_id uuid references public.products(id) on delete set null;

drop policy if exists support_conversations_insert_own on public.support_conversations;
create policy support_conversations_insert_own on public.support_conversations
for insert to authenticated
with check (
	customer_id = (select auth.uid())
	and status = 'OPEN'
	and (
		related_order_id is null
		or exists (
			select 1 from public.orders o
			where o.id = support_conversations.related_order_id
				and o.customer_id = (select auth.uid())
		)
	)
	and (
		related_product_id is null
		or (
			related_order_id is not null
			and exists (
				select 1
				from public.orders o
				join public.order_items oi on oi.order_id = o.id
				where o.id = support_conversations.related_order_id
					and o.customer_id = (select auth.uid())
					and oi.product_id = support_conversations.related_product_id
			)
		)
		or (
			related_order_id is null
			and exists (
				select 1 from public.public_products pp
				where pp.id = support_conversations.related_product_id
			)
		)
	)
);

grant insert (customer_id, related_order_id, related_product_id, category, subject)
	on public.support_conversations to authenticated;

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at before update on public.reviews
for each row execute function public.set_updated_at();
