-- Cosméticos do pet HOSHI (chapéu, óculos, pescoço, capa). Idempotente.
ALTER TABLE public.hoshi_pets ADD COLUMN IF NOT EXISTS visual jsonb NOT NULL DEFAULT '{}'::jsonb;
