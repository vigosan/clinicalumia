create or replace function public.agenda_busy(p_from timestamptz, p_to timestamptz)
returns table (professional_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'agenda_busy_forbidden' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '31 days' then
    raise exception 'agenda_busy_range' using errcode = '22023';
  end if;
  return query
    select a.professional_id, a.starts_at, a.ends_at
    from public.appointments a
    join public.profiles p on p.id = a.professional_id
    where a.status <> 'cancelled'
      and p.is_active
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_from, p_to);
end;
$$;

revoke all on function public.agenda_busy(timestamptz, timestamptz) from public, anon;
grant execute on function public.agenda_busy(timestamptz, timestamptz) to authenticated;
