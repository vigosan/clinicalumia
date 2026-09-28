begin;
create extension if not exists pgtap with schema extensions;
select plan(81);

insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000001', 'owner-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000002', 'a-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000010', 'paciente-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000011', 'otra-paciente-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000012', 'borrada-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000013', 'sin-cuenta-web-booking@test.local');
insert into public.specialties (id, name, slug) values
  ('80000000-0000-0000-0000-0000000000aa', 'Reservas web test', 'reservas-web-test'),
  ('80000000-0000-0000-0000-0000000000bb', 'Otra reservas web test', 'otra-reservas-web-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('80000000-0000-0000-0000-000000000001', 'owner-web-booking@test.local', 'Owner', 'owner', true, null),
  ('80000000-0000-0000-0000-000000000002', 'a-web-booking@test.local', 'Empleada A', 'employee', true, '80000000-0000-0000-0000-0000000000aa');
insert into public.patient_accounts (id, email) values
  ('80000000-0000-0000-0000-000000000010', 'paciente-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000011', 'otra-paciente-web-booking@test.local'),
  ('80000000-0000-0000-0000-000000000012', 'borrada-web-booking@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, booking_payment, booking_payment_value) values
  ('80000000-0000-0000-0000-0000000000b1', '80000000-0000-0000-0000-0000000000aa', 'Con señal fija', 45, 4000, 'fixed', 1000),
  ('80000000-0000-0000-0000-0000000000b2', '80000000-0000-0000-0000-0000000000aa', 'Sin pago', 45, 4000, 'none', 0),
  ('80000000-0000-0000-0000-0000000000b3', '80000000-0000-0000-0000-0000000000aa', 'Con porcentaje', 45, 3333, 'percent', 25),
  ('80000000-0000-0000-0000-0000000000b4', '80000000-0000-0000-0000-0000000000aa', 'Pago completo', 45, 5000, 'full', 0),
  ('80000000-0000-0000-0000-0000000000b5', '80000000-0000-0000-0000-0000000000aa', 'Gratis con porcentaje', 45, 0, 'percent', 50),
  ('80000000-0000-0000-0000-0000000000b6', '80000000-0000-0000-0000-0000000000aa', 'Gratis completo', 45, 0, 'full', 0);
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, is_active) values
  ('80000000-0000-0000-0000-0000000000b7', '80000000-0000-0000-0000-0000000000aa', 'Retirado', 45, 4000, false),
  ('80000000-0000-0000-0000-0000000000b8', '80000000-0000-0000-0000-0000000000bb', 'De otra especialidad', 45, 4000, true);
insert into public.people (id, first_name, last_name, birth_date, email, is_patient, archived_at) values
  ('80000000-0000-0000-0000-0000000000c1', 'Paciente', 'Web', '1990-01-01', 'paciente-web-booking@test.local', true, null),
  ('80000000-0000-0000-0000-0000000000c2', 'Paciente', 'Archivada', '1990-01-01', 'paciente-web-booking@test.local', true, now());

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

select has_column('public', 'appointments', 'origin', 'appointments record whether the clinic or the patient booked them');
select col_type_is('public', 'appointments', 'origin', 'appointment_origin', 'origin is a closed enum');
select col_default_is('public', 'appointments', 'origin', 'staff'::public.appointment_origin,
  'origin defaults to staff so every existing and dashboard booking keeps its meaning');
select enum_has_labels('public', 'appointment_origin', array['staff', 'web'], 'an appointment comes from the team or the web');
select col_type_is('public', 'appointments', 'booked_by_account', 'uuid', 'the booking account is an auth user id');
select fk_ok('public', 'appointments', 'booked_by_account', 'auth', 'users', 'id',
  'booked_by_account points at auth.users, because patients have no team profile');
select col_type_is('public', 'appointments', 'payment_required', 'booking_payment',
  'the payment rule reuses the services enum so both always agree');
select col_type_is('public', 'appointments', 'payment_amount_cents', 'integer', 'the amount to charge is stored in cents');
select col_type_is('public', 'appointments', 'payment_status', 'payment_status', 'payment_status is a closed enum');
select col_default_is('public', 'appointments', 'payment_status', 'not_required'::public.payment_status,
  'payment_status defaults to not_required, which is what every appointment before online payments means');
select enum_has_labels('public', 'payment_status', array['not_required', 'pending', 'paid', 'refunded'],
  'payment states cover the whole lifecycle piece 4 will need');
select col_type_is('public', 'appointment_events', 'actor_kind', 'actor_kind', 'events record what kind of actor acted');
select col_default_is('public', 'appointment_events', 'actor_kind', 'staff'::public.actor_kind,
  'actor_kind defaults to staff, which is true for every event before web bookings');
select enum_has_labels('public', 'actor_kind', array['staff', 'patient'], 'an actor is the team or a patient');
select col_default_is('public', 'clinic_settings', 'booking_min_notice_hours', 24,
  'patients book at least 24 hours ahead by default');
select col_default_is('public', 'clinic_settings', 'booking_horizon_days', 60,
  'patients book at most 60 days ahead by default');
select col_default_is('public', 'clinic_settings', 'online_payments_enabled', false,
  'online payments start disabled until piece 4 brings a payment gateway');
select is((select booking_min_notice_hours from public.clinic_settings), 24,
  'the existing settings row picks up the default notice');
select is((select online_payments_enabled from public.clinic_settings), false,
  'the existing settings row keeps online payments off');

select is((select relrowsecurity from pg_class where oid = 'public.patient_accounts'::regclass), true,
  'patient_accounts has RLS on, so a forgotten grant still exposes nothing');
select is((select relrowsecurity from pg_class where oid = 'public.access_requests'::regclass), true,
  'access_requests has RLS on');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('patient_accounts', 'access_requests')),
  0::bigint, 'neither table has policies: only our functions and the server may touch them');
