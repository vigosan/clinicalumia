begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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

create or replace function pg_temp.at_madrid(days integer, wall time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date + days)::timestamp + wall) at time zone 'Europe/Madrid'
$$;

insert into auth.users (id, email) values
  ('8f000000-0000-0000-0000-000000000001', 'propietaria-huerfanas@test.local'),
  ('8f000000-0000-0000-0000-000000000002', 'saliente-huerfanas@test.local'),
  ('8f000000-0000-0000-0000-000000000003', 'companera-huerfanas@test.local'),
  ('8f000000-0000-0000-0000-000000000004', 'otra-especialidad-huerfanas@test.local'),
  ('8f000000-0000-0000-0000-000000000005', 'inactiva-huerfanas@test.local'),
  ('8f000000-0000-0000-0000-000000000006', 'sin-citas-huerfanas@test.local');
insert into public.specialties (id, name, slug) values
  ('8f000000-0000-0000-0000-0000000000aa', 'Huérfanas test', 'huerfanas-test'),
  ('8f000000-0000-0000-0000-0000000000bb', 'Otra huérfanas test', 'otra-huerfanas-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8f000000-0000-0000-0000-000000000001', 'propietaria-huerfanas@test.local', 'Propietaria Huérfanas', 'owner', true, null),
  ('8f000000-0000-0000-0000-000000000002', 'saliente-huerfanas@test.local', 'Saliente Huérfanas', 'employee', true, '8f000000-0000-0000-0000-0000000000aa'),
  ('8f000000-0000-0000-0000-000000000003', 'companera-huerfanas@test.local', 'Compañera Huérfanas', 'employee', true, '8f000000-0000-0000-0000-0000000000aa'),
  ('8f000000-0000-0000-0000-000000000004', 'otra-especialidad-huerfanas@test.local', 'Otra Especialidad Huérfanas', 'employee', true, '8f000000-0000-0000-0000-0000000000bb'),
  ('8f000000-0000-0000-0000-000000000005', 'inactiva-huerfanas@test.local', 'Inactiva Huérfanas', 'employee', true, '8f000000-0000-0000-0000-0000000000aa'),
  ('8f000000-0000-0000-0000-000000000006', 'sin-citas-huerfanas@test.local', 'Sin Citas Huérfanas', 'employee', true, '8f000000-0000-0000-0000-0000000000aa');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat) values
  ('8f000000-0000-0000-0000-0000000000b1', '8f000000-0000-0000-0000-0000000000aa', 'Sesión huérfanas', 30, 3000, 'exempt');
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8f000000-0000-0000-0000-0000000000c1', 'Paciente', 'Huérfana', '1990-01-01', true),
  ('8f000000-0000-0000-0000-0000000000c2', 'Paciente', 'SinCitas', '1990-01-01', true);

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8f000000-0000-0000-0000-0000000000d1', '8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c1',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(3, '10:00'), pg_temp.at_madrid(3, '10:30')),
  ('8f000000-0000-0000-0000-0000000000d2', '8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c1',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-3, '10:00'), pg_temp.at_madrid(-3, '10:30')),
  ('8f000000-0000-0000-0000-0000000000d3', '8f000000-0000-0000-0000-000000000005', '8f000000-0000-0000-0000-0000000000c1',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(4, '10:00'), pg_temp.at_madrid(4, '10:30')),
  ('8f000000-0000-0000-0000-0000000000d4', '8f000000-0000-0000-0000-000000000006', '8f000000-0000-0000-0000-0000000000c2',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(5, '10:00'), pg_temp.at_madrid(5, '10:30')),
  ('8f000000-0000-0000-0000-0000000000d5', '8f000000-0000-0000-0000-000000000006', '8f000000-0000-0000-0000-0000000000c2',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-5, '10:00'), pg_temp.at_madrid(-5, '10:30'));
update public.appointments set status = 'cancelled', cancelled_by = 'clinic'
where id = '8f000000-0000-0000-0000-0000000000d4';
update public.profiles set is_active = false where id = '8f000000-0000-0000-0000-000000000005';

select is((select is_active from public.profiles where id = '8f000000-0000-0000-0000-000000000005'), false,
  'maintenance without a signed-in user can still deactivate someone with appointments, so existing data can be repaired');

select pg_temp.act_as('8f000000-0000-0000-0000-000000000001');

select throws_ok($$
  update public.profiles set is_active = false where id = '8f000000-0000-0000-0000-000000000002'
$$, '23514', 'professional_has_upcoming_appointments',
  'the owner cannot deactivate a professional who still has upcoming appointments, which would leave them orphaned');
select lives_ok($$
  update public.profiles set is_active = false where id = '8f000000-0000-0000-0000-000000000006'
$$, 'a professional with only past or cancelled appointments can be deactivated');
select lives_ok($$
  update public.profiles set full_name = 'Saliente Huérfanas Editada' where id = '8f000000-0000-0000-0000-000000000002'
$$, 'other changes to a professional with upcoming appointments are not blocked');

select throws_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000005'
  where id = '8f000000-0000-0000-0000-0000000000d1'
$$, '23514', 'professional_inactive', 'an appointment is never handed to a professional who no longer works at the clinic');
select throws_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000004'
  where id = '8f000000-0000-0000-0000-0000000000d1'
$$, '23514', 'service_not_for_professional', 'an appointment only goes to a professional of the service''s specialty');
select throws_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000003'
  where id = '8f000000-0000-0000-0000-0000000000d2'
