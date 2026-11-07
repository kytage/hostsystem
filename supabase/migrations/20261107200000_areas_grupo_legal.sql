-- Agrupamento visual das áreas no organograma (ex.: LEGAL).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS grupo text;

UPDATE public.areas
SET grupo = 'legal'
WHERE key IN ('creators', 'peds', 'jornal', 'judiciario', 'restaurantes', 'hospital', 'mecanica');

UPDATE public.areas
SET grupo = 'ilegal'
WHERE key = 'ilegal' AND grupo IS NULL;
