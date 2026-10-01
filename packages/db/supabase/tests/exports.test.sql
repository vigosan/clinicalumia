begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('8c000000-0000-0000-0000-000000000001', 'propietaria-exportaciones@test.local'),
  ('8c000000-0000-0000-0000-000000000002', 'empleada-exportaciones@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('8c000000-0000-0000-0000-000000000001', 'propietaria-exportaciones@test.local', 'Propietaria Exportaciones', 'owner', true),
  ('8c000000-0000-0000-0000-000000000002', 'empleada-exportaciones@test.local', 'Empleada Exportaciones', 'employee', true);

insert into storage.objects (bucket_id, name)
values ('exports', '8c000000-0000-0000-0000-000000000099/ajena.zip');

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

select pg_temp.act_as('8c000000-0000-0000-0000-000000000001');

select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('exports', '8c000000-0000-0000-0000-000000000001/trimestre.zip')
$$, 'the owner can upload a ZIP into her own folder');

select is((select count(*) from storage.objects
  where bucket_id = 'exports' and name = '8c000000-0000-0000-0000-000000000001/trimestre.zip')::bigint, 1::bigint,
  'the owner sees the ZIP she just uploaded in her own folder');

select set_config('storage.allow_delete_query', 'true', true);
with del as (
  delete from storage.objects
  where bucket_id = 'exports' and name = '8c000000-0000-0000-0000-000000000001/trimestre.zip'
  returning name
)
select is((select name from del), '8c000000-0000-0000-0000-000000000001/trimestre.zip',
  'the owner can delete a ZIP from her own folder, which clears the previous export before a new one');

select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('exports', '8c000000-0000-0000-0000-000000000099/intento.zip')
$$, '42501', null, 'the owner cannot upload into a folder that is not her own user id');

select is((select count(*) from storage.objects
  where bucket_id = 'exports' and name = '8c000000-0000-0000-0000-000000000099/ajena.zip')::bigint, 0::bigint,
  'the owner cannot see a ZIP in a folder that is not her own user id');

with del as (
  delete from storage.objects
  where bucket_id = 'exports' and name = '8c000000-0000-0000-0000-000000000099/ajena.zip'
  returning name
)
select is((select count(*) from del)::bigint, 0::bigint,
  'the owner cannot delete a ZIP from a folder that is not her own user id, so the delete silently affects no row');

select pg_temp.act_as('8c000000-0000-0000-0000-000000000002');

select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('exports', '8c000000-0000-0000-0000-000000000002/empleada.zip')
$$, '42501', null, 'an active employee cannot upload to the exports bucket, even into a folder named after her own id');

select is((select count(*) from storage.objects where bucket_id = 'exports')::bigint, 0::bigint,
  'an active employee cannot see any export, including the owner''s');

reset role;
select set_config('request.jwt.claims', '', true);

set local role anon;
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('exports', '8c000000-0000-0000-0000-000000000003/anonimo.zip')
$$, '42501', null, 'an anonymous visitor cannot upload to the exports bucket');
select is((select count(*) from storage.objects where bucket_id = 'exports')::bigint, 0::bigint,
  'an anonymous visitor cannot see any export');
reset role;

select is((select public from storage.buckets where id = 'exports'), false,
  'the exports bucket is private, so a ZIP can never be reached by a public URL');
select is((select file_size_limit from storage.buckets where id = 'exports'), 52428800::bigint,
  'the exports bucket caps each ZIP at 50 MB, the Supabase free plan''s global upload limit');
select is((select allowed_mime_types from storage.buckets where id = 'exports'), array['application/zip'],
  'the exports bucket only accepts ZIPs');

select * from finish();
rollback;
