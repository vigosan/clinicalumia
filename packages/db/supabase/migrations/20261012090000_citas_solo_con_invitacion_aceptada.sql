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
  from public.profiles where id = new.professional_id and is_active and public._account_activated(id);
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
security definer
set search_path = ''
as $$
declare
  moved boolean := new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at;
  reassigned boolean := new.professional_id is distinct from old.professional_id;
  target record;
begin
  if (reassigned and auth.uid() is not null and not public.is_owner())
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
    if new.status <> 'cancelled' or moved or reassigned or new.cancelled_by is distinct from old.cancelled_by then
      raise exception 'appointment_cancelled_final' using errcode = '23514';
    end if;
    new.cancelled_at := old.cancelled_at;
    return new;
  end if;

  if (moved or reassigned) and (old.status <> 'scheduled' or old.starts_at <= now()) then
    raise exception 'appointment_in_past' using errcode = '23514';
  end if;

  if reassigned then
    select specialty_id into target
    from public.profiles where id = new.professional_id and is_active and public._account_activated(id);
    if not found then
      raise exception 'professional_inactive' using errcode = '23514';
    end if;
    if target.specialty_id is distinct from (select specialty_id from public.services where id = new.service_id) then
      raise exception 'service_not_for_professional' using errcode = '23514';
    end if;
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
