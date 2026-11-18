-- 1) Registro de autoria: toda mudança feita no site (criar, editar, apagar) vira uma linha aqui,
--    com quem fez, em qual tabela e o que mudou. Só o Founder lê (menu da conta › Registro de autoria).
-- 2) Anotações dos staffs: observações sobre cada membro da equipe (Coordinator+).
-- 3) Chat por área: as mensagens ganham um canal ("geral" ou "area:<chave>"); a área só aparece
--    para quem é dela.

-- ---------------------------------------------------------------- 1) registro de autoria
CREATE TABLE IF NOT EXISTS public.registro_autoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  username text,
  tabela text NOT NULL,
  acao text NOT NULL, -- INSERT | UPDATE | DELETE
  registro_id text,
  campos text[] NOT NULL DEFAULT '{}', -- o que mudou (na edição)
  antes jsonb,
  depois jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registro_autoria_criado ON public.registro_autoria (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registro_autoria_tabela ON public.registro_autoria (tabela, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registro_autoria_user ON public.registro_autoria (user_id, criado_em DESC);
GRANT SELECT ON public.registro_autoria TO authenticated;
GRANT ALL ON public.registro_autoria TO service_role;
ALTER TABLE public.registro_autoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Founder le o registro de autoria" ON public.registro_autoria;
CREATE POLICY "Founder le o registro de autoria"
  ON public.registro_autoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE OR REPLACE FUNCTION public.registrar_autoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  antes jsonb;
  depois jsonb;
  mudou text[];
  ignorar text[] := ARRAY['updated_at', 'atualizado_em', 'last_seen_at', 'created_at', 'criado_em'];
  nome text;
BEGIN
  -- só o que veio do site (alguém logado); o servidor e as rotinas não entram
  IF uid IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  BEGIN
    IF TG_OP <> 'INSERT' THEN antes := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN depois := to_jsonb(NEW); END IF;
    IF TG_OP = 'UPDATE' THEN
      SELECT array_agg(k ORDER BY k) INTO mudou
        FROM jsonb_object_keys(depois) AS k
       WHERE NOT (k = ANY (ignorar)) AND depois -> k IS DISTINCT FROM antes -> k;
      IF mudou IS NULL THEN RETURN NEW; END IF;
      -- trocar o próprio status (online, ausente...) não é modificação do site
      IF TG_TABLE_NAME = 'profiles' AND mudou <@ ARRAY['status'] THEN RETURN NEW; END IF;
      -- na edição guarda só os campos que mudaram (e o id)
      SELECT jsonb_object_agg(k, antes -> k) INTO antes FROM unnest(mudou || ARRAY['id']) AS k WHERE antes ? k;
      SELECT jsonb_object_agg(k, depois -> k) INTO depois FROM unnest(mudou || ARRAY['id']) AS k WHERE depois ? k;
    END IF;
    SELECT username INTO nome FROM public.profiles WHERE id = uid;
    INSERT INTO public.registro_autoria (user_id, username, tabela, acao, registro_id, campos, antes, depois)
    VALUES (
      uid, nome, TG_TABLE_NAME, TG_OP,
      coalesce(depois ->> 'id', antes ->> 'id', depois ->> 'user_id', antes ->> 'user_id'),
      coalesce(mudou, '{}'), antes, depois
    );
  EXCEPTION WHEN others THEN
    -- o registro nunca impede a mudança de acontecer
    NULL;
  END;
  RETURN coalesce(NEW, OLD);
END
$$;
REVOKE ALL ON FUNCTION public.registrar_autoria() FROM PUBLIC, anon, authenticated;

-- as tabelas do site (fora ficam jogos do HOKI, chat, notificações e as próprias logs)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'anotacoes', 'area_grupo_lideres', 'area_permissions', 'areas', 'avisos',
    'captacoes', 'captacoes_categorias', 'captacoes_estabelecimentos', 'captacoes_modelos', 'captacoes_reunioes',
    'card_comentarios', 'casting', 'dev_tasks', 'eventos', 'eventos_gestao',
    'financeiro_entradas', 'financeiro_meses', 'financeiro_saidas',
    'ilegal_anotacoes', 'ilegal_avisos', 'ilegal_coroas', 'ilegal_cronograma', 'ilegal_detalhes', 'ilegal_orgs',
    'kanban_cards', 'kanban_devs', 'kanban_ranking_base',
    'marketing_conteudos', 'marketing_leads', 'marketing_referencias',
    'org_membros', 'org_paineis', 'patch_notes', 'peds', 'pendencias', 'players', 'profiles', 'punicoes',
    'role_permissions', 'server_log_permissoes', 'solicitacoes_admin',
    'user_areas', 'user_permissions', 'user_roles', 'staff_anotacoes'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS registrar_autoria ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- 2) anotações dos staffs
CREATE TABLE IF NOT EXISTS public.staff_anotacoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome text,
  texto text NOT NULL CHECK (length(trim(texto)) > 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_anotacoes_staff ON public.staff_anotacoes (staff_id, criado_em DESC);
GRANT SELECT, INSERT, DELETE ON public.staff_anotacoes TO authenticated;
GRANT ALL ON public.staff_anotacoes TO service_role;
ALTER TABLE public.staff_anotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coordinator+ le as anotacoes" ON public.staff_anotacoes;
CREATE POLICY "Coordinator+ le as anotacoes"
  ON public.staff_anotacoes FOR SELECT TO authenticated
  USING (public.is_coordinator_plus(auth.uid()));
DROP POLICY IF EXISTS "Coordinator+ escreve anotacoes" ON public.staff_anotacoes;
CREATE POLICY "Coordinator+ escreve anotacoes"
  ON public.staff_anotacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_plus(auth.uid()) AND autor_id = auth.uid());
DROP POLICY IF EXISTS "Autor ou Founder apaga anotacao" ON public.staff_anotacoes;
CREATE POLICY "Autor ou Founder apaga anotacao"
  ON public.staff_anotacoes FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.has_role(auth.uid(), 'founder'));

DROP TRIGGER IF EXISTS registrar_autoria ON public.staff_anotacoes;
CREATE TRIGGER registrar_autoria AFTER INSERT OR UPDATE OR DELETE ON public.staff_anotacoes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_autoria();

-- ---------------------------------------------------------------- 3) chat por área
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'geral';
CREATE INDEX IF NOT EXISTS idx_chat_messages_canal ON public.chat_messages (canal, created_at DESC);

CREATE OR REPLACE FUNCTION public.pode_ver_canal_chat(_user_id uuid, _canal text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_team_member(_user_id) AND (
    _canal = 'geral'
    OR (_canal LIKE 'area:%' AND public.has_area(_user_id, substr(_canal, 6)))
  )
$$;
REVOKE ALL ON FUNCTION public.pode_ver_canal_chat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_canal_chat(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Equipe le mensagens do chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Quem e do canal le as mensagens" ON public.chat_messages;
CREATE POLICY "Quem e do canal le as mensagens"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.pode_ver_canal_chat(auth.uid(), canal));
DROP POLICY IF EXISTS "Usuario envia suas mensagens" ON public.chat_messages;
CREATE POLICY "Usuario envia suas mensagens"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.pode_ver_canal_chat(auth.uid(), canal));
