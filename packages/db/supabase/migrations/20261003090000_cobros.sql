create type public.payment_method as enum ('cash', 'card', 'bizum', 'transfer');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  amount_cents integer not null check (amount_cents >= 0),
  method public.payment_method not null,
  vat public.vat_treatment not null,
  note text not null default '' check (char_length(note) <= 500),
  collected_at timestamptz not null default now(),
  collected_by uuid not null references public.profiles(id),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text not null default '',
  constraint payments_void check (
    (voided_at is null) = (voided_by is null)
    and (voided_at is null or void_reason <> '')
  )
);

create unique index payments_one_current_per_appointment on public.payments(appointment_id) where voided_at is null;
create index payments_collected_at_idx on public.payments(collected_at);
create index payments_appointment_idx on public.payments(appointment_id);

alter table public.payments enable row level security;

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

create policy "payments_select_own_or_owner" on public.payments
  for select to authenticated
  using (
    public.is_active_staff()
    and (
      collected_by = auth.uid()
      or exists (
        select 1 from public.appointments a
        where a.id = payments.appointment_id
          and (public.is_owner() or a.professional_id = auth.uid())
      )
    )
  );

create or replace function public.suggested_amount(p_appointment_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  appointment record;
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  select price_cents, payment_status, payment_amount_cents, professional_id into appointment
  from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  if not (public.is_owner() or appointment.professional_id = auth.uid()) then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  return greatest(
    appointment.price_cents
      - case when appointment.payment_status = 'paid' then appointment.payment_amount_cents else 0 end,
    0
  );
end;
$$;

revoke all on function public.suggested_amount(uuid) from public, anon;
grant execute on function public.suggested_amount(uuid) to authenticated;

create or replace function public.collect_payment(
  p_appointment_id uuid,
  p_amount_cents integer,
  p_method public.payment_method,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment record;
  clean_note text := left(btrim(coalesce(p_note, ''), E' \t\r\n'), 500);
  payment_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  select starts_at, status, vat, professional_id into appointment
  from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  if not (public.is_owner() or appointment.professional_id = auth.uid()) then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_method is null then
    raise exception 'invalid_method' using errcode = 'P0001';
  end if;
  if appointment.starts_at > now() then
    raise exception 'appointment_not_started' using errcode = 'P0001';
  end if;
  if appointment.status = 'cancelled' and clean_note = '' then
    raise exception 'appointment_cancelled_needs_note' using errcode = 'P0001';
  end if;
  if p_amount_cents <> public.suggested_amount(p_appointment_id) and clean_note = '' then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where appointment_id = p_appointment_id and voided_at is null) then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;
  begin
    insert into public.payments (appointment_id, amount_cents, method, vat, note, collected_by)
    values (p_appointment_id, p_amount_cents, p_method, appointment.vat, clean_note, auth.uid())
    returning id into payment_id;
  exception when unique_violation then
    raise exception 'already_paid' using errcode = 'P0001';
  end;
  return payment_id;
end;
$$;

revoke all on function public.collect_payment(uuid, integer, public.payment_method, text) from public, anon;
grant execute on function public.collect_payment(uuid, integer, public.payment_method, text) to authenticated;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment record;
  clean_reason text := left(btrim(coalesce(p_reason, ''), E' \t\r\n'), 500);
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  select p.collected_at, p.collected_by, p.voided_at, a.professional_id
  into payment
  from public.payments p
  join public.appointments a on a.id = p.appointment_id
  where p.id = p_payment_id
  for update of p;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;
  if not (
    public.is_owner()
    or payment.collected_by = auth.uid()
    or payment.professional_id = auth.uid()
  ) then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;
  if clean_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if payment.voided_at is not null then
    raise exception 'already_voided' using errcode = 'P0001';
  end if;
  if not (
    public.is_owner()
    or (
      payment.collected_by = auth.uid()
      and (payment.collected_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date
    )
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update public.payments
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = clean_reason
  where id = p_payment_id;
end;
$$;

revoke all on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.void_payment(uuid, text) to authenticated;

create or replace function public.list_payments(
  p_start timestamptz,
  p_end timestamptz,
  p_professional_id uuid default null
)
returns table (
  id uuid,
  collected_at timestamptz,
  amount_cents integer,
  method public.payment_method,
  collected_by uuid,
  voided_at timestamptz,
  void_reason text,
  professional_id uuid,
  patient_id uuid,
  patient_name text,
  service_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  return query
    select
      p.id,
      p.collected_at,
      p.amount_cents,
      p.method,
      p.collected_by,
      p.voided_at,
      p.void_reason,
      a.professional_id,
      a.patient_id,
      pe.first_name || ' ' || pe.last_name,
      s.name
    from public.payments p
    join public.appointments a on a.id = p.appointment_id
    join public.people pe on pe.id = a.patient_id
    join public.services s on s.id = a.service_id
    where p.collected_at >= p_start and p.collected_at < p_end
      and (p_professional_id is null or a.professional_id = p_professional_id)
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    order by p.collected_at asc;
end;
$$;

revoke all on function public.list_payments(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.list_payments(timestamptz, timestamptz, uuid) to authenticated;

create or replace function public.payment_totals(
  p_start timestamptz,
  p_end timestamptz,
  p_professional_id uuid default null
)
returns table (
  method public.payment_method,
  cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  return query
    select p.method, sum(p.amount_cents)::bigint
    from public.payments p
    join public.appointments a on a.id = p.appointment_id
    where p.collected_at >= p_start and p.collected_at < p_end
      and p.voided_at is null
      and (p_professional_id is null or a.professional_id = p_professional_id)
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    group by p.method
    order by p.method;
end;
$$;

revoke all on function public.payment_totals(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.payment_totals(timestamptz, timestamptz, uuid) to authenticated;

create or replace function public.pending_payments(p_since timestamptz)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  patient_id uuid,
  patient_name text,
  service_name text,
  professional_id uuid,
  suggested_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  return query
    select
      a.id,
      a.starts_at,
      a.patient_id,
      pe.first_name || ' ' || pe.last_name,
      s.name,
      a.professional_id,
      greatest(
        a.price_cents
          - case when a.payment_status = 'paid' then a.payment_amount_cents else 0 end,
        0
      )
    from public.appointments a
    join public.people pe on pe.id = a.patient_id
    join public.services s on s.id = a.service_id
    where a.starts_at >= p_since and a.starts_at <= now()
      and a.status <> 'cancelled'
      and (public.is_owner() or a.professional_id = auth.uid())
      and not exists (
        select 1 from public.payments p
        where p.appointment_id = a.id and p.voided_at is null
      )
    order by a.starts_at asc;
end;
$$;

revoke all on function public.pending_payments(timestamptz) from public, anon;
grant execute on function public.pending_payments(timestamptz) to authenticated;
