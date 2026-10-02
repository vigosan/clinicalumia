create or replace function public.appointment_notice_recipients(p_appointment_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  appointment record;
begin
  if not public.is_active_staff() then
    raise exception 'notice_forbidden' using errcode = '42501';
  end if;
  select a.professional_id, a.patient_id, pacc.email as account_email, p.email as person_email
  into appointment
  from public.appointments a
  join public.people p on p.id = a.patient_id
  left join public.patient_accounts pacc on pacc.id = a.booked_by_account
  where a.id = p_appointment_id;
  if not found or not (public.is_owner() or appointment.professional_id = auth.uid()) then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  if appointment.account_email is not null then
    return array[lower(appointment.account_email)];
  end if;
  if appointment.person_email is not null then
    return array[lower(appointment.person_email)];
  end if;
  return array(
    select distinct lower(gp.email)
    from public.guardianships gs
    join public.people gp on gp.id = gs.guardian_id
    where gs.minor_id = appointment.patient_id
      and gp.archived_at is null
      and gp.email is not null
    order by 1
  );
end;
$$;
revoke all on function public.appointment_notice_recipients(uuid) from public, anon;
grant execute on function public.appointment_notice_recipients(uuid) to authenticated;
