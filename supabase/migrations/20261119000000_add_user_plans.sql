-- Needed so one account's subscription periods can be kept from overlapping.
create extension if not exists btree_gist with schema extensions;

-- Plans are the products a club can hold. Only clubs have plans in this version; archer plans come later,
-- so user_role is limited to 'club' and can be widened then.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  user_role text not null default 'club' check (user_role = 'club'),
  duration_kind text not null check (duration_kind in ('monthly', 'yearly', 'custom')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A price is valid from starts_at until ends_at (open-ended when null). A deal is a dated price row.
-- When several prices cover one day, the one with the latest starts_at wins, so a deal overrides the base price
-- and the base price returns when the deal ends.
create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  -- Prices are in Mexican pesos only. The column stays so another currency can be allowed later.
  currency text not null default 'MXN' check (currency = 'MXN'),
  starts_at date not null default current_date,
  ends_at date,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index plan_prices_plan_idx on public.plan_prices (plan_id, starts_at desc);

-- Managers assign these by hand. The dates are chosen at assignment, and the price is copied in so later
-- catalogue changes never rewrite what a club was charged.
create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  price_paid numeric(10, 2) not null check (price_paid >= 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  assigned_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  -- Both end dates count as covered days, so a plan ending on the 31st cannot be followed by one starting on the 31st.
  constraint user_subscriptions_no_overlap
    exclude using gist (user_id with =, daterange(starts_on, ends_on, '[]') with &&)
);

create index user_subscriptions_user_idx on public.user_subscriptions (user_id, ends_on desc);

create function public.has_active_plan()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_subscriptions
    where user_id = (select auth.uid())
      and current_date between starts_on and ends_on
  );
$$;

-- True for a club account whose plan has lapsed or never started. Other roles are never held back by it.
create function public.club_without_plan()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'club' and not public.has_active_plan();
$$;

revoke all on function public.club_without_plan() from public, anon;
grant execute on function public.club_without_plan() to authenticated;
revoke all on function public.has_active_plan() from public, anon;
grant execute on function public.has_active_plan() to authenticated;

alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.user_subscriptions enable row level security;

revoke all on table public.plans, public.plan_prices, public.user_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.plans, public.plan_prices to authenticated;
grant select, insert, update, delete on table public.user_subscriptions to authenticated;

create policy "Read plans"
  on public.plans for select to authenticated
  using (
    public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.has_active_plan() and is_active)
  );
create policy "Managers edit plans"
  on public.plans for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read plan prices"
  on public.plan_prices for select to authenticated
  using (
    public.is_manager_or_admin()
    or (
      public.current_user_role() = 'club'
      and public.has_active_plan()
      and exists (select 1 from public.plans where plans.id = plan_id and plans.is_active)
    )
  );
create policy "Managers edit plan prices"
  on public.plan_prices for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read own or all subscriptions"
  on public.user_subscriptions for select to authenticated
  using (public.is_manager_or_admin() or user_id = (select auth.uid()));
-- Only club users can hold a plan in this version.
create policy "Managers assign subscriptions"
  on public.user_subscriptions for insert to authenticated
  with check (
    public.is_manager_or_admin()
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = user_subscriptions.user_id and user_roles.role = 'club'
    )
  );
create policy "Managers change subscriptions"
  on public.user_subscriptions for update to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
create policy "Managers remove subscriptions"
  on public.user_subscriptions for delete to authenticated
  using (public.is_manager_or_admin());

-- Clubs read every tournament, its rounds, entries, scores and matches, plus the clubs behind them.
-- Archers keep seeing only their own entries. Writes below stay limited to a club's own tournaments.
-- A club reads full archer records (birth date, affiliation IDs) only for its own archers. Other archers appear
-- to it by name only, through visible_participant_names() and search_archers() below.
create or replace function public.can_view_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.has_active_plan())
    or exists (
      select 1
      from public.tournaments as tournament
      where tournament.id = p_tournament_id
        and public.current_user_role() = 'archer'
        and exists (
          select 1
          from public.tournament_participants as entry
          where entry.tournament_id = tournament.id
            and entry.participant_id = public.current_user_participant_id()
        )
    );
$$;

