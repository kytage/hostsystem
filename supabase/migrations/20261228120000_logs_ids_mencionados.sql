-- Busca de logs por ID (passaporte) instantânea: cada log ganha a lista dos IDs que ela menciona
-- ("#55", "Passaporte: 55", "Usuário: 55 - Nome"...), com índice. Antes a busca lia as 100 mil+
-- logs uma a uma e passava do limite de 8 s do banco (perfil do player dava erro).
-- A regra é a mesma do site (src/lib/logs-id.ts: logMencionaId): "#5" não pega "#55".

CREATE OR REPLACE FUNCTION public.ids_da_mensagem(m text, jogador text DEFAULT NULL)
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(DISTINCT x::integer), '{}')
  FROM (
    SELECT (regexp_matches(coalesce(m, ''), '#(\d{1,9})(?!\d)', 'g'))[1] AS x
    UNION ALL
    SELECT (regexp_matches(coalesce(m, ''), ':\s*#?(\d{1,9})\s+-\s', 'g'))[1]
    UNION ALL
    SELECT (regexp_matches(
      coalesce(m, ''),
      '(?:passaporte|id|user[_ ]?id|usu[aá]rio|jogador|player|respons[aá]vel|v[ií]tima|alvo|m[eé]dic[oa]\(?a?\)?|paciente|admin|staff)\s*:\s*#?(\d{1,9})(?!\d)',
      'gi'))[1]
    UNION ALL
    SELECT nullif(btrim(jogador), '') WHERE btrim(coalesce(jogador, '')) ~ '^\d{1,9}$'
  ) s
  WHERE x IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.ids_da_mensagem(text, text) TO authenticated, service_role;

ALTER TABLE public.server_logs ADD COLUMN IF NOT EXISTS ids integer[] NOT NULL DEFAULT '{}';

-- as logs novas já entram com a lista
CREATE OR REPLACE FUNCTION public.server_logs_preencher_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.ids := public.ids_da_mensagem(NEW.mensagem, NEW.jogador_id);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS server_logs_preencher_ids ON public.server_logs;
CREATE TRIGGER server_logs_preencher_ids
  BEFORE INSERT OR UPDATE OF mensagem, jogador_id ON public.server_logs
  FOR EACH ROW EXECUTE FUNCTION public.server_logs_preencher_ids();

-- as logs que já existem
UPDATE public.server_logs SET ids = public.ids_da_mensagem(mensagem, jogador_id);

CREATE INDEX IF NOT EXISTS idx_server_logs_ids ON public.server_logs USING gin (ids);
ANALYZE public.server_logs;
