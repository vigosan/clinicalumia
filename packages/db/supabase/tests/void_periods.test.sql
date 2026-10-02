begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

create or replace function pg_temp.at_madrid(days_from_today int, wall time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date + days_from_today)::timestamp + wall) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.madrid(p_wall text) returns timestamptz language sql stable as $$
  select (p_wall::timestamp) at time zone 'Europe/Madrid'
$$;

create or replace function pg_temp.invoiced_cents(p_start timestamptz, p_end timestamptz) returns bigint language sql stable as $$
  select coalesce(sum(i.total_cents), 0)::bigint
  from public.invoices i
  join public.payments p on p.id = i.payment_id
  join public.appointments a on a.id = p.appointment_id
  where a.professional_id = '8c000000-0000-0000-0000-000000000001'
    and i.issued_at >= p_start and i.issued_at < p_end
    and not (i.kind = 'full' and i.replaces_invoice_id is not null)
$$;

create or replace function pg_temp.collected_cents(p_start timestamptz, p_end timestamptz) returns bigint language sql stable as $$
  select coalesce(sum(cents), 0)::bigint
  from public.payment_totals(p_start, p_end, '8c000000-0000-0000-0000-000000000001')
$$;

insert into auth.users (id, email) values
  ('8c000000-0000-0000-0000-000000000001', 'profesional-anulaciones@test.local'),
  ('8c000000-0000-0000-0000-000000000002', 'colega-anulaciones@test.local'),
  ('8c000000-0000-0000-0000-000000000003', 'propietaria-anulaciones@test.local');
insert into public.specialties (id, name, slug) values
  ('8c000000-0000-0000-0000-0000000000aa', 'Anulaciones test', 'anulaciones-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8c000000-0000-0000-0000-000000000001', 'profesional-anulaciones@test.local', 'Profesional Anulaciones', 'employee', true, '8c000000-0000-0000-0000-0000000000aa'),
  ('8c000000-0000-0000-0000-000000000002', 'colega-anulaciones@test.local', 'Colega Anulaciones', 'employee', true, '8c000000-0000-0000-0000-0000000000aa'),
  ('8c000000-0000-0000-0000-000000000003', 'propietaria-anulaciones@test.local', 'Propietaria Anulaciones', 'owner', true, null);
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat, booking_payment, booking_payment_value) values
  ('8c000000-0000-0000-0000-0000000000b1', '8c000000-0000-0000-0000-0000000000aa', 'Anulaciones sesión', 30, 4500, 'exempt', 'none', 0);
insert into public.people (id, first_name, last_name, birth_date, is_patient) values
  ('8c000000-0000-0000-0000-0000000000c1', 'Nuria', 'Anulaciones', '1980-01-01', true);