create or replace function public.can_view_participant(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or p_participant_id = public.current_user_participant_id()
    or (
      public.has_active_plan()
      and exists (
        select 1
        from public.participants as participant
        where participant.id = p_participant_id
          and participant.club_id = public.current_user_club_id()
      )
    );
$$;

-- Names of the archers a club needs to read tournaments and scores: its own archers and anyone entered in a
-- tournament. Archers with no entry are not listed, so the database cannot be browsed. Birth date and
-- affiliation IDs are never returned.
create function public.visible_participant_names()
returns table (id uuid, first_name text, last_name text, club_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select participant.id, participant.first_name, participant.last_name, participant.club_id
  from public.participants as participant
  where public.is_manager_or_admin()
    or (
      public.current_user_role() = 'club'
      and public.has_active_plan()
      and (
        participant.club_id = public.current_user_club_id()
        or exists (
          select 1 from public.tournament_participants as entry where entry.participant_id = participant.id
        )
      )
    );
$$;

revoke all on function public.visible_participant_names() from public, anon;
grant execute on function public.visible_participant_names() to authenticated;

-- Scores of other clubs' tournaments are readable. The archer rows behind them are not, so the check no longer
-- asks whether the club can view the archer.
drop policy if exists "Read permitted round scores" on public.round_scores;
create policy "Read permitted round scores"
  on public.round_scores for select to authenticated
  using (
    public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.can_view_tournament(tournament_id))
    or (
      public.current_user_role() = 'archer'
      and participant_id = public.current_user_participant_id()
    )
  );

create or replace function public.can_view_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.has_active_plan())
    or exists (
      select 1
      from public.tournaments as tournament
      join public.tournament_participants as entry
        on entry.tournament_id = tournament.id
      where tournament.club_id = p_club_id
        and entry.participant_id = public.current_user_participant_id()
    );
$$;

-- A started tournament is locked for clubs. Only a manager or admin can clear started_at to reopen it.
alter table public.tournaments add column started_at timestamptz;

-- True when the signed-in club holds an active plan and the tournament is its own and not started.
-- Clubs write only through this check, so plan, ownership and the lock are decided in one place.
create function public.club_can_edit_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'club'
    and public.has_active_plan()
    and exists (
      select 1
      from public.tournaments
      where tournaments.id = p_tournament_id
        and tournaments.club_id = public.current_user_club_id()
        and tournaments.started_at is null
    );
$$;

revoke all on function public.club_can_edit_tournament(uuid) from public, anon;
grant execute on function public.club_can_edit_tournament(uuid) to authenticated;

create policy "Clubs with a plan create own tournaments"
  on public.tournaments for insert to authenticated
  with check (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and club_id = public.current_user_club_id()
    and started_at is null
  );

-- The old row must be unstarted and the club's own, so a club can edit and start a tournament
-- but can never reopen one or take over another club's.
create policy "Clubs with a plan edit own unstarted tournaments"
  on public.tournaments for update to authenticated
  using (public.club_can_edit_tournament(id))
  with check (public.current_user_role() = 'club' and club_id = public.current_user_club_id());

create policy "Clubs with a plan manage rounds of own unstarted tournaments"
  on public.tournament_rounds for all to authenticated
  using (public.club_can_edit_tournament(tournament_id))
  with check (public.club_can_edit_tournament(tournament_id));

create policy "Clubs with a plan manage categories of own unstarted tournaments"
  on public.tournament_categories for all to authenticated
  using (public.club_can_edit_tournament(tournament_id))
  with check (public.club_can_edit_tournament(tournament_id));

-- The category-level trigger must see every entry the archer holds, not only the ones this club can read,
-- or a club could enter an archer into a lower category than one they entered elsewhere. Running it as its
-- owner gives it that view. The only thing a caller can learn from it is the name of the blocking category.
alter function public.enforce_participant_category_level() security definer;

-- Clubs insert entries directly only for their own archers. Any other archer is added with
-- add_archer_by_token() below.
create policy "Clubs with a plan enter own archers in own unstarted tournaments"
  on public.tournament_participants for insert to authenticated
  with check (
    public.club_can_edit_tournament(tournament_id)
    and exists (
      select 1 from public.participants
      where participants.id = participant_id and participants.club_id = public.current_user_club_id()
    )
  );

create policy "Clubs with a plan change entries of own unstarted tournaments"
  on public.tournament_participants for update to authenticated
  using (public.club_can_edit_tournament(tournament_id))
  with check (public.club_can_edit_tournament(tournament_id));

create policy "Clubs with a plan remove entries of own unstarted tournaments"
  on public.tournament_participants for delete to authenticated
  using (public.club_can_edit_tournament(tournament_id));

-- The update policy cannot see the old row, so this keeps a club from pointing an entry at another archer
-- or tournament, which would be a way around the insert rule above.
create function public.keep_entry_identity_for_clubs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_manager_or_admin()
    and (new.tournament_id <> old.tournament_id or new.participant_id <> old.participant_id)
  then
    raise exception 'An entry cannot be moved to another archer or tournament';
  end if;
  return new;
end;
$$;

