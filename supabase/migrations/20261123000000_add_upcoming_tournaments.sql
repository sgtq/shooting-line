-- The tournament calendar for an archer. It returns only what a calendar shows, so no table policy is widened
-- and no club contact details or entry lists are exposed. A tournament that has not started is listed for every
-- enabled archer. One that is under way is listed only for archers entered in it.
create function public.upcoming_tournaments()
returns table (
  id uuid,
  name text,
  days date[],
  discipline text,
  tournament_type text,
  host_club text,
  address text,
  categories text[],
  is_entered boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tournament.id,
    tournament.name,
    schedule.days,
    tournament.discipline,
    tournament_type.name,
    club.name,
    case tournament.venue_mode when 'club' then coalesce(club.address, '') else tournament.custom_address end,
    coalesce(
      (
        select array_agg(category.name order by category.name)
        from public.tournament_categories as allowed
        join public.categories as category on category.id = allowed.category_id
        where allowed.tournament_id = tournament.id
      ),
      '{}'
    ),
    entered.is_entered
  from public.tournaments as tournament
  cross join lateral (
    select array_agg(date.day order by date.day) as days
    from public.tournament_dates as date
    where date.tournament_id = tournament.id
  ) as schedule
  cross join lateral (
    select exists (
      select 1
      from public.tournament_participants as entry
      where entry.tournament_id = tournament.id
        and entry.participant_id = public.current_user_participant_id()
    ) as is_entered
  ) as entered
  left join public.tournament_types as tournament_type on tournament_type.id = tournament.tournament_type_id
  left join public.clubs as club on club.id = tournament.club_id
  where public.current_user_role() = 'archer'
    and public.archer_is_enabled()
    and schedule.days is not null
    and schedule.days[array_upper(schedule.days, 1)] >= current_date
    and (schedule.days[1] >= current_date or entered.is_entered)
  order by schedule.days[1], tournament.name;
$$;

revoke all on function public.upcoming_tournaments() from public, anon;
grant execute on function public.upcoming_tournaments() to authenticated;