insert into public.appointments (id, professional_id, patient_id, service_id, starts_at, ends_at) values
  ('8c000000-0000-0000-0000-0000000000d1', '8c000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-0000000000c1',
   '8c000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-3, '09:00'), pg_temp.at_madrid(-3, '09:30')),
  ('8c000000-0000-0000-0000-0000000000d2', '8c000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-0000000000c1',
   '8c000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-2, '09:00'), pg_temp.at_madrid(-2, '09:30')),
  ('8c000000-0000-0000-0000-0000000000d3', '8c000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-0000000000c1',
   '8c000000-0000-0000-0000-0000000000b1', pg_temp.at_madrid(-1, '09:00'), pg_temp.at_madrid(-1, '09:30'));

select pg_temp.act_as('8c000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.collect_payment('8c000000-0000-0000-0000-0000000000d1', 4500, 'cash', '');
  perform public.collect_payment('8c000000-0000-0000-0000-0000000000d2', 4500, 'cash', '');
  perform public.collect_payment('8c000000-0000-0000-0000-0000000000d3', 4500, 'card', '');
end $$;
reset role;

set local session_replication_role = replica;
update public.payments set collected_at = case appointment_id
    when '8c000000-0000-0000-0000-0000000000d1' then pg_temp.madrid('2019-09-30 10:00')
    when '8c000000-0000-0000-0000-0000000000d2' then pg_temp.madrid('2019-10-03 10:00')
    else pg_temp.madrid('2019-10-04 10:00') end
where appointment_id in ('8c000000-0000-0000-0000-0000000000d1', '8c000000-0000-0000-0000-0000000000d2', '8c000000-0000-0000-0000-0000000000d3');
update public.invoices i set issued_at = p.collected_at
from public.payments p
where p.id = i.payment_id and p.appointment_id in ('8c000000-0000-0000-0000-0000000000d1', '8c000000-0000-0000-0000-0000000000d2', '8c000000-0000-0000-0000-0000000000d3');
set local session_replication_role = origin;

select pg_temp.act_as('8c000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.issue_rectifying_invoice(
    (select i.id from public.invoices i join public.payments p on p.id = i.payment_id
     where p.appointment_id = '8c000000-0000-0000-0000-0000000000d1'), 'Devuelto al paciente');
  perform public.issue_rectifying_invoice(
    (select i.id from public.invoices i join public.payments p on p.id = i.payment_id
     where p.appointment_id = '8c000000-0000-0000-0000-0000000000d2'), 'Cobrado por error');
end $$;
reset role;

set local session_replication_role = replica;
update public.payments set voided_at = case appointment_id
    when '8c000000-0000-0000-0000-0000000000d1' then pg_temp.madrid('2019-10-02 12:00')
    else pg_temp.madrid('2019-10-03 12:00') end
where appointment_id in ('8c000000-0000-0000-0000-0000000000d1', '8c000000-0000-0000-0000-0000000000d2');
update public.invoices i set issued_at = p.voided_at
from public.payments p
where p.id = i.payment_id and i.kind = 'rectifying'
  and p.appointment_id in ('8c000000-0000-0000-0000-0000000000d1', '8c000000-0000-0000-0000-0000000000d2');
set local session_replication_role = origin;

select pg_temp.act_as('8c000000-0000-0000-0000-000000000003');
select results_eq(
  $$ select method::text, cents from public.payment_totals(pg_temp.madrid('2019-07-01 00:00'), pg_temp.madrid('2019-10-01 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('cash', 4500::bigint) $$,
  'a payment collected in Q3 and voided in Q4 still counts in Q3, so a closed quarter''s takings never change afterwards');
select results_eq(
  $$ select method::text, cents from public.payment_totals(pg_temp.madrid('2019-09-30 00:00'), pg_temp.madrid('2019-10-01 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('cash', 4500::bigint) $$,
  'the cash of the day it was collected stays as it was counted at the till');
select results_eq(
  $$ select method::text, cents from public.payment_totals(pg_temp.madrid('2019-10-01 00:00'), pg_temp.madrid('2020-01-01 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('cash', -4500::bigint), ('card', 4500::bigint) $$,
  'Q4 subtracts the cross-period void from its method and nets the one collected and voided inside Q4 to zero');
select results_eq(
  $$ select method::text, cents from public.payment_totals(pg_temp.madrid('2019-10-02 00:00'), pg_temp.madrid('2019-10-03 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('cash', -4500::bigint) $$,
  'the money given back shows on the day it was voided, so that day''s till explains the refund');
select is(pg_temp.collected_cents(pg_temp.madrid('2019-07-01 00:00'), pg_temp.madrid('2019-10-01 00:00')),
  pg_temp.invoiced_cents(pg_temp.madrid('2019-07-01 00:00'), pg_temp.madrid('2019-10-01 00:00')),
  'Cobros and Facturación add up to the same amount in Q3');
select is(pg_temp.collected_cents(pg_temp.madrid('2019-10-01 00:00'), pg_temp.madrid('2020-01-01 00:00')),
  pg_temp.invoiced_cents(pg_temp.madrid('2019-10-01 00:00'), pg_temp.madrid('2020-01-01 00:00')),
  'Cobros and Facturación add up to the same amount in Q4, where the rectifying invoice is dated');
select results_eq(
  $$ select entry, amount_cents, moment, voided_at is not null
     from public.list_payments(pg_temp.madrid('2019-07-01 00:00'), pg_temp.madrid('2019-10-01 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('collected', 4500, pg_temp.madrid('2019-09-30 10:00'), true) $$,
  'Q3 lists the payment as collected, with its full amount, and says it was voided later');
select results_eq(
  $$ select entry, amount_cents, moment, method::text, void_reason
     from public.list_payments(pg_temp.madrid('2019-10-02 00:00'), pg_temp.madrid('2019-10-03 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('voided', -4500, pg_temp.madrid('2019-10-02 12:00'), 'cash', 'Devuelto al paciente') $$,
  'the void date lists a negative row with the method and the reason, so the list adds up to the totals');
select results_eq(
  $$ select entry, amount_cents
     from public.list_payments(pg_temp.madrid('2019-10-03 00:00'), pg_temp.madrid('2019-10-04 00:00'),
       '8c000000-0000-0000-0000-000000000001') $$,
  $$ values ('collected', 4500), ('voided', -4500) $$,
  'a payment collected and voided the same day shows both rows in time order');
select is(
  (select sum(amount_cents)::bigint from public.list_payments(pg_temp.madrid('2019-10-01 00:00'), pg_temp.madrid('2020-01-01 00:00'),
     '8c000000-0000-0000-0000-000000000001')),
  pg_temp.collected_cents(pg_temp.madrid('2019-10-01 00:00'), pg_temp.madrid('2020-01-01 00:00')),
  'the listed rows add up to the totals over the same range');
reset role;

select pg_temp.act_as('8c000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select entry, amount_cents
     from public.list_payments(pg_temp.madrid('2019-10-02 00:00'), pg_temp.madrid('2019-10-03 00:00')) $$,
  $$ values ('voided', -4500) $$,
  'the professional sees the void of her own appointment''s payment on its date');
reset role;

select pg_temp.act_as('8c000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.list_payments(pg_temp.madrid('2019-07-01 00:00'), pg_temp.madrid('2020-01-01 00:00'))
   where professional_id = '8c000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a colleague with no relation to the appointment sees neither the payment nor its void');
select is(
  (select count(*) from public.payment_totals(pg_temp.madrid('2019-10-01 00:00'), pg_temp.madrid('2020-01-01 00:00'),
     '8c000000-0000-0000-0000-000000000001')),
  0::bigint,
  'nor are a colleague''s voids subtracted from her totals');
reset role;

select * from finish();
rollback;
