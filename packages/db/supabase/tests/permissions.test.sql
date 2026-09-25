begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'employee@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'inactive@test.local'),
  ('00000000-0000-0000-0000-000000000004', 'nobody@test.local');

insert into public.profiles (id, email, full_name, role, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'owner@test.local', 'Owner', 'owner', true),
  ('00000000-0000-0000-0000-000000000002', 'employee@test.local', 'Employee', 'employee', true),
  ('00000000-0000-0000-0000-000000000003', 'inactive@test.local', 'Inactive', 'employee', false);

insert into public.specialties (name, slug) values ('Prueba', 'prueba');

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.act_as('00000000-0000-0000-0000-000000000004');
select is((select count(*) from public.specialties where slug = 'prueba'), 0::bigint,
  'someone signed in without a profile sees no clinic data');

select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.specialties where slug = 'prueba'), 0::bigint,
  'a deactivated employee with a valid token sees nothing');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.specialties where slug = 'prueba'), 1::bigint,
  'an active employee can read clinic configuration');
select throws_ok($$ insert into public.specialties (name, slug) values ('X', 'x') $$, '42501', null,
  'an employee cannot change clinic configuration');

select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.specialties (name, slug) values ('Y', 'y') $$,
  'the active owner can change clinic configuration');

reset role;
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.specialties (name, slug) values ('Z', 'z') $$, '42501', null,
  'a deactivated owner loses write access');

reset role;
select is((select column_default from information_schema.columns
           where table_name = 'profiles' and column_name = 'role'), '''employee''::user_role',
  'new team members default to employee');

select * from finish();
rollback;
