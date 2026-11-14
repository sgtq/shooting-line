alter table public.participants
  add column club_id uuid references public.clubs (id) on delete set null;

create index participants_club_id_idx on public.participants (club_id);

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

  insert into public.categories (id, name, min_age, max_age, bow_type)
  select id, name, min_age, max_age, bow_type
  from jsonb_to_recordset(coalesce(p_workspace->'categories', '[]'::jsonb))
    as input_row(id uuid, name text, min_age integer, max_age integer, bow_type text);

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

  insert into public.tournament_participants (tournament_id, participant_id, category_id)
  select tournament_id, participant_id, category_id
  from jsonb_to_recordset(coalesce(p_workspace->'tournament_participants', '[]'::jsonb))
    as input_row(tournament_id uuid, participant_id uuid, category_id uuid);

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
