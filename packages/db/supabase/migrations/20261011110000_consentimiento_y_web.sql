alter table public.consents add column guardian_tax_id text;
alter table public.consents alter column tax_id drop not null;
alter table public.consents add constraint consents_some_tax_id check (tax_id is not null or guardian_tax_id is not null);

drop index public.consents_search_idx;
alter table public.consents drop column search_text;
alter table public.consents add column search_text text generated always as (
  lower(public.f_unaccent(
    first_name || ' ' || last_name
    || coalesce(' ' || upper(regexp_replace(tax_id, '[\s.\-]', '', 'g')), '')
    || coalesce(' ' || upper(regexp_replace(guardian_tax_id, '[\s.\-]', '', 'g')), '')
  ))
) stored;
create index consents_search_idx on public.consents using gin (search_text extensions.gin_trgm_ops);

create or replace function public.link_consent(p_consent_id uuid, p_person_id uuid, p_fill text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent public.consents;
  own_tax_id text;
begin
  if exists (select 1 from unnest(p_fill) field where field not in ('tax_id', 'email', 'birth_date')) then
    raise exception 'invalid_fill_field' using errcode = 'P0001';
  end if;

  perform public.link_consent(p_consent_id, p_person_id);

  select * into consent from public.consents where id = p_consent_id;
  own_tax_id := case
    when consent.guardian_name <> '' and consent.guardian_tax_id is null then null
    else consent.tax_id
  end;

  begin
    update public.people p
    set tax_id = case when 'tax_id' = any(p_fill) and p.tax_id is null then own_tax_id else p.tax_id end,
        email = case when 'email' = any(p_fill) and p.email is null then consent.email else p.email end,
        birth_date = case when 'birth_date' = any(p_fill) and p.birth_date is null then consent.birth_date else p.birth_date end
    where p.id = p_person_id;
  exception when unique_violation then
    raise exception 'tax_id_taken' using errcode = 'P0001';
  end;
end;
$$;

revoke all on function public.link_consent(uuid, uuid, text[]) from public, anon;
grant execute on function public.link_consent(uuid, uuid, text[]) to authenticated;

drop function public.booking_catalog();

create function public.booking_catalog()
returns table (
  specialty_id uuid,
  specialty_name text,
  service_id uuid,
  service_name text,
  duration_minutes int,
  price_cents int,
  bookable_online boolean,
  phone_only boolean,
  professionals jsonb,
  cancellation_hours int
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
    ), '[]'::jsonb),
    coalesce(s.cancellation_hours, cs.cancellation_hours)
  from public.services s
  join public.specialties sp on sp.id = s.specialty_id
  cross join public.clinic_settings cs
  where s.is_active and s.bookable_online;
$$;

revoke all on function public.booking_catalog() from public;
grant execute on function public.booking_catalog() to anon, authenticated;

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

  if p_starts_at < now() + make_interval(hours => (select cs.booking_min_notice_hours from public.clinic_settings cs)) then
    raise exception 'slot_too_soon' using errcode = 'P0001';
  end if;

  raise exception 'slot_not_available' using errcode = 'P0001';
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz) to authenticated;
