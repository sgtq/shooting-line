-- Who may run the functions in the public schema. Supabase grants execute to anon on every new function, so
-- each function that clients can call must revoke it. Trigger functions are left out: Postgres refuses to run
-- them outside a trigger, and it checks their execute right only when the trigger is created.
begin;

select plan(5);

select is_empty(
  $$select p.oid::regprocedure::text
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')$$,
  'no function in the public schema can be run by the anon role'
);

-- Closing anon must not close the app. These four are the ones that only revoked from public before.
select function_privs_are(
  'public', 'has_app_access', array['text'], 'authenticated', array['EXECUTE'],
  'signed-in users can run has_app_access'
);
select function_privs_are(
  'public', 'replace_first_round_matches', array['uuid', 'uuid', 'uuid', 'jsonb'], 'authenticated',
  array['EXECUTE'], 'signed-in users can run replace_first_round_matches'
);
select function_privs_are(
  'public', 'set_tournament_category', array['uuid', 'uuid', 'boolean'], 'authenticated', array['EXECUTE'],
  'signed-in users can run set_tournament_category'
);
select function_privs_are(
  'public', 'import_manager_workspace', array['jsonb'], 'authenticated', array['EXECUTE'],
  'signed-in users can run import_manager_workspace'
);

select * from finish();

rollback;
