begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select is((select count(*) from public.specialties)::bigint, 3::bigint,
  'the local seed creates exactly three specialties');

select is((select count(*) from public.specialties where name = 'Logopedia' and slug = 'logopedia')::bigint, 1::bigint,
  'Logopedia/logopedia exists');
select is((select count(*) from public.specialties where name = 'Psicología' and slug = 'psicologia')::bigint, 1::bigint,
  'Psicología/psicologia exists');
select is((select count(*) from public.specialties where name = 'Fisioterapia' and slug = 'fisioterapia')::bigint, 1::bigint,
  'Fisioterapia/fisioterapia exists');

select is((select count(*) from auth.users where email in
  ('info@clinicalumia.es', 'psicologia@lumia.test', 'fisioterapia@lumia.test'))::bigint, 3::bigint,
  'the owner and the two example employees exist in auth.users');

select is((select p.full_name from public.profiles p where p.email = 'info@clinicalumia.es'),
  'Patricia Hernán', 'the owner profile has the right name');
select is((select p.role::text from public.profiles p where p.email = 'info@clinicalumia.es'),
  'owner', 'the owner profile has the owner role');
select is((select p.is_active from public.profiles p where p.email = 'info@clinicalumia.es'),
  true, 'the owner profile is active');
select is((select s.name from public.profiles p join public.specialties s on s.id = p.specialty_id
  where p.email = 'info@clinicalumia.es'),
  'Logopedia', 'the owner profile has the Logopedia specialty');

select is((select p.full_name from public.profiles p where p.email = 'psicologia@lumia.test'),
  'Laura Ejemplo', 'the psicología example employee has the right name');
select is((select p.role::text from public.profiles p where p.email = 'psicologia@lumia.test'),
  'employee', 'the psicología example employee has the employee role');
select is((select p.is_active from public.profiles p where p.email = 'psicologia@lumia.test'),
  true, 'the psicología example employee is active');
select is((select s.name from public.profiles p join public.specialties s on s.id = p.specialty_id
  where p.email = 'psicologia@lumia.test'),
  'Psicología', 'the psicología example employee has the Psicología specialty');

select is((select p.full_name from public.profiles p where p.email = 'fisioterapia@lumia.test'),
  'Marc Ejemplo', 'the fisioterapia example employee has the right name');
select is((select p.role::text from public.profiles p where p.email = 'fisioterapia@lumia.test'),
  'employee', 'the fisioterapia example employee has the employee role');
select is((select p.is_active from public.profiles p where p.email = 'fisioterapia@lumia.test'),
  true, 'the fisioterapia example employee is active');
select is((select s.name from public.profiles p join public.specialties s on s.id = p.specialty_id
  where p.email = 'fisioterapia@lumia.test'),
  'Fisioterapia', 'the fisioterapia example employee has the Fisioterapia specialty');

select is((select count(*) from public.profiles)::bigint, 3::bigint,
  'the local seed creates exactly three profiles');

select is((select count(*) from auth.identities where provider = 'email' and provider_id in
  (select id::text from auth.users where email in
    ('info@clinicalumia.es', 'psicologia@lumia.test', 'fisioterapia@lumia.test')))::bigint, 3::bigint,
  'each seeded user has a matching email identity');

select is((select count(*) from auth.users where email = 'info@clinicalumia.es' and email_confirmed_at is not null)::bigint, 1::bigint,
  'the owner email is confirmed so password login works');

select * from finish();
rollback;
