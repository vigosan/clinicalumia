begin;
create extension if not exists pgtap with schema extensions;
select plan(58);

insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-000000000001', 'owner-appointments@test.local'),
  ('60000000-0000-0000-0000-000000000002', 'a-appointments@test.local'),
  ('60000000-0000-0000-0000-000000000003', 'b-appointments@test.local'),
  ('60000000-0000-0000-0000-000000000004', 'inactive-appointments@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('60000000-0000-0000-0000-000000000001', 'owner-appointments@test.local', 'Owner', 'owner', true),
  ('60000000-0000-0000-0000-000000000002', 'a-appointments@test.local', 'Empleada A', 'employee', true),
  ('60000000-0000-0000-0000-000000000003', 'b-appointments@test.local', 'Empleada B', 'employee', true),
  ('60000000-0000-0000-0000-000000000004', 'inactive-appointments@test.local', 'Inactiva', 'employee', false);
insert into public.specialties (id, name, slug) values
  ('60000000-0000-0000-0000-0000000000aa', 'Citas test', 'citas-test');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat, is_active) values
  ('60000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-0000000000aa', 'Sesión activa', 45, 4000, 'standard_21', true),
  ('60000000-0000-0000-0000-0000000000b2', '60000000-0000-0000-0000-0000000000aa', 'Sesión retirada', 45, 3000, 'exempt', false);
insert into public.people (id, first_name, last_name, birth_date, is_patient, archived_at) values
  ('60000000-0000-0000-0000-0000000000c1', 'Paciente', 'Activa', '1990-01-01', true, null),
  ('60000000-0000-0000-0000-0000000000c2', 'Paciente', 'Archivada', '1990-01-01', true, now()),
  ('60000000-0000-0000-0000-0000000000c3', 'Tutor', 'NoPaciente', null, false, null);

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

create or replace function pg_temp.rows_affected(statement text) returns bigint language plpgsql as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('60000000-0000-0000-0000-0000000000e1', '60000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
   '2020-01-10 10:00 Europe/Madrid', '2020-01-10 10:45 Europe/Madrid');

select pg_temp.act_as('60000000-0000-0000-0000-000000000002');

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at,
    created_by, price_cents, vat)
  values ('60000000-0000-0000-0000-0000000000d1', '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
    '2099-06-01 10:00 Europe/Madrid', '2099-06-01 10:45 Europe/Madrid',
    '60000000-0000-0000-0000-000000000001', 1, 'exempt')
$$, 'an active employee can book an appointment for herself, even while spoofing author and price');

select is((select count(*) from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 1::bigint,
  'the employee reads back the appointment she just booked');
select is((select price_cents from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 4000,
  'the price is copied from the service, so piece 4 charges what was agreed and a client cannot set its own price');
select is((select vat::text from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 'standard_21',
  'the vat treatment is copied from the service, ignoring the value the client sent');
select is((select created_by::text from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'),
  '60000000-0000-0000-0000-000000000002',
  'created_by is forced to whoever booked, so the history cannot be attributed to someone else');
select is((select status::text from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 'scheduled',
  'a new appointment starts as scheduled');

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-0000000000c1',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-01 12:00 Europe/Madrid', '2099-06-01 12:45 Europe/Madrid')
$$, '42501', null, 'an employee cannot book into a colleague''s agenda, even calling the API directly');

select throws_ok($$
  update public.appointments set professional_id = '60000000-0000-0000-0000-000000000003'
  where id = '60000000-0000-0000-0000-0000000000d1'
$$, '23514', 'appointment_immutable_fields',
  'an employee cannot hand her appointment over to a colleague by changing the professional');

select pg_temp.act_as('60000000-0000-0000-0000-000000000003');

select is((select count(*) from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 0::bigint,
  'a colleague cannot read another professional''s appointment, which would expose patient and service');
select is(pg_temp.rows_affected($$
  update public.appointments set notes = 'Intrusa' where id = '60000000-0000-0000-0000-0000000000d1'
$$), 0::bigint, 'a colleague''s update on another professional''s appointment changes nothing');

select pg_temp.act_as('60000000-0000-0000-0000-000000000001');

select is((select count(*) from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 1::bigint,
  'the owner sees every professional''s appointments');
select is(pg_temp.rows_affected($$
  update public.appointments set notes = 'Nota de la propietaria' where id = '60000000-0000-0000-0000-0000000000d1'
$$), 1::bigint, 'the owner can manage an employee''s appointment');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-0000000000c1',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-01 12:00 Europe/Madrid', '2099-06-01 12:45 Europe/Madrid')
$$, '23514', 'professional_inactive', 'nobody can book with a professional who no longer works at the clinic');

select pg_temp.act_as('60000000-0000-0000-0000-000000000004');

select is((select count(*) from public.appointments), 0::bigint,
  'a deactivated employee sees no appointments at all');

select pg_temp.act_as('60000000-0000-0000-0000-000000000002');

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-0000000000d2', '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
    '2099-06-02 16:10 Europe/Madrid', '2099-06-02 16:55 Europe/Madrid')
$$, 'booking 16:10 to 16:55 succeeds');
select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-0000000000d3', '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
    '2099-06-02 16:55 Europe/Madrid', '2099-06-02 17:40 Europe/Madrid')
