DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='punicoes' AND schemaname='public' AND cmd='DELETE' LOOP
    EXECUTE format('DROP POLICY %I ON public.punicoes', p);
  END LOOP;
END $$;

CREATE POLICY "Coordinator+ can delete punicoes"
ON public.punicoes FOR DELETE TO authenticated
USING (public.is_coordinator_plus(auth.uid()));