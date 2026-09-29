begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'access_requests', 'kind',
  'each attempt records whether it asked for an email or failed a code');

insert into public.access_requests (email, ip_hash) values ('kind-default@test.local', 'h');
select is((select kind from public.access_requests where email = 'kind-default@test.local'), 'request',
  'an attempt without a kind is an access request, so existing callers keep counting the same way');

select lives_ok($$ insert into public.access_requests (email, ip_hash, kind) values ('kind-failed@test.local', 'h', 'failed_code') $$,
  'a failed code can be recorded to limit guessing');

select throws_ok($$ insert into public.access_requests (email, ip_hash, kind) values ('kind-other@test.local', 'h', 'otra') $$,
  '23514', null, 'unknown kinds are rejected so no attempt escapes both limits');

select throws_ok($$ insert into public.access_requests (email, ip_hash, kind) values ('kind-null@test.local', 'h', null) $$,
  '23502', null, 'an attempt always has a kind');

select * from finish();
rollback;
