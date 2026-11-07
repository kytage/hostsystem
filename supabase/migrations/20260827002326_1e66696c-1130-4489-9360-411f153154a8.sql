CREATE OR REPLACE FUNCTION public.is_coordinator_plus(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('founder'::public.app_role, 'c_level'::public.app_role, 'direcao'::public.app_role, 'coordinator'::public.app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.is_coordinator_plus(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coordinator_plus(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Equipe autenticada gerencia orgs" ON public.ilegal_orgs;
DROP POLICY IF EXISTS "Equipe autenticada gerencia detalhes" ON public.ilegal_detalhes;

CREATE POLICY "Equipe visualiza orgs" ON public.ilegal_orgs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinator+ cria orgs" ON public.ilegal_orgs
  FOR INSERT TO authenticated WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "Coordinator+ edita orgs" ON public.ilegal_orgs
  FOR UPDATE TO authenticated USING (public.is_coordinator_plus(auth.uid())) WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "Coordinator+ remove orgs" ON public.ilegal_orgs
  FOR DELETE TO authenticated USING (public.is_coordinator_plus(auth.uid()));

CREATE POLICY "Equipe visualiza detalhes" ON public.ilegal_detalhes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinator+ cria detalhes" ON public.ilegal_detalhes
  FOR INSERT TO authenticated WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "Coordinator+ edita detalhes" ON public.ilegal_detalhes
  FOR UPDATE TO authenticated USING (public.is_coordinator_plus(auth.uid())) WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "Coordinator+ remove detalhes" ON public.ilegal_detalhes
  FOR DELETE TO authenticated USING (public.is_coordinator_plus(auth.uid()));