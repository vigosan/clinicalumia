create type public.consent_link_method as enum ('auto_tax_id', 'auto_guardian', 'auto_email', 'manual');

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  signed_at timestamptz not null,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  tax_id text not null,
  email text,
  guardian_name text not null default '',
  sources text[] not null default '{}',
  privacy_accepted boolean not null default true,
  marketing boolean not null,
  media_for_training boolean not null,
  pdf_path text not null,
  person_id uuid references public.people(id) on delete set null,
  linked_at timestamptz,
  linked_by uuid references public.profiles(id) on delete set null,
  link_method public.consent_link_method,
  created_at timestamptz not null default now(),
  constraint consents_link_method_with_person check ((person_id is null) = (link_method is null))
);

create index consents_person_idx on public.consents(person_id);
create index consents_signed_at_idx on public.consents(signed_at desc);
create index consents_tax_id_idx on public.consents(tax_id);

create or replace function public.clear_consent_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.link_method := null;
  new.linked_at := null;
  new.linked_by := null;
  return new;
end;
$$;

create trigger consents_clear_link
  before update of person_id on public.consents
  for each row
  when (new.person_id is null)
  execute function public.clear_consent_link();

alter table public.consents enable row level security;

revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;

create policy "consents_select_active_staff" on public.consents
  for select to authenticated using (public.is_active_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consents', 'consents', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy "consents_select_active_staff" on storage.objects
  for select to authenticated using (bucket_id = 'consents' and public.is_active_staff());

create or replace function public.match_consent_person(p_tax_id text, p_email text, p_birth_date date)
returns table (person_id uuid, method public.consent_link_method)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_tax_id text := nullif(upper(regexp_replace(coalesce(p_tax_id, ''), '[\s.\-]', '', 'g')), '');
  normalized_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  holder public.people;
  ward_ids uuid[];
  email_ids uuid[];
begin
  if normalized_tax_id is not null then
    select * into holder from public.people p where p.tax_id = normalized_tax_id;
  end if;

  if holder.id is not null then
    if holder.archived_at is not null then
      return;
    end if;
    if holder.birth_date = p_birth_date then
      return query select holder.id, 'auto_tax_id'::public.consent_link_method;
      return;
    end if;
    if holder.birth_date is null
      or extract(year from age((now() at time zone 'Europe/Madrid')::date, holder.birth_date)) >= 18 then
      select array_agg(w.id) into ward_ids
      from public.guardianships g
      join public.people w on w.id = g.minor_id
      where g.guardian_id = holder.id
        and w.archived_at is null
        and w.birth_date = p_birth_date;
      if cardinality(ward_ids) = 1 then
        return query select ward_ids[1], 'auto_guardian'::public.consent_link_method;
      end if;
    end if;
    return;
  end if;

  if normalized_email is null then
    return;
  end if;

  select array_agg(p.id) into email_ids
  from public.people p
  where p.email = normalized_email
    and p.birth_date = p_birth_date
    and p.archived_at is null;
  if cardinality(email_ids) = 1 then
    return query select email_ids[1], 'auto_email'::public.consent_link_method;
  end if;
end;
$$;

revoke all on function public.match_consent_person(text, text, date) from public, anon, authenticated;
grant execute on function public.match_consent_person(text, text, date) to service_role;

create or replace function public.link_consent(p_consent_id uuid, p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'consent_forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.people where id = p_person_id and archived_at is null) then
    raise exception 'person_not_found' using errcode = 'P0001';
  end if;
  update public.consents
  set person_id = p_person_id,
      linked_at = now(),
      linked_by = auth.uid(),
      link_method = 'manual'
  where id = p_consent_id;
  if not found then
    raise exception 'consent_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.link_consent(uuid, uuid) from public, anon;
grant execute on function public.link_consent(uuid, uuid) to authenticated;

create or replace function public.unlink_consent(p_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'consent_forbidden' using errcode = '42501';
  end if;
  update public.consents
  set person_id = null,
      linked_at = null,
      linked_by = null,
      link_method = null
  where id = p_consent_id;
  if not found then
    raise exception 'consent_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.unlink_consent(uuid) from public, anon;
grant execute on function public.unlink_consent(uuid) to authenticated;
