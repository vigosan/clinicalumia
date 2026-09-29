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
        select 1 from public.appointments a
        where a.professional_id = slots.profile_id
          and a.status <> 'cancelled'
          and a.id is distinct from p_ignore_appointment
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(slots.starts_at, slots.ends_at)
      )
    order by slots.starts_at, slots.profile_id;
end;
$$;

revoke all on function public._free_slots(uuid, uuid, date, date, uuid) from public, anon, authenticated;

create or replace function public.available_slots(
  p_service_id uuid,
  p_professional_id uuid,
  p_from date,
  p_to date
)
returns table (starts_at timestamptz, professional_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select fs.starts_at, fs.professional_id
  from public._free_slots(p_service_id, p_professional_id, p_from, p_to, null) fs;
$$;

revoke all on function public.available_slots(uuid, uuid, date, date) from public;
grant execute on function public.available_slots(uuid, uuid, date, date) to anon, authenticated;

create or replace function public.record_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  patient_actor boolean := coalesce(current_setting('lumia.booking_account', true) = auth.uid()::text, false)
    and exists (select 1 from public.patient_accounts where id = auth.uid());
  actor uuid := case when patient_actor then null else auth.uid() end;
  kind_of_actor public.actor_kind := case when patient_actor then 'patient'::public.actor_kind else 'staff'::public.actor_kind end;
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_events (appointment_id, kind, actor_id, actor_kind)
    values (new.id, 'created', actor, kind_of_actor);
    return null;
  end if;

  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    insert into public.appointment_events (appointment_id, kind, previous_starts_at, previous_ends_at, actor_id, actor_kind)
    values (new.id, 'moved', old.starts_at, old.ends_at, actor, kind_of_actor);
  end if;

  if new.status is distinct from old.status then
    insert into public.appointment_events (appointment_id, kind, actor_id, actor_kind)
    values (
      new.id,
      case new.status
        when 'cancelled' then 'cancelled'::public.appointment_event_kind
        when 'no_show' then 'no_show'::public.appointment_event_kind
        else 'restored'::public.appointment_event_kind
      end,
      actor,
      kind_of_actor
    );
  end if;

  return null;
end;
$$;

drop function public.my_appointments();

create function public.my_appointments()
returns table (
  id uuid,
  person_id uuid,
  person_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  service_id uuid,
  service_name text,
  professional_id uuid,
  professional_name text,
  origin public.appointment_origin,
  cancelled_by public.appointment_canceller,
  change_deadline timestamptz,
  can_change boolean,
  can_reschedule boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.patient_id,
    mp.first_name || ' ' || mp.last_name,
    a.starts_at,
    a.ends_at,
    a.status,
    s.id,
    s.name,
    pr.id,
    pr.full_name,
    a.origin,
    a.cancelled_by,
    a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    a.status = 'scheduled'
      and now() < a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    a.status = 'scheduled'
      and now() < a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours))
      and pr.is_active
      and exists (
        select 1 from public.booking_catalog() bc
        where bc.service_id = s.id and not bc.phone_only
      )
  from public.my_people() mp
  join public.appointments a on a.patient_id = mp.id
  join public.services s on s.id = a.service_id
  join public.profiles pr on pr.id = a.professional_id
  cross join public.clinic_settings cs
  order by a.starts_at, a.id;
$$;

revoke all on function public.my_appointments() from public, anon;
grant execute on function public.my_appointments() to authenticated;

create or replace function public.reschedule_my_appointment(p_appointment_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  day_madrid date := (p_starts_at at time zone 'Europe/Madrid')::date;
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  select
    a.id,
    a.service_id,
    a.professional_id,
    a.starts_at,
    a.ends_at,
    a.status,
    make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)) as notice
  into target
  from public.appointments a
  join public.services s on s.id = a.service_id
  cross join public.clinic_settings cs
  where a.id = p_appointment_id
    and a.patient_id in (select mp.id from public.my_people() mp)
  for update of a;
  if not found then
    raise exception 'appointment_not_in_account' using errcode = 'P0001';
  end if;

  if target.status <> 'scheduled'
    or now() >= target.starts_at - target.notice
    or p_starts_at - target.notice <= now() then
    raise exception 'outside_change_window' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public._free_slots(target.service_id, target.professional_id, day_madrid, day_madrid, target.id) fs
    where fs.starts_at = p_starts_at
  ) then
    raise exception 'slot_not_available' using errcode = 'P0001';
  end if;

  perform set_config('lumia.booking_account', auth.uid()::text, true);

  begin
    update public.appointments
    set starts_at = p_starts_at,
        ends_at = p_starts_at + (target.ends_at - target.starts_at)
    where id = target.id;
  exception when exclusion_violation then
    raise exception 'slot_not_available' using errcode = 'P0001';
  end;

  return target.id;
