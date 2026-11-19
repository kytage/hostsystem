import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORIAS_COM_HISTORICO, lidoPeloBot } from "@/lib/logs-bot";

/**
 * Bot de logs do Discord → site. Lê os canais dos scripts que não podem usar a cópia do servidor
 * (Anti-Cheat/PL_PROTECT e os scripts criptografados — lista em src/lib/logs-bot.ts) e copia as
 * mensagens novas. Só os canais dessa lista são lidos.
 *
 * - O token do bot fica em server_logs_config (chave "anticheat_bot_token"), que só o servidor lê.
 * - Onde parou em cada canal fica em "anticheat_cursor:<id do canal>" (id da última mensagem).
 * - A leitura roda enquanto alguém está com /logs aberto (a cada 30s) e, se ficou um tempo sem
 *   ninguém, recupera as mensagens perdidas na próxima abertura (o Discord guarda o histórico).
 */

const CHAVE_TOKEN = "anticheat_bot_token";
const CHAVE_TRAVA = "anticheat_sync";
const INTERVALO_MIN_MS = 20_000;
/** Primeira leitura de um canal: só as últimas mensagens (não copia anos de histórico). */
const PRIMEIRA_LEITURA = 50;
/** Recuperação por canal em uma rodada (100 por página do Discord). */
const MAX_PAGINAS = 5;

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

interface MsgDiscord {
  id: string;
  content?: string;
  timestamp: string;
  author?: { username?: string; global_name?: string | null };
  embeds?: Record<string, unknown>[];
  mentions?: { id: string; username?: string; global_name?: string | null }[];
}

async function lerConfig(admin: Admin, chave: string) {
  const { data } = await admin.from("server_logs_config").select("valor").eq("chave", chave).maybeSingle();
  return data?.valor ?? null;
}

async function gravarConfig(admin: Admin, chave: string, valor: string) {
  await admin
    .from("server_logs_config")
    .upsert({ chave, valor, atualizado_em: new Date().toISOString() });
}

/** Só uma leitura por vez (e no máximo a cada 20s), mesmo com várias pessoas na tela. */
async function pegarVez(admin: Admin): Promise<boolean> {
  const agora = new Date();
  const { data: linha } = await admin
    .from("server_logs_config")
    .select("atualizado_em")
    .eq("chave", CHAVE_TRAVA)
    .maybeSingle();
  if (!linha) {
    const { error } = await admin
      .from("server_logs_config")
      .insert({ chave: CHAVE_TRAVA, valor: "", atualizado_em: agora.toISOString() });
    return !error;
  }
  const limite = new Date(agora.getTime() - INTERVALO_MIN_MS).toISOString();
  const { data } = await admin
    .from("server_logs_config")
    .update({ atualizado_em: agora.toISOString() })
    .eq("chave", CHAVE_TRAVA)
    .lt("atualizado_em", limite)
    .select("chave");
  return (data ?? []).length > 0;
}

async function discord<T>(token: string, caminho: string): Promise<{ ok: true; dados: T } | { ok: false; status: number }> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetch(`https://discord.com/api/v10${caminho}`, {
      headers: { Authorization: `Bot ${token}` },
    }).catch(() => null);
    if (!r) return { ok: false, status: 0 };
    if (r.status === 429 && tentativa === 0) {
      const espera = Number((await r.json().catch(() => ({})) as { retry_after?: number }).retry_after ?? 1);
      await new Promise((res) => setTimeout(res, Math.min(espera, 5) * 1000));
      continue;
    }
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, dados: (await r.json()) as T };
  }
  return { ok: false, status: 429 };
}

/** Troca <@123> pelo @nome de quem foi mencionado (o PL_PROTECT marca o Discord do jogador). */
function trocarMencoes(texto: string, m: MsgDiscord) {
  const nomes = new Map((m.mentions ?? []).map((u) => [u.id, u.global_name || u.username || u.id]));
  return texto.replace(/<@!?(\d+)>/g, (_, id: string) => `@${nomes.get(id) ?? id}`);
}

function trocarNoEmbed(e: Record<string, unknown>, m: MsgDiscord): Record<string, unknown> {
  const t = (v: unknown) => (typeof v === "string" ? trocarMencoes(v, m) : v);
  const fields = Array.isArray(e["fields"])
    ? (e["fields"] as Record<string, unknown>[]).map((f) => ({ ...f, name: t(f["name"]), value: t(f["value"]) }))
    : e["fields"];
  return { ...e, title: t(e["title"]), description: t(e["description"]), fields };
}

