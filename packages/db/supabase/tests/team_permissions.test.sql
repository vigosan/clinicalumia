begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

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

create or replace function pg_temp.years_ago(years integer) returns date language sql stable as $$
  select ((now() at time zone 'Europe/Madrid')::date - make_interval(years => years))::date
$$;

insert into auth.users (id, email) values
  ('9a000000-0000-0000-0000-000000000001', 'propietaria-permisos@test.local'),
  ('9a000000-0000-0000-0000-000000000002', 'empleada-permisos@test.local'),
  ('9a000000-0000-0000-0000-000000000010', 'menor-propio-permisos@test.local'),
  ('9a000000-0000-0000-0000-000000000011', 'padre-permisos@test.local'),
  ('9a000000-0000-0000-0000-000000000012', 'compartido-permisos@test.local'),
  ('9a000000-0000-0000-0000-000000000013', 'limites-permisos@test.local');
insert into public.specialties (id, name, slug) values
  ('9a000000-0000-0000-0000-0000000000aa', 'Permisos test', 'permisos-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('9a000000-0000-0000-0000-000000000001', 'propietaria-permisos@test.local', 'Propietaria Permisos', 'owner', true, null),
  ('9a000000-0000-0000-0000-000000000002', 'empleada-permisos@test.local', 'Empleada Permisos', 'employee', true, '9a000000-0000-0000-0000-0000000000aa');
insert into public.patient_accounts (id, email, privacy_accepted_at, privacy_version) values
  ('9a000000-0000-0000-0000-000000000010', 'menor-propio-permisos@test.local', now(), '2026-09'),
  ('9a000000-0000-0000-0000-000000000011', 'padre-permisos@test.local', now(), '2026-09'),
  ('9a000000-0000-0000-0000-000000000012', 'compartido-permisos@test.local', now(), '2026-09'),
  ('9a000000-0000-0000-0000-000000000013', 'limites-permisos@test.local', now(), '2026-09');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online) values
  ('9a000000-0000-0000-0000-0000000000b1', '9a000000-0000-0000-0000-0000000000aa', 'Sesión permisos', 30, 3000, true);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('9a000000-0000-0000-0000-000000000002', extract(isodow from pg_temp.day3())::smallint, '09:00', '14:00');
insert into public.people (id, first_name, last_name, birth_date, email, is_patient, archived_at) values
  ('9a000000-0000-0000-0000-0000000000c1', 'Menor', 'Propio', pg_temp.years_ago(15), 'menor-propio-permisos@test.local', true, null),
  ('9a000000-0000-0000-0000-0000000000c2', 'Padre', 'Propio', '1980-01-01', 'padre-permisos@test.local', false, null),
  ('9a000000-0000-0000-0000-0000000000c3', 'Madre', 'Compartida', '1982-01-01', 'compartido-permisos@test.local', false, null),
  ('9a000000-0000-0000-0000-0000000000c4', 'Hija', 'Compartida', pg_temp.years_ago(9), 'compartido-permisos@test.local', true, null),
  ('9a000000-0000-0000-0000-0000000000c5', 'Ficha', 'Activa', '1990-01-01', null, true, null),
  ('9a000000-0000-0000-0000-0000000000c6', 'Ficha', 'Archivada', '1990-01-01', null, true, now()),
  ('9a000000-0000-0000-0000-0000000000c7', 'Nino', 'Tutelado', pg_temp.years_ago(7), null, true, null),
  ('9a000000-0000-0000-0000-0000000000c8', 'Tutora', 'Tutelado', '1979-01-01', null, false, null);
insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('9a000000-0000-0000-0000-0000000000c1', '9a000000-0000-0000-0000-0000000000c2', 'padre', true),
  ('9a000000-0000-0000-0000-0000000000c4', '9a000000-0000-0000-0000-0000000000c3', 'madre', true),
  ('9a000000-0000-0000-0000-0000000000c7', '9a000000-0000-0000-0000-0000000000c8', 'madre', true);
insert into public.employee_time_off (id, profile_id, starts_at, ends_at, reason) values
  ('9a000000-0000-0000-0000-0000000000e1', '9a000000-0000-0000-0000-000000000002',
   pg_temp.at_day3('15:00'), pg_temp.at_day3('18:00'), 'Baja médica');

select pg_temp.act_as_patient('9a000000-0000-0000-0000-000000000010');
select throws_ok($$
  select public.book_appointment('9a000000-0000-0000-0000-0000000000c1', '9a000000-0000-0000-0000-0000000000b1',
    '9a000000-0000-0000-0000-000000000002', pg_temp.at_day3('10:00'))
$$, 'P0001', 'minor_needs_guardian',
  'a fifteen-year-old who signs in with her own email cannot book for herself: a guardian has to do it');

select pg_temp.act_as_patient('9a000000-0000-0000-0000-000000000011');
select lives_ok($$
  select public.book_appointment('9a000000-0000-0000-0000-0000000000c1', '9a000000-0000-0000-0000-0000000000b1',
    '9a000000-0000-0000-0000-000000000002', pg_temp.at_day3('10:00'))
$$, 'her father, signed in with his own email, books for her as her guardian');

