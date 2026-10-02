do $$
declare
  clashes text;
begin
  select string_agg(
      format('persona %s: citas %s (%s) y %s (%s)', a.patient_id, a.id, a.starts_at, b.id, b.starts_at),
      E'\n' order by a.patient_id, a.starts_at
    )
    into clashes
  from public.appointments a
  join public.appointments b
    on b.patient_id = a.patient_id
    and b.id > a.id
    and tstzrange(b.starts_at, b.ends_at) && tstzrange(a.starts_at, a.ends_at)
  where a.status not in ('cancelled', 'no_show')
    and b.status not in ('cancelled', 'no_show');
  if clashes is not null then
    raise exception E'Hay personas con citas solapadas. Cancela o mueve una de cada par antes de aplicar esta migración:\n%', clashes;
  end if;
end;
$$;

alter table public.appointments
  add constraint appointments_patient_no_overlap exclude using gist (
    patient_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled', 'no_show'));

create or replace function public.book_appointment(
  p_person_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_madrid date := (p_starts_at at time zone 'Europe/Madrid')::date;
  candidate uuid;
  duration int;
  appointment_id uuid;
  violated text;
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.my_people() mp
    where mp.id = p_person_id and (mp.is_patient or mp.birth_date is not null)
  ) then
    raise exception 'person_not_in_account' using errcode = 'P0001';
  end if;

  select bc.duration_minutes into duration
  from public.booking_catalog() bc
  where bc.service_id = p_service_id and not bc.phone_only;
  if not found then
    raise exception 'service_not_bookable' using errcode = 'P0001';
  end if;

  select a.id into appointment_id
  from public.appointments a
  where a.patient_id = p_person_id and a.starts_at = p_starts_at and a.status = 'scheduled';
  if found then
    return appointment_id;
  end if;

  update public.people set is_patient = true where id = p_person_id and not is_patient;

  perform set_config('lumia.booking_account', auth.uid()::text, true);

  for candidate in
    select sl.professional_id
    from public.available_slots(p_service_id, p_professional_id, day_madrid, day_madrid) sl
    where sl.starts_at = p_starts_at
    order by sl.professional_id
  loop
    begin
      insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
      values (
        candidate,
        p_person_id,
        p_service_id,
        p_starts_at,
        p_starts_at + make_interval(mins => duration)
      )
      returning id into appointment_id;
      return appointment_id;
    exception when exclusion_violation then
      get stacked diagnostics violated = constraint_name;
      if violated = 'appointments_patient_no_overlap' then
        select a.id into appointment_id
        from public.appointments a
        where a.patient_id = p_person_id and a.starts_at = p_starts_at and a.status = 'scheduled';
        if found then
          return appointment_id;
        end if;
        raise exception 'person_has_appointment' using errcode = 'P0001';
      end if;
    end;
  end loop;

  raise exception 'slot_not_available' using errcode = 'P0001';
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz) to authenticated;

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

  if public.appointment_is_invoiced(target.id) then
    raise exception 'appointment_invoiced' using errcode = 'P0001';
  end if;

  if target.status <> 'scheduled'
    or now() >= target.starts_at - target.notice
    or p_starts_at - target.notice <= now() then
    raise exception 'outside_change_window' using errcode = 'P0001';
  end if;

  if p_starts_at = target.starts_at then
    return target.id;
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
