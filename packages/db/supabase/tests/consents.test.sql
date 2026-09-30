begin;
create extension if not exists pgtap with schema extensions;
select plan(64);

create or replace function pg_temp.years_ago(years int) returns date language sql stable as $$
  select ((now() at time zone 'Europe/Madrid')::date - make_interval(years => years))::date
$$;

insert into auth.users (id, email) values
  ('89000000-0000-0000-0000-000000000001', 'empleada-consentimientos@test.local'),
  ('89000000-0000-0000-0000-000000000010', 'paciente-consentimientos@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('89000000-0000-0000-0000-000000000001', 'empleada-consentimientos@test.local', 'Empleada Consentimientos', 'employee', true);
insert into public.patient_accounts (id, email) values
  ('89000000-0000-0000-0000-000000000010', 'paciente-consentimientos@test.local');

insert into public.people (id, first_name, last_name, birth_date, tax_id, email, is_patient, archived_at) values
  ('89000000-0000-0000-0000-0000000000a1', 'Adulta', 'Dni', '1985-03-03', '89000001A', 'adulta-consentimientos@test.local', true, null),
  ('89000000-0000-0000-0000-0000000000a2', 'Archivada', 'Dni', '1970-01-01', '89000002A', null, true, now()),
  ('89000000-0000-0000-0000-0000000000a3', 'Archivada', 'Email', '1971-01-01', null, 'archivada-consentimientos@test.local', true, now()),
  ('89000000-0000-0000-0000-0000000000a4', 'Por', 'Email', '1990-02-02', null, 'email-consentimientos@test.local', true, null),
  ('89000000-0000-0000-0000-0000000000a5', 'Gemela', 'Una', '2012-07-07', null, 'familia-consentimientos@test.local', true, null),
  ('89000000-0000-0000-0000-0000000000a6', 'Gemela', 'Dos', '2012-07-07', null, 'familia-consentimientos@test.local', true, null),
  ('89000000-0000-0000-0000-0000000000a7', 'Borrable', 'Ficha', '1995-05-05', null, null, true, null),
  ('89000000-0000-0000-0000-0000000000b1', 'Tutor', 'Uno', '1980-01-01', '89000011B', null, false, null),
  ('89000000-0000-0000-0000-0000000000b2', 'Menor', 'Uno', pg_temp.years_ago(10), null, null, true, null),
  ('89000000-0000-0000-0000-0000000000b3', 'Tutora', 'Dos', '1979-01-01', '89000012B', null, false, null),
  ('89000000-0000-0000-0000-0000000000b4', 'Mellizo', 'Uno', pg_temp.years_ago(9), null, null, true, null),
  ('89000000-0000-0000-0000-0000000000b5', 'Mellizo', 'Dos', pg_temp.years_ago(9), null, null, true, null),
  ('89000000-0000-0000-0000-0000000000b6', 'Tutor', 'Tres', null, '89000013B', null, false, null),
  ('89000000-0000-0000-0000-0000000000b7', 'Menor', 'Archivada', pg_temp.years_ago(11), null, null, true, now()),
  ('89000000-0000-0000-0000-0000000000b8', 'Menor', 'Activa', pg_temp.years_ago(11), null, null, true, null),
  ('89000000-0000-0000-0000-0000000000b9', 'Tutora', 'Cuatro', '1975-01-01', '89000014B', null, false, null),
  ('89000000-0000-0000-0000-0000000000ba', 'Hija', 'Adulta', '2000-01-01', null, null, true, null),
  ('89000000-0000-0000-0000-0000000000a8', 'Gemelo', 'Registrado', '2013-08-08', '89000003A', 'otra-familia-consentimientos@test.local', true, null);
insert into public.guardianships (minor_id, guardian_id, relationship, is_primary) values
  ('89000000-0000-0000-0000-0000000000b2', '89000000-0000-0000-0000-0000000000b1', 'padre', true),
  ('89000000-0000-0000-0000-0000000000b4', '89000000-0000-0000-0000-0000000000b3', 'madre', true),
  ('89000000-0000-0000-0000-0000000000b5', '89000000-0000-0000-0000-0000000000b3', 'madre', true),
  ('89000000-0000-0000-0000-0000000000b7', '89000000-0000-0000-0000-0000000000b6', 'padre', true),
  ('89000000-0000-0000-0000-0000000000b8', '89000000-0000-0000-0000-0000000000b6', 'padre', true),
  ('89000000-0000-0000-0000-0000000000ba', '89000000-0000-0000-0000-0000000000b9', 'madre', true);

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

select enum_has_labels('public', 'consent_link_method', array['auto_tax_id', 'auto_guardian', 'auto_email', 'manual'],
  'a consent records whether its person was found by DNI, by a guardian''s DNI, by email or chosen by the team');

select results_eq(
  $$ select person_id, method::text from public.match_consent_person('89000001A', null, '1985-03-03', 'Adulta') $$,
  $$ values ('89000000-0000-0000-0000-0000000000a1'::uuid, 'auto_tax_id') $$,
  'a DNI and birth date that both match an adult link the consent to her');
select is((select count(*) from public.match_consent_person('89000001A', null, '1985-03-04', 'Adulta')), 0::bigint,
  'a DNI that matches someone with a different birth date may be a typo of another person''s DNI, so it stays pending');
select is((select count(*) from public.match_consent_person('89000001A', 'email-consentimientos@test.local', '1990-02-02', 'Por')), 0::bigint,
  'a DNI that belongs to someone else never falls through to the email rule, so a typo cannot link the consent by email');
select results_eq(
  $$ select person_id, method::text from public.match_consent_person(' 8900 0001-a ', null, '1985-03-03', 'Adulta') $$,
  $$ values ('89000000-0000-0000-0000-0000000000a1'::uuid, 'auto_tax_id') $$,
  'a DNI typed in lowercase with spaces or a hyphen is normalized like the person''s record, so it still matches');

select results_eq(
  $$ select person_id, method::text from public.match_consent_person('89000011B', null, pg_temp.years_ago(10), 'Menor') $$,
  $$ values ('89000000-0000-0000-0000-0000000000b2'::uuid, 'auto_guardian') $$,
  'a minor''s consent signed with her guardian''s DNI links to that minor, the only ward with that birth date');
select is((select count(*) from public.match_consent_person('89000011B', null, pg_temp.years_ago(10), 'Otro')), 0::bigint,
  'a guardian''s DNI with the ward''s birth date but another first name may be a different child, so it stays pending');
select is((select count(*) from public.match_consent_person('89000012B', null, pg_temp.years_ago(9), 'Mellizo')), 0::bigint,
  'a guardian with two wards born the same day cannot tell which one signed, so it stays pending');
select results_eq(
  $$ select person_id, method::text from public.match_consent_person('89000013B', null, pg_temp.years_ago(11), 'Menor') $$,
  $$ values ('89000000-0000-0000-0000-0000000000b8'::uuid, 'auto_guardian') $$,
  'an archived ward does not count, so the guardian''s only active ward with that birth date is linked');
select is((select count(*) from public.match_consent_person('89000014B', null, '2000-01-01', 'Hija')), 0::bigint,
  'a ward who is already an adult signs for herself, so a consent with her parent''s DNI is not linked to her');

select results_eq(
  $$ select person_id, method::text from public.match_consent_person('89999999Z', 'Email-Consentimientos@test.local', '1990-02-02', 'Por') $$,
  $$ values ('89000000-0000-0000-0000-0000000000a4'::uuid, 'auto_email') $$,
  'with no DNI match, a single person with the same email, in any case, and birth date is linked by email');
select results_eq(
  $$ select person_id, method::text from public.match_consent_person('89999999Z', 'email-consentimientos@test.local', '1990-02-02', ' PÓR ') $$,
  $$ values ('89000000-0000-0000-0000-0000000000a4'::uuid, 'auto_email') $$,
  'a first name typed with other accents, case or spaces is still the same person');
select is((select count(*) from public.match_consent_person('89999999Z', 'email-consentimientos@test.local', '1990-02-02', 'Otra')), 0::bigint,
  'a sibling without a DNI who shares the family email and birth date but has another first name is never linked to her twin');
select is((select count(*) from public.match_consent_person('89999999Z', 'familia-consentimientos@test.local', '2012-07-07', 'Gemela')), 0::bigint,
  'twins sharing a family email and birth date cannot be told apart, so the consent stays pending');
select is((select count(*) from public.match_consent_person('89999998Z', 'otra-familia-consentimientos@test.local', '2013-08-08', 'Gemelo')), 0::bigint,
  'a person with a DNI on record would have matched by DNI if she had signed, so a twin signing with her own DNI is never linked to her by the shared email');
select is((select count(*) from public.match_consent_person('89999999Z', 'email-consentimientos@test.local', '1990-02-03', 'Por')), 0::bigint,
  'an email match with a different birth date is not safe enough to link');
select is((select count(*) from public.match_consent_person('89999999Z', null, '1990-02-02', 'Por')), 0::bigint,
  'with no DNI match and no email there is nothing to match on');

select is((select count(*) from public.match_consent_person('89000002A', null, '1970-01-01', 'Archivada')), 0::bigint,
  'an archived person is never linked automatically, even with her DNI and birth date');
select is((select count(*) from public.match_consent_person('89999999Z', 'archivada-consentimientos@test.local', '1971-01-01', 'Archivada')), 0::bigint,
  'an archived person is never linked automatically by email either');

select is(has_function_privilege('authenticated', 'public.match_consent_person(text, text, date, text)', 'execute'), false,
  'a signed-in user cannot probe which person owns a DNI');
select is(has_function_privilege('anon', 'public.match_consent_person(text, text, date, text)', 'execute'), false,
  'an anonymous visitor cannot probe which person owns a DNI');
select is(has_function_privilege('service_role', 'public.match_consent_person(text, text, date, text)', 'execute'), true,
  'the web server, with the service role, can match a signed consent to its person');

set local role service_role;
select results_eq(
  $$ select person_id, method::text from public.match_consent_person('89000001A', null, '1985-03-03', 'Adulta') $$,
  $$ values ('89000000-0000-0000-0000-0000000000a1'::uuid, 'auto_tax_id') $$,
  'the service role reads people through the function even though it runs the match outside any staff session');
reset role;

insert into public.consents (id, signed_at, first_name, last_name, birth_date, tax_id, email, marketing, media_for_training, pdf_path) values
  ('89000000-0000-0000-0000-0000000000f1', now(), 'Adulta', 'Dni', '1985-03-03', '89000001A', null, false, false,
   'consents/2026/09/89000000-0000-0000-0000-0000000000f1.pdf');
insert into storage.objects (bucket_id, name) values
  ('consents', 'consents/2026/09/89000000-0000-0000-0000-0000000000f1.pdf');

insert into public.consents (id, signed_at, first_name, last_name, birth_date, tax_id, email, marketing, media_for_training, pdf_path) values
  ('89000000-0000-0000-0000-0000000000f2', now(), 'Lucía', 'Martínez Soler', '1985-03-03', '89000021C', null, false, false,
   '2026/09/89000000-0000-0000-0000-0000000000f2.pdf');
select is((select search_text from public.consents where id = '89000000-0000-0000-0000-0000000000f2'), 'lucia martinez soler 89000021c',
  'the staff search finds a consent by full name without accents or by DNI, the same way it finds people');

insert into public.consents (id, signed_at, first_name, last_name, birth_date, tax_id, email, marketing, media_for_training, pdf_path) values
  ('89000000-0000-0000-0000-0000000000f3', now(), 'Con', 'Puntos', '1985-03-03', '12.345.678-z', null, false, false,
   '2026/09/89000000-0000-0000-0000-0000000000f3.pdf');
select is((select count(*) from public.consents where search_text ilike '%' || lower('12345678Z') || '%'), 1::bigint,
  'a consent whose DNI was stored with dots or dashes is still found by the plain DNI staff type');

select is((select public from storage.buckets where id = 'consents'), false,
  'the consents bucket is private, so a signed PDF can never be reached by a public URL');
select is((select allowed_mime_types from storage.buckets where id = 'consents'), array['application/pdf'],
  'the consents bucket only holds PDFs');
select is((select file_size_limit from storage.buckets where id = 'consents'), 5242880::bigint,
  'the consents bucket caps each PDF at 5 MB');

select throws_ok(
  $$ insert into public.consents (signed_at, first_name, last_name, birth_date, tax_id, marketing, media_for_training, pdf_path, person_id)
     values (now(), 'Sin', 'Metodo', '1985-03-03', 'X', false, false, 'x.pdf', '89000000-0000-0000-0000-0000000000a1') $$,
  '23514', null, 'a consent linked to a person must say how it was linked');
select throws_ok(
  $$ insert into public.consents (signed_at, first_name, last_name, birth_date, tax_id, marketing, media_for_training, pdf_path, link_method)
     values (now(), 'Sin', 'Persona', '1985-03-03', 'X', false, false, 'x.pdf', 'manual') $$,
  '23514', null, 'a consent cannot claim a link method without a linked person');

select is(has_table_privilege('authenticated', 'public.consents', 'insert'), false,
  'no client inserts consents; only the web server stores them with the service role');
select is(has_table_privilege('authenticated', 'public.consents', 'update'), false,
  'no client updates consents directly; links go through link_consent and unlink_consent');
select is(has_table_privilege('authenticated', 'public.consents', 'delete'), false,
  'no client deletes a signed consent');
select is(has_table_privilege('anon', 'public.consents', 'select'), false,
  'an anonymous visitor has no access to consents at all');

set local role anon;
select throws_ok($$ select count(*) from public.consents $$, '42501', null,
  'an anonymous visitor cannot read signed consents');
select is((select count(*) from storage.objects where bucket_id = 'consents'), 0::bigint,
  'an anonymous visitor cannot see signed consent PDFs');
reset role;

select pg_temp.act_as_patient('89000000-0000-0000-0000-000000000010');
select is((select count(*) from public.consents), 0::bigint,
  'a signed-in patient cannot read anyone''s consents, not even her own');
select is((select count(*) from storage.objects where bucket_id = 'consents'), 0::bigint,
  'a signed-in patient cannot see signed consent PDFs');
select throws_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'a patient cannot link a consent to a person');
select throws_ok($$ select public.unlink_consent('89000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'a patient cannot unlink a consent');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('89000000-0000-0000-0000-000000000001', 'aal1');
select is((select count(*) from public.consents), 0::bigint,
  'an employee who has not passed the second factor cannot read consents');
select is((select count(*) from storage.objects where bucket_id = 'consents'), 0::bigint,
  'an employee who has not passed the second factor cannot see consent PDFs');
select throws_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'an employee without the second factor cannot link a consent');
select throws_ok($$ select public.unlink_consent('89000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'an employee without the second factor cannot unlink a consent');
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('89000000-0000-0000-0000-000000000001');
select is((select count(*) from public.consents where id = '89000000-0000-0000-0000-0000000000f1'), 1::bigint,
  'an active employee with the second factor reads the signed consents');
select is((select count(*) from storage.objects where bucket_id = 'consents'), 1::bigint,
  'an active employee with the second factor sees the consent PDFs, so the panel can sign a short-lived URL');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('consents', 'consents/2026/09/intruso.pdf') $$,
  '42501', null, 'not even an active employee uploads to the consents bucket; only the web server writes there');

select lives_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a1') $$,
  'an active employee links a pending consent to a person');
select results_eq(
  $$ select person_id, link_method::text, linked_by, linked_at is not null from public.consents where id = '89000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('89000000-0000-0000-0000-0000000000a1'::uuid, 'manual', '89000000-0000-0000-0000-000000000001'::uuid, true) $$,
  'a manual link records who linked it and when, so the team can audit it');
select throws_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a4') $$,
  'P0001', 'consent_already_linked', 'a consent already linked must be unlinked first, so a link is never silently overwritten');
