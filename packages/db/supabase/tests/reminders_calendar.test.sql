begin;
create extension if not exists pgtap with schema extensions;
select plan(83);

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

create or replace function pg_temp.at_madrid(days_from_today int, wall time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date + days_from_today)::timestamp + wall) at time zone 'Europe/Madrid'
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
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('13:30'), pg_temp.at_day_x('14:00')),
  ('88000000-0000-0000-0000-0000000000da', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('14:00'), pg_temp.at_day_x('14:30')),
  ('88000000-0000-0000-0000-0000000000db', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('14:30'), pg_temp.at_day_x('15:00'));

update public.appointments
set status = 'cancelled', cancelled_by = 'clinic', cancelled_at = now()
where id = '88000000-0000-0000-0000-0000000000d7';

create or replace function pg_temp.starts(appointment_id uuid) returns timestamptz language sql stable as $$
  select starts_at from public.appointments where id = appointment_id
$$;

insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status, sent_at) values
  ('88000000-0000-0000-0000-0000000000de', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000de'), 'sent', now());
insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status, error) values
  ('88000000-0000-0000-0000-0000000000df', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000df'), 'failed', 'smtp_down');
insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status) values
  ('88000000-0000-0000-0000-0000000000da', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000da'), 'pending');
insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status, created_at) values
  ('88000000-0000-0000-0000-0000000000db', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000db'), 'pending', now() - interval '61 minutes');

select has_column('public', 'appointment_reminders', 'appointment_id', 'a reminder always names its appointment');
select has_column('public', 'appointment_reminders', 'channel', 'a reminder is sent through a channel');
select has_column('public', 'appointment_reminders', 'sent_at', 'a reminder records when it was actually sent');
select has_column('public', 'appointment_reminders', 'error', 'a reminder records why it failed, if it did');
select enum_has_labels('public', 'reminder_channel', array['email', 'sms'], 'a reminder goes out by email or sms');
select col_not_null('public', 'appointment_reminders', 'status', 'every reminder row says whether it is being sent, was sent or failed');
select enum_has_labels('public', 'reminder_status', array['pending', 'sent', 'failed'],
  'a reminder is claimed as pending before sending, then marked sent or failed');
select is((select relrowsecurity from pg_class where oid = 'public.appointment_reminders'::regclass), true,
  'row level security is on for appointment_reminders');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'appointment_reminders'), 0::bigint,
  'appointment_reminders has no policies, so only security definer functions can reach it');
select is(pg_get_function_result('public.reminder_candidates(date)'::regprocedure),
  'TABLE(appointment_id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, updated_at timestamp with time zone, person_name text, service_name text, professional_name text, change_deadline timestamp with time zone, can_change boolean, recipients text[])',
  'reminder_candidates gives the cron exactly what it needs to email tomorrow''s patients, including when the appointment last changed for the calendar file''s SEQUENCE');

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

select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000da'), 0::bigint,
  'an appointment another run has just claimed is not a candidate, so two overlapping runs never email it twice');
select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000db'), 1::bigint,
  'a claim left pending for over an hour counts as failed, so a run that crashed mid-send does not block the reminder forever');

select throws_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status)
     values ('88000000-0000-0000-0000-0000000000de', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000de'), 'pending') $$,
  '23505', null, 'a recipient already reminded by email of this appointment at this time cannot be claimed again');
select throws_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status)
     values ('88000000-0000-0000-0000-0000000000da', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000da'), 'pending') $$,
  '23505', null, 'a second run cannot claim a recipient another run is still sending to, so only one of them emails her');
select lives_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status)
     values ('88000000-0000-0000-0000-0000000000df', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000df'), 'pending') $$,
  'an appointment whose earlier attempt failed can be claimed again, so a failure can be retried');
select lives_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status, sent_at)
     values ('88000000-0000-0000-0000-0000000000de', 'sms', '600000000', pg_temp.starts('88000000-0000-0000-0000-0000000000de'), 'sent', now()) $$,
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
  'the service role sees exactly the day''s six non-cancelled candidates that are neither reminded nor being reminded');
reset role;

select is(has_function_privilege('anon', 'public.appointment_recipient_emails(uuid)', 'execute'), false,
  'an anonymous visitor cannot ask for the emails of any appointment''s patient');
