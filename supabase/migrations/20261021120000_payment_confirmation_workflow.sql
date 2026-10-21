-- Payment confirmation workflow.
--
-- Before this migration `orders.payment_status` had no writer anywhere in the
-- system. It defaulted to 'PENDING' on insert (`customer_order_flow.sql:413`)
-- and every other path only read it:
--   * `admin_update_order` writes status/tracking/courier/internal_notes only.
--   * Direct DML on `orders` is revoked from `authenticated` (step4:149).
-- The consequence was that no order could ever reach 'PAID', so the revenue
-- metric (`admin_dashboard_metrics`, sum(total) where payment_status='PAID')
-- was permanently 0.
--
-- This adds the one missing capability: an admin marking an order as paid once
-- money has actually been received. It is deliberately admin-only and manual.
-- Placing, confirming or dispatching a Cash-on-Delivery order does NOT change
-- payment_status — COD is collected on delivery, so it stays 'PENDING' until a
-- human confirms the cash landed. A customer screenshot is not proof and there
-- is no path for a customer to call this function.

-- 1. Columns recording who confirmed payment, when, and against what reference.
alter table public.orders
  add column if not exists payment_reference text,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references auth.users(id) on delete set null;

comment on column public.orders.payment_reference is
  'Admin-supplied reference for the confirmation (transfer id, transaction ref, cash receipt no). Free text entered by the confirming admin; never auto-generated.';
comment on column public.orders.payment_confirmed_at is
  'When an admin moved payment_status off PENDING. Null while payment is unconfirmed.';
comment on column public.orders.payment_confirmed_by is
  'The admin user who confirmed the payment.';

-- 2. Audit trail for payment changes.
--
-- `order_status_history` cannot hold this: its `status` column is typed
-- `public.order_status`, and its trigger fires only on `orders.status` change.
-- Payment is a separate axis, so it gets its own log rather than widening that
-- table's meaning.
create table if not exists public.order_payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.payment_status not null,
  to_status public.payment_status not null,
  reference text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists order_payment_events_order_id_idx
  on public.order_payment_events(order_id, changed_at desc);

alter table public.order_payment_events enable row level security;

-- Admins see every payment event; a customer sees only their own order's.
-- The guards make this file replayable against a database that already has
-- these policies (the live project did when this was applied).
drop policy if exists "Admins read all payment events" on public.order_payment_events;
create policy "Admins read all payment events"
  on public.order_payment_events for select
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false));

drop policy if exists "Customers read own payment events" on public.order_payment_events;
create policy "Customers read own payment events"
  on public.order_payment_events for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_payment_events.order_id
      and o.customer_id = auth.uid()
  ));

-- No insert/update/delete policies: the table is written only by the
-- SECURITY DEFINER function below, never by a client. anon holds nothing at
-- all — an unauthenticated visitor has no business even holding the SELECT
-- privilege on an order's payment audit trail, and RLS would mask the rows
-- anyway. Belt and braces.

revoke all on public.order_payment_events from anon;
revoke insert, update, delete on public.order_payment_events from authenticated;

-- 3. The RPC.
--
-- Mirrors the shape and guard style of `admin_update_order`. Payment moves are
-- an explicit allow-list; REFUNDED is terminal.
create or replace function public.admin_update_order_payment(
  p_order_id uuid,
  p_payment_status public.payment_status,
  p_reference text default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_from public.payment_status;
  v_transition_allowed boolean;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) is not true then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  v_from := v_order.payment_status;
  if v_from = p_payment_status then
    -- No-op: leave the audit trail clean rather than logging a change that
    -- did not happen.
    return v_order;
  end if;

  v_transition_allowed :=
       (v_from = 'PENDING'   and p_payment_status in ('PAID', 'FAILED'))
    or (v_from = 'FAILED'    and p_payment_status in ('PENDING', 'PAID'))
    or (v_from = 'PAID'      and p_payment_status = 'REFUNDED');
  if not v_transition_allowed then
    raise exception 'This payment status transition is not allowed.' using errcode = '22023';
  end if;

  update public.orders
  set payment_status = p_payment_status,
      payment_reference = case
        when p_payment_status = 'PAID' then nullif(trim(coalesce(p_reference, '')), '')
        else null
      end,
      payment_confirmed_at = case when p_payment_status in ('PAID', 'REFUNDED') then now() else null end,
      payment_confirmed_by = case when p_payment_status in ('PAID', 'REFUNDED') then auth.uid() else null end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_payment_events (order_id, from_status, to_status, reference, note, changed_by)
  values (p_order_id, v_from, p_payment_status,
          nullif(trim(coalesce(p_reference, '')), ''),
          nullif(trim(coalesce(p_note, '')), ''),
          auth.uid());

  return v_order;
