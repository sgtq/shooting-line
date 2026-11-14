alter table public.clubs
  add column logo_url text not null default '';

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'club', 'archer')),
  club_id uuid references public.clubs (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role),
  check (
    (role in ('admin', 'manager') and club_id is null and participant_id is null)
    or (role = 'club' and club_id is not null and participant_id is null)
    or (role = 'archer' and club_id is null and participant_id is not null)
  )
);

insert into public.user_roles (user_id, email, role)
select access.user_id, auth_user.email, 'manager'
from public.app_access as access
join auth.users as auth_user on auth_user.id = access.user_id
where access.app_id = 'manager'
  and auth_user.email is not null
on conflict (user_id, role) do update
  set email = excluded.email;

create index user_roles_email_idx on public.user_roles (lower(email));

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from public, anon, authenticated;
grant select on table public.user_roles to authenticated;

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke all on table public.user_profiles from public, anon, authenticated;
grant select, insert, update on table public.user_profiles to authenticated;

create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    ) then 'admin'
    when exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'manager'
    ) then 'manager'
    when exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'club'
    ) then 'club'
    when exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'archer'
    ) then 'archer'
    when exists (
      select 1 from public.app_access
      where user_id = (select auth.uid()) and app_id = 'manager'
    ) then 'manager'
  end;
$$;

create function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

create policy "Users read their profile"
  on public.user_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin'));

create policy "Users update their profile"
  on public.user_profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin'))
  with check (user_id = (select auth.uid()) or public.has_role('admin'));

create policy "Users create their profile"
  on public.user_profiles
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create function public.current_user_club_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select club_id
  from public.user_roles
  where user_id = (select auth.uid())
    and role = 'club';
$$;

create function public.current_user_participant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select participant_id
  from public.user_roles
  where user_id = (select auth.uid())
    and role = 'archer';
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin')
    or public.has_role('manager')
    or (
      not exists (
        select 1 from public.user_roles where user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.app_access
        where user_id = (select auth.uid()) and app_id = 'manager'
      )
    );
$$;

create function public.can_view_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or exists (
      select 1
      from public.tournaments as tournament
      where tournament.id = p_tournament_id
        and (
          (
            public.current_user_role() = 'club'
            and tournament.club_id = public.current_user_club_id()
          )
          or (
            public.current_user_role() = 'archer'
            and exists (
              select 1
              from public.tournament_participants as entry
              where entry.tournament_id = tournament.id
                and entry.participant_id = public.current_user_participant_id()
            )
          )
        )
    );
$$;

