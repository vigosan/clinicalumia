alter type public.appointment_event_kind add value 'reassigned';

alter table public.appointment_events
  add column previous_professional_id uuid references public.profiles(id) on delete set null;

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

  if new.professional_id is distinct from old.professional_id then
    insert into public.appointment_events (appointment_id, kind, previous_professional_id, actor_id, actor_kind)
    values (new.id, 'reassigned', old.professional_id, actor, kind_of_actor);
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

create or replace function public.guard_person_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.appointments
    where patient_id = new.id and status <> 'cancelled' and starts_at > now()
  ) then
    raise exception 'person_has_upcoming_appointments' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger people_keep_upcoming_appointments
  before update of archived_at on public.people
  for each row
  when (old.archived_at is null and new.archived_at is not null)
  execute function public.guard_person_archive();
