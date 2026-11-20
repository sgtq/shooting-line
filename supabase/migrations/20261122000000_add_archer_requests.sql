-- An archer only gets a login when a manager approves a request from their club, so the email is optional.
-- Clubs read full rows only for their own archers (see can_view_participant), so the email is not shared.
alter table public.participants
  add column email text not null default ''
  constraint participants_email_format check (email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- A club asks for a login for one of its archers. Only the approve-archer-requests edge function changes the
-- status, because approving also creates the login and the plan, which needs the service role.
create table public.archer_requests (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references auth.users (id) on delete set null default auth.uid(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (decided_at is null))
);

-- An archer can have one open request at a time. A rejected request does not block a new one.
create unique index archer_requests_one_open_idx
  on public.archer_requests (participant_id)
  where status in ('pending', 'approved');
create index archer_requests_club_status_idx on public.archer_requests (club_id, status);

alter table public.archer_requests enable row level security;
revoke all on table public.archer_requests from public, anon;
grant select, insert on table public.archer_requests to authenticated;

create policy "Read permitted archer requests"
  on public.archer_requests for select to authenticated
  using (
    public.is_manager_or_admin()
    or (
      public.current_user_role() = 'club'
      and public.has_active_plan()
      and club_id = public.current_user_club_id()
    )
  );

-- A club can request only for an archer of its own club that has an email.
create policy "Clubs request logins for their archers"
  on public.archer_requests for insert to authenticated
  with check (
    public.current_user_role() = 'club'
    and public.has_active_plan()
    and club_id = public.current_user_club_id()
    and status = 'pending'
    and requested_by = (select auth.uid())
    and exists (
      select 1
      from public.participants as participant
      where participant.id = archer_requests.participant_id
        and participant.club_id = archer_requests.club_id
        and participant.email <> ''
    )
  );
