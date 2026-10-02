begin;
create extension if not exists pgtap with schema extensions;
select plan(215);

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
select throws_ok($$ update public.appointments set created_by = null where id = '80000000-0000-0000-0000-0000000000d1' $$,
  '23514', 'appointment_immutable_fields', 'staff cannot erase who booked an appointment; only an account deletion clears it');

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
  'without a user session the author can become null, which is what deleting a team profile does through its foreign key');

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

reset role;
select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);

create or replace function pg_temp.today_madrid() returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date
$$;
create or replace function pg_temp.day3() returns date language sql stable as $$
  select pg_temp.today_madrid() + 3
$$;
create or replace function pg_temp.last_sunday(year_val int, month_val int) returns date language plpgsql stable as $$
declare
  last_day date;
begin
  last_day := (make_date(year_val, month_val, 1) + interval '1 month' - interval '1 day')::date;
  return last_day - extract(dow from last_day)::int;
end;
$$;
create or replace function pg_temp.next_spring_forward() returns date language plpgsql stable as $$
declare
  base date := pg_temp.today_madrid() + 2;
  y int := extract(year from base)::int;
  d date;
begin
  d := pg_temp.last_sunday(y, 3);
  if d < base then
    d := pg_temp.last_sunday(y + 1, 3);
  end if;
  return d;
end;
$$;
create or replace function pg_temp.next_dst_day() returns date language plpgsql stable as $$
declare
  base date := pg_temp.today_madrid() + 2;
  y int := extract(year from base)::int;
  candidates date[] := array[
    pg_temp.last_sunday(y, 3), pg_temp.last_sunday(y, 10),
    pg_temp.last_sunday(y + 1, 3), pg_temp.last_sunday(y + 1, 10)
  ];
  d date;
  best date;
begin
  foreach d in array candidates loop
    if d >= base and (best is null or d < best) then
      best := d;
    end if;
  end loop;
  return best;
end;
$$;

insert into auth.users (id, email) values
  ('84000000-0000-0000-0000-000000000001', 'a-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000002', 'b-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000003', 'c-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000004', 'semana-horizonte@test.local'),
  ('84000000-0000-0000-0000-000000000005', 'dst-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000006', 'f-catalogo@test.local'),
  ('84000000-0000-0000-0000-000000000007', 'g-catalogo@test.local'),
  ('84000000-0000-0000-0000-000000000008', 'primavera-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000009', 'k-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000010', 'h-huecos@test.local'),
  ('84000000-0000-0000-0000-000000000011', 'i-huecos@test.local');
