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

revoke all on function public.set_club_user_access(uuid, boolean) from public, anon;
grant execute on function public.set_club_user_access(uuid, boolean) to authenticated;

create policy "Club users insert own club participants"
  on public.participants for insert to authenticated
  with check (
    public.current_user_role() = 'club'
    and club_id = public.current_user_club_id()
  );

create policy "Club users update own club participants"
  on public.participants for update to authenticated
  using (
    public.current_user_role() = 'club'
    and club_id = public.current_user_club_id()
  )
  with check (
    public.current_user_role() = 'club'
    and club_id = public.current_user_club_id()
  );
