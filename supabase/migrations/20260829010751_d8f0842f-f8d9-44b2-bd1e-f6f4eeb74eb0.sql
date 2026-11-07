ALTER TABLE public.punicoes ADD COLUMN IF NOT EXISTS resultado text NOT NULL DEFAULT '';
ALTER TABLE public.punicoes DROP CONSTRAINT IF EXISTS punicoes_resultado_check;
ALTER TABLE public.punicoes ADD CONSTRAINT punicoes_resultado_check CHECK (resultado IN ('', 'Cheat', 'Formatação', 'Liberado'));