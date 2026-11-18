-- Logs: SUSPEITOS. Quando um jogador mata 4 ou mais pessoas em 60 segundos, entra um alerta.
-- As mortes chegam no canal "players/death" (Player's › death), com a caixa
-- "Assassino: #ID - Nome" quando foi outro jogador que matou. A cada morte nova, conta as
-- mortes do mesmo assassino nos últimos 60 segundos; com 4 ou mais, abre (ou aumenta) o alerta.

CREATE TABLE IF NOT EXISTS public.server_log_suspeitos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id text NOT NULL,
  jogador_nome text,
  kills int NOT NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  -- as logs de morte que entraram no alerta (public.server_logs.id)
  logs bigint[] NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_server_log_suspeitos_fim ON public.server_log_suspeitos (fim DESC);
CREATE INDEX IF NOT EXISTS idx_server_log_suspeitos_jogador ON public.server_log_suspeitos (jogador_id, fim DESC);
GRANT SELECT ON public.server_log_suspeitos TO authenticated;
GRANT ALL ON public.server_log_suspeitos TO service_role;
ALTER TABLE public.server_log_suspeitos ENABLE ROW LEVEL SECURITY;

-- quem vê as mortes (categoria Player's) vê os suspeitos
DROP POLICY IF EXISTS "Quem ve as mortes ve os suspeitos" ON public.server_log_suspeitos;
CREATE POLICY "Quem ve as mortes ve os suspeitos"
  ON public.server_log_suspeitos FOR SELECT TO authenticated
  USING (public.pode_ver_logs(auth.uid(), 'players'));

CREATE OR REPLACE FUNCTION public.server_logs_procura_suspeito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assassino text;
  nome text;
  quantos int;
  ids bigint[];
  primeiro timestamptz;
  aberto bigint;
BEGIN
  assassino := substring(NEW.mensagem FROM 'Assassino:\s*#?(\d+)');
  IF assassino IS NULL THEN
    RETURN NEW;
  END IF;
  nome := nullif(trim(substring(NEW.mensagem FROM 'Assassino:\s*#?\d+\s*-\s*([^\n]+)')), '');

  SELECT count(*), array_agg(id ORDER BY criado_em), min(criado_em)
    INTO quantos, ids, primeiro
    FROM public.server_logs
   WHERE canal = 'players/death'
     AND criado_em BETWEEN NEW.criado_em - interval '60 seconds' AND NEW.criado_em
     AND substring(mensagem FROM 'Assassino:\s*#?(\d+)') = assassino;

  IF quantos < 4 THEN
    RETURN NEW;
  END IF;

  -- o mesmo jogador ainda matando: aumenta o alerta aberto em vez de abrir outro
  SELECT id INTO aberto
    FROM public.server_log_suspeitos
   WHERE jogador_id = assassino
     AND fim >= NEW.criado_em - interval '60 seconds'
   ORDER BY fim DESC
   LIMIT 1;

  IF aberto IS NOT NULL THEN
    UPDATE public.server_log_suspeitos
       SET logs = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(logs || ids) AS x),
           kills = (SELECT count(DISTINCT x) FROM unnest(logs || ids) AS x),
           fim = NEW.criado_em,
           jogador_nome = coalesce(nome, jogador_nome),
           atualizado_em = now()
     WHERE id = aberto;
  ELSE
    INSERT INTO public.server_log_suspeitos (jogador_id, jogador_nome, kills, inicio, fim, logs)
    VALUES (assassino, nome, quantos, primeiro, NEW.criado_em, ids);
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.server_logs_procura_suspeito() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS server_logs_procura_suspeito ON public.server_logs;
CREATE TRIGGER server_logs_procura_suspeito
  AFTER INSERT ON public.server_logs
  FOR EACH ROW
  WHEN (NEW.canal = 'players/death')
  EXECUTE FUNCTION public.server_logs_procura_suspeito();

-- alertas novos aparecem na hora (aba SUSPEITOS e o aviso no painel)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.server_log_suspeitos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
