begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

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

create or replace function pg_temp.day(n int) returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date + n
$$;

create or replace function pg_temp.at(d date, wall time) returns timestamptz language sql stable as $$
  select (d::timestamp + wall) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.clock_change_day() returns date language sql stable as $$
  select min(last_sunday)
  from (
    select make_date(y, m, 31) - extract(dow from make_date(y, m, 31))::int as last_sunday
    from generate_series(extract(year from pg_temp.day(0))::int, extract(year from pg_temp.day(0))::int + 1) as y,
      unnest(array[3, 10]) as m
  ) sundays
  where last_sunday > pg_temp.day(9)
$$;

create or replace function pg_temp.slots(d_from date, d_to date) returns bigint language sql stable as $$
  select count(*) from public.available_slots('8d000000-0000-0000-0000-0000000000b1', null, d_from, d_to)
$$;

create or replace function pg_temp.web_id() returns uuid language sql stable security definer as $$
  select id from public.appointments where patient_id = '8d000000-0000-0000-0000-0000000000c1' and origin = 'web'
$$;

insert into auth.users (id, email) values
  ('8d000000-0000-0000-0000-000000000001', 'owner-cierres@test.local'),
  ('8d000000-0000-0000-0000-000000000002', 'empleada-cierres@test.local'),
  ('8d000000-0000-0000-0000-000000000010', 'paciente-cierres@test.local');
insert into public.specialties (id, name, slug) values
  ('8d000000-0000-0000-0000-0000000000aa', 'Cierres test', 'cierres-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8d000000-0000-0000-0000-000000000001', 'owner-cierres@test.local', 'Owner Cierres', 'owner', true, null),
  ('8d000000-0000-0000-0000-000000000002', 'empleada-cierres@test.local', 'Empleada Cierres', 'employee', true, '8d000000-0000-0000-0000-0000000000aa');
insert into public.patient_accounts (id, email) values
  ('8d000000-0000-0000-0000-000000000010', 'paciente-cierres@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, cancellation_hours) values
  ('8d000000-0000-0000-0000-0000000000b1', '8d000000-0000-0000-0000-0000000000aa', 'Cierres 30 minutos', 30, 3000, true, 24);
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('8d000000-0000-0000-0000-0000000000c1', 'Ana', 'Cierres', '1980-01-01', 'paciente-cierres@test.local', true);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
select '8d000000-0000-0000-0000-000000000002', wd, '00:00', '24:00'
from generate_series(1, 7) as wd;
update public.clinic_settings set booking_horizon_days = 365;

select has_table('public', 'clinic_closures', 'the clinic keeps its closed days in their own table');
select ok(pg_temp.slots(pg_temp.day(3), pg_temp.day(3)) > 0, 'before any closure the day to close offers slots, so the checks below are not vacuous');
select ok(pg_temp.slots(pg_temp.day(5), pg_temp.day(7)) > 0, 'before any closure the holiday range offers slots');
select ok(pg_temp.slots(pg_temp.clock_change_day(), pg_temp.clock_change_day()) > 0,
  format('before any closure the clock-change day %s offers slots', pg_temp.clock_change_day()));

select pg_temp.act_as_patient('8d000000-0000-0000-0000-000000000010');
select public.book_appointment('8d000000-0000-0000-0000-0000000000c1', '8d000000-0000-0000-0000-0000000000b1',
  '8d000000-0000-0000-0000-000000000002', pg_temp.at(pg_temp.day(4), '10:00'));
select is((select count(*) from unnest(array[pg_temp.day(3), pg_temp.day(6), pg_temp.clock_change_day()]) as d
    where exists (select 1 from public.my_reschedule_slots(pg_temp.web_id(), d, d) s where s.starts_at = pg_temp.at(d, '12:00'))),
  3::bigint, 'before any closure the patient could move her appointment to each day about to be closed, so the rejections below are not vacuous');

select pg_temp.act_as('8d000000-0000-0000-0000-000000000001');
select lives_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Festivo local') $$,
  pg_temp.day(3), pg_temp.day(3)), 'the owner closes a single day');
