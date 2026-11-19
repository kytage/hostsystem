import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

/**
 * Cópia das logs que o servidor (FiveM) manda para o Discord. O servidor continua mandando cada
 * log para o Discord e, ao mesmo tempo, manda para cá a mesma mensagem e o webhook usado:
 *
 *   POST /api/public/webhook/logs-discord
 *   cabeçalho x-webhook-token: <token das logs, guardado no Supabase>
 *   { "webhook": "<id>/<token do webhook do Discord>", "payload": { ...o mesmo corpo do Discord... } }
 *
 * O site descobre de qual canal do Discord é o webhook e grava a log no canal certo da tela /logs.
 * Nada é repassado ao Discord. Log de canal que o site não conhece é ignorada (responde 202).
 */
const corpoSchema = z.object({
  webhook: z.string().regex(/^\d{5,25}\/[\w-]{20,120}$/),
  payload: z.record(z.string(), z.unknown()),
});

export const Route = createFileRoute("/api/public/webhook/logs-discord")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { tokenDasLogs, tokenConfere, canalDoWebhook, lerMensagemDoDiscord } =
          await import("@/lib/logs-servidor.server");
        if (
          !(await tokenConfere(request.headers.get("x-webhook-token"), await tokenDasLogs(supabaseAdmin)))
        ) {
          return new Response("Não autorizado", { status: 401 });
        }
        const { lerJsonLimitado } = await import("@/lib/webhook-seguro");
        const leitura = await lerJsonLimitado(request, 1_000_000);
        if (!leitura.ok) return leitura.resposta;
        const body = leitura.body;
        const lido = corpoSchema.safeParse(body);
        if (!lido.success) return Response.json({ error: "Log inválida" }, { status: 400 });

        const [webhookId = "", webhookToken = ""] = lido.data.webhook.split("/");
        const canal = await canalDoWebhook(supabaseAdmin, webhookId, webhookToken);
        // canais lidos pelo bot do Discord: a cópia do servidor é ignorada (evita log duplicada)
        const { lidoPeloBot } = await import("@/lib/logs-bot");
        if (canal && lidoPeloBot(canal))
          return Response.json({ ok: true, gravada: false, motivo: "canal lido pelo bot" }, { status: 202 });
        if (!canal)
          return Response.json(
            { ok: true, gravada: false, motivo: "canal fora da lista" },
            { status: 202 },
          );

        const { mensagem, jogadorId, jogadorNome } = lerMensagemDoDiscord(lido.data.payload);
        const { error } = await supabaseAdmin.from("server_logs").insert({
          canal,
          jogador_id: jogadorId,
          jogador_nome: jogadorNome,
          mensagem,
          dados: lido.data.payload as Json,
        });
        if (error) return Response.json({ error: "Falha ao salvar" }, { status: 500 });
        return Response.json({ ok: true, gravada: true, canal });
      },
    },
  },
});
