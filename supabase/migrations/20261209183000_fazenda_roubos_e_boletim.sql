-- HOST FAZENDAS: roubos (3 por dia para quem rouba, até 3 por dia em cada fazenda) e o
-- Boletim da Roça (uma história de ficção por dia sobre alguém que roubou).
-- Quem escreve é só o servidor (service role), que confere cada roubo pelas regras do jogo.

CREATE TABLE IF NOT EXISTS public.fazenda_roubos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ladrao uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ladrao_nome text NOT NULL DEFAULT '',
  vitima uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vitima_nome text NOT NULL DEFAULT '',
  levou jsonb NOT NULL DEFAULT '[]'::jsonb,
  ouros integer NOT NULL DEFAULT 0,
  estragados integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fazenda_roubos_criado ON public.fazenda_roubos (criado_em DESC);
CREATE INDEX IF NOT EXISTS fazenda_roubos_ladrao ON public.fazenda_roubos (ladrao, criado_em DESC);
CREATE INDEX IF NOT EXISTS fazenda_roubos_vitima ON public.fazenda_roubos (vitima, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.fazenda_boletins (
  dia date PRIMARY KEY,
  roubo_id uuid REFERENCES public.fazenda_roubos(id) ON DELETE SET NULL,
  ladrao uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ladrao_nome text NOT NULL DEFAULT '',
  vitima_nome text NOT NULL DEFAULT '',
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 160),
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 4000),
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Segurança: ninguém escreve direto (só o servidor). Cada um vê os roubos em que esteve
-- (como quem roubou ou quem foi roubado) e quem usa o HOKI lê o boletim.
ALTER TABLE public.fazenda_roubos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazenda_boletins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fazenda: ve os roubos em que esteve" ON public.fazenda_roubos;
CREATE POLICY "Fazenda: ve os roubos em que esteve" ON public.fazenda_roubos
  FOR SELECT TO authenticated
  USING (public.pode_usar_hoki(auth.uid()) AND (ladrao = auth.uid() OR vitima = auth.uid()));
DROP POLICY IF EXISTS "Fazenda: quem usa o HOKI le o boletim" ON public.fazenda_boletins;
CREATE POLICY "Fazenda: quem usa o HOKI le o boletim" ON public.fazenda_boletins
  FOR SELECT TO authenticated
  USING (public.pode_usar_hoki(auth.uid()));

REVOKE ALL ON public.fazenda_roubos, public.fazenda_boletins FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.fazenda_roubos, public.fazenda_boletins FROM authenticated;
GRANT SELECT ON public.fazenda_roubos, public.fazenda_boletins TO authenticated;
GRANT ALL ON public.fazenda_roubos, public.fazenda_boletins TO service_role;

-- Grava o roubo inteiro numa transação só: o ladrão (Ouros e contador do dia), a ilha da
-- vítima (com conferência de versão), a linha no registro da ilha e o roubo para o boletim.
-- O ID da operação evita repetir (clique duplo ou reconexão devolvem o que já foi gravado).
CREATE OR REPLACE FUNCTION public.fazenda_roubar(
  p_op text,
  p_user uuid,
  p_jogador jsonb,
  p_jogador_versao integer,
  p_ilhas jsonb,
  p_resultado jsonb,
  p_registro jsonb,
  p_roubo jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r jsonb;
BEGIN
  r := public.fazenda_gravar(p_op, p_user, p_user, p_jogador, p_jogador_versao, p_ilhas, p_resultado, p_registro);
  IF COALESCE((r->>'repetida')::boolean, false) THEN
    RETURN r;
  END IF;
  INSERT INTO public.fazenda_roubos (ladrao, ladrao_nome, vitima, vitima_nome, levou, ouros, estragados)
  VALUES (
    p_user,
    left(COALESCE(p_roubo->>'ladraoNome', ''), 60),
    (p_roubo->>'vitima')::uuid,
    left(COALESCE(p_roubo->>'vitimaNome', ''), 60),
    COALESCE(p_roubo->'levou', '[]'::jsonb),
    COALESCE((p_roubo->>'ouros')::integer, 0),
    COALESCE((p_roubo->>'estragados')::integer, 0)
  );
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.fazenda_roubar(text, uuid, jsonb, integer, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fazenda_roubar(text, uuid, jsonb, integer, jsonb, jsonb, jsonb, jsonb) TO service_role;
