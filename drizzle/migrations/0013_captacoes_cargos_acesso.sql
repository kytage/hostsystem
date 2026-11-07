CREATE OR REPLACE FUNCTION public.can_access_captacoes(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_team_member(_user_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role IN ('coordinator', 'direcao', 'c_level', 'founder')
      )
      OR public.has_area(_user_id, 'ilegal')
      OR public.has_area(_user_id, 'captacao')
    );
$$;
REVOKE ALL ON FUNCTION public.can_access_captacoes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_captacoes(uuid) TO authenticated, service_role;