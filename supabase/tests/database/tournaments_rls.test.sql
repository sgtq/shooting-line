-- Row-level security on public.tournaments for each role. Rows are written as the table owner, and every
-- check after that runs as the signed-in role, so the policies decide the result.
begin;

select plan(21);

\ir ../helpers/sign_in_as.psql

-- Users: b...01 admin, b...02 manager, b...03 club with a plan, b...04 club with a lapsed plan,
-- b...05 archer entered in the first tournament, b...06 archer entered in none.
insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'admin@test.example'),
  ('b0000000-0000-0000-0000-000000000002', 'manager@test.example'),
  ('b0000000-0000-0000-0000-000000000003', 'club-active@test.example'),
  ('b0000000-0000-0000-0000-000000000004', 'club-lapsed@test.example'),
  ('b0000000-0000-0000-0000-000000000005', 'archer-entered@test.example'),
  ('b0000000-0000-0000-0000-000000000006', 'archer-not-entered@test.example');

insert into public.clubs (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Club A'),
  ('c0000000-0000-0000-0000-000000000002', 'Club B'),
  ('c0000000-0000-0000-0000-000000000003', 'Club Lapsed');

insert into public.participants (id, first_name, last_name) values
  ('d0000000-0000-0000-0000-000000000001', 'Entered', 'Archer'),
  ('d0000000-0000-0000-0000-000000000002', 'Other', 'Archer');

insert into public.user_roles (user_id, email, role, club_id, participant_id) values
  ('b0000000-0000-0000-0000-000000000001', 'admin@test.example', 'admin', null, null),
  ('b0000000-0000-0000-0000-000000000002', 'manager@test.example', 'manager', null, null),
  ('b0000000-0000-0000-0000-000000000003', 'club-active@test.example', 'club',
    'c0000000-0000-0000-0000-000000000001', null),
  ('b0000000-0000-0000-0000-000000000004', 'club-lapsed@test.example', 'club',
    'c0000000-0000-0000-0000-000000000003', null),
  ('b0000000-0000-0000-0000-000000000005', 'archer-entered@test.example', 'archer',
    null, 'd0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000006', 'archer-not-entered@test.example', 'archer',
    null, 'd0000000-0000-0000-0000-000000000002');

insert into public.plans (id, name, user_role, duration_kind) values
  ('e0000000-0000-0000-0000-000000000001', 'Club plan', 'club', 'monthly'),
  ('e0000000-0000-0000-0000-000000000002', 'Archer plan', 'archer', 'unlimited');

-- The club plan of b...03 covers today. The one of b...04 ended ten days ago. Both archers hold a paid plan
-- with no end date, so they count as enabled.
insert into public.user_subscriptions (user_id, plan_id, starts_on, ends_on, price_paid) values
  ('b0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001',
    current_date - 10, current_date + 20, 100),
  ('b0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001',
    current_date - 40, current_date - 10, 100),
  ('b0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', current_date - 1, null, 50),
  ('b0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', current_date - 1, null, 50);

-- f...01 and f...03 belong to Club A, and f...03 has started. f...02 belongs to Club B.
insert into public.tournaments (id, name, venue_mode, club_id, started_at) values
  ('f0000000-0000-0000-0000-000000000001', 'Club A open', 'club', 'c0000000-0000-0000-0000-000000000001', null),
  ('f0000000-0000-0000-0000-000000000002', 'Club B open', 'club', 'c0000000-0000-0000-0000-000000000002', null),
  ('f0000000-0000-0000-0000-000000000003', 'Club A started', 'club', 'c0000000-0000-0000-0000-000000000001', now());

insert into public.tournament_participants (tournament_id, participant_id) values
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');

-- Admin and manager see and create every tournament.
select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.tournaments where id in ('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003')),
  3::bigint,
  'an admin reads every tournament'
);
select lives_ok(
  $$insert into public.tournaments (name, venue_mode) values ('Admin created', 'custom')$$,
  'an admin creates a tournament'
);