insert into public.specialties (id, name, slug) values
  ('84000000-0000-0000-0000-0000000000aa', 'Huecos test', 'huecos-test'),
  ('84000000-0000-0000-0000-0000000000bb', 'Catalogo test', 'catalogo-test'),
  ('84000000-0000-0000-0000-0000000000cc', 'Horizonte test', 'horizonte-test'),
  ('84000000-0000-0000-0000-0000000000dd', 'Dst test', 'dst-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('84000000-0000-0000-0000-000000000001', 'a-huecos@test.local', 'Profesional A', 'employee', true, '84000000-0000-0000-0000-0000000000aa'),
  ('84000000-0000-0000-0000-000000000002', 'b-huecos@test.local', 'Profesional B', 'employee', true, '84000000-0000-0000-0000-0000000000aa'),
  ('84000000-0000-0000-0000-000000000003', 'c-huecos@test.local', 'Profesional C', 'employee', true, '84000000-0000-0000-0000-0000000000aa'),
  ('84000000-0000-0000-0000-000000000004', 'semana-horizonte@test.local', 'Profesional Semana', 'employee', true, '84000000-0000-0000-0000-0000000000cc'),
  ('84000000-0000-0000-0000-000000000005', 'dst-huecos@test.local', 'Profesional Dst', 'employee', true, '84000000-0000-0000-0000-0000000000dd'),
  ('84000000-0000-0000-0000-000000000006', 'f-catalogo@test.local', 'Profesional F', 'employee', true, '84000000-0000-0000-0000-0000000000bb'),
  ('84000000-0000-0000-0000-000000000007', 'g-catalogo@test.local', 'Profesional G', 'employee', false, '84000000-0000-0000-0000-0000000000bb'),
  ('84000000-0000-0000-0000-000000000008', 'primavera-huecos@test.local', 'Profesional Primavera', 'employee', true, '84000000-0000-0000-0000-0000000000dd'),
  ('84000000-0000-0000-0000-000000000009', 'k-huecos@test.local', 'Profesional K', 'employee', true, '84000000-0000-0000-0000-0000000000aa'),
  ('84000000-0000-0000-0000-000000000010', 'h-huecos@test.local', 'Profesional H', 'employee', true, '84000000-0000-0000-0000-0000000000aa'),
  ('84000000-0000-0000-0000-000000000011', 'i-huecos@test.local', 'Profesional I', 'employee', false, '84000000-0000-0000-0000-0000000000aa');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, is_active, booking_payment, booking_payment_value) values
  ('84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-0000000000aa', 'Hueco 45', 45, 4000, true, true, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b4', '84000000-0000-0000-0000-0000000000aa', 'Hueco con senal', 45, 5000, true, true, 'fixed', 1000),
  ('84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-0000000000cc', 'Hueco horizonte', 15, 1000, true, true, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b8', '84000000-0000-0000-0000-0000000000dd', 'Hueco dst', 45, 4000, true, true, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b9', '84000000-0000-0000-0000-0000000000dd', 'Hueco primavera', 15, 1000, true, true, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b2', '84000000-0000-0000-0000-0000000000bb', 'Catalogo inactivo', 30, 3000, true, false, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b3', '84000000-0000-0000-0000-0000000000bb', 'Catalogo no online', 30, 3000, false, true, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b5', '84000000-0000-0000-0000-0000000000bb', 'Catalogo control', 30, 3000, true, true, 'none', 0),
  ('84000000-0000-0000-0000-0000000000b6', '84000000-0000-0000-0000-0000000000bb', 'Catalogo con senal', 30, 3000, true, true, 'full', 0);

insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('84000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day3())::smallint, '15:15', '20:30'),
  ('84000000-0000-0000-0000-000000000002', extract(isodow from pg_temp.day3())::smallint, '09:00', '13:00'),
  ('84000000-0000-0000-0000-000000000003', extract(isodow from pg_temp.day3())::smallint, '15:15', '20:30'),
  ('84000000-0000-0000-0000-000000000009', extract(isodow from pg_temp.day3())::smallint, '15:15:30', '20:30:00'),
  ('84000000-0000-0000-0000-000000000010', extract(isodow from pg_temp.day3())::smallint, '15:15', '20:30'),
  ('84000000-0000-0000-0000-000000000011', extract(isodow from pg_temp.day3())::smallint, '15:15', '20:30'),
  ('84000000-0000-0000-0000-000000000008', extract(isodow from pg_temp.next_spring_forward())::smallint, '01:00', '04:00');
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
  select '84000000-0000-0000-0000-000000000004', weekday, '00:15', '23:45'
  from generate_series(1, 7) as weekday;

insert into public.employee_time_off (profile_id, starts_at, ends_at, reason) values
  ('84000000-0000-0000-0000-000000000003',
   (pg_temp.day3()::timestamp at time zone 'Europe/Madrid'),
   ((pg_temp.day3() + 1)::timestamp at time zone 'Europe/Madrid'),
   'Ausencia de prueba'),
  ('84000000-0000-0000-0000-000000000010',
   (pg_temp.day3()::timestamp + '17:00'::time) at time zone 'Europe/Madrid',
   (pg_temp.day3()::timestamp + '18:00'::time) at time zone 'Europe/Madrid',
   'Ausencia parcial de prueba');

select is((select count(*) from public.booking_catalog() where service_id = '84000000-0000-0000-0000-0000000000b2'),
  0::bigint, 'the catalog never lists a retired service, even one flagged bookable online');
select is((select count(*) from public.booking_catalog() where service_id = '84000000-0000-0000-0000-0000000000b3'),
  0::bigint, 'the catalog never lists a service that is not bookable online');
select is((select phone_only from public.booking_catalog() where service_id = '84000000-0000-0000-0000-0000000000b6'),
  true, 'a service with a deposit is phone_only while online payments stay off');
select is((select phone_only from public.booking_catalog() where service_id = '84000000-0000-0000-0000-0000000000b5'),
  false, 'a service without any payment is never phone_only');
select is((select professionals from public.booking_catalog() where service_id = '84000000-0000-0000-0000-0000000000b5'),
  jsonb_build_array(jsonb_build_object('id', '84000000-0000-0000-0000-000000000006', 'full_name', 'Profesional F')),
  'only the active professional of the specialty is offered, never the deactivated one');
select is(pg_get_function_result('public.booking_catalog()'::regprocedure),
  'TABLE(specialty_id uuid, specialty_name text, service_id uuid, service_name text, duration_minutes integer, price_cents integer, bookable_online boolean, phone_only boolean, professionals jsonb, cancellation_hours integer)',
  'the catalog exposes only service and professional names and the change deadline, never an email, a phone or a note');
select is(has_function_privilege('anon', 'public.booking_catalog()', 'execute'), true,
  'anon can browse the public booking catalog');
select is(has_function_privilege('authenticated', 'public.booking_catalog()', 'execute'), true,
  'a signed-in visitor can browse the public booking catalog too');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())),
  19::bigint, 'a 15:15-20:30 slot with a 45-minute service offers every quarter hour from 15:15 to 19:45');
select is((select min(starts_at) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())),
  (pg_temp.day3()::timestamp + '15:15'::time) at time zone 'Europe/Madrid',
  'the first slot lands exactly at the start of the segment');
