CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;

DO $$
DECLARE p record; q text; c text; stmt text;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname='public'
      AND (qual IN ('true','(auth.uid() IS NOT NULL)') OR with_check IN ('true','(auth.uid() IS NOT NULL)'))
  LOOP
    stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF p.qual IN ('true','(auth.uid() IS NOT NULL)') THEN
      stmt := stmt || ' USING (public.is_team_member(auth.uid()))';
    END IF;
    IF p.with_check IN ('true','(auth.uid() IS NOT NULL)') THEN
      stmt := stmt || ' WITH CHECK (public.is_team_member(auth.uid()))';
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;

ALTER POLICY "Autenticados atualizam banners" ON storage.objects
  USING (bucket_id = 'eventos-banners' AND public.is_team_member(auth.uid()))
  WITH CHECK (bucket_id = 'eventos-banners' AND public.is_team_member(auth.uid()));
ALTER POLICY "Autenticados enviam banners" ON storage.objects
  WITH CHECK (bucket_id = 'eventos-banners' AND public.is_team_member(auth.uid()));
ALTER POLICY "Avatares publicos para leitura" ON storage.objects
  USING (bucket_id = 'avatars' AND public.is_team_member(auth.uid()));