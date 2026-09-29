begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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
  ('88000000-0000-0000-0000-000000000001', 'profesional-recordatorios@test.local'),
  ('88000000-0000-0000-0000-000000000010', 'cuenta-recordatorios@test.local');
insert into public.specialties (id, name, slug) values
  ('88000000-0000-0000-0000-0000000000aa', 'Recordatorios test', 'recordatorios-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('88000000-0000-0000-0000-000000000001', 'profesional-recordatorios@test.local', 'Profesional Recordatorios', 'employee', true, '88000000-0000-0000-0000-0000000000aa');
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('88000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day_x())::smallint, '08:00', '18:00');
insert into public.patient_accounts (id, email) values
  ('88000000-0000-0000-0000-000000000010', 'cuenta-recordatorios@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, cancellation_hours) values
  ('88000000-0000-0000-0000-0000000000b1', '88000000-0000-0000-0000-0000000000aa', 'Recordatorios servicio', 30, 3000, true, 48);
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('88000000-0000-0000-0000-0000000000c1', 'Ana', 'Cuenta', '1980-01-01', 'cuenta-recordatorios@test.local', true),
  ('88000000-0000-0000-0000-0000000000c2', 'Bea', 'Adulta', '1981-01-01', 'bea-equipo-recordatorios@test.local', true),
  ('88000000-0000-0000-0000-0000000000c6', 'Fran', 'Sinemail', '1982-01-01', null, true);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('88000000-0000-0000-0000-0000000000c3', 'Cati', 'Menor', (pg_temp.day_x() - interval '10 years')::date, true);
insert into public.people (id, first_name, last_name, email, is_patient) values
  ('88000000-0000-0000-0000-0000000000c4', 'Gabriel', 'Tutor', 'tutor-b-recordatorios@test.local', false),
  ('88000000-0000-0000-0000-0000000000c5', 'Elena', 'Tutora', 'tutor-a-recordatorios@test.local', false);
insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('88000000-0000-0000-0000-0000000000c3', '88000000-0000-0000-0000-0000000000c4', 'padre', true),
  ('88000000-0000-0000-0000-0000000000c3', '88000000-0000-0000-0000-0000000000c5', 'madre', false);

select pg_temp.act_as_patient('88000000-0000-0000-0000-000000000010');
select public.book_appointment('88000000-0000-0000-0000-0000000000c1', '88000000-0000-0000-0000-0000000000b1',
  '88000000-0000-0000-0000-000000000001', pg_temp.at_day_x('09:00'));
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('lumia.booking_account', '', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('88000000-0000-0000-0000-0000000000d2', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('10:00'), pg_temp.at_day_x('10:30')),
  ('88000000-0000-0000-0000-0000000000d3', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c3',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('11:00'), pg_temp.at_day_x('11:30')),
  ('88000000-0000-0000-0000-0000000000d6', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c6',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('11:30'), pg_temp.at_day_x('12:00')),
  ('88000000-0000-0000-0000-0000000000d7', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('12:00'), pg_temp.at_day_x('12:30')),
  ('88000000-0000-0000-0000-0000000000d9', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('00:30'), pg_temp.at_day_x('01:00')),
  ('88000000-0000-0000-0000-0000000000de', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('13:00'), pg_temp.at_day_x('13:30')),
  ('88000000-0000-0000-0000-0000000000df', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('13:30'), pg_temp.at_day_x('14:00'));

update public.appointments
set status = 'cancelled', cancelled_by = 'clinic', cancelled_at = now()
where id = '88000000-0000-0000-0000-0000000000d7';

insert into public.appointment_reminders (appointment_id, channel, recipient, sent_at) values
  ('88000000-0000-0000-0000-0000000000de', 'email', 'bea-equipo-recordatorios@test.local', now());
insert into public.appointment_reminders (appointment_id, channel, recipient, sent_at, error) values
  ('88000000-0000-0000-0000-0000000000df', 'email', 'bea-equipo-recordatorios@test.local', null, 'smtp_down');

select has_column('public', 'appointment_reminders', 'appointment_id', 'a reminder always names its appointment');
select has_column('public', 'appointment_reminders', 'channel', 'a reminder is sent through a channel');
select has_column('public', 'appointment_reminders', 'sent_at', 'a reminder records when it was actually sent');
select has_column('public', 'appointment_reminders', 'error', 'a reminder records why it failed, if it did');
select enum_has_labels('public', 'reminder_channel', array['email', 'sms'], 'a reminder goes out by email or sms');
select is((select relrowsecurity from pg_class where oid = 'public.appointment_reminders'::regclass), true,
  'row level security is on for appointment_reminders');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'appointment_reminders'), 0::bigint,
  'appointment_reminders has no policies, so only security definer functions can reach it');
select is(pg_get_function_result('public.reminder_candidates(date)'::regprocedure),
  'TABLE(appointment_id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, person_name text, service_name text, professional_name text, change_deadline timestamp with time zone, can_change boolean, recipients text[])',
  'reminder_candidates gives the cron exactly what it needs to email tomorrow''s patients');

select results_eq(
  format($$ select recipients from public.reminder_candidates(%L) where appointment_id = %L $$,
    pg_temp.day_x(), (select id from public.appointments where patient_id = '88000000-0000-0000-0000-0000000000c1' and origin = 'web')),
  $$ values (array['cuenta-recordatorios@test.local']::text[]) $$,
  'a web appointment booked by an account is reminded at the account''s email');
select results_eq(
  format($$ select recipients from public.reminder_candidates(%L) where appointment_id = '88000000-0000-0000-0000-0000000000d2'::uuid $$, pg_temp.day_x()),
  $$ values (array['bea-equipo-recordatorios@test.local']::text[]) $$,
  'a team-booked appointment for an adult with an email is reminded at her own email');

select results_eq(
  $$ select recipients from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000d3' $$,
  $$ values (array['tutor-a-recordatorios@test.local', 'tutor-b-recordatorios@test.local']::text[]) $$,
  'a minor with no email is reminded at both of her guardians'' emails, in alphabetical order');
select results_eq(
  $$ select recipients from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000d6' $$,
  $$ values ('{}'::text[]) $$,
  'a person with neither an email nor guardians gets an empty recipients list');

select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000d7'), 0::bigint,
  'a cancelled appointment never appears among the day''s candidates');

select is((select count(*) from public.reminder_candidates(pg_temp.day_x() - 1) where appointment_id = '88000000-0000-0000-0000-0000000000d9'), 0::bigint,
  'an appointment at 00:30 of day X does not count as day X minus one');
select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000d9'), 1::bigint,
  'an appointment at 00:30 of day X in Madrid time counts as day X');

select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000de'), 0::bigint,
  'an appointment with a successful email reminder already sent is not a candidate again');
select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000df'), 1::bigint,
  'an appointment whose only reminder attempt failed is still a candidate');