select is(has_function_privilege('authenticated', 'public.appointment_recipient_emails(uuid)', 'execute'), false,
  'a signed-in user cannot ask for them directly either, only through the checks of appointment_notice_recipients');

select has_column('public', 'appointment_reminders', 'starts_at', 'a reminder records which start time of the appointment it was for');
select col_not_null('public', 'appointment_reminders', 'starts_at', 'every reminder says which start time it was for, so a move is never mistaken for a reminded appointment');

insert into auth.users (id, email) values
  ('88000000-0000-0000-0000-000000000002', 'inactiva-recordatorios@test.local');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('88000000-0000-0000-0000-000000000002', 'inactiva-recordatorios@test.local', 'Inactiva Recordatorios', 'employee', true, '88000000-0000-0000-0000-0000000000aa');
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('88000000-0000-0000-0000-0000000000c7', 'Gema', 'Archivada', '1979-01-01', 'gema-archivada-recordatorios@test.local', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('88000000-0000-0000-0000-0000000000f1', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('15:00'), pg_temp.at_day_x('15:30')),
  ('88000000-0000-0000-0000-0000000000f2', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c3',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('16:30'), pg_temp.at_day_x('17:00')),
  ('88000000-0000-0000-0000-0000000000f3', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c3',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('17:00'), pg_temp.at_day_x('17:30')),
  ('88000000-0000-0000-0000-0000000000f4', '88000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('09:00'), pg_temp.at_day_x('09:30')),
  ('88000000-0000-0000-0000-0000000000f5', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c7',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('17:30'), pg_temp.at_day_x('18:00')),
  ('88000000-0000-0000-0000-0000000000f6', '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('18:00') - interval '1 day', pg_temp.at_day_x('18:30') - interval '1 day');

update public.profiles set is_active = false where id = '88000000-0000-0000-0000-000000000002';
update public.people set archived_at = now() where id = '88000000-0000-0000-0000-0000000000c7';

insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status, sent_at) values
  ('88000000-0000-0000-0000-0000000000f1', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f1'), 'sent', now()),
  ('88000000-0000-0000-0000-0000000000f6', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f6'), 'sent', now()),
  ('88000000-0000-0000-0000-0000000000f2', 'email', 'tutor-a-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f2'), 'sent', now()),
  ('88000000-0000-0000-0000-0000000000f3', 'email', 'tutor-a-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f3'), 'sent', now()),
  ('88000000-0000-0000-0000-0000000000f3', 'email', 'tutor-b-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f3'), 'sent', now());
insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status, error) values
  ('88000000-0000-0000-0000-0000000000f2', 'email', 'tutor-b-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f2'), 'failed', 'buzón lleno');

update public.appointments set starts_at = pg_temp.at_day_x('15:30'), ends_at = pg_temp.at_day_x('16:00')
where id = '88000000-0000-0000-0000-0000000000f1';
update public.appointments set starts_at = pg_temp.at_day_x('18:00'), ends_at = pg_temp.at_day_x('18:30')
where id = '88000000-0000-0000-0000-0000000000f6';

select results_eq(
  $$ select recipients from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f1' $$,
  $$ values (array['bea-equipo-recordatorios@test.local']::text[]) $$,
  'an appointment moved to another time of the same day after its reminder is reminded again of the new time');
select results_eq(
  $$ select recipients from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f6' $$,
  $$ values (array['bea-equipo-recordatorios@test.local']::text[]) $$,
  'an appointment moved to another day after its reminder is reminded again for the new day, so the patient is not left without a reminder of the appointment she really has');
select lives_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status)
     values ('88000000-0000-0000-0000-0000000000f6', 'email', 'bea-equipo-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f6'), 'sent') $$,
  'a reminder for the new time can be recorded although one was already sent for the old time');
select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f6'), 0::bigint,
  'once reminded of the new time, a moved appointment is not reminded again, so a second run that day sends nothing');

select results_eq(
  $$ select recipients from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f2' $$,
  $$ values (array['tutor-b-recordatorios@test.local']::text[]) $$,
  'when one guardian''s reminder failed, the retry goes only to her, so the guardian who got it is not emailed twice');
select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f3'), 0::bigint,
  'a minor whose guardians were both reminded is not a candidate any more');
