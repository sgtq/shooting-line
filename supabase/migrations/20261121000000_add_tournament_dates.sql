-- A tournament has one or more days. A date range is stored as one row per day, so a range and a list of
-- separate days read the same way everywhere.
create table public.tournament_dates (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  day date not null,
  primary key (tournament_id, day)
);

insert into public.tournament_dates (tournament_id, day)
select id, date from public.tournaments;

alter table public.tournaments drop column date;

grant select, insert, update, delete on public.tournament_dates to authenticated;
revoke all on public.tournament_dates from public, anon;

alter table public.tournament_dates enable row level security;

-- Same access as the tournament itself: who can read it, who can edit it.
create policy "Read permitted tournament dates"
  on public.tournament_dates for select to authenticated
  using (public.can_view_tournament(tournament_id));

create policy "Managers edit tournament dates"
  on public.tournament_dates for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Clubs with a plan manage dates of own unstarted tournaments"
  on public.tournament_dates for all to authenticated
  using (public.club_can_edit_tournament(tournament_id))
  with check (public.club_can_edit_tournament(tournament_id));

-- The age check uses the first day of the tournament.
create or replace function public.enforce_participant_category_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.categories;
  v_birth_date date;
  v_event_date date;
  v_age integer;
begin
  if new.category_id is null or public.is_manager_or_admin() then
    return new;
  end if;

  select * into v_category from public.categories where id = new.category_id;
  if v_category.min_age is null and v_category.max_age is null then
    return new;
  end if;

  select birth_date into v_birth_date from public.participants where id = new.participant_id;
  select min(day) into v_event_date from public.tournament_dates where tournament_id = new.tournament_id;
  if v_birth_date is null or v_event_date is null then
    return new;
  end if;

  v_age := extract(year from age(v_event_date, v_birth_date))::integer;
  if v_category.min_age is not null and v_age < v_category.min_age then
    raise exception 'This archer is below the minimum age for the category %', v_category.name;
  end if;
  if v_category.max_age is not null and v_age > v_category.max_age then
    raise exception 'This archer is above the maximum age for the category %', v_category.name;
  end if;

  return new;
end;
$$;

-- The browser-data import reads each tournament's days from tournament_dates.
create or replace function public.import_manager_workspace(p_workspace jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  importing_user uuid := (select auth.uid());
begin
  -- Club accounts also hold the manager app grant, so the role is checked as the table policies do.
  if importing_user is null or not public.is_manager_or_admin() then
    raise exception 'Manager or administrator access is required';
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

  -- A category sent without a level order is ranked like the backfill above, so callers that predate
  -- level orders (an older browser client, or a direct call) still get a working level rule.
  insert into public.categories (id, name, min_age, max_age, bow_type, sort_order, level_exempt)
  select id, name, min_age, max_age, bow_type,
    coalesce(
      sort_order,
      (row_number() over (
        partition by bow_type
        order by coalesce(min_age, 0), coalesce(max_age, 1000), name, id
      ) - 1)::integer
    ),
    coalesce(level_exempt, false)
  from jsonb_to_recordset(coalesce(p_workspace->'categories', '[]'::jsonb))
    as input_row(id uuid, name text, min_age integer, max_age integer, bow_type text, sort_order integer, level_exempt boolean);

  insert into public.tournaments (id, name, discipline, tournament_type_id, club_id, venue_mode, custom_address)
  select id, name, discipline, tournament_type_id, club_id, venue_mode, custom_address
  from jsonb_to_recordset(coalesce(p_workspace->'tournaments', '[]'::jsonb))
    as input_row(id uuid, name text, discipline text, tournament_type_id uuid, club_id uuid, venue_mode text, custom_address text);

  insert into public.tournament_dates (tournament_id, day)
  select tournament_id, day
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_dates', '[]'::jsonb))
    as input_row(tournament_id uuid, day date);

  insert into public.tournament_rounds (id, tournament_id, name, position)
  select id, tournament_id, name, position
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_rounds', '[]'::jsonb))
    as input_row(id uuid, tournament_id uuid, name text, position integer);

  insert into public.tournament_categories (tournament_id, category_id)
  select tournament_id, category_id
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_categories', '[]'::jsonb))
    as input_row(tournament_id uuid, category_id uuid);

  alter table public.tournament_participants disable trigger tournament_participants_category_level;
  alter table public.tournament_participants disable trigger tournament_participants_category_offered;

  insert into public.tournament_participants (tournament_id, participant_id, category_id)
  select tournament_id, participant_id, category_id
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_participants', '[]'::jsonb))
    as input_row(tournament_id uuid, participant_id uuid, category_id uuid);

  alter table public.tournament_participants enable trigger tournament_participants_category_level;
  alter table public.tournament_participants enable trigger tournament_participants_category_offered;

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

grant execute on function public.import_manager_workspace(jsonb) to authenticated;
