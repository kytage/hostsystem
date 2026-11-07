CREATE TABLE public.kanban_ranking_base (
  autor text PRIMARY KEY,
  total integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kanban_ranking_base TO authenticated;
GRANT ALL ON public.kanban_ranking_base TO service_role;
ALTER TABLE public.kanban_ranking_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem ranking base" ON public.kanban_ranking_base FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS kanban_cards_arquivado_idx ON public.kanban_cards (arquivado, coluna);