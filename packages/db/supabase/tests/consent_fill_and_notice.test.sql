begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('8a000000-0000-0000-0000-000000000001', 'empleada-completar@test.local'),
  ('8a000000-0000-0000-0000-000000000010', 'paciente-antelacion@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('8a000000-0000-0000-0000-000000000001', 'empleada-completar@test.local', 'Empleada Completar', 'employee', true);
insert into public.patient_accounts (id, email) values
  ('8a000000-0000-0000-0000-000000000010', 'paciente-antelacion@test.local');

insert into public.people (id, first_name, last_name, birth_date, tax_id, email, is_patient) values
  ('8a000000-0000-0000-0000-0000000000a1', 'Vacia', 'Ficha', null, null, null, false),
  ('8a000000-0000-0000-0000-0000000000a2', 'Llena', 'Ficha', '1970-01-01', '8A000002X', 'llena@test.local', true),
  ('8a000000-0000-0000-0000-0000000000a3', 'Menor', 'Ficha', null, null, null, false),
  ('8a000000-0000-0000-0000-0000000000a4', 'Antigua', 'Ficha', null, null, null, false),
  ('8a000000-0000-0000-0000-0000000000a5', 'Ocupado', 'Dni', '1960-01-01', '11111111H', null, true),
  ('8a000000-0000-0000-0000-0000000000a6', 'Otra', 'Ficha', null, null, null, false),
  ('8a000000-0000-0000-0000-0000000000a7', 'Hija', 'Ficha', null, null, null, false),
  ('8a000000-0000-0000-0000-0000000000c1', 'Paciente', 'Antelacion', '1990-01-01', null, 'paciente-antelacion@test.local', true);

insert into public.consents (id, signed_at, first_name, last_name, birth_date, tax_id, guardian_tax_id, email, guardian_name, marketing, media_for_training, pdf_path) values
  ('8a000000-0000-0000-0000-0000000000f1', now(), 'Vacia', 'Ficha', '1985-03-03', '12345678Z', null, 'Vacia@Test.local', '', false, false, '2026/10/f1.pdf'),
  ('8a000000-0000-0000-0000-0000000000f2', now(), 'Llena', 'Ficha', '1985-03-03', '12345678Z', null, 'otra@test.local', '', false, false, '2026/10/f2.pdf'),
  ('8a000000-0000-0000-0000-0000000000f3', now(), 'Menor', 'Ficha', '2016-03-03', null, 'X1234567L', 'tutor@test.local', 'Tutor Ficha', false, false, '2026/10/f3.pdf'),
  ('8a000000-0000-0000-0000-0000000000f4', now(), 'Antigua', 'Ficha', '2016-03-03', '87654321X', null, null, 'Tutora Antigua', false, false, '2026/10/f4.pdf'),
  ('8a000000-0000-0000-0000-0000000000f5', now(), 'Otra', 'Ficha', '1985-03-03', '11111111H', null, null, '', false, false, '2026/10/f5.pdf'),
  ('8a000000-0000-0000-0000-0000000000f6', now(), 'Otra', 'Ficha', '1985-03-03', '22222222J', null, null, '', false, false, '2026/10/f6.pdf'),
  ('8a000000-0000-0000-0000-0000000000f7', now(), 'Hija', 'Ficha', '2016-03-03', null, 'Y1234567X', 'madre@test.local', 'Madre Ficha', false, false, '2026/10/f7.pdf');

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

select has_column('public', 'consents', 'guardian_tax_id',
  'a minor''s consent keeps the guardian''s DNI apart from the patient''s');
select col_is_null('public', 'consents', 'tax_id',
  'a minor without a DNI can still sign through the guardian');
select throws_ok(
  $$ insert into public.consents (signed_at, first_name, last_name, birth_date, tax_id, guardian_tax_id, marketing, media_for_training, pdf_path)
     values (now(), 'Sin', 'Nada', '1985-03-03', null, null, false, false, 'x.pdf') $$,
  '23514', null, 'a consent always carries at least one DNI, the patient''s or the guardian''s');
select is((select search_text from public.consents where id = '8a000000-0000-0000-0000-0000000000f3'), 'menor ficha x1234567l',
  'staff find a minor''s consent by the guardian''s DNI too, even when the minor has none');
select is((select search_text from public.consents where id = '8a000000-0000-0000-0000-0000000000f1'), 'vacia ficha 12345678z',
  'an adult''s consent is still found by name and DNI');

select is(has_function_privilege('anon', 'public.link_consent(uuid, uuid, text[])', 'execute'), false,
  'an anonymous visitor cannot link consents nor fill records from them');
select is(has_function_privilege('authenticated', 'public.link_consent(uuid, uuid, text[])', 'execute'), true,
  'signed-in staff can call it, and the function then checks they are active staff');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001', 'aal1');
select throws_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f1', '8a000000-0000-0000-0000-0000000000a1', array['tax_id']) $$,
  '42501', null, 'an employee without the second factor cannot link nor fill a record');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f1', '8a000000-0000-0000-0000-0000000000a1', array['tax_id', 'email', 'birth_date']) $$,
  'an active employee links a consent and fills the record''s missing DNI, email and birth date');
reset role;
select results_eq(
  $$ select tax_id, email, birth_date from public.people where id = '8a000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('12345678Z'::text, 'vacia@test.local'::text, '1985-03-03'::date) $$,
  'the record now has the consent''s DNI, email and birth date, so the full invoice no longer asks for the DNI by hand');
