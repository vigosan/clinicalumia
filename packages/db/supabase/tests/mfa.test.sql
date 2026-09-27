begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'owner-mfa@test.local'),
  ('40000000-0000-0000-0000-000000000002', 'employee-mfa@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('40000000-0000-0000-0000-000000000001', 'owner-mfa@test.local', 'Owner', 'owner', true),
  ('40000000-0000-0000-0000-000000000002', 'employee-mfa@test.local', 'Employee', 'employee', true);
insert into public.specialties (id, name, slug) values
  ('40000000-0000-0000-0000-0000000000aa', 'Mfa test', 'mfa-test');
insert into public.services (specialty_id, name, duration_minutes, price_cents) values
  ('40000000-0000-0000-0000-0000000000aa', 'Sesión mfa', 30, 1000);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('40000000-0000-0000-0000-000000000002', 1, '09:00', '10:00');

create or replace function pg_temp.act_as(user_id uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

select pg_temp.act_as('40000000-0000-0000-0000-000000000002', 'aal1');
select is((select count(*) from public.specialties), 0::bigint,
  'a password-only session cannot read specialties, since the second factor is what unlocks clinic data');
select is((select count(*) from public.services), 0::bigint,
  'a password-only session cannot read services');
select is((select count(*) from public.employee_schedules), 0::bigint,
  'a password-only session cannot read schedules');
select is((select count(*) from public.clinic_settings), 0::bigint,
  'a password-only session cannot read clinic settings');
select is((select count(*) from public.profiles), 0::bigint,
  'a password-only session cannot even read its own profile');

select pg_temp.act_as('40000000-0000-0000-0000-000000000001', 'aal1');
select is(public.is_owner(), false,
  'is_owner requires the second factor, even for the owner role');
select is(public.is_active_staff(), false,
  'is_active_staff requires the second factor, even for an active profile');
select throws_ok($$ select public.set_employee_schedule('40000000-0000-0000-0000-000000000002', '[]') $$,
  '42501', null, 'a password-only session cannot change schedules, not even the owner''s');
select lives_ok($$ update public.clinic_settings set legal_name = 'Intento sin segundo factor' $$,
  'RLS silently filters the update instead of raising, so the statement does not error');

reset role;
select isnt((select legal_name from public.clinic_settings), 'Intento sin segundo factor',
  'the update above changed zero rows: aal1 is not enough, even for the owner');

select pg_temp.act_as('40000000-0000-0000-0000-000000000002');
select is((select count(*) from public.specialties), 4::bigint,
  'a verified active employee can read specialties again with the second factor');
select is((select count(*) from public.services), 7::bigint,
  'a verified active employee can read services');
select is((select count(*) from public.employee_schedules), 18::bigint,
  'a verified active employee can read schedules');
select is((select count(*) from public.clinic_settings), 1::bigint,
  'a verified active employee can read clinic settings');
select is((select count(*) from public.profiles where id = '40000000-0000-0000-0000-000000000002'), 1::bigint,
  'a verified active employee can read their own profile');

select pg_temp.act_as('40000000-0000-0000-0000-000000000001');
select is(public.is_owner(), true,
  'is_owner returns true once the owner has verified the second factor');
select lives_ok($$ update public.clinic_settings set legal_name = 'Datos con segundo factor' $$,
  'the owner can update clinic settings once verified with the second factor');
select is((select legal_name from public.clinic_settings), 'Datos con segundo factor',
  'the update by a verified owner is persisted');

reset role;
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('40000000-0000-0000-0000-0000000000f1', '40000000-0000-0000-0000-000000000002', now(), now()),
  ('40000000-0000-0000-0000-0000000000f2', '40000000-0000-0000-0000-000000000001', now(), now());

select pg_temp.act_as('40000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.revoke_user_sessions('40000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'an authenticated owner cannot call revoke_user_sessions directly, even at aal2');

select pg_temp.act_as('40000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.revoke_user_sessions('40000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'an authenticated employee cannot call revoke_user_sessions either');

reset role;
select set_config('role', 'service_role', true);
select public.revoke_user_sessions('40000000-0000-0000-0000-000000000002');
reset role;
select is((select count(*) from auth.sessions where user_id = '40000000-0000-0000-0000-000000000002'), 0::bigint,
  'revoke_user_sessions removes every session belonging to the target user');
select is((select count(*) from auth.sessions where user_id = '40000000-0000-0000-0000-000000000001'), 1::bigint,
  'revoke_user_sessions leaves other users'' sessions untouched');

select * from finish();
rollback;
