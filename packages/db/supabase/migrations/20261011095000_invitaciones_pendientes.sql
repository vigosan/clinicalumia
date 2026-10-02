create or replace function public._account_activated(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and u.invited_at is not null
      and coalesce(u.encrypted_password, '') = ''
  );
$$;

revoke all on function public._account_activated(uuid) from public, anon, authenticated;

create or replace function public.pending_invitations()
returns table (profile_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'pending_invitations_forbidden' using errcode = '42501';
  end if;
  return query
    select p.id from public.profiles p
    where not public._account_activated(p.id)
    order by p.id;
end;
$$;

revoke all on function public.pending_invitations() from public, anon;
grant execute on function public.pending_invitations() to authenticated;

create or replace function public.booking_catalog()
returns table (
  specialty_id uuid,
  specialty_name text,
  service_id uuid,
  service_name text,
  duration_minutes int,
  price_cents int,
  bookable_online boolean,
  phone_only boolean,
  professionals jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sp.id,
    sp.name,
    s.id,
    s.name,
    s.duration_minutes,
    s.price_cents,
    s.bookable_online,
    s.booking_payment <> 'none' and not cs.online_payments_enabled,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name)
      from public.profiles p
      where p.specialty_id = sp.id and p.is_active and public._account_activated(p.id)
    ), '[]'::jsonb)
  from public.services s
  join public.specialties sp on sp.id = s.specialty_id
  cross join public.clinic_settings cs
  where s.is_active and s.bookable_online;
$$;

revoke all on function public.booking_catalog() from public;
grant execute on function public.booking_catalog() to anon, authenticated;

create or replace function public._free_slots(
  p_service_id uuid,
  p_professional_id uuid,
  p_from date,
  p_to date,
  p_ignore_appointment uuid
)
returns table (starts_at timestamptz, professional_id uuid)
language plpgsql
stable
set search_path = ''
as $$
declare
  service record;
  settings record;
  today_madrid date;
  window_start timestamptz;
  window_end timestamptz;
  slot_length interval;
begin
  if p_to < p_from or p_to - p_from > 13 then
    raise exception 'available_slots_range' using errcode = '22023';
  end if;

  select s.duration_minutes, s.specialty_id, s.is_active, s.bookable_online, s.booking_payment
    into service
    from public.services s
    where s.id = p_service_id;
  if not found then
    return;
  end if;

  select cs.booking_min_notice_hours, cs.booking_horizon_days, cs.online_payments_enabled
    into settings
    from public.clinic_settings cs;

  if not service.is_active or not service.bookable_online
    or (service.booking_payment <> 'none' and not settings.online_payments_enabled) then
    return;
  end if;

  slot_length := coalesce(
    (select a.ends_at - a.starts_at from public.appointments a where a.id = p_ignore_appointment),
    service.duration_minutes * interval '1 minute'
  );
  today_madrid := (now() at time zone 'Europe/Madrid')::date;
  window_start := now() + make_interval(hours => settings.booking_min_notice_hours);
  window_end := (today_madrid + settings.booking_horizon_days + 1)::timestamp at time zone 'Europe/Madrid';

  return query
    with days as (
      select gs::date as day_madrid
      from generate_series(p_from, p_to, interval '1 day') as gs
    ),
    segments as (
      select
        es.profile_id,
        d.day_madrid + es.starts_at as seg_start_wall,
        d.day_madrid + es.ends_at as seg_end_wall
      from days d
      join public.employee_schedules es on es.weekday = extract(isodow from d.day_madrid)
      join public.profiles p on p.id = es.profile_id
      where p.is_active
        and public._account_activated(p.id)
        and p.specialty_id = service.specialty_id
        and (p_professional_id is null or es.profile_id = p_professional_id)
    ),
    grid as (
      select
        seg.profile_id,
        seg.seg_end_wall,
        date_trunc('hour', seg.seg_start_wall)
          + ceil(extract(epoch from (seg.seg_start_wall - date_trunc('hour', seg.seg_start_wall))) / 900.0) * interval '15 minutes' as first_slot
      from segments seg
    ),
    slots as (
      select
        g.profile_id,
        g.slot_wall,
        (g.slot_wall at time zone 'Europe/Madrid') as starts_at,
        (g.slot_wall at time zone 'Europe/Madrid') + slot_length as ends_at
      from (
        select grid.profile_id, gen.slot_wall
        from grid
        cross join lateral generate_series(
          grid.first_slot,
          grid.seg_end_wall - slot_length,
          interval '15 minutes'
        ) as gen(slot_wall)
      ) g
    )
    select slots.starts_at, slots.profile_id
    from slots
    where slots.starts_at >= window_start
      and slots.starts_at < window_end
      and (slots.starts_at at time zone 'Europe/Madrid') = slots.slot_wall
      and not exists (
        select 1 from public.employee_time_off t
        where t.profile_id = slots.profile_id
          and tstzrange(t.starts_at, t.ends_at) && tstzrange(slots.starts_at, slots.ends_at)
      )
      and not exists (
        select 1 from public.clinic_closures c
        where tstzrange(
            c.starts_on::timestamp at time zone 'Europe/Madrid',
            (c.ends_on + 1)::timestamp at time zone 'Europe/Madrid'
          ) && tstzrange(slots.starts_at, slots.ends_at)
      )
      and not exists (
        select 1 from public.appointments a
        where a.professional_id = slots.profile_id
          and a.status = 'scheduled'
          and a.id is distinct from p_ignore_appointment
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(slots.starts_at, slots.ends_at)
      )
    order by slots.starts_at, slots.profile_id;
end;
$$;

revoke all on function public._free_slots(uuid, uuid, date, date, uuid) from public, anon, authenticated;

create or replace function public.signed_in_as_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  );
$$;

revoke all on function public.signed_in_as_owner() from public, anon;
grant execute on function public.signed_in_as_owner() to authenticated;
