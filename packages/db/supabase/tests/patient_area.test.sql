begin;
create extension if not exists pgtap with schema extensions;
select plan(78);

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

create or replace function pg_temp.day3() returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date + 3
$$;

create or replace function pg_temp.at_day3(wall time) returns timestamptz language sql stable as $$
  select (pg_temp.day3()::timestamp + wall) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.general_hours() returns interval language sql stable security definer as $$
  select make_interval(hours => cancellation_hours) from public.clinic_settings
$$;

create or replace function pg_temp.edge_hours() returns int language sql stable as $$
  select case when ((now() + interval '48 hours') at time zone 'Europe/Madrid')::time >= '23:50' then 47 else 48 end
$$;

create or replace function pg_temp.web_id() returns uuid language sql stable security definer as $$
  select id from public.appointments
  where patient_id = '87000000-0000-0000-0000-0000000000c1' and origin = 'web'
$$;

insert into auth.users (id, email) values
  ('87000000-0000-0000-0000-000000000001', 'equipo-area@test.local'),
  ('87000000-0000-0000-0000-000000000002', 'segunda-area@test.local'),
  ('87000000-0000-0000-0000-000000000010', 'cuenta-a-area@test.local'),
  ('87000000-0000-0000-0000-000000000011', 'cuenta-b-area@test.local');
