begin;
create extension if not exists pgtap with schema extensions;
select plan(77);

create or replace function pg_temp.create_test_session(user_id uuid) returns uuid language sql security definer as $$
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (gen_random_uuid(), user_id, now(), now())
  returning id;
$$;

create or replace function pg_temp.act_as(user_id uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', user_id, 'role', 'authenticated', 'aal', aal,
             'session_id', pg_temp.create_test_session(user_id))::text,
           true);
$$;

create or replace function pg_temp.act_as_patient(user_id uuid) returns void language sql as $$
  select pg_temp.act_as(user_id, 'aal1');
$$;

create or replace function pg_temp.at_madrid(days_from_today int, wall time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date + days_from_today)::timestamp + wall) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.yy() returns text language sql stable as $$
  select to_char(now() at time zone 'Europe/Madrid', 'YY')
$$;

create or replace function pg_temp.this_year() returns int language sql stable as $$
  select extract(year from now() at time zone 'Europe/Madrid')::int
$$;

create or replace function pg_temp.invoice_of(p_appointment_id uuid) returns public.invoices language sql stable as $$
  select i.* from public.invoices i join public.payments p on p.id = i.payment_id
  where p.appointment_id = p_appointment_id and p.voided_at is null
$$;

create or replace function pg_temp.record_of(p_appointment_id uuid) returns public.invoice_records language sql stable as $$
  select r.* from public.invoice_records r where r.invoice_id = (pg_temp.invoice_of(p_appointment_id)).id
$$;

