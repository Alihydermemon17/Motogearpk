do $$ begin
  create type public.order_status as enum (
    'PENDING',
    'CONFIRMED',
    'SUPPLIER_PROCESSING',
    'SUPPLIER_SHIPPED',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
    'REFUNDED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('CASH_ON_DELIVERY');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text,
  city text,
  province text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method public.payment_method not null default 'CASH_ON_DELIVERY',
  payment_status public.payment_status not null default 'PENDING',
  status public.order_status not null default 'PENDING',
  shipping_full_name text not null,
  shipping_phone text not null,
  shipping_email text not null,
  shipping_address text not null,
  shipping_city text not null,
  shipping_province text not null,
  customer_notes text,
  tracking_number text,
  courier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_matches_breakdown check (total = subtotal - discount_amount + delivery_fee),
  constraint orders_discount_within_subtotal check (discount_amount <= subtotal)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_sku text not null,
  quantity integer not null check (quantity between 1 and 99),
  base_unit_price numeric(12,2) not null check (base_unit_price >= 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint order_items_discount_within_base check (discount_amount <= base_unit_price * quantity),
  constraint order_items_total_matches_price check (line_total = unit_price * quantity)
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index if not exists orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_status_history_order_time_idx on public.order_status_history(order_id, changed_at);

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_customer() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_customer();

create or replace function public.sync_customer_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = coalesce(new.email, ''), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_customer_email() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_updated_profile on auth.users;
create trigger on_auth_user_email_updated_profile
after update of email on auth.users
for each row execute function public.sync_customer_email();

insert into public.profiles (id, full_name, phone, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(u.raw_user_meta_data ->> 'phone', ''),
  coalesce(u.email, '')
from auth.users as u
on conflict (id) do nothing;

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.record_order_status_change() from public, anon, authenticated;
drop trigger if exists orders_record_status_change on public.orders;
create trigger orders_record_status_change
after insert or update on public.orders
for each row execute function public.record_order_status_change();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
for select to authenticated using (public.is_admin());

drop policy if exists orders_read_own on public.orders;
create policy orders_read_own on public.orders
for select to authenticated using (customer_id = auth.uid());
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_read_own on public.order_items;
create policy order_items_read_own on public.order_items
for select to authenticated
using (exists (
  select 1 from public.orders as o
  where o.id = order_items.order_id and o.customer_id = auth.uid()
));
drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_status_history_read_own on public.order_status_history;
create policy order_status_history_read_own on public.order_status_history
for select to authenticated
using (exists (
  select 1 from public.orders as o
  where o.id = order_status_history.order_id and o.customer_id = auth.uid()
));
drop policy if exists order_status_history_admin_all on public.order_status_history;
create policy order_status_history_admin_all on public.order_status_history
for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.profiles, public.orders, public.order_items, public.order_status_history from anon, authenticated;
grant select on public.profiles, public.orders, public.order_items, public.order_status_history to authenticated;
grant update (full_name, phone, address, city, province) on public.profiles to authenticated;
grant insert, update, delete on public.orders, public.order_items, public.order_status_history to authenticated;

create or replace function public._quote_customer_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_product_id_text text;
  v_product_id uuid;
  v_quantity_text text;
  v_quantity integer;
  v_product_name text;
  v_product_sku text;
  v_base_price numeric(12,2);
  v_discount_price numeric(12,2);
  v_unit_price numeric(12,2);
  v_availability public.availability_status;
  v_supplier_id uuid;
  v_supplier_availability public.availability_status;
  v_found_supplier boolean;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 4500;
  v_seen uuid[] := array[]::uuid[];
  v_lines jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Cart data is invalid.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart must contain between 1 and 50 products.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as entries(value) loop
    v_product_id_text := v_item ->> 'product_id';
    v_quantity_text := v_item ->> 'quantity';
    if jsonb_typeof(v_item) <> 'object'
      or v_product_id_text is null
      or v_quantity_text is null
      or v_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or v_quantity_text !~ '^[1-9][0-9]?$' then
      raise exception 'A cart item has an invalid product or quantity.' using errcode = '22023';
    end if;

    v_product_id := v_product_id_text::uuid;
    v_quantity := v_quantity_text::integer;
    if v_product_id = any(v_seen) then
      raise exception 'A product appears more than once in the cart.' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_product_id);

    select p.name, p.sku, p.selling_price, p.discount_price, p.availability_status, p.supplier_id
    into v_product_name, v_product_sku, v_base_price, v_discount_price, v_availability, v_supplier_id
    from public.products as p
    where p.id = v_product_id and p.published = true
    for share;
    if not found then
      raise exception 'A product in your cart is no longer available.' using errcode = 'P0001';
    end if;
    if v_availability <> 'AVAILABLE' then
      raise exception 'A product in your cart is not currently available.' using errcode = 'P0001';
    end if;

    select latest.availability_status
    into v_supplier_availability
    from public.supplier_products as sp
    join public.suppliers as s on s.id = sp.supplier_id and s.active = true
    join lateral (
      select sa.availability_status
      from public.supplier_availability as sa
      where sa.supplier_product_id = sp.id
      order by sa.checked_at desc
      limit 1
      for share
    ) as latest on true
    where sp.product_id = v_product_id
      and (v_supplier_id is null or sp.supplier_id = v_supplier_id)
    order by sp.updated_at desc
    limit 1
    for share of sp, s;
    v_found_supplier := found;
    if v_supplier_id is not null and (not v_found_supplier or v_supplier_availability <> 'AVAILABLE') then
      raise exception 'Supplier availability for a product in your cart could not be confirmed.' using errcode = 'P0001';
    end if;
    if v_found_supplier and v_supplier_availability <> 'AVAILABLE' then
      raise exception 'A product in your cart is no longer available from its supplier.' using errcode = 'P0001';
    end if;

    v_unit_price := case
      when v_discount_price is not null and v_discount_price < v_base_price then v_discount_price
      else v_base_price
    end;
    v_subtotal := v_subtotal + (v_base_price * v_quantity);
    v_discount := v_discount + ((v_base_price - v_unit_price) * v_quantity);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'product_sku', v_product_sku,
      'quantity', v_quantity,
      'base_unit_price', v_base_price,
      'unit_price', v_unit_price,
      'discount_amount', (v_base_price - v_unit_price) * v_quantity,
      'line_total', v_unit_price * v_quantity
    ));
  end loop;

  return jsonb_build_object(
    'items', v_lines,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'discount_amount', v_discount,
    'total', v_subtotal - v_discount + v_delivery_fee
  );
