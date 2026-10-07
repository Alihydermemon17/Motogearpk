alter view public.public_products set (security_invoker = true);
alter view public.public_product_images set (security_invoker = true);
alter view public.public_product_bikes set (security_invoker = true);

create policy products_public_read on public.products
for select to anon, authenticated using (published = true);
create policy product_images_public_read on public.product_images
for select to anon, authenticated using (exists (
  select 1 from public.products p where p.id = product_id and p.published = true
));
create policy bike_models_public_read on public.bike_models
for select to anon, authenticated using (active = true);
create policy product_bike_compatibility_public_read on public.product_bike_compatibility
for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.published = true)
  and exists (select 1 from public.bike_models b where b.id = bike_model_id and b.active = true)
);
grant select on public.products, public.product_images,
  public.product_bike_compatibility, public.bike_models to anon, authenticated;