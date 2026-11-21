/**
 * Achar as logs de um ID (passaporte). O ID aparece de vários jeitos nas logs:
 * "#3", "#3 - Nome", "Passaporte: 3", "Id: 3", "Usuário: 3 - Nome"...
 * Cuidado: "#3" NÃO pode pegar "#396" — o número tem que acabar ali.
 */

/**
 * Filtro do banco (or= do Supabase). Cada log guarda em "ids" os IDs que ela menciona (migração
 * 20261228120000, mesma regra de logMencionaId), com índice: a busca é instantânea.
 */
export function filtroDoBancoPorId(pid: string): string {
  return `jogador_id.eq.${pid},ids.cs.{${Number(pid)}}`;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Confere de verdade se a log menciona o ID: "#3" ou "rótulo: 3" com o número terminando ali.
 * Rótulos aceitos: passaporte, id, usuário, jogador, responsável, player, vítima, alvo...
 */
export function logMencionaId(
  l: { jogador_id: string | null; mensagem: string },
  pid: string,
): boolean {
  if ((l.jogador_id ?? "").trim() === pid) return true;
  const n = escapar(pid);
  const re = new RegExp(
    [
      `#${n}(?!\\d)`, // "#3" (não pega "#396")
      `:\\s*#?${n}\\s+-\\s`, // "Qualquer rótulo: 3 - Nome"
      `\\b(?:passaporte|id|user[_ ]?id|usu[aá]rio|jogador|player|respons[aá]vel|v[ií]tima|alvo|m[eé]dic[oa]\\(?a?\\)?|paciente|admin|staff)\\s*:\\s*#?${n}(?!\\d)`,
    ].join("|"),
    "i",
  );
  return re.test(l.mensagem);
}

/** Divide [desde, agora] em pedaços iguais (do mais novo para o mais velho). */
export function pedacosDoPeriodo(desde: string, partes: number, agora = Date.now()): { de: string; ate: string | null }[] {
  const ini = new Date(desde).getTime();
  const passo = Math.max(1, (agora - ini) / Math.max(1, partes));
  const lista: { de: string; ate: string | null }[] = [];
  for (let i = 0; i < partes; i++) {
    const fim = agora - i * passo;
    const comeco = Math.max(ini, fim - passo);
    lista.push({ de: new Date(comeco).toISOString(), ate: i === 0 ? null : new Date(fim).toISOString() });
  }
  return lista;
}

type Resp = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/**
 * Busca em pedaços do período, todos ao mesmo tempo, e junta as mais novas. Com o período inteiro o
 * banco lê as 100 mil+ logs uma a uma (passa do limite de 8 s); em pedaços cada busca é pequena.
 */
export async function buscarEmPartes<T extends { id: number; criado_em: string }>(
  desde: string,
  partes: number,
  limite: number,
  buscar: (de: string, ate: string | null) => Resp,
): Promise<T[]> {
  const respostas = await Promise.all(pedacosDoPeriodo(desde, partes).map((p) => buscar(p.de, p.ate)));
  const vistos = new Set<number>();
  const todas: T[] = [];
  for (const r of respostas) {
    if (r.error) throw r.error;
    for (const l of (r.data ?? []) as T[]) {
      if (vistos.has(l.id)) continue;
      vistos.add(l.id);
      todas.push(l);
    }
  }
  return todas.sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, limite);
}
