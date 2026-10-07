drop policy if exists reviews_public_visible on public.reviews;
drop policy if exists reviews_customer_insert on public.reviews;
create policy reviews_read_own on public.reviews for select to authenticated
  using (customer_id = (select auth.uid()));
revoke all privileges on public.reviews from public, anon, authenticated;
grant select on public.reviews to authenticated;
grant insert (product_id, customer_id, rating, title, body) on public.reviews to authenticated;
grant update (is_visible) on public.reviews to authenticated;