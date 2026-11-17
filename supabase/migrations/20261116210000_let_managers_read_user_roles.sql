-- Managers need the admin and manager accounts on User access so they can resend password reset emails.
-- Club and archer rows carry email, club and participant identifiers, so managers cannot read those through the API.
-- Writes stay admin-only: assign_user_role and remove_user_role still check has_role('admin').
drop policy "Users can read their role" on public.user_roles;

create policy "Users can read their role"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role('admin')
    or (public.has_role('manager') and role in ('admin', 'manager'))
  );
