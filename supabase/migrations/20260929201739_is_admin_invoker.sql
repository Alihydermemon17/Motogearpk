create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;