create or replace function public.guard_appointment_update()
returns trigger
language plpgsql
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
    from public.profiles where id = new.professional_id and is_active;
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

create trigger appointments_invoiced_reassign
  before update of professional_id on public.appointments
  for each row
  when (new.professional_id is distinct from old.professional_id)
  execute function public.guard_invoiced_appointment_move();

create or replace function public.guard_professional_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.appointments
    where professional_id = new.id and status <> 'cancelled' and starts_at > now()
  ) then
    raise exception 'professional_has_upcoming_appointments' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_keep_upcoming_appointments
  before update of is_active on public.profiles
  for each row
  when (old.is_active and not new.is_active)
  execute function public.guard_professional_deactivation();

create or replace function public.person_upcoming_appointments(p_person_id uuid)
returns table (id uuid, starts_at timestamptz, professional_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'person_upcoming_appointments_forbidden' using errcode = '42501';
  end if;
  return query
    select a.id, a.starts_at, pr.full_name
    from public.appointments a
    join public.profiles pr on pr.id = a.professional_id
    where a.patient_id = p_person_id
      and a.status <> 'cancelled'
      and a.starts_at > now()
    order by a.starts_at;
end;
$$;

revoke all on function public.person_upcoming_appointments(uuid) from public, anon;
grant execute on function public.person_upcoming_appointments(uuid) to authenticated;
