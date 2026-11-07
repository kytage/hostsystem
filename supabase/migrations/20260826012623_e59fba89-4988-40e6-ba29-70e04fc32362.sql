ALTER TABLE public.tarefas_particulares
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid REFERENCES public.solicitacoes_admin(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designada_por text NOT NULL DEFAULT '';

-- Permite que um usuário autenticado designe tarefa para outro (INSERT apenas;
-- leitura/edição/exclusão continuam restritas ao dono pela policy existente)
CREATE POLICY "Staff designa tarefas para outros"
ON public.tarefas_particulares
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);