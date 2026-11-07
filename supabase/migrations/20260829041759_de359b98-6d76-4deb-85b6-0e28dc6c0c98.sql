ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_id text NOT NULL DEFAULT '';