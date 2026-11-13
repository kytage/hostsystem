-- Líderes gerais de cada grupo de áreas (LEGAL, BASE PADRÃO, ENTRETENIMENTO, OPERAÇÃO).
-- Toda a equipe vê; só Founder, CEO (c_level) e Diretor(a) (direcao) editam.

CREATE TABLE IF NOT EXISTS public.area_grupo_lideres (
  grupo text NOT NULL CHECK (grupo IN ('legal', 'confronto', 'entretenimento', 'operacao')),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo, user_id)
);

ALTER TABLE public.area_grupo_lideres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe ve lideres gerais" ON public.area_grupo_lideres;
CREATE POLICY "equipe ve lideres gerais" ON public.area_grupo_lideres
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "diretoria adiciona lideres gerais" ON public.area_grupo_lideres;
CREATE POLICY "diretoria adiciona lideres gerais" ON public.area_grupo_lideres
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'c_level')
    OR public.has_role(auth.uid(), 'direcao')
  );

DROP POLICY IF EXISTS "diretoria remove lideres gerais" ON public.area_grupo_lideres;
CREATE POLICY "diretoria remove lideres gerais" ON public.area_grupo_lideres
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'c_level')
    OR public.has_role(auth.uid(), 'direcao')
  );

GRANT SELECT, INSERT, DELETE ON public.area_grupo_lideres TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.area_grupo_lideres;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Líderes iniciais pedidos pelo founder (12/11/2026)
INSERT INTO public.area_grupo_lideres (grupo, user_id)
SELECT v.grupo, p.id
FROM (VALUES
  ('legal', 'laylinha'), ('legal', 'kah'),
  ('confronto', 'larissa'), ('confronto', 'luke'), ('confronto', 'mariana'),
  ('entretenimento', 'nick'),
  ('operacao', 'henrique'), ('operacao', 'larissa'), ('operacao', 'julia')
) AS v (grupo, nome)
JOIN public.profiles p ON lower(p.username) = v.nome
ON CONFLICT DO NOTHING;
