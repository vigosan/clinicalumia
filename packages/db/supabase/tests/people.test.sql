begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

insert into auth.users (id, email) values
  ('50000000-0000-0000-0000-000000000001', 'owner-people@test.local'),
  ('50000000-0000-0000-0000-000000000002', 'employee-people@test.local'),
  ('50000000-0000-0000-0000-000000000003', 'inactive-people@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('50000000-0000-0000-0000-000000000001', 'owner-people@test.local', 'Owner', 'owner', true),
  ('50000000-0000-0000-0000-000000000002', 'employee-people@test.local', 'Employee', 'employee', true),
  ('50000000-0000-0000-0000-000000000003', 'inactive-people@test.local', 'Inactive', 'employee', false);

insert into public.people (id, first_name, last_name, birth_date) values
  ('50000000-0000-0000-0000-0000000000a2', 'Persona', 'SinTutela', '1970-02-02');

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

select pg_temp.act_as('50000000-0000-0000-0000-000000000002');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date)
  values ('50000000-0000-0000-0000-0000000000a1', 'Ana', 'Ruiz', '1990-01-01')
$$, 'an active employee can register an adult person');

select is((select count(*) from public.people where id = '50000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'the employee can read the person she just created');

select lives_ok($$
  update public.people set address = 'Calle Mayor 1' where id = '50000000-0000-0000-0000-0000000000a1'
$$, 'an active employee can update a person');

select is((select address from public.people where id = '50000000-0000-0000-0000-0000000000a1'), 'Calle Mayor 1',
  'the update by the employee is persisted');

select lives_ok($$
  delete from public.people where id = '50000000-0000-0000-0000-0000000000a1'
$$, 'RLS silently filters the employee''s delete instead of raising, since only the owner may delete people');

reset role;
select is((select count(*) from public.people where id = '50000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'checked as postgres: the employee''s delete removed 0 rows, the person is still there');

select pg_temp.act_as('50000000-0000-0000-0000-000000000001');

select lives_ok($$
  delete from public.people where id = '50000000-0000-0000-0000-0000000000a2'
$$, 'the owner can delete a person who has no guardianship');

select is((select count(*) from public.people where id = '50000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'the delete by the owner is persisted');

select pg_temp.act_as('50000000-0000-0000-0000-000000000003');

select is((select count(*) from public.people), 0::bigint,
  'a deactivated employee sees no people at all, since clinical records need an active second factor');

select pg_temp.act_as('50000000-0000-0000-0000-000000000002');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, created_by)
  values ('50000000-0000-0000-0000-0000000000e2', 'Alguien', 'Suplantado', '1985-01-01',
    '50000000-0000-0000-0000-000000000001')
$$, 'an employee can insert a person even while trying to set created_by to someone else');

select is((select created_by from public.people where id = '50000000-0000-0000-0000-0000000000e2')::text,
  '50000000-0000-0000-0000-000000000002',
  'created_by is forced to the session''s own user, ignoring whatever the employee tried to spoof it with');

select lives_ok($$
  update public.people set created_by = '50000000-0000-0000-0000-000000000001'
  where id = '50000000-0000-0000-0000-0000000000e2'
$$, 'updating a person while trying to change created_by does not raise');

select is((select created_by from public.people where id = '50000000-0000-0000-0000-0000000000e2')::text,
  '50000000-0000-0000-0000-000000000002',
  'created_by stays pinned to whoever created the record, even across later updates by someone else');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, email)
  values ('50000000-0000-0000-0000-0000000000c1', 'Marta', 'Lopez', '1985-03-03', ' Ana@Example.COM ')
$$, 'inserting a spaced, mixed-case email succeeds');

select is((select email from public.people where id = '50000000-0000-0000-0000-0000000000c1'), 'ana@example.com',
  'the email is normalized to lowercase with no surrounding spaces, so lookups are case-insensitive');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, phone)
  values ('50000000-0000-0000-0000-0000000000d1', 'Persona', 'TelUno', '1985-01-01', '+34 614 55 28 08')
$$, 'inserting a spanish phone with the +34 prefix and spaces succeeds');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000d1'), '614552808',
  'a +34-prefixed spanish phone is stored without the country code, matching how staff dial it internally');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, phone)
  values ('50000000-0000-0000-0000-0000000000d2', 'Persona', 'TelDos', '1985-01-01', '0034-614-552-808')
