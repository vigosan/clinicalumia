begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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

create or replace function pg_temp.day3() returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date + 3
$$;

create or replace function pg_temp.at_day3(wall time) returns timestamptz language sql stable as $$
  select (pg_temp.day3()::timestamp + wall) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.ago(wall time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date - 3)::timestamp + wall) at time zone 'Europe/Madrid'
$$;

insert into auth.users (id, email) values
  ('8f000000-0000-0000-0000-000000000001', 'primera-solape@test.local'),
  ('8f000000-0000-0000-0000-000000000002', 'segunda-solape@test.local'),
  ('8f000000-0000-0000-0000-000000000010', 'cuenta-solape@test.local');
insert into public.specialties (id, name, slug) values
  ('8f000000-0000-0000-0000-0000000000aa', 'Solape de paciente test', 'solape-de-paciente-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8f000000-0000-0000-0000-000000000001', 'primera-solape@test.local', 'Primera Solape', 'employee', true, '8f000000-0000-0000-0000-0000000000aa'),
  ('8f000000-0000-0000-0000-000000000002', 'segunda-solape@test.local', 'Segunda Solape', 'employee', true, '8f000000-0000-0000-0000-0000000000aa');
insert into public.patient_accounts (id, email) values
  ('8f000000-0000-0000-0000-000000000010', 'cuenta-solape@test.local');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online) values
  ('8f000000-0000-0000-0000-0000000000b1', '8f000000-0000-0000-0000-0000000000aa', 'Solape 30', 30, 3000, true),
  ('8f000000-0000-0000-0000-0000000000b2', '8f000000-0000-0000-0000-0000000000aa', 'Solape otro servicio', 30, 3000, true);
insert into public.people (id, first_name, last_name, birth_date, email, is_patient) values
  ('8f000000-0000-0000-0000-0000000000c1', 'Sara', 'Solape', '1980-01-01', 'cuenta-solape@test.local', true),
  ('8f000000-0000-0000-0000-0000000000c2', 'Otra', 'Persona', '1981-01-01', null, true);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('8f000000-0000-0000-0000-000000000001', extract(isodow from pg_temp.day3())::smallint, '09:00', '14:00'),
  ('8f000000-0000-0000-0000-000000000002', extract(isodow from pg_temp.day3())::smallint, '09:00', '14:00');

select has_index('public', 'appointments', 'appointments_patient_no_overlap',
  'appointments carry an exclusion on the person, not only on the professional');

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8f000000-0000-0000-0000-0000000000d1', '8f000000-0000-0000-0000-000000000001', '8f000000-0000-0000-0000-0000000000c1',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('09:00'), pg_temp.at_day3('09:30'));

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c1',
     '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('09:15'), pg_temp.at_day3('09:45'))
$$, '23P01', null, 'one person cannot be in two places at once, even with two different professionals');
select lives_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c1',
     '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('09:30'), pg_temp.at_day3('10:00'))
$$, 'back-to-back appointments of the same person are fine, because they only touch');
select lives_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c2',
     '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('09:00'), pg_temp.at_day3('09:30'))
$$, 'two different people at the same time with different professionals is the normal case');

update public.appointments set status = 'cancelled', cancelled_by = 'clinic' where id = '8f000000-0000-0000-0000-0000000000d1';
select lives_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8f000000-0000-0000-0000-000000000001', '8f000000-0000-0000-0000-0000000000c1',
     '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('09:00'), pg_temp.at_day3('09:30'))
$$, 'a cancelled appointment frees the person, so she can be booked again at that time');

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8f000000-0000-0000-0000-0000000000d2', '8f000000-0000-0000-0000-000000000001', '8f000000-0000-0000-0000-0000000000c1',
   '8f000000-0000-0000-0000-0000000000b1', pg_temp.ago('10:00'), pg_temp.ago('10:30'));
update public.appointments set status = 'no_show' where id = '8f000000-0000-0000-0000-0000000000d2';
select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
    ('8f000000-0000-0000-0000-0000000000d3', '8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c1',
     '8f000000-0000-0000-0000-0000000000b1', pg_temp.ago('10:00'), pg_temp.ago('10:30'))
$$, 'a no-show frees the person too, as decided for no-shows');
select throws_ok($$ update public.appointments set status = 'scheduled' where id = '8f000000-0000-0000-0000-0000000000d2' $$,
  '23P01', null, 'undoing the no-show is refused while the person has another appointment at that time');

select pg_temp.act_as_patient('8f000000-0000-0000-0000-000000000010');
select is(
  public.book_appointment('8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1', null, pg_temp.at_day3('11:00')),
  public.book_appointment('8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1', null, pg_temp.at_day3('11:00')),
  'confirming the same booking twice gives back the same appointment');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*) from public.appointments
    where patient_id = '8f000000-0000-0000-0000-0000000000c1' and starts_at = pg_temp.at_day3('11:00')),
  1::bigint, 'a second confirmation never books a second professional for the same person');

