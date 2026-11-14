do $$
declare
  existing_primary_key text;
  expected_columns smallint[];
begin
  select array[
    (select attnum from pg_attribute
     where attrelid = 'public.user_roles'::regclass and attname = 'user_id'),
    (select attnum from pg_attribute
     where attrelid = 'public.user_roles'::regclass and attname = 'role')
  ]::smallint[]
  into expected_columns;

  select conname
  into existing_primary_key
  from pg_constraint
  where conrelid = 'public.user_roles'::regclass
    and contype = 'p';

  if existing_primary_key is not null and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'p'
      and conkey = expected_columns
  ) then
    execute format('alter table public.user_roles drop constraint %I', existing_primary_key);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'p'
      and conkey = expected_columns
  ) then
    alter table public.user_roles
      add constraint user_roles_pkey primary key (user_id, role);
  end if;
end
$$;
