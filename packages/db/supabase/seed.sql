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

insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value) values
  ('a0000000-0000-0000-0000-0000000005a1', 'a0000000-0000-0000-0000-00000000001a', 'Valoración inicial', 60, 6000, 'exempt', true, 'fixed', 1000),
  ('a0000000-0000-0000-0000-0000000005a2', 'a0000000-0000-0000-0000-00000000001a', 'Sesión de logopedia', 45, 4000, 'exempt', true, 'none', 0),
  ('a0000000-0000-0000-0000-0000000005b1', 'a0000000-0000-0000-0000-00000000001b', 'Psicoterapia individual', 60, 5500, 'exempt', true, 'percent', 20),
  ('a0000000-0000-0000-0000-0000000005b2', 'a0000000-0000-0000-0000-00000000001b', 'Informe psicológico no sanitario', 60, 9000, 'standard_21', false, 'none', 0),
  ('a0000000-0000-0000-0000-0000000005c1', 'a0000000-0000-0000-0000-00000000001c', 'Sesión individual de fisioterapia', 60, 4500, 'exempt', true, 'fixed', 1000),
  ('a0000000-0000-0000-0000-0000000005c2', 'a0000000-0000-0000-0000-00000000001c', 'Sesión de control', 30, 3000, 'exempt', true, 'none', 0)
on conflict (id) do nothing;

insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
select profile_id, weekday, '15:15', '20:30'
from (values ('a0000000-0000-0000-0000-000000000001'::uuid), ('a0000000-0000-0000-0000-000000000002'::uuid), ('a0000000-0000-0000-0000-000000000003'::uuid)) as p(profile_id)
cross join generate_series(1, 5) as weekday;

insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('a0000000-0000-0000-0000-000000000001', 2, '09:30', '13:30'),
  ('a0000000-0000-0000-0000-000000000001', 4, '09:30', '13:30');

insert into public.employee_time_off (profile_id, starts_at, ends_at, reason) values
  ('a0000000-0000-0000-0000-000000000003', '2026-12-24 00:00+01', '2026-12-26 23:59+01', 'Navidad');

update public.clinic_settings set
  legal_name = 'Patricia Hernán Sánchez',
  tax_id = '20449989E',
  address_line = 'Calle Montesa 7',
  postal_code = '46800',
  city = 'Xàtiva',
  province = 'Valencia',
  phone = '614 552 808',
  email = 'info@clinicalumia.es',
  website = 'https://www.clinicalumia.es',
  cancellation_hours = 24;