select lives_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status)
     values ('88000000-0000-0000-0000-0000000000f2', 'email', 'tutor-b-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f2'), 'pending') $$,
  'a guardian whose reminder failed can be claimed again for the retry while the other guardian''s reminder stays sent');
select throws_ok(
  $$ insert into public.appointment_reminders (appointment_id, channel, recipient, starts_at, status)
     values ('88000000-0000-0000-0000-0000000000f2', 'email', 'tutor-a-recordatorios@test.local', pg_temp.starts('88000000-0000-0000-0000-0000000000f2'), 'pending') $$,
  '23505', null, 'the guardian who already got the reminder cannot be claimed again for the same time');

select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f4'), 0::bigint,
  'an appointment of a deactivated professional is not reminded, so nobody is sent to an appointment no one will attend');
select is((select count(*) from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f5'), 0::bigint,
  'an appointment of an archived patient is not reminded');

select is(
  (select updated_at from public.reminder_candidates(pg_temp.day_x()) where appointment_id = '88000000-0000-0000-0000-0000000000f1'),
  (select updated_at from public.appointments where id = '88000000-0000-0000-0000-0000000000f1'),
  'a candidate carries the appointment''s last change, so the reminder''s calendar file never looks older than the change notice');

select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email) values
  ('88000000-0000-0000-0000-000000000020', 'propietaria-calendario@test.local'),
  ('88000000-0000-0000-0000-000000000021', 'a-calendario@test.local'),
  ('88000000-0000-0000-0000-000000000022', 'b-calendario@test.local'),
  ('88000000-0000-0000-0000-000000000023', 'inactiva-calendario@test.local');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id, calendar_token) values
  ('88000000-0000-0000-0000-000000000020', 'propietaria-calendario@test.local', 'Propietaria Calendario', 'owner', true, null, null),
  ('88000000-0000-0000-0000-000000000021', 'a-calendario@test.local', 'Empleada A Calendario', 'employee', true, '88000000-0000-0000-0000-0000000000aa', null),
  ('88000000-0000-0000-0000-000000000022', 'b-calendario@test.local', 'Empleada B Calendario', 'employee', true, '88000000-0000-0000-0000-0000000000aa', null),
  ('88000000-0000-0000-0000-000000000023', 'inactiva-calendario@test.local', 'Inactiva Calendario', 'employee', false, '88000000-0000-0000-0000-0000000000aa', 'token-de-una-inactiva-token-de-una-inactiva');

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('88000000-0000-0000-0000-0000000000e1', '88000000-0000-0000-0000-000000000021', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('09:00'), pg_temp.at_day_x('09:30')),
  ('88000000-0000-0000-0000-0000000000e2', '88000000-0000-0000-0000-000000000021', '88000000-0000-0000-0000-0000000000c3',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('10:00'), pg_temp.at_day_x('10:30')),
  ('88000000-0000-0000-0000-0000000000e3', '88000000-0000-0000-0000-000000000021', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('11:00'), pg_temp.at_day_x('11:30')),
  ('88000000-0000-0000-0000-0000000000e4', '88000000-0000-0000-0000-000000000021', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('09:00') + interval '95 days', pg_temp.at_day_x('09:30') + interval '95 days'),
  ('88000000-0000-0000-0000-0000000000e5', '88000000-0000-0000-0000-000000000022', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_day_x('09:00'), pg_temp.at_day_x('09:30'));

update public.appointments
set status = 'cancelled', cancelled_by = 'clinic', cancelled_at = now()
where id = '88000000-0000-0000-0000-0000000000e3';

select is(pg_get_function_result('public.calendar_feed(text)'::regprocedure),
  'TABLE(appointment_id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, updated_at timestamp with time zone, summary text)',
  'calendar_feed gives the calendar only the time and a short summary of each appointment');
select is(pg_get_function_result('public.calendar_owner(text)'::regprocedure), 'text',
  'calendar_owner reveals nothing about the professional but her name, to title the calendar');

select pg_temp.act_as('88000000-0000-0000-0000-000000000021');
select set_config('lumia_test.token_a', public.regenerate_my_calendar_token(), true);
select matches(current_setting('lumia_test.token_a'), '^[A-Za-z0-9_-]{43}$',
  'a calendar token is 32 random bytes in url-safe base64 without padding, so it fits in a link as is');
