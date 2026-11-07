ALTER TABLE public.pendencias ADD COLUMN area text NOT NULL DEFAULT '';
ALTER TABLE public.pendencias ADD COLUMN tipo text NOT NULL DEFAULT 'solicitacao';
ALTER TABLE public.pendencias ADD COLUMN status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.pendencias ADD COLUMN criado_por text NOT NULL DEFAULT '';
ALTER TABLE public.pendencias ADD COLUMN aprovado_por text NOT NULL DEFAULT '';
ALTER TABLE public.pendencias ADD COLUMN aprovado_at timestamptz;
ALTER TABLE public.pendencias ADD COLUMN kanban_card_id uuid;

CREATE TABLE public.solicitacoes_admin (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  destinatario_id uuid NOT NULL,
  destinatario_nome text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT '',
  criado_por_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_admin TO authenticated;
GRANT ALL ON public.solicitacoes_admin TO service_role;
ALTER TABLE public.solicitacoes_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia solicitacoes admin" ON public.solicitacoes_admin FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_solicitacoes_admin_updated_at BEFORE UPDATE ON public.solicitacoes_admin FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();

INSERT INTO public.role_permissions (role, category) VALUES
  ('c_level', 'area_manager'),
  ('direcao', 'area_manager'),
  ('coordinator', 'area_manager'),
  ('manager', 'area_manager')
ON CONFLICT DO NOTHING;