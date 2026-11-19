/**
 * Canais que o site lê direto do Discord com o bot (em vez da cópia feita no servidor).
 *
 * São os canais dos scripts protegidos/criptografados: eles detectam a cópia (host_logs/copia.lua)
 * como tentativa de quebrar o script e param de funcionar. Para esses, o servidor não copia mais
 * nada; o bot do Discord lê as mensagens e o site grava. Nesses canais a cópia antiga é ignorada,
 * para nunca gravar a mesma log duas vezes.
 *
 * - anti-cheat: PL_PROTECT (manda direto para o Discord)
 * - battle-royale / competitive: core-battleroyale / core-competitive (ofuscados)
 * - mdt: heyy_mdt (ofuscado) · banco: jester/bank (ofuscado) · celular: jester/smartphone (ofuscado)
 */
export const CATEGORIAS_DO_BOT = [
  "anti-cheat",
  "battle-royale",
  "competitive",
  "mdt",
  "banco",
  "celular",
] as const;

/** Categorias em que o bot puxa as últimas mensagens na primeira leitura (as outras começam de agora). */
export const CATEGORIAS_COM_HISTORICO = new Set<string>(["anti-cheat"]);

const categorias = new Set<string>(CATEGORIAS_DO_BOT);

/** true = este canal do site ("categoria/canal") é lido pelo bot. */
export function lidoPeloBot(canal: string): boolean {
  return categorias.has(canal.split("/")[0] ?? "");
}
