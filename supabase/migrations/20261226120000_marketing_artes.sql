-- Marketing › Artes: tópicos de artes com arquivos anexados, abertos para toda a staff.
-- Ler e enviar: qualquer staff (is_team_member). Editar e apagar: quem criou, Coordinator+
-- ou a equipe de Marketing. Os arquivos ficam num bucket privado (links assinados).

CREATE TABLE IF NOT EXISTS public.marketing_artes_topicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  criado_por text,
  criado_por_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_artes_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id uuid NOT NULL REFERENCES public.marketing_artes_topicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  caminho text NOT NULL,
  tipo text,
  tamanho bigint,
  descricao text,
  criado_por text,
  criado_por_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_artes_arquivos_topico
  ON public.marketing_artes_arquivos (topico_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_artes_topicos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_artes_arquivos TO authenticated;
GRANT ALL ON public.marketing_artes_topicos TO service_role;
GRANT ALL ON public.marketing_artes_arquivos TO service_role;

ALTER TABLE public.marketing_artes_topicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_artes_arquivos ENABLE ROW LEVEL SECURITY;

-- tópicos
DROP POLICY IF EXISTS "Staff le topicos de artes" ON public.marketing_artes_topicos;
CREATE POLICY "Staff le topicos de artes" ON public.marketing_artes_topicos
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Staff cria topicos de artes" ON public.marketing_artes_topicos;
CREATE POLICY "Staff cria topicos de artes" ON public.marketing_artes_topicos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()) AND criado_por_id = auth.uid());
DROP POLICY IF EXISTS "Dono ou gestao edita topicos de artes" ON public.marketing_artes_topicos;
CREATE POLICY "Dono ou gestao edita topicos de artes" ON public.marketing_artes_topicos
  FOR UPDATE TO authenticated
  USING (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()) OR public.can_access_marketing(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Dono ou gestao apaga topicos de artes" ON public.marketing_artes_topicos;
CREATE POLICY "Dono ou gestao apaga topicos de artes" ON public.marketing_artes_topicos
  FOR DELETE TO authenticated
  USING (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()) OR public.can_access_marketing(auth.uid()));

-- arquivos
DROP POLICY IF EXISTS "Staff le arquivos de artes" ON public.marketing_artes_arquivos;
CREATE POLICY "Staff le arquivos de artes" ON public.marketing_artes_arquivos
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Staff anexa arquivos de artes" ON public.marketing_artes_arquivos;
CREATE POLICY "Staff anexa arquivos de artes" ON public.marketing_artes_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()) AND criado_por_id = auth.uid());
DROP POLICY IF EXISTS "Dono ou gestao edita arquivos de artes" ON public.marketing_artes_arquivos;
CREATE POLICY "Dono ou gestao edita arquivos de artes" ON public.marketing_artes_arquivos
  FOR UPDATE TO authenticated
  USING (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()) OR public.can_access_marketing(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Dono ou gestao apaga arquivos de artes" ON public.marketing_artes_arquivos;
CREATE POLICY "Dono ou gestao apaga arquivos de artes" ON public.marketing_artes_arquivos
  FOR DELETE TO authenticated
  USING (criado_por_id = auth.uid() OR public.is_coordinator_plus(auth.uid()) OR public.can_access_marketing(auth.uid()));

-- bucket privado dos arquivos (até 50 MB por arquivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('marketing-artes', 'marketing-artes', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Staff le artes do marketing" ON storage.objects;
CREATE POLICY "Staff le artes do marketing" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'marketing-artes' AND public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Staff envia artes do marketing" ON storage.objects;
CREATE POLICY "Staff envia artes do marketing" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-artes'
    AND public.is_team_member(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "Dono ou gestao apaga artes do marketing" ON storage.objects;
CREATE POLICY "Dono ou gestao apaga artes do marketing" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-artes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_coordinator_plus(auth.uid())
      OR public.can_access_marketing(auth.uid())
    )
  );

-- tópicos iniciais (só se ainda não houver nenhum)
INSERT INTO public.marketing_artes_topicos (titulo, descricao, ordem, criado_por)
SELECT t.titulo, t.descricao, t.ordem, 'HOST'
FROM (VALUES
  ('Artes de marketing', 'Artes prontas para postar nas redes e no Discord.', 1),
  ('Modelos', 'Modelos de arte no padrão novo da HOST, para usar de base.', 2),
  ('Ilegal', 'Avisos, tabelas de valores e artes das organizações.', 3),
  ('Eventos', 'Banners e divulgações de eventos da cidade.', 4),
  ('Atualizações', 'Artes de update, patch notes e novidades.', 5)
) AS t(titulo, descricao, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_artes_topicos);

-- tempo real e registro de autoria
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_artes_topicos;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_artes_arquivos;
  EXCEPTION WHEN others THEN NULL;
  END;
  IF to_regprocedure('public.registrar_autoria()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS registrar_autoria ON public.marketing_artes_topicos;
    CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.marketing_artes_topicos
      FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria();
    DROP TRIGGER IF EXISTS registrar_autoria ON public.marketing_artes_arquivos;
    CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.marketing_artes_arquivos
      FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria();
  END IF;
END $$;
