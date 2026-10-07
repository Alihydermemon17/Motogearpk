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
  select case
    when jsonb_typeof(setting_value) = 'number' then (setting_value #>> '{}')::numeric(12,2)
    when jsonb_typeof(setting_value) = 'string' and (setting_value #>> '{}') ~ '^[0-9]+(\.[0-9]{1,2})?$' then (setting_value #>> '{}')::numeric(12,2)
    else null
  end into v_delivery_fee
  from public.business_settings where setting_key = 'delivery_fee';
  if v_delivery_fee is null then v_delivery_fee := 4500; end if;

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