end;
$$;

revoke all on function public.admin_update_order_payment(uuid, public.payment_status, text, text) from public, anon;
grant execute on function public.admin_update_order_payment(uuid, public.payment_status, text, text) to authenticated;

-- 4. Align the SQL delivery-fee fallback with the value actually in use.
--
-- `business_settings.delivery_fee` is live at 250 and both client fallbacks
-- already say 250 (`src/api/admin.ts:387`, `src/app/CustomerPages.tsx:85`).
-- The 4500 in the quote fallback was a stale default that would silently
-- over-charge every order if the settings row were ever missing.
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
  -- 250 matches business_settings.delivery_fee and both client fallbacks.
  v_delivery_fee numeric(12,2) := 250;
  v_seen uuid[] := array[]::uuid[];
  v_lines jsonb := '[]'::jsonb;
begin
  select case
    when jsonb_typeof(setting_value) = 'number' then (setting_value #>> '{}')::numeric(12,2)
    when jsonb_typeof(setting_value) = 'string' and (setting_value #>> '{}') ~ '^[0-9]+(\.[0-9]{1,2})?$' then (setting_value #>> '{}')::numeric(12,2)
    else null
  end into v_delivery_fee
  from public.business_settings where setting_key = 'delivery_fee';
  if v_delivery_fee is null then v_delivery_fee := 250; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Cart data is invalid.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart must contain between 1 and 50 products.' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) as entries(value) loop
    v_product_id_text := v_item ->> 'product_id';
    v_quantity_text := v_item ->> 'quantity';
    if jsonb_typeof(v_item) <> 'object' or v_product_id_text is null or v_quantity_text is null
      or v_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or v_quantity_text !~ '^[1-9][0-9]?$' then
      raise exception 'A cart item has an invalid product or quantity.' using errcode = '22023';
    end if;
    v_product_id := v_product_id_text::uuid;
    v_quantity := v_quantity_text::integer;
    if v_product_id = any(v_seen) then raise exception 'A product appears more than once in the cart.' using errcode = '22023'; end if;
    v_seen := array_append(v_seen, v_product_id);
    select p.name, p.sku, p.selling_price, p.discount_price, p.availability_status, p.supplier_id
    into v_product_name, v_product_sku, v_base_price, v_discount_price, v_availability, v_supplier_id
    from public.products p where p.id = v_product_id and p.published = true and p.archived_at is null for share;
    if not found then raise exception 'A product in your cart is no longer available.' using errcode = 'P0001'; end if;
    if v_availability <> 'AVAILABLE' then raise exception 'A product in your cart is not currently available.' using errcode = 'P0001'; end if;
    select latest.availability_status into v_supplier_availability
    from public.supplier_products sp
    join public.suppliers s on s.id = sp.supplier_id and s.active = true
    join lateral (select sa.availability_status from public.supplier_availability sa where sa.supplier_product_id = sp.id order by sa.checked_at desc limit 1 for share) latest on true
    where sp.product_id = v_product_id and (v_supplier_id is null or sp.supplier_id = v_supplier_id)
    order by sp.updated_at desc limit 1 for share of sp, s;
    v_found_supplier := found;
    if v_supplier_id is not null and (not v_found_supplier or v_supplier_availability <> 'AVAILABLE') then
      raise exception 'Supplier availability for a product in your cart could not be confirmed.' using errcode = 'P0001';
    end if;
    if v_found_supplier and v_supplier_availability <> 'AVAILABLE' then
      raise exception 'A product in your cart is no longer available from its supplier.' using errcode = 'P0001';
    end if;
    v_unit_price := case when v_discount_price is not null and v_discount_price < v_base_price then v_discount_price else v_base_price end;
    v_subtotal := v_subtotal + (v_base_price * v_quantity);
    v_discount := v_discount + ((v_base_price - v_unit_price) * v_quantity);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'product_name', v_product_name, 'product_sku', v_product_sku, 'quantity', v_quantity, 'base_unit_price', v_base_price, 'unit_price', v_unit_price, 'discount_amount', (v_base_price - v_unit_price) * v_quantity, 'line_total', v_unit_price * v_quantity));
  end loop;
  return jsonb_build_object('items', v_lines, 'subtotal', v_subtotal, 'delivery_fee', v_delivery_fee, 'discount_amount', v_discount, 'total', v_subtotal - v_discount + v_delivery_fee);
end;
$$;
revoke all on function public._quote_customer_order(jsonb) from public, anon, authenticated;
