select
  has_table_privilege('anon', 'public.public_products', 'select') as anon_can_read_catalog,
  has_table_privilege('anon', 'public.public_product_images', 'select') as anon_can_read_images,
  has_table_privilege('anon', 'public.products', 'select') as anon_can_read_products,
  has_function_privilege('anon', 'public.is_admin()', 'execute') as anon_can_call_is_admin,
  has_function_privilege('anon', 'public.quote_customer_order(jsonb)', 'execute') as anon_can_quote_order;