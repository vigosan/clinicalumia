create or replace function public.find_possible_duplicates(
  p_tax_id text,
  p_email text,
  p_phone text,
  p_exclude uuid default null
)
returns table (id uuid, first_name text, last_name text, matched text[], minors text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select
      nullif(upper(regexp_replace(coalesce(p_tax_id, ''), '[\s.\-]', '', 'g')), '') as tax_id,
      nullif(lower(trim(coalesce(p_email, ''))), '') as email,
      public.normalize_phone(p_phone) as phone
  )
  select
    p.id,
    p.first_name,
    p.last_name,
    array_remove(array[
      case when p.tax_id = i.tax_id then 'tax_id' end,
      case when p.email = i.email then 'email' end,
      case when p.phone = i.phone then 'phone' end
    ], null) as matched,
    coalesce((
      select array_agg(m.first_name || ' ' || m.last_name order by m.first_name)
      from public.guardianships g
      join public.people m on m.id = g.minor_id
      where g.guardian_id = p.id
    ), '{}') as minors
  from public.people p, input i
  where p.archived_at is null
    and (p_exclude is null or p.id <> p_exclude)
    and (p.tax_id = i.tax_id or p.email = i.email or p.phone = i.phone)
  order by p.last_name, p.first_name;
$$;

grant execute on function public.find_possible_duplicates(text, text, text, uuid) to authenticated;
