CREATE TABLE public.punicoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'denuncia' CHECK (tipo IN ('denuncia','var')),
  jogador text NOT NULL DEFAULT '',
  jogador_id text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  punicao text NOT NULL DEFAULT '',
  duracao text NOT NULL DEFAULT '',
  provas text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  staff text NOT NULL DEFAULT '',
  staff_id uuid,
  data_punicao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.punicoes TO authenticated;
GRANT ALL ON public.punicoes TO service_role;

ALTER TABLE public.punicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "punicoes_select" ON public.punicoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "punicoes_insert" ON public.punicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "punicoes_update" ON public.punicoes
  FOR UPDATE TO authenticated
  USING (staff_id = auth.uid() OR public.is_coordinator_plus(auth.uid()))
  WITH CHECK (staff_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));

CREATE POLICY "punicoes_delete" ON public.punicoes
  FOR DELETE TO authenticated
  USING (staff_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));

CREATE INDEX idx_punicoes_tipo_data ON public.punicoes (tipo, data_punicao DESC);

CREATE OR REPLACE FUNCTION public.update_punicoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_punicoes_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_punicoes_updated_at
  BEFORE UPDATE ON public.punicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_punicoes_updated_at();