-- Organizações livres: toda a equipe vê as organizações legais (estabelecimentos das
-- captações); Manager+ também edita. Quem já tinha acesso às captações continua igual. Idempotente.
CREATE OR REPLACE FUNCTION public.is_manager_plus(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('founder'::public.app_role, 'c_level'::public.app_role, 'direcao'::public.app_role,
                   'coordinator'::public.app_role, 'manager'::public.app_role)
  )
$$;
REVOKE ALL ON FUNCTION public.is_manager_plus(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_plus(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Equipe ve categorias legais" ON public.captacoes_categorias;
CREATE POLICY "Equipe ve categorias legais" ON public.captacoes_categorias FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Manager+ edita categorias legais" ON public.captacoes_categorias;
CREATE POLICY "Manager+ edita categorias legais" ON public.captacoes_categorias FOR ALL TO authenticated
  USING (public.is_manager_plus(auth.uid())) WITH CHECK (public.is_manager_plus(auth.uid()));

DROP POLICY IF EXISTS "Equipe ve organizacoes legais" ON public.captacoes_estabelecimentos;
CREATE POLICY "Equipe ve organizacoes legais" ON public.captacoes_estabelecimentos FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Manager+ edita organizacoes legais" ON public.captacoes_estabelecimentos;
CREATE POLICY "Manager+ edita organizacoes legais" ON public.captacoes_estabelecimentos FOR ALL TO authenticated
  USING (public.is_manager_plus(auth.uid())) WITH CHECK (public.is_manager_plus(auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.captacoes_estabelecimentos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.captacoes_categorias;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