select pg_temp.act_as_patient('9a000000-0000-0000-0000-000000000012');
select lives_ok($$
  select public.book_appointment('9a000000-0000-0000-0000-0000000000c4', '9a000000-0000-0000-0000-0000000000b1',
    '9a000000-0000-0000-0000-000000000002', pg_temp.at_day3('11:00'))
$$, 'a family sharing one email can still book for the child, because her mother in that account is her guardian');

select pg_temp.act_as_patient('9a000000-0000-0000-0000-000000000013');
select throws_ok($$
  select public.add_my_person(repeat('a', 101), 'Largo', '1990-01-01', null, null, null, true, false, null)
$$, 'P0001', 'name_too_long', 'a first name longer than 100 characters is refused, so nobody fills the patient base with megabytes');
select throws_ok($$
  select public.add_my_person('Largo', repeat('a', 101), '1990-01-01', null, null, null, true, false, null)
$$, 'P0001', 'name_too_long', 'a last name longer than 100 characters is refused too');
select throws_ok($$
  select public.add_my_person('Telefono', 'Largo', '1990-01-01', repeat('6', 31), null, null, true, false, null)
$$, 'P0001', 'phone_too_long', 'a phone longer than 30 characters is refused');
select throws_ok($$
  select public.add_my_person('Version', 'Larga', '1990-01-01', null, null, null, true, true, repeat('v', 41))
$$, 'P0001', 'privacy_version_too_long', 'a privacy version longer than 40 characters is refused');
select lives_ok($$
  select public.add_my_person(repeat('a', 100), 'Justo', '1990-01-01', null, null, null, true, false, null)
$$, 'a name of exactly 100 characters is still accepted');
select lives_ok($$
  select public.add_my_person('Persona' || n, 'Limite', '1990-01-01', null, null, null, true, false, null)
  from generate_series(2, 10) as n
$$, 'an account can add up to ten people in one day');
select throws_ok($$
  select public.add_my_person('Persona11', 'Limite', '1990-01-01', null, null, null, true, false, null)
$$, 'P0001', 'too_many_people_today', 'the eleventh person of the day is refused, so one account cannot create hundreds of records');
select is(
  public.add_my_person('Persona2', 'Limite', '1990-01-01', null, null, null, true, false, null),
  (select id from public.my_people() where first_name = 'Persona2'),
  'entering again someone already in the account still works at the limit, since nothing new is created');
reset role;
update public.people set created_at = now() - interval '2 days'
where email = 'limites-permisos@test.local' and first_name like 'Persona%';
select pg_temp.act_as_patient('9a000000-0000-0000-0000-000000000013');
select lives_ok($$
  select public.add_my_person('Persona11', 'Limite', '1990-01-01', null, null, null, true, false, null)
$$, 'people added on earlier days do not count towards today''s limit');

select pg_temp.act_as('9a000000-0000-0000-0000-000000000002');
select throws_ok($$
  update public.people set archived_at = now() where id = '9a000000-0000-0000-0000-0000000000c5'
$$, '42501', 'person_archive_owner_only', 'an employee cannot archive a record, not even through the API');
select throws_ok($$
  update public.people set archived_at = null where id = '9a000000-0000-0000-0000-0000000000c6'
$$, '42501', 'person_archive_owner_only', 'an employee cannot unarchive a record either');
select lives_ok($$
  update public.people set phone = '611222333', address = 'Calle Nueva 2' where id = '9a000000-0000-0000-0000-0000000000c5'
$$, 'an employee still edits the record''s data');
select lives_ok($$
  update public.people set address = 'Calle Vieja 1' where id = '9a000000-0000-0000-0000-0000000000c6'
$$, 'an employee still edits an archived record without touching its archive');
select is((select count(*) from public.people where id = '9a000000-0000-0000-0000-0000000000c5' and phone = '611222333'),
  1::bigint, 'the employee''s edit is saved');
select lives_ok($$
  delete from public.guardianships where minor_id = '9a000000-0000-0000-0000-0000000000c7'
$$, 'RLS silently filters an employee''s removal of a guardian');
select lives_ok($$
  update public.guardianships set guardian_id = '9a000000-0000-0000-0000-0000000000c5'
  where minor_id = '9a000000-0000-0000-0000-0000000000c7'
$$, 'RLS silently filters an employee swapping the guardian, which would also remove her');
select lives_ok($$
  delete from public.people where id = '9a000000-0000-0000-0000-0000000000c5'
$$, 'RLS silently filters an employee deleting a record');
select throws_ok($$
  select * from public.person_upcoming_appointments('9a000000-0000-0000-0000-0000000000c1')
$$, '42501', 'person_upcoming_appointments_forbidden',
  'an employee cannot list the appointments of a person with other professionals, since only the owner archives');
select lives_ok($$
  insert into public.guardianships (minor_id, guardian_id, relationship, is_primary)
  values ('9a000000-0000-0000-0000-0000000000c7', '9a000000-0000-0000-0000-0000000000c5', 'otro', false)
$$, 'an employee can still add a guardian, which never leaves a minor without one');