select has_index('public', 'access_requests', 'access_requests_email_idx', array['email', 'created_at'],
  'requests per email and hour are counted with an index');
select has_index('public', 'access_requests', 'access_requests_ip_hash_idx', array['ip_hash', 'created_at'],
  'requests per network and hour are counted with an index');
select throws_ok($$ insert into public.patient_accounts (id, email) values ('80000000-0000-0000-0000-000000000001', 'Mayus@Test.local') $$,
  '23514', null, 'account emails are stored lowercased so the same person cannot end up with two accounts');

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at,
    origin, booked_by_account, payment_required, payment_amount_cents, payment_status)
  values ('80000000-0000-0000-0000-0000000000d1', '80000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b1',
    '2099-06-01 10:00 Europe/Madrid', '2099-06-01 10:45 Europe/Madrid',
    'web', '80000000-0000-0000-0000-000000000010', 'none', 0, 'paid')
$$, 'an employee books from the dashboard, even while spoofing web origin and payment fields');
select is((select origin::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d1'), 'staff',
  'a dashboard booking is always staff, so the team cannot pass its bookings off as patient ones');
select is((select booked_by_account from public.appointments where id = '80000000-0000-0000-0000-0000000000d1'), null,
  'a dashboard booking has no patient account, whatever the client sent');
select is((select payment_required::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d1'), 'fixed',
  'the payment rule is copied from the service, so the clinic charges what was configured');
select is((select payment_amount_cents from public.appointments where id = '80000000-0000-0000-0000-0000000000d1'), 1000,
  'a fixed deposit charges exactly the configured value');
select is((select payment_status::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d1'), 'pending',
  'a booking that requires payment starts pending, never paid on the client''s word');

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at,
    payment_required, payment_amount_cents, payment_status)
  values ('80000000-0000-0000-0000-0000000000d2', '80000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b2',
    '2099-06-01 11:00 Europe/Madrid', '2099-06-01 11:45 Europe/Madrid', 'full', 9999, 'pending')
$$, 'an employee books a service without payment');
select is((select payment_amount_cents from public.appointments where id = '80000000-0000-0000-0000-0000000000d2'), 0,
  'a service without payment charges nothing, whatever the client sent');
select is((select payment_status::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d2'), 'not_required',
  'a service without payment is not_required, so nobody chases a payment that does not exist');

select throws_ok($$ update public.appointments set payment_amount_cents = 1 where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', 'appointment_immutable_fields', 'the amount to charge cannot be lowered after booking');
select throws_ok($$ update public.appointments set payment_required = 'none' where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', 'appointment_immutable_fields', 'the payment rule cannot be removed after booking');
select throws_ok($$ update public.appointments set origin = 'web' where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', 'appointment_immutable_fields', 'the origin cannot be rewritten after booking');
select throws_ok($$ update public.appointments set booked_by_account = '80000000-0000-0000-0000-000000000010' where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', 'appointment_immutable_fields', 'an appointment cannot be handed to a patient account after booking');
select throws_ok($$ update public.appointments set payment_status = 'paid' where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', 'payment_status_locked', 'staff cannot mark a deposit as paid: until piece 4 only the server may record payments');

reset role;
select set_config('request.jwt.claims', '', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('80000000-0000-0000-0000-0000000000d3', '80000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b3',
   '2099-06-02 10:00 Europe/Madrid', '2099-06-02 10:45 Europe/Madrid'),
  ('80000000-0000-0000-0000-0000000000d4', '80000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b4',
   '2099-06-02 11:00 Europe/Madrid', '2099-06-02 11:45 Europe/Madrid'),
  ('80000000-0000-0000-0000-0000000000d5', '80000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b5',
   '2099-06-02 12:00 Europe/Madrid', '2099-06-02 12:45 Europe/Madrid'),
  ('80000000-0000-0000-0000-0000000000d7', '80000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b6',
   '2099-06-02 13:00 Europe/Madrid', '2099-06-02 13:45 Europe/Madrid');
select is((select payment_amount_cents from public.appointments where id = '80000000-0000-0000-0000-0000000000d3'), 833,
  'a percent deposit is rounded to whole cents: 25% of 33.33 is 8.33');
select is((select payment_amount_cents from public.appointments where id = '80000000-0000-0000-0000-0000000000d4'), 5000,
  'a full payment charges the whole price');
select is((select payment_amount_cents from public.appointments where id = '80000000-0000-0000-0000-0000000000d5'), 0,
  'a percent of a free service is zero');
select is((select payment_status::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d5'), 'not_required',
  'a zero percent deposit is not_required, so nobody chases a payment of nothing');
select is((select payment_status::text || ':' || payment_amount_cents from public.appointments where id = '80000000-0000-0000-0000-0000000000d7'),
  'not_required:0', 'a full payment of a free service is not_required too');
select lives_ok($$ update public.appointments set payment_status = 'paid' where id = '80000000-0000-0000-0000-0000000000d1' $$,
  'the server, with no user session, can record a payment');
select is((select payment_status::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d1'), 'paid',
  'the payment recorded by the server is kept');
select throws_ok($$ update public.appointments set payment_status = 'pending' where id = '80000000-0000-0000-0000-0000000000d2' $$,
  '23514', null, 'an appointment without anything to charge can never be pending, not even by the server');
select throws_ok($$ update public.appointments set payment_status = 'not_required' where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', null, 'an appointment with an amount to charge can never become not_required');
select is((select origin::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d3'), 'staff',
  'a server-side insert without a patient session is a staff booking');

select pg_temp.act_as_patient('80000000-0000-0000-0000-000000000010');

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-03 10:00 Europe/Madrid', '2099-06-03 10:45 Europe/Madrid')
$$, '42501', 'appointment_forbidden', 'a patient cannot insert appointments directly, only through the booking function');

select set_config('lumia.booking_account', '80000000-0000-0000-0000-000000000011', true);
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-03 10:00 Europe/Madrid', '2099-06-03 10:45 Europe/Madrid')
$$, '42501', 'appointment_forbidden', 'a marker naming another account does not open the patient path');

select set_config('lumia.booking_account', '80000000-0000-0000-0000-000000000010', true);
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-03 10:00 Europe/Madrid', '2099-06-03 10:45 Europe/Madrid')
$$, '42501', 'new row violates row-level security policy for table "appointments"', 'even with the right marker, the patient role itself cannot insert: RLS keeps the booking function as the only door');

reset role;

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at,
    origin, created_by, booked_by_account)
  values ('80000000-0000-0000-0000-0000000000d6', '80000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b2',
    '2099-06-03 10:00 Europe/Madrid', '2099-06-03 10:45 Europe/Madrid',
    'staff', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000011')
$$, 'with the marker matching the session, an insert running as the function owner is a patient booking');
select is((select origin::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d6'), 'web',
  'a patient booking is marked web, whatever origin was sent');
select is((select created_by from public.appointments where id = '80000000-0000-0000-0000-0000000000d6'), null,
  'a patient booking has no team author, since created_by points at team profiles');
select is((select booked_by_account::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d6'),
  '80000000-0000-0000-0000-000000000010', 'the booking account is the session''s account, not the one sent');
select is((select payment_status::text from public.appointments where id = '80000000-0000-0000-0000-0000000000d6'), 'not_required',
  'the payment snapshot is taken for web bookings too');
select is((select actor_kind::text from public.appointment_events
  where appointment_id = '80000000-0000-0000-0000-0000000000d6' and kind = 'created'), 'patient',
  'the history shows the patient booked it');
select is((select actor_id from public.appointment_events
  where appointment_id = '80000000-0000-0000-0000-0000000000d6' and kind = 'created'), null,
  'the patient is not a team profile, so the event has no team actor');

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b7', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 10:45 Europe/Madrid')
$$, '23514', 'service_inactive', 'a patient cannot book a retired service');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b8', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 10:45 Europe/Madrid')
$$, '23514', 'service_not_for_professional', 'a patient cannot book a service with a professional of another specialty');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-05 23:30 Europe/Madrid', '2099-06-06 00:15 Europe/Madrid')
$$, '23514', 'appointment_crosses_midnight', 'a patient booking cannot cross midnight in Madrid');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c2',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 10:45 Europe/Madrid')
$$, '23514', 'patient_not_bookable', 'a patient cannot book for an archived person');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-01 10:15 Europe/Madrid', '2099-06-01 11:00 Europe/Madrid')
$$, '23P01', null, 'a patient booking cannot overlap an existing appointment of the professional');

select pg_temp.act_as_patient('80000000-0000-0000-0000-000000000013');
reset role;
select set_config('lumia.booking_account', '80000000-0000-0000-0000-000000000013', true);
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000c1',
    '80000000-0000-0000-0000-0000000000b2', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 10:45 Europe/Madrid')
$$, '42501', 'appointment_forbidden', 'a matching marker is not enough without a patient account behind the session');

select pg_temp.act_as_patient('80000000-0000-0000-0000-000000000012');
reset role;
select set_config('lumia.booking_account', '80000000-0000-0000-0000-000000000012', true);
insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('80000000-0000-0000-0000-0000000000d8', '80000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000b2',
   '2099-06-04 10:00 Europe/Madrid', '2099-06-04 10:45 Europe/Madrid');
select set_config('request.jwt.claims', '', true);
select lives_ok($$ delete from auth.users where id = '80000000-0000-0000-0000-000000000012' $$,
  'a patient''s auth user can be deleted even when she has web bookings, so account deletion requests can be honoured');
select is((select booked_by_account from public.appointments where id = '80000000-0000-0000-0000-0000000000d8'), null,
  'the booking survives the account deletion, only losing the link to the account');
select is((select count(*) from public.patient_accounts where id = '80000000-0000-0000-0000-000000000012'), 0::bigint,
  'the patient account goes away with its auth user');
select throws_ok($$ update public.appointments set booked_by_account = '80000000-0000-0000-0000-000000000011' where id = '80000000-0000-0000-0000-0000000000d6' $$,
  '23514', 'appointment_immutable_fields', 'a web booking cannot be moved to another account');
select lives_ok($$ update public.appointments set created_by = null where id = '80000000-0000-0000-0000-0000000000d1' $$,
  'the author can become null, which is what deleting a team profile does through its foreign key');

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select lives_ok($$
  update public.appointments set status = 'cancelled', cancelled_by = 'clinic'
  where id = '80000000-0000-0000-0000-0000000000d6'
$$, 'the professional cancels the web booking from the dashboard');
reset role;
select is((select actor_kind::text || ':' || actor_id::text from public.appointment_events
  where appointment_id = '80000000-0000-0000-0000-0000000000d6' and kind = 'cancelled'),
  'staff:80000000-0000-0000-0000-000000000002',
  'a team member acting on a web booking is recorded as staff, even with another account''s marker in the transaction');

select pg_temp.act_as_patient('80000000-0000-0000-0000-000000000010');
select throws_ok($$ select * from public.patient_accounts $$, '42501', null,
  'a patient cannot read the accounts table, not even her own row');
select throws_ok($$ select * from public.access_requests $$, '42501', null,
  'a signed-in user cannot read who asked for access');
select throws_ok($$ insert into public.access_requests (email, ip_hash) values ('x@test.local', 'x') $$, '42501', null,
  'a patient cannot write access requests to dodge or poison the rate limit');
reset role;
set local role anon;
select throws_ok($$ select * from public.access_requests $$, '42501', null,
  'an anonymous visitor cannot read who asked for access');
select throws_ok($$ select * from public.patient_accounts $$, '42501', null,
  'an anonymous visitor cannot read patient accounts');
reset role;

select throws_ok($$ update public.clinic_settings set booking_min_notice_hours = 169 $$, '23514', null,
  'the notice cannot exceed a week');
select throws_ok($$ update public.clinic_settings set booking_min_notice_hours = -1 $$, '23514', null,
  'the notice cannot be negative');
select throws_ok($$ update public.clinic_settings set booking_horizon_days = 0 $$, '23514', null,
  'the horizon must leave at least one day to book');
select throws_ok($$ update public.clinic_settings set booking_horizon_days = 366 $$, '23514', null,
  'the horizon cannot exceed a year');

select * from finish();
rollback;
