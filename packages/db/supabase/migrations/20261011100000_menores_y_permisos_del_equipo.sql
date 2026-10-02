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

  if exists (
    select 1 from public.my_people() mp
    where mp.id = p_person_id and mp.is_minor
  ) and not exists (
    select 1
    from public.guardianships g
    join public.my_people() guardian on guardian.id = g.guardian_id
    where g.minor_id = p_person_id and guardian.relation = 'self' and not guardian.is_minor
  ) then
    raise exception 'minor_needs_guardian' using errcode = 'P0001';
  end if;

  select bc.duration_minutes into duration
  from public.booking_catalog() bc
  where bc.service_id = p_service_id and not bc.phone_only;
  if not found then
    raise exception 'service_not_bookable' using errcode = 'P0001';
  end if;

  select a.id into appointment_id
  from public.appointments a
  where a.patient_id = p_person_id and a.starts_at = p_starts_at and a.status = 'scheduled'
    and a.service_id = p_service_id and (p_professional_id is null or a.professional_id = p_professional_id);
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
        where a.patient_id = p_person_id and a.starts_at = p_starts_at and a.status = 'scheduled'
          and a.service_id = p_service_id and (p_professional_id is null or a.professional_id = p_professional_id);
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

create or replace function public.add_my_person(
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_phone text,
  p_guardian_id uuid,
  p_relationship public.guardian_relationship,
  p_is_patient boolean,
  p_accept_privacy boolean,
  p_privacy_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account record;
  guardian record;
  today_madrid date := (now() at time zone 'Europe/Madrid')::date;
  new_minor boolean := p_birth_date is not null and extract(year from age(today_madrid, p_birth_date)) < 18;
  accepted_version text := nullif(trim(p_privacy_version), '');
  person_id uuid;
begin
  select pa.email, pa.privacy_accepted_at into account
  from public.patient_accounts pa where pa.id = auth.uid();
  if not found then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  if length(coalesce(p_first_name, '')) > 100 or length(coalesce(p_last_name, '')) > 100 then
    raise exception 'name_too_long' using errcode = 'P0001';
  end if;

  if length(coalesce(p_phone, '')) > 30 then
    raise exception 'phone_too_long' using errcode = 'P0001';
  end if;

  if length(coalesce(p_privacy_version, '')) > 40 then
    raise exception 'privacy_version_too_long' using errcode = 'P0001';
  end if;

  if account.privacy_accepted_at is null and not coalesce(p_accept_privacy, false) then
    raise exception 'privacy_required' using errcode = 'P0001';
  end if;

  if coalesce(p_accept_privacy, false) and accepted_version is null then
    raise exception 'privacy_required' using errcode = 'P0001';
  end if;

  if p_guardian_id is null then
    if new_minor then
      raise exception 'person_not_adult' using errcode = 'P0001';
    end if;
  else
    if p_relationship is null then
      raise exception 'relationship_required' using errcode = 'P0001';
    end if;
    select mp.is_minor, mp.relation into guardian
    from public.my_people() mp where mp.id = p_guardian_id;
    if not found or guardian.relation <> 'self' then
      raise exception 'guardian_not_in_account' using errcode = 'P0001';
    end if;
    if guardian.is_minor then
      raise exception 'guardian_not_adult' using errcode = 'P0001';
    end if;
    if not new_minor then
      raise exception 'person_not_minor' using errcode = 'P0001';
    end if;
  end if;

  if coalesce(p_accept_privacy, false) then
    update public.patient_accounts
    set privacy_accepted_at = now(), privacy_version = accepted_version
    where id = auth.uid();
  end if;

  if p_guardian_id is null then
    select mp.id into person_id
    from public.my_people() mp
    where mp.relation = 'self'
      and public.normalize_person_name(mp.first_name) = public.normalize_person_name(p_first_name)
      and public.normalize_person_name(mp.last_name) = public.normalize_person_name(p_last_name)
      and (mp.birth_date is null or mp.birth_date = p_birth_date)
    order by mp.birth_date nulls last
    limit 1;
    if found then
      update public.people
      set birth_date = coalesce(birth_date, p_birth_date),
          phone = coalesce(phone, public.normalize_phone(p_phone))
      where id = person_id
        and (birth_date is null or phone is null);
      return person_id;
    end if;
  end if;

  if (
    select count(*)
    from public.my_people() mp
    join public.people p on p.id = mp.id
    where p.created_at >= today_madrid::timestamp at time zone 'Europe/Madrid'
  ) >= 10 then
    raise exception 'too_many_people_today' using errcode = 'P0001';
  end if;

  perform set_config('lumia.booking_account', auth.uid()::text, true);

  insert into public.people (first_name, last_name, birth_date, email, phone, is_patient)
  values (
    p_first_name,
    p_last_name,
    p_birth_date,
    case when p_guardian_id is null then account.email end,
    p_phone,
    coalesce(p_is_patient, true)
  )
  returning id into person_id;

  if p_guardian_id is not null then
    insert into public.guardianships (minor_id, guardian_id, relationship, is_primary)
    values (person_id, p_guardian_id, p_relationship, true);
  end if;

  return person_id;
end;
$$;

revoke all on function public.add_my_person(text, text, date, text, uuid, public.guardian_relationship, boolean, boolean, text) from public, anon;
grant execute on function public.add_my_person(text, text, date, text, uuid, public.guardian_relationship, boolean, boolean, text) to authenticated;

create or replace function public.person_upcoming_appointments(p_person_id uuid)
returns table (id uuid, starts_at timestamptz, professional_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'person_upcoming_appointments_forbidden' using errcode = '42501';
  end if;
  return query
    select a.id, a.starts_at, pr.full_name
    from public.appointments a
    join public.profiles pr on pr.id = a.professional_id
    where a.patient_id = p_person_id
      and a.status <> 'cancelled'
      and a.starts_at > now()
    order by a.starts_at;
end;
$$;

revoke all on function public.person_upcoming_appointments(uuid) from public, anon;
grant execute on function public.person_upcoming_appointments(uuid) to authenticated;

create or replace function public.guard_person_archive_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_owner() then
    raise exception 'person_archive_owner_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger people_archive_owner_only
  before update of archived_at on public.people
  for each row
  when (old.archived_at is distinct from new.archived_at)
  execute function public.guard_person_archive_owner();

drop policy "guardianships_update_active_staff" on public.guardianships;
drop policy "guardianships_delete_active_staff" on public.guardianships;
create policy "guardianships_update_owner" on public.guardianships
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "guardianships_delete_owner" on public.guardianships
  for delete to authenticated using (public.is_owner());

revoke select on public.employee_time_off from anon, authenticated;
grant select (id, profile_id, starts_at, ends_at) on public.employee_time_off to authenticated;

create or replace function public.time_off_between(p_profile_ids uuid[], p_from timestamptz, p_to timestamptz default null)
returns table (id uuid, profile_id uuid, starts_at timestamptz, ends_at timestamptz, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner boolean := public.is_owner();
begin
  if not public.is_active_staff() then
    raise exception 'time_off_forbidden' using errcode = '42501';
  end if;
  return query
    select t.id, t.profile_id, t.starts_at, t.ends_at, case when owner then t.reason end
    from public.employee_time_off t
    where t.profile_id = any(p_profile_ids)
      and t.ends_at > p_from
      and (p_to is null or t.starts_at < p_to)
    order by t.starts_at;
end;
$$;

revoke all on function public.time_off_between(uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.time_off_between(uuid[], timestamptz, timestamptz) to authenticated;