insert into public.specialties (id, name, slug) values
  ('87000000-0000-0000-0000-0000000000aa', 'Area de paciente test', 'area-de-paciente-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('87000000-0000-0000-0000-000000000001', 'equipo-area@test.local', 'Profesional Area', 'employee', true, '87000000-0000-0000-0000-0000000000aa'),
  ('87000000-0000-0000-0000-000000000002', 'segunda-area@test.local', 'Segunda Area', 'employee', true, '87000000-0000-0000-0000-0000000000aa');
insert into public.patient_accounts (id, email) values
  ('87000000-0000-0000-0000-000000000010', 'cuenta-a-area@test.local'),
  ('87000000-0000-0000-0000-000000000011', 'cuenta-b-area@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, cancellation_hours) values
  ('87000000-0000-0000-0000-0000000000b1', '87000000-0000-0000-0000-0000000000aa', 'Area 48 horas', 30, 3000, true, 48),
  ('87000000-0000-0000-0000-0000000000b2', '87000000-0000-0000-0000-0000000000aa', 'Area plazo general', 30, 3000, true, null),
  ('87000000-0000-0000-0000-0000000000b3', '87000000-0000-0000-0000-0000000000aa', 'Area limite', 5, 1000, true, pg_temp.edge_hours()),
  ('87000000-0000-0000-0000-0000000000b4', '87000000-0000-0000-0000-0000000000aa', 'Area solo clinica', 30, 3000, false, null);
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('87000000-0000-0000-0000-0000000000c1', 'Ana', 'Cuenta', '1980-01-01', 'cuenta-a-area@test.local', true),
  ('87000000-0000-0000-0000-0000000000c2', 'Bea', 'Otra', '1981-01-01', 'cuenta-b-area@test.local', true);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('87000000-0000-0000-0000-0000000000c3', 'Cati', 'Menor', ((now() at time zone 'Europe/Madrid')::date - interval '10 years')::date, true);
insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('87000000-0000-0000-0000-0000000000c3', '87000000-0000-0000-0000-0000000000c1', 'madre', true);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('87000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day3())::smallint, '10:00', '14:00'),
  ('87000000-0000-0000-0000-000000000002', extract(isodow from pg_temp.day3())::smallint, '10:00', '14:00');
insert into public.employee_time_off (profile_id, starts_at, ends_at, reason) values
  ('87000000-0000-0000-0000-000000000002', pg_temp.at_day3('12:30'), pg_temp.at_day3('13:00'), 'Ausencia de prueba');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select public.book_appointment('87000000-0000-0000-0000-0000000000c1', '87000000-0000-0000-0000-0000000000b1',
  '87000000-0000-0000-0000-000000000001', pg_temp.at_day3('10:00'));

select pg_temp.act_as('87000000-0000-0000-0000-000000000001');
insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('87000000-0000-0000-0000-0000000000d1', '87000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b2', pg_temp.at_day3('12:00'), pg_temp.at_day3('12:30')),
  ('87000000-0000-0000-0000-0000000000d2', '87000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-0000000000c2',
   '87000000-0000-0000-0000-0000000000b2', pg_temp.at_day3('13:00'), pg_temp.at_day3('13:30'));
reset role;
select set_config('request.jwt.claims', '', true);

select is(pg_get_function_result('public.my_appointments()'::regprocedure),
  'TABLE(id uuid, person_id uuid, person_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, status appointment_status, service_id uuid, service_name text, professional_id uuid, professional_name text, origin appointment_origin, cancelled_by appointment_canceller, change_deadline timestamp with time zone, can_change boolean, can_reschedule boolean)',
  'my_appointments gives the web what it needs to offer changes, and still never exposes notes, reasons or payment data');
select is((select prosecdef from pg_proc where oid = 'public.reschedule_my_appointment(uuid, timestamptz)'::regprocedure), true,
  'reschedule runs as definer because patients cannot touch appointments directly');
select is((select prosecdef from pg_proc where oid = 'public.cancel_my_appointment(uuid)'::regprocedure), true,
  'cancel runs as definer because patients cannot touch appointments directly');
select is(has_function_privilege('anon', 'public.my_appointments()', 'execute'), false,
  'an anonymous visitor cannot list anybody''s appointments');
select is(has_function_privilege('anon', 'public.reschedule_my_appointment(uuid, timestamptz)', 'execute'), false,
  'an anonymous visitor cannot move anybody''s appointment');
select is(has_function_privilege('anon', 'public.cancel_my_appointment(uuid)', 'execute'), false,
  'an anonymous visitor cannot cancel anybody''s appointment');
select is(has_function_privilege('authenticated', 'public.my_appointments()', 'execute'), true,
  'a signed-in patient can list her appointments');
select is(has_function_privilege('authenticated', 'public.reschedule_my_appointment(uuid, timestamptz)', 'execute'), true,
  'a signed-in patient can move her appointments');
select is(has_function_privilege('authenticated', 'public.cancel_my_appointment(uuid)', 'execute'), true,
  'a signed-in patient can cancel her appointments');
select is(has_function_privilege('anon', 'public._free_slots(uuid, uuid, date, date, uuid)', 'execute'), false,
  'the internal slot helper can ignore any appointment, so visitors never call it');
select is(has_function_privilege('authenticated', 'public._free_slots(uuid, uuid, date, date, uuid)', 'execute'), false,
  'the internal slot helper is not callable by signed-in users either, only through our functions');
select is(has_function_privilege('anon', 'public.available_slots(uuid, uuid, date, date)', 'execute'), true,
  'visitors still see free slots before signing in');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select results_eq(
  $$ select id, origin::text, change_deadline, can_change, can_reschedule from public.my_appointments() $$,
  $$ values (pg_temp.web_id(), 'web'::text, pg_temp.at_day3('10:00') - interval '48 hours', true, true),
            ('87000000-0000-0000-0000-0000000000d1'::uuid, 'staff'::text, pg_temp.at_day3('12:00') - pg_temp.general_hours(), true, true) $$,
  'account A sees its web and team appointments in order, each with its service''s own deadline or the general one');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000011');
select results_eq(
  $$ select id from public.my_appointments() $$,
  $$ values ('87000000-0000-0000-0000-0000000000d2'::uuid) $$,
  'account B only sees its own appointment, never account A''s');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('11:00')),
  'P0001', 'appointment_not_in_account', 'account B cannot move account A''s appointment even knowing its id');
select throws_ok(format($$ select public.cancel_my_appointment(%L) $$, pg_temp.web_id()),
  'P0001', 'appointment_not_in_account', 'account B cannot cancel account A''s appointment even knowing its id');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, gen_random_uuid(), pg_temp.at_day3('11:00')),
  'P0001', 'appointment_not_in_account', 'an unknown id is answered the same way, so ids cannot be probed');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select is(public.reschedule_my_appointment(pg_temp.web_id(), pg_temp.at_day3('11:00')), pg_temp.web_id(),
  'account A moves its web appointment to another free slot');
reset role;
select is((select starts_at || '/' || ends_at from public.appointments where id = pg_temp.web_id()),
  pg_temp.at_day3('11:00') || '/' || pg_temp.at_day3('11:30'),
  'the appointment moves and keeps its length');