select throws_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, sent_at)
     values ('88000000-0000-0000-0000-0000000000de', 'email', 'bea-equipo-recordatorios@test.local', now()) $$,
  '23505', null, 'a second successful send for the same appointment and channel is rejected');
select lives_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, sent_at)
     values ('88000000-0000-0000-0000-0000000000de', 'sms', '600000000', now()) $$,
  'the same appointment can still be reminded on a different channel');

select is(has_table_privilege('anon', 'public.appointment_reminders', 'select'), false,
  'an anonymous visitor cannot read the reminders log');
select is(has_table_privilege('authenticated', 'public.appointment_reminders', 'select'), false,
  'a signed-in patient cannot read the reminders log either');
select is(has_function_privilege('anon', 'public.reminder_candidates(date)', 'execute'), false,
  'an anonymous visitor cannot pick tomorrow''s candidates');
select is(has_function_privilege('authenticated', 'public.reminder_candidates(date)', 'execute'), false,
  'a signed-in patient cannot pick tomorrow''s candidates either');
select is(has_function_privilege('service_role', 'public.reminder_candidates(date)', 'execute'), true,
  'only the cron''s service role can pick tomorrow''s candidates');

set local role anon;
select throws_ok($$ select * from public.reminder_candidates(current_date) $$, '42501', null,
  'an anonymous visitor is refused by grants before the function ever runs');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.reminder_candidates(current_date) $$, '42501', null,
  'a signed-in patient is refused by grants before the function ever runs');
reset role;

set local role service_role;
select is((select count(*) from public.reminder_candidates(pg_temp.day_x())), 6::bigint,
  'the service role sees exactly the day''s six non-cancelled, unreminded candidates');
reset role;

select * from finish();
rollback;
