-- A category's sort_order ranks its level within its bow type. A lower number is a lower level.
-- A level_exempt category (for example Masters, limited only by age) is outside that ranking:
-- it never blocks another category and is never blocked.
alter table public.categories
  add column sort_order integer not null default 0 check (sort_order >= 0),
  add column level_exempt boolean not null default false;

-- Existing categories get a starting order from their minimum age. Managers can adjust it afterward.
update public.categories c
set sort_order = ranked.position
from (
  select id,
    (row_number() over (
      partition by bow_type
      order by coalesce(min_age, 0), coalesce(max_age, 1000), created_at
    ) - 1)::integer as position
  from public.categories
) ranked
where ranked.id = c.id;

-- An archer who has entered a category can never enter a lower level of the same bow type,
-- including by changing the category of an entry they already hold or by moving an entry to another archer.
-- Runs as the table owner so that entries in tournaments the caller cannot read still count.
-- On an update, the stored row still holds the old category, so a downgrade is rejected too.
create function public.enforce_participant_category_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new public.categories;
  v_blocking_name text;
begin
  if new.category_id is null then
    return new;
  end if;

  select * into v_new from public.categories where id = new.category_id;

  if v_new.level_exempt then
    return new;
  end if;

  -- Serializes writes for one archer so two concurrent entries cannot both pass the check below.
  perform pg_advisory_xact_lock(hashtextextended(new.participant_id::text, 0));

  select c.name
    into v_blocking_name
  from public.tournament_participants tp
  join public.categories c on c.id = tp.category_id
  where tp.participant_id = new.participant_id
    and not c.level_exempt
    and c.bow_type = v_new.bow_type
    and c.sort_order > v_new.sort_order
  limit 1;

  if v_blocking_name is not null then
    raise exception 'This archer already entered % and cannot enter the lower category %',
      v_blocking_name, v_new.name;
  end if;

  return new;
end;
$$;

create trigger tournament_participants_category_level
  before insert or update of participant_id, category_id on public.tournament_participants
  for each row execute function public.enforce_participant_category_level();

-- The browser-data import now carries each category's level order and exemption. The level rule is
-- switched off while the archers' entries are inserted, because old history can already break it and
-- the import must keep that history as it was. The switch is undone in the same transaction.
create or replace function public.import_manager_workspace(p_workspace jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  importing_user uuid := (select auth.uid());
begin
  if importing_user is null or not public.has_app_access('manager') then
    raise exception 'Manager app access is required';
  end if;

  if exists (
    select 1
    from public.manager_data_imports
    where user_id = importing_user
  ) then
    return;
  end if;

  if exists (select 1 from public.clubs)
    or exists (select 1 from public.participants)
    or exists (select 1 from public.tournament_types)
    or exists (select 1 from public.categories)
    or exists (select 1 from public.tournaments)
  then
    raise exception 'Browser data can only be imported into an empty manager database';
  end if;

  insert into public.clubs (
    id, name, representative, phone, email, website, address, map_url, user_email, user_enabled
  )
  select id, name, representative, phone, email, website, address, map_url, user_email, user_enabled
  from jsonb_to_recordset(coalesce(p_workspace->'clubs', '[]'::jsonb))
    as input_row(id uuid, name text, representative text, phone text, email text, website text, address text, map_url text, user_email text, user_enabled boolean);

  insert into public.participants (id, first_name, last_name, birth_date, wa_id, aetay_id, club_id)
  select id, first_name, last_name, birth_date, wa_id, aetay_id, club_id
  from jsonb_to_recordset(coalesce(p_workspace->'participants', '[]'::jsonb))
    as input_row(id uuid, first_name text, last_name text, birth_date date, wa_id text, aetay_id text, club_id uuid);

  insert into public.tournament_types (id, name, distance, distance_unit, target_type, ends, arrows_per_end)
  select id, name, distance, distance_unit, target_type, ends, arrows_per_end
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_types', '[]'::jsonb))
    as input_row(id uuid, name text, distance numeric, distance_unit text, target_type text, ends integer, arrows_per_end integer);

  insert into public.categories (id, name, min_age, max_age, bow_type, sort_order, level_exempt)
  select id, name, min_age, max_age, bow_type, coalesce(sort_order, 0), coalesce(level_exempt, false)
  from jsonb_to_recordset(coalesce(p_workspace->'categories', '[]'::jsonb))
    as input_row(id uuid, name text, min_age integer, max_age integer, bow_type text, sort_order integer, level_exempt boolean);

  insert into public.tournaments (id, name, date, discipline, tournament_type_id, club_id, venue_mode, custom_address)
  select id, name, date, discipline, tournament_type_id, club_id, venue_mode, custom_address
  from jsonb_to_recordset(coalesce(p_workspace->'tournaments', '[]'::jsonb))
    as input_row(id uuid, name text, date date, discipline text, tournament_type_id uuid, club_id uuid, venue_mode text, custom_address text);

  insert into public.tournament_rounds (id, tournament_id, name, position)
  select id, tournament_id, name, position
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_rounds', '[]'::jsonb))
    as input_row(id uuid, tournament_id uuid, name text, position integer);

  insert into public.tournament_categories (tournament_id, category_id)
  select tournament_id, category_id
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_categories', '[]'::jsonb))
    as input_row(tournament_id uuid, category_id uuid);

  alter table public.tournament_participants disable trigger tournament_participants_category_level;

  insert into public.tournament_participants (tournament_id, participant_id, category_id)
  select tournament_id, participant_id, category_id
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_participants', '[]'::jsonb))
    as input_row(tournament_id uuid, participant_id uuid, category_id uuid);

  alter table public.tournament_participants enable trigger tournament_participants_category_level;

  insert into public.round_scores (tournament_id, round_id, participant_id, category_id, score)
  select tournament_id, round_id, participant_id, category_id, score
  from jsonb_to_recordset(coalesce(p_workspace->'round_scores', '[]'::jsonb))
    as input_row(tournament_id uuid, round_id uuid, participant_id uuid, category_id uuid, score numeric);

  insert into public.matches (
    id, tournament_id, source_round_id, category_id, round, seed1_id, seed2_id, seed1, seed2, score1, score2
  )
  select id, tournament_id, source_round_id, category_id, round, seed1_id, seed2_id, seed1, seed2, score1, score2
  from jsonb_to_recordset(coalesce(p_workspace->'matches', '[]'::jsonb))
    as input_row(id uuid, tournament_id uuid, source_round_id uuid, category_id uuid, round text, seed1_id uuid, seed2_id uuid, seed1 integer, seed2 integer, score1 numeric, score2 numeric);

  insert into public.manager_data_imports (user_id)
  values (importing_user);
end;
$$;

revoke all on function public.import_manager_workspace(jsonb) from public;
grant execute on function public.import_manager_workspace(jsonb) to authenticated;
