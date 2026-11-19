-- Logs do servidor mais rápidas (otimização de 19/11/2026). Ninguém passa a ver nada novo:
-- as regras de quem vê cada categoria continuam as mesmas de public.pode_ver_logs.

-- 1) Regra de acesso: antes a checagem de permissão rodava UMA VEZ POR LINHA (milhares por consulta).
--    Agora calcula uma vez só por consulta as categorias que a pessoa pode ver.
CREATE OR REPLACE FUNCTION public.logs_categorias_do_usuario(_user_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(p.categoria), '{}')
  FROM public.server_log_permissoes p
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role::text = ANY (p.cargos))
     OR EXISTS (SELECT 1 FROM public.user_areas a WHERE a.user_id = _user_id AND a.area = ANY (p.areas))
$function$;
REVOKE ALL ON FUNCTION public.logs_categorias_do_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logs_categorias_do_usuario(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Quem pode ver a categoria le as logs" ON public.server_logs;
CREATE POLICY "Quem pode ver a categoria le as logs" ON public.server_logs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_coordinator_plus(auth.uid()))
    OR split_part(canal, '/', 1) = ANY ((SELECT public.logs_categorias_do_usuario(auth.uid())))
  );

-- 2) Busca por texto ("contém"): índice de trechos de palavras na mensagem e no nome do jogador.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_server_logs_mensagem_trgm
  ON public.server_logs USING gin (mensagem extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_server_logs_nome_trgm
  ON public.server_logs USING gin (jogador_nome extensions.gin_trgm_ops);

-- 3) Resumo do dia: o banco conta por categoria e devolve só os totais (antes iam até 10 mil linhas).
--    Roda com a permissão de quem chama, então respeita a regra acima.
CREATE OR REPLACE FUNCTION public.logs_resumo_desde(p_desde timestamptz)
 RETURNS TABLE(canal text, total bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT l.canal, count(*) FROM public.server_logs l WHERE l.criado_em >= p_desde GROUP BY l.canal
$function$;
REVOKE ALL ON FUNCTION public.logs_resumo_desde(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logs_resumo_desde(timestamptz) TO authenticated, service_role;