create or replace function pg_temp.madrid_iso(p_at timestamptz) returns text language sql stable as $$
  select to_char(p_at at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS')
    || case when (p_at at time zone 'Europe/Madrid') - (p_at at time zone 'UTC') = interval '2 hours'
         then '+02:00' else '+01:00' end
$$;

select is(public.format_invoice_code('{n}/{aa}', 2026, 34), '34/26',
  'the clinic numbers invoices as number/year today, so the first platform invoice continues the spreadsheet');
select is(public.format_invoice_code('R{n}/{aa}', 2026, 1), 'R1/26',
  'rectifying invoices carry an R so they are never confused with the main series');
select is(public.format_invoice_code('F{año}-{n:4}', 2026, 7), 'F2026-0007',
  'a format can use the full year and a zero-padded number');
select is(public.format_invoice_code('F{año}-{n:4}', 2026, 12345), 'F2026-12345',
  'a number longer than its padding is never cut, so two invoices can never share a code');
select throws_ok($$ select public.format_invoice_code('F{año}', 2026, 1) $$, 'P0001', 'invoice_format_invalid',
  'a format without the number would give every invoice of the year the same code');

select results_eq(
  $$ select code::text, format from public.invoice_series where year = pg_temp.this_year() order by code $$,
  $$ values ('main', '{n}/{aa}'), ('rectifying', 'R{n}/{aa}') $$,
  'the series start with the clinic''s number/year format and an independent R series for rectifications');
select throws_ok($$ update public.invoice_series set format = 'Factura {aa}' where code = 'main' and year = pg_temp.this_year() $$,
  'P0001', 'invoice_format_invalid',
  'a series can never be saved with a format that has no number in it');

select is(public.invoice_hash('IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00'),
  '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
  'the hash matches the first worked example of the AEAT specification, so the tax agency will accept our chain');
select is(
  public.invoice_alta_canonical('89890001K', '12345679/G34', '2024-01-01', 'F1', 1235, 12345,
    '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60', '2024-01-01 19:20:35+01'),
  'IDEmisorFactura=89890001K&NumSerieFactura=12345679/G34&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00',
  'the text to hash follows the field order and formats of the second AEAT example, chaining the previous hash');
select is(
  public.invoice_hash(public.invoice_alta_canonical('89890001K', '12345679/G34', '2024-01-01', 'F1', 1235, 12345,
    '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60', '2024-01-01 19:20:35+01')),
  'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97',
  'a chained record gives exactly the hash published by the AEAT');
select is(
  public.invoice_alta_canonical('B12345674', '1/26', '2026-09-30', 'F2', 781, 4500, '', '2026-09-30 08:15:00+00'),
  'IDEmisorFactura=B12345674&NumSerieFactura=1/26&FechaExpedicionFactura=30-09-2026&TipoFactura=F2&CuotaTotal=7.81&ImporteTotal=45.00&Huella=&FechaHoraHusoGenRegistro=2026-09-30T10:15:00+02:00',
  'the first record of the clinic has an empty previous hash and its time is written in Madrid summer time');
select is(
  public.invoice_hash('IDEmisorFactura=B12345674&NumSerieFactura=1/26&FechaExpedicionFactura=30-09-2026&TipoFactura=F2&CuotaTotal=7.81&ImporteTotal=45.00&Huella=&FechaHoraHusoGenRegistro=2026-09-30T10:15:00+02:00'),
  '651C9B488F2B98788412FBE73C548EDF71656110594624F3A55FE2815D9A7048',
  'a simplified invoice hashes to the SHA-256 computed by hand outside the database');
select is(
  public.invoice_alta_canonical('B12345674', 'R1/27', '2027-01-15', 'R5', -781, -4500, 'ABC', '2027-01-15 09:00:00+00'),
  'IDEmisorFactura=B12345674&NumSerieFactura=R1/27&FechaExpedicionFactura=15-01-2027&TipoFactura=R5&CuotaTotal=-7.81&ImporteTotal=-45.00&Huella=ABC&FechaHoraHusoGenRegistro=2027-01-15T10:00:00+01:00',
  'negative amounts keep their sign and winter time is written with +01:00');

set local session_replication_role = replica;
delete from public.invoice_records;
delete from public.invoices;
set local session_replication_role = origin;
update public.invoice_series set next_number = 1, locked = false where year = pg_temp.this_year();
delete from public.invoice_series where year > pg_temp.this_year();
update public.clinic_settings set
  legal_name = 'Clínica de Pruebas, S.L.',
  tax_id = 'B12345674',
  address_line = 'Calle Mayor 1',
  postal_code = '46800',
  city = 'Xàtiva',
  province = 'Valencia',
  phone = '600 000 000',
  email = 'hola@pruebas.test',
  website = 'https://pruebas.test',
  vat_exemption_text = 'Operación exenta de IVA.',
  invoice_footer = 'Gracias por confiar en LUMIA.';

insert into auth.users (id, email) values
  ('8b000000-0000-0000-0000-000000000001', 'empleada-facturas@test.local'),
  ('8b000000-0000-0000-0000-000000000002', 'otra-empleada-facturas@test.local'),
  ('8b000000-0000-0000-0000-000000000003', 'propietaria-facturas@test.local'),
  ('8b000000-0000-0000-0000-000000000010', 'paciente-facturas@test.local');
insert into public.specialties (id, name, slug) values
  ('8b000000-0000-0000-0000-0000000000aa', 'Facturas test', 'facturas-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8b000000-0000-0000-0000-000000000001', 'empleada-facturas@test.local', 'Empleada Facturas', 'employee', true, '8b000000-0000-0000-0000-0000000000aa'),
  ('8b000000-0000-0000-0000-000000000002', 'otra-empleada-facturas@test.local', 'Otra Empleada Facturas', 'employee', true, '8b000000-0000-0000-0000-0000000000aa'),
  ('8b000000-0000-0000-0000-000000000003', 'propietaria-facturas@test.local', 'Propietaria Facturas', 'owner', true, null);
insert into public.patient_accounts (id, email) values
  ('8b000000-0000-0000-0000-000000000010', 'paciente-facturas@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat, booking_payment, booking_payment_value) values
  ('8b000000-0000-0000-0000-0000000000b1', '8b000000-0000-0000-0000-0000000000aa', 'Valoración, logopedia y "miofuncional" con un nombre muy largo', 30, 4500, 'standard_21', 'none', 0),
  ('8b000000-0000-0000-0000-0000000000b2', '8b000000-0000-0000-0000-0000000000aa', 'Sesión con señal', 30, 3000, 'exempt', 'fixed', 1000),
  ('8b000000-0000-0000-0000-0000000000b3', '8b000000-0000-0000-0000-0000000000aa', 'Sesión exenta', 30, 3000, 'exempt', 'none', 0);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8b000000-0000-0000-0000-0000000000c1', 'Lucía', 'Martínez López', '1980-01-01', true),
  ('8b000000-0000-0000-0000-0000000000c2', 'Íñigo', 'Ñúñez', '1990-01-01', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8b000000-0000-0000-0000-0000000000d1', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c1',
   '8b000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '09:00'), pg_temp.at_madrid(-1, '09:30')),
  ('8b000000-0000-0000-0000-0000000000d2', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c2',
   '8b000000-0000-0000-0000-0000000000b2', pg_temp.at_madrid(-1, '10:00'), pg_temp.at_madrid(-1, '10:30')),
  ('8b000000-0000-0000-0000-0000000000d3', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c1',
   '8b000000-0000-0000-0000-0000000000b3', pg_temp.at_madrid(-1, '11:00'), pg_temp.at_madrid(-1, '11:30')),
  ('8b000000-0000-0000-0000-0000000000d4', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c1',
   '8b000000-0000-0000-0000-0000000000b2', pg_temp.at_madrid(-1, '12:00'), pg_temp.at_madrid(-1, '12:30')),
  ('8b000000-0000-0000-0000-0000000000d5', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c1',
   '8b000000-0000-0000-0000-0000000000b3', pg_temp.at_madrid(-1, '13:00'), pg_temp.at_madrid(-1, '13:30')),
  ('8b000000-0000-0000-0000-0000000000d6', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c1',
   '8b000000-0000-0000-0000-0000000000b3', pg_temp.at_madrid(-2, '09:00'), pg_temp.at_madrid(-2, '09:30')),
  ('8b000000-0000-0000-0000-0000000000d7', '8b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000c1',
   '8b000000-0000-0000-0000-0000000000b3', pg_temp.at_madrid(-2, '10:00'), pg_temp.at_madrid(-2, '10:30'));

set local role service_role;
select set_config('request.jwt.claims', '', true);
update public.appointments set payment_status = 'paid'
where id in ('8b000000-0000-0000-0000-0000000000d2', '8b000000-0000-0000-0000-0000000000d4');
reset role;

select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select isnt(public.collect_payment('8b000000-0000-0000-0000-0000000000d1', 4500, 'card', ''), null,
  'the employee charges a session with 21% VAT');
reset role;

select results_eq(
  $$ select series::text, number, code, kind::text, status::text, total_cents,
            issued_at = (select collected_at from public.payments where appointment_id = '8b000000-0000-0000-0000-0000000000d1')
     from pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1') $$,
  $$ values ('main', 1, '1/' || pg_temp.yy(), 'simplified', 'issued', 4500, true) $$,
  'charging issues a simplified invoice in the same moment, with the first number of the year, so no payment is ever left without its invoice');
select is(
  (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).snapshot,
  jsonb_build_object(
    'issuer', jsonb_build_object(
      'name', 'Clínica de Pruebas, S.L.', 'tax_id', 'B12345674', 'address_line', 'Calle Mayor 1',
      'postal_code', '46800', 'city', 'Xàtiva', 'province', 'Valencia', 'phone', '600 000 000',
      'email', 'hola@pruebas.test', 'website', 'https://pruebas.test'),
    'recipient', null,
    'lines', jsonb_build_array(jsonb_build_object(
      'description', 'Valoración, logopedia y "miofuncional" con un nombre muy largo',
      'session_date', to_char((now() at time zone 'Europe/Madrid')::date - 1, 'YYYY-MM-DD'),
      'patient', 'Lucía M.',
      'quantity', 1, 'base_cents', 3719, 'vat_rate', 21, 'vat_cents', 781, 'total_cents', 4500)),
    'totals', jsonb_build_object('base_cents', 3719, 'vat_cents', 781, 'total_cents', 4500),
    'vat', 'standard_21',
    'vat_note', '',
    'payments', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_cents', 4500)),
    'footer', 'Gracias por confiar en LUMIA.'),
  'the invoice freezes issuer, concept, patient short name, base and 21% VAT, payment and footer, so later edits never change what was issued');
select results_eq(
  $$ select kind::text, previous_hash, canonical, hash, sent_at, aeat_status
     from pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1') $$,
  $$ select 'alta', '',
       'IDEmisorFactura=B12345674&NumSerieFactura=1/' || pg_temp.yy()
         || '&FechaExpedicionFactura=' || to_char(now() at time zone 'Europe/Madrid', 'DD-MM-YYYY')
         || '&TipoFactura=F2&CuotaTotal=7.81&ImporteTotal=45.00&Huella=&FechaHoraHusoGenRegistro='
         || pg_temp.madrid_iso(r.generated_at),
       upper(encode(sha256(convert_to(
         'IDEmisorFactura=B12345674&NumSerieFactura=1/' || pg_temp.yy()
         || '&FechaExpedicionFactura=' || to_char(now() at time zone 'Europe/Madrid', 'DD-MM-YYYY')
         || '&TipoFactura=F2&CuotaTotal=7.81&ImporteTotal=45.00&Huella=&FechaHoraHusoGenRegistro='
         || pg_temp.madrid_iso(r.generated_at), 'UTF8')), 'hex')),
       null::timestamptz, null::text
     from pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1') r $$,
  'the first Verifactu record starts the chain with an empty previous hash and signs the canonical text of the AEAT');
select results_eq(
  $$ select next_number, locked from public.invoice_series where code = 'main' and year = pg_temp.this_year() $$,
  $$ values (2, true) $$,
  'the first invoice of the year locks the series, so its format and number can no longer be changed under issued invoices');

select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select isnt(public.collect_payment('8b000000-0000-0000-0000-0000000000d2', 2000, 'cash', ''), null,
  'the employee charges the rest of an exempt session whose deposit was paid online');
reset role;

select results_eq(
  $$ select code, total_cents, snapshot->'totals', snapshot->>'vat_note', snapshot->'payments', snapshot->'lines'->0->>'patient'
     from pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d2') $$,
  $$ values ('2/' || pg_temp.yy(), 3000,
       jsonb_build_object('base_cents', 3000, 'vat_cents', 0, 'total_cents', 3000),
       'Operación exenta de IVA.',
       jsonb_build_array(jsonb_build_object('method', 'online', 'amount_cents', 1000),
                         jsonb_build_object('method', 'cash', 'amount_cents', 2000)),
       'Íñigo Ñ.') $$,
  'the next payment gets the next number, and an exempt invoice covers the full service with the deposit, its exemption text and both payments');
select is(
  (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d2')).previous_hash,
  (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1')).hash,
  'the second record chains the hash of the first, so removing or altering an invoice breaks the chain');
select ok(
  (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d2')).canonical like
    '%&TipoFactura=F2&CuotaTotal=0.00&ImporteTotal=30.00&Huella=' || (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1')).hash || '&%',
  'an exempt invoice declares zero VAT and the full amount including the deposit');

select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select isnt(public.collect_payment('8b000000-0000-0000-0000-0000000000d3', 0, 'cash', 'Invitación'), null,
  'a free visit is still recorded as a zero payment');
select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select isnt(public.collect_payment('8b000000-0000-0000-0000-0000000000d4', 0, 'cash', 'Solo la señal'), null,
  'a visit settled only by its online deposit is recorded as a zero payment');
reset role;

select is((select count(*) from public.invoices where payment_id =
    (select id from public.payments where appointment_id = '8b000000-0000-0000-0000-0000000000d3')), 0::bigint,
  'a zero payment without a deposit issues no invoice, since there is nothing to invoice');
select results_eq(
  $$ select code, total_cents, snapshot->'payments' from pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d4') $$,
  $$ values ('3/' || pg_temp.yy(), 1000, jsonb_build_array(jsonb_build_object('method', 'online', 'amount_cents', 1000))) $$,
  'a zero payment on a visit with a paid deposit still invoices the deposit, and a free visit consumes no number');

update public.clinic_settings set tax_id = '  ';
select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.collect_payment('8b000000-0000-0000-0000-0000000000d5', 3000, 'card', '') $$,
  'P0001', 'clinic_fiscal_data_missing',
  'without the clinic''s tax id no legal invoice can be issued, so staff are told to fill in the clinic details first');
reset role;
select is((select count(*) from public.payments where appointment_id = '8b000000-0000-0000-0000-0000000000d5'), 0::bigint,
  'the failed charge leaves no payment behind, so no payment exists without its invoice');
select is((select next_number from public.invoice_series where code = 'main' and year = pg_temp.this_year()), 4,
  'the failed charge consumes no number, so the series has no gaps');
update public.clinic_settings set tax_id = 'B12345674', legal_name = '';
select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.collect_payment('8b000000-0000-0000-0000-0000000000d5', 3000, 'card', '') $$,
  'P0001', 'clinic_fiscal_data_missing',
  'without the clinic''s legal name no legal invoice can be issued either');
reset role;
update public.clinic_settings set legal_name = 'Clínica de Pruebas, S.L.';

insert into public.invoice_series (code, year, format, next_number) values
  ('main', pg_temp.this_year() + 1, 'F{año}-{n:4}', 40);
insert into public.payments (id, appointment_id, amount_cents, method, vat, collected_at, collected_by) values
  ('8b000000-0000-0000-0000-0000000000e6', '8b000000-0000-0000-0000-0000000000d6', 3000, 'card', 'exempt',
   make_timestamptz(pg_temp.this_year() + 1, 12, 31, 23, 30, 0, 'Europe/Madrid'), '8b000000-0000-0000-0000-000000000001'),
  ('8b000000-0000-0000-0000-0000000000e7', '8b000000-0000-0000-0000-0000000000d7', 3000, 'card', 'exempt',
   make_timestamptz(pg_temp.this_year() + 2, 1, 1, 0, 30, 0, 'Europe/Madrid'), '8b000000-0000-0000-0000-000000000001');
select public.issue_simplified_invoice('8b000000-0000-0000-0000-0000000000e6');
select public.issue_simplified_invoice('8b000000-0000-0000-0000-0000000000e7');

select is((pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d6')).code, 'F' || (pg_temp.this_year() + 1) || '-0040',
  'an invoice on 31 December at 23:30 in Madrid belongs to that year''s series and uses its configured number');
select is((pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d7')).code, 'F' || (pg_temp.this_year() + 2) || '-0001',
  'an invoice on 1 January at 00:30 in Madrid, still 31 December in UTC, starts the new year''s series at 1');
select results_eq(
  $$ select year - pg_temp.this_year(), format, next_number, locked from public.invoice_series
     where code = 'main' and year > pg_temp.this_year() order by year $$,
  $$ values (1, 'F{año}-{n:4}', 41, true), (2, 'F{año}-{n:4}', 2, true) $$,
  'an unconfigured new year gets its own series row with the previous format, and both years stay locked');
select ok(
  (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d7')).canonical like
    '%&FechaExpedicionFactura=01-01-' || (pg_temp.this_year() + 2) || '&%',
  'the issue date declared to the tax agency is the Madrid date, not the UTC one');

select throws_ok(
  $$ update public.invoices set total_cents = 1 where id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id $$,
  'P0001', 'invoice_immutable',
  'an issued invoice amount can never be edited, not even by the database owner; errors are fixed with a rectifying invoice');
select throws_ok(
  $$ update public.invoices set snapshot = '{}' where id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id $$,
  'P0001', 'invoice_immutable',
  'the frozen data of an issued invoice can never be rewritten');
select throws_ok(
  $$ update public.invoices set status = 'replaced', total_cents = 1 where id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id $$,
  'P0001', 'invoice_immutable',
  'changing the status cannot be used to smuggle in another change');
select throws_ok(
  $$ delete from public.invoices where id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id $$,
  'P0001', 'invoice_immutable',
  'an issued invoice can never be deleted, so the numbering never has holes');
select throws_ok($$ truncate public.invoices cascade $$, 'P0001', 'invoice_immutable',
  'the invoices cannot be wiped in bulk either');
select throws_ok(
  $$ update public.invoice_records set hash = 'X' where invoice_id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id $$,
  'P0001', 'invoice_record_immutable',
  'a Verifactu record can never be altered once written');
select throws_ok(
  $$ delete from public.invoice_records where invoice_id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id $$,
  'P0001', 'invoice_record_immutable',
  'a Verifactu record can never be removed from the chain');
select throws_ok($$ truncate public.invoice_records $$, 'P0001', 'invoice_record_immutable',
  'the Verifactu chain cannot be wiped in bulk');
select throws_ok(
  $$ insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
     values ((pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id, 'alta', now(), 'NOEXISTE',
             public.invoice_hash('x&Huella=NOEXISTE&FechaHoraHusoGenRegistro=y'), 'x&Huella=NOEXISTE&FechaHoraHusoGenRegistro=y') $$,
  'P0001', 'invoice_chain_broken',
  'a record that points to a hash that does not exist would break the chain, so it is rejected');
select throws_ok(
  format($$ insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
     values (%L, 'alta', now(), %L, 'FALSO', %L) $$,
     (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id,
     (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d7')).hash,
     'x&Huella=' || (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d7')).hash || '&FechaHoraHusoGenRegistro=y'),
  'P0001', 'invoice_chain_broken',
  'a record whose hash is not the SHA-256 of its canonical text is rejected');
select throws_ok(
  format($$ insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
     values (%L, 'alta', now(), %L, public.invoice_hash(%L), %L) $$,
     (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id,
     (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1')).hash,
     'x&Huella=' || (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1')).hash || '&FechaHoraHusoGenRegistro=y',
     'x&Huella=' || (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d1')).hash || '&FechaHoraHusoGenRegistro=y'),
  '23505', null,
  'two records can never follow the same one, so there is a single chain');
select throws_ok(
  format($$ insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
     values (%L, 'alta', now(), %L, public.invoice_hash('x&Huella=&FechaHoraHusoGenRegistro=y'), 'x&Huella=&FechaHoraHusoGenRegistro=y') $$,
     (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id, (pg_temp.record_of('8b000000-0000-0000-0000-0000000000d7')).hash),
  'P0001', 'invoice_chain_broken',
  'a record must sign the previous hash it claims to follow');
select throws_ok(
  $$ insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
     values ((pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1')).id, 'alta', now(), '',
             public.invoice_hash('x&Huella=&FechaHoraHusoGenRegistro=y'), 'x&Huella=&FechaHoraHusoGenRegistro=y') $$,
  '23505', null,
  'only one record can start the chain');
select throws_ok(
  $$ insert into public.invoices (series, number, code, kind, issued_at, payment_id, snapshot, total_cents)
     values ('main', 1, '1/' || pg_temp.yy(), 'simplified', now(),
             (select id from public.payments where appointment_id = '8b000000-0000-0000-0000-0000000000d3'), '{}', 1) $$,
  '23505', null,
  'two invoices can never share a code');
select throws_ok(
  $$ select public.issue_simplified_invoice((select payment_id from pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d1'))) $$,
  '23505', null,
  'a payment is invoiced only once');

set local role service_role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$ update public.invoices set status = 'replaced' $$, '42501', null,
  'not even the service key can change an invoice status; only the invoice functions can');
select throws_ok($$ delete from public.invoices $$, '42501', null,
  'the service key cannot delete invoices');
select throws_ok($$ insert into public.invoices (series, number, code, kind, issued_at, payment_id, snapshot, total_cents)
     values ('main', 999, 'X', 'simplified', now(), '8b000000-0000-0000-0000-0000000000e6', '{}', 1) $$, '42501', null,
  'the service key cannot invent invoices outside the numbering');
select throws_ok($$ update public.invoice_records set aeat_status = 'x' $$, '42501', null,
  'the service key cannot alter the Verifactu chain');
select throws_ok($$ delete from public.invoice_records $$, '42501', null,
  'the service key cannot delete Verifactu records');
select throws_ok($$ insert into public.invoice_records (invoice_id, kind, generated_at, previous_hash, hash, canonical)
     values ('8b000000-0000-0000-0000-0000000000e6', 'alta', now(), '', 'X', 'X') $$, '42501', null,
  'the service key cannot append records to the chain');
select throws_ok($$ select public.issue_simplified_invoice('8b000000-0000-0000-0000-0000000000e6') $$, '42501', null,
  'the service key cannot issue invoices outside a payment');
reset role;

select lives_ok(
  $$ update public.invoices set status = 'replaced' where id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d6')).id $$,
  'the invoice functions, running as the owner of the tables, can mark an invoice as replaced by a full one');
select throws_ok(
  $$ update public.invoices set status = 'issued' where id = (pg_temp.invoice_of('8b000000-0000-0000-0000-0000000000d6')).id $$,
  'P0001', 'invoice_immutable',
  'a replaced invoice never comes back to life');

select is(has_function_privilege('authenticated', 'public.issue_simplified_invoice(uuid)', 'execute'), false,
  'staff cannot issue a simplified invoice on its own; it is only issued inside a payment');
select is(has_function_privilege('anon', 'public.issue_simplified_invoice(uuid)', 'execute'), false,
  'visitors cannot issue invoices');

select pg_temp.act_as('8b000000-0000-0000-0000-000000000003');
select throws_ok($$ update public.invoices set status = 'replaced' $$, '42501', null,
  'not even the owner can change an invoice status directly');
select throws_ok($$ delete from public.invoices $$, '42501', null,
  'not even the owner can delete invoices');
select throws_ok($$ update public.invoice_series set next_number = 1 $$, '42501', null,
  'the owner configures the series only through its function, which checks the lock');
select is((select count(*) from public.invoices where payment_id in (
    select id from public.payments where appointment_id::text like '8b000000-%')), 5::bigint,
  'the owner sees every invoice of the clinic');
select is((select count(*) from public.invoice_series where year = pg_temp.this_year()), 2::bigint,
  'active staff can read the series to preview the next number');
select throws_ok($$ select count(*) from public.invoice_records $$, '42501', null,
  'the Verifactu records are not read directly, only through the invoice functions');
reset role;

select pg_temp.act_as('8b000000-0000-0000-0000-000000000001');
select is((select count(*) from public.invoices where payment_id in (
    select id from public.payments where appointment_id::text like '8b000000-%')), 5::bigint,
  'the professional sees the invoices of her own appointments');
reset role;

select pg_temp.act_as('8b000000-0000-0000-0000-000000000002');
select is((select count(*) from public.invoices where payment_id in (
    select id from public.payments where appointment_id::text like '8b000000-%')), 0::bigint,
  'another professional cannot see the invoices of a colleague''s patients');
reset role;

select pg_temp.act_as('8b000000-0000-0000-0000-000000000001', 'aal1');
select is((select count(*) from public.invoices), 0::bigint,
  'a staff session without the second factor sees no invoices');
select is((select count(*) from public.invoice_series), 0::bigint,
  'a staff session without the second factor sees no series');
reset role;

select pg_temp.act_as_patient('8b000000-0000-0000-0000-000000000010');
select is((select count(*) from public.invoices), 0::bigint,
  'a patient cannot read the clinic''s invoices');
select is((select count(*) from public.invoice_series), 0::bigint,
  'a patient cannot read the clinic''s series');
select throws_ok($$ select count(*) from public.invoice_records $$, '42501', null,
  'a patient cannot read the Verifactu records');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select count(*) from public.invoices $$, '42501', null,
  'an anonymous visitor cannot read invoices');
select throws_ok($$ select count(*) from public.invoice_series $$, '42501', null,
  'an anonymous visitor cannot read the series');
select throws_ok($$ select count(*) from public.invoice_records $$, '42501', null,
  'an anonymous visitor cannot read the Verifactu records');
select throws_ok($$ select public.format_invoice_code('{n}', 2026, 1) $$, '42501', null,
  'an anonymous visitor has no use for the numbering');
reset role;

select * from finish();
rollback;
