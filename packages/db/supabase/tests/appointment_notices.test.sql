begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

create or replace function pg_temp.day_x() returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date + 5
$$;

create or replace function pg_temp.at_day_x(wall time) returns timestamptz language sql stable as $$
  select (pg_temp.day_x()::timestamp + wall) at time zone 'Europe/Madrid'
$$;

insert into auth.users (id, email) values
  ('8e000000-0000-0000-0000-000000000001', 'profesional-avisos@test.local'),
  ('8e000000-0000-0000-0000-000000000002', 'otra-profesional-avisos@test.local'),
  ('8e000000-0000-0000-0000-000000000003', 'propietaria-avisos@test.local'),
  ('8e000000-0000-0000-0000-000000000010', 'cuenta-avisos@test.local');
insert into public.specialties (id, name, slug) values
  ('8e000000-0000-0000-0000-0000000000aa', 'Avisos test', 'avisos-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8e000000-0000-0000-0000-000000000001', 'profesional-avisos@test.local', 'Profesional Avisos', 'employee', true, '8e000000-0000-0000-0000-0000000000aa'),
  ('8e000000-0000-0000-0000-000000000002', 'otra-profesional-avisos@test.local', 'Otra Profesional Avisos', 'employee', true, '8e000000-0000-0000-0000-0000000000aa'),
  ('8e000000-0000-0000-0000-000000000003', 'propietaria-avisos@test.local', 'Propietaria Avisos', 'owner', true, null);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('8e000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day_x())::smallint, '08:00', '18:00');
insert into public.patient_accounts (id, email) values
  ('8e000000-0000-0000-0000-000000000010', 'cuenta-avisos@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, cancellation_hours) values
  ('8e000000-0000-0000-0000-0000000000b1', '8e000000-0000-0000-0000-0000000000aa', 'Avisos servicio', 30, 3000, true, 48);
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('8e000000-0000-0000-0000-0000000000c1', 'Ana', 'Cuenta', '1980-01-01', 'cuenta-avisos@test.local', true),
  ('8e000000-0000-0000-0000-0000000000c2', 'Bea', 'Adulta', '1981-01-01', 'Bea-Avisos@test.local', true),
  ('8e000000-0000-0000-0000-0000000000c6', 'Fran', 'Sinemail', '1982-01-01', null, true);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8e000000-0000-0000-0000-0000000000c3', 'Cati', 'Menor', (pg_temp.day_x() - interval '10 years')::date, true);
insert into public.people (id, first_name, last_name, email, is_patient, archived_at) values
  ('8e000000-0000-0000-0000-0000000000c4', 'Gabriel', 'Tutor', 'tutor-b-avisos@test.local', false, null),
  ('8e000000-0000-0000-0000-0000000000c5', 'Elena', 'Tutora', 'Tutor-A-avisos@test.local', false, null),
  ('8e000000-0000-0000-0000-0000000000c7', 'Antiguo', 'Tutor', 'antiguo-avisos@test.local', false, now());
insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('8e000000-0000-0000-0000-0000000000c3', '8e000000-0000-0000-0000-0000000000c4', 'padre', true),
  ('8e000000-0000-0000-0000-0000000000c3', '8e000000-0000-0000-0000-0000000000c5', 'madre', false),
  ('8e000000-0000-0000-0000-0000000000c3', '8e000000-0000-0000-0000-0000000000c7', 'otro', false);

select pg_temp.act_as_patient('8e000000-0000-0000-0000-000000000010');
select public.book_appointment('8e000000-0000-0000-0000-0000000000c1', '8e000000-0000-0000-0000-0000000000b1',
  '8e000000-0000-0000-0000-000000000001', pg_temp.at_day_x('09:00'));
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);

update public.people set email = 'ana-cambiado-avisos@test.local' where id = '8e000000-0000-0000-0000-0000000000c1';

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8e000000-0000-0000-0000-0000000000d2', '8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c2',
   '8e000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('10:00'), pg_temp.at_day_x('10:30')),
  ('8e000000-0000-0000-0000-0000000000d3', '8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c3',
   '8e000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('11:00'), pg_temp.at_day_x('11:30')),
  ('8e000000-0000-0000-0000-0000000000d6', '8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c6',
   '8e000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('11:30'), pg_temp.at_day_x('12:00'));

select is(pg_get_function_result('public.appointment_notice_recipients(uuid)'::regprocedure), 'text[]',
  'appointment_notice_recipients gives the panel only the addresses to write to');

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001');
select is(
  public.appointment_notice_recipients((select id from public.appointments where patient_id = '8e000000-0000-0000-0000-0000000000c1')),
  array['cuenta-avisos@test.local'],
  'a web appointment is notified at the account that booked it, like its reminder, even after the person''s email changed');
select is(public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d2'),
  array['bea-avisos@test.local'],
  'a team-booked appointment for an adult with an email is notified at her own email, lower-cased like the reminders');
select is(public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d3'),
  array['tutor-a-avisos@test.local', 'tutor-b-avisos@test.local'],
  'a minor with no email is notified at every current guardian''s email in alphabetical order, never an archived one');
select is(public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d6'),
  '{}'::text[],
  'a person with neither an email nor guardians has nobody to notify');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('8e000000-0000-0000-0000-000000000003');
select is(public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d2'),
  array['bea-avisos@test.local'],
  'the owner can notify about any appointment');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('8e000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d2') $$,
  'P0001', 'appointment_not_found',
  'a professional cannot learn the addresses behind another professional''s appointment');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001', 'aal1');
select throws_ok($$ select public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d2') $$,
  '42501', null,
  'staff without the second step cannot read patients'' addresses');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as_patient('8e000000-0000-0000-0000-000000000010');
select throws_ok($$ select public.appointment_notice_recipients('8e000000-0000-0000-0000-0000000000d2') $$,
  '42501', null,
  'a patient account cannot read other people''s addresses');
reset role;
select set_config('request.jwt.claims', '', true);

select is(has_function_privilege('anon', 'public.appointment_notice_recipients(uuid)', 'execute'), false,
  'an anonymous visitor cannot ask who gets an appointment''s notices');
select is(has_function_privilege('authenticated', 'public.appointment_notice_recipients(uuid)', 'execute'), true,
  'signed-in staff can ask, and the function itself checks they are active staff');
select is(has_function_privilege('public', 'public.appointment_notice_recipients(uuid)', 'execute'), false,
  'execute is not left open to public');

select * from finish();
rollback;
