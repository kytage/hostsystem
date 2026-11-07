CREATE TABLE public.kanban_devs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_devs TO authenticated;
GRANT ALL ON public.kanban_devs TO service_role;
ALTER TABLE public.kanban_devs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia devs" ON public.kanban_devs FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.kanban_devs (nome, slug, ordem) VALUES ('Miguel', 'miguel', 1), ('Brenno', 'brenno', 2);

CREATE TABLE public.patch_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY,
  texto text NOT NULL DEFAULT '',
  total_alteracoes integer NOT NULL DEFAULT 0,
  gerado_por text NOT NULL DEFAULT '',
  publicado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patch_notes TO authenticated;
GRANT ALL ON public.patch_notes TO service_role;
ALTER TABLE public.patch_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia patch notes" ON public.patch_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'normal' CHECK (categoria IN ('normal','ilegal','urgente','carro')),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta','media','baixa')),
  coluna text NOT NULL DEFAULT 'solicitacoes',
  status text NOT NULL DEFAULT 'SOLICITAÇÃO',
  teste_status text,
  responsavel text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT '',
  obs_dev text NOT NULL DEFAULT '',
  patch_texto text NOT NULL DEFAULT '',
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  entrou_dev_at timestamptz,
  concluido_at timestamptz,
  concluido_por text NOT NULL DEFAULT '',
  patchnote_gerado boolean NOT NULL DEFAULT false,
  patchnote_id uuid REFERENCES public.patch_notes(id) ON DELETE SET NULL,
  arquivado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated;
GRANT ALL ON public.kanban_cards TO service_role;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia cards" ON public.kanban_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX kanban_cards_coluna_idx ON public.kanban_cards (coluna);
CREATE INDEX kanban_cards_patchnote_idx ON public.kanban_cards (patchnote_id);

CREATE TABLE public.card_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  autor text NOT NULL DEFAULT '',
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_comentarios TO authenticated;
GRANT ALL ON public.card_comentarios TO service_role;
ALTER TABLE public.card_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia comentarios" ON public.card_comentarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.card_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  autor text NOT NULL DEFAULT '',
  de_coluna text NOT NULL DEFAULT '',
  para_coluna text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_historico TO authenticated;
GRANT ALL ON public.card_historico TO service_role;
ALTER TABLE public.card_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia historico" ON public.card_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia notificacoes" ON public.notificacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_kanban_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_kanban_cards_updated_at
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

INSERT INTO public.role_permissions (role, category) VALUES
  ('c_level', 'patch_notes'),
  ('c_level', 'arquivados'),
  ('direcao', 'patch_notes'),
  ('direcao', 'arquivados')
ON CONFLICT DO NOTHING;