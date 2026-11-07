-- Trigger function: runs only via trigger, no role needs direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Unused helper (no policy or app code calls it): block direct execution
REVOKE EXECUTE ON FUNCTION public.is_founder(uuid) FROM PUBLIC, anon, authenticated;

-- has_role: required by RLS policies for signed-in users, but anon must not execute it
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;