end;
$$;

revoke all on function public.reschedule_my_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_my_appointment(uuid, timestamptz) to authenticated;

create or replace function public.my_reschedule_slots(p_appointment_id uuid, p_from date, p_to date)
returns table (starts_at timestamptz, professional_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  select
    a.id,
    a.service_id,
    a.professional_id,
    a.starts_at,
    a.status,
    make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)) as notice
  into target
  from public.appointments a
  join public.services s on s.id = a.service_id
  cross join public.clinic_settings cs
  where a.id = p_appointment_id
    and a.patient_id in (select mp.id from public.my_people() mp);
  if not found then
    raise exception 'appointment_not_in_account' using errcode = 'P0001';
  end if;

  if target.status <> 'scheduled' or now() >= target.starts_at - target.notice then
    raise exception 'outside_change_window' using errcode = 'P0001';
  end if;

  return query
    select fs.starts_at, fs.professional_id
    from public._free_slots(target.service_id, target.professional_id, p_from, p_to, target.id) fs
    where fs.starts_at - target.notice > now()
      and fs.starts_at <> target.starts_at
    order by fs.starts_at;
end;
$$;

revoke all on function public.my_reschedule_slots(uuid, date, date) from public, anon;
grant execute on function public.my_reschedule_slots(uuid, date, date) to authenticated;

create or replace function public.cancel_my_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  select
    a.id,
    a.starts_at,
    a.status,
    make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)) as notice
  into target
  from public.appointments a
  join public.services s on s.id = a.service_id
  cross join public.clinic_settings cs
  where a.id = p_appointment_id
    and a.patient_id in (select mp.id from public.my_people() mp)
  for update of a;
  if not found then
    raise exception 'appointment_not_in_account' using errcode = 'P0001';
  end if;

  if target.status <> 'scheduled' or now() >= target.starts_at - target.notice then
    raise exception 'outside_change_window' using errcode = 'P0001';
  end if;

  perform set_config('lumia.booking_account', auth.uid()::text, true);

  update public.appointments
  set status = 'cancelled',
      cancelled_by = 'patient',
      cancel_reason = ''
  where id = target.id;
end;
$$;

revoke all on function public.cancel_my_appointment(uuid) from public, anon;
grant execute on function public.cancel_my_appointment(uuid) to authenticated;

create or replace function public.my_contact(p_person_id uuid)
returns table (phone text, address text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.my_people() mp where mp.id = p_person_id) then
    raise exception 'person_not_in_account' using errcode = 'P0001';
  end if;

  return query
    select p.phone, p.address from public.people p where p.id = p_person_id;
end;
$$;

revoke all on function public.my_contact(uuid) from public, anon;
grant execute on function public.my_contact(uuid) to authenticated;

create or replace function public.update_my_contact(p_person_id uuid, p_phone text, p_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  person_is_minor boolean;
  normalized_phone text := public.normalize_phone(p_phone);
  trimmed_address text := trim(coalesce(p_address, ''));
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  select mp.is_minor into person_is_minor from public.my_people() mp where mp.id = p_person_id;
  if not found then
    raise exception 'person_not_in_account' using errcode = 'P0001';
  end if;

  if normalized_phone is null then
    if not person_is_minor then
      raise exception 'invalid_phone' using errcode = 'P0001';
    end if;
  elsif not (
    case when left(normalized_phone, 1) = '+'
      then length(normalized_phone) - 1 >= 8
      else length(normalized_phone) >= 9
    end
  ) then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  if length(trimmed_address) > 300 then
    raise exception 'address_too_long' using errcode = 'P0001';
  end if;

  perform set_config('lumia.booking_account', auth.uid()::text, true);

  update public.people
  set phone = normalized_phone, address = trimmed_address
  where id = p_person_id;
end;
$$;

revoke all on function public.update_my_contact(uuid, text, text) from public, anon;
grant execute on function public.update_my_contact(uuid, text, text) to authenticated;
