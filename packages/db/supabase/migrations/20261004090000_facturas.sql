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
  status public.invoice_status not null default 'issued',
  constraint invoices_kind_shape check (
    (kind = 'rectifying') = (series = 'rectifying')
    and (kind = 'rectifying') = (rectifies_invoice_id is not null)
    and (kind = 'rectifying') = (reason <> '')
    and (kind = 'rectifying') = (total_cents < 0)
    and (kind = 'full') = (replaces_invoice_id is not null)
  )
);

create unique index invoices_one_simplified_per_payment on public.invoices(payment_id) where kind = 'simplified';
create unique index invoices_one_replacement on public.invoices(replaces_invoice_id) where replaces_invoice_id is not null;
create unique index invoices_one_rectification on public.invoices(rectifies_invoice_id) where rectifies_invoice_id is not null;
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

create or replace function public.clinic_invoice_header()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.clinic_settings;
begin
  select * into settings from public.clinic_settings;
  if btrim(settings.legal_name) = '' or btrim(settings.tax_id) = '' then
    raise exception 'clinic_fiscal_data_missing' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
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
    'footer', settings.invoice_footer
  );
end;
$$;

revoke all on function public.clinic_invoice_header() from public, anon, authenticated, service_role;

create or replace function public.issue_simplified_invoice(p_payment_id uuid)
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
  header := public.clinic_invoice_header();
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
    'simplified',
    payment.collected_at,
    p_payment_id,
    jsonb_build_object(
      'issuer', header->'issuer',
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
      'footer', header->'footer'
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
  if appointment.payment_status = 'paid' then
    deposit_cents := appointment.payment_amount_cents;
  end if;
  if p_amount_cents + deposit_cents > 40000 then
    raise exception 'full_invoice_required' using errcode = 'P0001';
  end if;
  begin
    insert into public.payments (appointment_id, amount_cents, method, vat, note, collected_by)
    values (p_appointment_id, p_amount_cents, p_method, appointment.vat, clean_note, auth.uid())
    returning id into payment_id;
  exception when unique_violation then
    raise exception 'already_paid' using errcode = 'P0001';
  end;
  if p_amount_cents + deposit_cents > 0 then
    perform public.issue_simplified_invoice(payment_id);
  end if;
  return payment_id;
end;
$$;

revoke all on function public.collect_payment(uuid, integer, public.payment_method, text) from public, anon;
grant execute on function public.collect_payment(uuid, integer, public.payment_method, text) to authenticated;

create or replace function public.is_valid_spanish_tax_id(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  id text := upper(regexp_replace(coalesce(p_value, ''), '[\s.-]', '', 'g'));
  letters constant text := 'TRWAGMYFPDXBNJZSQVHLCKE';
  cif_letters constant text := 'JABCDEFGHI';
  total integer := 0;
  digit integer;
  control integer;
begin
  if id ~ '^[0-9]{8}[A-Z]$' then
    return right(id, 1) = substr(letters, left(id, 8)::integer % 23 + 1, 1);
  end if;
  if id ~ '^[XYZ][0-9]{7}[A-Z]$' then
    return right(id, 1) = substr(letters, ((strpos('XYZ', left(id, 1)) - 1)::text || substr(id, 2, 7))::integer % 23 + 1, 1);
  end if;
  if id !~ '^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$' then
    return false;
  end if;
  for position in 1..7 loop
    digit := substr(id, position + 1, 1)::integer;
    if position % 2 = 1 then
      total := total + (digit * 2) / 10 + (digit * 2) % 10;
    else
      total := total + digit;
    end if;
  end loop;
  control := (10 - total % 10) % 10;
  if strpos('PQRSNW', left(id, 1)) > 0 then
    return right(id, 1) = substr(cif_letters, control + 1, 1);
  end if;
  if strpos('ABEH', left(id, 1)) > 0 then
    return right(id, 1) = control::text;
  end if;
  return right(id, 1) in (control::text, substr(cif_letters, control + 1, 1));
end;
$$;

revoke all on function public.is_valid_spanish_tax_id(text) from public, anon, authenticated, service_role;

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
  header := public.clinic_invoice_header();
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

create or replace function public.issue_rectifying_invoice(p_invoice_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := left(btrim(coalesce(p_reason, ''), E' \t\r\n'), 500);
  target record;
  original public.invoices;
  header jsonb;
  numbering record;
  issued timestamptz := now();
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
  select i.* into original
  from public.invoices i
  where i.payment_id = target.payment_id
    and i.kind <> 'rectifying'
    and i.status = 'issued'
    and not exists (select 1 from public.invoices r where r.rectifies_invoice_id = i.id);
  if not found then
    raise exception 'invoice_already_rectified' using errcode = 'P0001';
  end if;
  header := public.clinic_invoice_header();
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
    clean_reason,
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
      'reason', clean_reason
    ),
    -original.total_cents
  )
  returning id into invoice_id;
  perform public.append_invoice_record(invoice_id, case when original.kind = 'simplified' then 'R5' else 'R1' end);
  update public.payments
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = clean_reason
  where id = original.payment_id;
  return invoice_id;
end;
$$;

revoke all on function public.issue_rectifying_invoice(uuid, text) from public, anon;
grant execute on function public.issue_rectifying_invoice(uuid, text) to authenticated;

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
  if exists (
    select 1 from public.invoices i
    where i.payment_id = p_payment_id
      and i.kind <> 'rectifying'
      and i.status = 'issued'
      and not exists (select 1 from public.invoices r where r.rectifies_invoice_id = i.id)
  ) then
    raise exception 'invoice_requires_rectification' using errcode = 'P0001';
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

create or replace function public.list_invoices(
  p_start date default null,
  p_end date default null,
  p_kind public.invoice_kind default null,
  p_query text default null,
  p_professional_id uuid default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  code text,
  kind public.invoice_kind,
  status public.invoice_status,
  issued_at timestamptz,
  total_cents integer,
  recipient_name text,
  patient_id uuid,
  patient_name text,
  professional_id uuid,
  payment_id uuid,
  rectified boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  needle text := lower(public.f_unaccent(btrim(coalesce(p_query, ''))));
begin
  if not public.is_active_staff() then
    raise exception 'invoice_forbidden' using errcode = '42501';
  end if;
  return query
    select
      i.id,
      i.code,
      i.kind,
      i.status,
      i.issued_at,
      i.total_cents,
      i.snapshot->'recipient'->>'name',
      a.patient_id,
      pe.first_name || ' ' || pe.last_name,
      a.professional_id,
      i.payment_id,
      exists (select 1 from public.invoices r where r.rectifies_invoice_id = i.id),
      count(*) over ()
    from public.invoices i
    join public.payments p on p.id = i.payment_id
    join public.appointments a on a.id = p.appointment_id
    join public.people pe on pe.id = a.patient_id
    where (p_start is null or i.issued_at >= p_start::timestamp at time zone 'Europe/Madrid')
      and (p_end is null or i.issued_at < (p_end + 1)::timestamp at time zone 'Europe/Madrid')
      and (p_kind is null or i.kind = p_kind)
      and (p_professional_id is null or a.professional_id = p_professional_id)
      and (needle = '' or position(needle in lower(public.f_unaccent(
        i.code || ' ' || coalesce(i.snapshot->'recipient'->>'name', '') || ' ' || pe.first_name || ' ' || pe.last_name
      ))) > 0)
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    order by i.issued_at desc, i.series desc, i.number desc
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.list_invoices(date, date, public.invoice_kind, text, uuid, integer, integer) from public, anon;
grant execute on function public.list_invoices(date, date, public.invoice_kind, text, uuid, integer, integer) to authenticated;

create or replace function public.invoice_detail(p_invoice_id uuid)
returns table (
  id uuid,
  code text,
  kind public.invoice_kind,
  status public.invoice_status,
  issued_at timestamptz,
  total_cents integer,
  reason text,
  payment_id uuid,
  appointment_id uuid,
  patient_id uuid,
  professional_id uuid,
  snapshot jsonb,
  related jsonb,
  qr jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'invoice_forbidden' using errcode = '42501';
  end if;
  return query
    select
      i.id,
      i.code,
      i.kind,
      i.status,
      i.issued_at,
      i.total_cents,
      i.reason,
      i.payment_id,
      a.id,
      a.patient_id,
      a.professional_id,
      i.snapshot,
      jsonb_build_object(
        'replaces', (select jsonb_build_object('id', o.id, 'code', o.code) from public.invoices o where o.id = i.replaces_invoice_id),
        'replaced_by', (select jsonb_build_object('id', o.id, 'code', o.code) from public.invoices o where o.replaces_invoice_id = i.id),
        'rectifies', (select jsonb_build_object('id', o.id, 'code', o.code) from public.invoices o where o.id = i.rectifies_invoice_id),
        'rectified_by', (select jsonb_build_object('id', o.id, 'code', o.code) from public.invoices o where o.rectifies_invoice_id = i.id)
      ),
      jsonb_build_object(
        'nif', i.snapshot->'issuer'->>'tax_id',
        'code', i.code,
        'issued_on', to_char(i.issued_at at time zone 'Europe/Madrid', 'DD-MM-YYYY'),
        'total_cents', i.total_cents
      )
    from public.invoices i
    join public.payments p on p.id = i.payment_id
    join public.appointments a on a.id = p.appointment_id
    where i.id = p_invoice_id
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid());
  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.invoice_detail(uuid) from public, anon;
grant execute on function public.invoice_detail(uuid) to authenticated;

create table public.invoice_emails (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  sent_to text not null check (sent_to ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(sent_to) <= 320),
  sent_by uuid not null references public.profiles(id),
  sent_at timestamptz not null default now()
);

create index invoice_emails_invoice_idx on public.invoice_emails(invoice_id);

alter table public.invoice_emails enable row level security;

revoke all on public.invoice_emails from anon, authenticated, service_role;
grant select on public.invoice_emails to authenticated, service_role;

create policy "invoice_emails_select_own_or_owner" on public.invoice_emails
  for select to authenticated
  using (
    public.is_active_staff()
    and exists (
      select 1 from public.invoices i
      join public.payments p on p.id = i.payment_id
      join public.appointments a on a.id = p.appointment_id
      where i.id = invoice_emails.invoice_id
        and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
    )
  );

create or replace function public.record_invoice_email(p_invoice_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(coalesce(p_email, '')));
  email_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'invoice_forbidden' using errcode = '42501';
  end if;
  if clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(clean_email) > 320 then
    raise exception 'email_invalid' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.invoices i
    join public.payments p on p.id = i.payment_id
    join public.appointments a on a.id = p.appointment_id
    where i.id = p_invoice_id
      and (public.is_owner() or a.professional_id = auth.uid() or p.collected_by = auth.uid())
  ) then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
  insert into public.invoice_emails (invoice_id, sent_to, sent_by)
  values (p_invoice_id, clean_email, auth.uid())
  returning id into email_id;
  return email_id;
end;
$$;

revoke all on function public.record_invoice_email(uuid, text) from public, anon;
grant execute on function public.record_invoice_email(uuid, text) to authenticated;