$$, 'back-to-back appointments that only touch at 16:55 are allowed, so a full day can be booked without gaps');

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-0000000000d4', '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
    '2099-06-03 16:10 Europe/Madrid', '2099-06-03 16:55 Europe/Madrid')
$$, 'booking 16:10 to 16:55 on another day succeeds');
select throws_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-0000000000d5', '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
    '2099-06-03 16:50 Europe/Madrid', '2099-06-03 17:35 Europe/Madrid')
$$, '23P01', 'conflicting key value violates exclusion constraint "appointments_no_overlap"',
  'a professional can never have two active appointments at once, even by five minutes');
select lives_ok($$
  update public.appointments set status = 'cancelled', cancelled_by = 'patient'
  where id = '60000000-0000-0000-0000-0000000000d4'
$$, 'the blocking appointment can be cancelled');
select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-0000000000d5', '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
    '2099-06-03 16:50 Europe/Madrid', '2099-06-03 17:35 Europe/Madrid')
$$, 'a cancelled appointment frees its slot for a new booking');

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000c1',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 10:07 Europe/Madrid')
$$, '23514', null, 'a 7-minute appointment is rejected, since durations go in steps of 5 minutes');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000c1',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 10:00 Europe/Madrid')
$$, '23514', null, 'a zero-length appointment is rejected, since it would never block the agenda');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000c1',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-05 10:00 Europe/Madrid', '2099-06-05 18:05 Europe/Madrid')
$$, '23514', null, 'an appointment longer than 8 hours is rejected');

select lives_ok($$
  insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at)
  values
    ('60000000-0000-0000-0000-0000000000d6', '60000000-0000-0000-0000-000000000002',
     '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
     '2099-06-04 10:00 Europe/Madrid', '2099-06-04 10:45 Europe/Madrid'),
    ('60000000-0000-0000-0000-0000000000d7', '60000000-0000-0000-0000-000000000002',
     '60000000-0000-0000-0000-0000000000c1', '60000000-0000-0000-0000-0000000000b1',
     '2099-06-04 12:00 Europe/Madrid', '2099-06-04 12:45 Europe/Madrid')
$$, 'booking two more future appointments succeeds');

select throws_ok($$
  update public.appointments set status = 'cancelled' where id = '60000000-0000-0000-0000-0000000000d6'
$$, '23514', 'cancelled_by_required', 'a cancellation must say who cancelled, patient or clinic');
select lives_ok($$
  update public.appointments set status = 'cancelled', cancelled_by = 'patient', cancelled_at = '2000-01-01'
  where id = '60000000-0000-0000-0000-0000000000d6'
$$, 'cancelling on behalf of the patient succeeds');
select is((select cancelled_at from public.appointments where id = '60000000-0000-0000-0000-0000000000d6'), now(),
  'the database stamps when it was cancelled, ignoring any time sent by the client');
select throws_ok($$
  update public.appointments set status = 'scheduled' where id = '60000000-0000-0000-0000-0000000000d6'
$$, '23514', 'appointment_cancelled_final', 'a cancelled appointment is final; a new one must be booked instead');
select throws_ok($$
  update public.appointments set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
  where id = '60000000-0000-0000-0000-0000000000d6'
$$, '23514', 'appointment_cancelled_final', 'a cancelled appointment cannot be moved either');

select throws_ok($$
  update public.appointments set status = 'no_show' where id = '60000000-0000-0000-0000-0000000000d7'
$$, '23514', 'appointment_not_started', 'nobody can be marked as a no-show before the appointment has started');

select lives_ok($$
  update public.appointments set status = 'no_show' where id = '60000000-0000-0000-0000-0000000000e1'
$$, 'a past appointment can be marked as a no-show');
select throws_ok($$
  update public.appointments set status = 'cancelled', cancelled_by = 'clinic'
  where id = '60000000-0000-0000-0000-0000000000e1'
$$, '23514', 'appointment_invalid_transition', 'a no-show cannot be turned into a cancellation, it happened in the past');
select lives_ok($$
  update public.appointments set status = 'scheduled' where id = '60000000-0000-0000-0000-0000000000e1'
$$, 'a mistaken no-show can be undone back to scheduled');

