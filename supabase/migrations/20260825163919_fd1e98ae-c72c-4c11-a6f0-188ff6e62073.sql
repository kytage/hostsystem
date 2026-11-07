CREATE TABLE public.eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  tipo TEXT NOT NULL DEFAULT 'evento',
  criado_por TEXT NOT NULL DEFAULT '',
  criado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia eventos" ON public.eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

INSERT INTO public.role_permissions (role, category) VALUES
  ('c_level','cronograma'),('direcao','cronograma'),('coordinator','cronograma'),
  ('manager','cronograma'),('staff','cronograma'),('dev','cronograma')
ON CONFLICT DO NOTHING;