$$, '23514', 'appointment_in_past', 'a past appointment keeps the professional who attended it');
select lives_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000003'
  where id = '8f000000-0000-0000-0000-0000000000d3'
$$, 'the owner moves an upcoming appointment away from an inactive professional to an active colleague');
select is((select professional_id from public.appointments where id = '8f000000-0000-0000-0000-0000000000d3'),
  '8f000000-0000-0000-0000-000000000003'::uuid, 'the appointment now belongs to the colleague');
select lives_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000003'
  where id = '8f000000-0000-0000-0000-0000000000d1'
$$, 'the owner hands over the last upcoming appointment of the professional who is leaving');
select lives_ok($$
  update public.profiles set is_active = false where id = '8f000000-0000-0000-0000-000000000002'
$$, 'once her upcoming appointments are with someone else, she can be deactivated');
select throws_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000003'
  where id = '8f000000-0000-0000-0000-0000000000d4'
$$, '23514', 'appointment_cancelled_final', 'a cancelled appointment is not reassigned');

select pg_temp.act_as('8f000000-0000-0000-0000-000000000003');
select throws_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000001'
  where id = '8f000000-0000-0000-0000-0000000000d3'
$$, '23514', 'appointment_immutable_fields', 'an employee cannot hand her appointment over to someone else');

select results_eq($$
  select id, professional_name from public.person_upcoming_appointments('8f000000-0000-0000-0000-0000000000c1') order by starts_at
$$, $$ values
  ('8f000000-0000-0000-0000-0000000000d1'::uuid, 'Compañera Huérfanas'::text),
  ('8f000000-0000-0000-0000-0000000000d3'::uuid, 'Compañera Huérfanas'::text)
$$, 'staff see every upcoming appointment of a person before archiving her, with who attends it');
select is((select count(*) from public.person_upcoming_appointments('8f000000-0000-0000-0000-0000000000c2')), 0::bigint,
  'past and cancelled appointments do not count as upcoming');

select pg_temp.act_as('8f000000-0000-0000-0000-000000000004');
select is((select count(*) from public.person_upcoming_appointments('8f000000-0000-0000-0000-0000000000c1')), 2::bigint,
  'an employee also sees the upcoming appointments other professionals have with that person, so she cannot archive past them');
select is((select starts_at from public.person_upcoming_appointments('8f000000-0000-0000-0000-0000000000c1') order by starts_at limit 1),
  pg_temp.at_madrid(3, '10:00'), 'each upcoming appointment comes with its start');

select pg_temp.act_as('8f000000-0000-0000-0000-000000000004', 'aal1');
select throws_ok($$
  select * from public.person_upcoming_appointments('8f000000-0000-0000-0000-0000000000c1')
$$, '42501', 'person_upcoming_appointments_forbidden', 'aal1 is not enough to list a person''s appointments');

select pg_temp.act_as('8f000000-0000-0000-0000-000000000005');
select throws_ok($$
  select * from public.person_upcoming_appointments('8f000000-0000-0000-0000-0000000000c1')
$$, '42501', 'person_upcoming_appointments_forbidden', 'a deactivated professional cannot list a person''s appointments');

reset role;
select is(has_function_privilege('anon', 'public.person_upcoming_appointments(uuid)', 'execute'), false,
  'anon cannot call person_upcoming_appointments');
select is(has_function_privilege('authenticated', 'public.person_upcoming_appointments(uuid)', 'execute'), true,
  'authenticated can call person_upcoming_appointments, since its own logic gates access');

select set_config('request.jwt.claims', '', true);
select throws_ok($$
  update public.appointments set professional_id = '8f000000-0000-0000-0000-000000000006'
  where id = '8f000000-0000-0000-0000-0000000000d3'
$$, '23514', 'professional_inactive', 'not even maintenance hands an appointment to an inactive professional');

reset role;
select results_eq($$
  select kind::text, previous_professional_id, actor_id from public.appointment_events
  where appointment_id = '8f000000-0000-0000-0000-0000000000d3' and kind = 'reassigned'
$$, $$ values ('reassigned'::text, '8f000000-0000-0000-0000-000000000005'::uuid, '8f000000-0000-0000-0000-000000000001'::uuid) $$,
  'handing an appointment over is recorded in its history with who had it before and who did it');

select pg_temp.act_as('8f000000-0000-0000-0000-000000000004');
select throws_ok($$
  update public.people set archived_at = now() where id = '8f000000-0000-0000-0000-0000000000c1'
$$, '23514', 'person_has_upcoming_appointments',
  'a record with upcoming appointments cannot be archived, not even by writing to the table directly');
select lives_ok($$
  update public.people set archived_at = now() where id = '8f000000-0000-0000-0000-0000000000c2'
$$, 'a record with only past or cancelled appointments can be archived');
select lives_ok($$
  update public.people set admin_notes = 'Llamar antes' where id = '8f000000-0000-0000-0000-0000000000c1'
$$, 'other changes to a record with upcoming appointments are not blocked');

reset role;
select set_config('request.jwt.claims', '', true);
update public.people set archived_at = now() where id = '8f000000-0000-0000-0000-0000000000c1';
select isnt((select archived_at from public.people where id = '8f000000-0000-0000-0000-0000000000c1'), null,
  'maintenance without a signed-in user can still archive, so existing data can be repaired');

select * from finish();
rollback;
