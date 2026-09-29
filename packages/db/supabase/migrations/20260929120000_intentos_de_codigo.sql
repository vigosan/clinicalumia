alter table public.access_requests
  add column kind text not null default 'request'
  check (kind in ('request', 'failed_code'));