select is((select kind::text || ':' || actor_kind::text || ':' || coalesce(actor_id::text, 'null') || ':' || previous_starts_at
    from public.appointment_events where appointment_id = pg_temp.web_id() and kind = 'moved'),
  'moved:patient:null:' || pg_temp.at_day3('10:00'),
  'the history says the patient moved it from the web, without pretending a team member did');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select lives_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('11:15')),
  'moving 15 minutes overlaps only the appointment itself, which does not block it');
reset role;
select is((select starts_at || '/' || ends_at from public.appointments where id = pg_temp.web_id()),
  pg_temp.at_day3('11:15') || '/' || pg_temp.at_day3('11:45'),
  'the 15-minute move is applied');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select lives_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('11:15')),
  'choosing the same time again is harmless');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('13:00')),
  'P0001', 'slot_not_available', 'a slot taken by someone else is refused');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('11:50')),
  'P0001', 'slot_not_available', 'a time outside the 15-minute grid is not a slot');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('16:00')),
  'P0001', 'slot_not_available', 'a time outside the professional''s schedule is not a slot');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), date_trunc('hour', now() + interval '30 hours')),
  'P0001', 'outside_change_window', 'the new time must itself be outside its free-change deadline, or the patient could dodge the rule by moving closer');
reset role;
select is((select starts_at from public.appointments where id = pg_temp.web_id()), pg_temp.at_day3('11:15'),
  'refused moves leave the appointment where it was');
select is((select count(*) from public.available_slots('87000000-0000-0000-0000-0000000000b1',
    '87000000-0000-0000-0000-000000000001', pg_temp.day3(), pg_temp.day3())
    where starts_at in (pg_temp.at_day3('11:00'), pg_temp.at_day3('11:15'), pg_temp.at_day3('11:30'))),
  0::bigint, 'public free slots still count every appointment, the patient''s own included');

select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);
insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('87000000-0000-0000-0000-0000000000d3', '87000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b1', date_trunc('hour', now() + interval '30 hours'),
   date_trunc('hour', now() + interval '30 hours') + interval '30 minutes'),
  ('87000000-0000-0000-0000-0000000000d4', '87000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b3', now() + make_interval(hours => pg_temp.edge_hours()),
   now() + make_interval(hours => pg_temp.edge_hours()) + interval '5 minutes');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select is((select can_change from public.my_appointments() where id = '87000000-0000-0000-0000-0000000000d3'), false,
  'an appointment 30 hours away is inside its 48-hour window, so the web must not offer changes');
select is((select can_change from public.my_appointments() where id = '87000000-0000-0000-0000-0000000000d4'), false,
  'exactly at the deadline it is already too late');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, '87000000-0000-0000-0000-0000000000d3', pg_temp.at_day3('10:00')),
  'P0001', 'outside_change_window', 'an appointment inside its 48-hour window cannot be moved from the web');
select throws_ok(format($$ select public.cancel_my_appointment(%L) $$, '87000000-0000-0000-0000-0000000000d3'),
  'P0001', 'outside_change_window', 'an appointment inside its 48-hour window cannot be cancelled from the web');
select throws_ok(format($$ select public.cancel_my_appointment(%L) $$, '87000000-0000-0000-0000-0000000000d4'),
  'P0001', 'outside_change_window', 'exactly at the deadline the web cannot cancel either');

select lives_ok($$ select public.cancel_my_appointment('87000000-0000-0000-0000-0000000000d1') $$,
  'account A cancels an appointment the clinic booked for her');
reset role;
select is((select status::text || ':' || cancelled_by::text || ':' || cancel_reason from public.appointments
    where id = '87000000-0000-0000-0000-0000000000d1'),
  'cancelled:patient:', 'the cancellation is recorded as the patient''s, with no reason asked');
select is((select actor_kind::text || ':' || coalesce(actor_id::text, 'null') from public.appointment_events
    where appointment_id = '87000000-0000-0000-0000-0000000000d1' and kind = 'cancelled'),
  'patient:null', 'the history says the patient cancelled it from the web, even though the team booked it');
select is((select actor_kind::text from public.appointment_events
    where appointment_id = '87000000-0000-0000-0000-0000000000d1' and kind = 'created'),
  'staff', 'the booking itself is still credited to the team');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select is((select can_change from public.my_appointments() where id = '87000000-0000-0000-0000-0000000000d1'), false,
  'a cancelled appointment can no longer be changed');
