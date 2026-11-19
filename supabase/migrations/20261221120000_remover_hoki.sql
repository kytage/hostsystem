-- Remove o HOKI, a HOST FAZENDAS, as Staff Coins e o Queridômetro (pedido do henrique em 18/11/2026).
-- Backup completo (dados, funções e regras) entregue antes: backup-hoki-2026-11-18.zip.

-- 1) Tarefas: param de dar Staff Coins.
DROP TRIGGER IF EXISTS tarefa_staff_coins ON public.tarefas_particulares;
DROP FUNCTION IF EXISTS public.tarefa_staff_coins();
ALTER TABLE public.tarefas_particulares
  DROP COLUMN IF EXISTS coins_recebidas,
  DROP COLUMN IF EXISTS recompensada_em;

-- 2) Tabelas (CASCADE leva junto as regras de acesso, gatilhos, índices e o tempo real delas).
DROP TABLE IF EXISTS
  public.fazenda_amizades, public.fazenda_boletins, public.fazenda_convites, public.fazenda_ilhas,
  public.fazenda_jogadores, public.fazenda_operacoes, public.fazenda_presentes, public.fazenda_registro,
  public.fazenda_roubos, public.fazenda_visitas,
  public.hoki_acesso, public.hoki_cartas, public.hoki_cartas_lidas, public.hoki_comercio,
  public.hoki_convites, public.hoki_visitantes,
  public.hoshi_jogos, public.hoshi_loja, public.hoshi_pets,
  public.termometro_votos
  CASCADE;

-- 3) Funções.
DROP FUNCTION IF EXISTS public.fazenda_criar(uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.fazenda_gravar(text, uuid, uuid, jsonb, integer, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.fazenda_ranking(integer);
DROP FUNCTION IF EXISTS public.fazenda_roubar(text, uuid, jsonb, integer, jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.fazenda_selos(uuid[]);
DROP FUNCTION IF EXISTS public.hoki_carta_antes();
DROP FUNCTION IF EXISTS public.hoki_comercio_anunciar(text, integer, integer);
DROP FUNCTION IF EXISTS public.hoki_comercio_cancelar(uuid);
DROP FUNCTION IF EXISTS public.hoki_comercio_comprar(uuid);
DROP FUNCTION IF EXISTS public.hoki_inventario_somar(jsonb, text, integer);
DROP FUNCTION IF EXISTS public.hoki_pessoas();
DROP FUNCTION IF EXISTS public.hoki_rankings();
DROP FUNCTION IF EXISTS public.hoki_registrar_acesso(boolean);
DROP FUNCTION IF EXISTS public.hoshi_comprar(text);
DROP FUNCTION IF EXISTS public.hoshi_dar_coins(uuid, integer);
DROP FUNCTION IF EXISTS public.hoshi_nivel(integer);
DROP FUNCTION IF EXISTS public.hoshi_protege_coins();
DROP FUNCTION IF EXISTS public.hoshi_resgatar(text);
DROP FUNCTION IF EXISTS public.is_hoki_visitante(uuid);
DROP FUNCTION IF EXISTS public.pode_usar_hoki(uuid);
