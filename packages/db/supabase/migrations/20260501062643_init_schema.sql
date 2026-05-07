-- Initial domain schema: roles, specialties and profiles linked to auth.users.

create type public.user_role as enum ('owner', 'doctor');

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'doctor',
  specialty_id uuid references public.specialties(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_specialty_idx on public.profiles(specialty_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger specialties_touch
  before update on public.specialties
  for each row execute function public.touch_updated_at();

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Helper: avoids RLS recursion when policies need to check the current user role.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

alter table public.specialties enable row level security;
alter table public.profiles enable row level security;

create policy "specialties_select_authenticated"
  on public.specialties for select
  to authenticated
  using (true);

create policy "specialties_insert_owner"
  on public.specialties for insert
  to authenticated
  with check (public.is_owner());

create policy "specialties_update_owner"
  on public.specialties for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "specialties_delete_owner"
  on public.specialties for delete
  to authenticated
  using (public.is_owner());

create policy "profiles_select_self_or_owner"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_owner());

create policy "profiles_insert_owner"
  on public.profiles for insert
  to authenticated
  with check (public.is_owner());

create policy "profiles_update_owner"
  on public.profiles for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "profiles_delete_owner"
  on public.profiles for delete
  to authenticated
  using (public.is_owner());
