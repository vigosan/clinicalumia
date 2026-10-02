create or replace function public.link_consent(p_consent_id uuid, p_person_id uuid, p_fill text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent public.consents;
  own_tax_id text;
begin
  if exists (select 1 from unnest(p_fill) field where field not in ('tax_id', 'email', 'birth_date')) then
    raise exception 'invalid_fill_field' using errcode = 'P0001';
  end if;

  perform public.link_consent(p_consent_id, p_person_id);

  select * into consent from public.consents where id = p_consent_id;
  own_tax_id := case
    when consent.guardian_name <> '' and consent.guardian_tax_id is null then null
    else consent.tax_id
  end;

  begin
    update public.people p
    set tax_id = case when 'tax_id' = any(p_fill) and p.tax_id is null then own_tax_id else p.tax_id end,
        email = case when 'email' = any(p_fill) and p.email is null and consent.guardian_name = '' then consent.email else p.email end,
        birth_date = case when 'birth_date' = any(p_fill) and p.birth_date is null then consent.birth_date else p.birth_date end
    where p.id = p_person_id;
  exception when unique_violation then
    raise exception 'tax_id_taken' using errcode = 'P0001';
  end;
end;
$$;

revoke all on function public.link_consent(uuid, uuid, text[]) from public, anon;
grant execute on function public.link_consent(uuid, uuid, text[]) to authenticated;
