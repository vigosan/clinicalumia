begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner-svc@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'employee-svc@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'inactive-svc@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'owner-svc@test.local', 'Owner', 'owner', true),
  ('10000000-0000-0000-0000-000000000002', 'employee-svc@test.local', 'Employee', 'employee', true),
  ('10000000-0000-0000-0000-000000000003', 'inactive-svc@test.local', 'Inactive', 'employee', false);
insert into public.specialties (id, name, slug) values
  ('10000000-0000-0000-0000-0000000000aa', 'Svc test', 'svc-test');

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value)
  values ('10000000-0000-0000-0000-0000000000aa', 'Sesión 60', 60, 4500, 'exempt', true, 'fixed', 1000)
$$, 'the owner can create a service');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents, booking_payment, booking_payment_value)
  values ('10000000-0000-0000-0000-0000000000aa', 'Señal mayor que el precio', 30, 1000, 'fixed', 2000)
$$, '23514', null, 'a fixed deposit can never exceed the price');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents, booking_payment, booking_payment_value)
  values ('10000000-0000-0000-0000-0000000000aa', 'Porcentaje imposible', 30, 1000, 'percent', 150)
$$, '23514', null, 'a percentage deposit must be between 1 and 100');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents)
  values ('10000000-0000-0000-0000-0000000000aa', 'Sin duración', 0, 1000)
$$, '23514', null, 'a service needs a real duration');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents)
  values ('10000000-0000-0000-0000-0000000000aa', 'Sesión 60', 60, 4500)
$$, '23505', null, 'two services of the same specialty cannot share a name');

select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is((select count(*) from public.services where name = 'Sesión 60'), 1::bigint,
  'an active employee can read services, which the agenda will need');
select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents)
  values ('10000000-0000-0000-0000-0000000000aa', 'Intruso', 30, 1000)
$$, '42501', null, 'an employee cannot create services');

select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*) from public.services where name = 'Sesión 60'), 0::bigint,
  'a deactivated employee sees no services');

reset role;
select throws_ok($$ delete from public.specialties where id = '10000000-0000-0000-0000-0000000000aa' $$,
  '23503', null, 'a specialty with services cannot be deleted');

select * from finish();
rollback;
