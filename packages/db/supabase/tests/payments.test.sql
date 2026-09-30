begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

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

insert into auth.users (id, email) values
  ('8a000000-0000-0000-0000-000000000001', 'empleada-cobros@test.local'),
  ('8a000000-0000-0000-0000-000000000002', 'otra-empleada-cobros@test.local'),
  ('8a000000-0000-0000-0000-000000000003', 'propietaria-cobros@test.local'),
  ('8a000000-0000-0000-0000-000000000010', 'paciente-cobros@test.local');
insert into public.specialties (id, name, slug) values
  ('8a000000-0000-0000-0000-0000000000aa', 'Cobros test', 'cobros-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8a000000-0000-0000-0000-000000000001', 'empleada-cobros@test.local', 'Empleada Cobros', 'employee', true, '8a000000-0000-0000-0000-0000000000aa'),
  ('8a000000-0000-0000-0000-000000000002', 'otra-empleada-cobros@test.local', 'Otra Empleada Cobros', 'employee', true, '8a000000-0000-0000-0000-0000000000aa'),
  ('8a000000-0000-0000-0000-000000000003', 'propietaria-cobros@test.local', 'Propietaria Cobros', 'owner', true, null);
insert into public.patient_accounts (id, email) values
  ('8a000000-0000-0000-0000-000000000010', 'paciente-cobros@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat, booking_payment, booking_payment_value) values
  ('8a000000-0000-0000-0000-0000000000b1', '8a000000-0000-0000-0000-0000000000aa', 'Cobros con IVA', 30, 4500, 'standard_21', 'none', 0),
  ('8a000000-0000-0000-0000-0000000000b2', '8a000000-0000-0000-0000-0000000000aa', 'Cobros con señal', 30, 3000, 'exempt', 'fixed', 1000),
  ('8a000000-0000-0000-0000-0000000000b3', '8a000000-0000-0000-0000-0000000000aa', 'Cobros gratis', 30, 0, 'exempt', 'none', 0);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8a000000-0000-0000-0000-0000000000c1', 'Paula', 'Cobros', '1980-01-01', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8a000000-0000-0000-0000-0000000000d1', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '09:00'), pg_temp.at_madrid(-1, '09:30')),
  ('8a000000-0000-0000-0000-0000000000d2', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(2, '09:00'), pg_temp.at_madrid(2, '09:30')),
  ('8a000000-0000-0000-0000-0000000000d3', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '10:00'), pg_temp.at_madrid(-1, '10:30')),
  ('8a000000-0000-0000-0000-0000000000d4', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '11:00'), pg_temp.at_madrid(-1, '11:30')),
  ('8a000000-0000-0000-0000-0000000000d5', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '12:00'), pg_temp.at_madrid(-1, '12:30')),
  ('8a000000-0000-0000-0000-0000000000d6', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '13:00'), pg_temp.at_madrid(-1, '13:30')),
  ('8a000000-0000-0000-0000-0000000000d7', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b2', pg_temp.at_madrid(-1, '14:00'), pg_temp.at_madrid(-1, '14:30')),
  ('8a000000-0000-0000-0000-0000000000d8', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b3', pg_temp.at_madrid(-1, '15:00'), pg_temp.at_madrid(-1, '15:30')),
  ('8a000000-0000-0000-0000-0000000000d9', '8a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '16:00'), pg_temp.at_madrid(-1, '16:30'));
update public.appointments set status = 'cancelled', cancelled_by = 'clinic'
where id = '8a000000-0000-0000-0000-0000000000d6';

set local role service_role;
select set_config('request.jwt.claims', '', true);
update public.appointments set payment_status = 'paid' where id = '8a000000-0000-0000-0000-0000000000d7';
reset role;

select enum_has_labels('public', 'payment_method', array['cash', 'card', 'bizum', 'transfer'],
  'a payment is taken in cash, by card, by Bizum or by bank transfer, the four ways the clinic accepts money');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');

select is(public.suggested_amount('8a000000-0000-0000-0000-0000000000d1'), 4500,
  'with no deposit paid the reception proposes the full price of the appointment');
select is(public.suggested_amount('8a000000-0000-0000-0000-0000000000d7'), 2000,
  'a deposit already paid online is subtracted, so the patient is never charged twice for it');
select throws_ok($$ select public.suggested_amount('8a000000-0000-0000-0000-0000000000ff') $$, 'P0001', 'appointment_not_found',
  'an unknown appointment has no amount to propose');

select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d1', 4500, 'card', ''), null,
  'charging a past appointment exactly what is proposed needs no explanation');
select results_eq(
  $$ select amount_cents, method::text, vat::text, note, collected_by from public.payments
     where appointment_id = '8a000000-0000-0000-0000-0000000000d1' $$,
  $$ values (4500, 'card', 'standard_21', '', '8a000000-0000-0000-0000-000000000001'::uuid) $$,
  'the payment keeps the VAT treatment of the appointment and who took the money, for the accounts');

select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d2', 4500, 'cash', '') $$,
  'P0001', 'appointment_not_started',
  'an appointment that has not started yet cannot be charged, so nobody is charged for a visit that may not happen');

select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d3', 4000, 'cash', E' \n\t ') $$,
  'P0001', 'note_required',
  'charging a different amount than proposed must be explained, and blank lines or tabs are no explanation, so discounts are never silent');