select is((select max(starts_at) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())),
  (pg_temp.day3()::timestamp + '19:45'::time) at time zone 'Europe/Madrid',
  'the last slot leaves exactly 45 minutes before the segment closes, so the appointment always fits');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '20:00'::time) at time zone 'Europe/Madrid'),
  0::bigint, 'a slot at 20:00 would end after the segment closes, so it is never offered');

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('84000000-0000-0000-0000-0000000000e1', '84000000-0000-0000-0000-000000000001',
   '80000000-0000-0000-0000-0000000000c1', '84000000-0000-0000-0000-0000000000b1',
   (pg_temp.day3()::timestamp + '16:00'::time) at time zone 'Europe/Madrid',
   (pg_temp.day3()::timestamp + '16:45'::time) at time zone 'Europe/Madrid');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())),
  14::bigint, 'an appointment at 16:00-16:45 removes every slot whose 45 minutes would touch it');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '15:30'::time) at time zone 'Europe/Madrid'),
  0::bigint, '15:30 no longer fits before the appointment');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '16:30'::time) at time zone 'Europe/Madrid'),
  0::bigint, '16:30 still overlaps the last 15 minutes of the appointment');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '16:45'::time) at time zone 'Europe/Madrid'),
  1::bigint, '16:45 is free again right after the appointment ends');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '15:15'::time) at time zone 'Europe/Madrid'),
  1::bigint, '15:15 stays free: it ends exactly when the appointment starts');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000003', pg_temp.day3(), pg_temp.day3())),
  0::bigint, 'a professional absent the whole day offers no slots at all');

select cmp_ok((select count(distinct professional_id) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', null, pg_temp.day3(), pg_temp.day3())),
  '>=', 2::bigint, 'with no professional chosen, slots come back for every professional of the specialty who has any');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', null, pg_temp.day3(), pg_temp.day3())
  where professional_id = '84000000-0000-0000-0000-000000000001'),
  14::bigint, 'professional A''s own slots are included in the unfiltered list');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', null, pg_temp.day3(), pg_temp.day3())
  where professional_id = '84000000-0000-0000-0000-000000000002'),
  14::bigint, 'professional B''s own slots are included in the unfiltered list too');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b4', '84000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())),
  0::bigint, 'a service that needs a deposit offers no online slots while online payments stay off');

select throws_ok($$
  select * from public.available_slots('84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001',
    pg_temp.day3(), pg_temp.day3() + 20)
$$, '22023', null, 'a 20-day window is refused so the calendar cannot be scraped far into the future');

select is((select min(starts_at) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000009', pg_temp.day3(), pg_temp.day3())),
  (pg_temp.day3()::timestamp + '15:30'::time) at time zone 'Europe/Madrid',
  'a segment starting at 15:15:30 offers its first slot at 15:30, since 15:15 is before the segment opens');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000009', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '15:15'::time) at time zone 'Europe/Madrid'),
  0::bigint, '15:15 is never offered when the segment does not open until 15:15:30');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000010', pg_temp.day3(), pg_temp.day3())),
  13::bigint, 'a partial absence only removes the slots that touch it, not the whole day');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000010', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '16:15'::time) at time zone 'Europe/Madrid'),
  1::bigint, '16:15 still fits before the partial absence starts');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000010', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '16:30'::time) at time zone 'Europe/Madrid'),
  0::bigint, '16:30 would end inside the partial absence');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000010', pg_temp.day3(), pg_temp.day3())
  where starts_at = (pg_temp.day3()::timestamp + '18:00'::time) at time zone 'Europe/Madrid'),
  1::bigint, '18:00 is free again right after the partial absence ends');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000006', pg_temp.day3(), pg_temp.day3())),
  0::bigint, 'a professional of another specialty never offers slots for this service');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000011', pg_temp.day3(), pg_temp.day3())),
  0::bigint, 'a deactivated professional never offers slots, even with a matching schedule');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001', null, null)),
  0::bigint, 'a null date range offers no slots instead of erroring');

select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004', pg_temp.today_madrid(), pg_temp.today_madrid())),
  0::bigint, 'the default 24-hour notice always excludes every slot left today, whatever the hour');
update public.clinic_settings set booking_min_notice_hours = 0;
create temporary table notice_grid_tomorrow as
  select * from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid() + 1, pg_temp.today_madrid() + 1);
update public.clinic_settings set booking_min_notice_hours = 24;
select cmp_ok((select count(*) from notice_grid_tomorrow), '>', 0::bigint,
  'with no notice required, tomorrow''s full grid has slots to compare against, whatever the hour');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid() + 1, pg_temp.today_madrid() + 1)),
  (select count(*) from notice_grid_tomorrow where starts_at >= now() + interval '24 hours'),
  'with the default notice, tomorrow keeps exactly the grid slots that are at least 24 hours away, whatever the hour');
select ok(coalesce((select min(starts_at) >= now() + interval '24 hours' from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid() + 1, pg_temp.today_madrid() + 1)), true),
  'no slot offered for tomorrow starts earlier than 24 hours from now');
select is((select booking_min_notice_hours from public.clinic_settings), 24,
  'the notice setting is restored to its default for the rest of the suite');
drop table notice_grid_tomorrow;

select cmp_ok((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid() + 60, pg_temp.today_madrid() + 60)),
  '>', 0::bigint, 'the last day of the 60-day horizon still offers slots');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid() + 61, pg_temp.today_madrid() + 61)),
  0::bigint, 'the day right after the 60-day horizon offers none');

insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('84000000-0000-0000-0000-000000000005', extract(isodow from pg_temp.next_dst_day())::smallint, '15:15', '20:30');
update public.clinic_settings set booking_horizon_days = (pg_temp.next_dst_day() - pg_temp.today_madrid());
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b8', '84000000-0000-0000-0000-000000000005', pg_temp.next_dst_day(), pg_temp.next_dst_day())),
  19::bigint, 'the next DST day still fills the whole 15:15-20:30 segment with a 45-minute service');
select is((select min(starts_at) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b8', '84000000-0000-0000-0000-000000000005', pg_temp.next_dst_day(), pg_temp.next_dst_day())),
  (pg_temp.next_dst_day()::timestamp + '15:15'::time) at time zone 'Europe/Madrid',
  'the first slot on the DST day matches Madrid''s own conversion of 15:15, whether the change was in March or October');
select is((select max(starts_at) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b8', '84000000-0000-0000-0000-000000000005', pg_temp.next_dst_day(), pg_temp.next_dst_day())),
  (pg_temp.next_dst_day()::timestamp + '19:45'::time) at time zone 'Europe/Madrid',
  'the last slot on the DST day matches Madrid''s own conversion of 19:45 too');
select is((select extract(epoch from (
    (min(starts_at) at time zone 'Europe/Madrid') - (min(starts_at) at time zone 'UTC')
  )) / 3600 from public.available_slots(
    '84000000-0000-0000-0000-0000000000b8', '84000000-0000-0000-0000-000000000005', pg_temp.next_dst_day(), pg_temp.next_dst_day())),
  (case when extract(month from pg_temp.next_dst_day()) = 3 then 2 else 1 end)::numeric,
  'the UTC offset of that slot matches the season the change lands in: +02:00 after a March change, +01:00 after an October one');
update public.clinic_settings set booking_horizon_days = 60;

update public.clinic_settings set booking_horizon_days = (pg_temp.next_spring_forward() - pg_temp.today_madrid());
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b9', '84000000-0000-0000-0000-000000000008',
    pg_temp.next_spring_forward(), pg_temp.next_spring_forward())),
  8::bigint, 'the spring-forward gap drops the four nonexistent 02:xx wall times from a 01:00-04:00 segment');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b9', '84000000-0000-0000-0000-000000000008',
    pg_temp.next_spring_forward(), pg_temp.next_spring_forward())),
  (select count(distinct starts_at) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b9', '84000000-0000-0000-0000-000000000008',
    pg_temp.next_spring_forward(), pg_temp.next_spring_forward())),
  'every slot on the spring-forward day is a distinct instant: no nonexistent wall time collapses onto a real one');
select is((select count(*) from public.available_slots(
    '84000000-0000-0000-0000-0000000000b9', '84000000-0000-0000-0000-000000000008',
    pg_temp.next_spring_forward(), pg_temp.next_spring_forward())
  where extract(hour from (starts_at at time zone 'Europe/Madrid')) = 2),
  0::bigint, 'no slot is ever offered at a wall-clock hour that Madrid skips on the spring-forward day');
update public.clinic_settings set booking_horizon_days = 60;

select is(pg_get_function_result('public.available_slots(uuid, uuid, date, date)'::regprocedure),
  'TABLE(starts_at timestamp with time zone, professional_id uuid)',
  'available_slots exposes only a start time and a professional, never a patient or service column');
select is(has_function_privilege('anon', 'public.available_slots(uuid, uuid, date, date)', 'execute'), true,
  'anon can look up available slots');
select is(has_function_privilege('authenticated', 'public.available_slots(uuid, uuid, date, date)', 'execute'), true,
  'a signed-in visitor can look up available slots too');

update public.clinic_settings set booking_horizon_days = 45;
select is(public.booking_horizon_days(), 45,
  'the web reads the configured booking horizon, so paging stops where booking stops');
update public.clinic_settings set booking_horizon_days = 60;
select is(has_function_privilege('anon', 'public.booking_horizon_days()', 'execute'), true,
  'anon can read how far ahead the clinic takes bookings');
select is(has_function_privilege('authenticated', 'public.booking_horizon_days()', 'execute'), true,
  'a signed-in visitor can read how far ahead the clinic takes bookings too');

set local role anon;
select lives_ok($$ select * from public.booking_catalog() $$,
  'an anonymous visitor can read the booking catalog');
select lives_ok($$
  select * from public.available_slots('84000000-0000-0000-0000-0000000000b1', '84000000-0000-0000-0000-000000000001',
    pg_temp.day3(), pg_temp.day3())
$$, 'an anonymous visitor can read available slots');
select is(public.booking_horizon_days(), 60,
  'an anonymous visitor reads the horizon without any access to clinic_settings');
reset role;

reset role;
select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);

insert into auth.users (id, email) values
  ('85000000-0000-0000-0000-000000000001', 'p1-cuenta@test.local'),
  ('85000000-0000-0000-0000-000000000002', 'p2-cuenta@test.local'),
  ('85000000-0000-0000-0000-000000000010', 'familia-a@test.local'),
  ('85000000-0000-0000-0000-000000000011', 'paciente-b@test.local');