select results_eq(
  $$ select link_method::text, linked_by from public.consents where id = '8a000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('manual'::text, '8a000000-0000-0000-0000-000000000001'::uuid) $$,
  'the link is recorded as manual and by whom, like any other link');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f2', '8a000000-0000-0000-0000-0000000000a2', array['tax_id', 'email', 'birth_date']) $$,
  'filling a record that already has every field still links the consent');
reset role;
select results_eq(
  $$ select tax_id, email, birth_date from public.people where id = '8a000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('8A000002X'::text, 'llena@test.local'::text, '1970-01-01'::date) $$,
  'a consent never overwrites what the record already has');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f3', '8a000000-0000-0000-0000-0000000000a3', array['tax_id', 'birth_date']) $$,
  'an active employee links a minor''s consent asking to fill the DNI');
reset role;
select results_eq(
  $$ select tax_id, birth_date from public.people where id = '8a000000-0000-0000-0000-0000000000a3' $$,
  $$ values (null::text, '2016-03-03'::date) $$,
  'the guardian''s DNI never goes into the minor''s record; the birth date does');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f7', '8a000000-0000-0000-0000-0000000000a7', array['email']) $$,
  'an active employee links a minor''s consent asking to fill the email');
reset role;
select is((select email from public.people where id = '8a000000-0000-0000-0000-0000000000a7'), null,
  'a minor''s consent never puts the signer''s email on the minor''s record, so the child does not stay in the parent''s account after 18');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f4', '8a000000-0000-0000-0000-0000000000a4', array['tax_id']) $$,
  'a consent signed before the guardian''s DNI had its own field still links');
reset role;
select is((select tax_id from public.people where id = '8a000000-0000-0000-0000-0000000000a4'), null,
  'an older minor''s consent whose single DNI may be the guardian''s never fills the minor''s DNI');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f5', '8a000000-0000-0000-0000-0000000000a6', array['tax_id']) $$,
  'P0001', 'tax_id_taken', 'a DNI that is already on another record is refused with a clear code');
select throws_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f6', '8a000000-0000-0000-0000-0000000000a6', array['phone']) $$,
  'P0001', 'invalid_fill_field', 'only the DNI, the email and the birth date can be filled from a consent');
reset role;
select is((select person_id from public.consents where id = '8a000000-0000-0000-0000-0000000000f5'), null,
  'a refused fill does not leave the consent half linked');
select is((select tax_id from public.people where id = '8a000000-0000-0000-0000-0000000000a6'), null,
  'a refused fill does not change the record');

select pg_temp.act_as('8a000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('8a000000-0000-0000-0000-0000000000f6', '8a000000-0000-0000-0000-0000000000a6', array[]::text[]) $$,
  'linking without filling anything leaves the record as it was');
reset role;
select is((select tax_id from public.people where id = '8a000000-0000-0000-0000-0000000000a6'), null,
  'without asking to fill, the record keeps its empty DNI');

insert into public.specialties (id, name, slug) values
  ('8a000000-0000-0000-0000-0000000000aa', 'Antelación test', 'antelacion-test');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online, cancellation_hours) values
  ('8a000000-0000-0000-0000-0000000000b1', '8a000000-0000-0000-0000-0000000000aa', 'Con plazo propio', 45, 4000, true, 48),
  ('8a000000-0000-0000-0000-0000000000b2', '8a000000-0000-0000-0000-0000000000aa', 'Con plazo de la clínica', 45, 4000, true, null);

select is((select cancellation_hours from public.booking_catalog() where service_id = '8a000000-0000-0000-0000-0000000000b1'), 48,
  'the catalog says how long before a service can still be changed, so the summary shows it before confirming');
select is((select cancellation_hours from public.booking_catalog() where service_id = '8a000000-0000-0000-0000-0000000000b2'),
  (select cancellation_hours from public.clinic_settings),
  'a service without its own deadline uses the clinic''s');
select is(pg_get_function_result('public.booking_catalog()'::regprocedure),
  'TABLE(specialty_id uuid, specialty_name text, service_id uuid, service_name text, duration_minutes integer, price_cents integer, bookable_online boolean, phone_only boolean, professionals jsonb, cancellation_hours integer)',
  'the catalog still exposes only names and booking rules, never an email, a phone or a note');

update public.clinic_settings set booking_min_notice_hours = 168;
select pg_temp.act_as('8a000000-0000-0000-0000-000000000010', 'aal1');
select throws_ok($$
  select public.book_appointment('8a000000-0000-0000-0000-0000000000c1', '8a000000-0000-0000-0000-0000000000b1',
    null, date_trunc('hour', now()) + interval '3 days')
$$, 'P0001', 'slot_too_soon', 'a slot inside the minimum notice is refused with its own code, so the patient learns why');
reset role;
select set_config('request.jwt.claims', '', true);

update public.clinic_settings set booking_min_notice_hours = 0;
select pg_temp.act_as('8a000000-0000-0000-0000-000000000010', 'aal1');
select throws_ok($$
  select public.book_appointment('8a000000-0000-0000-0000-0000000000c1', '8a000000-0000-0000-0000-0000000000b1',
    null, date_trunc('hour', now()) + interval '3 days')
$$, 'P0001', 'slot_not_available', 'a slot outside the minimum notice that nobody can take is still just not available');
reset role;
select set_config('request.jwt.claims', '', true);
update public.clinic_settings set booking_min_notice_hours = 24;

select is((select count(*) from public.appointments where patient_id = '8a000000-0000-0000-0000-0000000000c1'), 0::bigint,
  'neither refusal creates an appointment');

select * from finish();
rollback;
