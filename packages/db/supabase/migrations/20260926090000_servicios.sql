create type public.vat_treatment as enum ('exempt', 'standard_21');
create type public.booking_payment as enum ('none', 'fixed', 'percent', 'full');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  vat public.vat_treatment not null default 'exempt',
  bookable_online boolean not null default false,
  booking_payment public.booking_payment not null default 'none',
  booking_payment_value integer not null default 0,
  cancellation_hours integer check (cancellation_hours between 0 and 720),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (specialty_id, name),
  constraint services_booking_payment_value check (
    (booking_payment in ('none', 'full') and booking_payment_value = 0)
    or (booking_payment = 'fixed' and booking_payment_value > 0 and booking_payment_value <= price_cents)
    or (booking_payment = 'percent' and booking_payment_value between 1 and 100)
  )
);

create index services_specialty_idx on public.services(specialty_id);

create trigger services_touch
  before update on public.services
  for each row execute function public.touch_updated_at();

alter table public.services enable row level security;

create policy "services_select_active_staff"
  on public.services for select to authenticated
  using (public.is_active_staff());

create policy "services_insert_owner"
  on public.services for insert to authenticated
  with check (public.is_owner());

create policy "services_update_owner"
  on public.services for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "services_delete_owner"
  on public.services for delete to authenticated
  using (public.is_owner());
