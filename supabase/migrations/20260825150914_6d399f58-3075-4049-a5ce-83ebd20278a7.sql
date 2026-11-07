CREATE TABLE public.user_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, area)
);
GRANT SELECT ON public.user_areas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_areas TO authenticated;
GRANT ALL ON public.user_areas TO service_role;
ALTER TABLE public.user_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados veem areas" ON public.user_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Founder e C-Level gerenciam areas" ON public.user_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'c_level'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'c_level'));