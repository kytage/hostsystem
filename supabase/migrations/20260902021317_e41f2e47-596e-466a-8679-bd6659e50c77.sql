CREATE OR REPLACE FUNCTION public.is_ilegal_lider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_areas
    WHERE user_id = _user_id
      AND area = 'ilegal'
      AND nivel = 'lider'
  )
$$;

REVOKE ALL ON FUNCTION public.is_ilegal_lider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ilegal_lider(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_edit_ilegal(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_coordinator_plus(_user_id) OR public.is_ilegal_lider(_user_id)
$$;

REVOKE ALL ON FUNCTION public.can_edit_ilegal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_ilegal(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Coordinator+ cria orgs" ON public.ilegal_orgs;
DROP POLICY IF EXISTS "Coordinator+ edita orgs" ON public.ilegal_orgs;
DROP POLICY IF EXISTS "Coordinator+ remove orgs" ON public.ilegal_orgs;
CREATE POLICY "Editores do ilegal criam orgs" ON public.ilegal_orgs FOR INSERT TO authenticated WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "Editores do ilegal editam orgs" ON public.ilegal_orgs FOR UPDATE TO authenticated USING (public.can_edit_ilegal(auth.uid())) WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "Editores do ilegal removem orgs" ON public.ilegal_orgs FOR DELETE TO authenticated USING (public.can_edit_ilegal(auth.uid()));

DROP POLICY IF EXISTS "Coordinator+ cria detalhes" ON public.ilegal_detalhes;
DROP POLICY IF EXISTS "Coordinator+ edita detalhes" ON public.ilegal_detalhes;
DROP POLICY IF EXISTS "Coordinator+ remove detalhes" ON public.ilegal_detalhes;
CREATE POLICY "Editores do ilegal criam detalhes" ON public.ilegal_detalhes FOR INSERT TO authenticated WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "Editores do ilegal editam detalhes" ON public.ilegal_detalhes FOR UPDATE TO authenticated USING (public.can_edit_ilegal(auth.uid())) WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "Editores do ilegal removem detalhes" ON public.ilegal_detalhes FOR DELETE TO authenticated USING (public.can_edit_ilegal(auth.uid()));

DROP POLICY IF EXISTS "Coordinator+ cria avisos ilegal" ON public.ilegal_avisos;
DROP POLICY IF EXISTS "Coordinator+ remove avisos ilegal" ON public.ilegal_avisos;
CREATE POLICY "Editores do ilegal criam avisos" ON public.ilegal_avisos FOR INSERT TO authenticated WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "Editores do ilegal removem avisos" ON public.ilegal_avisos FOR DELETE TO authenticated USING (public.can_edit_ilegal(auth.uid()));

DROP POLICY IF EXISTS "Coordinator+ remove ilegal_anotacoes" ON public.ilegal_anotacoes;
CREATE POLICY "Editores do ilegal removem anotacoes" ON public.ilegal_anotacoes FOR DELETE TO authenticated USING (public.can_edit_ilegal(auth.uid()));

DROP POLICY IF EXISTS "Coordinator+ remove ilegal_cronograma" ON public.ilegal_cronograma;
CREATE POLICY "Editores do ilegal removem cronograma" ON public.ilegal_cronograma FOR DELETE TO authenticated USING (public.can_edit_ilegal(auth.uid()));