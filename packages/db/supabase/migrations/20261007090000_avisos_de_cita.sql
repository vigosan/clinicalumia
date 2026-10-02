drop function public.my_appointments();

create function public.my_appointments()
returns table (
  id uuid,
  person_id uuid,
  person_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  service_id uuid,
  service_name text,
  professional_id uuid,
  professional_name text,
  origin public.appointment_origin,
  cancelled_by public.appointment_canceller,
  change_deadline timestamptz,
  can_change boolean,
  can_reschedule boolean,
  invoiced boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.patient_id,
    mp.first_name || ' ' || mp.last_name,
    a.starts_at,
    a.ends_at,
    a.status,
    s.id,
    s.name,
    pr.id,
    pr.full_name,
    a.origin,
    a.cancelled_by,
    a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours)),
    a.status = 'scheduled'
      and now() < a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours))
      and not public.appointment_is_invoiced(a.id),
    a.status = 'scheduled'
      and now() < a.starts_at - make_interval(hours => coalesce(s.cancellation_hours, cs.cancellation_hours))
      and not public.appointment_is_invoiced(a.id)
      and pr.is_active
      and pr.specialty_id = s.specialty_id
      and exists (
        select 1 from public.booking_catalog() bc
        where bc.service_id = s.id and not bc.phone_only
      ),
    public.appointment_is_invoiced(a.id),
    a.updated_at
  from public.my_people() mp
  join public.appointments a on a.patient_id = mp.id
  join public.services s on s.id = a.service_id
  join public.profiles pr on pr.id = a.professional_id
  cross join public.clinic_settings cs
  order by a.starts_at, a.id;
$$;

revoke all on function public.my_appointments() from public, anon;
grant execute on function public.my_appointments() to authenticated;
