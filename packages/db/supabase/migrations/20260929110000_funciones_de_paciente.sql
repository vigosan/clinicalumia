create or replace function public.normalize_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.tax_id := nullif(upper(regexp_replace(coalesce(new.tax_id, ''), '[\s.\-]', '', 'g')), '');
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.phone := public.normalize_phone(new.phone);
  if new.birth_date is not null
    and new.birth_date > (now() at time zone 'Europe/Madrid')::date then
    raise exception 'birth_date must not be in the future' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if coalesce(current_setting('lumia.booking_account', true) = auth.uid()::text, false) then
      new.created_by := null;
    elsif auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create or replace function public.my_people()
returns table (
  id uuid,
  first_name text,
  last_name text,
  birth_date date,
  is_minor boolean,
  is_patient boolean,
  relation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_email text;
  today_madrid date := (now() at time zone 'Europe/Madrid')::date;
begin
  select pa.email into account_email from public.patient_accounts pa where pa.id = auth.uid();
  if not found then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  return query
    with own as (
      select p.*
      from public.people p
      where p.email = account_email and p.archived_at is null
    ),
    wards as (
      select p.*
      from public.people p
      where p.archived_at is null
        and p.birth_date is not null
        and extract(year from age(today_madrid, p.birth_date)) < 18
        and exists (
          select 1 from public.guardianships g
          join own on own.id = g.guardian_id
          where g.minor_id = p.id
        )
        and not exists (select 1 from own where own.id = p.id)
    ),
    everyone as (
      select own.id, own.first_name, own.last_name, own.birth_date, own.is_patient, 'self'::text as relation from own
      union all
      select wards.id, wards.first_name, wards.last_name, wards.birth_date, wards.is_patient, 'ward'::text from wards
    )
    select
      e.id,
      e.first_name,
      e.last_name,
      e.birth_date,
      coalesce(extract(year from age(today_madrid, e.birth_date)) < 18, false),
      e.is_patient,
      e.relation
    from everyone e
    order by e.relation, e.first_name, e.last_name;
end;
$$;

revoke all on function public.my_people() from public, anon;
grant execute on function public.my_people() to authenticated;

create or replace function public.my_appointments()
returns table (
  id uuid,
  person_id uuid,
  person_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  service_name text,
  professional_name text,
  origin public.appointment_origin
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
    s.name,
    pr.full_name,
    a.origin
  from public.my_people() mp
  join public.appointments a on a.patient_id = mp.id
  join public.services s on s.id = a.service_id
  join public.profiles pr on pr.id = a.professional_id
  order by a.starts_at, a.id;
$$;

revoke all on function public.my_appointments() from public, anon;
grant execute on function public.my_appointments() to authenticated;

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
  person_id uuid;
begin
  select pa.email, pa.privacy_accepted_at into account
  from public.patient_accounts pa where pa.id = auth.uid();
  if not found then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  if account.privacy_accepted_at is null and not coalesce(p_accept_privacy, false) then
    raise exception 'privacy_required' using errcode = 'P0001';
  end if;

  if p_guardian_id is null then
    if new_minor then
      raise exception 'person_not_adult' using errcode = 'P0001';
    end if;
  else
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
    set privacy_accepted_at = now(), privacy_version = p_privacy_version
    where id = auth.uid();
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
    select 1 from public.my_people() mp where mp.id = p_person_id and mp.is_patient
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