create trigger tournament_participants_keep_identity
  before update of tournament_id, participant_id on public.tournament_participants
  for each row execute function public.keep_entry_identity_for_clubs();

-- Age limits of a category are checked against the archer's age on the tournament date. This runs as its owner
-- because the caller may not be allowed to read the birth date, and the error never states the age.
-- Managers are not checked here: they can see birth dates, the app already warns them, and the one-time browser
-- import must keep old entries as they were. An archer with no birth date is not limited, as in the app.
create function public.enforce_participant_category_age()
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
  select date into v_event_date from public.tournaments where id = new.tournament_id;
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

create trigger tournament_participants_category_age
  before insert or update of participant_id, tournament_id, category_id on public.tournament_participants
  for each row execute function public.enforce_participant_category_age();

-- Puts an archer in a tournament. A club can use it only on its own unstarted tournaments. The category triggers
-- still run. Nobody can call this helper directly, and callers never supply an archer's database ID: they use a
-- one-time token from search_archers() below.
create function public.enter_archer_in_tournament(
  p_tournament_id uuid,
  p_participant_id uuid,
  p_category_id uuid
)
returns table (id uuid, first_name text, last_name text, club_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_manager_or_admin() or public.club_can_edit_tournament(p_tournament_id)) then
    raise exception 'This tournament cannot be changed';
  end if;
  if exists (
    select 1 from public.tournament_participants entry
    where entry.tournament_id = p_tournament_id and entry.participant_id = p_participant_id
  ) then
    raise exception 'That archer is already in this tournament';
  end if;

  insert into public.tournament_participants (tournament_id, participant_id, category_id)
  values (p_tournament_id, p_participant_id, p_category_id);

  return query
  select participant.id, participant.first_name, participant.last_name, participant.club_id
  from public.participants as participant
  where participant.id = p_participant_id;
end;
$$;

revoke all on function public.enter_archer_in_tournament(uuid, uuid, uuid) from public, anon, authenticated;

-- A search result stands for an archer without revealing their database ID. Each token belongs to the user who
-- searched, works once, and expires after ten minutes. Only the functions below read or write this table.
create table public.archer_lookup_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index archer_lookup_tokens_user_idx on public.archer_lookup_tokens (user_id, expires_at);

alter table public.archer_lookup_tokens enable row level security;
revoke all on table public.archer_lookup_tokens from public, anon, authenticated;

-- Finds archers for the add-archer form while the user types. An affiliation ID (World Archery or AETAY) must
-- match exactly. Without one, the start of the last name (at least 3 letters) is matched, optionally narrowed by
-- the start of the first name. Archers already in p_tournament_id are left out. It returns names, clubs and a token only, never IDs or birth dates, and stops at
-- 20 rows, so it cannot list the database. A club needs an active plan to search at all.
create function public.search_archers(
  p_affiliation_id text default null,
  p_last_name text default null,
  p_first_name text default null,
  p_tournament_id uuid default null
)
returns table (token uuid, first_name text, last_name text, club_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id text := lower(btrim(coalesce(p_affiliation_id, '')));
  v_last text := lower(btrim(coalesce(p_last_name, '')));
  v_first text := lower(btrim(coalesce(p_first_name, '')));
begin
  if not (
    public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.has_active_plan())
  ) then
    raise exception 'An active plan is required to search archers';
  end if;

  delete from public.archer_lookup_tokens
  where user_id = (select auth.uid()) and expires_at < now();

  if v_id = '' and char_length(v_last) < 3 then
    return;
  end if;

  return query
  with matches as (
    select participant.id, participant.first_name, participant.last_name, participant.club_id
    from public.participants as participant
    where (
      p_tournament_id is null
      or not exists (
        select 1 from public.tournament_participants as entry
        where entry.tournament_id = p_tournament_id and entry.participant_id = participant.id
      )
    )
    and case
      when v_id <> '' then lower(participant.wa_id) = v_id or lower(participant.aetay_id) = v_id
      else starts_with(lower(participant.last_name), v_last)
        and (v_first = '' or starts_with(lower(participant.first_name), v_first))
    end
    order by participant.last_name, participant.first_name
    limit 20
  ),
  issued as (
    insert into public.archer_lookup_tokens (user_id, participant_id)
    select (select auth.uid()), matches.id from matches
    returning archer_lookup_tokens.token, archer_lookup_tokens.participant_id
  )
  select issued.token, matches.first_name, matches.last_name, matches.club_id
  from issued
  join matches on matches.id = issued.participant_id
  order by matches.last_name, matches.first_name;
end;
$$;

