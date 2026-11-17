-- clubs.user_enabled means "at least one account holds the club role for this club".
-- Backfill it for roles created before the flag was kept in step.
update public.clubs c
set user_enabled = true,
    user_email = coalesce(
      nullif(btrim(c.user_email), ''),
      (select r.email from public.user_roles r where r.role = 'club' and r.club_id = c.id limit 1),
      ''
    )
where not c.user_enabled
  and exists (
    select 1 from public.user_roles r where r.role = 'club' and r.club_id = c.id
  );

-- Rejects an account that already holds the club role for another club, because the
-- (user_id, role) key would otherwise move that role and leave the first club marked enabled.
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

  select name, coalesce(nullif(btrim(email), ''), btrim(user_email))
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

-- Saves the club details and synchronizes its account in one transaction, so a failed
-- reassignment leaves both the details and the grants unchanged.
create or replace function public.save_club_with_access(
  p_id uuid,
  p_name text,
  p_representative text,
  p_phone text,
  p_email text,
  p_website text,
  p_address text,
  p_map_url text,
  p_logo_url text,
  p_user_email text,
  p_enabled boolean,
  p_sync_access boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.clubs (
    id, name, representative, phone, email, website, address, map_url, logo_url, user_email
  )
  values (
    p_id, p_name, p_representative, p_phone, p_email, p_website, p_address, p_map_url,
    p_logo_url, p_user_email
  )
  on conflict (id) do update
    set name = excluded.name,
        representative = excluded.representative,
        phone = excluded.phone,
        email = excluded.email,
        website = excluded.website,
        address = excluded.address,
        map_url = excluded.map_url,
        logo_url = excluded.logo_url,
        user_email = excluded.user_email;

  if p_sync_access then
    perform public.set_club_user_access(p_id, p_enabled);
  end if;
end;
$$;

-- Keeps clubs.user_enabled in step when an administrator assigns a club role directly.
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

-- Keeps clubs.user_enabled in step when an administrator removes a club role.
create or replace function public.remove_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_club_id uuid;
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
    and role = p_role
  returning club_id into removed_club_id;

  if removed_club_id is not null then
    update public.clubs c
    set user_enabled = exists (
      select 1 from public.user_roles r where r.role = 'club' and r.club_id = c.id
    )
    where c.id = removed_club_id;
  end if;

  if not exists (
    select 1 from public.user_roles where user_id = p_user_id
  ) then
    delete from public.app_access
    where user_id = p_user_id
      and app_id = 'manager';
  end if;
end;
$$;

revoke all on function public.save_club_with_access(
  uuid, text, text, text, text, text, text, text, text, text, boolean, boolean
) from public, anon;
grant execute on function public.save_club_with_access(
  uuid, text, text, text, text, text, text, text, text, text, boolean, boolean
) to authenticated;
