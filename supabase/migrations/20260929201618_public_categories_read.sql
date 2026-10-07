create policy categories_public_read on public.categories
for select to anon, authenticated using (true);
grant select on public.categories to anon, authenticated;