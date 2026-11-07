CREATE TABLE public.ilegal_anotacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  imagens JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_por TEXT NOT NULL DEFAULT '',
  criado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ilegal_anotacoes TO authenticated;
GRANT ALL ON public.ilegal_anotacoes TO service_role;

ALTER TABLE public.ilegal_anotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam anotacoes ilegal"
ON public.ilegal_anotacoes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER update_ilegal_anotacoes_updated_at
BEFORE UPDATE ON public.ilegal_anotacoes
FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_anotacoes;