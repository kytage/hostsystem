-- Lista de pessoas do HOKI (queridômetro): cada um só consegue ler o próprio perfil
-- e o próprio cargo nas tabelas, então quem não era da gestão via só a si mesmo e
-- não tinha para quem entregar emojis. Esta função devolve, para quem pode usar o
-- HOKI, o id, o nome de usuário e os cargos de toda a equipe e das visitas. Nada além disso.
CREATE OR REPLACE FUNCTION public.hoki_pessoas()
RETURNS TABLE (id uuid, username text, cargos text[], visita boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.username,
    ARRAY(SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id) AS cargos,
    EXISTS (SELECT 1 FROM public.hoki_visitantes v WHERE v.user_id = p.id) AS visita
  FROM public.profiles p
  WHERE public.pode_usar_hoki(auth.uid())
    AND public.pode_usar_hoki(p.id)
  ORDER BY p.username
$$;

REVOKE EXECUTE ON FUNCTION public.hoki_pessoas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoki_pessoas() TO authenticated;
