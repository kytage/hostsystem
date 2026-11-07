CREATE TABLE public.tarefas_particulares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  coluna text NOT NULL DEFAULT 'pendente' CHECK (coluna IN ('pendente','andamento','concluido')),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_particulares TO authenticated;
GRANT ALL ON public.tarefas_particulares TO service_role;
ALTER TABLE public.tarefas_particulares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia suas tarefas" ON public.tarefas_particulares FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_tarefas_particulares_updated_at BEFORE UPDATE ON public.tarefas_particulares FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

CREATE TABLE public.anotacoes (
  user_id uuid PRIMARY KEY,
  texto text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes TO authenticated;
GRANT ALL ON public.anotacoes TO service_role;
ALTER TABLE public.anotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia suas anotacoes" ON public.anotacoes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_anotacoes_updated_at BEFORE UPDATE ON public.anotacoes FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();