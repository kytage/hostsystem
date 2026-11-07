ALTER TABLE public.captacoes_estabelecimentos DROP CONSTRAINT captacoes_estabelecimentos_status_check;
ALTER TABLE public.captacoes_estabelecimentos ADD CONSTRAINT captacoes_estabelecimentos_status_check CHECK (status IN ('livre', 'reservado', 'ocupado', 'desativado'));
CREATE OR REPLACE FUNCTION public.can_access_captacoes(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_team_member(_user_id) AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role IN ('coordinator', 'direcao', 'c_level', 'founder'))
    OR public.has_area(_user_id, 'ilegal')
    OR public.has_area(_user_id, 'captacao')
    OR public.has_area(_user_id, 'policia')
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_access_captacoes(uuid) TO authenticated, service_role;