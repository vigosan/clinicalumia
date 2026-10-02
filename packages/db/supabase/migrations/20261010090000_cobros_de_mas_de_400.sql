alter table public.invoices drop constraint invoices_kind_shape;
alter table public.invoices add constraint invoices_kind_shape check (
  (kind = 'rectifying') = (series = 'rectifying')
  and (kind = 'rectifying') = (rectifies_invoice_id is not null)
  and (kind = 'rectifying') = (reason <> '')
  and (kind = 'rectifying') = (total_cents < 0)
  and (replaces_invoice_id is null or kind = 'full')
);

create or replace function public.invoice_recipient(p_recipient jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  recipient jsonb;
begin
  if p_recipient is null or jsonb_typeof(p_recipient) <> 'object' then
    raise exception 'recipient_invalid' using errcode = 'P0001';
  end if;
  recipient := jsonb_build_object(
    'name', btrim(coalesce(p_recipient->>'name', '')),
    'tax_id', upper(regexp_replace(coalesce(p_recipient->>'tax_id', ''), '[\s.-]', '', 'g')),
    'address', btrim(coalesce(p_recipient->>'address', '')),
    'postal_code', btrim(coalesce(p_recipient->>'postal_code', '')),
    'city', btrim(coalesce(p_recipient->>'city', ''))
  );
  if exists (select 1 from jsonb_each_text(recipient) e where e.value = '' or char_length(e.value) > 200) then
    raise exception 'recipient_invalid' using errcode = 'P0001';
  end if;
  if not public.is_valid_spanish_tax_id(recipient->>'tax_id') then
    raise exception 'recipient_tax_id_invalid' using errcode = 'P0001';
  end if;
  return recipient;
end;
$$;

revoke all on function public.invoice_recipient(jsonb) from public, anon, authenticated, service_role;

create or replace function public.issue_payment_invoice(p_payment_id uuid, p_recipient jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment record;
  settings public.clinic_settings;
  header jsonb;
  deposit_cents integer;
  total_cents integer;
  base_cents integer;
  numbering record;
  invoice_id uuid;
begin
  select p.amount_cents, p.method, p.vat, p.collected_at,
         a.starts_at, a.payment_status, a.payment_amount_cents,
         s.name as service_name, pe.first_name, pe.last_name
  into payment
  from public.payments p
  join public.appointments a on a.id = p.appointment_id
  join public.services s on s.id = a.service_id
  join public.people pe on pe.id = a.patient_id
  where p.id = p_payment_id;
  header := public.clinic_invoice_header(p_recipient is not null);
  select * into settings from public.clinic_settings;
  deposit_cents := case when payment.payment_status = 'paid' then payment.payment_amount_cents else 0 end;
  total_cents := payment.amount_cents + deposit_cents;
  base_cents := case when payment.vat = 'standard_21' then round(total_cents / 1.21)::integer else total_cents end;
  select * into numbering from public.next_invoice_number('main', payment.collected_at);
  insert into public.invoices (series, number, code, kind, issued_at, payment_id, snapshot, total_cents)
  values (
    'main',
    numbering.invoice_number,
    numbering.invoice_code,
    case when p_recipient is null then 'simplified' else 'full' end::public.invoice_kind,
    payment.collected_at,
    p_payment_id,
    jsonb_build_object(
      'issuer', header->'issuer',
      'recipient', p_recipient,
      'lines', jsonb_build_array(jsonb_build_object(
        'description', payment.service_name,
        'session_date', to_char(payment.starts_at at time zone 'Europe/Madrid', 'YYYY-MM-DD'),
        'patient', payment.first_name || ' ' || left(split_part(payment.last_name, ' ', 1), 1) || '.',
        'quantity', 1,
        'base_cents', base_cents,
        'vat_rate', case when payment.vat = 'standard_21' then 21 else 0 end,
        'vat_cents', total_cents - base_cents,
        'total_cents', total_cents
      )),
      'totals', jsonb_build_object(
        'base_cents', base_cents,
        'vat_cents', total_cents - base_cents,
        'total_cents', total_cents
      ),
      'vat', payment.vat,
      'vat_note', case when payment.vat = 'exempt' then settings.vat_exemption_text else '' end,
      'payments', (
        select jsonb_agg(jsonb_build_object('method', t.method, 'amount_cents', t.amount_cents) order by t.position)
        from (values (1, 'online', deposit_cents), (2, payment.method::text, payment.amount_cents))
          as t(position, method, amount_cents)
        where t.amount_cents > 0
      ),
      'footer', header->'footer'
    ),
    total_cents
  )
  returning id into invoice_id;
  perform public.append_invoice_record(invoice_id, case when p_recipient is null then 'F2' else 'F1' end);
  return invoice_id;
end;
$$;

revoke all on function public.issue_payment_invoice(uuid, jsonb) from public, anon, authenticated, service_role;

create or replace function public.issue_simplified_invoice(p_payment_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.issue_payment_invoice(p_payment_id, null)
$$;

revoke all on function public.issue_simplified_invoice(uuid) from public, anon, authenticated, service_role;

drop function public.collect_payment(uuid, integer, public.payment_method, text);

create function public.collect_payment(
  p_appointment_id uuid,
  p_amount_cents integer,
  p_method public.payment_method,
  p_note text,
  p_recipient jsonb default null
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
  deposit_cents integer := 0;
  recipient jsonb;
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  select status, vat, professional_id, payment_status, payment_amount_cents into appointment
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
  if appointment.status = 'cancelled' and clean_note = '' then
    raise exception 'appointment_cancelled_needs_note' using errcode = 'P0001';
  end if;
  if p_amount_cents <> public.suggested_amount(p_appointment_id) and clean_note = '' then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where appointment_id = p_appointment_id and voided_at is null) then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;
  if appointment.payment_status = 'paid' then
    deposit_cents := appointment.payment_amount_cents;
  end if;
  if p_amount_cents + deposit_cents > 40000 then
    if p_recipient is null then
      raise exception 'full_invoice_required' using errcode = 'P0001';
    end if;
    recipient := public.invoice_recipient(p_recipient);
  end if;
  begin
    insert into public.payments (appointment_id, amount_cents, method, vat, note, collected_by)
    values (p_appointment_id, p_amount_cents, p_method, appointment.vat, clean_note, auth.uid())
    returning id into payment_id;
  exception when unique_violation then
    raise exception 'already_paid' using errcode = 'P0001';
  end;
  if p_amount_cents + deposit_cents > 0 then
    perform public.issue_payment_invoice(payment_id, recipient);
  end if;
  return payment_id;
end;
$$;

revoke all on function public.collect_payment(uuid, integer, public.payment_method, text, jsonb) from public, anon;
grant execute on function public.collect_payment(uuid, integer, public.payment_method, text, jsonb) to authenticated;

create or replace function public.issue_full_invoice(p_invoice_id uuid, p_recipient jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original record;
  current_status public.invoice_status;
  recipient jsonb;
  header jsonb;
  numbering record;
  issued timestamptz := now();
  invoice_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'invoice_forbidden' using errcode = '42501';
  end if;
  select i.id, i.kind, i.payment_id, i.snapshot, i.total_cents, p.collected_by, a.professional_id
  into original
  from public.invoices i
  join public.payments p on p.id = i.payment_id
  join public.appointments a on a.id = p.appointment_id
  where i.id = p_invoice_id
  for update of p;
  if not found or not (public.is_owner() or original.professional_id = auth.uid() or original.collected_by = auth.uid()) then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
  if original.kind <> 'simplified' then
    raise exception 'invoice_not_simplified' using errcode = 'P0001';
  end if;
  select i.status into current_status from public.invoices i where i.id = original.id;
  if current_status = 'replaced' then
    raise exception 'invoice_already_replaced' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.invoices r where r.rectifies_invoice_id = original.id) then
    raise exception 'invoice_already_rectified' using errcode = 'P0001';
  end if;
  recipient := public.invoice_recipient(p_recipient);
  header := public.clinic_invoice_header(true);
  if header->'issuer'->>'tax_id' is distinct from original.snapshot->'issuer'->>'tax_id' then
    raise exception 'clinic_tax_id_changed' using errcode = 'P0001';
  end if;
  select * into numbering from public.next_invoice_number('main', issued);
  insert into public.invoices (series, number, code, kind, issued_at, payment_id, replaces_invoice_id, snapshot, total_cents)
  values (
    'main',
    numbering.invoice_number,
    numbering.invoice_code,
    'full',
    issued,
    original.payment_id,
    original.id,
    original.snapshot || header || jsonb_build_object('recipient', recipient),
    original.total_cents
  )
  returning id into invoice_id;
  update public.invoices set status = 'replaced' where id = original.id;
  perform public.append_invoice_record(invoice_id, 'F3');
  return invoice_id;
end;
$$;

revoke all on function public.issue_full_invoice(uuid, jsonb) from public, anon;
grant execute on function public.issue_full_invoice(uuid, jsonb) to authenticated;
