update public.access_requests set email = null where kind = 'consent';

alter table public.access_requests
  drop constraint access_requests_email_check,
  add constraint access_requests_email_check
    check ((kind = 'consent') = (email is null));
