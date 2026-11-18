-- Archers can hold plans. A plan with no end date stays active until a manager gives it one.
alter table public.plans drop constraint if exists plans_user_role_check;
alter table public.plans add constraint plans_user_role_check check (user_role in ('club', 'archer'));

alter table public.plans drop constraint if exists plans_duration_kind_check;
alter table public.plans
  add constraint plans_duration_kind_check check (duration_kind in ('monthly', 'yearly', 'custom', 'unlimited'));

-- A null end date means the subscription never ends. The overlap constraint already reads a null upper bound
-- as unbounded, and the end-date check passes on null.
alter table public.user_subscriptions alter column ends_on drop not null;

-- Internal check used by the functions below. It takes any user id, so callers cannot run it directly.
create function public.user_has_active_plan(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_subscriptions
    where user_id = p_user_id
      and current_date between starts_on and coalesce(ends_on, 'infinity'::date)
  );
$$;

revoke all on function public.user_has_active_plan(uuid) from public, anon, authenticated;

create or replace function public.has_active_plan()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.user_has_active_plan((select auth.uid()));
$$;

-- A club is active while an account holds its club role and that account has a covering plan. A disabled club
-- has no such account, so it is not active.
create function public.club_is_active(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.role = 'club'
      and user_roles.club_id = p_club_id
      and public.user_has_active_plan(user_roles.user_id)
  );
$$;

revoke all on function public.club_is_active(uuid) from public, anon, authenticated;

-- An archer is enabled by a covering plan that was paid for, or by a free one while their club is active.
-- An archer with no club depends on their own plan only. "Paid" reads the price stored on the subscription, so
-- a later change to the catalogue price never changes an archer who already holds a plan.
create function public.archer_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_subscriptions as subscription
    where subscription.user_id = (select auth.uid())
      and current_date between subscription.starts_on and coalesce(subscription.ends_on, 'infinity'::date)
      and (
        subscription.price_paid > 0
        or coalesce(
          (
            select public.club_is_active(participant.club_id)
            from public.user_roles as role_row
            join public.participants as participant on participant.id = role_row.participant_id
            where role_row.user_id = (select auth.uid())
              and role_row.role = 'archer'
              and participant.club_id is not null
          ),
          true
        )
      )
  );
$$;

-- True for a club or archer account that is held back. Managers and admins are never held back.
create function public.user_without_plan()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_user_role()
    when 'club' then not public.has_active_plan()
    when 'archer' then not public.archer_is_enabled()
    else false
  end;
$$;

revoke all on function public.archer_is_enabled() from public, anon;
revoke all on function public.user_without_plan() from public, anon;
grant execute on function public.archer_is_enabled() to authenticated;
grant execute on function public.user_without_plan() to authenticated;

-- A subscription must use a plan made for the account's own role, so a club account cannot hold an archer plan.
drop policy if exists "Managers assign subscriptions" on public.user_subscriptions;
create policy "Managers assign subscriptions"
  on public.user_subscriptions for insert to authenticated
  with check (
    public.is_manager_or_admin()
    and exists (
      select 1
      from public.user_roles
      join public.plans on plans.id = user_subscriptions.plan_id
      where user_roles.user_id = user_subscriptions.user_id
        and user_roles.role = plans.user_role
    )
  );

-- The free plan every archer starts on. It has no end date and costs nothing, and a manager can change either.
do $$
declare
  v_plan_id uuid;
begin
  select id into v_plan_id from public.plans where name = 'Archer basic' and user_role = 'archer';
  if v_plan_id is null then
    insert into public.plans (name, user_role, duration_kind)
    values ('Archer basic', 'archer', 'unlimited')
    returning id into v_plan_id;
    insert into public.plan_prices (plan_id, amount) values (v_plan_id, 0);
  end if;
end;
$$;

-- Archers read nothing while they are not enabled. They can still read their own roles, profile, and
-- subscriptions, so the app can tell them why.
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
        and public.archer_is_enabled()
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
    or (p_participant_id = public.current_user_participant_id() and public.archer_is_enabled())
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

create or replace function public.can_view_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.has_active_plan())
    or (
      public.archer_is_enabled()
      and exists (
        select 1
        from public.tournaments as tournament
        join public.tournament_participants as entry
          on entry.tournament_id = tournament.id
        where tournament.club_id = p_club_id
          and entry.participant_id = public.current_user_participant_id()
      )
    );
$$;

drop policy if exists "Read permitted tournament participants" on public.tournament_participants;
create policy "Read permitted tournament participants"
  on public.tournament_participants for select to authenticated
  using (
    public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.can_view_tournament(tournament_id))
    or (
      public.current_user_role() = 'archer'
      and public.archer_is_enabled()
      and participant_id = public.current_user_participant_id()
    )
  );

drop policy if exists "Read permitted round scores" on public.round_scores;
create policy "Read permitted round scores"
  on public.round_scores for select to authenticated
  using (
    public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.can_view_tournament(tournament_id))
    or (
      public.current_user_role() = 'archer'
      and public.archer_is_enabled()
      and participant_id = public.current_user_participant_id()
    )
  );

drop policy if exists "Read permitted matches" on public.matches;
create policy "Read permitted matches"
  on public.matches for select to authenticated
  using (
    public.is_manager_or_admin()
    or (public.current_user_role() = 'club' and public.can_view_tournament(tournament_id))
    or (
      public.current_user_role() = 'archer'
      and public.archer_is_enabled()
      and (
        seed1_id = public.current_user_participant_id()
        or seed2_id = public.current_user_participant_id()
      )
    )
  );

-- The shared lists follow the same rule as the tables above.
drop policy if exists "App users read tournament types" on public.tournament_types;
create policy "App users read tournament types"
  on public.tournament_types for select to authenticated
  using (public.current_user_role() is not null and not public.user_without_plan());

drop policy if exists "App users read target types" on public.target_types;
create policy "App users read target types"
  on public.target_types for select to authenticated
  using (public.current_user_role() is not null and not public.user_without_plan());

drop policy if exists "App users read categories" on public.categories;
create policy "App users read categories"
  on public.categories for select to authenticated
  using (public.current_user_role() is not null and not public.user_without_plan());

drop function public.club_without_plan();
