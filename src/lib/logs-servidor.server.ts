import { tokenIgual } from "@/lib/webhook-seguro";
/**
 * Logs do servidor, lado do servidor do site: o token de quem pode mandar logs e de qual canal do
 * site é cada webhook do Discord. Usado pelos endereços /api/public/webhook/logs*.
 */
import { CANAL_DO_DISCORD } from "@/lib/logs-servidor";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

let tokenGuardado: { valor: string | null; ate: number } | null = null;

/** O token que o servidor manda no cabeçalho x-webhook-token (fica no Supabase; 1 minuto em cache). */
export async function tokenDasLogs(admin: Admin) {
  if (tokenGuardado && tokenGuardado.ate > Date.now()) return tokenGuardado.valor;
  const { data } = await admin
    .from("server_logs_config")
    .select("valor")
    .eq("chave", "token")
    .maybeSingle();
  const valor = data?.valor ?? process.env["LOGS_WEBHOOK_TOKEN"] ?? null;
  tokenGuardado = { valor, ate: Date.now() + 60_000 };
  return valor;
}

/** Compara sem dar pista pelo tempo de resposta nem pelo tamanho do token. */
export function tokenConfere(recebido: string | null, esperado: string | null) {
  return tokenIgual(recebido, esperado);
}

const webhooksGuardados = new Map<string, string | null>();

/**
 * De qual canal do site é este webhook do Discord. Na primeira vez pergunta ao Discord de qual
 * canal ele é (só com o próprio webhook, sem login) e guarda no Supabase; depois lê de lá.
 * Devolve null quando o canal do Discord não está na lista do site.
 */
export async function canalDoWebhook(admin: Admin, webhookId: string, webhookToken: string) {
  if (webhooksGuardados.has(webhookId)) return webhooksGuardados.get(webhookId) ?? null;
  const { data: salvo } = await admin
    .from("server_log_webhooks")
    .select("canal, canal_discord")
    .eq("webhook_id", webhookId)
    .maybeSingle();
  if (salvo?.canal_discord) {
    // o mapa pode ter ganhado o canal depois: confere de novo pelo número do canal
    const canal = salvo.canal ?? CANAL_DO_DISCORD.get(salvo.canal_discord) ?? null;
    webhooksGuardados.set(webhookId, canal);
    return canal;
  }
  const r = await fetch(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}`).catch(
    () => null,
  );
  if (!r || !r.ok) return null; // sem cache: tenta de novo na próxima log
  const info = (await r.json()) as { channel_id?: string; guild_id?: string; name?: string };
  const canal = info.channel_id ? (CANAL_DO_DISCORD.get(info.channel_id) ?? null) : null;
  await admin.from("server_log_webhooks").upsert({
    webhook_id: webhookId,
    canal_discord: info.channel_id ?? null,
    servidor_discord: info.guild_id ?? null,
    canal,
    nome: info.name ?? null,
    atualizado_em: new Date().toISOString(),
  });
  webhooksGuardados.set(webhookId, canal);
  return canal;
}

interface Embed {
  title?: string;
  description?: string;
  author?: { name?: string };
  fields?: { name?: string; value?: string }[];
  footer?: { text?: string };
}

const limpar = (t: string) =>
  t
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();

/**
 * Transforma a mensagem que ia para o Discord (texto e caixas) num texto só, e tenta achar quem
 * fez (o ID/passaporte e o nome) nos campos da caixa.
 */
export function lerMensagemDoDiscord(payload: Record<string, unknown>) {
  const partes: string[] = [];
  if (typeof payload["content"] === "string" && payload["content"].trim())
    partes.push(limpar(payload["content"]));
  const embeds = Array.isArray(payload["embeds"]) ? (payload["embeds"] as Embed[]) : [];
  let jogadorId: string | null = null;
  let jogadorNome: string | null = null;
  for (const e of embeds) {
    if (e.author?.name) partes.push(limpar(e.author.name));
    if (e.title) partes.push(limpar(e.title));
    if (e.description) partes.push(limpar(e.description));
    for (const f of e.fields ?? []) {
      const nome = limpar(f.name ?? "");
      const valor = limpar(f.value ?? "");
      if (!nome && !valor) continue;
      partes.push(nome ? `${nome}: ${valor}` : valor);
      if (!jogadorId && /\b(passaporte|user[_ ]?id|id)\b/i.test(nome))
        jogadorId = valor.match(/\d{1,9}/)?.[0] ?? null;
      if (!jogadorNome && /\b(nome|jogador|player|personagem)\b/i.test(nome))
        jogadorNome = valor.slice(0, 120);
    }
    if (e.footer?.text) partes.push(limpar(e.footer.text));
  }
  const mensagem = partes.join("\n").slice(0, 8000) || "(log sem texto)";
  if (!jogadorId)
    jogadorId = mensagem.match(/\b(?:passaporte|user[_ ]?id|id)\b\D{0,4}(\d{1,9})/i)?.[1] ?? null;
  return { mensagem, jogadorId, jogadorNome };
}
