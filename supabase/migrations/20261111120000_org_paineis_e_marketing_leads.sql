-- Painéis dos líderes de organização (acesso por código) + Leads do Marketing. Idempotente.

-- ---------------------------------------------------------------------------
-- 1) Painéis dos líderes
--    O líder NÃO tem conta no sistema: ele entra com um código e todas as
--    operações dele passam por funções do servidor (service role), que validam
--    o código. Por isso o RLS abaixo só libera a equipe que cuida do Ilegal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_org_paineis(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_coordinator_plus(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_areas WHERE user_id = _user_id AND area = 'ilegal');
$$;
REVOKE ALL ON FUNCTION public.can_manage_org_paineis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org_paineis(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.org_paineis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setagem text NOT NULL DEFAULT '',
  lider_nome text NOT NULL DEFAULT '',
  codigo text NOT NULL UNIQUE,
  link_destino text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  criado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  painel_id uuid NOT NULL REFERENCES public.org_paineis(id) ON DELETE CASCADE,
  nome text NOT NULL,
  discord text NOT NULL DEFAULT '',
  passaporte text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT 'membro' CHECK (cargo IN ('lider', 'gerente', 'membro')),
  slug text NOT NULL UNIQUE,
  visitas integer NOT NULL DEFAULT 0,
  cliques integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_membros_painel_idx ON public.org_membros (painel_id);

-- Meta do painel: no máximo 100 pessoas por organização.
CREATE OR REPLACE FUNCTION public.org_membros_limite()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.org_membros WHERE painel_id = NEW.painel_id) >= 100 THEN
    RAISE EXCEPTION 'limite_membros' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS org_membros_limite ON public.org_membros;
CREATE TRIGGER org_membros_limite BEFORE INSERT ON public.org_membros
  FOR EACH ROW EXECUTE FUNCTION public.org_membros_limite();

-- Contadores do link de afiliação (visita na página / clique no botão de entrar).
CREATE OR REPLACE FUNCTION public.org_convite_contar(_slug text, _campo text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.org_membros
     SET visitas = visitas + CASE WHEN _campo = 'visita' THEN 1 ELSE 0 END,
         cliques = cliques + CASE WHEN _campo = 'clique' THEN 1 ELSE 0 END
   WHERE slug = _slug;
$$;
REVOKE ALL ON FUNCTION public.org_convite_contar(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_convite_contar(text, text) TO service_role;

ALTER TABLE public.org_paineis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestao do ilegal gerencia paineis" ON public.org_paineis;
CREATE POLICY "Gestao do ilegal gerencia paineis" ON public.org_paineis FOR ALL TO authenticated
  USING (public.can_manage_org_paineis(auth.uid()))
  WITH CHECK (public.can_manage_org_paineis(auth.uid()));

ALTER TABLE public.org_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestao do ilegal gerencia membros das orgs" ON public.org_membros;
CREATE POLICY "Gestao do ilegal gerencia membros das orgs" ON public.org_membros FOR ALL TO authenticated
  USING (public.can_manage_org_paineis(auth.uid()))
  WITH CHECK (public.can_manage_org_paineis(auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.org_paineis;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.org_membros;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2) Marketing: leads (possíveis clientes) e referências (tipos de vídeo)
--    Mesmo acesso do restante do Marketing: Coordinator+ e área Marketing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'criador',
  nicho text NOT NULL DEFAULT 'fivem',
  plataforma text NOT NULL DEFAULT 'instagram',
  link text NOT NULL DEFAULT '',
  contato text NOT NULL DEFAULT '',
  seguidores integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'novo',
  interesse text NOT NULL DEFAULT 'morno',
  notas text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  proximo_contato date,
  criado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_referencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  link text NOT NULL DEFAULT '',
  plataforma text NOT NULL DEFAULT 'tiktok',
  categoria text NOT NULL DEFAULT 'outro',
  nicho text NOT NULL DEFAULT 'fivem',
  canal text NOT NULL DEFAULT '',
  views bigint NOT NULL DEFAULT 0,
  notas text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Marketing gerencia leads" ON public.marketing_leads;
CREATE POLICY "Marketing gerencia leads" ON public.marketing_leads FOR ALL TO authenticated
  USING (public.can_access_marketing(auth.uid()))
  WITH CHECK (public.can_access_marketing(auth.uid()));

ALTER TABLE public.marketing_referencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Marketing gerencia referencias" ON public.marketing_referencias;
CREATE POLICY "Marketing gerencia referencias" ON public.marketing_referencias FOR ALL TO authenticated
  USING (public.can_access_marketing(auth.uid()))
  WITH CHECK (public.can_access_marketing(auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_referencias;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
