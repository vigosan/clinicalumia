create type public.appointment_origin as enum ('staff', 'web');
create type public.payment_status as enum ('not_required', 'pending', 'paid', 'refunded');
create type public.actor_kind as enum ('staff', 'patient');

alter table public.appointments
  add column origin public.appointment_origin not null default 'staff',
  add column booked_by_account uuid references auth.users(id) on delete set null,
  add column payment_required public.booking_payment not null default 'none',
  add column payment_amount_cents integer not null default 0 check (payment_amount_cents >= 0),
  add column payment_status public.payment_status not null default 'not_required',
  add constraint appointments_payment_status_required check (
    (payment_required = 'none' or payment_amount_cents = 0) = (payment_status = 'not_required')
  );

alter table public.appointment_events
  add column actor_kind public.actor_kind not null default 'staff';

alter table public.clinic_settings
  add column booking_min_notice_hours integer not null default 24 check (booking_min_notice_hours between 0 and 168),
  add column booking_horizon_days integer not null default 60 check (booking_horizon_days between 1 and 365),
  add column online_payments_enabled boolean not null default false;

create table public.patient_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  created_at timestamptz not null default now(),
  privacy_accepted_at timestamptz,
  privacy_version text
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index access_requests_email_idx on public.access_requests(email, created_at);
create index access_requests_ip_hash_idx on public.access_requests(ip_hash, created_at);

alter table public.patient_accounts enable row level security;
alter table public.access_requests enable row level security;

revoke all on public.patient_accounts from anon, authenticated;
revoke all on public.access_requests from anon, authenticated;

create or replace function public.prepare_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service record;
  professional record;
  patient_booking boolean := coalesce(current_setting('lumia.booking_account', true) = auth.uid()::text, false)
    and exists (select 1 from public.patient_accounts where id = auth.uid());
begin
  if patient_booking then
    new.origin := 'web';
    new.booked_by_account := auth.uid();
    new.created_by := null;
  else
    if auth.uid() is not null then
      if not (public.is_owner() or (public.is_active_staff() and new.professional_id = auth.uid())) then
        raise exception 'appointment_forbidden' using errcode = '42501';
      end if;
      new.created_by := auth.uid();
    end if;
    new.origin := 'staff';
    new.booked_by_account := null;
  end if;
  new.created_at := now();
  if not exists (
    select 1 from public.people
    where id = new.patient_id and is_patient and archived_at is null
  ) then
    raise exception 'patient_not_bookable' using errcode = '23514';
  end if;
  select price_cents, vat, specialty_id, booking_payment, booking_payment_value into service
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
  new.payment_required := service.booking_payment;
  new.payment_amount_cents := case service.booking_payment
    when 'fixed' then service.booking_payment_value
    when 'percent' then round(service.price_cents::numeric * service.booking_payment_value / 100)::integer
    when 'full' then service.price_cents
    else 0
  end;
  new.payment_status := case
    when new.payment_required = 'none' or new.payment_amount_cents = 0 then 'not_required'::public.payment_status
    else 'pending'::public.payment_status
  end;
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
    or (new.created_by is distinct from old.created_by and (new.created_by is not null or auth.uid() is not null))
    or new.created_at is distinct from old.created_at
    or new.price_cents is distinct from old.price_cents
    or new.vat is distinct from old.vat
    or new.origin is distinct from old.origin
    or (new.booked_by_account is distinct from old.booked_by_account and (new.booked_by_account is not null or auth.uid() is not null))
    or new.payment_required is distinct from old.payment_required
    or new.payment_amount_cents is distinct from old.payment_amount_cents then
    raise exception 'appointment_immutable_fields' using errcode = '23514';
  end if;

  if new.payment_status is distinct from old.payment_status and auth.uid() is not null then
    raise exception 'payment_status_locked' using errcode = '23514';
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
declare
  patient_actor boolean := new.origin = 'web'
    and coalesce(current_setting('lumia.booking_account', true) = auth.uid()::text, false);
  actor uuid := case when patient_actor then null else auth.uid() end;
  kind_of_actor public.actor_kind := case when patient_actor then 'patient'::public.actor_kind else 'staff'::public.actor_kind end;
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_events (appointment_id, kind, actor_id, actor_kind)
    values (new.id, 'created', actor, kind_of_actor);
    return null;
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
