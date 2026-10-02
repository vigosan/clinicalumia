create function public.guard_invoiced_appointment_reassign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.appointment_is_invoiced(new.id) then
    raise exception 'appointment_invoiced' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger appointments_invoiced_reassign
  before update of professional_id on public.appointments
  for each row
  when (new.professional_id is distinct from old.professional_id)
  execute function public.guard_invoiced_appointment_reassign();

create function public.cancel_appointment_with_rectification(
  p_appointment_id uuid,
  p_cancelled_by public.appointment_canceller,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_invoice_id uuid;
  rectifying_id uuid;
begin
  select i.id into current_invoice_id
  from public.invoices i
  join public.payments p on p.id = i.payment_id
  where p.appointment_id = p_appointment_id
    and p.voided_at is null
    and i.kind <> 'rectifying'
    and i.status = 'issued'
    and not exists (select 1 from public.invoices r where r.rectifies_invoice_id = i.id);
  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;

  rectifying_id := public.issue_rectifying_invoice(
    current_invoice_id,
    coalesce(nullif(btrim(coalesce(p_reason, ''), E' \t\r\n'), ''), 'Cita cancelada')
  );

  update public.appointments
  set status = 'cancelled', cancelled_by = p_cancelled_by, cancel_reason = coalesce(p_reason, '')
  where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;

  return rectifying_id;
end;
$$;

revoke all on function public.cancel_appointment_with_rectification(uuid, public.appointment_canceller, text) from public, anon;
grant execute on function public.cancel_appointment_with_rectification(uuid, public.appointment_canceller, text) to authenticated;
