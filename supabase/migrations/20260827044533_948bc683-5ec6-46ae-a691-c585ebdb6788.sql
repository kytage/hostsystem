-- === Endurecimento de RLS ===

-- 1) tarefas_particulares: apenas Coordinator+ pode designar tarefa para outro usuário
DROP POLICY IF EXISTS "Staff designa tarefas para outros" ON public.tarefas_particulares;
CREATE POLICY "Coordinator+ designa tarefas para outros"
ON public.tarefas_particulares FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_coordinator_plus(auth.uid()));

-- 2) ilegal_avisos: criar/remover somente Coordinator+ (igual a avisos)
DROP POLICY IF EXISTS "Autenticados criam avisos ilegal" ON public.ilegal_avisos;
DROP POLICY IF EXISTS "Autenticados removem avisos ilegal" ON public.ilegal_avisos;
CREATE POLICY "Coordinator+ cria avisos ilegal"
ON public.ilegal_avisos FOR INSERT TO authenticated
WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "Coordinator+ remove avisos ilegal"
ON public.ilegal_avisos FOR DELETE TO authenticated
USING (public.is_coordinator_plus(auth.uid()));

-- 3) Tabelas operacionais: leitura/criação/atualização para autenticados,
--    mas DELETE restrito a Coordinator+ (evita remoção de histórico por qualquer usuário)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kanban_cards','patch_notes','card_historico','card_comentarios',
    'dev_tasks','eventos','ilegal_cronograma','ilegal_anotacoes',
    'kanban_devs','notificacoes','solicitacoes_admin'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      CASE t
        WHEN 'kanban_cards' THEN 'Equipe autenticada gerencia cards'
        WHEN 'patch_notes' THEN 'Equipe autenticada gerencia patch notes'
        WHEN 'card_historico' THEN 'Equipe autenticada gerencia historico'
        WHEN 'card_comentarios' THEN 'Equipe autenticada gerencia comentarios'
        WHEN 'dev_tasks' THEN 'Equipe autenticada gerencia tarefas'
        WHEN 'eventos' THEN 'Equipe autenticada gerencia eventos'
        WHEN 'ilegal_cronograma' THEN 'Autenticados gerenciam cronograma ilegal'
        WHEN 'ilegal_anotacoes' THEN 'Autenticados gerenciam anotacoes ilegal'
        WHEN 'kanban_devs' THEN 'Equipe autenticada gerencia devs'
        WHEN 'notificacoes' THEN 'Equipe autenticada gerencia notificacoes'
        WHEN 'solicitacoes_admin' THEN 'Equipe autenticada gerencia solicitacoes admin'
      END, t);

    EXECUTE format('CREATE POLICY "Autenticados leem %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Autenticados criam %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Autenticados atualizam %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Coordinator+ remove %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_coordinator_plus(auth.uid()))', t);
  END LOOP;
END $$;
