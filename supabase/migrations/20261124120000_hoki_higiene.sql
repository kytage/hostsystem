-- Higiene do HOKI (0 a 100): cai com o tempo e com o trabalho na fazenda; o banho no chuveirão da praça enche.
ALTER TABLE public.hoshi_pets ADD COLUMN IF NOT EXISTS higiene integer NOT NULL DEFAULT 100;
