/**
 * Achar as logs de um ID (passaporte). O ID aparece de vários jeitos nas logs:
 * "#3", "#3 - Nome", "Passaporte: 3", "Id: 3", "Usuário: 3 - Nome"...
 * Cuidado: "#3" NÃO pode pegar "#396" — o número tem que acabar ali.
 */

/** Filtro do banco (or= do Supabase): pré-seleção larga, mas já sem os prefixos. */
export function filtroDoBancoPorId(pid: string): string {
  return [
    `jogador_id.eq.${pid}`,
    `mensagem.ilike.%#${pid} %`,
    `mensagem.ilike.%#${pid}-%`,
    // (sem padrão com vírgula: ela separa os filtros do or= e quebra a busca)
    `mensagem.ilike.%#${pid}\n%`,
    `mensagem.ilike.%#${pid}`,
    `mensagem.ilike.%: ${pid} -%`,
    `mensagem.ilike.%: ${pid}\n%`,
    `mensagem.ilike.%: ${pid}`,
  ].join(",");
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
