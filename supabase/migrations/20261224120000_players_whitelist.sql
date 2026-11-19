-- 19/11/2026 — Integração servidor → Painel de Players (etapa 1: ficha dos players)
-- Whitelist do player, mandada pelo resource host_painel. null = ainda não veio do servidor.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS whitelist boolean;
