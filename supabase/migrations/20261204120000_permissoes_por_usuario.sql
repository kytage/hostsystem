-- Permissões por pessoa: o FOUNDER define, aba por aba, se cada usuário vê ou edita.
-- Uma linha vale no lugar do que vem do cargo e das áreas naquela aba;
-- actions vazio = sem acesso à aba. Sem linha = segue o cargo e as áreas.
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  actions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

DROP POLICY IF EXISTS "Cada um le as proprias permissoes" ON public.user_permissions;
CREATE POLICY "Cada um le as proprias permissoes" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS "Founder gerencia permissoes por pessoa" ON public.user_permissions;
CREATE POLICY "Founder gerencia permissoes por pessoa" ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

-- Players: toda a equipe vê (só ver; mudar os dados continua só pelo webhook ou FOUNDER).
CREATE OR REPLACE FUNCTION public.can_view_players(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_team_member(_user_id);
$$;
REVOKE ALL ON FUNCTION public.can_view_players(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_players(uuid) TO authenticated, service_role;

-- Marketing: a permissão da própria pessoa (quando existe) vale no lugar das outras regras.
CREATE OR REPLACE FUNCTION public.can_access_marketing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'founder') THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND category = 'marketing'
    ) THEN EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND category = 'marketing' AND cardinality(actions) > 0
    )
    ELSE public.is_coordinator_plus(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_areas WHERE user_id = _user_id AND area = 'marketing')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role = ur.role AND rp.category = 'marketing'
        WHERE ur.user_id = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_areas ua
        JOIN public.area_permissions ap ON ap.area = ua.area AND ap.category = 'marketing'
        WHERE ua.user_id = _user_id
      )
  END;
$$;
REVOKE ALL ON FUNCTION public.can_access_marketing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_marketing(uuid) TO authenticated, service_role;
