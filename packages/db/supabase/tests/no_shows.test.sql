begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create or replace function pg_temp.create_test_session(user_id uuid) returns uuid language sql security definer as $$
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (gen_random_uuid(), user_id, now(), now())
  returning id;
$$;

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', user_id, 'role', 'authenticated', 'aal', 'aal2',
             'session_id', pg_temp.create_test_session(user_id))::text,
           true);
$$;

create or replace function pg_temp.day3() returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date + 3
$$;

create or replace function pg_temp.at_day3(wall time) returns timestamptz language sql stable as $$
  select (pg_temp.day3()::timestamp + wall) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.ago(wall time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date - 3)::timestamp + wall) at time zone 'Europe/Madrid'
$$;

update public.clinic_settings set booking_min_notice_hours = 24, booking_horizon_days = 60;

insert into auth.users (id, email) values
  ('8e000000-0000-0000-0000-000000000001', 'primera-ausente@test.local'),
  ('8e000000-0000-0000-0000-000000000002', 'segunda-ausente@test.local');
insert into public.specialties (id, name, slug) values
  ('8e000000-0000-0000-0000-0000000000aa', 'No presentadas test', 'no-presentadas-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8e000000-0000-0000-0000-000000000001', 'primera-ausente@test.local', 'Primera Ausente', 'employee', true, '8e000000-0000-0000-0000-0000000000aa'),
  ('8e000000-0000-0000-0000-000000000002', 'segunda-ausente@test.local', 'Segunda Ausente', 'employee', true, '8e000000-0000-0000-0000-0000000000aa');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online) values
  ('8e000000-0000-0000-0000-0000000000b1', '8e000000-0000-0000-0000-0000000000aa', 'Ausente 30', 30, 3000, true);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8e000000-0000-0000-0000-0000000000c1', 'Nuria', 'Novino', '1980-01-01', true),
  ('8e000000-0000-0000-0000-0000000000c2', 'Pablo', 'Llega', '1981-01-01', true);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('8e000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day3())::smallint, '09:00', '14:00');

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8e000000-0000-0000-0000-0000000000d1', '8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c1',
   '8e000000-0000-0000-0000-0000000000b1', pg_temp.ago('10:00'), pg_temp.ago('10:30'));
update public.appointments set status = 'no_show' where id = '8e000000-0000-0000-0000-0000000000d1';

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8e000000-0000-0000-0000-0000000000d2', '8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c2',
     '8e000000-0000-0000-0000-0000000000b1', pg_temp.ago('10:00'), pg_temp.ago('10:30'))
$$, 'when the patient does not come, the clinic can give that hour to someone else with the same professional');

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c1',
     '8e000000-0000-0000-0000-0000000000b1', pg_temp.ago('10:15'), pg_temp.ago('10:45'))
$$, '23P01', 'conflicting key value violates exclusion constraint "appointments_no_overlap"',
  'the appointment that took the slot still blocks the professional, so only the no-show is ignored');

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select appointment_id from public.pending_payments(pg_temp.ago('00:00')) order by starts_at $$,
  $$ values ('8e000000-0000-0000-0000-0000000000d2'::uuid) $$,
  'a no-show is not pending payment, so reception does not chase a patient who never came');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('8e000000-0000-0000-0000-000000000002');
select results_eq(
  $$ select starts_at from public.agenda_busy(pg_temp.ago('00:00'), pg_temp.ago('23:59'))
     where professional_id = '8e000000-0000-0000-0000-000000000001' $$,
  $$ values (pg_temp.ago('10:00')) $$,
  'colleagues see the hour busy once, for the patient who took it, not for the no-show');
reset role;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$ update public.appointments set status = 'scheduled' where id = '8e000000-0000-0000-0000-0000000000d1' $$,
  '23P01', 'conflicting key value violates exclusion constraint "appointments_no_overlap"',
  'undoing the no-show is refused once the hour was given to someone else, so two appointments never overlap');
select is((select status from public.appointments where id = '8e000000-0000-0000-0000-0000000000d1'),
  'no_show'::public.appointment_status, 'the refused undo leaves the appointment as a no-show');

update public.appointments set status = 'cancelled', cancelled_by = 'clinic' where id = '8e000000-0000-0000-0000-0000000000d2';
select lives_ok(
  $$ update public.appointments set status = 'scheduled' where id = '8e000000-0000-0000-0000-0000000000d1' $$,
  'undoing the no-show works when nobody else holds the hour');

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select appointment_id from public.pending_payments(pg_temp.ago('00:00')) $$,
  $$ values ('8e000000-0000-0000-0000-0000000000d1'::uuid) $$,
  'once the no-show is undone, the visit is pending payment again');
reset role;
select set_config('request.jwt.claims', '', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8e000000-0000-0000-0000-0000000000d3', '8e000000-0000-0000-0000-000000000001', '8e000000-0000-0000-0000-0000000000c1',
   '8e000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('10:00'), pg_temp.at_day3('10:30'));
select ok(not exists (
    select 1 from public._free_slots('8e000000-0000-0000-0000-0000000000b1', '8e000000-0000-0000-0000-000000000001',
      pg_temp.day3(), pg_temp.day3(), null) fs
    where fs.starts_at = pg_temp.at_day3('10:00')),
  'a scheduled appointment takes its hour out of the free slots');

set local session_replication_role = replica;
update public.appointments set status = 'no_show' where id = '8e000000-0000-0000-0000-0000000000d3';
set local session_replication_role = origin;
select ok(exists (
    select 1 from public._free_slots('8e000000-0000-0000-0000-0000000000b1', '8e000000-0000-0000-0000-000000000001',
      pg_temp.day3(), pg_temp.day3(), null) fs
    where fs.starts_at = pg_temp.at_day3('10:00')),
  'free slots only count scheduled appointments as busy, so a no-show still running past the booking notice gives its time back');
select ok(exists (
    select 1 from public.available_slots('8e000000-0000-0000-0000-0000000000b1', '8e000000-0000-0000-0000-000000000001',
      pg_temp.day3(), pg_temp.day3()) sl
    where sl.starts_at = pg_temp.at_day3('10:00')),
  'and the web booking slots follow the same rule');

select * from finish();
rollback;