insert into public.specialties (id, name, slug) values
  ('85000000-0000-0000-0000-0000000000aa', 'Cuenta test', 'cuenta-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('85000000-0000-0000-0000-000000000001', 'p1-cuenta@test.local', 'Profesional Uno', 'employee', true, '85000000-0000-0000-0000-0000000000aa'),
  ('85000000-0000-0000-0000-000000000002', 'p2-cuenta@test.local', 'Profesional Dos', 'employee', true, '85000000-0000-0000-0000-0000000000aa');
insert into public.patient_accounts (id, email) values
  ('85000000-0000-0000-0000-000000000010', 'familia-a@test.local'),
  ('85000000-0000-0000-0000-000000000011', 'paciente-b@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, is_active, booking_payment, booking_payment_value) values
  ('85000000-0000-0000-0000-0000000000b1', '85000000-0000-0000-0000-0000000000aa', 'Cuenta 30', 30, 3000, true, true, 'none', 0),
  ('85000000-0000-0000-0000-0000000000b2', '85000000-0000-0000-0000-0000000000aa', 'Cuenta con senal', 30, 3000, true, true, 'fixed', 1000),
  ('85000000-0000-0000-0000-0000000000b3', '85000000-0000-0000-0000-0000000000aa', 'Cuenta solo clinica', 30, 3000, false, true, 'none', 0);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('85000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day3())::smallint, '10:00', '12:00'),
  ('85000000-0000-0000-0000-000000000002', extract(isodow from pg_temp.day3())::smallint, '10:00', '12:00');
insert into public.people (id, first_name, last_name, birth_date, email, phone, is_patient, archived_at) values
  ('85000000-0000-0000-0000-0000000000c1', 'Madre', 'Familia', '1985-04-10', 'Familia-A@test.local', '600000001', true, null),
  ('85000000-0000-0000-0000-0000000000c2', 'Hijo', 'Familia', pg_temp.today_madrid() - interval '10 years', null, null, true, null),
  ('85000000-0000-0000-0000-0000000000c3', 'Archivada', 'Familia', '1980-01-01', 'familia-a@test.local', null, true, now()),
  ('85000000-0000-0000-0000-0000000000c4', 'Acompanante', 'Familia', null, 'familia-a@test.local', null, false, null),
  ('85000000-0000-0000-0000-0000000000c5', 'Paciente', 'Otra', '1970-02-02', 'paciente-b@test.local', '600000002', true, null),
  ('85000000-0000-0000-0000-0000000000c6', 'Menor', 'Otra', pg_temp.today_madrid() - interval '8 years', null, null, true, null),
  ('85000000-0000-0000-0000-0000000000c7', 'Hija', 'Familia', pg_temp.today_madrid() - interval '12 years', 'familia-a@test.local', null, true, null),
  ('85000000-0000-0000-0000-0000000000ca', 'Tutora', 'Familia', '1984-07-07', 'familia-a@test.local', '600000003', false, null);
insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('85000000-0000-0000-0000-0000000000c2', '85000000-0000-0000-0000-0000000000c1', 'madre', true),
  ('85000000-0000-0000-0000-0000000000c7', '85000000-0000-0000-0000-0000000000c1', 'madre', true),
  ('85000000-0000-0000-0000-0000000000c6', '85000000-0000-0000-0000-0000000000c5', 'padre', true);

select is(pg_get_function_result('public.my_people()'::regprocedure),
  'TABLE(id uuid, first_name text, last_name text, birth_date date, is_minor boolean, is_patient boolean, relation text)',
  'my_people never exposes an email or a phone, so a shared email does not leak contact data');
select is(pg_get_function_result('public.my_appointments()'::regprocedure),
  'TABLE(id uuid, person_id uuid, person_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, status appointment_status, service_id uuid, service_name text, professional_id uuid, professional_name text, origin appointment_origin, cancelled_by appointment_canceller, change_deadline timestamp with time zone, can_change boolean, can_reschedule boolean, invoiced boolean, updated_at timestamp with time zone)',
  'my_appointments never exposes notes or payment amounts, only whether the appointment is invoiced');
select is(has_function_privilege('anon', 'public.my_people()', 'execute'), false,
  'an anonymous visitor cannot list anybody''s people');
select is(has_function_privilege('anon', 'public.my_appointments()', 'execute'), false,
  'an anonymous visitor cannot list anybody''s appointments');
select is(has_function_privilege('anon', 'public.book_appointment(uuid, uuid, uuid, timestamptz)', 'execute'), false,
  'an anonymous visitor cannot book: a booking always belongs to a verified email');
select is(has_function_privilege('anon', 'public.add_my_person(text, text, date, text, uuid, public.guardian_relationship, boolean, boolean, text)', 'execute'), false,
  'an anonymous visitor cannot create people');
select is(has_function_privilege('authenticated', 'public.book_appointment(uuid, uuid, uuid, timestamptz)', 'execute'), true,
  'a signed-in patient can book');
select is(has_function_privilege('authenticated', 'public.add_my_person(text, text, date, text, uuid, public.guardian_relationship, boolean, boolean, text)', 'execute'), true,
  'a signed-in patient can add people to her account');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select results_eq(
  $$ select id, relation from public.my_people() order by first_name $$,
  $$ values ('85000000-0000-0000-0000-0000000000c4'::uuid, 'self'::text),
            ('85000000-0000-0000-0000-0000000000c7'::uuid, 'self'::text),
            ('85000000-0000-0000-0000-0000000000c2'::uuid, 'ward'::text),
            ('85000000-0000-0000-0000-0000000000c1'::uuid, 'self'::text),
            ('85000000-0000-0000-0000-0000000000ca'::uuid, 'self'::text) $$,
  'account A sees the people with its email plus the minors they guard, each once, and never the archived one');
select is((select is_minor from public.my_people() where id = '85000000-0000-0000-0000-0000000000c2'), true,
  'a ten-year-old ward is flagged as a minor so the web asks for a guardian');
select is((select is_minor from public.my_people() where id = '85000000-0000-0000-0000-0000000000c1'), false,
  'the mother is an adult');
select is((select is_patient from public.my_people() where id = '85000000-0000-0000-0000-0000000000c4'), false,
  'a companion who is not a patient yet is listed as such');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000011');
select is(public.my_privacy_accepted(), false,
  'an account whose people were created by the clinic has not accepted the web privacy policy, so the web must ask for it');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000011');
select results_eq(
  $$ select id from public.my_people() order by first_name $$,
  $$ values ('85000000-0000-0000-0000-0000000000c6'::uuid), ('85000000-0000-0000-0000-0000000000c5'::uuid) $$,
  'account B sees only its own person and her ward, never family A');

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select throws_ok($$ select * from public.my_people() $$, '42501', null,
  'a team member without a patient account cannot use the patient functions');
select throws_ok($$ select * from public.my_appointments() $$, '42501', null,
  'a team member cannot list appointments through the patient door');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '10:00'::time) at time zone 'Europe/Madrid')
$$, '42501', null, 'a team member cannot book through the patient door');
select throws_ok($$
  select public.add_my_person('Nadie', 'Nadie', '1990-01-01', null, null, null, true, true, '2026-09')
$$, '42501', null, 'a team member cannot create people through the patient door');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select lives_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c2', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '10:00'::time) at time zone 'Europe/Madrid')
$$, 'the mother books a free slot for her minor');
reset role;
select is((select origin::text || ':' || booked_by_account::text || ':' || status::text from public.appointments
  where patient_id = '85000000-0000-0000-0000-0000000000c2'),
  'web:85000000-0000-0000-0000-000000000010:scheduled',
  'the booking is a web booking tied to the account that made it');
