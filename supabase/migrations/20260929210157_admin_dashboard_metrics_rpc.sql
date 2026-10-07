create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) is not true then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'PENDING'),
    'confirmed_orders', (select count(*) from public.orders where status = 'CONFIRMED'),
    'delivered_orders', (select count(*) from public.orders where status = 'DELIVERED'),
    'cancelled_orders', (select count(*) from public.orders where status = 'CANCELLED'),
    'revenue', coalesce((select sum(total) from public.orders where payment_status = 'PAID'), 0),
    'estimated_profit', coalesce((select sum(estimated_profit) from public.products where published and archived_at is null), 0),
    'published_products', (select count(*) from public.products where published and archived_at is null),
    'unavailable_products', (select count(*) from public.products where availability_status = 'UNAVAILABLE' and archived_at is null),
    'total_customers', (select count(*) from public.profiles),
    'total_reviews', (select count(*) from public.reviews),
    'pending_approvals', (select count(*) from public.approval_requests where status = 'PENDING')
  );
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public, anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;