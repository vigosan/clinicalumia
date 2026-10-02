alter table public.appointments drop constraint appointments_patient_no_overlap;
alter table public.appointments drop constraint appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled', 'no_show'));

alter table public.appointments
  add constraint appointments_patient_no_overlap exclude using gist (
    patient_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled', 'no_show'));

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
    where a.status = 'scheduled'
      and p.is_active
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_from, p_to);
end;
$$;

revoke all on function public.agenda_busy(timestamptz, timestamptz) from public, anon;
grant execute on function public.agenda_busy(timestamptz, timestamptz) to authenticated;

create or replace function public.pending_payments(p_since timestamptz)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  patient_id uuid,
  patient_name text,
  service_name text,
  professional_id uuid,
  suggested_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  return query
    select
      a.id,
      a.starts_at,
      a.patient_id,
      pe.first_name || ' ' || pe.last_name,
      s.name,
      a.professional_id,
      greatest(
        a.price_cents
          - case when a.payment_status = 'paid' then a.payment_amount_cents else 0 end,
        0
      )
    from public.appointments a
    join public.people pe on pe.id = a.patient_id
    join public.services s on s.id = a.service_id
    where a.starts_at >= p_since and a.starts_at <= now()
      and a.status = 'scheduled'
      and (public.is_owner() or a.professional_id = auth.uid())
      and not exists (
        select 1 from public.payments p
        where p.appointment_id = a.id and p.voided_at is null
      )
    order by a.starts_at asc;
end;
$$;

revoke all on function public.pending_payments(timestamptz) from public, anon;
grant execute on function public.pending_payments(timestamptz) to authenticated;