async function lerCanal(
  admin: Admin,
  token: string,
  canalDiscord: string,
  canalSite: string,
): Promise<{ novas: number; erro?: number }> {
  const { lerMensagemDoDiscord } = await import("@/lib/logs-servidor.server");
  const chaveCursor = `anticheat_cursor:${canalDiscord}`;
  let cursor = await lerConfig(admin, chaveCursor);
  let novas = 0;

  // canal novo sem histórico: só marca onde está agora (o que veio antes já chegou pela cópia antiga)
  if (!cursor && !CATEGORIAS_COM_HISTORICO.has(canalSite.split("/")[0] ?? "")) {
    const r = await discord<MsgDiscord[]>(token, `/channels/${canalDiscord}/messages?limit=1`);
    if (!r.ok) return { novas, erro: r.status };
    await gravarConfig(admin, chaveCursor, r.dados[0]?.id ?? "0");
    return { novas };
  }

  for (let pagina = 0; pagina < (cursor ? MAX_PAGINAS : 1); pagina++) {
    const caminho = cursor
      ? `/channels/${canalDiscord}/messages?after=${cursor}&limit=100`
      : `/channels/${canalDiscord}/messages?limit=${PRIMEIRA_LEITURA}`;
    const r = await discord<MsgDiscord[]>(token, caminho);
    if (!r.ok) return { novas, erro: r.status };
    // o Discord devolve da mais nova para a mais antiga: grava na ordem em que aconteceram
    const msgs = [...r.dados].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    if (msgs.length === 0) break;

    const linhas = msgs.map((m) => {
      const payload = {
        content: m.content ? trocarMencoes(m.content, m) : "",
        username: m.author?.global_name || m.author?.username || "",
        embeds: (m.embeds ?? []).map((e) => trocarNoEmbed(e, m)),
        discord_message_id: m.id,
      };
      const { mensagem, jogadorId, jogadorNome } = lerMensagemDoDiscord(payload);
      return {
        canal: canalSite,
        jogador_id: jogadorId,
        jogador_nome: jogadorNome,
        mensagem,
        dados: payload as never,
        criado_em: m.timestamp,
      };
    });
    const { error } = await admin.from("server_logs").insert(linhas);
    if (error) return { novas, erro: 500 };
    novas += linhas.length;
    cursor = msgs[msgs.length - 1]!.id;
    await gravarConfig(admin, chaveCursor, cursor);
    if (msgs.length < 100) break;
  }
  return { novas };
}

/** Lê os canais do Anti-Cheat no Discord e copia as mensagens novas para as logs do site. */
export const sincronizarAntiCheat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: equipe } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .limit(1);
    if (!equipe?.length) return { ok: false as const, motivo: "sem-permissao" };

    const token = await lerConfig(supabaseAdmin, CHAVE_TOKEN);
    if (!token) return { ok: false as const, motivo: "sem-token" };
    if (!(await pegarVez(supabaseAdmin))) return { ok: true as const, novas: 0, pulou: true };

    const { CANAL_DO_DISCORD } = await import("@/lib/logs-servidor");
    const canais = [...CANAL_DO_DISCORD.entries()].filter(([, site]) => lidoPeloBot(site));
    let novas = 0;
    const erros: number[] = [];
    // poucos por vez para não estourar o limite do Discord
    for (let i = 0; i < canais.length; i += 4) {
      const lote = await Promise.all(
        canais.slice(i, i + 4).map(([d, s]) => lerCanal(supabaseAdmin, token, d, s)),
      );
      for (const r of lote) {
        novas += r.novas;
        if (r.erro) erros.push(r.erro);
      }
    }
    return { ok: true as const, novas, erros: [...new Set(erros)] };
  });

/** Founder: salva/troca o token do bot que lê o Anti-Cheat e testa se ele enxerga os canais. */
export const salvarTokenBotAntiCheat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().trim().min(50).max(120).regex(/^[\w.-]+$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "founder"))
      throw new Error("Só o Founder pode configurar o bot do Anti-Cheat.");

    const eu = await discord<{ username: string }>(data.token, "/users/@me");
    if (!eu.ok) throw new Error("Token inválido: o Discord recusou esse token de bot.");

    const { CANAL_DO_DISCORD } = await import("@/lib/logs-servidor");
    const primeiro = [...CANAL_DO_DISCORD.entries()].find(([, s]) => s.startsWith("anti-cheat/"));
    if (primeiro) {
      const teste = await discord<unknown[]>(data.token, `/channels/${primeiro[0]}/messages?limit=1`);
      if (!teste.ok)
        throw new Error(
          teste.status === 403
            ? `O bot ${eu.dados.username} não tem acesso aos canais do Anti-Cheat. Dê a ele "Ver canais" e "Ler histórico de mensagens" na categoria Anti-Cheat.`
            : `O bot ${eu.dados.username} não conseguiu ler o canal (erro ${teste.status}). Ele foi convidado para o servidor Host - Logs?`,
        );
    }
    await gravarConfig(supabaseAdmin, CHAVE_TOKEN, data.token);
    return { ok: true, bot: eu.dados.username };
  });

/** Founder: diz se o bot já está configurado (sem mostrar o token). */
export const statusBotAntiCheat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { configurado: !!(await lerConfig(supabaseAdmin, CHAVE_TOKEN)) };
  });

/** Founder: testa em quais canais lidos pelo bot ele ainda NÃO tem acesso (para liberar no Discord). */
export const verificarAcessoBot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "founder")) throw new Error("Só o Founder pode ver isso.");
    const token = await lerConfig(supabaseAdmin, CHAVE_TOKEN);
    if (!token) return { configurado: false, total: 0, semAcesso: [] as string[] };
    const { CANAL_DO_DISCORD } = await import("@/lib/logs-servidor");
    const canais = [...CANAL_DO_DISCORD.entries()].filter(([, site]) => lidoPeloBot(site));
    const semAcesso: string[] = [];
    for (let i = 0; i < canais.length; i += 5) {
      const lote = await Promise.all(
        canais.slice(i, i + 5).map(async ([id, site]) => {
          const r = await discord<unknown[]>(token, `/channels/${id}/messages?limit=1`);
          return r.ok ? null : site;
        }),
      );
      semAcesso.push(...lote.filter((x): x is string => !!x));
    }
    return { configurado: true, total: canais.length, semAcesso };
  });