reset role;
select results_eq($$
  select guardian_id from public.guardianships where minor_id = '9a000000-0000-0000-0000-0000000000c7' order by is_primary desc
$$, $$ values ('9a000000-0000-0000-0000-0000000000c8'::uuid), ('9a000000-0000-0000-0000-0000000000c5'::uuid) $$,
  'checked as postgres: the guardian is still there, unchanged, and the new one was added');
select is((select count(*) from public.people where id = '9a000000-0000-0000-0000-0000000000c5'), 1::bigint,
  'checked as postgres: the record the employee tried to delete is still there');

select pg_temp.act_as('9a000000-0000-0000-0000-000000000001');
select results_eq($$
  select professional_name from public.person_upcoming_appointments('9a000000-0000-0000-0000-0000000000c1')
$$, $$ values ('Empleada Permisos'::text) $$, 'the owner lists the upcoming appointments before archiving');
select lives_ok($$
  delete from public.guardianships
  where minor_id = '9a000000-0000-0000-0000-0000000000c7' and guardian_id = '9a000000-0000-0000-0000-0000000000c5'
$$, 'the owner removes a guardian');
select lives_ok($$
  update public.people set archived_at = now() where id = '9a000000-0000-0000-0000-0000000000c5'
$$, 'the owner archives a record');
select lives_ok($$
  update public.people set archived_at = null where id = '9a000000-0000-0000-0000-0000000000c6'
$$, 'the owner unarchives a record');
reset role;
select is((select count(*) from public.guardianships where minor_id = '9a000000-0000-0000-0000-0000000000c7'), 1::bigint,
  'checked as postgres: only the guardian the owner removed is gone');
select is((select count(*) from public.people
  where (id = '9a000000-0000-0000-0000-0000000000c5' and archived_at is not null)
     or (id = '9a000000-0000-0000-0000-0000000000c6' and archived_at is null)), 2::bigint,
  'checked as postgres: the owner''s archive and unarchive were saved');

select pg_temp.act_as('9a000000-0000-0000-0000-000000000002');
select throws_ok($$ select reason from public.employee_time_off $$, '42501', null,
  'an employee cannot read why a colleague is absent, not even through the API');
select is((select count(*) from public.employee_time_off where profile_id = '9a000000-0000-0000-0000-000000000002'
  and starts_at = pg_temp.at_day3('15:00')), 1::bigint,
  'an employee still reads when the absence is, so the agenda shows «Ausencia»');
select results_eq($$
  select id, profile_id, starts_at, ends_at, reason
  from public.time_off_between(array['9a000000-0000-0000-0000-000000000002'::uuid], pg_temp.at_day3('00:00'), pg_temp.at_day3('23:59'))
$$, $$ values ('9a000000-0000-0000-0000-0000000000e1'::uuid, '9a000000-0000-0000-0000-000000000002'::uuid,
  pg_temp.at_day3('15:00'), pg_temp.at_day3('18:00'), null::text) $$,
  'the agenda gets the absence for an employee without its reason');

select pg_temp.act_as('9a000000-0000-0000-0000-000000000001');
select is((select reason from public.time_off_between(array['9a000000-0000-0000-0000-000000000002'::uuid],
  pg_temp.at_day3('00:00'), pg_temp.at_day3('23:59'))), 'Baja médica', 'the owner sees the reason');
select is((select count(*) from public.time_off_between(array['9a000000-0000-0000-0000-000000000002'::uuid],
  pg_temp.at_day3('18:00'), pg_temp.at_day3('23:59'))), 0::bigint, 'an absence that ends when the range starts is not in it');
select is((select count(*) from public.time_off_between(array['9a000000-0000-0000-0000-000000000002'::uuid],
  pg_temp.at_day3('00:00'), null)), 1::bigint, 'without an end the range reaches every later absence, as the schedules page needs');
select lives_ok($$
  insert into public.employee_time_off (profile_id, starts_at, ends_at, reason)
  values ('9a000000-0000-0000-0000-000000000002', pg_temp.at_day3('19:00'), pg_temp.at_day3('20:00'), 'Formación')
$$, 'the owner still records time off with its reason');

select pg_temp.act_as('9a000000-0000-0000-0000-000000000002', 'aal1');
select throws_ok($$
  select * from public.time_off_between(array['9a000000-0000-0000-0000-000000000002'::uuid], now(), null)
$$, '42501', 'time_off_forbidden', 'without the second step nobody lists absences');

select pg_temp.act_as_patient('9a000000-0000-0000-0000-000000000011');
select throws_ok($$
  select * from public.time_off_between(array['9a000000-0000-0000-0000-000000000002'::uuid], now(), null)
$$, '42501', 'time_off_forbidden', 'a patient account cannot list the team''s absences');

reset role;
select is(has_function_privilege('anon', 'public.time_off_between(uuid[], timestamptz, timestamptz)', 'execute'), false,
  'anon cannot call time_off_between');
select is(has_column_privilege('authenticated', 'public.employee_time_off', 'reason', 'select'), false,
  'the reason column is not readable by signed-in users at all');

select * from finish();
rollback;
