-- Supabase grants execute on new functions to anon by itself, so a revoke from public alone leaves a function
-- open to anon. These four functions only revoked from public. Each one already refuses a caller without
-- access, so nothing leaked. This closes them the way the other functions already do: signed-in users only.
revoke all on function public.has_app_access(text) from public, anon;
revoke all on function public.replace_first_round_matches(uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.set_tournament_category(uuid, uuid, boolean) from public, anon;
revoke all on function public.import_manager_workspace(jsonb) from public, anon;

grant execute on function public.has_app_access(text) to authenticated;
grant execute on function public.replace_first_round_matches(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.set_tournament_category(uuid, uuid, boolean) to authenticated;
grant execute on function public.import_manager_workspace(jsonb) to authenticated;
