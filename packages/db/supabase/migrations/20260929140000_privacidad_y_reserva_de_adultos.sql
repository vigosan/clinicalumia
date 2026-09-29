create or replace function public.my_privacy_accepted()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  accepted_at timestamptz;
begin
  select pa.privacy_accepted_at into accepted_at
  from public.patient_accounts pa where pa.id = auth.uid();
  if not found then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;
  return accepted_at is not null;
end;
$$;

revoke all on function public.my_privacy_accepted() from public, anon;
grant execute on function public.my_privacy_accepted() to authenticated;

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
  chosen_professional uuid;
  duration int;
  appointment_id uuid;
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

  select sl.professional_id into chosen_professional
  from public.available_slots(p_service_id, p_professional_id, day_madrid, day_madrid) sl
  where sl.starts_at = p_starts_at
  order by sl.professional_id
  limit 1;
  if not found then
    raise exception 'slot_not_available' using errcode = 'P0001';
  end if;

  update public.people set is_patient = true where id = p_person_id and not is_patient;

  perform set_config('lumia.booking_account', auth.uid()::text, true);

  begin
    insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
    values (
      chosen_professional,
      p_person_id,
      p_service_id,
      p_starts_at,
      p_starts_at + make_interval(mins => duration)
    )
    returning id into appointment_id;
  exception when exclusion_violation then
    raise exception 'slot_not_available' using errcode = 'P0001';
  end;

  return appointment_id;
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz) to authenticated;
