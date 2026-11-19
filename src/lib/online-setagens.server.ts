/**
 * Online por setagem, calculado pelo SITE (sem pesar o servidor FiveM).
 *
 * O resource host_painel manda a lista de quem está online a cada ~10 min (com os grupos de cada
 * um). Nos horários de pico, o site conta quantos online têm cada setagem do Ilegal (Muni01,
 * Armas01...) e grava em set_online_log — a mesma tabela que a coluna PICO e o Histórico de Online
 * já usam:
 *   • 20h, 21h, 22h, 23h → o primeiro envio depois da hora cheia (até HH:12);
 *   • "00h" → o último envio antes da meia-noite (23:48–23:59), para fechar o conjunto do dia.
 * A coluna PICO mostra o maior desses números. Os grupos da polícia (Police, Civil e guarnições)
 * entram na mesma contagem, com a categoria "Guarnições" (aba /policia).
 */
import { GRUPOS_POLICIA } from "@/lib/policia";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export const HORAS_PICO = [20, 21, 22, 23] as const;

/** Hora e minuto em Brasília. */
export function horaBrasilia(agora = new Date()): { h: number; m: number } {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return { h, m };
}

/**
 * Em qual "hora de pico" este momento entra (ou null = fora das janelas).
 * modo "primeiro": só grava se ainda não gravou nesta janela; "ultimo": substitui (23:5x → 00h).
 */
export function janelaDePico(agora = new Date()): { hora: number; modo: "primeiro" | "ultimo" } | null {
  const { h, m } = horaBrasilia(agora);
  if (h === 23 && m >= 48) return { hora: 0, modo: "ultimo" };
  if ((HORAS_PICO as readonly number[]).includes(h) && m < 12) return { hora: h, modo: "primeiro" };
  return null;
}

/** "Muni01:2" → "muni01" (o nível do grupo não importa para a contagem). */
export const nomeDoGrupo = (g: string) => g.split(":")[0]!.trim().toLowerCase();

/** Conta, por setagem, quantos online têm o grupo dela. */
export function contarPorSetagem(
  setagens: string[],
  online: { grupos: string[] | null }[],
): Map<string, number> {
  const conta = new Map<string, number>(setagens.map((s) => [s.toLowerCase(), 0]));
  for (const p of online) {
    const vistos = new Set((p.grupos ?? []).map(nomeDoGrupo));
    for (const g of vistos) if (conta.has(g)) conta.set(g, (conta.get(g) ?? 0) + 1);
  }
  return conta;
}

/** Chamado pelo webhook de players quando chega a lista completa de online. */
export async function registrarOnlinePorSetagem(admin: Admin, agora = new Date()): Promise<number> {
  const janela = janelaDePico(agora);
  if (!janela) return 0;
  const limite = new Date(agora.getTime() - 15 * 60_000).toISOString();

  if (janela.modo === "primeiro") {
    const { data: ja } = await admin
      .from("set_online_log")
      .select("id")
      .eq("webhook", "faccoes")
      .eq("hour", janela.hora)
      .gte("captured_at", limite)
      .limit(1);
    if (ja && ja.length) return 0;
  }

  const [{ data: orgs }, { data: online }] = await Promise.all([
    admin.from("ilegal_orgs").select("setagem, organizacao"),
    admin.from("players").select("grupos").eq("online", true),
  ]);
  const lista = ((orgs ?? []) as { setagem: string; organizacao: string; categoria?: string }[])
    .filter((o) => o.setagem.trim())
    .map((o) => ({ ...o, categoria: o.setagem.trim().match(/^[A-Za-zÀ-ÿ]+/)?.[0] ?? "" }));
  // polícia: mesmos horários, categoria "Guarnições"
  const jaTem = new Set(lista.map((o) => o.setagem.trim().toLowerCase()));
  for (const g of GRUPOS_POLICIA)
    if (!jaTem.has(g.toLowerCase())) lista.push({ setagem: g, organizacao: g, categoria: "Guarnições" });
  const conta = contarPorSetagem(
    lista.map((o) => o.setagem.trim()),
    (online ?? []) as { grupos: string[] | null }[],
  );

  if (janela.modo === "ultimo") {
    await admin.from("set_online_log").delete().eq("webhook", "faccoes").eq("hour", 0).gte("captured_at", limite);
  }
  const quando = agora.toISOString();
  const linhas = lista.map((o) => ({
    webhook: "faccoes",
    category: o.categoria,
    set_name: o.setagem.trim(),
    set_label: o.organizacao ?? "",
    amount: conta.get(o.setagem.trim().toLowerCase()) ?? 0,
    hour: janela.hora,
    captured_at: quando,
  }));
  const { error } = await admin.from("set_online_log").insert(linhas as never);
  if (error) throw error;
  return linhas.length;
}