create function public.can_view_participant(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or p_participant_id = public.current_user_participant_id()
    or exists (
      select 1
      from public.participants as participant
      where participant.id = p_participant_id
        and participant.club_id = public.current_user_club_id()
    );
$$;

create function public.can_view_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or p_club_id = public.current_user_club_id()
    or exists (
      select 1
      from public.tournaments as tournament
      join public.tournament_participants as entry
        on entry.tournament_id = tournament.id
      where tournament.club_id = p_club_id
        and entry.participant_id = public.current_user_participant_id()
    );
$$;

create policy "Users can read their role"
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin'));

create function public.assign_user_role(
  p_email text,
  p_role text,
  p_club_id uuid default null,
  p_participant_id uuid default null,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_user_id uuid;
  assigned_email text;
begin
  if not public.has_role('admin') then
    raise exception 'Administrator access is required to assign roles';
  end if;

  if p_role not in ('admin', 'manager', 'club', 'archer') then
    raise exception 'Select a valid role';
  end if;

  if (p_role = 'club' and (p_club_id is null or p_participant_id is not null))
    or (p_role = 'archer' and (p_participant_id is null or p_club_id is not null))
    or (p_role in ('admin', 'manager') and (p_club_id is not null or p_participant_id is not null))
  then
    raise exception 'The selected role requires a matching club or participant';
  end if;

  if p_role = 'club' and not exists (
    select 1 from public.clubs where id = p_club_id
  ) then
    raise exception 'The selected club does not exist';
  end if;

  if p_role = 'archer' and not exists (
    select 1 from public.participants where id = p_participant_id
  ) then
    raise exception 'The selected participant does not exist';
  end if;

  select id, email
    into assigned_user_id, assigned_email
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if assigned_user_id is null then
    raise exception 'No signed-in account was found for that email';
  end if;

  insert into public.user_roles (user_id, email, role, club_id, participant_id)
  values (assigned_user_id, assigned_email, p_role, p_club_id, p_participant_id)
  on conflict (user_id, role) do update
    set email = excluded.email,
        club_id = excluded.club_id,
        participant_id = excluded.participant_id;

  insert into public.app_access (user_id, app_id)
  values (assigned_user_id, 'manager')
  on conflict (user_id, app_id) do nothing;

  if p_display_name is not null then
    insert into public.user_profiles (user_id, display_name, updated_at)
    values (assigned_user_id, btrim(p_display_name), now())
    on conflict (user_id) do update
      set display_name = excluded.display_name,
          updated_at = excluded.updated_at;
  end if;

  return assigned_user_id;
end;
$$;

create function public.save_user_profile(p_display_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to save a profile';
  end if;

  insert into public.user_profiles (user_id, display_name, updated_at)
  values (auth.uid(), btrim(p_display_name), now())
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = excluded.updated_at;
end;
$$;

create function public.remove_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Administrator access is required to remove roles';
  end if;

  if p_role = 'admin'
    and (select count(*) from public.user_roles where role = 'admin') <= 1
  then
    raise exception 'The last system administrator role cannot be removed';
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and role = p_role;

  if not exists (
    select 1 from public.user_roles where user_id = p_user_id
  ) then
    delete from public.app_access
    where user_id = p_user_id
      and app_id = 'manager';
  end if;
end;
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.has_role(text) from public, anon;
revoke all on function public.current_user_club_id() from public, anon;
revoke all on function public.current_user_participant_id() from public, anon;
revoke all on function public.is_manager_or_admin() from public, anon;
revoke all on function public.can_view_tournament(uuid) from public, anon;
revoke all on function public.can_view_participant(uuid) from public, anon;
revoke all on function public.can_view_club(uuid) from public, anon;
revoke all on function public.assign_user_role(text, text, uuid, uuid, text) from public, anon;
revoke all on function public.save_user_profile(text) from public, anon;
revoke all on function public.remove_user_role(uuid, text) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.current_user_club_id() to authenticated;
grant execute on function public.current_user_participant_id() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;
grant execute on function public.can_view_tournament(uuid) to authenticated;
grant execute on function public.can_view_participant(uuid) to authenticated;
grant execute on function public.can_view_club(uuid) to authenticated;
grant execute on function public.assign_user_role(text, text, uuid, uuid, text) to authenticated;
grant execute on function public.save_user_profile(text) to authenticated;
grant execute on function public.remove_user_role(uuid, text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clubs',
    'participants',
    'tournament_types',
    'target_types',
    'categories',
    'tournaments',
    'tournament_rounds',
    'tournament_categories',
    'tournament_participants',
    'round_scores',
    'matches'
  ]
  loop
    execute format('drop policy if exists "Manager access required" on public.%I', table_name);
  end loop;
end
$$;

create policy "Read permitted clubs"
  on public.clubs for select to authenticated
  using (public.can_view_club(id));
create policy "Managers edit clubs"
  on public.clubs for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
create policy "Club users edit own club"
  on public.clubs for update to authenticated
  using (public.current_user_role() = 'club' and id = public.current_user_club_id())
  with check (public.current_user_role() = 'club' and id = public.current_user_club_id());

create policy "Read permitted participants"
  on public.participants for select to authenticated
  using (public.can_view_participant(id));
create policy "Managers edit participants"
  on public.participants for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "App users read tournament types"
  on public.tournament_types for select to authenticated
  using (public.current_user_role() is not null);
create policy "Managers edit tournament types"
  on public.tournament_types for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

drop policy if exists "Manager access required" on public.target_types;
create policy "App users read target types"
  on public.target_types for select to authenticated
  using (public.current_user_role() is not null);
create policy "Managers add target types"
  on public.target_types for insert to authenticated
  with check (public.is_manager_or_admin());

create policy "App users read categories"
  on public.categories for select to authenticated
  using (public.current_user_role() is not null);
create policy "Managers edit categories"
  on public.categories for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read permitted tournaments"
  on public.tournaments for select to authenticated
  using (public.can_view_tournament(id));
create policy "Managers edit tournaments"
  on public.tournaments for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read permitted tournament rounds"
  on public.tournament_rounds for select to authenticated
  using (public.can_view_tournament(tournament_id));
create policy "Managers edit tournament rounds"
  on public.tournament_rounds for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read permitted tournament categories"
  on public.tournament_categories for select to authenticated
  using (public.can_view_tournament(tournament_id));
create policy "Managers edit tournament categories"
  on public.tournament_categories for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read permitted tournament participants"
  on public.tournament_participants for select to authenticated
  using (
    public.is_manager_or_admin()
    or (
      public.current_user_role() = 'club'
      and public.can_view_tournament(tournament_id)
    )
    or (
      public.current_user_role() = 'archer'
      and participant_id = public.current_user_participant_id()
    )
  );
create policy "Managers edit tournament participants"
  on public.tournament_participants for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read permitted round scores"
  on public.round_scores for select to authenticated
  using (
    public.is_manager_or_admin()
    or (
      public.current_user_role() = 'club'
      and public.can_view_tournament(tournament_id)
      and public.can_view_participant(participant_id)
    )
    or (
      public.current_user_role() = 'archer'
      and participant_id = public.current_user_participant_id()
    )
  );
create policy "Managers edit round scores"
  on public.round_scores for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "Read permitted matches"
  on public.matches for select to authenticated
  using (
    public.is_manager_or_admin()
    or (
      public.current_user_role() = 'club'
      and public.can_view_tournament(tournament_id)
    )
    or (
      public.current_user_role() = 'archer'
      and (
        seed1_id = public.current_user_participant_id()
        or seed2_id = public.current_user_participant_id()
      )
    )
  );
create policy "Managers edit matches"
  on public.matches for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do update set public = true;

create policy "Club logo uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'club-logos'
    and (
      public.is_manager_or_admin()
      or (
        public.current_user_role() = 'club'
        and name like public.current_user_club_id()::text || '/%'
      )
    )
  );
create policy "Club logo updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'club-logos'
    and (
      public.is_manager_or_admin()
      or (
        public.current_user_role() = 'club'
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
        and name like public.current_user_club_id()::text || '/%'
      )
    )
  );
