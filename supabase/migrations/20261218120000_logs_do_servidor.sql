-- Logs do servidor (FiveM) no site: as mesmas categorias e canais do Discord "Host - Logs".
-- O servidor manda cada log para o endereço /api/public/webhook/logs (com o token secreto),
-- que grava aqui com a chave de serviço. Só o Founder lê (tela /logs).

CREATE TABLE IF NOT EXISTS public.server_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- chave do canal, "categoria/canal" (src/lib/logs-servidor.ts), por exemplo "inventario/usou"
  canal text NOT NULL,
  -- quem fez (passaporte/ID no jogo e nome), quando a log tem um jogador
  jogador_id text,
  jogador_nome text,
  -- o texto da log, como aparece no Discord
  mensagem text NOT NULL,
  -- o resto do que o servidor mandar (campos do embed, coordenadas, itens...)
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_server_logs_canal_criado ON public.server_logs (canal, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_server_logs_criado ON public.server_logs (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_server_logs_jogador ON public.server_logs (jogador_id);

GRANT SELECT ON public.server_logs TO authenticated;
GRANT ALL ON public.server_logs TO service_role;

ALTER TABLE public.server_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Founder le as logs do servidor" ON public.server_logs;
CREATE POLICY "Founder le as logs do servidor"
  ON public.server_logs FOR SELECT TO authenticated
  USING (public.is_founder(auth.uid()));
-- (ninguém grava pelo site: só o endereço do servidor, com a chave de serviço)

-- logs novas aparecem na hora na tela
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.server_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
