GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_entradas TO authenticated;
GRANT ALL ON public.financeiro_entradas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_saidas TO authenticated;
GRANT ALL ON public.financeiro_saidas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_meses TO authenticated;
GRANT ALL ON public.financeiro_meses TO service_role;