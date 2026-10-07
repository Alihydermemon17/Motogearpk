revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;