select is((select ends_at - starts_at from public.appointments where patient_id = '85000000-0000-0000-0000-0000000000c2'),
  interval '30 minutes', 'the booking lasts exactly the service duration');
select is((select actor_kind::text from public.appointment_events e
  join public.appointments a on a.id = e.appointment_id
  where a.patient_id = '85000000-0000-0000-0000-0000000000c2' and e.kind = 'created'),
  'patient', 'the history says the patient booked it');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c5', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'person_not_in_account', 'account A cannot book for account B''s person, even knowing her id');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c6', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'person_not_in_account', 'account A cannot book for a minor guarded by account B');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c3', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'person_not_in_account', 'an archived person is no longer part of the account');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c4', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000002', (pg_temp.day3()::timestamp + '11:30'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'person_not_in_account', 'a companion the clinic saved without a birth date cannot become a patient from the web, since every patient needs one');
select lives_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000ca', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000002', (pg_temp.day3()::timestamp + '11:30'::time) at time zone 'Europe/Madrid')
$$, 'an adult of the account who is not a patient yet, like a mother saved as guardian, can book for herself');
reset role;
select is((select is_patient from public.people where id = '85000000-0000-0000-0000-0000000000ca'), true,
  'booking for her makes her a patient, so the clinic sees her in the patient list');
select is((select origin::text from public.appointments where patient_id = '85000000-0000-0000-0000-0000000000ca'), 'web',
  'her appointment is a web booking');
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '10:15'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'slot_not_available', 'a slot overlapping an existing appointment is refused with a clear code');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '13:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'slot_not_available', 'a time outside the professional''s schedule is never bookable');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '10:40'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'slot_not_available', 'a start off the 15-minute grid is not a slot');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b1',
    '84000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '15:15'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'slot_not_available', 'a professional of another specialty is never booked, even when her schedule is free');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b2',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'service_not_bookable', 'a service with a deposit is never booked online while payments are off');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b3',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'service_not_bookable', 'a service the clinic does not offer online cannot be booked by id');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000ff',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'service_not_bookable', 'an unknown service is not bookable');
select lives_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c1', '85000000-0000-0000-0000-0000000000b1',
    null, (pg_temp.day3()::timestamp + '10:00'::time) at time zone 'Europe/Madrid')
$$, 'with no professional chosen, the first free one of the specialty gets the booking');
reset role;
select is((select professional_id from public.appointments where patient_id = '85000000-0000-0000-0000-0000000000c1'),
  '85000000-0000-0000-0000-000000000002'::uuid,
  'professional one is busy at 10:00, so the free professional two gets it');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000011');
