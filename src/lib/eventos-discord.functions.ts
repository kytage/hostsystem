/**
 * Publicação de eventos no Discord via webhook.
 *
 * Roda no servidor: o link do webhook fica protegido em
 * DISCORD_WEBHOOK_EVENTOS_URL e nunca chega ao navegador.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const staffRefSchema = z.object({ id: z.string(), username: z.string() });

const eventoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(256),
  equipeLabel: z.string(),
  equipeEmoji: z.string(),
  staff: z.array(staffRefSchema),
  todosDaArea: z.boolean(),
  data: z.string(), // YYYY-MM-DD
  horario: z.string(), // HH:MM
  premiacao: z.string(),
  informacoes: z.string().max(3_200),
  bannerUrl: z.string(),
});

interface DiscordAttachment {
  blob: Blob;
  filename: string;
}

function extrairBannerDataUrl(dataUrl: string): DiscordAttachment | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  const mimeType = match[1];
  const base64 = match[2];
  if (!mimeType || !base64) return null;

  const bytes = Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new Error("O banner excede o limite de 10 MB do Discord");
  }

  const extensao = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  return {
    blob: new Blob([bytes], { type: mimeType }),
    filename: `banner-evento.${extensao ?? "png"}`,
  };
}

/** "Terça-feira, 15 de setembro" — dia da semana sempre com inicial maiúscula. */
function formatarDataLonga(data: string): string {
  const texto = new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const publicarEventoDiscord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventoSchema.parse(input))
  .handler(async ({ data: ev, context }) => {
    const webhook = process.env["DISCORD_WEBHOOK_EVENTOS_URL"];
    if (!webhook) throw new Error("Webhook do Discord não configurado");

    const linhas = [
      `📅 **Data:** ${formatarDataLonga(ev.data)}`,
      `🕘 **Horário:** ${ev.horario}`,
      ev.premiacao ? `🏆 **Premiação:** ${ev.premiacao}` : "",
      "",
      ev.informacoes.trim(),
      "",
      "🔗 Para mais detalhes sobre este evento e outros conteúdos, acesse nosso site oficial e acompanhe todas as novidades:",
      "",
      "https://hostgg.org/eventos",
    ]
      .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
      .join("\n")
      .trim();

    const embed: Record<string, unknown> = {
      title: ev.nome.toUpperCase(),
      description: linhas,
      color: 0xce0e0e,
    };

    const bannerAnexado = ev.bannerUrl.startsWith("data:")
      ? extrairBannerDataUrl(ev.bannerUrl)
      : null;
    if (bannerAnexado) {
      embed["image"] = { url: `attachment://${bannerAnexado.filename}` };
    } else if (/^https:\/\//i.test(ev.bannerUrl)) {
      embed["image"] = { url: ev.bannerUrl };
    }

    const payload = JSON.stringify({ embeds: [embed] });
    let body: BodyInit;
    let headers: HeadersInit | undefined;

    if (bannerAnexado) {
      const form = new FormData();
      form.append("payload_json", payload);
      form.append("files[0]", bannerAnexado.blob, bannerAnexado.filename);
      body = form;
    } else {
      headers = { "Content-Type": "application/json" };
      body = payload;
    }

    const requestInit: RequestInit = { method: "POST", body };
    if (headers) requestInit.headers = headers;

    const res = await fetch(webhook, requestInit);
    if (!res.ok) {
      const body = await res.text();
      console.error(`Discord webhook falhou [${res.status}]: ${body}`);
      throw new Error(`Discord recusou a publicação [${res.status}]`);
    }

    const { error } = await context.supabase
      .from("eventos_gestao")
      .update({ publicado_discord: true })
      .eq("id", ev.id);
    if (error) throw error;

    return { ok: true };
  });
