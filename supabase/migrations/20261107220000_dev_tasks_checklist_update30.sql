-- HOST UPDATE 3.0: checklist e prazo por tópico + pendências iniciais. Idempotente.
ALTER TABLE public.dev_tasks ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.dev_tasks ADD COLUMN IF NOT EXISTS prazo date;

INSERT INTO public.dev_tasks (title, description, priority, tag, assignee, column_id, checklist)
SELECT v.title, '', v.priority, 'Marketing', 'DEV', 'backlog', v.checklist::jsonb
FROM (VALUES
  ('Host Level (APP)', 'alta', '[
    {"id":"hl-1","text":"Extensão 500","done":false},
    {"id":"hl-2","text":"Tempo de Craft sobre o Level","done":false},
    {"id":"hl-3","text":"Painel Lavagem (NOVO)","done":false},
    {"id":"hl-4","text":"Efeitos","done":false},
    {"id":"hl-5","text":"Insígnias","done":false},
    {"id":"hl-6","text":"SKIN RankColor","done":false},
    {"id":"hl-7","text":"Missões e XP","done":false},
    {"id":"hl-8","text":"Incluir no App","done":false},
    {"id":"hl-9","text":"Ranking TOP 3","done":false}
  ]'),
  ('Novos Restaurantes', 'media', '[]'),
  ('Mecânica Script', 'media', '[
    {"id":"me-1","text":"O próprio dono do veículo tunar","done":false}
  ]'),
  ('Concessionária (APP)', 'alta', '[
    {"id":"co-1","text":"Vender/Transferir carros","done":false},
    {"id":"co-2","text":"Carros lore com estoque — valor in-game com handling hyper/blindado","done":false}
  ]'),
  ('Update''s Postos e add Lojinha', 'media', '[
    {"id":"po-1","text":"Update dos postos","done":false},
    {"id":"po-2","text":"Adicionar lojinha","done":false}
  ]'),
  ('Loja de Capinhas de Celular', 'baixa', '[
    {"id":"ca-1","text":"Capinhas de celular","done":false},
    {"id":"ca-2","text":"Loja de capinhas","done":false}
  ]'),
  ('Desmanche APP — Contratos', 'media', '[
    {"id":"de-1","text":"Contratos","done":false}
  ]'),
  ('HOST Dominations', 'alta', '[
    {"id":"do-1","text":"(10) Quarta / à noite","done":false}
  ]')
) AS v(title, priority, checklist)
WHERE NOT EXISTS (SELECT 1 FROM public.dev_tasks d WHERE d.title = v.title);