select lives_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Vacaciones') $$,
  pg_temp.day(5), pg_temp.day(7)), 'the owner closes several days in a row');
select lives_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Cambio de hora') $$,
  pg_temp.clock_change_day(), pg_temp.clock_change_day()), format('the owner closes the clock-change day %s', pg_temp.clock_change_day()));
select lives_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Puente') $$,
  pg_temp.day(2), pg_temp.day(2)), 'a closure right next to another one is allowed, because both ends are whole days');
select is((select created_by from public.clinic_closures where reason = 'Festivo local'), '8d000000-0000-0000-0000-000000000001'::uuid,
  'each closure remembers who created it');
select throws_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Solape') $$,
  pg_temp.day(7), pg_temp.day(9)), '23P01', null, 'a closure sharing even one day with another is rejected, so a day never has two reasons');
select throws_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Repetido') $$,
  pg_temp.day(3), pg_temp.day(3)), '23P01', null, 'the same day cannot be closed twice');
select throws_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Al revés') $$,
  pg_temp.day(12), pg_temp.day(11)), '23514', null, 'a closure cannot end before it starts');
select throws_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, '   ') $$,
  pg_temp.day(11), pg_temp.day(11)), '23514', null, 'a blank reason is rejected because the team sees it in the agenda');
select throws_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, %L) $$,
  pg_temp.day(11), pg_temp.day(11), repeat('a', 81)), '23514', null, 'a reason longer than 80 characters is rejected');
select lives_ok($$ update public.clinic_closures set reason = 'Festivo de la ciudad' where reason = 'Festivo local' $$,
  'the owner can correct a reason');
select lives_ok($$ delete from public.clinic_closures where reason = 'Puente' $$, 'the owner can remove a closure');
select is((select count(*) from public.clinic_closures)::bigint, 3::bigint, 'the removed closure is gone');

select pg_temp.act_as('8d000000-0000-0000-0000-000000000002');
select is((select count(*) from public.clinic_closures)::bigint, 3::bigint, 'an active employee sees every closure to plan her agenda');
select throws_ok(format($$ insert into public.clinic_closures (starts_on, ends_on, reason) values (%L, %L, 'Empleada') $$,
  pg_temp.day(11), pg_temp.day(11)), '42501', null, 'an employee cannot close the clinic');
update public.clinic_closures set reason = 'Cambiado por empleada';
delete from public.clinic_closures;
select lives_ok(format($$ insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values (
    '8d000000-0000-0000-0000-000000000002', '8d000000-0000-0000-0000-0000000000c1', '8d000000-0000-0000-0000-0000000000b1', %L, %L) $$,
  pg_temp.at(pg_temp.day(3), '11:00'), pg_temp.at(pg_temp.day(3), '11:30')),
  'the team can still give an appointment on a closed day for exceptional cases');
reset role;
select is((select string_agg(reason, ',' order by starts_on) from public.clinic_closures), 'Festivo de la ciudad,Vacaciones,Cambio de hora',
  'an employee can neither change nor remove closures');

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select count(*) from public.clinic_closures $$, '42501', null,
  'anonymous visitors cannot read the clinic''s closures');
select is(pg_temp.slots(pg_temp.day(3), pg_temp.day(3)), 0::bigint, 'the web offers no slot on a closed day');
select is(pg_temp.slots(pg_temp.day(5), pg_temp.day(5)), 0::bigint, 'the first day of a multi-day closure has no slot');
select is(pg_temp.slots(pg_temp.day(6), pg_temp.day(6)), 0::bigint, 'the middle day of a multi-day closure has no slot');
select is(pg_temp.slots(pg_temp.day(7), pg_temp.day(7)), 0::bigint, 'the last day of a multi-day closure has no slot');
select is(pg_temp.slots(pg_temp.clock_change_day(), pg_temp.clock_change_day()), 0::bigint,
  format('a closure on the clock-change day %s leaves no slot in its 23 or 25 hours', pg_temp.clock_change_day()));