select is(public.my_calendar_token(), current_setting('lumia_test.token_a'),
  'an employee can read back her own calendar token to build her link');
select throws_ok($$ select calendar_token from public.profiles where id = '88000000-0000-0000-0000-000000000021' $$,
  '42501', null, 'not even the employee herself reads the token column directly; only through my_calendar_token');
reset role;

select pg_temp.act_as('88000000-0000-0000-0000-000000000021', 'aal1');
select throws_ok($$ select public.my_calendar_token() $$, '42501', null,
  'without the second factor an employee cannot read her calendar token');
select throws_ok($$ select public.regenerate_my_calendar_token() $$, '42501', null,
  'without the second factor an employee cannot create a calendar token');
reset role;

select pg_temp.act_as('88000000-0000-0000-0000-000000000022');
select throws_ok($$ select calendar_token from public.profiles $$, '42501', null,
  'a colleague cannot read anybody''s calendar token');
reset role;

select pg_temp.act_as('88000000-0000-0000-0000-000000000020');
select throws_ok($$ select calendar_token from public.profiles where id = '88000000-0000-0000-0000-000000000021' $$,
  '42501', null, 'not even the owner can read an employee''s calendar token, which is a secret like a password');
select throws_ok($$ update public.profiles set calendar_token = 'forged' where id = '88000000-0000-0000-0000-000000000021' $$,
  '42501', null, 'not even the owner can plant a calendar token she knows for an employee');
select lives_ok($$ select id, email, full_name, role, specialty_id, is_active, created_at, updated_at, license_number from public.profiles $$,
  'the owner still reads every other column of the team, so the admin keeps working');
reset role;

set local role anon;
select results_eq(
  format($$ select appointment_id, summary from public.calendar_feed(%L) $$, current_setting('lumia_test.token_a')),
  $$ values ('88000000-0000-0000-0000-0000000000e1'::uuid, 'Bea Adulta · Recordatorios servicio'),
            ('88000000-0000-0000-0000-0000000000e2'::uuid, 'Cati Menor · Recordatorios servicio') $$,
  'the calendar link shows her own non-cancelled appointments in order, named "Name Surname · Service" and nothing else, without signing in');
select is((select count(*) from public.calendar_feed('estoNoEsUnTokenDeVerdadEstoNoEsUnTokenDeVer')), 0::bigint,
  'a made-up token shows no appointments at all');
select is((select count(*) from public.calendar_feed(null)), 0::bigint,
  'a missing token never matches the employees who have no token');
select is((select count(*) from public.calendar_feed('token-de-una-inactiva-token-de-una-inactiva')), 0::bigint,
  'the token of a deactivated employee shows nothing even if it is still stored');
select is(public.calendar_owner(current_setting('lumia_test.token_a')), 'Empleada A Calendario',
  'a valid link names its owner, so the calendar app titles it with her name');
select is(public.calendar_owner('estoNoEsUnTokenDeVerdadEstoNoEsUnTokenDeVer'), null,
  'a made-up token has no owner, so the link answers not found instead of an empty calendar');
select is(public.calendar_owner(null), null,
  'a missing token never matches the employees who have no token');
select is(public.calendar_owner('token-de-una-inactiva-token-de-una-inactiva'), null,
  'the link of a deactivated employee is not found even if the token is still stored');
reset role;
select is(has_function_privilege('anon', 'public.calendar_owner(text)', 'execute'), true,
  'calendar apps check the link without a session, so anon can execute calendar_owner');
select is(has_function_privilege('anon', 'public.calendar_feed(text)', 'execute'), true,
  'calendar apps fetch the feed without a session, so anon can execute calendar_feed');
select is(has_function_privilege('anon', 'public.my_calendar_token()', 'execute'), false,
  'an anonymous visitor cannot ask for anybody''s calendar token');

select pg_temp.act_as('88000000-0000-0000-0000-000000000021');
select set_config('lumia_test.token_b', public.regenerate_my_calendar_token(), true);
reset role;
select is((select count(*) from public.calendar_feed(current_setting('lumia_test.token_a'))), 0::bigint,
  'after regenerating, a leaked old link stops showing appointments at once');
select is((select count(*) from public.calendar_feed(current_setting('lumia_test.token_b'))), 2::bigint,
  'the new link shows her appointments');
