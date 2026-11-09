-- Players: level (1-250), rank VIP, HOST Coins e estatísticas de combate. Idempotente.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS rank_vip text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS host_coins bigint NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS kills integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS mortes integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS headshots integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS maior_sequencia integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.players ADD CONSTRAINT players_level_range CHECK (level BETWEEN 1 AND 250);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