select lives_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c5', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000001', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'account B books for its own person');
select results_eq(
  $$ select person_id, person_name, service_name, professional_name, origin::text from public.my_appointments() $$,
  $$ values ('85000000-0000-0000-0000-0000000000c5'::uuid, 'Paciente Otra'::text, 'Cuenta 30'::text, 'Profesional Uno'::text, 'web'::text) $$,
  'account B sees only its own appointment, never family A''s');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select results_eq(
  $$ select person_id from public.my_appointments() order by person_id $$,
  $$ values ('85000000-0000-0000-0000-0000000000c1'::uuid), ('85000000-0000-0000-0000-0000000000c2'::uuid),
            ('85000000-0000-0000-0000-0000000000ca'::uuid) $$,
  'account A sees the appointments of its adults and her minor, and not B''s');

select throws_ok($$
  select public.add_my_person('Nueva', 'Familia', '1990-05-05', '600000003', null, null, true, false, null)
$$, 'P0001', 'privacy_required', 'the first person added from the web needs the privacy policy accepted');
select throws_ok($$
  select public.add_my_person('Nueva', 'Familia', '1990-05-05', '600000003', null, null, true, true, null)
$$, 'P0001', 'privacy_required', 'accepting the policy without saying which version leaves no proof of what was accepted');
select throws_ok($$
  select public.add_my_person('Nueva', 'Familia', '1990-05-05', '600000003', null, null, true, true, '  ')
$$, 'P0001', 'privacy_required', 'a blank policy version is no proof either');
select lives_ok($$
  select public.add_my_person('Nueva', 'Familia', '1990-05-05', '600000003', null, null, true, true, ' 2026-09 ')
$$, 'with the policy accepted, an adult is added to the account');
select is((select relation from public.my_people() where first_name = 'Nueva'), 'self',
  'the new adult carries the account email, so she belongs to the account');
reset role;
select is((select privacy_version || ':' || (privacy_accepted_at is not null)::text from public.patient_accounts
  where id = '85000000-0000-0000-0000-000000000010'), '2026-09:true',
  'the account records when and which privacy version it accepted');
select is((select created_by from public.people where first_name = 'Nueva'), null,
  'a person added by a patient has no team author, since created_by points at team profiles');
select is((select email || ':' || phone from public.people where first_name = 'Nueva'),
  'familia-a@test.local:600000003', 'the new adult is stored with the account email and her phone');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select lives_ok($$
  select public.add_my_person('Otro', 'Familia', '1992-05-05', '600000004', null, null, false, false, null)
$$, 'once the policy is accepted, later people do not ask again');
select throws_ok($$
  select public.add_my_person('Menor', 'Ajeno', (pg_temp.today_madrid() - interval '5 years')::date, null,
    '85000000-0000-0000-0000-0000000000c5', 'madre', true, false, null)
$$, 'P0001', 'guardian_not_in_account', 'a minor cannot be hung from another account''s person');
select throws_ok($$
  select public.add_my_person('Menor', 'Nieto', (pg_temp.today_madrid() - interval '1 years')::date, null,
    '85000000-0000-0000-0000-0000000000c7', 'otro', true, false, null)
$$, 'P0001', 'guardian_not_adult', 'a minor of the account cannot be the guardian of another minor');
select throws_ok($$
  select public.add_my_person('Mayor', 'Familia', '1990-01-01', null,
    '85000000-0000-0000-0000-0000000000c1', 'madre', true, false, null)
$$, 'P0001', 'person_not_minor', 'only minors are added under a guardian');
select throws_ok($$
  select public.add_my_person('Pequena', 'Familia', (pg_temp.today_madrid() - interval '3 years')::date, null,
    null, null, true, false, null)
$$, 'P0001', 'person_not_adult', 'a minor cannot be added as an adult of the account');
select throws_ok($$
  select public.add_my_person('Bebe', 'Familia', (pg_temp.today_madrid() - interval '1 years')::date, null,
    '85000000-0000-0000-0000-0000000000c1', null, true, false, null)
$$, 'P0001', 'relationship_required', 'a minor added under a guardian needs the relation, so the clinic knows who signs for her');
select throws_ok($$
  select public.add_my_person('Otra', 'Familia', '1993-05-05', null, null, null, true, true, '')
$$, 'P0001', 'privacy_required', 'an already accepted policy cannot be overwritten with an empty version');
reset role;
select is((select privacy_version from public.patient_accounts where id = '85000000-0000-0000-0000-000000000010'), '2026-09',
  'the stored privacy record survives a later blank acceptance');
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select lives_ok($$
  select public.add_my_person('Bebe', 'Familia', (pg_temp.today_madrid() - interval '1 years')::date, null,
    '85000000-0000-0000-0000-0000000000c1', 'madre', true, false, null)
$$, 'the mother adds her baby as a minor she guards');
select is((select relation || ':' || is_minor::text from public.my_people() where first_name = 'Bebe'), 'ward:true',
  'the baby appears as a ward of the account');
reset role;
select is((select g.relationship::text || ':' || g.is_primary::text || ':' || coalesce(p.email, 'sin email')
  from public.guardianships g join public.people p on p.id = g.minor_id where p.first_name = 'Bebe'),
  'madre:true:sin email', 'the guardianship records the relation and the minor gets no email of her own');