select lives_ok($$
  update public.appointments
  set starts_at = '2099-06-01 11:00 Europe/Madrid', ends_at = '2099-06-01 11:45 Europe/Madrid'
  where id = '60000000-0000-0000-0000-0000000000d1'
$$, 'a future scheduled appointment can be moved');
select is((select starts_at from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'),
  '2099-06-01 11:00 Europe/Madrid'::timestamptz, 'the new start time is stored');
select throws_ok($$
  update public.appointments
  set starts_at = '2099-06-06 10:00 Europe/Madrid', ends_at = '2099-06-06 10:45 Europe/Madrid'
  where id = '60000000-0000-0000-0000-0000000000e1'
$$, '23514', 'appointment_in_past', 'an appointment that already started cannot be moved, it would rewrite what happened');
select throws_ok($$
  update public.appointments set patient_id = '60000000-0000-0000-0000-0000000000c3'
  where id = '60000000-0000-0000-0000-0000000000d1'
$$, '23514', 'appointment_immutable_fields', 'the patient of an appointment cannot be swapped; book a new one instead');
select throws_ok($$
  update public.appointments set price_cents = 1 where id = '60000000-0000-0000-0000-0000000000d1'
$$, '23514', 'appointment_immutable_fields', 'the agreed price cannot be changed after booking');

select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000c2',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-08 10:00 Europe/Madrid', '2099-06-08 10:45 Europe/Madrid')
$$, '23514', 'patient_not_bookable', 'an archived patient cannot be booked');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000c3',
    '60000000-0000-0000-0000-0000000000b1', '2099-06-08 10:00 Europe/Madrid', '2099-06-08 10:45 Europe/Madrid')
$$, '23514', 'patient_not_bookable', 'a person who is only a guardian, not a patient, cannot be booked');
select throws_ok($$
  insert into public.appointments (professional_id, patient_id, service_id, starts_at, ends_at)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000c1',
    '60000000-0000-0000-0000-0000000000b2', '2099-06-08 10:00 Europe/Madrid', '2099-06-08 10:45 Europe/Madrid')
$$, '23514', 'service_inactive', 'a retired service cannot be booked');

select pg_temp.act_as('60000000-0000-0000-0000-000000000001');
select lives_ok($$
  update public.appointments set status = 'cancelled', cancelled_by = 'clinic'
  where id = '60000000-0000-0000-0000-0000000000d7'
$$, 'the owner can cancel an employee''s appointment on behalf of the clinic');

select pg_temp.act_as('60000000-0000-0000-0000-000000000002');

select is((select actor_id::text from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d1' and kind = 'created'),
  '60000000-0000-0000-0000-000000000002', 'booking records a created event by whoever booked');
select is((select count(*) from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d1'), 2::bigint,
  'the owner''s notes edit is not an event; only the booking and the move are');
select is((select previous_starts_at from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d1' and kind = 'moved'),
  '2099-06-01 10:00 Europe/Madrid'::timestamptz, 'the moved event keeps the previous start so the history shows before and after');
select is((select previous_ends_at from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d1' and kind = 'moved'),
  '2099-06-01 10:45 Europe/Madrid'::timestamptz, 'the moved event keeps the previous end');
select is((select actor_id::text from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d1' and kind = 'moved'),
  '60000000-0000-0000-0000-000000000002', 'the moved event records who moved it');
select is((select actor_id::text from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d6' and kind = 'cancelled'),
  '60000000-0000-0000-0000-000000000002', 'the cancelled event records who cancelled it');
select is((select actor_id::text from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d7' and kind = 'cancelled'),
  '60000000-0000-0000-0000-000000000001', 'when the owner cancels, the event names the owner, not the professional');
select is((select previous_starts_at from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d6' and kind = 'cancelled'), null::timestamptz,
  'previous times are only filled on moved events');
select results_eq($$
  select kind::text from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000e1' order by created_at, kind
$$, $$ values ('created'), ('no_show'), ('restored') $$,
  'marking and undoing a no-show are both recorded, so a correction is visible in the history');

select throws_ok($$
  insert into public.appointment_events (appointment_id, kind, actor_id)
  values ('60000000-0000-0000-0000-0000000000d1', 'cancelled', '60000000-0000-0000-0000-000000000002')
$$, '42501', null, 'nobody can forge history by inserting events by hand');
select throws_ok($$
  update public.appointment_events set actor_id = '60000000-0000-0000-0000-000000000003'
  where appointment_id = '60000000-0000-0000-0000-0000000000d1'
$$, '42501', null, 'nobody can rewrite history by editing events');
select throws_ok($$
  delete from public.appointment_events where appointment_id = '60000000-0000-0000-0000-0000000000d1'
$$, '42501', null, 'nobody can erase history by deleting events');

select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select is((select count(*) from public.appointment_events
  where appointment_id = '60000000-0000-0000-0000-0000000000d1'), 0::bigint,
  'a colleague cannot read another professional''s appointment history');

select pg_temp.act_as('60000000-0000-0000-0000-000000000002');
select is(pg_temp.rows_affected($$
  delete from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'
$$), 0::bigint, 'an employee cannot delete her appointment; it must be cancelled so the history stays');

select pg_temp.act_as('60000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_affected($$
  delete from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'
$$), 0::bigint, 'not even the owner can delete an appointment');

reset role;
select is((select count(*) from public.appointments where id = '60000000-0000-0000-0000-0000000000d1'), 1::bigint,
  'checked as postgres: the appointment survived both delete attempts');

select * from finish();
rollback;
