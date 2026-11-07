ALTER TABLE public.ilegal_detalhes
  ADD COLUMN IF NOT EXISTS vips jsonb NOT NULL DEFAULT '[]'::jsonb;