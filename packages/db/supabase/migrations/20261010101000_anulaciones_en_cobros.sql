drop function public.list_payments(timestamptz, timestamptz, uuid);

create function public.list_payments(
  p_start timestamptz,
  p_end timestamptz,
  p_professional_id uuid default null
)
returns table (
  id uuid,
  entry text,
  moment timestamptz,
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
      e.entry,
      e.moment,
      p.collected_at,
      e.amount_cents,
      p.method,
      p.collected_by,
      p.voided_at,
      p.void_reason,
      a.professional_id,
      a.patient_id,
      pe.first_name || ' ' || pe.last_name,
      s.name
    from public.payments p
    cross join lateral (
      values
        ('collected', p.collected_at, p.amount_cents),
        ('voided', p.voided_at, -p.amount_cents)
    ) as e(entry, moment, amount_cents)
    join public.appointments a on a.id = p.appointment_id
    join public.people pe on pe.id = a.patient_id
    join public.services s on s.id = a.service_id
    where e.moment >= p_start and e.moment < p_end
      and (p_professional_id is null or a.professional_id = p_professional_id)
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    order by e.moment asc, e.entry asc;
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
    select p.method, sum(e.amount_cents)::bigint
    from public.payments p
    cross join lateral (
      values
        (p.collected_at, p.amount_cents),
        (p.voided_at, -p.amount_cents)
    ) as e(moment, amount_cents)
    join public.appointments a on a.id = p.appointment_id
    where e.moment >= p_start and e.moment < p_end
      and (p_professional_id is null or a.professional_id = p_professional_id)
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    group by p.method
    having sum(e.amount_cents) <> 0
    order by p.method;
end;
$$;

revoke all on function public.payment_totals(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.payment_totals(timestamptz, timestamptz, uuid) to authenticated;
