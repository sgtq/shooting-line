-- Managers cannot read club or archer rows in user_roles, so a policy that looks them up directly always fails
-- for a manager and only admins could assign a plan. This check runs as its owner instead. It answers only for a
-- manager or admin, so it cannot be used to find out which accounts hold a role.
create function public.account_has_role(p_user_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager_or_admin()
    and exists (
      select 1 from public.user_roles where user_roles.user_id = p_user_id and user_roles.role = p_role
    );
$$;

revoke all on function public.account_has_role(uuid, text) from public, anon;
grant execute on function public.account_has_role(uuid, text) to authenticated;

-- A subscription must use a plan made for the account's own role.
drop policy if exists "Managers assign subscriptions" on public.user_subscriptions;
create policy "Managers assign subscriptions"
  on public.user_subscriptions for insert to authenticated
  with check (
    public.is_manager_or_admin()
    and exists (
      select 1
      from public.plans
      where plans.id = user_subscriptions.plan_id
        and public.account_has_role(user_subscriptions.user_id, plans.user_role)
    )
  );
