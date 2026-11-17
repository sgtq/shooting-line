-- clubs.user_enabled means "at least one account holds the club role for this club".
-- Reconcile it in both directions: the earlier backfill only turned the flag on.
update public.clubs c
set user_enabled = exists (
  select 1 from public.user_roles r where r.role = 'club' and r.club_id = c.id
)
where c.user_enabled is distinct from exists (
  select 1 from public.user_roles r where r.role = 'club' and r.club_id = c.id
);

-- Resolves the login account from user_email first. clubs.email is the public contact address
-- and can differ from the login address on clubs saved before the two fields were kept together.
-- A per-account advisory lock serializes concurrent enables, so the "already assigned to another
-- club" check cannot be bypassed by a race.
create or replace function public.set_club_user_access(
  p_club_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_name text;
  v_club_email text;
  v_user_id uuid;
  v_resolved_email text;
  v_removed_user_id uuid;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Manager or administrator access is required';
  end if;

  select name, coalesce(nullif(btrim(user_email), ''), btrim(email))
    into v_club_name, v_club_email
  from public.clubs
  where id = p_club_id;

  if not found then
    raise exception 'Club not found';
  end if;

  if p_enabled then
    if coalesce(v_club_email, '') = '' then
      raise exception 'Add a club email before enabling access';
    end if;

    select id, email
      into v_user_id, v_resolved_email
    from auth.users
    where lower(email) = lower(v_club_email)
    limit 1;

    if v_user_id is null then
      raise exception 'No signed-in account was found for that email';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

    if exists (
      select 1 from public.user_roles
      where user_id = v_user_id
        and role = 'club'
        and club_id is distinct from p_club_id
    ) then
      raise exception 'That account is already assigned to another club';
    end if;

    for v_removed_user_id in
      delete from public.user_roles
      where role = 'club'
        and club_id = p_club_id
        and user_id <> v_user_id
      returning user_id
    loop
      if not exists (
        select 1 from public.user_roles where user_id = v_removed_user_id
      ) then
        delete from public.app_access
        where user_id = v_removed_user_id
          and app_id = 'manager';
      end if;
    end loop;

    insert into public.user_roles (user_id, email, role, club_id, participant_id)
    values (v_user_id, v_resolved_email, 'club', p_club_id, null)
    on conflict (user_id, role) do update
      set email = excluded.email,
          club_id = excluded.club_id,
          participant_id = null;

    insert into public.app_access (user_id, app_id)
    values (v_user_id, 'manager')
    on conflict (user_id, app_id) do nothing;

    if coalesce(btrim(v_club_name), '') <> '' then
      insert into public.user_profiles (user_id, display_name, updated_at)
      values (v_user_id, btrim(v_club_name), now())
      on conflict (user_id) do update
        set display_name = excluded.display_name,
            updated_at = excluded.updated_at;
    end if;
  else
    for v_removed_user_id in
      delete from public.user_roles
      where role = 'club'
        and club_id = p_club_id
      returning user_id
    loop
      if not exists (
        select 1 from public.user_roles where user_id = v_removed_user_id
      ) then
        delete from public.app_access
        where user_id = v_removed_user_id
          and app_id = 'manager';
      end if;
    end loop;
  end if;

  update public.clubs
  set user_enabled = p_enabled,
      user_email = coalesce(v_resolved_email, user_email)
  where id = p_club_id;
end;
$$;

-- Takes the same per-account lock as set_club_user_access, so a direct assignment cannot
-- interleave with an enable for the same account.
create or replace function public.assign_user_role(
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
  previous_club_id uuid;
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

  perform pg_advisory_xact_lock(hashtextextended(assigned_user_id::text, 0));

  select club_id
    into previous_club_id
  from public.user_roles
  where user_id = assigned_user_id
    and role = 'club';

  insert into public.user_roles (user_id, email, role, club_id, participant_id)
  values (assigned_user_id, assigned_email, p_role, p_club_id, p_participant_id)
  on conflict (user_id, role) do update
    set email = excluded.email,
        club_id = excluded.club_id,
        participant_id = excluded.participant_id;

  if p_role = 'club' then
    update public.clubs
    set user_enabled = true,
        user_email = assigned_email
    where id = p_club_id;

    -- The (user_id, role) key moves the role, so the club it left may have lost its last account.
    if previous_club_id is not null and previous_club_id <> p_club_id then
      update public.clubs c
      set user_enabled = exists (
        select 1 from public.user_roles r where r.role = 'club' and r.club_id = c.id
      )
      where c.id = previous_club_id;
    end if;
  end if;

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
