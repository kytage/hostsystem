CREATE OR REPLACE FUNCTION public.can_access_captacoes(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_team_member(_user_id) AND (public.has_area(_user_id, 'ilegal') OR public.has_area(_user_id, 'captacao')); $$;
REVOKE ALL ON FUNCTION public.can_access_captacoes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_captacoes(uuid) TO authenticated, service_role;
ALTER POLICY captacoes_team_all ON public.captacoes USING (public.can_access_captacoes(auth.uid())) WITH CHECK (public.can_access_captacoes(auth.uid()));
ALTER POLICY captacoes_reunioes_team_all ON public.captacoes_reunioes USING (public.can_access_captacoes(auth.uid())) WITH CHECK (public.can_access_captacoes(auth.uid()));
ALTER POLICY captacoes_categorias_team_all ON public.captacoes_categorias USING (public.can_access_captacoes(auth.uid())) WITH CHECK (public.can_access_captacoes(auth.uid()));
ALTER POLICY captacoes_estab_team_all ON public.captacoes_estabelecimentos USING (public.can_access_captacoes(auth.uid())) WITH CHECK (public.can_access_captacoes(auth.uid()));
ALTER POLICY captacoes_modelos_team_select ON public.captacoes_modelos USING (public.can_access_captacoes(auth.uid()));
ALTER POLICY captacoes_modelos_coord_update ON public.captacoes_modelos USING (public.can_access_captacoes(auth.uid())) WITH CHECK (public.can_access_captacoes(auth.uid()));