select is(public.calendar_owner(current_setting('lumia_test.token_a')), null,
  'after regenerating, the old link is not found at all');

select pg_temp.act_as('88000000-0000-0000-0000-000000000020');
select set_config('lumia_test.token_owner', public.regenerate_my_calendar_token(), true);
reset role;
set local role anon;
select is(public.calendar_owner(current_setting('lumia_test.token_owner')), 'Propietaria Calendario',
  'a valid link with no appointments still has an owner, so it serves an empty calendar rather than not found');
reset role;

select pg_temp.act_as('88000000-0000-0000-0000-000000000022');
select throws_ok($$ select public.revoke_calendar_token('88000000-0000-0000-0000-000000000021') $$, '42501', null,
  'an employee cannot invalidate a colleague''s calendar link');
reset role;
select pg_temp.act_as('88000000-0000-0000-0000-000000000020');
select lives_ok($$ select public.revoke_calendar_token('88000000-0000-0000-0000-000000000021') $$,
  'the owner can invalidate an employee''s calendar link');
reset role;
select is((select calendar_token from public.profiles where id = '88000000-0000-0000-0000-000000000021'), null,
  'an invalidated calendar link leaves the employee with no token');

select pg_temp.act_as('88000000-0000-0000-0000-000000000021');
select public.regenerate_my_calendar_token();
reset role;
select pg_temp.act_as('88000000-0000-0000-0000-000000000020');
update public.profiles set is_active = false where id = '88000000-0000-0000-0000-000000000021';
reset role;
select is((select calendar_token from public.profiles where id = '88000000-0000-0000-0000-000000000021'), null,
  'deactivating an employee wipes her calendar token, so reactivating her never revives an old link');

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('88000000-0000-0000-0000-0000000000e6', '88000000-0000-0000-0000-000000000022', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-30, '00:00'), pg_temp.at_madrid(-30, '00:30')),
  ('88000000-0000-0000-0000-0000000000e7', '88000000-0000-0000-0000-000000000022', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(90, '23:30'), pg_temp.at_madrid(91, '00:00')),
  ('88000000-0000-0000-0000-0000000000e8', '88000000-0000-0000-0000-000000000022', '88000000-0000-0000-0000-0000000000c2',
   '88000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(91, '00:00'), pg_temp.at_madrid(91, '00:30'));

select pg_temp.act_as('88000000-0000-0000-0000-000000000022');
select set_config('lumia_test.token_edges', public.regenerate_my_calendar_token(), true);
reset role;

set local role anon;
select is((select count(*) from public.calendar_feed(current_setting('lumia_test.token_edges')) where appointment_id = '88000000-0000-0000-0000-0000000000e6'), 1::bigint,
  'an appointment at midnight exactly 30 days ago in Madrid is still in the calendar, so the last month stays visible');
select is((select count(*) from public.calendar_feed(current_setting('lumia_test.token_edges')) where appointment_id = '88000000-0000-0000-0000-0000000000e7'), 1::bigint,
  'an appointment at 23:30 on day 90 in Madrid is in the calendar, so the whole last day of the window shows');
select is((select count(*) from public.calendar_feed(current_setting('lumia_test.token_edges')) where appointment_id = '88000000-0000-0000-0000-0000000000e8'), 0::bigint,
  'an appointment at midnight on day 91 in Madrid is outside the calendar, so the feed stays bounded');
reset role;

insert into auth.users (id, email) values
  ('88000000-0000-0000-0000-000000000024', 'otra-calendario@test.local');
select pg_temp.act_as('88000000-0000-0000-0000-000000000020');
select throws_ok(
  $$ insert into public.profiles (id, email, full_name, role, is_active, calendar_token)
     values ('88000000-0000-0000-0000-000000000024', 'otra-calendario@test.local', 'Otra', 'employee', true, 'token-plantado') $$,
  '42501', null, 'not even the owner can create a team member with a calendar token she knows');
update public.profiles set full_name = 'Empleada B Renombrada' where id = '88000000-0000-0000-0000-000000000022';
reset role;
select is((select calendar_token from public.profiles where id = '88000000-0000-0000-0000-000000000022'), current_setting('lumia_test.token_edges'),
  'the owner renaming an employee keeps her calendar link working, since only deactivation wipes it');

select * from finish();
rollback;
