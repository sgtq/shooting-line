create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  representative text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  address text not null default '',
  map_url text not null default '',
  user_email text not null default '',
  user_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date,
  wa_id text not null default '',
  aetay_id text not null default '',
  created_at timestamptz not null default now()
);

create table public.tournament_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  distance numeric not null check (distance > 0),
  distance_unit text not null check (distance_unit in ('m', 'yd')),
  target_type text not null,
  ends integer not null check (ends > 0),
  arrows_per_end integer not null check (arrows_per_end > 0),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_age integer check (min_age is null or min_age >= 0),
  max_age integer check (max_age is null or max_age >= 0),
  bow_type text not null default '',
  created_at timestamptz not null default now(),
  check (min_age is null or max_age is null or min_age <= max_age)
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  discipline text not null default '',
  tournament_type_id uuid references public.tournament_types (id) on delete restrict,
  club_id uuid references public.clubs (id) on delete set null,
  venue_mode text not null check (venue_mode in ('club', 'custom')),
  custom_address text not null default '',
  created_at timestamptz not null default now()
);

create table public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, name),
  unique (tournament_id, position),
  unique (tournament_id, id)
);

create table public.tournament_categories (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (tournament_id, category_id)
);

create table public.tournament_participants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  primary key (tournament_id, participant_id)
);

create table public.round_scores (
  tournament_id uuid not null,
  round_id uuid not null,
  participant_id uuid not null,
  category_id uuid references public.categories (id) on delete set null,
  score numeric not null check (score >= 0),
  created_at timestamptz not null default now(),
  primary key (round_id, participant_id),
  foreign key (tournament_id, round_id)
    references public.tournament_rounds (tournament_id, id) on delete cascade,
  foreign key (participant_id)
    references public.participants (id) on delete restrict
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  source_round_id uuid not null,
  category_id uuid references public.categories (id) on delete set null,
  round text not null,
  seed1_id uuid not null references public.participants (id) on delete restrict,
  seed2_id uuid not null references public.participants (id) on delete restrict,
  seed1 integer not null check (seed1 > 0),
  seed2 integer not null check (seed2 > 0),
  score1 numeric check (score1 is null or score1 >= 0),
  score2 numeric check (score2 is null or score2 >= 0),
  created_at timestamptz not null default now(),
  foreign key (tournament_id, source_round_id)
    references public.tournament_rounds (tournament_id, id) on delete cascade
);

create index tournaments_date_idx on public.tournaments (date);
create index tournament_participants_participant_idx on public.tournament_participants (participant_id);
create index round_scores_participant_idx on public.round_scores (participant_id);
create index matches_tournament_round_idx on public.matches (tournament_id, source_round_id, category_id);

grant select, insert, update, delete on
  public.clubs,
  public.participants,
  public.tournament_types,
  public.categories,
  public.tournaments,
  public.tournament_rounds,
  public.tournament_categories,
  public.tournament_participants,
  public.round_scores,
  public.matches
to authenticated;

revoke all on
  public.clubs,
  public.participants,
  public.tournament_types,
  public.categories,
  public.tournaments,
  public.tournament_rounds,
  public.tournament_categories,
  public.tournament_participants,
  public.round_scores,
  public.matches
from public, anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clubs',
    'participants',
    'tournament_types',
    'categories',
    'tournaments',
    'tournament_rounds',
    'tournament_categories',
    'tournament_participants',
    'round_scores',
    'matches'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Manager access required" on public.%I for all to authenticated using (public.has_app_access(''manager'')) with check (public.has_app_access(''manager''))',
      table_name
    );
  end loop;
end
$$;

create function public.replace_first_round_matches(
  p_tournament_id uuid,
  p_source_round_id uuid,
  p_category_id uuid,
  p_matches jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_app_access('manager') then
    raise exception 'Manager app access is required';
  end if;

  delete from public.matches
  where tournament_id = p_tournament_id
    and source_round_id = p_source_round_id
    and category_id is not distinct from p_category_id;

  insert into public.matches (
    id,
    tournament_id,
    source_round_id,
    category_id,
    round,
    seed1_id,
    seed2_id,
    seed1,
    seed2
  )
  select
    (item->>'id')::uuid,
    p_tournament_id,
    p_source_round_id,
    p_category_id,
    item->>'round',
    (item->>'seed1_id')::uuid,
    (item->>'seed2_id')::uuid,
    (item->>'seed1')::integer,
    (item->>'seed2')::integer
  from jsonb_array_elements(p_matches) as entries(item);
end;
$$;

revoke all on function public.replace_first_round_matches(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.replace_first_round_matches(uuid, uuid, uuid, jsonb) to authenticated;

create function public.set_tournament_category(
  p_tournament_id uuid,
  p_category_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_app_access('manager') then
    raise exception 'Manager app access is required';
  end if;

  if p_enabled then
    insert into public.tournament_categories (tournament_id, category_id)
    values (p_tournament_id, p_category_id)
    on conflict do nothing;
  else
    delete from public.tournament_categories
    where tournament_id = p_tournament_id
      and category_id = p_category_id;

    update public.tournament_participants
    set category_id = null
    where tournament_id = p_tournament_id
      and category_id = p_category_id;
  end if;
end;
$$;

revoke all on function public.set_tournament_category(uuid, uuid, boolean) from public;
grant execute on function public.set_tournament_category(uuid, uuid, boolean) to authenticated;

create table public.manager_data_imports (
  user_id uuid primary key references auth.users (id) on delete cascade,
  imported_at timestamptz not null default now()
);

revoke all on table public.manager_data_imports from public, anon, authenticated;

create function public.import_manager_workspace(p_workspace jsonb)
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

  insert into public.participants (id, first_name, last_name, birth_date, wa_id, aetay_id)
  select id, first_name, last_name, birth_date, wa_id, aetay_id
  from jsonb_to_recordset(coalesce(p_workspace->'participants', '[]'::jsonb))
    as input_row(id uuid, first_name text, last_name text, birth_date date, wa_id text, aetay_id text);

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
