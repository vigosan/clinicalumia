begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, invited_at, encrypted_password) values
  ('8e000000-0000-0000-0000-000000000001', 'owner-invitations@test.local', null, 'hash'),
  ('8e000000-0000-0000-0000-000000000002', 'activa-invitations@test.local', now() - interval '3 days', 'hash'),
  ('8e000000-0000-0000-0000-000000000003', 'invitada-invitations@test.local', now(), '');
insert into public.specialties (id, name, slug) values
  ('8e000000-0000-0000-0000-0000000000aa', 'Invitaciones test', 'invitaciones-test');
insert into public.profiles (id, email, full_name, role, is_active, specialty_id) values
  ('8e000000-0000-0000-0000-000000000001', 'owner-invitations@test.local', 'Owner', 'owner', true, null),
  ('8e000000-0000-0000-0000-000000000002', 'activa-invitations@test.local', 'Activa', 'employee', true, '8e000000-0000-0000-0000-0000000000aa'),
  ('8e000000-0000-0000-0000-000000000003', 'invitada-invitations@test.local', 'Invitada', 'employee', true, '8e000000-0000-0000-0000-0000000000aa');
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, bookable_online) values
  ('8e000000-0000-0000-0000-0000000000b1', '8e000000-0000-0000-0000-0000000000aa', 'Sesión invitaciones', 60, 4000, true);
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
  select p, wd, '09:00', '12:00'
  from unnest(array['8e000000-0000-0000-0000-000000000002', '8e000000-0000-0000-0000-000000000003']::uuid[]) as p,
    generate_series(1, 7) as wd;

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

create or replace function pg_temp.day(n int) returns date language sql stable as $$
  select (now() at time zone 'Europe/Madrid')::date + n
$$;

create or replace function pg_temp.offered_professionals() returns jsonb language sql stable as $$
  select professionals from public.booking_catalog() where service_id = '8e000000-0000-0000-0000-0000000000b1'
$$;

create or replace function pg_temp.slot_professionals() returns uuid[] language sql stable as $$
  select coalesce(array_agg(distinct professional_id order by professional_id), '{}')
  from public.available_slots('8e000000-0000-0000-0000-0000000000b1', null, pg_temp.day(3), pg_temp.day(9))
$$;

select is(pg_temp.offered_professionals(),
  '[{"id": "8e000000-0000-0000-0000-000000000002", "full_name": "Activa"}]'::jsonb,
  'the web offers only the professional who activated her account, so nobody books someone who has not even set a password');
select is(pg_temp.slot_professionals(), array['8e000000-0000-0000-0000-000000000002']::uuid[],
  'free slots come only from activated professionals, so «first available» never lands on a pending invitation');
select is((select count(*) from public.available_slots('8e000000-0000-0000-0000-0000000000b1',
    '8e000000-0000-0000-0000-000000000003', pg_temp.day(3), pg_temp.day(9))), 0::bigint,
  'asking for the pending professional directly through the API returns no slots either');

set local role anon;
select is(has_function_privilege('anon', 'public.pending_invitations()', 'execute'), false,
  'anonymous visitors cannot learn who has a pending invitation');
reset role;
select is(has_function_privilege('authenticated', 'public.pending_invitations()', 'execute'), true,
  'the owner reads pending invitations through her own session');

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001');
select is((select array_agg(profile_id) from public.pending_invitations()),
  array['8e000000-0000-0000-0000-000000000003']::uuid[],
  'the owner sees exactly who has not accepted the invitation yet');
reset role;

select pg_temp.act_as('8e000000-0000-0000-0000-000000000002');
select throws_ok('select * from public.pending_invitations()', '42501', null,
  'an employee cannot read the team invitation status');
reset role;

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001', 'aal1');
select throws_ok('select * from public.pending_invitations()', '42501', null,
  'the owner without her second factor cannot read it either');
reset role;

update auth.users set encrypted_password = 'hash' where id = '8e000000-0000-0000-0000-000000000003';

select is(jsonb_array_length(pg_temp.offered_professionals()), 2,
  'once she sets her password she is offered on the web without anyone touching her profile');
select is(pg_temp.slot_professionals(),
  array['8e000000-0000-0000-0000-000000000002', '8e000000-0000-0000-0000-000000000003']::uuid[],
  'and her free slots appear');

select pg_temp.act_as('8e000000-0000-0000-0000-000000000001');
select is((select count(*) from public.pending_invitations()), 0::bigint,
  'the pending badge disappears as soon as she accepts');
reset role;

select * from finish();
rollback;
