ALTER TABLE public.ilegal_detalhes
  ADD COLUMN IF NOT EXISTS vip_config jsonb NOT NULL DEFAULT '{}'::jsonb;