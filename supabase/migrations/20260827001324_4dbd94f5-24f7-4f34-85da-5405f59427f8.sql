-- ============ AVISOS ILEGAL ============
CREATE TABLE public.ilegal_avisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  criado_por TEXT NOT NULL DEFAULT '',
  criado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ilegal_avisos TO authenticated;
GRANT ALL ON public.ilegal_avisos TO service_role;
ALTER TABLE public.ilegal_avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem avisos ilegal"
  ON public.ilegal_avisos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados criam avisos ilegal"
  ON public.ilegal_avisos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados removem avisos ilegal"
  ON public.ilegal_avisos FOR DELETE TO authenticated USING (true);

-- ============ CONFIRMAÇÕES ============
CREATE TABLE public.ilegal_aviso_confirmacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aviso_id UUID NOT NULL REFERENCES public.ilegal_avisos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

CREATE INDEX idx_ilegal_aviso_conf_aviso ON public.ilegal_aviso_confirmacoes(aviso_id);

GRANT SELECT, INSERT, DELETE ON public.ilegal_aviso_confirmacoes TO authenticated;
GRANT ALL ON public.ilegal_aviso_confirmacoes TO service_role;
ALTER TABLE public.ilegal_aviso_confirmacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem confirmacoes ilegal"
  ON public.ilegal_aviso_confirmacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario confirma por si"
  ON public.ilegal_aviso_confirmacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario remove propria confirmacao"
  ON public.ilegal_aviso_confirmacoes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ CRONOGRAMA DE RP ============
CREATE TABLE public.ilegal_cronograma (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'roleplay' CHECK (tipo IN ('roleplay', 'missao', 'entrega')),
  setagem TEXT NOT NULL DEFAULT '',
  data_hora TIMESTAMPTZ,
  responsavel TEXT NOT NULL DEFAULT '',
  coluna TEXT NOT NULL DEFAULT 'pendente' CHECK (coluna IN ('pendente', 'andamento', 'concluido')),
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por TEXT NOT NULL DEFAULT '',
  criado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ilegal_cronograma_coluna ON public.ilegal_cronograma(coluna, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ilegal_cronograma TO authenticated;
GRANT ALL ON public.ilegal_cronograma TO service_role;
ALTER TABLE public.ilegal_cronograma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam cronograma ilegal"
  ON public.ilegal_cronograma FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_ilegal_cronograma_updated_at
  BEFORE UPDATE ON public.ilegal_cronograma
  FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_avisos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_aviso_confirmacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_cronograma;