reset role;
select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.tournaments where id in ('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003')),
  3::bigint,
  'a manager reads every tournament'
);
select lives_ok(
  $$insert into public.tournaments (name, venue_mode) values ('Manager created', 'custom')$$,
  'a manager creates a tournament'
);

-- A club with an active plan reads every tournament but writes only its own unstarted ones.
reset role;
select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000003');
select is(
  (select count(*) from public.tournaments where id in ('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003')),
  3::bigint,
  'a club with an active plan reads every tournament'
);
select lives_ok(
  $$insert into public.tournaments (name, venue_mode, club_id)
    values ('Club created', 'club', 'c0000000-0000-0000-0000-000000000001')$$,
  'a club with an active plan creates a tournament for itself'
);
select throws_ok(
  $$insert into public.tournaments (name, venue_mode, club_id)
    values ('Created for another club', 'club', 'c0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'new row violates row-level security policy for table "tournaments"',
  'a club cannot create a tournament for another club'
);
select throws_ok(
  $$update public.tournaments set club_id = 'c0000000-0000-0000-0000-000000000002'
    where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '42501',
  'new row violates row-level security policy for table "tournaments"',
  'a club cannot hand its tournament to another club'
);
-- An update the policy hides from the club changes nothing and raises no error. The rows are checked below.
select lives_ok(
  $$update public.tournaments set name = 'Renamed by club' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  'a club updates its own unstarted tournament'
);
select lives_ok(
  $$update public.tournaments set name = 'Changed started' where id = 'f0000000-0000-0000-0000-000000000003'$$,
  'a club update of its started tournament runs without an error'
);
select lives_ok(
  $$update public.tournaments set name = 'Changed other club' where id = 'f0000000-0000-0000-0000-000000000002'$$,
  'a club update of another club tournament runs without an error'
);

-- A club whose plan has lapsed reads and writes nothing.
reset role;
select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000004');
select is_empty(
  $$select id from public.tournaments where id in ('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003')$$,
  'a club with a lapsed plan reads no tournaments'
);
select throws_ok(
  $$insert into public.tournaments (name, venue_mode, club_id)
    values ('Lapsed club created', 'club', 'c0000000-0000-0000-0000-000000000003')$$,
  '42501',
  'new row violates row-level security policy for table "tournaments"',
  'a club with a lapsed plan cannot create a tournament'
);

-- An enabled archer reads only the tournaments they are entered in and writes nothing.
reset role;
select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000005');
select results_eq(
  $$select id from public.tournaments where id in ('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003')$$,
  $$values ('f0000000-0000-0000-0000-000000000001'::uuid)$$,
  'an archer reads only the tournament they are entered in'
);
select throws_ok(
  $$insert into public.tournaments (name, venue_mode) values ('Archer created', 'custom')$$,
  '42501',
  'new row violates row-level security policy for table "tournaments"',
  'an archer cannot create a tournament'
);
select lives_ok(
  $$update public.tournaments set name = 'Renamed by archer' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  'an archer update runs without an error'
);

reset role;
select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000006');
select is_empty(
  $$select id from public.tournaments where id in ('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003')$$,
  'an archer who is entered in no tournament reads none'
);

-- The table is not granted to anon, so a request with only the anon key is refused before any policy runs.
reset role;
set local role anon;
select throws_ok(
  $$select id from public.tournaments$$,
  '42501',
  'permission denied for table tournaments',
  'the anon role cannot read tournaments'
);

-- Back as the table owner: only the club's own update to its unstarted tournament took effect.
reset role;
select is(
  (select name from public.tournaments where id = 'f0000000-0000-0000-0000-000000000001'),
  'Renamed by club',
  'only the club changed its own unstarted tournament, and the archer did not'
);
select is(
  (select name from public.tournaments where id = 'f0000000-0000-0000-0000-000000000002'),
  'Club B open',
  'another club tournament was left unchanged'
);
select is(
  (select name from public.tournaments where id = 'f0000000-0000-0000-0000-000000000003'),
  'Club A started',
  'a started tournament was left unchanged'
);

select * from finish();

rollback;
