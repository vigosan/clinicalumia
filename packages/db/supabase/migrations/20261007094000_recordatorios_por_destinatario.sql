drop index public.appointment_reminders_one_active_per_channel;

alter table public.appointment_reminders add column starts_at timestamptz;

insert into public.appointment_reminders (appointment_id, channel, recipient, status, sent_at, error, created_at)
select ar.appointment_id, ar.channel, split.recipient, ar.status, ar.sent_at, ar.error, ar.created_at
from public.appointment_reminders ar
cross join lateral unnest(string_to_array(ar.recipient, ', ')) as split(recipient)
where ar.recipient like '%, %';

delete from public.appointment_reminders where recipient like '%, %';

update public.appointment_reminders ar
set starts_at = a.starts_at
from public.appointments a
where a.id = ar.appointment_id;

alter table public.appointment_reminders alter column starts_at set not null;

create unique index appointment_reminders_one_active_per_recipient
  on public.appointment_reminders(appointment_id, channel, recipient, starts_at) where status <> 'failed';

create function public.appointment_recipient_emails(p_appointment_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select case
    when pacc.email is not null then array[lower(pacc.email)]
    when p.email is not null then array[lower(p.email)]
    else array(
      select distinct lower(gp.email)
      from public.guardianships gs
      join public.people gp on gp.id = gs.guardian_id
      where gs.minor_id = p.id
        and gp.archived_at is null
        and gp.email is not null
      order by 1
    )
  end
  from public.appointments a
  join public.people p on p.id = a.patient_id
  left join public.patient_accounts pacc on pacc.id = a.booked_by_account
  where a.id = p_appointment_id;
$$;

revoke all on function public.appointment_recipient_emails(uuid) from public, anon, authenticated, service_role;

create or replace function public.appointment_notice_recipients(p_appointment_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  appointment record;
begin
  if not public.is_active_staff() then
    raise exception 'notice_forbidden' using errcode = '42501';
  end if;
  select a.professional_id
  into appointment
  from public.appointments a
  where a.id = p_appointment_id;
  if not found or not (public.is_owner() or appointment.professional_id = auth.uid()) then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  return public.appointment_recipient_emails(p_appointment_id);
end;
$$;

drop function public.reminder_candidates(date);

create function public.reminder_candidates(p_day date)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz,
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
    a.updated_at,
    p.first_name || ' ' || p.last_name,
    s.name,
    pr.full_name,
    a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    a.status = 'scheduled'
      and now() < a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    owed.emails
  from public.appointments a
  join public.people p on p.id = a.patient_id
  join public.services s on s.id = a.service_id
  join public.profiles pr on pr.id = a.professional_id
  cross join public.clinic_settings cs
  cross join lateral (select public.appointment_recipient_emails(a.id) as emails) everyone
  cross join lateral (
    select array(
      select recipient.email
      from unnest(everyone.emails) with ordinality as recipient(email, position)
      where not exists (
        select 1 from public.appointment_reminders ar
        where ar.appointment_id = a.id
          and ar.channel = 'email'
          and ar.recipient = recipient.email
          and ar.starts_at = a.starts_at
          and (ar.status = 'sent' or (ar.status = 'pending' and ar.created_at > now() - interval '1 hour'))
      )
      order by recipient.position
    ) as emails
  ) owed
  where a.status = 'scheduled'
    and pr.is_active
    and p.archived_at is null
    and (a.starts_at at time zone 'Europe/Madrid')::date = p_day
    and (cardinality(everyone.emails) = 0 or cardinality(owed.emails) > 0);
$$;

revoke all on function public.reminder_candidates(date) from public, anon, authenticated;
grant execute on function public.reminder_candidates(date) to service_role;