select ok(pg_temp.slots(pg_temp.day(4), pg_temp.day(4)) > 0, 'a day between closures still offers slots');
select ok(pg_temp.slots(pg_temp.day(8), pg_temp.day(8)) > 0, 'the day after a multi-day closure still offers slots');
select ok(pg_temp.slots(pg_temp.day(2), pg_temp.day(2)) > 0, 'removing a closure gives its day back to the web');
select ok(pg_temp.slots(pg_temp.clock_change_day() + 1, pg_temp.clock_change_day() + 1) > 0, 'the day after the clock change is open again');
select ok(exists (select 1 from public.available_slots('8d000000-0000-0000-0000-0000000000b1', null, pg_temp.day(2), pg_temp.day(2)) s
    where s.starts_at = pg_temp.at(pg_temp.day(2), '23:30')),
  'a slot ending exactly at midnight before a closed day is still offered');
select ok(exists (select 1 from public.available_slots('8d000000-0000-0000-0000-0000000000b1', null, pg_temp.day(4), pg_temp.day(4)) s
    where s.starts_at = pg_temp.at(pg_temp.day(4), '00:00')),
  'a slot starting exactly at midnight after a closed day is offered');
select is((select count(*) from public.available_slots('8d000000-0000-0000-0000-0000000000b1', null, pg_temp.day(2), pg_temp.day(8)) s
    where (s.starts_at at time zone 'Europe/Madrid')::date in (pg_temp.day(3), pg_temp.day(5), pg_temp.day(6), pg_temp.day(7))),
  0::bigint, 'a week-long search skips every closed day');

reset role;
select pg_temp.act_as_patient('8d000000-0000-0000-0000-000000000010');
select is((select count(*) from public.clinic_closures)::bigint, 0::bigint,
  'a signed-in patient cannot read the clinic''s closures, only the slots that remain');
select throws_ok(format($$ select public.book_appointment(%L, %L, %L, %L) $$,
  '8d000000-0000-0000-0000-0000000000c1', '8d000000-0000-0000-0000-0000000000b1', '8d000000-0000-0000-0000-000000000002',
  pg_temp.at(pg_temp.day(3), '12:00')), 'P0001', 'slot_not_available',
  'a patient cannot book a closed day even calling the function directly');
select is((select count(*) from public.my_reschedule_slots(pg_temp.web_id(), pg_temp.day(2), pg_temp.day(8)) s
    where (s.starts_at at time zone 'Europe/Madrid')::date in (pg_temp.day(3), pg_temp.day(5), pg_temp.day(6), pg_temp.day(7))),
  0::bigint, 'the patient area offers no closed day to move an appointment to');
select ok((select count(*) from public.my_reschedule_slots(pg_temp.web_id(), pg_temp.day(8), pg_temp.day(8))) > 0,
  'the patient area still offers open days to move an appointment to');
select is((select count(*) from public.my_reschedule_slots(pg_temp.web_id(), pg_temp.clock_change_day(), pg_temp.clock_change_day())),
  0::bigint, 'the patient area offers nothing on a closed clock-change day');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at(pg_temp.day(3), '12:00')),
  'P0001', 'slot_not_available', 'moving an appointment into a closed day is rejected even calling the function directly');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at(pg_temp.day(6), '12:00')),
  'P0001', 'slot_not_available', 'moving an appointment into the middle of a multi-day closure is rejected');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id(), pg_temp.at(pg_temp.clock_change_day(), '12:00')),
  'P0001', 'slot_not_available', format('moving an appointment into the closed clock-change day %s is rejected', pg_temp.clock_change_day()));
select is(public.reschedule_my_appointment(pg_temp.web_id(), pg_temp.at(pg_temp.day(8), '10:00')), pg_temp.web_id(),
  'moving an appointment to an open day still works');
reset role;
select is((select starts_at from public.appointments where id = pg_temp.web_id()), pg_temp.at(pg_temp.day(8), '10:00'),
  'the appointment ends up on the open day');

select * from finish();
rollback;