-- Adds the archer behind a search result to a tournament.
create function public.add_archer_by_token(
  p_tournament_id uuid,
  p_token uuid,
  p_category_id uuid default null
)
returns table (id uuid, first_name text, last_name text, club_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id uuid;
begin
  if not (public.is_manager_or_admin() or public.club_can_edit_tournament(p_tournament_id)) then
    raise exception 'This tournament cannot be changed';
  end if;

  select lookup.participant_id into v_participant_id
  from public.archer_lookup_tokens as lookup
  where lookup.token = p_token
    and lookup.user_id = (select auth.uid())
    and lookup.expires_at > now();

  if v_participant_id is null then
    raise exception 'That search result has expired. Search again';
  end if;

  delete from public.archer_lookup_tokens where archer_lookup_tokens.token = p_token;

  return query select * from public.enter_archer_in_tournament(p_tournament_id, v_participant_id, p_category_id);
end;
$$;

revoke all on function public.search_archers(text, text, text, uuid) from public, anon;
revoke all on function public.add_archer_by_token(uuid, uuid, uuid) from public, anon;
grant execute on function public.search_archers(text, text, text, uuid) to authenticated;
grant execute on function public.add_archer_by_token(uuid, uuid, uuid) to authenticated;

-- A club without an active plan cannot change anything: no tournaments, archers, club details, logo, profile,
-- or search. It cannot read app data either, as set out at the end of this file. Managers and admins are not affected.
drop policy if exists "Club users insert own club participants" on public.participants;
create policy "Club users insert own club participants"
  on public.participants for insert to authenticated
  with check (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and club_id = public.current_user_club_id()
  );

drop policy if exists "Club users update own club participants" on public.participants;
create policy "Club users update own club participants"
  on public.participants for update to authenticated
  using (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and club_id = public.current_user_club_id()
  )
  with check (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and club_id = public.current_user_club_id()
  );

drop policy if exists "Club users edit own club" on public.clubs;
create policy "Club users edit own club"
  on public.clubs for update to authenticated
  using (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and id = public.current_user_club_id()
  )
  with check (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and id = public.current_user_club_id()
  );

drop policy if exists "Club logo uploads" on storage.objects;
create policy "Club logo uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'club-logos'
    and (
      public.is_manager_or_admin()
      or (
        public.current_user_role() = 'club'
        and public.has_active_plan()
        and name like public.current_user_club_id()::text || '/%'
      )
    )
  );

drop policy if exists "Club logo updates" on storage.objects;
create policy "Club logo updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'club-logos'
    and (
      public.is_manager_or_admin()
      or (
        public.current_user_role() = 'club'
        and public.has_active_plan()
        and name like public.current_user_club_id()::text || '/%'
      )
    )
  )
  with check (
    bucket_id = 'club-logos'
    and (
      public.is_manager_or_admin()
      or (
        public.current_user_role() = 'club'
        and public.has_active_plan()
        and name like public.current_user_club_id()::text || '/%'
      )
    )
  );

-- Profile writes go through table policies that other roles share, so the lock is a trigger.
create function public.require_plan_for_club_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.current_user_role() = 'club' and not public.has_active_plan() then
    raise exception 'An active plan is required to change the profile';
  end if;
  return new;
end;
$$;

create trigger user_profiles_require_plan_for_club
  before insert or update on public.user_profiles
  for each row execute function public.require_plan_for_club_profile();

-- A club without an active plan reads nothing: tournaments, clubs, archers, and the shared lists below are all
-- closed to it. It can still read its own roles, profile, and subscriptions, so the app can tell it why.
drop policy if exists "App users read tournament types" on public.tournament_types;
create policy "App users read tournament types"
  on public.tournament_types for select to authenticated
  using (public.current_user_role() is not null and not public.club_without_plan());

drop policy if exists "App users read target types" on public.target_types;
create policy "App users read target types"
  on public.target_types for select to authenticated
  using (public.current_user_role() is not null and not public.club_without_plan());

drop policy if exists "App users read categories" on public.categories;
create policy "App users read categories"
  on public.categories for select to authenticated
  using (public.current_user_role() is not null and not public.club_without_plan());

-- Only a manager or admin can change a club's name or location. A club can still change its other details,
-- so this is a trigger: a policy cannot limit which columns an update touches.
create function public.keep_club_name_and_location_for_managers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_manager_or_admin()
    and (
      new.name is distinct from old.name
      or new.address is distinct from old.address
      or new.map_url is distinct from old.map_url
    )
  then
    raise exception 'Only a manager can change the name or location of a club';
  end if;
  return new;
end;
$$;

create trigger clubs_keep_name_and_location
  before update of name, address, map_url on public.clubs
  for each row execute function public.keep_club_name_and_location_for_managers();
