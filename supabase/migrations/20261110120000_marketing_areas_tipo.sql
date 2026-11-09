-- Marketing: áreas relacionadas (várias) e tipo de postagem (comum/campanha). Idempotente.
-- Rascunhos usam status = 'rascunho'.
ALTER TABLE public.marketing_conteudos ADD COLUMN IF NOT EXISTS areas text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.marketing_conteudos ADD COLUMN IF NOT EXISTS tipo_postagem text NOT NULL DEFAULT 'comum';
