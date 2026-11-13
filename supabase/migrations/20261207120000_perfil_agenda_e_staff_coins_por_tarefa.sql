-- Perfil & Agenda, pendências encaminhadas e Staff Coins por tarefa concluída.

-- 1) Banner do perfil (vazio = banner padrão do HOST)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;

-- 2) Para onde a coordenação encaminhou a pendência (tarefa de alguém, Desenvolvimento, HOST UPDATE)
ALTER TABLE public.pendencias ADD COLUMN IF NOT EXISTS encaminhado_para text NOT NULL DEFAULT '';

-- 3) Staff Coins ao concluir tarefas particulares
--    - tarefa recebida de outra pessoa: +10
--    - tarefa da própria pessoa: +1, só se criada há pelo menos 15 minutos, no máximo 10 por dia
--    - cada tarefa rende uma vez só (voltar e concluir de novo não rende)
ALTER TABLE public.tarefas_particulares
  ADD COLUMN IF NOT EXISTS criada_por uuid,
  ADD COLUMN IF NOT EXISTS coins_recebidas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recompensada_em timestamptz;

-- tarefas antigas: as que ninguém designou são da própria pessoa; as já concluídas não rendem nada
UPDATE public.tarefas_particulares
  SET criada_por = user_id
  WHERE criada_por IS NULL AND coalesce(designada_por, '') = '';
UPDATE public.tarefas_particulares
  SET recompensada_em = now()
  WHERE coluna = 'concluido' AND recompensada_em IS NULL;

CREATE OR REPLACE FUNCTION public.tarefa_staff_coins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_qtd integer := 0;
  v_recebida boolean;
  v_hoje integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- quem criou é sempre quem está logado (a tela não escolhe)
    NEW.criada_por := coalesce(auth.uid(), NEW.criada_por, NEW.user_id);
    NEW.created_at := now();
    NEW.coins_recebidas := 0;
    -- criar já em "concluído" não rende nada
    NEW.recompensada_em := CASE WHEN NEW.coluna = 'concluido' THEN now() ELSE NULL END;
    RETURN NEW;
  END IF;

  -- na edição, estes campos não mudam pela tela
  NEW.criada_por := OLD.criada_por;
  NEW.created_at := OLD.created_at;
  NEW.coins_recebidas := OLD.coins_recebidas;
  NEW.recompensada_em := OLD.recompensada_em;

  IF NEW.coluna = 'concluido' AND OLD.coluna IS DISTINCT FROM 'concluido' AND OLD.recompensada_em IS NULL THEN
    v_recebida := (OLD.criada_por IS NOT NULL AND OLD.criada_por <> OLD.user_id)
               OR (OLD.criada_por IS NULL AND coalesce(OLD.designada_por, '') <> '');
    IF v_recebida THEN
      v_qtd := 10;
      NEW.recompensada_em := now();
    ELSIF now() - OLD.created_at >= interval '15 minutes' THEN
      SELECT count(*) INTO v_hoje
        FROM public.tarefas_particulares
        WHERE user_id = OLD.user_id
          AND coins_recebidas = 1
          AND (recompensada_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
      IF v_hoje < 10 THEN
        v_qtd := 1;
      END IF;
      NEW.recompensada_em := now();
    END IF;
    -- própria tarefa concluída antes de 15 minutos: não rende agora (e continua podendo render depois)

    NEW.coins_recebidas := v_qtd;
    IF v_qtd > 0 THEN
      PERFORM set_config('hoshi.rpc', '1', true);
      INSERT INTO public.hoshi_pets (user_id, username, coins)
        VALUES (OLD.user_id, coalesce((SELECT username FROM public.profiles WHERE id = OLD.user_id), ''), v_qtd)
        ON CONFLICT (user_id) DO UPDATE
          SET coins = public.hoshi_pets.coins + EXCLUDED.coins, updated_at = now();
      PERFORM set_config('hoshi.rpc', '', true);
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tarefa_staff_coins() FROM PUBLIC;

DROP TRIGGER IF EXISTS tarefa_staff_coins ON public.tarefas_particulares;
CREATE TRIGGER tarefa_staff_coins
  BEFORE INSERT OR UPDATE ON public.tarefas_particulares
  FOR EACH ROW EXECUTE FUNCTION public.tarefa_staff_coins();
