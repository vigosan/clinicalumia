create type public.invoice_series_code as enum ('main', 'rectifying');
create type public.invoice_kind as enum ('simplified', 'full', 'rectifying');
create type public.invoice_status as enum ('issued', 'replaced');
create type public.invoice_record_kind as enum ('alta', 'anulacion');

create or replace function public.format_invoice_code(p_format text, p_year integer, p_number integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text;
  width text;
begin
  if p_format is null or p_format !~ '\{n(:[1-9])?\}' then
    raise exception 'invoice_format_invalid' using errcode = 'P0001';
  end if;
  result := replace(
    replace(replace(p_format, '{año}', p_year::text), '{aa}', lpad((p_year % 100)::text, 2, '0')),
    '{n}', p_number::text
  );
  for width in select m[1] from regexp_matches(result, '\{n:([1-9])\}', 'g') as m loop
    result := replace(result, '{n:' || width || '}',
      lpad(p_number::text, greatest(width::integer, length(p_number::text)), '0'));
  end loop;
  return result;
end;
$$;

revoke all on function public.format_invoice_code(text, integer, integer) from public, anon;
grant execute on function public.format_invoice_code(text, integer, integer) to authenticated;

create or replace function public.invoice_hash(p_canonical text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(encode(extensions.digest(p_canonical, 'sha256'), 'hex'))
$$;

revoke all on function public.invoice_hash(text) from public, anon, authenticated, service_role;

create or replace function public.invoice_alta_canonical(
  p_issuer_tax_id text,
  p_code text,
  p_issued_on date,
  p_type text,
  p_vat_cents integer,
  p_total_cents integer,
  p_previous_hash text,
  p_generated_at timestamptz
)
returns text
language sql
stable
set search_path = ''
set timezone = 'Europe/Madrid'
as $$
  select 'IDEmisorFactura=' || btrim(p_issuer_tax_id)
    || '&NumSerieFactura=' || btrim(p_code)
    || '&FechaExpedicionFactura=' || to_char(p_issued_on, 'DD-MM-YYYY')
    || '&TipoFactura=' || p_type
    || '&CuotaTotal=' || (p_vat_cents / 100.0)::numeric(14, 2)
    || '&ImporteTotal=' || (p_total_cents / 100.0)::numeric(14, 2)
    || '&Huella=' || p_previous_hash
    || '&FechaHoraHusoGenRegistro=' || to_char(p_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM')
$$;

revoke all on function public.invoice_alta_canonical(text, text, date, text, integer, integer, text, timestamptz)
  from public, anon, authenticated, service_role;

create table public.invoice_series (
  code public.invoice_series_code not null,
  year integer not null check (year between 2000 and 2999),
  format text not null check (char_length(format) <= 40 and public.format_invoice_code(format, year, 1) <> ''),
  next_number integer not null default 1 check (next_number >= 1),
  locked boolean not null default false,
  primary key (code, year)
);

insert into public.invoice_series (code, year, format) values
  ('main', extract(year from now() at time zone 'Europe/Madrid')::integer, '{n}/{aa}'),
  ('rectifying', extract(year from now() at time zone 'Europe/Madrid')::integer, 'R{n}/{aa}');

alter table public.invoice_series enable row level security;

revoke all on public.invoice_series from anon, authenticated;
grant select on public.invoice_series to authenticated;

create policy "invoice_series_select_active_staff" on public.invoice_series
  for select to authenticated using (public.is_active_staff());

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  series public.invoice_series_code not null,
  number integer not null check (number >= 1),
  code text not null unique,
  kind public.invoice_kind not null,
  issued_at timestamptz not null,
  payment_id uuid not null references public.payments(id) on delete restrict,
  replaces_invoice_id uuid references public.invoices(id) on delete restrict,
  rectifies_invoice_id uuid references public.invoices(id) on delete restrict,
  reason text not null default '' check (char_length(reason) <= 500),
  snapshot jsonb not null,
  total_cents integer not null,
  status public.invoice_status not null default 'issued'
);

create unique index invoices_one_simplified_per_payment on public.invoices(payment_id) where kind = 'simplified';
create index invoices_payment_idx on public.invoices(payment_id);
create index invoices_issued_at_idx on public.invoices(issued_at);

create or replace function public.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'issued' and new.status = 'replaced'
      and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;
    end if;
  end if;
  raise exception 'invoice_immutable' using errcode = 'P0001';
end;
$$;

create trigger invoices_immutable
  before update or delete on public.invoices
  for each row execute function public.invoices_guard();
create trigger invoices_no_truncate
  before truncate on public.invoices
  for each statement execute function public.invoices_guard();

alter table public.invoices enable row level security;

revoke all on public.invoices from anon, authenticated, service_role;
grant select on public.invoices to authenticated, service_role;

create policy "invoices_select_own_or_owner" on public.invoices
  for select to authenticated
  using (
    public.is_active_staff()
    and exists (
      select 1 from public.payments p
      join public.appointments a on a.id = p.appointment_id
      where p.id = invoices.payment_id
        and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    )
  );

create table public.invoice_records (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  kind public.invoice_record_kind not null,
  generated_at timestamptz not null,
  previous_hash text not null,
  hash text not null check (hash ~ '^[0-9A-F]{64}$'),
  canonical text not null,
  sent_at timestamptz,
  aeat_status text
);

create unique index invoice_records_previous_hash_key on public.invoice_records(previous_hash);
create unique index invoice_records_hash_key on public.invoice_records(hash);
create index invoice_records_invoice_idx on public.invoice_records(invoice_id);

create or replace function public.invoice_records_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.hash is distinct from public.invoice_hash(new.canonical)
      or position('&Huella=' || new.previous_hash || '&FechaHoraHusoGenRegistro=' in new.canonical) = 0
      or (new.previous_hash <> '' and not exists (
        select 1 from public.invoice_records r where r.hash = new.previous_hash
      )) then
      raise exception 'invoice_chain_broken' using errcode = 'P0001';
    end if;
    return new;
  end if;
  raise exception 'invoice_record_immutable' using errcode = 'P0001';
end;
$$;

create trigger invoice_records_chain
  before insert or update or delete on public.invoice_records
  for each row execute function public.invoice_records_guard();
create trigger invoice_records_no_truncate
  before truncate on public.invoice_records
  for each statement execute function public.invoice_records_guard();

alter table public.invoice_records enable row level security;

revoke all on public.invoice_records from anon, authenticated, service_role;
grant select on public.invoice_records to service_role;

create or replace function public.next_invoice_number(p_series public.invoice_series_code, p_issued_at timestamptz)
returns table (invoice_number integer, invoice_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_year integer := extract(year from p_issued_at at time zone 'Europe/Madrid')::integer;
  series public.invoice_series;
begin
  insert into public.invoice_series (code, year, format)
  select p_series, invoice_year, s.format
  from public.invoice_series s
  where s.code = p_series
  order by s.year <= invoice_year desc, s.year desc
  limit 1
  on conflict (code, year) do nothing;
  select * into series
  from public.invoice_series s
  where s.code = p_series and s.year = invoice_year
  for update;
  update public.invoice_series s
  set next_number = series.next_number + 1,
      locked = true
  where s.code = p_series and s.year = invoice_year;
  return query select series.next_number, public.format_invoice_code(series.format, invoice_year, series.next_number);
end;
$$;

revoke all on function public.next_invoice_number(public.invoice_series_code, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.append_invoice_record(p_invoice_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice record;
  previous text;
  generated timestamptz;
  canonical text;
begin
  lock table public.invoice_records in exclusive mode;
  select i.code, i.issued_at, i.total_cents, i.snapshot into invoice
  from public.invoices i where i.id = p_invoice_id;
  select coalesce((
    select r.hash from public.invoice_records r
    where not exists (select 1 from public.invoice_records n where n.previous_hash = r.hash)
    order by r.generated_at desc
    limit 1
  ), '') into previous;
  generated := date_trunc('second', clock_timestamp());
  canonical := public.invoice_alta_canonical(
    invoice.snapshot->'issuer'->>'tax_id',
    invoice.code,
    (invoice.issued_at at time zone 'Europe/Madrid')::date,
    p_type,
    (invoice.snapshot->'totals'->>'vat_cents')::integer,
    invoice.total_cents,
    previous,
    generated
  );
  insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
  values (p_invoice_id, 'alta', generated, previous, public.invoice_hash(canonical), canonical);
end;
$$;

revoke all on function public.append_invoice_record(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.issue_simplified_invoice(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment record;
  settings public.clinic_settings;
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
  select * into settings from public.clinic_settings;
  if btrim(settings.legal_name) = '' or btrim(settings.tax_id) = '' then
    raise exception 'clinic_fiscal_data_missing' using errcode = 'P0001';
  end if;
  deposit_cents := case when payment.payment_status = 'paid' then payment.payment_amount_cents else 0 end;
  total_cents := payment.amount_cents + deposit_cents;
  base_cents := case when payment.vat = 'standard_21' then round(total_cents / 1.21)::integer else total_cents end;
  select * into numbering from public.next_invoice_number('main', payment.collected_at);
  insert into public.invoices (series, number, code, kind, issued_at, payment_id, snapshot, total_cents)
  values (
    'main',
    numbering.invoice_number,
    numbering.invoice_code,
    'simplified',
    payment.collected_at,
    p_payment_id,
    jsonb_build_object(
      'issuer', jsonb_build_object(
        'name', btrim(settings.legal_name),
        'tax_id', upper(btrim(settings.tax_id)),
        'address_line', settings.address_line,
        'postal_code', settings.postal_code,
        'city', settings.city,
        'province', settings.province,
        'phone', settings.phone,
        'email', settings.email,
        'website', settings.website
      ),
      'recipient', null,
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
      'footer', settings.invoice_footer
    ),
    total_cents
  )
  returning id into invoice_id;
  perform public.append_invoice_record(invoice_id, 'F2');
  return invoice_id;
end;
$$;

revoke all on function public.issue_simplified_invoice(uuid) from public, anon, authenticated, service_role;

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
  deposit_cents integer := 0;
begin
  if not public.is_active_staff() then
    raise exception 'payment_forbidden' using errcode = '42501';
  end if;
  select starts_at, status, vat, professional_id, payment_status, payment_amount_cents into appointment
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
  if appointment.payment_status = 'paid' then
    deposit_cents := appointment.payment_amount_cents;
  end if;
  if p_amount_cents + deposit_cents > 0 then
    perform public.issue_simplified_invoice(payment_id);
  end if;
  return payment_id;
end;
$$;

revoke all on function public.collect_payment(uuid, integer, public.payment_method, text) from public, anon;
grant execute on function public.collect_payment(uuid, integer, public.payment_method, text) to authenticated;
