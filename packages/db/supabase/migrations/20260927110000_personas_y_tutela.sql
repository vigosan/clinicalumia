create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when cleaned !~ '[0-9]' then null
    when cleaned ~ '^(\+34|0034)[0-9]{9}$' then right(cleaned, 9)
    else cleaned
  end
  from (
    select regexp_replace(
      regexp_replace(coalesce(value, ''), '[^0-9+]', '', 'g'),
      '(?!^)\+', '', 'g'
    ) as cleaned
  ) as normalized;
$$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  birth_date date,
  tax_id text,
  email text,
  phone text,
  address text not null default '',
  admin_notes text not null default '',
  is_patient boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(public.f_unaccent(
      first_name || ' ' || last_name || ' ' ||
      coalesce(tax_id, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')
    ))
  ) stored,
  constraint people_patient_needs_birth_date check (not is_patient or birth_date is not null)
);

create unique index people_tax_id_key on public.people(tax_id) where tax_id is not null;
create index people_email_idx on public.people(email);
create index people_phone_idx on public.people(phone);
create index people_search_idx on public.people using gin (search_text extensions.gin_trgm_ops);

create or replace function public.normalize_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.tax_id := nullif(upper(regexp_replace(coalesce(new.tax_id, ''), '[\s.\-]', '', 'g')), '');
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.phone := public.normalize_phone(new.phone);
  if new.birth_date is not null
    and new.birth_date > (now() at time zone 'Europe/Madrid')::date then
    raise exception 'birth_date must not be in the future' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger people_normalize
  before insert or update on public.people
  for each row execute function public.normalize_person();

create trigger people_touch
  before update on public.people
  for each row execute function public.touch_updated_at();

create type public.guardian_relationship as enum ('madre', 'padre', 'tutor_legal', 'otro');

create table public.guardianships (
  minor_id uuid not null references public.people(id) on delete cascade,
  guardian_id uuid not null references public.people(id) on delete restrict,
  relationship public.guardian_relationship not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (minor_id, guardian_id),
  check (minor_id <> guardian_id)
);

create index guardianships_guardian_idx on public.guardianships(guardian_id);
create unique index guardianships_one_primary on public.guardianships(minor_id) where is_primary;

alter table public.people enable row level security;
alter table public.guardianships enable row level security;

create policy "people_select_active_staff" on public.people
  for select to authenticated using (public.is_active_staff());
create policy "people_insert_active_staff" on public.people
  for insert to authenticated with check (public.is_active_staff());
create policy "people_update_active_staff" on public.people
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "people_delete_owner" on public.people
  for delete to authenticated using (public.is_owner());

create policy "guardianships_select_active_staff" on public.guardianships
  for select to authenticated using (public.is_active_staff());
create policy "guardianships_insert_active_staff" on public.guardianships
  for insert to authenticated with check (public.is_active_staff());
create policy "guardianships_update_active_staff" on public.guardianships
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "guardianships_delete_active_staff" on public.guardianships
  for delete to authenticated using (public.is_active_staff());
