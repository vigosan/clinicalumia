alter table public.access_requests
  drop constraint access_requests_kind_check,
  add constraint access_requests_kind_check
    check (kind in ('request', 'code_sent', 'failed_code', 'consent'));

alter table public.access_requests
  alter column email drop not null,
  add constraint access_requests_email_check
    check (email is not null or kind = 'consent');

create index access_requests_kind_idx on public.access_requests(kind, created_at);