select is((select person_id from public.consents where id = '89000000-0000-0000-0000-0000000000f1'), '89000000-0000-0000-0000-0000000000a1'::uuid,
  'the refused relink leaves the original link untouched');
select throws_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'person_not_found', 'a consent cannot be linked to an archived person');
select throws_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-00000000ffff') $$,
  'P0001', 'person_not_found', 'a consent cannot be linked to a person that does not exist');
select throws_ok($$ select public.link_consent('89000000-0000-0000-0000-00000000ffff', '89000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'consent_not_found', 'linking a consent that does not exist is reported instead of silently doing nothing');

select lives_ok($$ select public.unlink_consent('89000000-0000-0000-0000-0000000000f1') $$,
  'an active employee unlinks a consent that was linked to the wrong person');
select results_eq(
  $$ select person_id, link_method::text, linked_by, linked_at from public.consents where id = '89000000-0000-0000-0000-0000000000f1' $$,
  $$ values (null::uuid, null::text, null::uuid, null::timestamptz) $$,
  'unlinking clears the person and every trace of the previous link, so it shows as pending again');
select throws_ok($$ select public.unlink_consent('89000000-0000-0000-0000-00000000ffff') $$,
  'P0001', 'consent_not_found', 'unlinking a consent that does not exist is reported instead of silently doing nothing');

select lives_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a7') $$,
  'an active employee links the consent to a person who will later be deleted');
reset role;
select set_config('request.jwt.claims', '', true);

delete from public.people where id = '89000000-0000-0000-0000-0000000000a7';
select results_eq(
  $$ select person_id, link_method::text, linked_by, linked_at from public.consents where id = '89000000-0000-0000-0000-0000000000f1' $$,
  $$ values (null::uuid, null::text, null::uuid, null::timestamptz) $$,
  'deleting the linked person keeps the signed consent and leaves it pending, never half-linked');

select pg_temp.act_as('89000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.link_consent('89000000-0000-0000-0000-0000000000f1', '89000000-0000-0000-0000-0000000000a1') $$,
  'a consent left pending by a deleted person can be linked again');
select is((select person_id from public.consents where id = '89000000-0000-0000-0000-0000000000f1'), '89000000-0000-0000-0000-0000000000a1'::uuid,
  'the relinked consent points to its new person');
reset role;
select set_config('request.jwt.claims', '', true);

select is(has_function_privilege('anon', 'public.link_consent(uuid, uuid)', 'execute'), false,
  'an anonymous visitor cannot link consents');
select is(has_function_privilege('anon', 'public.unlink_consent(uuid)', 'execute'), false,
  'an anonymous visitor cannot unlink consents');
select is(has_function_privilege('authenticated', 'public.link_consent(uuid, uuid)', 'execute'), true,
  'signed-in staff can call link_consent, which then checks they are active staff');

select * from finish();
rollback;
