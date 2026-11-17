-- A category's sort_order ranks its level within its bow type. A lower number is a lower level.
-- A level_exempt category (for example Masters, limited only by age) is outside that ranking:
-- it never blocks another category and is never blocked.
alter table public.categories
  add column sort_order integer not null default 0 check (sort_order >= 0),
  add column level_exempt boolean not null default false;

-- Existing categories get a starting order from their minimum age. Managers can adjust it afterward.
update public.categories c
set sort_order = ranked.position
from (
  select id,
    (row_number() over (
      partition by bow_type
      order by coalesce(min_age, 0), coalesce(max_age, 1000), created_at
    ) - 1)::integer as position
  from public.categories
) ranked
where ranked.id = c.id;

-- An archer who has entered a category can never enter a lower level of the same bow type,
-- including by changing the category of an entry they already hold.
-- Runs as the table owner so that entries in tournaments the caller cannot read still count.
-- On an update, the stored row still holds the old category, so a downgrade is rejected too.
create function public.enforce_participant_category_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new public.categories;
  v_blocking_name text;
begin
  if new.category_id is null then
    return new;
  end if;

  select * into v_new from public.categories where id = new.category_id;

  if v_new.level_exempt then
    return new;
  end if;

  select c.name
    into v_blocking_name
  from public.tournament_participants tp
  join public.categories c on c.id = tp.category_id
  where tp.participant_id = new.participant_id
    and not c.level_exempt
    and c.bow_type = v_new.bow_type
    and c.sort_order > v_new.sort_order
  limit 1;

  if v_blocking_name is not null then
    raise exception 'This archer already entered % and cannot enter the lower category %',
      v_blocking_name, v_new.name;
  end if;

  return new;
end;
$$;

create trigger tournament_participants_category_level
  before insert or update of category_id on public.tournament_participants
  for each row execute function public.enforce_participant_category_level();
