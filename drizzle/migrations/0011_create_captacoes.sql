CREATE TABLE public.captacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao text NOT NULL,
  lider text NOT NULL DEFAULT '',
  contato text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'pvp' CHECK (tipo IN ('p1_crew','hibrido','pvp')),
  setagem text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  online_esperado text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aguardando','aceito','entregue','negado')),
  captador text NOT NULL DEFAULT '',
  captador_id uuid,
  observacao text NOT NULL DEFAULT '',
  proposta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacoes TO authenticated;
GRANT ALL ON public.captacoes TO service_role;
ALTER TABLE public.captacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY captacoes_team_all ON public.captacoes FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_captacoes_updated_at BEFORE UPDATE ON public.captacoes
  FOR EACH ROW EXECUTE FUNCTION update_kanban_cards_updated_at();

CREATE TABLE public.captacoes_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captacao_id uuid NOT NULL REFERENCES public.captacoes(id) ON DELETE CASCADE,
  data_hora timestamptz NOT NULL,
  meio text NOT NULL DEFAULT 'Call no Discord',
  com_quem text NOT NULL DEFAULT '',
  participantes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacoes_reunioes TO authenticated;
GRANT ALL ON public.captacoes_reunioes TO service_role;
ALTER TABLE public.captacoes_reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY captacoes_reunioes_team_all ON public.captacoes_reunioes FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

CREATE TABLE public.captacoes_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  staff text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacoes_categorias TO authenticated;
GRANT ALL ON public.captacoes_categorias TO service_role;
ALTER TABLE public.captacoes_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY captacoes_categorias_team_all ON public.captacoes_categorias FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

CREATE TABLE public.captacoes_estabelecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.captacoes_categorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'livre' CHECK (status IN ('livre','reservado','ocupado')),
  observacao text NOT NULL DEFAULT '',
  staff text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacoes_estabelecimentos TO authenticated;
GRANT ALL ON public.captacoes_estabelecimentos TO service_role;
ALTER TABLE public.captacoes_estabelecimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY captacoes_estab_team_all ON public.captacoes_estabelecimentos FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_captacoes_estab_updated_at BEFORE UPDATE ON public.captacoes_estabelecimentos
  FOR EACH ROW EXECUTE FUNCTION update_kanban_cards_updated_at();

