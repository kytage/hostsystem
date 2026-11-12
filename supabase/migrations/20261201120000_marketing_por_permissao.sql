-- Marketing também pode ser liberado pela tela de Permissões (por cargo ou por área).
-- Continua valendo: Coordinator+ e quem tem a área Marketing entram sempre.
CREATE OR REPLACE FUNCTION public.can_access_marketing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_coordinator_plus(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_areas WHERE user_id = _user_id AND area = 'marketing')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role = ur.role AND rp.category = 'marketing'
        WHERE ur.user_id = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_areas ua
        JOIN public.area_permissions ap ON ap.area = ua.area AND ap.category = 'marketing'
        WHERE ua.user_id = _user_id
      );
$$;

REVOKE ALL ON FUNCTION public.can_access_marketing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_marketing(uuid) TO authenticated, service_role;
