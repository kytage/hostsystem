-- Arco do RANKING da praça (TOP HORAS, LEVEL, SOLICITAÇÕES, CAPTAÇÕES e DORMINDO)
-- e envio de comida/bebida para amigos pelo correio (com quantidade). Idempotente.

-- 1) Tempo de acesso: um minuto por vez, enquanto a pessoa está com o site aberto e visível.
--    "dormindo" = o HOKI está no berço (a pessoa não está acordada na praça).
CREATE TABLE IF NOT EXISTS public.hoki_acesso (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minutos integer NOT NULL DEFAULT 0,
  minutos_dormindo integer NOT NULL DEFAULT 0,
  ultimo timestamptz
);
ALTER TABLE public.hoki_acesso ENABLE ROW LEVEL SECURITY;
-- ninguém lê nem escreve direto: só pelas funções abaixo
REVOKE ALL ON public.hoki_acesso FROM anon, authenticated;
GRANT ALL ON public.hoki_acesso TO service_role;

CREATE OR REPLACE FUNCTION public.hoki_registrar_acesso(p_dormindo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_team_member(v_user) THEN
    RETURN;
  END IF;
  -- no máximo um minuto a cada 50 segundos (várias abas não contam em dobro)
  INSERT INTO public.hoki_acesso AS a (user_id, minutos, minutos_dormindo, ultimo)
  VALUES (v_user, 1, CASE WHEN p_dormindo THEN 1 ELSE 0 END, now())
  ON CONFLICT (user_id) DO UPDATE
    SET minutos = a.minutos + 1,
        minutos_dormindo = a.minutos_dormindo + CASE WHEN p_dormindo THEN 1 ELSE 0 END,
        ultimo = now()
    WHERE a.ultimo IS NULL OR now() - a.ultimo >= interval '50 seconds';
END $$;
REVOKE ALL ON FUNCTION public.hoki_registrar_acesso(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoki_registrar_acesso(boolean) TO authenticated;

-- 2) Os Top 5 de cada ranking, de uma vez (só nomes e números; só gente da equipe entra)
CREATE OR REPLACE FUNCTION public.hoki_rankings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_usar_hoki(auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao HOKI.';
  END IF;
  RETURN jsonb_build_object(
    'horas', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('nome', t.nome, 'valor', t.valor) ORDER BY t.valor DESC, t.nome), '[]'::jsonb)
        FROM (
          SELECT p.username AS nome, a.minutos AS valor
            FROM public.hoki_acesso a JOIN public.profiles p ON p.id = a.user_id
           WHERE a.minutos > 0 AND public.is_team_member(a.user_id)
           ORDER BY a.minutos DESC, p.username
           LIMIT 5
        ) t
    ),
    'level', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('nome', t.nome, 'valor', t.valor) ORDER BY t.valor DESC, t.xp DESC, t.nome), '[]'::jsonb)
        FROM (
          SELECT p.username AS nome, f.nivel AS valor, f.xp
            FROM public.fazenda_jogadores f JOIN public.profiles p ON p.id = f.user_id
           WHERE public.is_team_member(f.user_id)
           ORDER BY f.nivel DESC, f.xp DESC, p.username
           LIMIT 5
        ) t
    ),
    'solicitacoes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('nome', t.nome, 'valor', t.valor) ORDER BY t.valor DESC, t.nome), '[]'::jsonb)
        FROM (
          SELECT p.username AS nome, count(*)::int AS valor
            FROM public.pendencias x JOIN public.profiles p ON lower(p.username) = lower(x.criado_por)
           WHERE coalesce(x.criado_por, '') <> '' AND public.is_team_member(p.id)
           GROUP BY p.username
           ORDER BY count(*) DESC, p.username
           LIMIT 5
        ) t
    ),
    'captacoes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('nome', t.nome, 'valor', t.valor) ORDER BY t.valor DESC, t.nome), '[]'::jsonb)
        FROM (
          SELECT p.username AS nome, count(*)::int AS valor
            FROM public.captacoes c JOIN public.profiles p ON p.id = c.captador_id
           WHERE public.is_team_member(c.captador_id)
           GROUP BY p.username
           ORDER BY count(*) DESC, p.username
           LIMIT 5
        ) t
    ),
    'dormindo', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('nome', t.nome, 'valor', t.valor) ORDER BY t.valor DESC, t.nome), '[]'::jsonb)
        FROM (
          SELECT p.username AS nome, a.minutos_dormindo AS valor
            FROM public.hoki_acesso a JOIN public.profiles p ON p.id = a.user_id
           WHERE a.minutos_dormindo > 0 AND public.is_team_member(a.user_id)
           ORDER BY a.minutos_dormindo DESC, p.username
           LIMIT 5
        ) t
    )
  );
END $$;
REVOKE ALL ON FUNCTION public.hoki_rankings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoki_rankings() TO authenticated;

-- 3) Correio: a carta direta pode levar até 10 unidades do item anexado (comida, bebida ou presente)
ALTER TABLE public.hoki_cartas ADD COLUMN IF NOT EXISTS qtd smallint NOT NULL DEFAULT 1;
DO $$
BEGIN
  ALTER TABLE public.hoki_cartas ADD CONSTRAINT hoki_cartas_qtd_faixa CHECK (qtd BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT SELECT (qtd) ON public.hoki_cartas TO authenticated;
GRANT INSERT (qtd) ON public.hoki_cartas TO authenticated;
