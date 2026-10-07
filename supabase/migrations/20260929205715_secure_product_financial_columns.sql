drop policy if exists products_public_read on public.products;
revoke all privileges on table public.products from public, anon, authenticated;
grant select, insert, update, delete on table public.products to authenticated;

alter view public.public_products reset (security_invoker);
alter view public.public_product_images reset (security_invoker);
alter view public.public_product_bikes reset (security_invoker);

grant select on public.public_products, public.public_product_images,
  public.public_product_bikes to anon, authenticated;