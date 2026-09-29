create type public.reminder_channel as enum ('email', 'sms');

create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  channel public.reminder_channel not null,
  recipient text not null,
  sent_at timestamptz,
  error text not null default '',
  created_at timestamptz not null default now()
);

create unique index appointment_reminders_one_sent_per_channel
  on public.appointment_reminders(appointment_id, channel) where sent_at is not null;

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
      where ar.appointment_id = a.id and ar.channel = 'email' and ar.sent_at is not null
    );
$$;

revoke all on function public.reminder_candidates(date) from public, anon, authenticated;
grant execute on function public.reminder_candidates(date) to service_role;
