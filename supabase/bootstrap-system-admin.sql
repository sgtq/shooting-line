select 1 / case
  when exists (
    select 1
    from auth.users
    where lower(email) = lower(:'admin_email')
  ) then 1
  else 0
end;

insert into public.user_roles (user_id, email, role)
select auth_user.id, auth_user.email, assigned_role.role
from auth.users as auth_user
cross join (values ('admin'), ('manager')) as assigned_role(role)
where lower(auth_user.email) = lower(:'admin_email')
on conflict (user_id, role) do update
  set email = excluded.email;

insert into public.app_access (user_id, app_id)
select id, 'manager'
from auth.users
where lower(email) = lower(:'admin_email')
on conflict (user_id, app_id) do nothing;

insert into public.user_profiles (user_id, display_name, updated_at)
select id, :'admin_name', now()
from auth.users
where lower(email) = lower(:'admin_email')
on conflict (user_id) do update
  set display_name = excluded.display_name,
      updated_at = excluded.updated_at;
