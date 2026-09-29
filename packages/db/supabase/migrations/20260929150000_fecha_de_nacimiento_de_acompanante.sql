create or replace function public.complete_my_birth_date(p_person_id uuid, p_birth_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.patient_accounts pa where pa.id = auth.uid()) then
    raise exception 'patient_account_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.my_people() mp
    where mp.id = p_person_id and mp.birth_date is null
  ) then
    raise exception 'person_not_in_account' using errcode = 'P0001';
  end if;

  update public.people set birth_date = p_birth_date where id = p_person_id;
end;
$$;

revoke all on function public.complete_my_birth_date(uuid, date) from public, anon;
grant execute on function public.complete_my_birth_date(uuid, date) to authenticated;
