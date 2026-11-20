-- has_app_access answers from the signed-in user's rows in app_access.
begin;

select plan(6);

\ir ../helpers/sign_in_as.psql

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'manager-access@test.example'),
  ('a0000000-0000-0000-0000-000000000002', 'scorecard-access@test.example'),
  ('a0000000-0000-0000-0000-000000000003', 'no-access@test.example');

insert into public.app_access (user_id, app_id) values
  ('a0000000-0000-0000-0000-000000000001', 'manager'),
  ('a0000000-0000-0000-0000-000000000002', 'scorecard');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-000000000001');
select ok(public.has_app_access('manager'), 'a user with manager access has access to manager');
select ok(not public.has_app_access('scorecard'), 'access to one app does not give access to another');

reset role;
select pg_temp.sign_in_as('a0000000-0000-0000-0000-000000000002');
select ok(not public.has_app_access('manager'), 'a user with access to another app has no manager access');

reset role;
select pg_temp.sign_in_as('a0000000-0000-0000-0000-000000000003');
select ok(not public.has_app_access('manager'), 'a user with no access rows has no manager access');

-- A token without a user id makes auth.uid() null. That must read as no access, never as a match.
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select ok(not public.has_app_access('manager'), 'a session with no user id has no manager access');

-- Execute is granted to signed-in users only, so a request with the anon key cannot call it.
reset role;
set local role anon;
select throws_ok(
  $$select public.has_app_access('manager')$$,
  '42501',
  'permission denied for function has_app_access',
  'the anon role cannot run has_app_access'
);

select * from finish();

rollback;
