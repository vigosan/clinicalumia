begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

select lives_ok($$ insert into public.access_requests (email, ip_hash, kind) values ('kind-sent@test.local', 'h', 'code_sent') $$,
  'each code actually sent is recorded, so the hourly total stays under the email quota');

select lives_ok($$ insert into public.access_requests (email, ip_hash, kind) values (null, 'h', 'consent') $$,
  'a consent signed without email still counts against its network and the global limit');

select throws_ok($$ insert into public.access_requests (email, ip_hash, kind) values (null, 'h', 'request') $$,
  '23514', null, 'an access request always names the email it was for, so the per-email limit cannot be skipped');

select throws_ok($$ insert into public.access_requests (email, ip_hash, kind) values (null, 'h', 'failed_code') $$,
  '23514', null, 'a wrong code always names the email it was for');

select has_index('public', 'access_requests', 'access_requests_kind_idx', array['kind', 'created_at'],
  'the hourly totals per kind are counted from an index, not by scanning every attempt');

select * from finish();
rollback;
