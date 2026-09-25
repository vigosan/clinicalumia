begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000003'), 0::bigint,
  'a deactivated user cannot read their own profile');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.specialties where slug = 'prueba'), 1::bigint,
  'an active employee can read clinic configuration');
select is((select count(*) from public.profiles where id <> '00000000-0000-0000-0000-000000000002'), 0::bigint,
  'an active employee cannot read other people''s profiles');

update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-000000000002';
reset role;
select is((select role from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'employee'::user_role,
  'an active employee cannot change their own role to owner');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000002';
reset role;
select is((select is_active from public.profiles where id = '00000000-0000-0000-0000-000000000002'), true,
  'an active employee cannot reactivate/deactivate themselves');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.specialties (name, slug) values ('X', 'x') $$, '42501', null,
  'an employee cannot change clinic configuration');

select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.specialties (name, slug) values ('Y', 'y') $$,
  'the active owner can change clinic configuration');

select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 1::bigint,
  'an active owner can read another member''s profile');

update public.profiles set full_name = 'Actualizado por owner' where id = '00000000-0000-0000-0000-000000000002';
reset role;
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'Actualizado por owner',
  'an active owner can update another member''s profile');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
update public.specialties set name = 'Hackeada' where slug = 'prueba';
reset role;
select is((select name from public.specialties where slug = 'prueba'), 'Prueba',
  'an active employee cannot update a specialty');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
delete from public.specialties where slug = 'prueba';
reset role;
select is((select count(*) from public.specialties where slug = 'prueba'), 1::bigint,
  'an active employee cannot delete a specialty');

reset role;
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.profiles where id <> '00000000-0000-0000-0000-000000000001'), 0::bigint,
  'a deactivated owner cannot read other profiles');

update public.profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-000000000002';
reset role;
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'Actualizado por owner',
  'a deactivated owner cannot update another profile');

select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.specialties (name, slug) values ('Z', 'z') $$, '42501', null,
  'a deactivated owner loses write access');

reset role;
select is((select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'), '''employee''::user_role',
  'new team members default to employee');

select * from finish();
rollback;
