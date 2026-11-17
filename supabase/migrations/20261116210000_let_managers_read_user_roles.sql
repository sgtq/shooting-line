-- Managers need the account list on User access so they can resend password reset emails.
-- Writes stay admin-only: assign_user_role and remove_user_role still check has_role('admin').
drop policy "Users can read their role" on public.user_roles;

create policy "Users can read their role"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role('admin')
    or public.has_role('manager')
  );
