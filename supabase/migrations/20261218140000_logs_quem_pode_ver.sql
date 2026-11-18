-- Logs do servidor: quem pode ver cada categoria (além de Coordinator e acima, que veem tudo).
-- Cada categoria pode ser liberada para cargos e/ou áreas; qualquer Coordinator+ edita na tela
-- /logs (engrenagem da categoria). Já vem liberado: as facções do "Host - Ilegal" para a área Ilegal.

CREATE TABLE IF NOT EXISTS public.server_log_permissoes (
  -- id da categoria (src/lib/logs-servidor.ts), a primeira parte da chave do canal ("inventario", "fac-armas01")
  categoria text PRIMARY KEY,
  cargos text[] NOT NULL DEFAULT '{}',
  areas text[] NOT NULL DEFAULT '{}',
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_log_permissoes TO authenticated;
GRANT ALL ON public.server_log_permissoes TO service_role;
ALTER TABLE public.server_log_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe ve quem pode ver as logs" ON public.server_log_permissoes;
CREATE POLICY "Equipe ve quem pode ver as logs"
  ON public.server_log_permissoes FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Coordinator+ edita quem pode ver as logs" ON public.server_log_permissoes;
CREATE POLICY "Coordinator+ edita quem pode ver as logs"
  ON public.server_log_permissoes FOR ALL TO authenticated
  USING (public.is_coordinator_plus(auth.uid()))
  WITH CHECK (public.is_coordinator_plus(auth.uid()));

-- quem pode ver uma categoria: Coordinator+ sempre; os outros, se o cargo ou uma das áreas estiver liberado
CREATE OR REPLACE FUNCTION public.pode_ver_logs(_user_id uuid, _categoria text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_coordinator_plus(_user_id) OR EXISTS (
    SELECT 1 FROM public.server_log_permissoes p
    WHERE p.categoria = _categoria
      AND (
        EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role::text = ANY (p.cargos))
        OR EXISTS (SELECT 1 FROM public.user_areas a WHERE a.user_id = _user_id AND a.area = ANY (p.areas))
      )
  )
$$;
REVOKE ALL ON FUNCTION public.pode_ver_logs(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_logs(uuid, text) TO authenticated, service_role;

-- as logs: antes só o Founder; agora quem pode ver a categoria do canal
DROP POLICY IF EXISTS "Founder le as logs do servidor" ON public.server_logs;
DROP POLICY IF EXISTS "Quem pode ver a categoria le as logs" ON public.server_logs;
CREATE POLICY "Quem pode ver a categoria le as logs"
  ON public.server_logs FOR SELECT TO authenticated
  USING (public.pode_ver_logs(auth.uid(), split_part(canal, '/', 1)));

DROP POLICY IF EXISTS "Founder ve os webhooks das logs" ON public.server_log_webhooks;
DROP POLICY IF EXISTS "Coordinator+ ve os webhooks das logs" ON public.server_log_webhooks;
CREATE POLICY "Coordinator+ ve os webhooks das logs"
  ON public.server_log_webhooks FOR SELECT TO authenticated
  USING (public.is_coordinator_plus(auth.uid()));

-- já liberado: as facções do "Host - Ilegal" para a área Ilegal
INSERT INTO public.server_log_permissoes (categoria, cargos, areas) VALUES
  ('fac-armas01', '{}', '{ilegal}'),
  ('fac-armas02', '{}', '{ilegal}'),
  ('fac-armas03', '{}', '{ilegal}'),
  ('fac-armas04', '{}', '{ilegal}'),
  ('fac-armas05', '{}', '{ilegal}'),
  ('fac-municao01', '{}', '{ilegal}'),
  ('fac-municao02', '{}', '{ilegal}'),
  ('fac-municao03', '{}', '{ilegal}'),
  ('fac-municao04', '{}', '{ilegal}'),
  ('fac-municao05', '{}', '{ilegal}'),
  ('fac-municao06', '{}', '{ilegal}'),
  ('fac-lavagem01', '{}', '{ilegal}'),
  ('fac-lavagem02', '{}', '{ilegal}'),
  ('fac-lavagem03', '{}', '{ilegal}'),
  ('fac-lavagem04', '{}', '{ilegal}'),
  ('fac-lavagem05', '{}', '{ilegal}'),
  ('fac-contrabando01', '{}', '{ilegal}'),
  ('fac-contrabando02', '{}', '{ilegal}'),
  ('fac-contrabando03', '{}', '{ilegal}'),
  ('fac-contrabando04', '{}', '{ilegal}'),
  ('fac-contrabando05', '{}', '{ilegal}'),
  ('fac-contrabando06', '{}', '{ilegal}'),
  ('fac-contrabando07', '{}', '{ilegal}'),
  ('fac-contrabando08', '{}', '{ilegal}'),
  ('fac-droga01', '{}', '{ilegal}'),
  ('fac-droga02', '{}', '{ilegal}'),
  ('fac-droga03', '{}', '{ilegal}'),
  ('fac-droga04', '{}', '{ilegal}'),
  ('fac-droga05', '{}', '{ilegal}'),
  ('fac-droga06', '{}', '{ilegal}'),
  ('fac-droga07', '{}', '{ilegal}'),
  ('fac-droga08', '{}', '{ilegal}'),
  ('fac-droga09', '{}', '{ilegal}'),
  ('fac-droga10', '{}', '{ilegal}'),
  ('fac-droga11', '{}', '{ilegal}'),
  ('fac-drogas12', '{}', '{ilegal}'),
  ('fac-drogas13', '{}', '{ilegal}'),
  ('fac-drogas14', '{}', '{ilegal}'),
  ('fac-garagem01', '{}', '{ilegal}'),
  ('fac-garagem02', '{}', '{ilegal}'),
  ('fac-garagem03', '{}', '{ilegal}'),
  ('fac-garagem04', '{}', '{ilegal}'),
  ('fac-garagem05', '{}', '{ilegal}'),
  ('fac-garagem06', '{}', '{ilegal}'),
  ('fac-garagem07', '{}', '{ilegal}'),
  ('fac-garagem08', '{}', '{ilegal}'),
  ('fac-hpi', '{}', '{ilegal}')
ON CONFLICT (categoria) DO NOTHING;
