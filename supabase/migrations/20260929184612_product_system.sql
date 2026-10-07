create extension if not exists pgcrypto;

create type public.availability_status as enum ('AVAILABLE', 'UNAVAILABLE', 'CHECK_REQUIRED');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bike_models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  brand text,
  engine_capacity text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  url text,
  country text,
  contact_information jsonb not null default '{}'::jsonb,
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  reliability_notes text,
  shipping_information text,
  api_status text not null default 'MANUAL',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sku text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  brand text not null,
  short_description text,
  description text,
  specifications jsonb not null default '{}'::jsonb,
  selling_price numeric(12,2) not null check (selling_price >= 0),
  discount_price numeric(12,2) check (discount_price is null or discount_price >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_product_url text,
  supplier_sku text,
  supplier_cost numeric(12,2) check (supplier_cost is null or supplier_cost >= 0),
  shipping_cost_estimate numeric(12,2) check (shipping_cost_estimate is null or shipping_cost_estimate >= 0),
  estimated_profit numeric(12,2) generated always as (
    coalesce(discount_price, selling_price) - coalesce(supplier_cost, 0) - coalesce(shipping_cost_estimate, 0)
  ) stored,
  availability_status public.availability_status not null default 'CHECK_REQUIRED',
  supplier_last_checked timestamptz,
  estimated_supplier_quantity integer check (estimated_supplier_quantity is null or estimated_supplier_quantity >= 0),
  warranty text,
  return_eligibility text,
  seo_title text,
  seo_description text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.products.estimated_supplier_quantity is 'Supplier estimate only. This is not MotoGear PK physical inventory.';

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_bike_compatibility (
  product_id uuid not null references public.products(id) on delete cascade,
  bike_model_id uuid not null references public.bike_models(id) on delete cascade,
  primary key (product_id, bike_model_id)
);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_product_url text,
  supplier_sku text,
  supplier_cost numeric(12,2) check (supplier_cost is null or supplier_cost >= 0),
  moq integer check (moq is null or moq >= 0),
  supplier_rating numeric(3,2) check (supplier_rating is null or (supplier_rating >= 0 and supplier_rating <= 5)),
  product_quality_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, product_id)
);

create table public.supplier_availability (
  id uuid primary key default gen_random_uuid(),
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  availability_status public.availability_status not null default 'CHECK_REQUIRED',
  estimated_quantity integer check (estimated_quantity is null or estimated_quantity >= 0),
  checked_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);
create index products_supplier_idx on public.products(supplier_id);
create index products_published_idx on public.products(published);
create index products_availability_idx on public.products(availability_status);
create index product_images_product_idx on public.product_images(product_id, sort_order);
create index compatibility_bike_idx on public.product_bike_compatibility(bike_model_id);
create index supplier_products_product_idx on public.supplier_products(product_id);
create index supplier_availability_product_idx on public.supplier_availability(supplier_product_id, checked_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['categories', 'bike_models', 'suppliers', 'products', 'supplier_products'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

alter table public.categories enable row level security;
alter table public.bike_models enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_bike_compatibility enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.supplier_availability enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create policy categories_admin_all on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy bike_models_admin_all on public.bike_models for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_all on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_admin_all on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy compatibility_admin_all on public.product_bike_compatibility for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy suppliers_admin_all on public.suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy supplier_products_admin_all on public.supplier_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy supplier_availability_admin_all on public.supplier_availability for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
where p.published = true;

grant select on public.public_products to anon, authenticated;

create or replace view public.public_product_images as
select i.id, i.product_id, i.image_url, i.alt_text, i.sort_order
from public.product_images i
join public.products p on p.id = i.product_id
where p.published = true;

grant select on public.public_product_images to anon, authenticated;

create or replace view public.public_product_bikes as
select pc.product_id, b.id as bike_model_id, b.name, b.slug, b.brand, b.engine_capacity
from public.product_bike_compatibility pc
join public.products p on p.id = pc.product_id and p.published = true
join public.bike_models b on b.id = pc.bike_model_id and b.active = true;

grant select on public.public_product_bikes to anon, authenticated;

