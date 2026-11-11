-- Partidas online da praça do HOSHI (jogo da velha e cartas). Idempotente.
CREATE TABLE IF NOT EXISTS public.hoshi_jogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('velha', 'cartas')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'jogando', 'fim')),
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Sobe a cada jogada: quem grava precisa ter lido a versão atual (evita jogadas simultâneas).
  versao integer NOT NULL DEFAULT 0,
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hoshi_jogos_ativos_idx ON public.hoshi_jogos (updated_at DESC) WHERE status <> 'fim';

ALTER TABLE public.hoshi_jogos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe ve as partidas" ON public.hoshi_jogos;
CREATE POLICY "Equipe ve as partidas" ON public.hoshi_jogos FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Equipe cria partidas" ON public.hoshi_jogos;
CREATE POLICY "Equipe cria partidas" ON public.hoshi_jogos FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() AND public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Equipe joga as partidas" ON public.hoshi_jogos;
CREATE POLICY "Equipe joga as partidas" ON public.hoshi_jogos FOR UPDATE TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Dono apaga a partida" ON public.hoshi_jogos;
CREATE POLICY "Dono apaga a partida" ON public.hoshi_jogos FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hoshi_jogos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
