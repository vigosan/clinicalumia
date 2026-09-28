begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('70000000-0000-0000-0000-000000000001', 'owner-directory@test.local'),
  ('70000000-0000-0000-0000-000000000002', 'a-directory@test.local'),
  ('70000000-0000-0000-0000-000000000003', 'b-directory@test.local'),
  ('70000000-0000-0000-0000-000000000004', 'inactive-directory@test.local');
insert into public.specialties (id, name, slug) values
  ('70000000-0000-0000-0000-0000000000aa', 'Directorio test', 'directorio-test');
insert into public.profiles (id, email, full_name, role, specialty_id, is_active) values
  ('70000000-0000-0000-0000-000000000001', 'owner-directory@test.local', 'Owner', 'owner', null, true),
  ('70000000-0000-0000-0000-000000000002', 'a-directory@test.local', 'Empleada A', 'employee', '70000000-0000-0000-0000-0000000000aa', true),
  ('70000000-0000-0000-0000-000000000003', 'b-directory@test.local', 'Empleada B', 'employee', '70000000-0000-0000-0000-0000000000aa', true),
  ('70000000-0000-0000-0000-000000000004', 'inactive-directory@test.local', 'Inactiva', 'employee', '70000000-0000-0000-0000-0000000000aa', false);

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

select is(pg_get_function_result('public.staff_directory()'::regprocedure),
  'TABLE(id uuid, full_name text, role user_role, specialty_id uuid)',
  'staff_directory exposes only name, role and specialty, never email or license number');

select pg_temp.act_as('70000000-0000-0000-0000-000000000002');
select is((select count(*) from public.staff_directory()
  where id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000004')), 3::bigint,
  'an active employee sees every active colleague, including their own row, but not the deactivated one');
select is((select count(*) from public.staff_directory() where id = '70000000-0000-0000-0000-000000000004'), 0::bigint,
  'a deactivated colleague never appears in the directory');

select pg_temp.act_as('70000000-0000-0000-0000-000000000004');
select throws_ok($$ select * from public.staff_directory() $$,
  '42501', 'staff_directory_forbidden', 'a deactivated employee cannot read the team directory either');

select pg_temp.act_as('70000000-0000-0000-0000-000000000002', 'aal1');
select throws_ok($$ select * from public.staff_directory() $$,
  '42501', 'staff_directory_forbidden', 'aal1 is not enough to read the team directory, even for an active employee');

select is(has_function_privilege('anon', 'public.staff_directory()', 'execute'), false,
  'anon cannot call staff_directory at all');
select is(has_function_privilege('authenticated', 'public.staff_directory()', 'execute'), true,
  'authenticated can call staff_directory, since its own logic gates access by role and session');

select * from finish();
rollback;
