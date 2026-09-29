create or replace function public.booking_horizon_days()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select cs.booking_horizon_days from public.clinic_settings cs;
$$;

revoke all on function public.booking_horizon_days() from public, anon;
grant execute on function public.booking_horizon_days() to anon, authenticated;
