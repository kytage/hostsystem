-- 1) Ações granulares nas permissões
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS actions text[] NOT NULL DEFAULT ARRAY['view','create','edit','delete','approve']::text[];
ALTER TABLE public.area_permissions
  ADD COLUMN IF NOT EXISTS actions text[] NOT NULL DEFAULT ARRAY['view','create','edit','delete','approve']::text[];

UPDATE public.role_permissions SET actions = ARRAY['view','create','edit','delete','approve']::text[] WHERE actions IS NULL OR cardinality(actions) = 0;
UPDATE public.area_permissions SET actions = ARRAY['view','create','edit','delete','approve']::text[] WHERE actions IS NULL OR cardinality(actions) = 0;

CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_role_category_key ON public.role_permissions (role, category);
CREATE UNIQUE INDEX IF NOT EXISTS area_permissions_area_category_key ON public.area_permissions (area, category);

-- 2) Áreas personalizadas
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text NOT NULL DEFAULT '•',
  ordem integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver areas"
  ON public.areas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Founder gerencia areas"
  ON public.areas FOR ALL TO authenticated
  USING (public.is_founder(auth.uid()))
  WITH CHECK (public.is_founder(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_areas_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_areas_updated_at ON public.areas;
CREATE TRIGGER trg_areas_updated_at BEFORE UPDATE ON public.areas
FOR EACH ROW EXECUTE FUNCTION public.update_areas_updated_at();

INSERT INTO public.areas (key, label, emoji, ordem) VALUES
  ('ilegal','Ilegal','🕵️',1),
  ('policia','Policia','👮',2),
  ('hospital','Hospital','🏥',3),
  ('judiciario','Judiciário','⚖️',4),
  ('mecanica','Mecânica','🔧',5),
  ('restaurante','Restaurante','🍔',6),
  ('restaurantes','Restaurantes','🍽️',7),
  ('eventos','Eventos','🎉',8),
  ('jornal','Jornal','📰',9),
  ('kids','Kids','🧸',10),
  ('competitive','Competitive','🏆',11),
  ('var','VAR','🎥',12),
  ('cars','Cars','🚗',13),
  ('clotches','Clotches','👕',14),
  ('creators','Creators','🎬',15),
  ('denuncias','Denuncias','🚨',16),
  ('financeiro','Financeiro','💰',17),
  ('marketing','Marketing','📣',18),
  ('peds','Peds','🧍',19),
  ('staff','Staff','🛡️',20),
  ('id_pre_acess_free','ID PRÉ ACESS FREE','🎟️',21)
ON CONFLICT (key) DO NOTHING;