select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select is(
  public.add_my_person('MADRE', ' familia ', '1985-04-10', '600 999 999', null, null, true, false, null),
  '85000000-0000-0000-0000-0000000000c1'::uuid,
  'choosing «Es para mí» with the name and birth date of a person already in the account returns that person instead of creating a second record of her');
select is(
  public.add_my_person('Acompañante', 'Familia', '1979-09-09', '600 000 009', null, null, true, false, null),
  '85000000-0000-0000-0000-0000000000c4'::uuid,
  'a person of the account without a birth date is reused when the name matches, so a companion created by the team is not duplicated');
reset role;
select is((select count(*) from public.people where public.f_unaccent(lower(first_name)) in ('madre', 'acompanante') and last_name = 'Familia'), 2::bigint,
  'no extra record was created for either of them');
select is((select birth_date::text || ':' || phone from public.people where id = '85000000-0000-0000-0000-0000000000c4'),
  '1979-09-09:600000009',
  'the reused companion keeps the birth date and phone she just typed, since her record had none, so the web does not ask for them again');
select is((select phone from public.people where id = '85000000-0000-0000-0000-0000000000c1'), '600000001',
  'a reused record keeps the data it already had: what is typed on the web only fills the gaps');
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select is((select (birth_date is not null and not is_minor)::text from public.my_people() where id = '85000000-0000-0000-0000-0000000000c4'),
  'true',
  'with her birth date saved she is now an adult of the account, so the web offers her as guardian of a new minor');
reset role;
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000011');
select isnt(
  public.add_my_person('Madre', 'Familia', '1985-04-10', null, null, null, true, true, '2026-09'),
  '85000000-0000-0000-0000-0000000000c1'::uuid,
  'another account with the same name and birth date never gets someone else''s record: only people of the own account are reused');
reset role;

reset role;
select set_config('request.jwt.claims', '', true);
update public.clinic_settings set booking_min_notice_hours = 0;
select set_config('test.inside_notice', (select min(starts_at)::text from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid(), pg_temp.today_madrid() + 1)
  where starts_at > now() + interval '1 hour' and starts_at < now() + interval '23 hours'), true);
update public.clinic_settings set booking_min_notice_hours = 24;
select set_config('test.after_notice', (select min(starts_at)::text from public.available_slots(
    '84000000-0000-0000-0000-0000000000b7', '84000000-0000-0000-0000-000000000004',
    pg_temp.today_madrid() + 1, pg_temp.today_madrid() + 2)), true);
select isnt(current_setting('test.inside_notice', true), null,
  'the all-week professional has a free slot inside the next 24 hours to try, whatever the hour');
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('85000000-0000-0000-0000-0000000000c8', 'Semana', 'Familia', '1988-03-03', 'familia-a@test.local', true);
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c8', '84000000-0000-0000-0000-0000000000b7',
    '84000000-0000-0000-0000-000000000004', current_setting('test.inside_notice')::timestamptz)
$$, 'P0001', 'slot_too_soon', 'a scheduled, free slot less than 24 hours away is refused with its own code: the notice protects the clinic from last-minute bookings and the patient learns why');
select lives_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c8', '84000000-0000-0000-0000-0000000000b7',
    '84000000-0000-0000-0000-000000000004', current_setting('test.after_notice')::timestamptz)
$$, 'the first slot past the 24-hour notice on a scheduled day is booked, so the refusal above was the notice and nothing else');
reset role;
select cmp_ok(current_setting('test.after_notice')::timestamptz, '>=', now() + interval '24 hours',
  'the slot that was booked is indeed at least 24 hours away');

insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('85000000-0000-0000-0000-0000000000c9', 'Acompanante', 'Otra', '1975-01-01', 'paciente-b@test.local', false);
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select throws_ok($$
  select public.book_appointment('85000000-0000-0000-0000-0000000000c9', '85000000-0000-0000-0000-0000000000b1',
    '85000000-0000-0000-0000-000000000002', (pg_temp.day3()::timestamp + '11:00'::time) at time zone 'Europe/Madrid')
$$, 'P0001', 'person_not_in_account', 'account A cannot book for account B''s non-patient adult, so nobody turns a stranger into a patient');
reset role;
select is((select is_patient from public.people where id = '85000000-0000-0000-0000-0000000000c9'), false,
  'the refused booking leaves the stranger untouched');

select is(pg_get_function_result('public.my_privacy_accepted()'::regprocedure), 'boolean',
  'my_privacy_accepted only answers yes or no, never when or which version');
select is(has_function_privilege('anon', 'public.my_privacy_accepted()', 'execute'), false,
  'an anonymous visitor cannot ask about any account');
select is(has_function_privilege('authenticated', 'public.my_privacy_accepted()', 'execute'), true,
  'a signed-in patient can ask about her own account');
select pg_temp.act_as_patient('85000000-0000-0000-0000-000000000010');
select is(public.my_privacy_accepted(), true,
  'once accepted from the web, the account is not asked again');
select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.my_privacy_accepted() $$, '42501', null,
  'a team member has no patient account to ask about');
reset role;

select * from finish();
rollback;
