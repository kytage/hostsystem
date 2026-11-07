CREATE TABLE public.area_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area text NOT NULL,
  category text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (area, category)
);
GRANT SELECT ON public.area_permissions TO authenticated;
GRANT ALL ON public.area_permissions TO service_role;
ALTER TABLE public.area_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem permissoes de area" ON public.area_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Founder gerencia permissoes de area" ON public.area_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
INSERT INTO public.area_permissions (area, category) VALUES
  ('ilegal', 'ilegal'),
  ('staff', 'controle_staff');