CREATE TABLE public.captacoes_modelos (
  key text PRIMARY KEY,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.captacoes_modelos TO authenticated;
GRANT ALL ON public.captacoes_modelos TO service_role;
ALTER TABLE public.captacoes_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY captacoes_modelos_team_select ON public.captacoes_modelos FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
CREATE POLICY captacoes_modelos_coord_update ON public.captacoes_modelos FOR UPDATE TO authenticated
  USING (public.is_coordinator_plus(auth.uid())) WITH CHECK (public.is_coordinator_plus(auth.uid()));

INSERT INTO public.captacoes_modelos (key, conteudo) VALUES
('nivel_1', '{"titulo":"NÍVEL 1","faixa":"5-10 Onlines","liderancaQtd":"até 3 pessoas","lideranca":"3x VIP ULTRA''s (R$ 550) — Contém 1x Blindado e 1x Hyper","gerenciaQtd":"até 5 pessoas","gerencia":"5x Blindados X7 - 30 Dias","vipFac":["KIT UNIFORME COMPLETO","RADIO PRIVADA","CAMINHÃO P/ LÍDER","BLIP CARRO COMUM P/ TODOS MEMBROS","+ BAÚ E SALÁRIO PARA TODOS MEMBROS"],"camp":"1 CAMP INTERNO por MÊS / Suporte e Premiação","campExtras":"2 Blindados - 30 Dias + 100 Host Coins","pix":false}'),
('nivel_2', '{"titulo":"NÍVEL 2","faixa":"10-15 Online","liderancaQtd":"até 3 pessoas","lideranca":"3x VIP ULTRA''s (R$ 550) — Contém 1x Blindado e 1x Hyper","gerenciaQtd":"até 7 pessoas","gerencia":"7x Blindados X7 - 30 Dias","vipFac":["KIT UNIFORME COMPLETO","RADIO PRIVADA","CAMINHÃO P/ LÍDER","BLIP CARRO COMUM P/ TODOS MEMBROS","+ BAÚ E SALÁRIO PARA TODOS MEMBROS"],"camp":"1 CAMP INTERNO por MÊS / Suporte e Premiação","campExtras":"2 Blindados - 30 Dias + 100 Host Coins","pix":false}'),
('nivel_3', '{"titulo":"NÍVEL 3","faixa":"+15 Online","liderancaQtd":"até 3 pessoas","lideranca":"3x VIP ULTRA''s (R$ 550) — Contém 1x Blindado e 1x Hyper","gerenciaQtd":"até 7 pessoas","gerencia":"7x Blindados X7 - 30 Dias","vipFac":["KIT UNIFORME COMPLETO","RADIO PRIVADA","CAMINHÃO P/ LÍDER","BLIP CARRO COMUM P/ TODOS MEMBROS","+ BAÚ E SALÁRIO PARA TODOS MEMBROS"],"camp":"1 CAMP INTERNO por MÊS / Suporte e Premiação","campExtras":"2 Blindados - 30 Dias + 100 Host Coins","pix":true}'),
('pix', '{"faixas":[{"online":15,"valor":400},{"online":20,"valor":600},{"online":25,"valor":1000},{"online":30,"valor":1250},{"online":35,"valor":1500}]}');

INSERT INTO public.captacoes_categorias (nome, staff, ordem) VALUES
('Restaurantes', 'Nick', 1),
('Departamentos e guarnições', 'Karol', 2),
('Hospital', 'Karol, Gabrielly', 3),
('Mecânicas', 'Elizabeth, Zack', 4),
('Outros', '', 5);

INSERT INTO public.captacoes_estabelecimentos (categoria_id, nome, status, observacao, staff, ordem)
SELECT c.id, v.nome, v.status, v.observacao, v.staff, v.ordem
FROM public.captacoes_categorias c
JOIN (VALUES
('Restaurantes','Pops Host','reservado','Luuh','',1),
('Restaurantes','Vitrinni','reservado','Lana','',2),
('Restaurantes','CatCafé','reservado','Alexya Ice Black','',3),
('Restaurantes','Adega','reservado','Antonella e Lindinha','',4),
('Restaurantes','Strike','reservado','Henry','',5),
('Restaurantes','Doce-Fatias','livre','','',6),
('Restaurantes','Pizza Hot','reservado','Lucas Ferreira','',7),
('Restaurantes','Host Poke','reservado','Mavies','',8),
('Departamentos e guarnições','Polícia Militar','ocupado','Samzera','',1),
('Departamentos e guarnições','COE (TÁTICA)','ocupado','Ynk','',2),
('Departamentos e guarnições','RECOM (TÁTICA)','ocupado','Drx','',3),
('Departamentos e guarnições','SPEED','ocupado','DRZZY','',4),
('Departamentos e guarnições','GTM','ocupado','Colpo','',5),
('Departamentos e guarnições','GRAER','livre','','',6),
('Departamentos e guarnições','Polícia Civil','ocupado','PK','',7),
('Hospital','Hospital Nicolas','ocupado','Jhonson / Barbz / Lizz','',1),
('Hospital','Hospital Juliano','livre','','',2),
('Mecânicas','Mecânica Norte','livre','','',1),
('Mecânicas','Mecânica Sul','ocupado','','',2),
('Outros','Focus Publicidade','livre','','Leticia',1),
('Outros','Judiciário','ocupado','','Jhonson / Isabella',2),
('Outros','Centro Educacional','ocupado','Kaya','Julia',3),
('Outros','Clubinho Raposa','ocupado','','Julia',4),
('Outros','Clubinho Lobinho','ocupado','Líder: Buxinho','Julia',5)
) AS v(categoria, nome, status, observacao, staff, ordem) ON c.nome = v.categoria;