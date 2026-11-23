-- Check-lists do painel Ilegal: tarefas em massa por setagem (ex.: "Enviar aviso da reunião").
-- Cada check-list vira uma coluna de caixinhas na tabela de Setagens.
-- Criar e remover check-list: quem edita o Ilegal. Marcar e desmarcar: qualquer staff.

CREATE TABLE IF NOT EXISTS public.ilegal_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  ordem integer NOT NULL DEFAULT 0,
  criado_por text NOT NULL DEFAULT '',
  criado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ilegal_checklist_marcas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id uuid NOT NULL REFERENCES public.ilegal_checklists(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  marcado_por text NOT NULL DEFAULT '',
  marcado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_ilegal_checklist_marcas_checklist
  ON public.ilegal_checklist_marcas (checklist_id);

REVOKE ALL ON public.ilegal_checklists, public.ilegal_checklist_marcas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ilegal_checklists, public.ilegal_checklist_marcas TO authenticated;
GRANT ALL ON public.ilegal_checklists, public.ilegal_checklist_marcas TO service_role;

ALTER TABLE public.ilegal_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ilegal_checklist_marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_select" ON public.ilegal_checklists
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "checklists_insert" ON public.ilegal_checklists
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "checklists_update" ON public.ilegal_checklists
  FOR UPDATE TO authenticated
  USING (public.can_edit_ilegal(auth.uid()))
  WITH CHECK (public.can_edit_ilegal(auth.uid()));
CREATE POLICY "checklists_delete" ON public.ilegal_checklists
  FOR DELETE TO authenticated USING (public.can_edit_ilegal(auth.uid()));

CREATE POLICY "checklist_marcas_select" ON public.ilegal_checklist_marcas
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "checklist_marcas_insert" ON public.ilegal_checklist_marcas
  FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "checklist_marcas_delete" ON public.ilegal_checklist_marcas
  FOR DELETE TO authenticated USING (public.is_team_member(auth.uid()));

-- quem marcou/criou fica nas logs de autoria, como as outras tabelas do Ilegal
DROP TRIGGER IF EXISTS registrar_autoria ON public.ilegal_checklists;
CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_checklists
  FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria();
DROP TRIGGER IF EXISTS registrar_autoria ON public.ilegal_checklist_marcas;
CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_checklist_marcas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_checklist_marcas;

-- Produtos extras das setagens da Central: droga (uma opção), desmanche e contrabando (sim/não).
ALTER TABLE public.ilegal_orgs
  ADD COLUMN IF NOT EXISTS droga text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS desmanche boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrabando boolean NOT NULL DEFAULT false;

ALTER TABLE public.ilegal_orgs DROP CONSTRAINT IF EXISTS ilegal_orgs_droga_valida;
ALTER TABLE public.ilegal_orgs ADD CONSTRAINT ilegal_orgs_droga_valida
  CHECK (droga IN ('', 'Cocaína', 'Maconha', 'Loló', 'Metanfetamina', 'Ecstasy'));
