-- Logs do servidor: o servidor (FiveM) continua mandando cada log para o Discord e manda uma
-- cópia para o site (/api/public/webhook/logs-discord), junto com o webhook do Discord usado.
-- O site descobre o canal do Discord desse webhook e grava a log no canal certo da tela /logs.

-- Configuração das logs (o token que o servidor manda no cabeçalho x-webhook-token).
-- Só a chave de serviço lê e grava: sem nenhuma política, ninguém do site enxerga.
CREATE TABLE IF NOT EXISTS public.server_logs_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.server_logs_config TO service_role;
ALTER TABLE public.server_logs_config ENABLE ROW LEVEL SECURITY;

-- De qual canal do Discord é cada webhook (o site pergunta ao Discord uma vez e guarda aqui).
CREATE TABLE IF NOT EXISTS public.server_log_webhooks (
  webhook_id text PRIMARY KEY,
  canal_discord text,
  servidor_discord text,
  -- chave do canal no site ("inventario/usou"); vazio quando o canal do Discord não está na lista
  canal text,
  nome text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.server_log_webhooks TO service_role;
GRANT SELECT ON public.server_log_webhooks TO authenticated;
ALTER TABLE public.server_log_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Founder ve os webhooks das logs" ON public.server_log_webhooks;
CREATE POLICY "Founder ve os webhooks das logs"
  ON public.server_log_webhooks FOR SELECT TO authenticated
  USING (public.is_founder(auth.uid()));