end;
$$;

revoke all on function public._quote_customer_order(jsonb) from public, anon, authenticated;

create or replace function public.quote_customer_order(p_items jsonb)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public._quote_customer_order(p_items);
$$;

grant execute on function public.quote_customer_order(jsonb) to anon, authenticated;

create or replace function public.create_customer_order(
  p_items jsonb,
  p_shipping jsonb,
  p_customer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid := auth.uid();
  v_quote jsonb;
  v_order_id uuid;
  v_order_number text;
  v_line jsonb;
  v_now timestamptz;
begin
  if v_customer_id is null then
    raise exception 'Sign in before placing an order.' using errcode = '42501';
  end if;
  if p_shipping is null or jsonb_typeof(p_shipping) <> 'object'
    or nullif(trim(p_shipping ->> 'full_name'), '') is null
    or nullif(trim(p_shipping ->> 'phone'), '') is null
    or nullif(trim(p_shipping ->> 'email'), '') is null
    or nullif(trim(p_shipping ->> 'address'), '') is null
    or nullif(trim(p_shipping ->> 'city'), '') is null
    or nullif(trim(p_shipping ->> 'province'), '') is null then
    raise exception 'Complete all required delivery details.' using errcode = '22023';
  end if;
  if (p_shipping ->> 'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid delivery email address.' using errcode = '22023';
  end if;
  if length(coalesce(p_customer_notes, '')) > 1000 then
    raise exception 'Order notes must be 1000 characters or fewer.' using errcode = '22023';
  end if;

  v_quote := public._quote_customer_order(p_items);
  update public.profiles
  set full_name = trim(p_shipping ->> 'full_name'),
      phone = trim(p_shipping ->> 'phone'),
      address = trim(p_shipping ->> 'address'),
      city = trim(p_shipping ->> 'city'),
      province = trim(p_shipping ->> 'province')
  where id = v_customer_id;

  v_order_number := 'MG-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders (
    order_number, customer_id, subtotal, delivery_fee, discount_amount, total,
    payment_method, payment_status, status,
    shipping_full_name, shipping_phone, shipping_email, shipping_address,
    shipping_city, shipping_province, customer_notes
  ) values (
    v_order_number, v_customer_id,
    (v_quote ->> 'subtotal')::numeric,
    (v_quote ->> 'delivery_fee')::numeric,
    (v_quote ->> 'discount_amount')::numeric,
    (v_quote ->> 'total')::numeric,
    'CASH_ON_DELIVERY', 'PENDING', 'PENDING',
    trim(p_shipping ->> 'full_name'), trim(p_shipping ->> 'phone'),
    trim(p_shipping ->> 'email'), trim(p_shipping ->> 'address'),
    trim(p_shipping ->> 'city'), trim(p_shipping ->> 'province'),
    nullif(trim(p_customer_notes), '')
  ) returning id, order_number, created_at into v_order_id, v_order_number, v_now;

  for v_line in select value from jsonb_array_elements(v_quote -> 'items') as entries(value) loop
    insert into public.order_items (
      order_id, product_id, product_name, product_sku, quantity,
      base_unit_price, unit_price, discount_amount, line_total
    ) values (
      v_order_id, (v_line ->> 'product_id')::uuid,
      v_line ->> 'product_name', v_line ->> 'product_sku',
      (v_line ->> 'quantity')::integer,
      (v_line ->> 'base_unit_price')::numeric,
      (v_line ->> 'unit_price')::numeric,
      (v_line ->> 'discount_amount')::numeric,
      (v_line ->> 'line_total')::numeric
    );
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_quote -> 'subtotal',
    'delivery_fee', v_quote -> 'delivery_fee',
    'discount_amount', v_quote -> 'discount_amount',
    'total', v_quote -> 'total',
    'payment_method', 'CASH_ON_DELIVERY',
    'payment_status', 'PENDING',
    'status', 'PENDING',
    'created_at', v_now,
    'items', v_quote -> 'items'
  );
end;
$$;

revoke all on function public.create_customer_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.create_customer_order(jsonb, jsonb, text) to authenticated;
