create index people_birth_date_idx on public.people(birth_date);

revoke all on function public.normalize_person_name(text) from public, anon;
grant execute on function public.normalize_person_name(text) to authenticated, service_role;

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