$$, 'inserting the same spanish phone with the 0034 prefix and dashes succeeds');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000d2'), '614552808',
  'the 0034 prefix normalizes to the same 9-digit number as the +34 prefix, so both forms match on search');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, phone)
  values ('50000000-0000-0000-0000-0000000000d3', 'Persona', 'TelTres', '1985-01-01', '+44 20 7946 0958')
$$, 'inserting a foreign phone number succeeds');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000d3'), '+442079460958',
  'a non-spanish phone keeps its + country code, since only the spanish prefix is stripped');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, phone)
  values ('50000000-0000-0000-0000-0000000000e3', 'Persona', 'TelSoloMas', '1985-01-01', '+')
$$, 'inserting a lone plus sign as a phone succeeds');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000e3'), null::text,
  'a phone with no digits at all is stored as null, since a lone + is not a phone number');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, phone)
  values ('50000000-0000-0000-0000-0000000000e4', 'Persona', 'TelSoloGuion', '1985-01-01', ' - ')
$$, 'inserting a phone made only of punctuation succeeds');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000e4'), null::text,
  'a phone with no digits at all is stored as null, whatever punctuation surrounds it');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, tax_id, email, phone)
  values ('50000000-0000-0000-0000-0000000000e1', 'Persona', 'Vacia', '1985-01-01', '', '', '')
$$, 'inserting empty strings for tax id, email and phone succeeds');

select is((select tax_id from public.people where id = '50000000-0000-0000-0000-0000000000e1'), null::text,
  'an empty tax id is stored as null rather than an empty string, so it never collides with another empty tax id');

select is((select email from public.people where id = '50000000-0000-0000-0000-0000000000e1'), null::text,
  'an empty email is stored as null');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000e1'), null::text,
  'an empty phone is stored as null');

select throws_ok($$
  insert into public.people (id, first_name, last_name, birth_date)
  values ('50000000-0000-0000-0000-0000000000f1', '  ', 'Apellido', '1985-01-01')
$$, '23514', null, 'a blank first name is rejected, even though it is technically non-empty text');

select throws_ok($$
  insert into public.people (id, first_name, last_name, birth_date)
  values ('50000000-0000-0000-0000-0000000000f2', 'Nombre', 'Apellido', (now() at time zone 'Europe/Madrid')::date + 1)
$$, '23514', null, 'a birth date in the future is rejected, since nobody can be born tomorrow');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date)
  values ('50000000-0000-0000-0000-0000000000f4', 'Nombre', 'Madrid',
    (now() at time zone 'Europe/Madrid')::date)
$$, 'a birth date equal to today in Madrid is accepted, since the future-date check compares against the Madrid date, not the server''s date');

select throws_ok($$
  insert into public.people (id, first_name, last_name, is_patient)
  values ('50000000-0000-0000-0000-0000000000f3', 'Nombre', 'Apellido', true)
$$, '23514', null, 'a patient needs a birth date, since appointments and forms depend on it');

select lives_ok($$
  insert into public.people (id, first_name, last_name, birth_date, tax_id, phone)
  values ('50000000-0000-0000-0000-0000000000b1', 'María', 'García', '1975-07-07', ' 12.345.678-z ', '+34 614 55 28 08')
$$, 'inserting a person with accents, a dni and a phone succeeds');

select is((select tax_id from public.people where id = '50000000-0000-0000-0000-0000000000b1'), '12345678Z',
  'the tax id is normalized to uppercase digits with no separators, for exact matching later');

select is((select phone from public.people where id = '50000000-0000-0000-0000-0000000000b1'), '614552808',
  'her phone is normalized the same way as any other spanish number');

