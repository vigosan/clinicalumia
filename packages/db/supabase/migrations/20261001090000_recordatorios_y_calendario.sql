create type public.reminder_channel as enum ('email', 'sms');
create type public.reminder_status as enum ('pending', 'sent', 'failed');

create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  channel public.reminder_channel not null,
  recipient text not null,
  status public.reminder_status not null,
  sent_at timestamptz,
  error text not null default '',
  created_at timestamptz not null default now()
);

create unique index appointment_reminders_one_active_per_channel
  on public.appointment_reminders(appointment_id, channel) where status <> 'failed';

alter table public.appointment_reminders enable row level security;

revoke all on public.appointment_reminders from anon, authenticated;

create or replace function public.reminder_candidates(p_day date)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  person_name text,
  service_name text,
  professional_name text,
  change_deadline timestamptz,
  can_change boolean,
  recipients text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.starts_at,
    a.ends_at,
    p.first_name || ' ' || p.last_name,
    s.name,
    pr.full_name,
    a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    a.status = 'scheduled'
      and now() < a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    case
      when pacc.email is not null then array[lower(pacc.email)]
      when p.email is not null then array[lower(p.email)]
      else coalesce(g.emails, '{}')
    end
  from public.appointments a
  join public.people p on p.id = a.patient_id
  join public.services s on s.id = a.service_id
  join public.profiles pr on pr.id = a.professional_id
  cross join public.clinic_settings cs
  left join public.patient_accounts pacc on pacc.id = a.booked_by_account
  left join lateral (
    select array(
      select distinct lower(gp.email)
      from public.guardianships gs
      join public.people gp on gp.id = gs.guardian_id
      where gs.minor_id = p.id
        and gp.archived_at is null
        and gp.email is not null
      order by 1
    ) as emails
  ) g on true
  where a.status = 'scheduled'
    and (a.starts_at at time zone 'Europe/Madrid')::date = p_day
    and not exists (
      select 1 from public.appointment_reminders ar
      where ar.appointment_id = a.id
        and ar.channel = 'email'
        and (ar.status = 'sent' or (ar.status = 'pending' and ar.created_at > now() - interval '1 hour'))
    );
$$;

revoke all on function public.reminder_candidates(date) from public, anon, authenticated;
grant execute on function public.reminder_candidates(date) to service_role;

alter table public.profiles add column calendar_token text unique;

revoke select, insert, update on public.profiles from anon, authenticated;
grant select (id, email, full_name, role, specialty_id, is_active, created_at, updated_at, license_number)
  on public.profiles to anon, authenticated;
grant insert (id, email, full_name, role, specialty_id, is_active, created_at, updated_at, license_number)
  on public.profiles to anon, authenticated;
grant update (id, email, full_name, role, specialty_id, is_active, created_at, updated_at, license_number)
  on public.profiles to anon, authenticated;

create or replace function public.clear_calendar_token_on_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.calendar_token := null;
  return new;
end;
$$;

create trigger profiles_clear_calendar_token
  before update of is_active on public.profiles
  for each row
  when (old.is_active and not new.is_active)
  execute function public.clear_calendar_token_on_deactivation();

create or replace function public.my_calendar_token()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'calendar_token_forbidden' using errcode = '42501';
  end if;
  return (select calendar_token from public.profiles where id = auth.uid());
end;
$$;

revoke all on function public.my_calendar_token() from public, anon;
grant execute on function public.my_calendar_token() to authenticated;

create or replace function public.regenerate_my_calendar_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if not public.is_active_staff() then
    raise exception 'calendar_token_forbidden' using errcode = '42501';
  end if;
  token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  update public.profiles set calendar_token = token where id = auth.uid();
  return token;
end;
$$;

revoke all on function public.regenerate_my_calendar_token() from public, anon;
grant execute on function public.regenerate_my_calendar_token() to authenticated;

create or replace function public.revoke_calendar_token(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'calendar_token_forbidden' using errcode = '42501';
  end if;
  update public.profiles set calendar_token = null where id = p_profile_id;
end;
$$;

revoke all on function public.revoke_calendar_token(uuid) from public, anon;
grant execute on function public.revoke_calendar_token(uuid) to authenticated;

create or replace function public.calendar_feed(p_token text)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz,
  summary text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.starts_at,
    a.ends_at,
    a.updated_at,
    pe.first_name || ' ' || pe.last_name || ' · ' || s.name
  from public.profiles pr
  join public.appointments a on a.professional_id = pr.id
  join public.people pe on pe.id = a.patient_id
  join public.services s on s.id = a.service_id
  where pr.calendar_token = p_token
    and pr.is_active
    and a.status <> 'cancelled'
    and a.starts_at >= (((now() at time zone 'Europe/Madrid')::date - 30)::timestamp at time zone 'Europe/Madrid')
    and a.starts_at < (((now() at time zone 'Europe/Madrid')::date + 91)::timestamp at time zone 'Europe/Madrid')
  order by a.starts_at;
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;

create or replace function public.calendar_owner(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select full_name
  from public.profiles
  where calendar_token = p_token
    and is_active;
$$;

revoke all on function public.calendar_owner(text) from public;
grant execute on function public.calendar_owner(text) to anon, authenticated;
