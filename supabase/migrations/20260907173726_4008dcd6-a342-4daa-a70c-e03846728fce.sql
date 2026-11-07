CREATE TABLE public.eventos_gestao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT 'eventos',
  staff_responsaveis JSONB NOT NULL DEFAULT '[]'::jsonb,
  todos_da_area BOOLEAN NOT NULL DEFAULT false,
  data_evento DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  horario TEXT NOT NULL DEFAULT '21:00',
  premiacao TEXT NOT NULL DEFAULT '',
  informacoes TEXT NOT NULL DEFAULT '',
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'organizando' CHECK (status IN ('organizando','andamento','concluido')),
  adicoes TEXT[] NOT NULL DEFAULT '{}',
  solicitacao_banner BOOLEAN NOT NULL DEFAULT false,
  banner_url TEXT NOT NULL DEFAULT '',
  frequencia TEXT NOT NULL DEFAULT 'unico',
  frequencia_dia SMALLINT,
  frequencia_repeticoes SMALLINT NOT NULL DEFAULT 0,
  recorrencia_pai UUID REFERENCES public.eventos_gestao(id) ON DELETE SET NULL,
  publicado_cronograma BOOLEAN NOT NULL DEFAULT false,
  cronograma_evento_id UUID,
  publicado_discord BOOLEAN NOT NULL DEFAULT false,
  criado_por TEXT NOT NULL DEFAULT '',
  criado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_gestao TO authenticated;
GRANT ALL ON public.eventos_gestao TO service_role;

ALTER TABLE public.eventos_gestao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_gestao_select" ON public.eventos_gestao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "eventos_gestao_insert" ON public.eventos_gestao
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "eventos_gestao_update" ON public.eventos_gestao
  FOR UPDATE TO authenticated
  USING (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()))
  WITH CHECK (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));

CREATE POLICY "eventos_gestao_delete" ON public.eventos_gestao
  FOR DELETE TO authenticated
  USING (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));

CREATE INDEX idx_eventos_gestao_data ON public.eventos_gestao (data_evento DESC);
CREATE INDEX idx_eventos_gestao_status ON public.eventos_gestao (status);

CREATE TRIGGER trg_eventos_gestao_updated_at
  BEFORE UPDATE ON public.eventos_gestao
  FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos_gestao;
