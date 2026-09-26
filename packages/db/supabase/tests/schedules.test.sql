begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'owner-sched@test.local'),
  ('20000000-0000-0000-0000-000000000002', 'employee-sched@test.local'),
  ('20000000-0000-0000-0000-000000000003', 'inactive-sched@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('20000000-0000-0000-0000-000000000001', 'owner-sched@test.local', 'Owner', 'owner', true),
  ('20000000-0000-0000-0000-000000000002', 'employee-sched@test.local', 'Employee', 'employee', true),
  ('20000000-0000-0000-0000-000000000003', 'inactive-sched@test.local', 'Inactive', 'employee', false);

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002',
  '[{"weekday":1,"starts_at":"15:15","ends_at":"20:30"},{"weekday":2,"starts_at":"09:00","ends_at":"13:00"}]') $$,
  'the owner sets an employee weekly schedule in one call');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 2::bigint,
  'both blocks are stored');
select lives_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002',
  '[{"weekday":3,"starts_at":"10:00","ends_at":"14:00"}]') $$, 'saving again replaces the schedule');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 1::bigint,
  'the previous blocks are gone, not duplicated');
select throws_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002',
  '[{"weekday":4,"starts_at":"10:00","ends_at":"12:00"},{"weekday":4,"starts_at":"11:00","ends_at":"13:00"}]') $$,
  '23P01', null, 'overlapping blocks on the same day are rejected');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 1::bigint,
  'a rejected save leaves the previous schedule intact');
select throws_ok($$ insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
  values ('20000000-0000-0000-0000-000000000002', 5, '14:00', '10:00') $$, '23514', null,
  'a block must end after it starts');
select lives_ok($$ insert into public.employee_time_off (profile_id, starts_at, ends_at, reason)
  values ('20000000-0000-0000-0000-000000000002', '2026-12-24 00:00+01', '2026-12-26 23:59+01', 'Navidad') $$,
  'the owner records time off');

select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 1::bigint,
  'an active employee can read schedules');
select throws_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002', '[]') $$,
  '42501', null, 'an employee cannot change schedules, not even their own');

select pg_temp.act_as('20000000-0000-0000-0000-000000000003');
select is((select count(*) from public.employee_time_off), 0::bigint, 'a deactivated employee sees no time off');

select * from finish();
rollback;
