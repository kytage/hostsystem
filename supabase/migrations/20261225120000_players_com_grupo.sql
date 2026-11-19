-- 19/11/2026 — Ilegal: aba "Players" da setagem (quem tem o grupo, ex.: Muni01).
-- Os grupos chegam como "Muni01" ou "Muni01:2" (com o nível). Respeita as regras de acesso de players
-- (security invoker: quem não pode ver players recebe lista vazia).
CREATE OR REPLACE FUNCTION public.players_com_grupo(p_grupo text)
RETURNS SETOF public.players
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.*
    FROM public.players p
   WHERE EXISTS (
     SELECT 1 FROM unnest(p.grupos) g
      WHERE lower(trim(split_part(g, ':', 1))) = lower(trim(p_grupo))
   )
   ORDER BY p.online DESC, p.ultimo_login DESC NULLS LAST
   LIMIT 2000
$$;

REVOKE EXECUTE ON FUNCTION public.players_com_grupo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.players_com_grupo(text) TO authenticated, service_role;
