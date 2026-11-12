-- HOST FAZENDAS: progresso do jogador, ilha, amizades, convites, visitas, presentes e registro social.
-- Quem escreve é só o servidor (service role, pelas funções do painel), que confere cada ação.
-- Os jogadores só leem o que é deles; o nível e a cor da plaquinha dos outros saem por fazenda_selos.

CREATE TABLE IF NOT EXISTS public.fazenda_jogadores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dados jsonb NOT NULL,
  nivel integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT 'vermelho',
  versao integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fazenda_jogadores_xp ON public.fazenda_jogadores (xp DESC);

CREATE TABLE IF NOT EXISTS public.fazenda_ilhas (
  dono_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dados jsonb NOT NULL,
  privacidade text NOT NULL DEFAULT 'amigos' CHECK (privacidade IN ('amigos', 'convite', 'privada')),
  tamanho integer NOT NULL DEFAULT 8,
  versao integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Cada ação tem um ID único: clique repetido ou reconexão devolve o resultado já gravado.
CREATE TABLE IF NOT EXISTS public.fazenda_operacoes (
  op_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fazenda_operacoes_criado ON public.fazenda_operacoes (criado_em);

CREATE TABLE IF NOT EXISTS public.fazenda_amizades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  de uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  para uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (de <> para)
);
CREATE UNIQUE INDEX IF NOT EXISTS fazenda_amizades_par ON public.fazenda_amizades (LEAST(de, para), GREATEST(de, para));

CREATE TABLE IF NOT EXISTS public.fazenda_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dono uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  convidado uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  revogado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fazenda_convites_convidado ON public.fazenda_convites (convidado, expira_em);

CREATE TABLE IF NOT EXISTS public.fazenda_visitas (
  ilha_dono uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitante uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visto_em timestamptz NOT NULL DEFAULT now(),
  removido boolean NOT NULL DEFAULT false,
  PRIMARY KEY (ilha_dono, visitante)
);

CREATE TABLE IF NOT EXISTS public.fazenda_presentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  de uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  para uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material text NOT NULL CHECK (material IN ('tabua', 'tijolo', 'cimento', 'ferramenta')),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  resgatado_em timestamptz
);
CREATE INDEX IF NOT EXISTS fazenda_presentes_para ON public.fazenda_presentes (para, enviado_em DESC);