select throws_ok($$
  insert into public.people (id, first_name, last_name, birth_date, tax_id)
  values ('50000000-0000-0000-0000-0000000000b2', 'Otra', 'Duplicada', '1981-01-01', '12345678Z')
$$, '23505', null, 'two people cannot share the same normalized tax id, since it identifies one person');

select ok((select search_text from public.people where id = '50000000-0000-0000-0000-0000000000b1') like '%maria garcia%',
  'search_text drops accents and lowercases the name, so accent-insensitive search works');

select ok((select search_text from public.people where id = '50000000-0000-0000-0000-0000000000b1') like '%12345678z%',
  'search_text includes the normalized dni in lowercase');

select ok((select search_text from public.people where id = '50000000-0000-0000-0000-0000000000b1') like '%614552808%',
  'search_text includes the normalized phone');

select is((select count(*) from public.people where search_text ilike '%garcia%' and id = '50000000-0000-0000-0000-0000000000b1'), 1::bigint,
  'a plain ilike search without accents finds the person, which is the whole point of search_text');

insert into public.people (id, first_name, last_name, birth_date) values
  ('50000000-0000-0000-0000-0000000000c2', 'Nino', 'Menor', '2015-06-01'),
  ('50000000-0000-0000-0000-0000000000c3', 'Tutora', 'Primaria', '1980-04-04'),
  ('50000000-0000-0000-0000-0000000000c4', 'Tutor', 'Segundo', '1982-05-05');

select throws_ok($$
  insert into public.guardianships (minor_id, guardian_id, relationship)
  values ('50000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000c2', 'tutor_legal')
$$, '23514', null, 'a person cannot be their own guardian');

select lives_ok($$
  insert into public.guardianships (minor_id, guardian_id, relationship, is_primary)
  values ('50000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000c3', 'madre', true)
$$, 'assigning a primary guardian to a minor succeeds');

select throws_ok($$
  insert into public.guardianships (minor_id, guardian_id, relationship, is_primary)
  values ('50000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000c4', 'padre', true)
$$, '23505', null, 'a minor cannot have two primary guardians at the same time');

insert into public.people (id, first_name, last_name, birth_date) values
  ('50000000-0000-0000-0000-0000000000c5', 'Nino', 'MenorDos', '2016-06-01'),
  ('50000000-0000-0000-0000-0000000000c6', 'Tutor', 'ActivoDos', '1980-04-04'),
  ('50000000-0000-0000-0000-0000000000c7', 'Nino', 'MenorTres', '2017-06-01'),
  ('50000000-0000-0000-0000-0000000000c8', 'Tutor', 'InactivoDos', '1980-04-04');

insert into public.guardianships (minor_id, guardian_id, relationship) values
  ('50000000-0000-0000-0000-0000000000c5', '50000000-0000-0000-0000-0000000000c6', 'otro'),
  ('50000000-0000-0000-0000-0000000000c7', '50000000-0000-0000-0000-0000000000c8', 'otro');

select lives_ok($$
  delete from public.guardianships
  where minor_id = '50000000-0000-0000-0000-0000000000c5' and guardian_id = '50000000-0000-0000-0000-0000000000c6'
$$, 'an active employee can remove a guardian link without deleting either person');

select is((select count(*) from public.guardianships where minor_id = '50000000-0000-0000-0000-0000000000c5'), 0::bigint,
  'the guardian link removed by an active employee is gone');

select pg_temp.act_as('50000000-0000-0000-0000-000000000003');

select lives_ok($$
  delete from public.guardianships
  where minor_id = '50000000-0000-0000-0000-0000000000c7' and guardian_id = '50000000-0000-0000-0000-0000000000c8'
$$, 'RLS silently filters a deactivated employee''s delete instead of raising');

reset role;
select is((select count(*) from public.guardianships where minor_id = '50000000-0000-0000-0000-0000000000c7'), 1::bigint,
  'checked as postgres: the deactivated employee removed 0 rows, the guardian link is still there');

select pg_temp.act_as('50000000-0000-0000-0000-000000000001');

