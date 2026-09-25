alter type public.user_role rename value 'doctor' to 'employee';
alter table public.profiles alter column role set default 'employee';
alter table public.profiles add column license_number text;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and is_active
  );
$$;

drop policy "specialties_select_authenticated" on public.specialties;

create policy "specialties_select_active_staff"
  on public.specialties for select
  to authenticated
  using (public.is_active_staff());
