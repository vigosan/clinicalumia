create extension if not exists btree_gist with schema extensions;

create type public.appointment_status as enum ('scheduled', 'cancelled', 'no_show');
create type public.appointment_canceller as enum ('patient', 'clinic');
create type public.appointment_modality as enum ('in_person', 'online');
create type public.appointment_event_kind as enum ('created', 'moved', 'cancelled', 'no_show', 'restored');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete restrict,
  patient_id uuid not null references public.people(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  cancelled_by public.appointment_canceller,
  cancelled_at timestamptz,
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 2000),
  modality public.appointment_modality not null default 'in_person',
  notes text not null default '' check (char_length(notes) <= 2000),
  price_cents integer not null default 0 check (price_cents >= 0),
  vat public.vat_treatment not null default 'exempt',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_duration check (
    ends_at > starts_at
    and extract(epoch from ends_at - starts_at) between 300 and 28800
    and mod(extract(epoch from ends_at - starts_at), 300) = 0
  ),
  constraint appointments_cancellation check (
    (status = 'cancelled') = (cancelled_by is not null)
    and (status = 'cancelled') = (cancelled_at is not null)
  ),
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index appointments_professional_idx on public.appointments(professional_id, starts_at);
create index appointments_patient_idx on public.appointments(patient_id, starts_at);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind public.appointment_event_kind not null,
  previous_starts_at timestamptz,
  previous_ends_at timestamptz,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index appointment_events_appointment_idx on public.appointment_events(appointment_id, created_at);

create or replace function public.prepare_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service record;
  professional record;
begin
  if auth.uid() is not null then
    if not (public.is_owner() or (public.is_active_staff() and new.professional_id = auth.uid())) then
      raise exception 'appointment_forbidden' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
  end if;
  new.created_at := now();
  if not exists (
    select 1 from public.people
    where id = new.patient_id and is_patient and archived_at is null
  ) then
    raise exception 'patient_not_bookable' using errcode = '23514';
  end if;
  select price_cents, vat, specialty_id into service
  from public.services
  where id = new.service_id and is_active;
  if not found then
    raise exception 'service_inactive' using errcode = '23514';
  end if;
  select specialty_id into professional
  from public.profiles where id = new.professional_id and is_active;
  if not found then
    raise exception 'professional_inactive' using errcode = '23514';
  end if;
  if professional.specialty_id is distinct from service.specialty_id then
    raise exception 'service_not_for_professional' using errcode = '23514';
  end if;
  if (new.starts_at at time zone 'Europe/Madrid')::date <> (new.ends_at at time zone 'Europe/Madrid')::date
    and not (
      (new.ends_at at time zone 'Europe/Madrid')::date = (new.starts_at at time zone 'Europe/Madrid')::date + 1
      and (new.ends_at at time zone 'Europe/Madrid')::time = '00:00:00'
    ) then
    raise exception 'appointment_crosses_midnight' using errcode = '23514';
  end if;
  new.price_cents := service.price_cents;
  new.vat := service.vat;
  new.status := 'scheduled';
  new.cancelled_by := null;
  new.cancelled_at := null;
  return new;
end;
$$;

create or replace function public.guard_appointment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  moved boolean := new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at;
begin
  if new.professional_id is distinct from old.professional_id
    or new.patient_id is distinct from old.patient_id
    or new.service_id is distinct from old.service_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.price_cents is distinct from old.price_cents
    or new.vat is distinct from old.vat then
    raise exception 'appointment_immutable_fields' using errcode = '23514';
  end if;

  if old.status = 'cancelled' then
    if new.status <> 'cancelled' or moved or new.cancelled_by is distinct from old.cancelled_by then
      raise exception 'appointment_cancelled_final' using errcode = '23514';
    end if;
    new.cancelled_at := old.cancelled_at;
    return new;
  end if;

  if moved and (old.status <> 'scheduled' or old.starts_at <= now()) then
    raise exception 'appointment_in_past' using errcode = '23514';
  end if;

  if moved
    and (new.starts_at at time zone 'Europe/Madrid')::date <> (new.ends_at at time zone 'Europe/Madrid')::date
    and not (
      (new.ends_at at time zone 'Europe/Madrid')::date = (new.starts_at at time zone 'Europe/Madrid')::date + 1
      and (new.ends_at at time zone 'Europe/Madrid')::time = '00:00:00'
    ) then
    raise exception 'appointment_crosses_midnight' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if old.status <> 'scheduled' then
        raise exception 'appointment_invalid_transition' using errcode = '23514';
      end if;
      if new.cancelled_by is null then
        raise exception 'cancelled_by_required' using errcode = '23514';
      end if;
      new.cancelled_at := now();
    elsif new.status = 'no_show' and new.starts_at > now() then
      raise exception 'appointment_not_started' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.record_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_events (appointment_id, kind, actor_id)
    values (new.id, 'created', auth.uid());
    return null;
  end if;

  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    insert into public.appointment_events (appointment_id, kind, previous_starts_at, previous_ends_at, actor_id)
    values (new.id, 'moved', old.starts_at, old.ends_at, auth.uid());
  end if;

  if new.status is distinct from old.status then
    insert into public.appointment_events (appointment_id, kind, actor_id)
    values (
      new.id,
      case new.status
        when 'cancelled' then 'cancelled'::public.appointment_event_kind
        when 'no_show' then 'no_show'::public.appointment_event_kind
        else 'restored'::public.appointment_event_kind
      end,
      auth.uid()
    );
  end if;

  return null;
end;
$$;

create trigger appointments_prepare
  before insert on public.appointments
  for each row execute function public.prepare_appointment();

create trigger appointments_guard
  before update on public.appointments
  for each row execute function public.guard_appointment_update();

create trigger appointments_touch
  before update on public.appointments
  for each row execute function public.touch_updated_at();

create trigger appointments_record_event
  after insert or update on public.appointments
  for each row execute function public.record_appointment_event();

alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;

create policy "appointments_select_own_or_owner" on public.appointments
  for select to authenticated
  using (public.is_owner() or (public.is_active_staff() and professional_id = auth.uid()));
create policy "appointments_insert_own_or_owner" on public.appointments
  for insert to authenticated
  with check (public.is_owner() or (public.is_active_staff() and professional_id = auth.uid()));
create policy "appointments_update_own_or_owner" on public.appointments
  for update to authenticated
  using (public.is_owner() or (public.is_active_staff() and professional_id = auth.uid()))
  with check (public.is_owner() or (public.is_active_staff() and professional_id = auth.uid()));

create policy "appointment_events_select_own_or_owner" on public.appointment_events
  for select to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.id = appointment_events.appointment_id
      and (public.is_owner() or (public.is_active_staff() and a.professional_id = auth.uid()))
  ));

revoke insert, update, delete, truncate on public.appointment_events from anon, authenticated;