select is((select cancelled_by::text from public.my_appointments() where id = '87000000-0000-0000-0000-0000000000d1'), 'patient',
  'the web can tell who cancelled it');
select throws_ok($$ select public.cancel_my_appointment('87000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'outside_change_window', 'an already cancelled appointment cannot be cancelled again');
select throws_ok($$ select public.reschedule_my_appointment('87000000-0000-0000-0000-0000000000d1', pg_temp.at_day3('12:00')) $$,
  'P0001', 'outside_change_window', 'an already cancelled appointment cannot be moved back to life');

select pg_temp.act_as('87000000-0000-0000-0000-000000000001');
select set_config('lumia.booking_account', '87000000-0000-0000-0000-000000000001', true);
select throws_ok($$ select * from public.my_appointments() $$, '42501', null,
  'a team member without a patient account cannot use the patient door');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at_day3('10:00')),
  '42501', null, 'a team member cannot move appointments through the patient door');
select throws_ok(format($$ select public.cancel_my_appointment(%L) $$, pg_temp.web_id()),
  '42501', null, 'a team member cannot cancel appointments through the patient door');
select lives_ok(format($$ update public.appointments set starts_at = %L, ends_at = %L where id = %L $$,
    pg_temp.at_day3('10:00'), pg_temp.at_day3('10:30'), pg_temp.web_id()),
  'the professional moves the web appointment from the dashboard');
reset role;
select is((select actor_kind::text || ':' || actor_id::text from public.appointment_events
    where appointment_id = pg_temp.web_id() and kind = 'moved' and previous_starts_at = pg_temp.at_day3('11:15')),
  'staff:87000000-0000-0000-0000-000000000001',
  'a team move is credited to the team even with a marker naming the employee, since she has no patient account');

select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);
insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('87000000-0000-0000-0000-0000000000d5', '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b2', pg_temp.at_day3('10:00'), pg_temp.at_day3('11:30')),
  ('87000000-0000-0000-0000-0000000000d6', '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b4', pg_temp.at_day3('16:00'), pg_temp.at_day3('16:30')),
  ('87000000-0000-0000-0000-0000000000d7', '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b2', date_trunc('hour', now() - interval '2 days'),
   date_trunc('hour', now() - interval '2 days') + interval '30 minutes'),
  ('87000000-0000-0000-0000-0000000000d8', '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-0000000000c1',
   '87000000-0000-0000-0000-0000000000b2', date_trunc('hour', now() - interval '3 days'),
   date_trunc('hour', now() - interval '3 days') + interval '30 minutes');
update public.appointments set status = 'no_show' where id = '87000000-0000-0000-0000-0000000000d8';

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select is((select can_change from public.my_appointments() where id = '87000000-0000-0000-0000-0000000000d6'), true,
  'a team appointment for a service not offered online can still be cancelled in time');
select is((select can_reschedule from public.my_appointments() where id = '87000000-0000-0000-0000-0000000000d6'), false,
  'but the web must not offer to move it, because no online slot would ever be free for it');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, '87000000-0000-0000-0000-0000000000d5', pg_temp.at_day3('11:30')),
  'P0001', 'slot_not_available', 'a 90-minute appointment keeps its length, so a slot whose tail runs into time off is refused');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, '87000000-0000-0000-0000-0000000000d5', pg_temp.at_day3('13:30')),
  'P0001', 'slot_not_available', 'the last 30-minute slot of the day cannot hold a 90-minute appointment');
select lives_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, '87000000-0000-0000-0000-0000000000d5', pg_temp.at_day3('10:30')),
  'a slot where the whole 90 minutes fit is accepted');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, '87000000-0000-0000-0000-0000000000d7', pg_temp.at_day3('10:00')),
  'P0001', 'outside_change_window', 'an appointment that already happened cannot be moved');
select throws_ok(format($$ select public.cancel_my_appointment(%L) $$, '87000000-0000-0000-0000-0000000000d7'),
  'P0001', 'outside_change_window', 'an appointment that already happened cannot be cancelled');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, '87000000-0000-0000-0000-0000000000d8', pg_temp.at_day3('10:00')),
  'P0001', 'outside_change_window', 'a missed appointment cannot be moved to erase the no-show');
