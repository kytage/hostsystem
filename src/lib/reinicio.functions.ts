import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reiniciar o site (só FOUNDER): manda para todo mundo logado um aviso de que o
 * painel vai recarregar em 15 segundos.
 *
 * O aviso vai por um canal público do Supabase Realtime. Como qualquer um com a
 * chave pública poderia mandar mensagem nesse canal, o servidor assina o aviso
 * com uma chave secreta e quem recebe pergunta ao servidor se a assinatura é
 * válida antes de mostrar a contagem. Assim só o aviso do FOUNDER vale.
 */
export const CANAL_REINICIO = "host-reinicio-site";
export const EVENTO_REINICIO = "reiniciar";
export const SEGUNDOS_REINICIO = 15;

const avisoSchema = z.object({
  id: z.string().min(1).max(64),
  em: z.number().int().positive(),
  assinatura: z.string().regex(/^[0-9a-f]{64}$/),
});
export type AvisoReinicio = z.infer<typeof avisoSchema>;

async function assinar(texto: string): Promise<string> {
  const segredo = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!segredo) throw new Error("Servidor sem chave para assinar o aviso.");
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    enc.encode(`host-reinicio:${segredo}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", chave, enc.encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const reiniciarSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cargos } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const ehFounder = ((cargos ?? []) as { role: string }[]).some((r) => r.role === "founder");
    if (!ehFounder) throw new Error("Só o FOUNDER pode reiniciar o site.");

    const id = crypto.randomUUID();
    const em = Date.now();
    const aviso: AvisoReinicio = { id, em, assinatura: await assinar(`${id}.${em}`) };

    const canal = supabaseAdmin.channel(CANAL_REINICIO);
    try {
      const r = await canal.httpSend(EVENTO_REINICIO, aviso);
      if (!r.success) throw new Error(`Não deu para avisar os usuários (${r.status}).`);
    } finally {
      await supabaseAdmin.removeChannel(canal);
    }
    return aviso;
  });

/** Confere se um aviso recebido pelo canal foi mesmo assinado pelo servidor (e é recente). */
export const conferirAvisoReinicio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => avisoSchema.parse(input))
  .handler(async ({ data }) => {
    if (Math.abs(Date.now() - data.em) > 2 * 60_000) return { valido: false };
    const certa = await assinar(`${data.id}.${data.em}`);
    return { valido: certa === data.assinatura };
  });
