create table public.app_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  app_id text not null check (app_id in ('manager', 'ianseo-dashboard', 'scorecard')),
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

alter table public.app_access enable row level security;

grant usage on schema public to authenticated;
revoke all on table public.app_access from public, anon, authenticated;
grant select on public.app_access to authenticated;

create policy "Users can read their own app access"
  on public.app_access
  for select
  to authenticated
  using (auth.uid() = user_id);

create function public.has_app_access(required_app text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_access
    where user_id = (select auth.uid())
      and app_id = required_app
  );
$$;

revoke all on function public.has_app_access(text) from public;
grant execute on function public.has_app_access(text) to authenticated;
