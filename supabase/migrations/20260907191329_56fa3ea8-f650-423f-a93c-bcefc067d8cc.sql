CREATE TABLE public.ilegal_coroas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setagem text NOT NULL,
  organizacao text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT '',
  criado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ilegal_coroas_setagem_created ON public.ilegal_coroas (setagem, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ilegal_coroas TO authenticated;
GRANT ALL ON public.ilegal_coroas TO service_role;

ALTER TABLE public.ilegal_coroas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coroas_select" ON public.ilegal_coroas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "coroas_insert" ON public.ilegal_coroas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_ilegal(auth.uid()));

CREATE POLICY "coroas_delete" ON public.ilegal_coroas
  FOR DELETE TO authenticated
  USING (public.can_edit_ilegal(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ilegal_coroas;