-- Marketing: cronograma de gravações e publicações. Privado: Coordinator+ e área Marketing. Idempotente.
CREATE TABLE IF NOT EXISTS public.marketing_conteudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  roteiro text NOT NULL DEFAULT '',
  plataformas text[] NOT NULL DEFAULT '{}',
  formato text NOT NULL DEFAULT 'reels',
  status text NOT NULL DEFAULT 'ideia',
  data_gravacao timestamptz,
  data_publicacao timestamptz,
  responsavel text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  views integer NOT NULL DEFAULT 0,
  curtidas integer NOT NULL DEFAULT 0,
  criado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.can_access_marketing(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_coordinator_plus(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_areas WHERE user_id = _user_id AND area = 'marketing');
$$;
REVOKE ALL ON FUNCTION public.can_access_marketing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_marketing(uuid) TO authenticated, service_role;

ALTER TABLE public.marketing_conteudos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Marketing gerencia conteudos" ON public.marketing_conteudos;
CREATE POLICY "Marketing gerencia conteudos" ON public.marketing_conteudos FOR ALL TO authenticated
  USING (public.can_access_marketing(auth.uid()))
  WITH CHECK (public.can_access_marketing(auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_conteudos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
