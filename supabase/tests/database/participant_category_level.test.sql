-- An archer who entered a category cannot enter a lower level of the same bow type. A lower sort_order is a
-- lower level, and a level_exempt category sits outside the ranking. The trigger runs as the caller, so the
-- checks run as a manager, who can read every entry.
begin;

select plan(13);

\ir ../helpers/sign_in_as.psql

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000002', 'manager@test.example');
insert into public.user_roles (user_id, email, role) values
  ('b0000000-0000-0000-0000-000000000002', 'manager@test.example', 'manager');

-- Participants: d...01 X, d...02 Y, d...03 Z, d...04 W, d...05 V.
insert into public.participants (id, first_name, last_name) values
  ('d0000000-0000-0000-0000-000000000001', 'Archer', 'X'),
  ('d0000000-0000-0000-0000-000000000002', 'Archer', 'Y'),
  ('d0000000-0000-0000-0000-000000000003', 'Archer', 'Z'),
  ('d0000000-0000-0000-0000-000000000004', 'Archer', 'W'),
  ('d0000000-0000-0000-0000-000000000005', 'Archer', 'V');

-- Categories: 0a recurve junior (level 1), 0b recurve adult (level 2), 0c compound open, 0d recurve masters,
-- which is exempt from the ranking.
insert into public.categories (id, name, bow_type, sort_order, level_exempt) values
  ('a1000000-0000-0000-0000-00000000000a', 'Recurve Junior', 'recurve', 1, false),
  ('a1000000-0000-0000-0000-00000000000b', 'Recurve Adult', 'recurve', 2, false),
  ('a1000000-0000-0000-0000-00000000000c', 'Compound Open', 'compound', 0, false),
  ('a1000000-0000-0000-0000-00000000000d', 'Recurve Masters', 'recurve', 0, true);

insert into public.tournaments (id, name, venue_mode) values
  ('f0000000-0000-0000-0000-000000000001', 'First', 'custom'),
  ('f0000000-0000-0000-0000-000000000002', 'Second', 'custom'),
  ('f0000000-0000-0000-0000-000000000003', 'Third', 'custom');

-- Every tournament offers every category, so only the level rule decides the outcome.
insert into public.tournament_categories (tournament_id, category_id)
select tournament.id, category.id
from public.tournaments as tournament
cross join public.categories as category;

select pg_temp.sign_in_as('b0000000-0000-0000-0000-000000000002');

-- X enters the adult category, so the junior category is now a lower level.
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-00000000000b')$$,
  'an archer enters a category'
);
select throws_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-00000000000a')$$,
  'P0001',
  'This archer already entered Recurve Adult and cannot enter the lower category Recurve Junior',
  'an archer cannot enter a lower level of the same bow type'
);
select is(
  (select count(*) from public.tournament_participants
    where tournament_id = 'f0000000-0000-0000-0000-000000000002'),
  0::bigint,
  'the rejected entry was not saved'
);
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-00000000000b')$$,
  'an archer can enter the same level again'
);

-- Moving up is allowed.
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
      'a1000000-0000-0000-0000-00000000000a')$$,
  'an archer enters the junior category'
);
select lives_ok(
  $$update public.tournament_participants set category_id = 'a1000000-0000-0000-0000-00000000000b'
    where tournament_id = 'f0000000-0000-0000-0000-000000000001'
      and participant_id = 'd0000000-0000-0000-0000-000000000002'$$,
  'an archer can move an entry up to a higher level'
);

-- Moving an existing entry down is rejected too. The stored row still holds the old category when the
-- trigger runs, so it counts as the entry that blocks the change.
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
      'a1000000-0000-0000-0000-00000000000b')$$,
  'an archer enters the adult category in a single tournament'
);
select throws_ok(
  $$update public.tournament_participants set category_id = 'a1000000-0000-0000-0000-00000000000a'
    where tournament_id = 'f0000000-0000-0000-0000-000000000001'
      and participant_id = 'd0000000-0000-0000-0000-000000000003'$$,
  'P0001',
  'This archer already entered Recurve Adult and cannot enter the lower category Recurve Junior',
  'an archer cannot move an existing entry to a lower level'
);

-- A level only counts within its own bow type.
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-00000000000c')$$,
  'an entry in another bow type is not ranked against recurve'
);

-- An exempt category never blocks another category and is never blocked by one.
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
      'a1000000-0000-0000-0000-00000000000b')$$,
  'an archer enters the adult category before an exempt one'
);
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004',
      'a1000000-0000-0000-0000-00000000000d')$$,
  'an exempt category is allowed after a higher level'
);
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005',
      'a1000000-0000-0000-0000-00000000000d')$$,
  'an archer enters an exempt category'
);
select lives_ok(
  $$insert into public.tournament_participants (tournament_id, participant_id, category_id) values
    ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005',
      'a1000000-0000-0000-0000-00000000000a')$$,
  'an exempt entry does not block a lower level'
);

select * from finish();

rollback;
