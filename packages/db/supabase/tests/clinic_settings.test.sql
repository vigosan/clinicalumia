begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'owner-clinic@test.local'),
  ('30000000-0000-0000-0000-000000000002', 'employee-clinic@test.local'),
  ('30000000-0000-0000-0000-000000000003', 'inactive-clinic@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('30000000-0000-0000-0000-000000000001', 'owner-clinic@test.local', 'Owner', 'owner', true),
  ('30000000-0000-0000-0000-000000000002', 'employee-clinic@test.local', 'Employee', 'employee', true),
  ('30000000-0000-0000-0000-000000000003', 'inactive-clinic@test.local', 'Inactive', 'employee', false);

create or replace function pg_temp.act_as(user_id uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated', 'aal', aal)::text, true);
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

with ins as (
  insert into storage.objects (bucket_id, name) values ('branding', 'logo.png') returning name
)
select is((select name from ins), 'logo.png',
  'the owner sees the uploaded logo back via RETURNING, which the storage API needs to confirm the upload');

select set_config('storage.allow_delete_query', 'true', true);
with del as (
  delete from storage.objects where bucket_id = 'branding' and name = 'logo.png' returning name
)
select is((select name from del), 'logo.png',
  'the owner sees the removed logo name back via RETURNING, so remove() does not look like a silent no-op');

select lives_ok($$
  insert into storage.objects (bucket_id, name) values ('branding', 'logo-final.png')
$$, 'the owner leaves the current logo in the branding bucket');

select pg_temp.act_as('30000000-0000-0000-0000-000000000002');

select is((select legal_name from public.clinic_settings), 'Datos actualizados por la propietaria',
  'an active employee can read the clinic settings, which invoices and the booking page need');

select lives_ok($$ update public.clinic_settings set legal_name = 'Intento de empleada' $$,
  'RLS silently filters the update instead of raising, so the statement does not error');

select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('branding', 'intruso.png')
$$, '42501', null, 'an employee cannot upload to the branding bucket, only the owner can');

select is((select count(*) from storage.objects where bucket_id = 'branding')::bigint, 0::bigint,
  'an active employee cannot see the branding objects at all, even though the current logo exists');

select pg_temp.act_as('30000000-0000-0000-0000-000000000003');

select is((select count(*) from public.clinic_settings)::bigint, 0::bigint,
  'a deactivated employee sees no clinic settings');

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
