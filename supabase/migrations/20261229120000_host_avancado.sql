-- HOST AVANÇADO: o HOST CENTRAL (painel pessoal de captação, conteúdo, tarefas e radar) dentro do site.
-- Só Founder e CEO (c_level) leem e gravam. Mesmas colunas do painel local, com o prefixo avancado_.
-- Datas ficam em texto ISO (como no painel local), para os dados irem e voltarem sem conversão.

CREATE OR REPLACE FUNCTION public.is_avancado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'founder'::public.app_role)
      OR public.has_role(_user_id, 'c_level'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.is_avancado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_avancado(uuid) TO authenticated, service_role;


CREATE TABLE IF NOT EXISTS public.avancado_leads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tipo text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  plataforma text NOT NULL DEFAULT '',
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  cidade_atual text NOT NULL DEFAULT '',
  cidade_confianca text NOT NULL DEFAULT '',
  lider text NOT NULL DEFAULT '',
  contato_publico text NOT NULL DEFAULT '',
  tamanho integer,
  tamanho_texto text NOT NULL DEFAULT '',
  tamanho_confianca text NOT NULL DEFAULT '',
  alcance integer,
  alcance_texto text NOT NULL DEFAULT '',
  estilo text NOT NULL DEFAULT '',
  indicio text NOT NULL DEFAULT '',
  indicio_confianca text NOT NULL DEFAULT '',
  motivo_host text NOT NULL DEFAULT '',
  prioridade text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT '',
  etapa text NOT NULL DEFAULT '',
  etapa_desde text NOT NULL DEFAULT '',
  triagem text NOT NULL DEFAULT '',
  proximo_passo text NOT NULL DEFAULT '',
  ultimo_contato text,
  proximo_followup text,
  responsavel text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  alertas jsonb NOT NULL DEFAULT '[]'::jsonb,
  motivo_perda text NOT NULL DEFAULT '',
  demo boolean NOT NULL DEFAULT false,
  ordem double precision NOT NULL DEFAULT 0,
  nome_norm text NOT NULL DEFAULT '',
  chaves jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_leads_etapa ON public.avancado_leads (etapa);

CREATE INDEX IF NOT EXISTS idx_avancado_leads_triagem ON public.avancado_leads (triagem);

CREATE INDEX IF NOT EXISTS idx_avancado_leads_proximo_followup ON public.avancado_leads (proximo_followup);

CREATE INDEX IF NOT EXISTS idx_avancado_leads_nome_norm ON public.avancado_leads (nome_norm);

CREATE TABLE IF NOT EXISTS public.avancado_lead_evidencias (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id text NOT NULL DEFAULT '' REFERENCES public.avancado_leads(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  data text,
  descricao text NOT NULL DEFAULT '',
  classificacao text NOT NULL DEFAULT '',
  verificado boolean NOT NULL DEFAULT false,
  como_verificou text NOT NULL DEFAULT '',
  criado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_lead_evidencias_lead ON public.avancado_lead_evidencias (lead_id);

CREATE TABLE IF NOT EXISTS public.avancado_lead_contatos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id text NOT NULL DEFAULT '' REFERENCES public.avancado_leads(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  papel text NOT NULL DEFAULT '',
  discord text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  outro text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  criado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_lead_contatos_lead ON public.avancado_lead_contatos (lead_id);

CREATE TABLE IF NOT EXISTS public.avancado_lead_interacoes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id text NOT NULL DEFAULT '' REFERENCES public.avancado_leads(id) ON DELETE CASCADE,
  data text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  canal text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  autor text NOT NULL DEFAULT '',
  criado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_lead_interacoes_lead ON public.avancado_lead_interacoes (lead_id);

CREATE TABLE IF NOT EXISTS public.avancado_conteudos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  titulo text NOT NULL DEFAULT '',
  formato text NOT NULL DEFAULT '',
  plataformas jsonb NOT NULL DEFAULT '[]'::jsonb,
  quadro_id text,
  pilar text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  data_planejada text,
  hora text NOT NULL DEFAULT '',
  publicado_em text,
  gancho text NOT NULL DEFAULT '',
  cenas jsonb NOT NULL DEFAULT '[]'::jsonb,
  texto_tela jsonb NOT NULL DEFAULT '[]'::jsonb,
  narracao text NOT NULL DEFAULT '',
  legenda text NOT NULL DEFAULT '',
  cta text NOT NULL DEFAULT '',
  hashtags text NOT NULL DEFAULT '',
  material_necessario text NOT NULL DEFAULT '',
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsavel text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  metricas jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT '',
  demo boolean NOT NULL DEFAULT false,
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_conteudos_data_planejada ON public.avancado_conteudos (data_planejada);

CREATE INDEX IF NOT EXISTS idx_avancado_conteudos_status ON public.avancado_conteudos (status);

CREATE TABLE IF NOT EXISTS public.avancado_quadros (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  formato text NOT NULL DEFAULT '',
  frequencia text NOT NULL DEFAULT '',
  exemplo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT false,
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_modelos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tipo text NOT NULL DEFAULT '',
  titulo text NOT NULL DEFAULT '',
  texto text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_tarefas (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  titulo text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  prioridade text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  prazo text,
  hora text NOT NULL DEFAULT '',
  concluida_em text,
  recorrencia text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  participantes text NOT NULL DEFAULT '',
  vinculo_tipo text NOT NULL DEFAULT '',
  vinculo_id text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT '',
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_tarefas_status ON public.avancado_tarefas (status);

CREATE INDEX IF NOT EXISTS idx_avancado_tarefas_prazo ON public.avancado_tarefas (prazo);

CREATE TABLE IF NOT EXISTS public.avancado_pesquisas (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data text NOT NULL DEFAULT '',
  titulo text NOT NULL DEFAULT '',
  consulta text NOT NULL DEFAULT '',
  fonte text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  achados double precision NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT '',
  criado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_resumos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data text NOT NULL DEFAULT '',
  titulo text NOT NULL DEFAULT '',
  markdown text NOT NULL DEFAULT '',
  novos_leads double precision NOT NULL DEFAULT 0,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  origem text NOT NULL DEFAULT '',
  criado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_novidades (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data text NOT NULL DEFAULT '',
  titulo text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  fonte text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  verificado boolean NOT NULL DEFAULT false,
  criado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_mercado_servidores (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome text NOT NULL DEFAULT '',
  cfx_codigo text NOT NULL DEFAULT '',
  concorrente_direto boolean NOT NULL DEFAULT false,
  proprio boolean NOT NULL DEFAULT false,
  site text NOT NULL DEFAULT '',
  discord text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  tiktok text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT false,
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_mercado_amostras (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  servidor_id text NOT NULL DEFAULT '',
  coletado_em text NOT NULL DEFAULT '',
  online integer,
  slots integer,
  fonte text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_automacoes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  frequencia text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  o_que_falta text NOT NULL DEFAULT '',
  como_funciona text NOT NULL DEFAULT '',
  ultima_execucao text,
  ultimo_resultado text NOT NULL DEFAULT '',
  ultimo_resumo text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_automacao_execucoes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  automacao_id text NOT NULL DEFAULT '',
  iniciado_em text NOT NULL DEFAULT '',
  terminado_em text,
  resultado text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  detalhes text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.avancado_materiais (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  titulo text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  markdown text NOT NULL DEFAULT '',
  arquivo text NOT NULL DEFAULT '',
  fixado boolean NOT NULL DEFAULT false,
  ordem double precision NOT NULL DEFAULT 0,
  criado_em text NOT NULL DEFAULT '',
  atualizado_em text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_avancado_amostras_servidor ON public.avancado_mercado_amostras (servidor_id, coletado_em);
CREATE INDEX IF NOT EXISTS idx_avancado_execucoes_automacao ON public.avancado_automacao_execucoes (automacao_id, iniciado_em);

CREATE TABLE IF NOT EXISTS public.avancado_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT 'null'::jsonb
);
CREATE TABLE IF NOT EXISTS public.avancado_historico (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  quando text NOT NULL,
  entidade text NOT NULL,
  entidade_id text NOT NULL,
  acao text NOT NULL,
  resumo text NOT NULL DEFAULT '',
  autor text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_avancado_historico_quando ON public.avancado_historico (quando);


-- Acesso: só Founder e CEO. Nada para anon.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['avancado_leads', 'avancado_lead_evidencias', 'avancado_lead_contatos', 'avancado_lead_interacoes', 'avancado_conteudos', 'avancado_quadros', 'avancado_modelos', 'avancado_tarefas', 'avancado_pesquisas', 'avancado_resumos', 'avancado_novidades', 'avancado_mercado_servidores', 'avancado_mercado_amostras', 'avancado_automacoes', 'avancado_automacao_execucoes', 'avancado_materiais', 'avancado_config', 'avancado_historico'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Founder e CEO" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Founder e CEO" ON public.%I FOR ALL TO authenticated USING (public.is_avancado(auth.uid())) WITH CHECK (public.is_avancado(auth.uid()))', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
