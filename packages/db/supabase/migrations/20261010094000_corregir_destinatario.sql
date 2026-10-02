alter table public.invoices
  add column corrects_invoice_id uuid references public.invoices(id) on delete restrict;

alter table public.invoices drop constraint invoices_kind_shape;
alter table public.invoices add constraint invoices_kind_shape check (
  (kind = 'rectifying') = (series = 'rectifying')
  and (kind = 'rectifying') = (rectifies_invoice_id is not null)
  and (kind = 'rectifying') = (reason <> '')
  and (kind = 'rectifying') = (total_cents < 0)
  and (replaces_invoice_id is null or kind = 'full')
  and (corrects_invoice_id is null or (kind = 'full' and replaces_invoice_id is null))
);

create unique index invoices_one_correction on public.invoices(corrects_invoice_id)
  where corrects_invoice_id is not null;

drop index public.invoices_one_original_per_payment;
create unique index invoices_one_original_per_payment on public.invoices(payment_id)
  where kind <> 'rectifying' and replaces_invoice_id is null and corrects_invoice_id is null;

create function public.insert_rectifying_invoice(p_invoice_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.invoices;
  header jsonb;
  numbering record;
  issued timestamptz := now();
  invoice_id uuid;
begin
  select i.* into original from public.invoices i where i.id = p_invoice_id;
  header := public.clinic_invoice_header(true);
  if header->'issuer'->>'tax_id' is distinct from original.snapshot->'issuer'->>'tax_id' then
    raise exception 'clinic_tax_id_changed' using errcode = 'P0001';
  end if;
  select * into numbering from public.next_invoice_number('rectifying', issued);
  insert into public.invoices (series, number, code, kind, issued_at, payment_id, rectifies_invoice_id, reason, snapshot, total_cents)
  values (
    'rectifying',
    numbering.invoice_number,
    numbering.invoice_code,
    'rectifying',
    issued,
    original.payment_id,
    original.id,
    p_reason,
    original.snapshot || header || jsonb_build_object(
      'lines', (
        select jsonb_agg(l.line || jsonb_build_object(
          'base_cents', -(l.line->>'base_cents')::integer,
          'vat_cents', -(l.line->>'vat_cents')::integer,
          'total_cents', -(l.line->>'total_cents')::integer
        ) order by l.position)
        from jsonb_array_elements(original.snapshot->'lines') with ordinality as l(line, position)
      ),
      'totals', jsonb_build_object(
        'base_cents', -(original.snapshot->'totals'->>'base_cents')::integer,
        'vat_cents', -(original.snapshot->'totals'->>'vat_cents')::integer,
        'total_cents', -(original.snapshot->'totals'->>'total_cents')::integer
      ),
      'payments', (
        select jsonb_agg(t.payment || jsonb_build_object('amount_cents', -(t.payment->>'amount_cents')::integer) order by t.position)
        from jsonb_array_elements(original.snapshot->'payments') with ordinality as t(payment, position)
      ),
      'rectifies', jsonb_build_object(
        'code', original.code,
        'issued_on', to_char(original.issued_at at time zone 'Europe/Madrid', 'YYYY-MM-DD')
      ),
      'reason', p_reason
    ),
    -original.total_cents
  )
  returning id into invoice_id;
  perform public.append_invoice_record(invoice_id, case when original.kind = 'simplified' then 'R5' else 'R1' end);
  return invoice_id;
end;
$$;

revoke all on function public.insert_rectifying_invoice(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.issue_rectifying_invoice(p_invoice_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := left(btrim(coalesce(p_reason, ''), E' \t\r\n'), 500);
  target record;
  original_id uuid;
  invoice_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'invoice_forbidden' using errcode = '42501';
  end if;
  if clean_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select i.payment_id, p.collected_at, p.collected_by, a.professional_id
  into target
  from public.invoices i
  join public.payments p on p.id = i.payment_id
  join public.appointments a on a.id = p.appointment_id
  where i.id = p_invoice_id
  for update of p;
  if not found or not (public.is_owner() or target.professional_id = auth.uid() or target.collected_by = auth.uid()) then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
  if not (
    public.is_owner()
    or (
      target.collected_by = auth.uid()
      and (target.collected_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date
    )
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select i.id into original_id
  from public.invoices i
  where i.payment_id = target.payment_id
    and i.kind <> 'rectifying'
    and i.status = 'issued'
    and not exists (select 1 from public.invoices r where r.rectifies_invoice_id = i.id);
  if not found then
    raise exception 'invoice_already_rectified' using errcode = 'P0001';
  end if;
  invoice_id := public.insert_rectifying_invoice(original_id, clean_reason);
  update public.payments
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = clean_reason
  where id = target.payment_id;
  return invoice_id;
end;
$$;

revoke all on function public.issue_rectifying_invoice(uuid, text) from public, anon;
grant execute on function public.issue_rectifying_invoice(uuid, text) to authenticated;

create function public.correct_full_invoice_recipient(p_invoice_id uuid, p_recipient jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  recipient jsonb;
  header jsonb;
  numbering record;
  issued timestamptz := now();
  invoice_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'invoice_forbidden' using errcode = '42501';
  end if;
  select i.id, i.kind, i.status, i.payment_id, i.snapshot, i.total_cents,
         p.collected_at, p.collected_by, p.voided_at, a.professional_id
  into target
  from public.invoices i
  join public.payments p on p.id = i.payment_id
  join public.appointments a on a.id = p.appointment_id
  where i.id = p_invoice_id
  for update of p;
  if not found or not (public.is_owner() or target.professional_id = auth.uid() or target.collected_by = auth.uid()) then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
  if not (
    public.is_owner()
    or (
      target.collected_by = auth.uid()
      and (target.collected_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date
    )
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if target.kind <> 'full' then
    raise exception 'invoice_not_full' using errcode = 'P0001';
  end if;
  if target.status <> 'issued' or target.voided_at is not null
    or exists (select 1 from public.invoices r where r.rectifies_invoice_id = target.id) then
    raise exception 'invoice_already_rectified' using errcode = 'P0001';
  end if;
  recipient := public.invoice_recipient(p_recipient);
  perform public.insert_rectifying_invoice(target.id, 'Corrección de los datos del destinatario');
  header := public.clinic_invoice_header(true);
  select * into numbering from public.next_invoice_number('main', issued);
  insert into public.invoices (series, number, code, kind, issued_at, payment_id, corrects_invoice_id, snapshot, total_cents)
  values (
    'main',
    numbering.invoice_number,
    numbering.invoice_code,
    'full',
    issued,
    target.payment_id,
    target.id,
    target.snapshot || header || jsonb_build_object('recipient', recipient),
    target.total_cents
  )
  returning id into invoice_id;
  perform public.append_invoice_record(invoice_id, 'F1');
  return invoice_id;
end;
$$;

revoke all on function public.correct_full_invoice_recipient(uuid, jsonb) from public, anon;
grant execute on function public.correct_full_invoice_recipient(uuid, jsonb) to authenticated;
