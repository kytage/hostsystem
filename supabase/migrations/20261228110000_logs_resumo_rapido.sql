-- Correção urgente: o resumo das logs do dia (logs_resumo_desde, da migração 20261222120000) rodava
-- com a regra de acesso linha por linha e levava até 46 s com o banco cheio, deixando o site todo
-- lento. Agora calcula UMA vez quais categorias a pessoa vê e só conta. Quem vê o quê não muda.
CREATE OR REPLACE FUNCTION public.logs_resumo_desde(p_desde timestamptz)
 RETURNS TABLE(canal text, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  todas boolean;
  cats text[];
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  todas := public.is_coordinator_plus(uid);
  IF NOT todas THEN
    cats := public.logs_categorias_do_usuario(uid);
  END IF;
  RETURN QUERY
    SELECT l.canal, count(*)::bigint
    FROM public.server_logs l
    WHERE l.criado_em >= p_desde
      AND (todas OR split_part(l.canal, '/', 1) = ANY (cats))
    GROUP BY l.canal;
END
$function$;
REVOKE ALL ON FUNCTION public.logs_resumo_desde(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logs_resumo_desde(timestamptz) TO authenticated, service_role;
