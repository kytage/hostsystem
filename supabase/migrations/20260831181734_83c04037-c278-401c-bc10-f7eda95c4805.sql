CREATE OR REPLACE FUNCTION public.has_area(_user_id uuid, _area text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_areas
    WHERE user_id = _user_id AND area = _area
  )
$$;

REVOKE ALL ON FUNCTION public.has_area(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_area(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS punicoes_update ON public.punicoes;
CREATE POLICY punicoes_update ON public.punicoes
FOR UPDATE TO authenticated
USING (
  staff_id = auth.uid()
  OR public.is_coordinator_plus(auth.uid())
  OR (tipo = 'var' AND public.has_area(auth.uid(), 'var'))
)
WITH CHECK (
  staff_id = auth.uid()
  OR public.is_coordinator_plus(auth.uid())
  OR (tipo = 'var' AND public.has_area(auth.uid(), 'var'))
);