CREATE TABLE IF NOT EXISTS public.fazenda_registro (
  id bigserial PRIMARY KEY,
  ilha_dono uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ator uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ator_nome text NOT NULL DEFAULT '',
  tipo text NOT NULL,
  detalhe text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fazenda_registro_ilha ON public.fazenda_registro (ilha_dono, criado_em DESC);

-- Segurança: cada um lê só o que é seu; ninguém escreve direto (só o servidor).
ALTER TABLE public.fazenda_jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_ilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_amizades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_presentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_registro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fazenda: jogador ve o proprio progresso" ON public.fazenda_jogadores;
CREATE POLICY "Fazenda: jogador ve o proprio progresso" ON public.fazenda_jogadores
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Fazenda: dono ve a propria ilha" ON public.fazenda_ilhas;
CREATE POLICY "Fazenda: dono ve a propria ilha" ON public.fazenda_ilhas
  FOR SELECT TO authenticated USING (dono_id = auth.uid());
DROP POLICY IF EXISTS "Fazenda: ve as proprias amizades" ON public.fazenda_amizades;
CREATE POLICY "Fazenda: ve as proprias amizades" ON public.fazenda_amizades
  FOR SELECT TO authenticated USING (de = auth.uid() OR para = auth.uid());
DROP POLICY IF EXISTS "Fazenda: ve os proprios convites" ON public.fazenda_convites;
CREATE POLICY "Fazenda: ve os proprios convites" ON public.fazenda_convites
  FOR SELECT TO authenticated USING (dono = auth.uid() OR convidado = auth.uid());
DROP POLICY IF EXISTS "Fazenda: ve os proprios presentes" ON public.fazenda_presentes;
CREATE POLICY "Fazenda: ve os proprios presentes" ON public.fazenda_presentes
  FOR SELECT TO authenticated USING (de = auth.uid() OR para = auth.uid());
DROP POLICY IF EXISTS "Fazenda: dono ve o registro da ilha" ON public.fazenda_registro;
CREATE POLICY "Fazenda: dono ve o registro da ilha" ON public.fazenda_registro
  FOR SELECT TO authenticated USING (ilha_dono = auth.uid());

-- Grava uma ação inteira numa transação só: confere o ID da operação (sem repetir), as versões
-- (ninguém sobrescreve uma mudança mais nova) e atualiza o jogador e as ilhas envolvidas.
CREATE OR REPLACE FUNCTION public.fazenda_gravar(
  p_op text,
  p_user uuid,
  p_jogador_id uuid,
  p_jogador jsonb,
  p_jogador_versao integer,
  p_ilhas jsonb,
  p_resultado jsonb,
  p_registro jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anterior jsonb;
  ilha jsonb;
BEGIN
  SELECT resultado INTO anterior FROM public.fazenda_operacoes WHERE op_id = p_op;
  IF FOUND THEN
    RETURN jsonb_build_object('repetida', true, 'resultado', anterior);
  END IF;

  IF p_jogador IS NOT NULL THEN
    UPDATE public.fazenda_jogadores
       SET dados = p_jogador,
           nivel = COALESCE((p_jogador->>'nivel')::integer, nivel),
           xp = COALESCE((p_jogador->>'xp')::integer, xp),
           cor = COALESCE(p_jogador->>'corLevel', cor),
           versao = versao + 1,
           atualizado_em = now()
     WHERE user_id = p_jogador_id AND versao = p_jogador_versao;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'fazenda_conflito';
    END IF;
  END IF;

  FOR ilha IN SELECT * FROM jsonb_array_elements(COALESCE(p_ilhas, '[]'::jsonb)) LOOP
    UPDATE public.fazenda_ilhas
       SET dados = ilha->'dados',
           privacidade = COALESCE(ilha->'dados'->>'privacidade', privacidade),
           tamanho = COALESCE((ilha->'dados'->>'tamanho')::integer, tamanho),
           versao = versao + 1,
           atualizado_em = now()
     WHERE dono_id = (ilha->>'dono')::uuid AND versao = (ilha->>'versao')::integer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'fazenda_conflito';
    END IF;
  END LOOP;

  IF p_registro IS NOT NULL THEN
    INSERT INTO public.fazenda_registro (ilha_dono, ator, ator_nome, tipo, detalhe)
    VALUES ((p_registro->>'ilha')::uuid, p_user, COALESCE(p_registro->>'nome', ''), p_registro->>'tipo', COALESCE(p_registro->>'detalhe', ''));
  END IF;

  INSERT INTO public.fazenda_operacoes (op_id, user_id, resultado) VALUES (p_op, p_user, COALESCE(p_resultado, '{}'::jsonb));
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.fazenda_gravar(text, uuid, uuid, jsonb, integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fazenda_gravar(text, uuid, uuid, jsonb, integer, jsonb, jsonb, jsonb) TO service_role;

-- Primeiro acesso: cria a ilha e o progresso uma vez só (chamadas repetidas não duplicam).
CREATE OR REPLACE FUNCTION public.fazenda_criar(p_user uuid, p_jogador jsonb, p_ilha jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.fazenda_jogadores (user_id, dados) VALUES (p_user, p_jogador) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.fazenda_ilhas (dono_id, dados) VALUES (p_user, p_ilha) ON CONFLICT (dono_id) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.fazenda_criar(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fazenda_criar(uuid, jsonb, jsonb) TO service_role;

-- Plaquinha: nível e cor de quem já tem ilha (quem pode usar o HOKI vê os dos outros).
CREATE OR REPLACE FUNCTION public.fazenda_selos(ids uuid[])
RETURNS TABLE (user_id uuid, nivel integer, cor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT j.user_id, j.nivel, j.cor
    FROM public.fazenda_jogadores j
   WHERE public.pode_usar_hoki(auth.uid()) AND j.user_id = ANY(ids)
$$;
REVOKE ALL ON FUNCTION public.fazenda_selos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fazenda_selos(uuid[]) TO authenticated, service_role;

-- Ranking de nível da fazenda (para o TOP 3 e a lista de níveis).
CREATE OR REPLACE FUNCTION public.fazenda_ranking(limite integer DEFAULT 10)
RETURNS TABLE (user_id uuid, username text, nivel integer, xp integer, cor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT j.user_id, COALESCE(p.username, ''), j.nivel, j.xp, j.cor
    FROM public.fazenda_jogadores j
    LEFT JOIN public.profiles p ON p.id = j.user_id
   WHERE public.pode_usar_hoki(auth.uid())
   ORDER BY j.xp DESC, j.criado_em ASC
   LIMIT LEAST(GREATEST(limite, 1), 50)
$$;
REVOKE ALL ON FUNCTION public.fazenda_ranking(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fazenda_ranking(integer) TO authenticated, service_role;
