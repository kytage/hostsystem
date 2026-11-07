ALTER TABLE public.user_areas
  ADD COLUMN IF NOT EXISTS nivel TEXT NOT NULL DEFAULT 'auxiliar'
  CHECK (nivel IN ('lider','auxiliar'));