select throws_ok(format($$ select public.cancel_my_appointment(%L) $$, '87000000-0000-0000-0000-0000000000d8'),
  'P0001', 'outside_change_window', 'a missed appointment cannot be cancelled to erase the no-show');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), now() + interval '48 hours'),
  'P0001', 'outside_change_window', 'a new time exactly on its own deadline is already too late');
reset role;
select is((select starts_at || '/' || ends_at from public.appointments where id = '87000000-0000-0000-0000-0000000000d5'),
  pg_temp.at_day3('10:30') || '/' || pg_temp.at_day3('12:00'), 'the 90-minute appointment moved whole');

select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);
set local role anon;
select throws_ok($$ select public.cancel_my_appointment('87000000-0000-0000-0000-0000000000d2') $$,
  '42501', null, 'an anonymous caller is stopped by grants before reaching any appointment');
reset role;
select is((select status::text from public.appointments where id = '87000000-0000-0000-0000-0000000000d2'), 'scheduled',
  'account B''s appointment is untouched by everyone else''s attempts');
select is((select count(*) from public.appointment_events where appointment_id = '87000000-0000-0000-0000-0000000000d2'),
  1::bigint, 'and its history only has its creation');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000010');
select results_eq(
  $$ select phone, address from public.my_contact('87000000-0000-0000-0000-0000000000c1') $$,
  $$ values (null::text, ''::text) $$,
  'account A starts with no phone and an empty address for her adult');
select lives_ok($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c1', '611223344', '  Calle Mayor 1  ') $$,
  'account A sets her adult''s contact details');
select results_eq(
  $$ select phone, address from public.my_contact('87000000-0000-0000-0000-0000000000c1') $$,
  $$ values ('611223344'::text, 'Calle Mayor 1'::text) $$,
  'the phone is stored normalised and the address is trimmed');
select lives_ok($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c3', '', '') $$,
  'account A can leave her minor without a phone');
select results_eq(
  $$ select phone, address from public.my_contact('87000000-0000-0000-0000-0000000000c3') $$,
  $$ values (null::text, ''::text) $$,
  'the minor keeps an empty phone and address');
select throws_ok($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c1', '', 'Calle Mayor 1') $$,
  'P0001', 'invalid_phone', 'an adult cannot be left without a phone');
select throws_ok($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c1', '123', 'Calle Mayor 1') $$,
  'P0001', 'invalid_phone', 'a phone that is too short is refused');
select throws_ok(format($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c1', '611223344', %L) $$, repeat('a', 301)),
  'P0001', 'address_too_long', 'an address over 300 characters is refused');

select pg_temp.act_as_patient('87000000-0000-0000-0000-000000000011');
select throws_ok($$ select * from public.my_contact('87000000-0000-0000-0000-0000000000c1') $$,
  'P0001', 'person_not_in_account', 'account B cannot read account A''s contact details even knowing the person''s id');
select throws_ok($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c1', '611223344', '') $$,
  'P0001', 'person_not_in_account', 'account B cannot change account A''s contact details even knowing the person''s id');

select pg_temp.act_as('87000000-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.my_contact('87000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'a team member without a patient account cannot read contact details through the patient door');
select throws_ok($$ select public.update_my_contact('87000000-0000-0000-0000-0000000000c1', '611223344', '') $$,
  '42501', null, 'a team member without a patient account cannot change contact details through the patient door');
reset role;

select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);
set local role anon;
select throws_ok($$ select * from public.my_contact('87000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'an anonymous caller is stopped by grants before reaching any contact detail');
reset role;
select is(has_function_privilege('anon', 'public.my_contact(uuid)', 'execute'), false,
  'an anonymous visitor cannot read anybody''s contact details');
select is(has_function_privilege('anon', 'public.update_my_contact(uuid, text, text)', 'execute'), false,
  'an anonymous visitor cannot change anybody''s contact details');
select is(has_function_privilege('authenticated', 'public.my_contact(uuid)', 'execute'), true,
  'a signed-in patient can read contact details');
select is(has_function_privilege('authenticated', 'public.update_my_contact(uuid, text, text)', 'execute'), true,
  'a signed-in patient can change contact details');

select * from finish();
rollback;
