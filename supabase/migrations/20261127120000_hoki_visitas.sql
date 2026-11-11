-- Visitas do HOKI: quem é Coordinator+ gera um convite (código + link). Quem entra
-- por ele cria a própria conta (nome e senha) como VISITA: não ganha cargo nenhum
-- (por isso não passa em is_team_member e não vê nada da equipe) e só usa o HOKI.

-- Convites: o código é o que vai no link. Vale 7 dias e até 20 contas.
CREATE TABLE IF NOT EXISTS public.hoki_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9]{8,32}$'),
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  max_usos integer NOT NULL DEFAULT 20 CHECK (max_usos BETWEEN 1 AND 100),
  usos integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.hoki_convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coordinator+ cria convites do HOKI" ON public.hoki_convites;
CREATE POLICY "Coordinator+ cria convites do HOKI" ON public.hoki_convites
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() AND public.is_coordinator_plus(auth.uid()) AND usos = 0);

DROP POLICY IF EXISTS "Coordinator+ ve convites do HOKI" ON public.hoki_convites;
CREATE POLICY "Coordinator+ ve convites do HOKI" ON public.hoki_convites
  FOR SELECT TO authenticated
  USING (public.is_coordinator_plus(auth.uid()));

DROP POLICY IF EXISTS "Coordinator+ desliga convites do HOKI" ON public.hoki_convites;
CREATE POLICY "Coordinator+ desliga convites do HOKI" ON public.hoki_convites
  FOR UPDATE TO authenticated
  USING (public.is_coordinator_plus(auth.uid()))
  WITH CHECK (public.is_coordinator_plus(auth.uid()));

-- quem só desliga um convite não pode mexer no contador de usos (ele é do servidor)
REVOKE UPDATE ON public.hoki_convites FROM authenticated;
GRANT UPDATE (ativo) ON public.hoki_convites TO authenticated;

-- Contas de visita (criadas só pelo servidor, ao usar um convite válido).
CREATE TABLE IF NOT EXISTS public.hoki_visitantes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nome text NOT NULL,
  convite_id uuid REFERENCES public.hoki_convites (id) ON DELETE SET NULL,
  convidado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hoki_visitantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visita ve a propria conta" ON public.hoki_visitantes;
CREATE POLICY "Visita ve a propria conta" ON public.hoki_visitantes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_hoki_visitante(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.hoki_visitantes WHERE user_id = _user_id)
$$;

-- Quem pode usar o HOKI: a equipe e as visitas.
CREATE OR REPLACE FUNCTION public.pode_usar_hoki(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_team_member(_user_id) OR public.is_hoki_visitante(_user_id)
$$;

-- Tabelas do HOKI: onde pedia "ser da equipe", agora vale "poder usar o HOKI".
DROP POLICY IF EXISTS "Cada um cria o proprio pet" ON public.hoshi_pets;
CREATE POLICY "Cada um cria o proprio pet" ON public.hoshi_pets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.pode_usar_hoki(auth.uid()));

DROP POLICY IF EXISTS "Equipe ve os pets" ON public.hoshi_pets;
CREATE POLICY "Equipe ve os pets" ON public.hoshi_pets
  FOR SELECT TO authenticated
  USING (public.pode_usar_hoki(auth.uid()));

DROP POLICY IF EXISTS "Equipe cria partidas" ON public.hoshi_jogos;
CREATE POLICY "Equipe cria partidas" ON public.hoshi_jogos
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() AND public.pode_usar_hoki(auth.uid()));

DROP POLICY IF EXISTS "Equipe joga as partidas" ON public.hoshi_jogos;
CREATE POLICY "Equipe joga as partidas" ON public.hoshi_jogos
  FOR UPDATE TO authenticated
  USING (public.pode_usar_hoki(auth.uid()))
  WITH CHECK (public.pode_usar_hoki(auth.uid()));

DROP POLICY IF EXISTS "Equipe ve as partidas" ON public.hoshi_jogos;
CREATE POLICY "Equipe ve as partidas" ON public.hoshi_jogos
  FOR SELECT TO authenticated
  USING (public.pode_usar_hoki(auth.uid()));

DROP POLICY IF EXISTS "Equipe ve a loja" ON public.hoshi_loja;
CREATE POLICY "Equipe ve a loja" ON public.hoshi_loja
  FOR SELECT TO authenticated
  USING (public.pode_usar_hoki(auth.uid()));

DROP POLICY IF EXISTS "Equipe ve o quadro do termometro" ON public.termometro_votos;
CREATE POLICY "Equipe ve o quadro do termometro" ON public.termometro_votos
  FOR SELECT TO authenticated
  USING (public.pode_usar_hoki(auth.uid()));