select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d3', 4000, 'cash', '  Descuento de familia  '), null,
  'with a reason, a different amount is accepted');
select is((select note from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d3'), 'Descuento de familia',
  'the reason is stored without the spaces around it');

select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d4', 0, 'cash', 'Invitación'), null,
  'a visit given for free with a reason is recorded as a zero payment, so it still counts as settled');

select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d8', 0, 'cash', ''), null,
  'a free service charged at its proposed zero needs no reason, since nothing was discounted');

select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d5', -1, 'cash', 'Error') $$,
  'P0001', 'invalid_amount',
  'a negative amount is never a payment');
select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d5', 4500, null, '') $$,
  'P0001', 'invalid_method',
  'a payment without a method cannot be reconciled with the card terminal, Bizum or the cash drawer');
select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000ff', 4500, 'cash', '') $$,
  'P0001', 'appointment_not_found',
  'an unknown appointment cannot be charged');

select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d6', 4500, 'cash', '') $$,
  'P0001', 'appointment_cancelled_needs_note',
  'charging a cancelled appointment is unusual, such as a late cancellation fee, so it must be explained');
select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d6', 2000, 'card', 'Cancelación tardía'), null,
  'with a reason, a cancelled appointment can be charged');

select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d1', 4500, 'cash', '') $$,
  'P0001', 'already_paid',
  'an appointment is charged only once, so two receptionists cannot take the money twice');

select lives_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d1'), 'Método equivocado') $$,
  'the employee who took a payment can void it the same day to fix a mistake');
select results_eq(
  $$ select voided_by, void_reason from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('8a000000-0000-0000-0000-000000000001'::uuid, 'Método equivocado') $$,
  'the voided payment keeps who voided it and why, instead of disappearing');
select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d1', 4500, 'cash', ''), null,
  'once the wrong payment is voided the appointment can be charged again correctly');
select is((select count(*) from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d1'), 2::bigint,
  'both the voided and the new payment remain, so the history of the till is complete');

select throws_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d3'), E' \n\t ') $$,
  'P0001', 'reason_required',
  'voiding money already taken must always be explained, and blank lines or tabs are no explanation');
select lives_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d3'), 'Cobrado por error') $$,
  'a payment can be voided with a reason');
select throws_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d3'), 'Otra vez') $$,
  'P0001', 'already_voided',
  'a payment is voided only once, so its first reason is never overwritten');
select throws_ok($$ select public.void_payment('8a000000-0000-0000-0000-0000000000ff', 'Motivo') $$,
  'P0001', 'payment_not_found',
  'an unknown payment cannot be voided');

select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d5', 4500, 'bizum', ''), null,
  'the employee charges another appointment');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '', true);
update public.payments set collected_at = pg_temp.at_madrid(-1, '12:00')
where appointment_id = '8a000000-0000-0000-0000-0000000000d5';
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d5'), 'Me equivoqué') $$,
  'P0001', 'not_allowed',
  'an employee cannot void her own payment from a previous day, once that day''s till is closed');
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d4'), 'No me cuadra') $$,
  'P0001', 'not_allowed',
  'an employee cannot void a payment another employee took');
reset role;

insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8a000000-0000-0000-0000-0000000000c2', 'Marta', 'ListaCobros', '1985-03-03', true);
insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8a000000-0000-0000-0000-0000000000e1', '8a000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-0000000000c2',
   '8a000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '09:00'), pg_temp.at_madrid(-1, '09:30'));

select pg_temp.act_as('8a000000-0000-0000-0000-000000000002');
select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000e1', 4500, 'transfer', ''), null,
  'otra empleada charges her own appointment, for the list_payments scenario below');
reset role;

set local role service_role;
select set_config('request.jwt.claims', '', true);
update public.payments set collected_at = pg_temp.at_madrid(0, '10:00')
where appointment_id = '8a000000-0000-0000-0000-0000000000e1';
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select patient_name, service_name, professional_id, amount_cents, method::text, voided_at
     from public.list_payments(pg_temp.at_madrid(0, '00:00'), pg_temp.at_madrid(1, '00:00'))
     where id = (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000e1') $$,
  $$ values ('Marta ListaCobros', 'Cobros con IVA', '8a000000-0000-0000-0000-000000000002'::uuid, 4500, 'transfer', null::timestamptz) $$,
  'an employee reconciling the till sees a colleague''s payment in full, with the patient and service, not just her own appointments');
