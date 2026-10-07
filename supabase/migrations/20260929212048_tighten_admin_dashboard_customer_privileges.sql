drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
for select to anon, authenticated using (active = true);
revoke insert, update on public.customer_feedback from authenticated;
grant insert (customer_id, product_id, order_id, category, message) on public.customer_feedback to authenticated;
grant update (status, internal_notes) on public.customer_feedback to authenticated;