select throws_ok($$
  delete from public.people where id = '50000000-0000-0000-0000-0000000000c3'
$$, '23503', null, 'a guardian in charge of a minor cannot be deleted, or the minor would lose their record of tutelage');

select lives_ok($$
  delete from public.people where id = '50000000-0000-0000-0000-0000000000c2'
$$, 'the owner can delete the minor');

select is((select count(*) from public.guardianships where minor_id = '50000000-0000-0000-0000-0000000000c2'), 0::bigint,
  'deleting the minor cascades to remove their guardianship rows');

insert into public.people (id, first_name, last_name, birth_date, phone, archived_at) values
  ('50000000-0000-0000-0000-0000000000e5', 'Persona', 'Archivada', '1990-01-01', '600444555', now());

insert into public.people (id, first_name, last_name, birth_date, phone) values
  ('50000000-0000-0000-0000-0000000000e6', 'Persona', 'ParaExcluir', '1990-01-01', '600444666');

insert into public.people (id, first_name, last_name, birth_date, phone) values
  ('50000000-0000-0000-0000-0000000000e7', 'Tutora', 'ConMenor', '1980-01-01', '600444777');

insert into public.people (id, first_name, last_name, birth_date) values
  ('50000000-0000-0000-0000-0000000000e8', 'Menor', 'DeTutora', '2018-01-01');

insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('50000000-0000-0000-0000-0000000000e8', '50000000-0000-0000-0000-0000000000e7', 'madre', true);

insert into public.people (id, first_name, last_name, birth_date, archived_at) values
  ('50000000-0000-0000-0000-0000000000e9', 'MenorArchivado', 'DeTutora', '2019-01-01', now());

insert into public.guardianships (minor_id, guardian_id, relationship) values
  ('50000000-0000-0000-0000-0000000000e9', '50000000-0000-0000-0000-0000000000e7', 'madre');

select is(
  (select matched from public.find_possible_duplicates(null, null, '+34 614 55 28 08') where id = '50000000-0000-0000-0000-0000000000d1'),
  array['phone'],
  'searching by a formatted spanish phone finds the person whose normalized phone matches, flagged only on phone'
);

select is(
  (select matched from public.find_possible_duplicates(null, 'ANA@EXAMPLE.COM', null) where id = '50000000-0000-0000-0000-0000000000c1'),
  array['email'],
  'searching by an uppercase email finds the person whose normalized email matches, flagged only on email'
);

select is(
  (select matched from public.find_possible_duplicates('12.345.678-z', null, null) where id = '50000000-0000-0000-0000-0000000000b1'),
  array['tax_id'],
  'searching by a dni written with dots and a dash finds the person whose normalized tax id matches, flagged only on tax_id'
);

select is(
  (select matched from public.find_possible_duplicates('12345678Z', null, '614552808') where id = '50000000-0000-0000-0000-0000000000b1'),
  array['tax_id', 'phone'],
  'when both the tax id and the phone match the same person, matched reports both fields'
);

select is(
  (select archived from public.find_possible_duplicates(null, null, '600444555') where id = '50000000-0000-0000-0000-0000000000e5'),
  true,
  'an archived person still appears among possible duplicates, flagged as archived, so the team can unarchive her instead of creating a second record');

select is(
  (select archived from public.find_possible_duplicates('12345678Z', null, null) where id = '50000000-0000-0000-0000-0000000000b1'),
  false,
  'an active person is flagged as not archived');

insert into public.people (id, first_name, last_name, birth_date) values
  ('50000000-0000-0000-0000-0000000000ea', 'Elena', 'Gómez Díaz', '1990-03-22');

insert into public.people (id, first_name, last_name, birth_date, archived_at) values
  ('50000000-0000-0000-0000-0000000000eb', 'Lucía', 'Pérez', '1985-05-05', now());

select is(
  (select matched from public.find_possible_duplicates(null, null, null, null, 'ELENA', ' gomez  diaz ', '1990-03-22') where id = '50000000-0000-0000-0000-0000000000ea'),
  array['name_birth_date'],
  'the same name and birth date written without accents, in capitals and with extra spaces is reported as a match, since minors rarely have a dni, email or phone');

