create or replace function public.correct_full_invoice_recipient(p_invoice_id uuid, p_recipient jsonb)
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
  if recipient = target.snapshot->'recipient' then
    raise exception 'recipient_unchanged' using errcode = 'P0001';
  end if;
  header := public.clinic_invoice_header(true);
  select * into numbering from public.next_invoice_number('main', issued);
  perform public.insert_rectifying_invoice(target.id, 'Corrección de los datos del destinatario');
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
