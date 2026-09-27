create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles where id = auth.uid() and is_active
    )
    and exists (
      select 1 from auth.sessions
      where user_id = auth.uid()
        and id = case
          when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (auth.jwt()->>'session_id')::uuid
          else null
        end
    );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner' and is_active
    )
    and exists (
      select 1 from auth.sessions
      where user_id = auth.uid()
        and id = case
          when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (auth.jwt()->>'session_id')::uuid
          else null
        end
    );
$$;