select is(
  (select count(*) from public.list_payments(pg_temp.at_madrid(-2, '00:00'), pg_temp.at_madrid(-1, '00:00'))
   where id = (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000e1')),
  0::bigint,
  'a range that does not cover the collection day leaves the payment out');
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000e1'), 'Pagó en efectivo') $$,
  'otra empleada voids her own payment the same day, for the list_payments scenario below');
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select voided_at is not null, void_reason
     from public.list_payments(pg_temp.at_madrid(0, '00:00'), pg_temp.at_madrid(1, '00:00'))
     where id = (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000e1') $$,
  $$ values (true, 'Pagó en efectivo') $$,
  'a voided payment still appears in the list, with who and why, so the till shows it was cancelled rather than hiding it');
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001', 'aal1');
select throws_ok($$ select * from public.list_payments(pg_temp.at_madrid(0, '00:00'), pg_temp.at_madrid(1, '00:00')) $$,
  '42501', null,
  'a staff session without the second factor cannot list the day''s payments');
reset role;

select pg_temp.act_as_patient('8a000000-0000-0000-0000-000000000010');
select throws_ok($$ select * from public.list_payments(pg_temp.at_madrid(0, '00:00'), pg_temp.at_madrid(1, '00:00')) $$,
  '42501', null,
  'a patient cannot list the clinic''s payments');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.list_payments(pg_temp.at_madrid(0, '00:00'), pg_temp.at_madrid(1, '00:00')) $$,
  '42501', null,
  'an anonymous visitor cannot list the clinic''s payments');
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d4'), 'Revisión de caja') $$,
  'the owner can void a payment taken by anyone');
select lives_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d5'), 'Revisión de caja') $$,
  'the owner can void a payment from a previous day');
select isnt(public.collect_payment('8a000000-0000-0000-0000-0000000000d9', 4500, 'card', ''), null,
  'the owner can also take payments at the desk');
select lives_ok($$ select public.void_payment(
    (select id from public.payments where appointment_id = '8a000000-0000-0000-0000-0000000000d9'), 'Tarjeta rechazada') $$,
  'the owner can void her own payment');
select throws_ok($$ insert into public.payments (appointment_id, amount_cents, method, vat, collected_by)
    values ('8a000000-0000-0000-0000-0000000000d2', 1, 'cash', 'exempt', '8a000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'not even the owner writes payments directly, so every payment goes through the rules of collect_payment');
select throws_ok($$ update public.payments set amount_cents = 1 $$, '42501', null,
  'a payment amount cannot be edited after the fact, only voided');
select throws_ok($$ delete from public.payments $$, '42501', null,
  'a payment cannot be deleted, so the till history cannot be erased');
reset role;

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001', 'aal1');
select is((select count(*) from public.payments), 0::bigint,
  'a staff session without the second factor sees no payments');
select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d2', 1, 'cash', 'x') $$, '42501', null,
  'a staff session without the second factor cannot charge');
select throws_ok($$ select public.void_payment(
    '8a000000-0000-0000-0000-0000000000ff', 'x') $$, '42501', null,
  'a staff session without the second factor cannot void');
select throws_ok($$ select public.suggested_amount('8a000000-0000-0000-0000-0000000000d1') $$, '42501', null,
  'a staff session without the second factor cannot see what an appointment costs');
reset role;

select pg_temp.act_as_patient('8a000000-0000-0000-0000-000000000010');
select is((select count(*) from public.payments), 0::bigint,
  'a patient sees no payments of the clinic');
select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d2', 1, 'cash', 'x') $$, '42501', null,
  'a patient cannot record a payment');
select throws_ok($$ select public.void_payment('8a000000-0000-0000-0000-0000000000ff', 'x') $$, '42501', null,
  'a patient cannot void a payment');
select throws_ok($$ select public.suggested_amount('8a000000-0000-0000-0000-0000000000d1') $$, '42501', null,
  'a patient cannot look up what the clinic proposes to charge for an appointment');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select count(*) from public.payments $$, '42501', null,
  'an anonymous visitor cannot read payments');
select throws_ok($$ select public.collect_payment('8a000000-0000-0000-0000-0000000000d2', 1, 'cash', 'x') $$, '42501', null,
  'an anonymous visitor cannot record a payment');
select throws_ok($$ select public.void_payment('8a000000-0000-0000-0000-0000000000ff', 'x') $$, '42501', null,
  'an anonymous visitor cannot void a payment');
select throws_ok($$ select public.suggested_amount('8a000000-0000-0000-0000-0000000000d1') $$, '42501', null,
  'an anonymous visitor cannot see what an appointment costs');
reset role;

select throws_ok($$ delete from public.appointments where id = '8a000000-0000-0000-0000-0000000000d1' $$, '23503', null,
  'an appointment with payments cannot be deleted, so money taken never loses its appointment');

select * from finish();
rollback;
