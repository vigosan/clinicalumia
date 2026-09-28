create or replace function public.staff_directory()
returns table (id uuid, full_name text, role public.user_role, specialty_id uuid)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'staff_directory_forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.role, p.specialty_id
    from public.profiles p
    where p.is_active;
end;
$$;

revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;
