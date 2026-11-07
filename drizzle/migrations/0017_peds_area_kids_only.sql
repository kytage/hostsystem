CREATE OR REPLACE FUNCTION public.can_access_peds(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_team_member(_user_id)
    AND (public.is_coordinator_plus(_user_id) OR public.has_area(_user_id, 'kids'));
$$;