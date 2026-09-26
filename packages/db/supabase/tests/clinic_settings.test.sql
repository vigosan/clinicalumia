begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'owner-clinic@test.local'),
  ('30000000-0000-0000-0000-000000000002', 'employee-clinic@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('30000000-0000-0000-0000-000000000001', 'owner-clinic@test.local', 'Owner', 'owner', true),
  ('30000000-0000-0000-0000-000000000002', 'employee-clinic@test.local', 'Employee', 'employee', true);

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select is((select count(*) from public.clinic_settings)::bigint, 1::bigint,
  'the migration seeds exactly one settings row, since the clinic has a single set of details');

select throws_ok($$ insert into public.clinic_settings (id) values (true) $$, '23505', null,
  'a second row cannot exist because clinic_settings holds one fixed configuration');

select pg_temp.act_as('30000000-0000-0000-0000-000000000001');

select lives_ok($$ update public.clinic_settings set legal_name = 'Datos actualizados por la propietaria' $$,
  'the owner can update the clinic fiscal details');
select is((select legal_name from public.clinic_settings), 'Datos actualizados por la propietaria',
  'the update by the owner is persisted');

select throws_ok($$ update public.clinic_settings set cancellation_hours = 800 $$, '23514', null,
  'cancellation_hours cannot exceed 720, the maximum a clinic can require');

select lives_ok($$
  insert into storage.objects (bucket_id, name) values ('branding', 'logo.png')
$$, 'the owner can upload the clinic logo to the branding bucket');

select pg_temp.act_as('30000000-0000-0000-0000-000000000002');

select is((select legal_name from public.clinic_settings), 'Datos actualizados por la propietaria',
  'an active employee can read the clinic settings, which invoices and the booking page need');

select lives_ok($$ update public.clinic_settings set legal_name = 'Intento de empleada' $$,
  'RLS silently filters the update instead of raising, so the statement does not error');

select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('branding', 'intruso.png')
$$, '42501', null, 'an employee cannot upload to the branding bucket, only the owner can');

reset role;

select is((select legal_name from public.clinic_settings), 'Datos actualizados por la propietaria',
  'the employee update above changed zero rows, so the owner value is still intact');

select is((select public from storage.buckets where id = 'branding'), true,
  'the branding bucket is public so logos can be served without signed URLs');
select is((select file_size_limit from storage.buckets where id = 'branding'), 2097152::bigint,
  'the branding bucket caps uploads at 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'branding'),
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  'the branding bucket only accepts image formats a browser can render');

select * from finish();
rollback;