select pg_temp.act_as_patient('8f000000-0000-0000-0000-000000000010');
select throws_ok(format($$ select public.book_appointment(%L, %L, null, %L) $$,
    '8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('11:15')),
  'P0001', 'person_has_appointment', 'a booking that overlaps the person''s other appointment is refused with its own reason');
select throws_ok(format($$ select public.book_appointment(%L, %L, %L, %L) $$,
    '8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1',
    '8f000000-0000-0000-0000-000000000002', pg_temp.at_day3('11:15')),
  'P0001', 'person_has_appointment', 'choosing a free professional does not get round it either');
select throws_ok(format($$ select public.book_appointment(%L, %L, null, %L) $$,
    '8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b2', pg_temp.at_day3('11:00')),
  'P0001', 'person_has_appointment', 'another service at the very same time is not the same booking, so it is refused instead of confirming the existing one');
select throws_ok(format($$ select public.book_appointment(%L, %L, %L, %L) $$,
    '8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1',
    '8f000000-0000-0000-0000-000000000002', pg_temp.at_day3('11:00')),
  'P0001', 'person_has_appointment', 'choosing a different professional at the same time is not the same booking either');
select is(
  public.book_appointment('8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1',
    '8f000000-0000-0000-0000-000000000001', pg_temp.at_day3('11:00')),
  (select id from public.my_appointments() where starts_at = pg_temp.at_day3('11:00')),
  'choosing the professional who already has that booking is the same booking, so it is confirmed again');

reset role;
select set_config('request.jwt.claims', '', true);
create function pg_temp.first_professional_taken() returns trigger language plpgsql as $$
begin
  if new.professional_id = '8f000000-0000-0000-0000-000000000001' and new.patient_id = '8f000000-0000-0000-0000-0000000000c1' then
    raise exception 'conflicting key value violates exclusion constraint'
      using errcode = 'exclusion_violation', constraint = 'appointments_no_overlap';
  end if;
  return new;
end;
$$;
create trigger appointments_first_professional_taken before insert on public.appointments
  for each row execute function pg_temp.first_professional_taken();

select pg_temp.act_as_patient('8f000000-0000-0000-0000-000000000010');
select throws_ok(format($$ select public.book_appointment(%L, %L, %L, %L) $$,
    '8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1',
    '8f000000-0000-0000-0000-000000000001', pg_temp.at_day3('12:00')),
  'P0001', 'slot_not_available', 'when the chosen professional is taken at the last moment, the slot is not available');
select lives_ok(format($$ select public.book_appointment(%L, %L, null, %L) $$,
    '8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('12:00')),
  'with «El primer hueco libre», losing the first professional at the last moment still books');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select professional_id from public.appointments
    where patient_id = '8f000000-0000-0000-0000-0000000000c1' and starts_at = pg_temp.at_day3('12:00')),
  '8f000000-0000-0000-0000-000000000002'::uuid, 'the booking goes to the next free professional');
drop trigger appointments_first_professional_taken on public.appointments;

create function pg_temp.twin_booked() returns trigger language plpgsql as $$
begin
  if current_setting('lumia_test.twin', true) = 'on' then
    perform set_config('lumia_test.twin', 'off', true);
    perform set_config('lumia.booking_account', auth.uid()::text, true);
    insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at) values
      ('8f000000-0000-0000-0000-000000000002', '8f000000-0000-0000-0000-0000000000c1',
       '8f000000-0000-0000-0000-0000000000b1', pg_temp.at_day3('10:30'), pg_temp.at_day3('11:00'));
  end if;
  return null;
end;
$$;
create trigger people_twin_booked after update on public.people
  for each statement execute function pg_temp.twin_booked();

select pg_temp.act_as_patient('8f000000-0000-0000-0000-000000000010');
select set_config('lumia_test.twin', 'on', true);
select set_config('lumia_test.booked',
  public.book_appointment('8f000000-0000-0000-0000-0000000000c1', '8f000000-0000-0000-0000-0000000000b1', null, pg_temp.at_day3('10:30'))::text, true);
select is(current_setting('lumia_test.booked')::uuid,
  (select id from public.my_appointments() where starts_at = pg_temp.at_day3('10:30')),
  'when the same booking lands from another tab while this one is being made, this one answers with that appointment');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*) from public.appointments
    where patient_id = '8f000000-0000-0000-0000-0000000000c1' and starts_at = pg_temp.at_day3('10:30')),
  1::bigint, 'and only one appointment exists for that time');
drop trigger people_twin_booked on public.people;

create function pg_temp.web_id(wall time) returns uuid language sql stable security definer as $$
  select id from public.appointments
  where patient_id = '8f000000-0000-0000-0000-0000000000c1' and starts_at = pg_temp.at_day3(wall)
$$;

select pg_temp.act_as_patient('8f000000-0000-0000-0000-000000000010');
select is(public.reschedule_my_appointment(pg_temp.web_id('11:00'), pg_temp.at_day3('11:00')), pg_temp.web_id('11:00'),
  'moving an appointment to the time it already has answers with the same appointment');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*) from public.appointment_events where appointment_id = pg_temp.web_id('11:00') and kind = 'moved'),
  0::bigint, 'moving to the same time changes nothing, so the history gets no «Movida de…»');

select pg_temp.act_as_patient('8f000000-0000-0000-0000-000000000010');
select is((select count(*) from public.my_reschedule_slots(pg_temp.web_id('11:00'), pg_temp.day3(), pg_temp.day3())
    where starts_at in (pg_temp.at_day3('11:45'), pg_temp.at_day3('12:00'))),
  0::bigint, 'times that overlap the person''s other appointment are not offered to move to');
select throws_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id('11:00'), pg_temp.at_day3('12:00')),
  'P0001', 'person_has_appointment', 'a person cannot move one appointment on top of her other one, and is told why');
select lives_ok(format($$ select public.reschedule_my_appointment(%L, %L) $$, pg_temp.web_id('11:00'), pg_temp.at_day3('13:00')),
  'moving to a time when she is free still works');

select * from finish();
rollback;
