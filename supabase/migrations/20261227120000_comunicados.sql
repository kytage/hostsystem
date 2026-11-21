-- Sino do topo: avisos e tarefas direcionados (todos, cargos, áreas ou staffs escolhidos), com som
-- e confirmação de leitura. Só Coordinator+ envia; cada staff só vê o que é para ele. O quadro antigo
-- de avisos (public.avisos) continua igual.

CREATE TABLE IF NOT EXISTS public.comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'aviso' CHECK (tipo IN ('aviso', 'tarefa')),
  titulo text NOT NULL CHECK (length(trim(titulo)) > 0),
  texto text,
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal', 'importante', 'urgente')),
  publico text NOT NULL DEFAULT 'todos' CHECK (publico IN ('todos', 'cargos', 'areas', 'pessoas')),
  cargos text[] NOT NULL DEFAULT '{}',
  areas text[] NOT NULL DEFAULT '{}',
  pessoas uuid[] NOT NULL DEFAULT '{}',
  som boolean NOT NULL DEFAULT true,
  exige_leitura boolean NOT NULL DEFAULT true,
  prazo timestamptz,
  arquivado boolean NOT NULL DEFAULT false,
  criado_por text,
  criado_por_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comunicados_criado ON public.comunicados (created_at DESC);

CREATE TABLE IF NOT EXISTS public.comunicado_leituras (
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  lido_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  PRIMARY KEY (comunicado_id, user_id)
);

-- o comunicado é para este usuário? (todos / cargo dele / área dele / ele foi escolhido)
CREATE OR REPLACE FUNCTION public.comunicado_e_para(_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comunicados c
    WHERE c.id = _id
      AND public.is_team_member(_uid)
      AND (
        c.publico = 'todos'
        OR (c.publico = 'cargos' AND EXISTS (
          SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text = ANY (c.cargos)))
        OR (c.publico = 'areas' AND EXISTS (
          SELECT 1 FROM public.user_areas a WHERE a.user_id = _uid AND a.area = ANY (c.areas)))
        OR (c.publico = 'pessoas' AND _uid = ANY (c.pessoas))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.comunicado_e_para(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comunicado_e_para(uuid, uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicados TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comunicado_leituras TO authenticated;
GRANT ALL ON public.comunicados TO service_role;
GRANT ALL ON public.comunicado_leituras TO service_role;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ve comunicados para si" ON public.comunicados;
CREATE POLICY "Ve comunicados para si" ON public.comunicados
  FOR SELECT TO authenticated
  USING (
    public.is_coordinator_plus(auth.uid())
    OR criado_por_id = auth.uid()
    OR public.comunicado_e_para(id, auth.uid())
  );
DROP POLICY IF EXISTS "Coordinator+ envia comunicados" ON public.comunicados;
CREATE POLICY "Coordinator+ envia comunicados" ON public.comunicados
  FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_plus(auth.uid()) AND criado_por_id = auth.uid());
DROP POLICY IF EXISTS "Coordinator+ edita comunicados" ON public.comunicados;
CREATE POLICY "Coordinator+ edita comunicados" ON public.comunicados
  FOR UPDATE TO authenticated
  USING (public.is_coordinator_plus(auth.uid()))
  WITH CHECK (public.is_coordinator_plus(auth.uid()));
DROP POLICY IF EXISTS "Coordinator+ apaga comunicados" ON public.comunicados;
CREATE POLICY "Coordinator+ apaga comunicados" ON public.comunicados
  FOR DELETE TO authenticated
  USING (public.is_coordinator_plus(auth.uid()));

DROP POLICY IF EXISTS "Ve as proprias leituras e a gestao ve todas" ON public.comunicado_leituras;
CREATE POLICY "Ve as proprias leituras e a gestao ve todas" ON public.comunicado_leituras
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));
DROP POLICY IF EXISTS "Confirma leitura do que e para si" ON public.comunicado_leituras;
CREATE POLICY "Confirma leitura do que e para si" ON public.comunicado_leituras
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.comunicado_e_para(comunicado_id, auth.uid()));
DROP POLICY IF EXISTS "Marca a propria tarefa como feita" ON public.comunicado_leituras;
CREATE POLICY "Marca a propria tarefa como feita" ON public.comunicado_leituras
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- tempo real (o sino toca na hora) e registro de autoria
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comunicados;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comunicado_leituras;
  EXCEPTION WHEN others THEN NULL;
  END;
  IF to_regprocedure('public.registrar_autoria()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS registrar_autoria ON public.comunicados;
    CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.comunicados
      FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria();
  END IF;
END $$;
