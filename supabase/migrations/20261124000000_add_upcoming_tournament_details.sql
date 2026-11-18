-- The archer calendar also shows where a tournament is held and what it shoots, so the function returns the host
-- club's map link, the bow type of each category, and the details of the tournament type. It still returns only
-- calendar fields: no club contact details and no entries of other archers. The return type changes, so the
-- function is dropped and created again.
drop function public.upcoming_tournaments();

create function public.upcoming_tournaments()
returns table (
  id uuid,
  name text,
  days date[],
  discipline text,
  tournament_type text,
  type_distance numeric,
  type_distance_unit text,
  type_target text,
  type_ends integer,
  type_arrows_per_end integer,
  host_club text,
  address text,
  map_url text,
  categories jsonb,
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
    tournament_type.distance,
    tournament_type.distance_unit,
    tournament_type.target_type,
    tournament_type.ends,
    tournament_type.arrows_per_end,
    club.name,
    case tournament.venue_mode when 'club' then coalesce(club.address, '') else tournament.custom_address end,
    -- A custom venue has no stored map link.
    case tournament.venue_mode when 'club' then coalesce(club.map_url, '') else '' end,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('name', category.name, 'bow_type', category.bow_type) order by category.name)
        from public.tournament_categories as allowed
        join public.categories as category on category.id = allowed.category_id
        where allowed.tournament_id = tournament.id
      ),
      '[]'::jsonb
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
