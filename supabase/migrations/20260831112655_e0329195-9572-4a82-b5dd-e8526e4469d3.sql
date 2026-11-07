ALTER TABLE public.pendencias
  ADD COLUMN IF NOT EXISTS obs_coordenacao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS obs_por text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS obs_at timestamptz,
  ADD COLUMN IF NOT EXISTS obs_resolvida boolean NOT NULL DEFAULT false;