begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('86000000-0000-0000-0000-000000000001', 'equipo-acompanante@test.local'),
  ('86000000-0000-0000-0000-000000000010', 'cuenta-acompanante@test.local'),
  ('86000000-0000-0000-0000-000000000011', 'otra-acompanante@test.local'),
  ('86000000-0000-0000-0000-000000000012', 'sin-cuenta-acompanante@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('86000000-0000-0000-0000-000000000001', 'equipo-acompanante@test.local', 'Equipo', 'employee', true);
insert into public.patient_accounts (id, email) values
  ('86000000-0000-0000-0000-000000000010', 'cuenta-acompanante@test.local'),
  ('86000000-0000-0000-0000-000000000011', 'otra-acompanante@test.local');
insert into public.people (id, first_name, last_name, birth_date, email, is_patient, archived_at) values
  ('86000000-0000-0000-0000-0000000000c1', 'Rosa', 'Sin Fecha', null, 'cuenta-acompanante@test.local', false, null),
  ('86000000-0000-0000-0000-0000000000c2', 'Pablo', 'Sin Fecha', null, 'cuenta-acompanante@test.local', false, null),
  ('86000000-0000-0000-0000-0000000000c3', 'Ajena', 'Sin Fecha', null, 'otra-acompanante@test.local', false, null),
  ('86000000-0000-0000-0000-0000000000c4', 'Archivada', 'Sin Fecha', null, 'cuenta-acompanante@test.local', false, now()),
  ('86000000-0000-0000-0000-0000000000c5', 'Con', 'Fecha', '1970-05-05', 'cuenta-acompanante@test.local', false, null);

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

select is((select prosecdef from pg_proc where oid = 'public.complete_my_birth_date(uuid, date)'::regprocedure), true,
  'complete_my_birth_date runs as definer, because patients have no write policy on people');
select is((select proconfig from pg_proc where oid = 'public.complete_my_birth_date(uuid, date)'::regprocedure),
  array['search_path=""'], 'complete_my_birth_date pins an empty search_path so nobody can shadow the tables it writes');
select is(has_function_privilege('anon', 'public.complete_my_birth_date(uuid, date)', 'execute'), false,
  'an anonymous visitor cannot change anybody''s birth date');
select is(has_function_privilege('authenticated', 'public.complete_my_birth_date(uuid, date)', 'execute'), true,
  'a signed-in patient can complete a birth date of her account');

select pg_temp.act_as_patient('86000000-0000-0000-0000-000000000012');
select throws_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c1', '1960-03-01') $$,
  '42501', 'patient_account_required', 'a user without a patient account cannot complete anybody''s birth date');
select pg_temp.act_as('86000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c1', '1960-03-01') $$,
  '42501', 'patient_account_required', 'the team edits people from the dashboard, never through the patient function');

select pg_temp.act_as_patient('86000000-0000-0000-0000-000000000010');
select lives_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c1', '1960-03-01') $$,
  'the account completes the birth date of a companion the clinic saved without one');
select throws_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c1', '1961-04-02') $$,
  'P0001', 'person_not_in_account', 'a birth date already known cannot be rewritten from the web');
select throws_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c5', '1971-06-06') $$,
  'P0001', 'person_not_in_account', 'a person who already has a birth date keeps it');
select throws_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c3', '1960-03-01') $$,
  'P0001', 'person_not_in_account', 'a person of another account cannot be touched by guessing her id');
select throws_ok($$ select public.complete_my_birth_date('86000000-0000-0000-0000-0000000000c4', '1960-03-01') $$,
  'P0001', 'person_not_in_account', 'an archived person is no longer part of the account');
select throws_ok(
  format('select public.complete_my_birth_date(%L, %L)', '86000000-0000-0000-0000-0000000000c2',
    (now() at time zone 'Europe/Madrid')::date + 1),
  '23514', 'birth_date must not be in the future', 'the people trigger still refuses a birth date in the future');
reset role;

select is((select birth_date from public.people where id = '86000000-0000-0000-0000-0000000000c1'), '1960-03-01'::date,
  'the completed birth date is stored on the same person, so no duplicate is created');
select is((select count(*) from public.people where birth_date is null and id in (
  '86000000-0000-0000-0000-0000000000c2', '86000000-0000-0000-0000-0000000000c3', '86000000-0000-0000-0000-0000000000c4')),
  3::bigint, 'the refused calls leave every other person without birth date untouched');

select * from finish();
rollback;
