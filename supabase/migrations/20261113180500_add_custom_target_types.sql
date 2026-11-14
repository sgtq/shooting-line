create table public.target_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create unique index target_types_name_ci_idx on public.target_types (lower(name));

alter table public.target_types enable row level security;

revoke all on table public.target_types from public, anon, authenticated;
grant select, insert on table public.target_types to authenticated;

create policy "Manager access required"
  on public.target_types
  for all
  to authenticated
  using (public.has_app_access('manager'))
  with check (public.has_app_access('manager'));
