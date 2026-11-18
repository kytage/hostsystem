import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CANAIS_DE_LOG } from "@/lib/logs-servidor";
import type { Json } from "@/integrations/supabase/types";

/**
 * Recebe as logs do servidor (FiveM) e grava em public.server_logs (tela /logs).
 *
 * POST /api/public/webhook/logs, com o cabeçalho "x-webhook-token" (o token das logs, no Supabase).
 * Corpo: uma log ou várias de uma vez:
 *   { "canal": "inventario/usou", "jogador_id": "123", "jogador_nome": "Fulano",
 *     "mensagem": "usou 1x Bandagem", "dados": { ... } }
 *   { "logs": [ { ... }, { ... } ] }
 * "canal" é a chave da lista em src/lib/logs-servidor.ts; canal desconhecido é recusado.
 */
const logSchema = z.object({
  canal: z.string().min(1).max(80),
  jogador_id: z.union([z.string(), z.number()]).nullish(),
  jogador_nome: z.string().max(120).nullish(),
  mensagem: z.string().min(1).max(8000),
  dados: z.record(z.string(), z.unknown()).nullish(),
  /** Quando aconteceu (opcional; sem ele vale a hora em que chegou). */
  quando: z.string().datetime({ offset: true }).nullish(),
});
const corpoSchema = z.union([logSchema, z.object({ logs: z.array(logSchema).min(1).max(200) })]);

export const Route = createFileRoute("/api/public/webhook/logs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { tokenDasLogs, tokenConfere } = await import("@/lib/logs-servidor.server");
        if (
          !tokenConfere(request.headers.get("x-webhook-token"), await tokenDasLogs(supabaseAdmin))
        ) {
          return new Response("Não autorizado", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }
        const lido = corpoSchema.safeParse(body);
        if (!lido.success) {
          return Response.json(
            { error: "Log inválida", detalhes: lido.error.issues },
            { status: 400 },
          );
        }
        const logs = "logs" in lido.data ? lido.data.logs : [lido.data];
        const desconhecidos = [
          ...new Set(logs.map((l) => l.canal).filter((c) => !CANAIS_DE_LOG.has(c))),
        ];
        if (desconhecidos.length) {
          return Response.json(
            { error: "Canal desconhecido", canais: desconhecidos },
            { status: 400 },
          );
        }

        const linhas = logs.map((l) => ({
          canal: l.canal,
          jogador_id: l.jogador_id == null ? null : String(l.jogador_id).slice(0, 40),
          jogador_nome: l.jogador_nome ?? null,
          mensagem: l.mensagem,
          dados: (l.dados ?? {}) as Json,
          ...(l.quando ? { criado_em: l.quando } : {}),
        }));
        const { error } = await supabaseAdmin.from("server_logs").insert(linhas);
        if (error) return Response.json({ error: "Falha ao salvar" }, { status: 500 });
        return Response.json({ ok: true, gravadas: linhas.length });
      },
    },
  },
});
