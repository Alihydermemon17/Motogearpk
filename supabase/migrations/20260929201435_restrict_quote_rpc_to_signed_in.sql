revoke all on function public.quote_customer_order(jsonb) from public, anon;
grant execute on function public.quote_customer_order(jsonb) to authenticated;