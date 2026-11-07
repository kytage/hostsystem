create table public.ilegal_orgs (
  id text primary key,
  categoria text not null,
  ordem integer not null default 0,
  setagem text not null default '',
  local text not null default '',
  grupo text not null default '',
  cds text not null default '',
  organizacao text not null default '',
  status text not null default 'Livre',
  situacao text not null default '.',
  observacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ilegal_detalhes (
  org_id text primary key references public.ilegal_orgs(id) on delete cascade,
  logo text not null default '',
  nome1 text not null default '',
  telefone1 text not null default '',
  nome2 text not null default '',
  telefone2 text not null default '',
  nome3 text not null default '',
  telefone3 text not null default '',
  cds_bau_lider text not null default '',
  cds_bau_membro text not null default '',
  cds_craft text not null default '',
  cds_shop text not null default '',
  cds_rota text not null default '',
  garagem_blip text not null default '',
  garagem_spawn text not null default '',
  uniforme text not null default '',
  cor_veiculo text not null default '',
  cds_blip_desmanche text not null default '',
  anotacoes_sobre text not null default '',
  updated_at timestamptz not null default now()
);

create table public.dev_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  priority text not null default 'media' check (priority in ('alta','media','baixa')),
  tag text not null default '',
  assignee text not null default 'DEV',
  column_id text not null default 'backlog' check (column_id in ('backlog','doing','review','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  priority text not null default 'media' check (priority in ('alta','media','baixa')),
  tag text not null default '',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ilegal_orgs to authenticated;
grant all on public.ilegal_orgs to service_role;
grant select, insert, update, delete on public.ilegal_detalhes to authenticated;
grant all on public.ilegal_detalhes to service_role;
grant select, insert, update, delete on public.dev_tasks to authenticated;
grant all on public.dev_tasks to service_role;
grant select, insert, update, delete on public.pendencias to authenticated;
grant all on public.pendencias to service_role;

alter table public.ilegal_orgs enable row level security;
alter table public.ilegal_detalhes enable row level security;
alter table public.dev_tasks enable row level security;
alter table public.pendencias enable row level security;

create policy "Equipe autenticada gerencia orgs" on public.ilegal_orgs
  for all to authenticated using (true) with check (true);
create policy "Equipe autenticada gerencia detalhes" on public.ilegal_detalhes
  for all to authenticated using (true) with check (true);
create policy "Equipe autenticada gerencia tarefas" on public.dev_tasks
  for all to authenticated using (true) with check (true);
create policy "Equipe autenticada gerencia pendencias" on public.pendencias
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.ilegal_orgs;
alter publication supabase_realtime add table public.ilegal_detalhes;
alter publication supabase_realtime add table public.dev_tasks;
alter publication supabase_realtime add table public.pendencias;

insert into public.ilegal_orgs (id, categoria, ordem, setagem, local, grupo, cds, organizacao, status, situacao, observacao) values
('a1', 'armas', 0, 'Armas01', 'Favela Praia', '#HA01', '-2369.19,-237.21,63.15,22.68', 'MIDNIGHT', 'Assumida', 'Entregue', ''),
('a2', 'armas', 1, 'Armas02', 'Favela Chapadao', '#HA02', '-346.04,1629.01,390.93,150.24', 'CPX ISRAEL', 'Assumida', 'Entregue', ''),
('a3', 'armas', 2, 'Armas03', 'Favela Praia 2', '#HA03', '-3027.57,1271.79,76.13,314.65', 'TROPA DO 7', 'Assumida', 'Entregue', 'PORTUGA!!!'),
('a4', 'armas', 3, 'Armas04', 'Favela Barragem', '#HA04', '1183.06,-276.65,105.5,297.64', 'ELEMENTS', 'Assumida', 'Entregue', ''),
('a5', 'armas', 4, 'Armas05', 'Favela Selva', '#HA05', '1137.67,574.67,221.59,65.2', '7XIS', 'Assumida', 'Entregue', ''),
('a6', 'armas', 5, 'Armas06', 'Favela Complexo 22', '#HA06', '1709.64,-2205.21,173.5,306.15', 'LIQUIDGG', 'Assumida', 'Entregue', ''),
('a7', 'armas', 6, 'Armas07', 'Favela Hallway', '#HA07', '1659.93,1474.98,122.41,201.26', 'P21', 'Assumida', 'Entregue', 'VERIFICAR ATIVIDADE DA FAC!'),
('m1', 'municao', 0, 'Muni01', 'Favela Juramento', '#HM01', '-2016.43,724.59,176.96,31.19', 'TURQUIA', 'Assumida', 'Entregue', ''),
('m2', 'municao', 1, 'Muni02', 'Favela Cassino', '#HM02', '922.58,350.72,153.84,76.54', 'NOVA HOLANDA', 'Assumida', 'Entregue', ''),
('m3', 'municao', 2, 'Muni03', 'Favela Fazenda', '#HM03', '807.86,1911.59,164.67,195.6', 'INGLATERRA', 'Assumida', 'Entregue', ''),
('m4', 'municao', 3, 'Muni04', 'Favela Helipa', '#HM04', '1291.68,-697.13,100.81,240.95', 'SLAYER', 'Assumida', 'Entregue', ''),
('m5', 'municao', 4, 'Muni05', 'Favela Colombia', '#HM05', '1394.47,-1447.81,107.54,317.49', 'YING YANG', 'Assumida', 'Entregue', ''),
('m6', 'municao', 5, 'Muni06', 'Casa Petroleo', '#HM06', '1583.7,-2602.37,60.86,255.12', 'EGITO', 'Assumida', 'Entregue', ''),
('m7', 'municao', 6, 'Muni07', 'Favela Mergulhador', '#HM07', '2584.9,1800.35,61.91,297.64', 'ATTACK', 'Assumida', 'Entregue', ''),
('l1', 'lavagem', 0, 'Lavagem01', 'Vinhedo', '#HL01', '-1886.71,2022.77,147.35,22.68', 'MONEY', 'Assumida', 'Entregue', 'VERIFICAR ATIVIDADE DA FAC!'),
('l2', 'lavagem', 1, 'Lavagem02', 'Club77', '#HL02', '189.18,-3166.99,5.88,82.21', '', 'Livre', '.', ''),
('l3', 'lavagem', 2, 'Lavagem03', 'Bahamas', '#HL03', '-1416.75,-571.21,74.34,215.44', 'NEIWERT', 'Assumida', 'Entregue', ''),
('l4', 'lavagem', 3, 'Lavagem04', 'Favela Cemiterio', '#HL04', '-1685.1,-35.36,104.5,93.55', 'VENEZA', 'Assumida', 'Entregue', ''),
('l5', 'lavagem', 4, 'Lavagem05', 'Farol', '#HL05', '3404.79,4874.98,44.38,325.99', 'BLACKOUT', 'Assumida', 'Entregue', 'VERIFICAR ATIVIDADE DA FAC!'),
('l6', 'lavagem', 5, 'Lavagem06', 'Playboy', '#HL06', '-1520.75,82.29,66.17,19.85', 'ANARCHY', 'Assumida', 'Entregue', ''),
('l7', 'lavagem', 6, 'Lavagem07', 'Santo Amaro', '#HL07', '-1250.3,2551.34,76.21,257.96', 'N1NE', 'Assumida', 'Entregue', ''),
('g1', 'garagem', 0, 'Garagem01', 'Esgoto', '#HG01', '735.64,-1049.15,2.54,102.05', 'VORTEX', 'Assumida', 'Entregue', ''),
('g2', 'garagem', 1, 'Garagem02', 'Aeroporto', '#HG02', '-696.6,-2463.24,13.82,257.96', 'MOSTWANTED', 'Assumida', 'Entregue', ''),
('g3', 'garagem', 2, 'Garagem03', 'Ls Custom', '#HG03', '-378.77,-127.27,47.94,263.63', 'DESACATO', 'Assumida', 'Entregue', ''),
('g4', 'garagem', 3, 'Garagem04', 'Bennys Paleto', '#HG04', '124.69,6399.13,45.49,249.45', 'EQUIPE CAOS', 'Assumida', 'Entregue', ''),
('g5', 'garagem', 4, 'Garagem05', 'Rota 68', '#HG05', '563.27,2737.24,42.16,170.08', '', 'Livre', '.', ''),
('g6', 'garagem', 5, 'Garagem06', 'Porto', '#HG06', '923.83,-2541.52,47.23,17.01', 'TERROR', 'Assumida', 'Entregue', ''),
('g7', 'garagem', 6, 'Garagem07', 'Doca', '#HG07', '56.79,-2564.92,6.2,308.98', 'ESC', 'Assumida', 'Entregue', ''),
('g8', 'garagem', 7, 'Garagem08', 'Porto 2', '#HG08', '730.82,-1285.25,26.39,59.53', 'DARK', 'Assumida', 'Entregue', ''),
('g9', 'garagem', 8, 'Garagem09', 'Balas', '#HG09', '89.48,-1944.39,20.74,0.0', 'CDD', 'Reservada', 'Pendente', 'MIGRAR BALAS PRA CÁ E ENTREGAR !'),
('d1', 'drogas', 0, 'Drogas01', 'Favela Lago', '#HD01', '-226.0,805.02,231.89,51.03', 'EQP CAOS', 'Assumida', 'Entregue', ''),
('d2', 'drogas', 1, 'Drogas02', 'Favela Saara', '#HD02', '2560.63,3995.12,66.49,232.45', 'DALESTE', 'Assumida', 'Entregue', ''),
('d3', 'drogas', 2, 'Drogas03', 'Favela Ilha', '#HD03', '213.86,3516.11,52.96,36.86', 'IRÃ', 'Reservada', 'Pendente', 'ENTREGAR !'),
('d4', 'drogas', 3, 'Drogas04', 'Favela Zancudo', '#HD04', '-1587.86,2628.4,76.63,235.28', 'HAVOC', 'Assumida', 'Entregue', ''),
('d5', 'drogas', 4, 'Drogas05', 'Lava Jato', '#HD05', '-13.27,-1402.86,29.32,116.23', '', 'Livre', '.', ''),
('d6', 'drogas', 5, 'Drogas06', 'Favela Fallet', '#HD06', '-1459.23,1552.33,170.23,263.63', 'PORTUGAL', 'Assumida', 'Entregue', ''),
('d7', 'drogas', 6, 'Drogas07', 'Favela Cata Vento', '#HD07', '1999.9,2349.99,108.78,266.46', 'LUNATIC', 'Assumida', 'Entregue', ''),
('d8', 'drogas', 7, 'Drogas08', 'QG', '#HD08', '174.49,-1714.27,37.52,28.35', 'ALEMANHA', 'Assumida', 'Entregue', ''),
('d9', 'drogas', 8, 'Drogas09', 'Vagos', '#HD09', '327.86,-2033.2,25.91,311.82', 'FRANÇA', 'Assumida', 'Entregue', ''),
('d10', 'drogas', 9, 'Drogas10', 'Favela Ferrovia', '#HD10', '-558.64,-1348.2,43.34,184.26', 'NEUROSES', 'Assumida', 'Entregue', ''),
('d11', 'drogas', 10, 'Drogas11', 'Bloods', '#HD11', '-1070.38,-1667.48,7.51,150.24', '', 'Livre', '.', ''),
('d12', 'drogas', 11, 'Drogas12', 'Favela Playboy', '#HD12', '-1742.13,468.14,164.71,354.34', 'SEVENTAKE', 'Assumida', 'Entregue', ''),
('h1', 'hpi', 0, 'HPI', 'Megamall Norte', '#HPI', '2548.65,3350.25,125.73,311.82', 'AVENUE', 'Assumida', 'Entregue', ''),
('gt1', 'gueto', 0, 'Gueto01', 'Balas', '#HT01', '80.65,-1963.42,20.19', '', 'Fechado', '.', 'Migrar para Garagem09'),
('gt2', 'gueto', 1, 'Gueto02', 'Vagos', '#HT02', '449.7,-1912.06,34.61,34.02', '', 'Livre', '.', ''),
('gt3', 'gueto', 2, 'Gueto03', 'Norte', '#HT03', '922.57,3579.92,34.58,87.88', '', 'Livre', '.', ''),
('gt4', 'gueto', 3, 'Gueto04', 'Mansão Franklin', '#HT04', '11.19,551.85,183.22,187.09', '', 'Livre', '.', ''),
('gt5', 'gueto', 4, 'Gueto05', 'Casa do Franklin', '#HT05', '-13.96,-1449.87,32.5,0.0', '', 'Livre', '.', ''),
('gt6', 'gueto', 5, 'Gueto06', 'Ap azul', '#HT06', '-109.79,-9.12,70.52,104.89', '', 'Livre', '.', ''),
('gt7', 'gueto', 6, 'Gueto07', 'Loja 9', '#HT07', '1977.95,3806.88,32.17,25.52', '', 'Livre', '.', ''),
('gt8', 'gueto', 7, 'Gueto08', 'Loja 13', '#HT08', '1405.44,3592.0,42.36,39.69', 'COMPLEXO CENTRAL', 'Assumida', 'Entregue', ''),
('gt9', 'gueto', 8, 'Gueto09', 'Porto de navios', '#HT09', '58.54,-2558.83,9.77,184.26', '', 'Livre', '.', ''),
('gt10', 'gueto', 9, 'Gueto10', 'Esgoto', '#HT10', '601.52,-450.84,25.8,167.25', '', 'Livre', '.', '');

insert into public.dev_tasks (title, description, priority, tag, assignee, column_id) values
('Sistema de garagem v2', 'Reescrever garagem com persistência otimizada.', 'alta', 'Feature', 'RK', 'doing'),
('Corrigir desync de veículos', 'Players relatam teleporte em perseguições.', 'alta', 'Bug', 'RK', 'review'),
('HUD minimalista', 'Nova HUD com tema escuro do painel.', 'media', 'UI', 'LN', 'backlog'),
('Anti-cheat: detecção de noclip', 'Heurística de velocidade + altura.', 'alta', 'Segurança', 'RK', 'backlog'),
('Comando /id otimizado', 'Mostrar ID acima da cabeça sem lag.', 'baixa', 'Feature', 'LN', 'done');

insert into public.pendencias (title, description, priority, tag) values
('Bug no sistema de inventário', 'Itens duplicando ao trocar de veículo em alta velocidade.', 'alta', 'Bug'),
('Otimizar script de economia', 'Query de transações está lenta com 200+ players online.', 'alta', 'Performance'),
('Novo comando /anuncio para staff', 'Comando para enviar anúncio global formatado no chat.', 'media', 'Feature'),
('Atualizar mapa da praça', 'Adicionar novo MLO enviado pela equipe de design.', 'baixa', 'Mapa'),
('Revisar permissões de facções', 'Líderes conseguem acessar baú de outras orgs.', 'media', 'Segurança');