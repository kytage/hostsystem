-- 19/11/2026
-- 1) Cronograma de RP do Ilegal: prioridade (com URGENTE), vários responsáveis, várias setagens,
--    checklist de passos e marcação de quando foi concluído.
ALTER TABLE public.ilegal_cronograma
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS responsaveis text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS setagens text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

ALTER TABLE public.ilegal_cronograma DROP CONSTRAINT IF EXISTS ilegal_cronograma_prioridade_check;
ALTER TABLE public.ilegal_cronograma
  ADD CONSTRAINT ilegal_cronograma_prioridade_check
  CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente'));

-- itens antigos: a setagem única vira a lista de setagens
UPDATE public.ilegal_cronograma
   SET setagens = ARRAY[setagem]
 WHERE setagem <> '' AND setagens = '{}';

-- 2) Arquivados: quando um usuário é excluído do painel, uma cópia de tudo dele fica guardada
--    aqui (perfil, cargo, áreas, anotações de staff sobre ele, anotações e tarefas pessoais,
--    punições aplicadas). Só o servidor do painel lê e grava (após checar a permissão).
CREATE TABLE IF NOT EXISTS public.usuarios_arquivados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT '',
  areas text[] NOT NULL DEFAULT '{}',
  discord_id text NOT NULL DEFAULT '',
  host_id text NOT NULL DEFAULT '',
  entrou_em timestamptz,
  ultimo_acesso timestamptz,
  perfil jsonb NOT NULL DEFAULT '{}'::jsonb,
  staff_anotacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  anotacoes_pessoais text NOT NULL DEFAULT '',
  tarefas jsonb NOT NULL DEFAULT '[]'::jsonb,
  punicoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  motivo text NOT NULL DEFAULT '',
  excluido_por text NOT NULL DEFAULT '',
  excluido_por_id uuid,
  excluido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usuarios_arquivados_excluido_em_idx
  ON public.usuarios_arquivados (excluido_em DESC);

ALTER TABLE public.usuarios_arquivados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usuarios_arquivados FROM anon, authenticated;
GRANT ALL ON public.usuarios_arquivados TO service_role;

-- 3) Coordinator vê e usa o Desenvolvimento por completo, igual à Direção
--    (ver tudo, solicitar direto, aprovar as solicitações dos Managers, patch notes).
INSERT INTO public.role_permissions (role, category, actions)
SELECT 'coordinator', category, actions
  FROM public.role_permissions
 WHERE role = 'direcao' AND category IN ('desenvolvimento', 'patch_notes')
ON CONFLICT (role, category) DO UPDATE SET actions = EXCLUDED.actions;
