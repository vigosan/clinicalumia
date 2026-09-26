create extension if not exists btree_gist with schema extensions;

create table public.employee_schedules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at),
  constraint employee_schedules_no_overlap exclude using gist (
    profile_id with =,
    weekday with =,
    tsrange('2000-01-01'::date + starts_at, '2000-01-01'::date + ends_at) with &&
  )
);

create index employee_schedules_profile_idx on public.employee_schedules(profile_id);

create table public.employee_time_off (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  check (starts_at < ends_at)
);

create index employee_time_off_profile_idx on public.employee_time_off(profile_id, starts_at);

alter table public.employee_schedules enable row level security;
alter table public.employee_time_off enable row level security;

create policy "employee_schedules_select_active_staff" on public.employee_schedules
  for select to authenticated using (public.is_active_staff());
create policy "employee_schedules_write_owner" on public.employee_schedules
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "employee_time_off_select_active_staff" on public.employee_time_off
  for select to authenticated using (public.is_active_staff());
create policy "employee_time_off_write_owner" on public.employee_time_off
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create or replace function public.set_employee_schedule(target uuid, blocks jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can change schedules' using errcode = '42501';
  end if;
  delete from public.employee_schedules where profile_id = target;
  insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
  select target, (block->>'weekday')::smallint, (block->>'starts_at')::time, (block->>'ends_at')::time
  from jsonb_array_elements(blocks) as block;
end;
$$;

grant execute on function public.set_employee_schedule(uuid, jsonb) to authenticated;
