-- Recorde do parkour da praça (maior distância, em metros), para o ranking.
ALTER TABLE public.hoshi_pets ADD COLUMN IF NOT EXISTS recorde_parkour integer NOT NULL DEFAULT 0;
