ALTER TABLE public.ilegal_orgs
  ADD COLUMN IF NOT EXISTS limpo_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS limpo_por text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.ilegal_orgs.limpo_em IS 'Marco da ultima limpeza da faccao: historico de online e registros anteriores a esta data ficam ocultos no painel Ilegal e nos relatorios da org (os registros seguem intactos em /punicoes).';