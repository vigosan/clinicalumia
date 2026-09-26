-- Seed data for local development.
-- Runs after migrations on `make db.reset`. LOCAL ONLY: never pushed to remote DBs.

insert into public.specialties (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000001a', 'Logopedia', 'logopedia'),
  ('a0000000-0000-0000-0000-00000000001b', 'Psicología', 'psicologia'),
  ('a0000000-0000-0000-0000-00000000001c', 'Fisioterapia', 'fisioterapia')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'info@clinicalumia.es', extensions.crypt('lumia-desarrollo-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'psicologia@lumia.test', extensions.crypt('lumia-desarrollo-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'fisioterapia@lumia.test', extensions.crypt('lumia-desarrollo-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'email',
   '{"sub":"a0000000-0000-0000-0000-000000000001","email":"info@clinicalumia.es"}', now(), now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'email',
   '{"sub":"a0000000-0000-0000-0000-000000000002","email":"psicologia@lumia.test"}', now(), now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'email',
   '{"sub":"a0000000-0000-0000-0000-000000000003","email":"fisioterapia@lumia.test"}', now(), now())
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, email, full_name, role, specialty_id, is_active) values
  ('a0000000-0000-0000-0000-000000000001', 'info@clinicalumia.es', 'Patricia Hernán', 'owner',
   'a0000000-0000-0000-0000-00000000001a', true),
  ('a0000000-0000-0000-0000-000000000002', 'psicologia@lumia.test', 'Laura Ejemplo', 'employee',
   'a0000000-0000-0000-0000-00000000001b', true),
  ('a0000000-0000-0000-0000-000000000003', 'fisioterapia@lumia.test', 'Marc Ejemplo', 'employee',
   'a0000000-0000-0000-0000-00000000001c', true)
on conflict (id) do nothing;