select is(
  (select count(*) from public.find_possible_duplicates(null, null, null, null, 'Elena', 'Gómez Díaz', '1990-03-23')), 0::bigint,
  'the same name with another birth date is a different person, so nothing is reported');

select is(
  (select count(*) from public.find_possible_duplicates(null, null, null, null, 'Elena', 'Gómez Díaz', null)), 0::bigint,
  'a name alone is too common to warn about, the birth date is required for the name match');

select is(
  (select matched::text || ':' || archived::text from public.find_possible_duplicates(null, null, null, null, 'lucia', 'PEREZ', '1985-05-05') where id = '50000000-0000-0000-0000-0000000000eb'),
  '{name_birth_date}:true',
  'an archived person is found by name and birth date too, flagged as archived');

select is(
  (select matched from public.find_possible_duplicates(null, null, '614552808', null, 'Elena', 'Gomez Diaz', '1990-03-22') where id = '50000000-0000-0000-0000-0000000000ea'),
  array['name_birth_date'],
  'combining a phone that belongs to another person with a name and date still reports each person once, with only the field that matched her');

select is((select count(*) from public.find_possible_duplicates(null, null, '600444666', '50000000-0000-0000-0000-0000000000e6')), 0::bigint,
  'p_exclude removes the person''s own record from her own duplicate search');

select is(
  (select wards from public.find_possible_duplicates(null, null, '600444777') where id = '50000000-0000-0000-0000-0000000000e7'),
  '[{"name": "Menor DeTutora", "relationship": "madre"}]'::jsonb,
  'a guardian''s duplicate row lists the full name and relationship of the minor she is responsible for, excluding an archived ward of hers'
);

select is(
  (select jsonb_array_length((select wards from public.find_possible_duplicates(null, null, '600444777') where id = '50000000-0000-0000-0000-0000000000e7'))),
  1,
  'an archived minor is excluded from wards even though her guardianship row still exists'
);

select pg_temp.act_as('50000000-0000-0000-0000-000000000003');

select is((select count(*) from public.find_possible_duplicates(null, null, '614552808')), 0::bigint,
  'a deactivated employee finds no possible duplicates at all, since the function runs with her own RLS-restricted privileges');

select is((select count(*) from public.find_possible_duplicates(null, null, null, null, 'Elena', 'Gómez Díaz', '1990-03-22')), 0::bigint,
  'a deactivated employee cannot probe who is a patient by name and birth date either');

reset role;
insert into auth.users (id, email) values ('50000000-0000-0000-0000-000000000004', 'paciente-people@test.local');
insert into public.patient_accounts (id, email) values ('50000000-0000-0000-0000-000000000004', 'paciente-people@test.local');
select pg_temp.act_as('50000000-0000-0000-0000-000000000004');

select is((select count(*) from public.find_possible_duplicates(null, null, null, null, 'Elena', 'Gómez Díaz', '1990-03-22')), 0::bigint,
  'a signed-in patient cannot use the duplicate search to find out whether someone else is a patient of the clinic');

reset role;
select is(has_function_privilege('anon', 'public.find_possible_duplicates(text, text, text, uuid, text, text, date)', 'execute'), false,
  'an anonymous visitor cannot call the duplicate search');

select is(has_function_privilege('anon', 'public.normalize_person_name(text)', 'execute'), false,
  'an anonymous visitor cannot call the name normalizer either, the database only exposes what the app needs');

select is((select count(*) from pg_indexes where schemaname = 'public' and tablename = 'people' and indexdef like '%(birth_date)%'), 1::bigint,
  'people has an index on birth_date, so the name and birth date match does not scan every record');

select pg_temp.act_as('50000000-0000-0000-0000-000000000001');

select is((select count(*) from public.find_possible_duplicates(null, null, null)), 0::bigint,
  'with every parameter empty there is nothing to match against, so no rows come back');

select * from finish();
rollback;
