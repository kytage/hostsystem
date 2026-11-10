/**
 * Regras e textos compartilhados entre o painel do líder (/lider), a página de
 * convite (/convite/<slug>), a gestão na aba Ilegal e as funções do servidor.
 * Este arquivo roda no navegador e no servidor: não importe nada de lá nem de cá.
 */

/** Nome da temporada. Trocar aqui muda o painel, o convite e a arte dos stories. */
export const ATO = "ATO 3";

/** Meta do painel: de 0 a 100 pessoas por organização. */
export const LIMITE_MEMBROS = 100;

export type Cargo = "lider" | "gerente" | "membro";

export const CARGOS: { id: Cargo; label: string; plural: string }[] = [
  { id: "lider", label: "Líder", plural: "Líderes" },
  { id: "gerente", label: "Gerente", plural: "Gerentes" },
  { id: "membro", label: "Membro", plural: "Membros" },
];

export const cargoLabel = (cargo: string): string => CARGOS.find((c) => c.id === cargo)?.label ?? "Membro";

export interface OrgMembro {
  id: string;
  nome: string;
  discord: string;
  passaporte: string;
  cargo: Cargo;
  /** Identificador do link de afiliação: /convite/<slug> */
  slug: string;
  /** Quantas pessoas abriram o link deste membro. */
  visitas: number;
  /** Quantas clicaram no botão de entrar na cidade. */
  cliques: number;
  created_at: string;
}

/** O que o líder enxerga do próprio painel. */
export interface OrgPainelLider {
  nome: string;
  setagem: string;
  lider_nome: string;
  link_destino: string;
}

export interface PainelDados {
  painel: OrgPainelLider;
  membros: OrgMembro[];
}

/** Etapas da meta: cada faixa de tamanho da organização ganha um nome. */
export const PATENTES = [
  { min: 0, nome: "Início" },
  { min: 10, nome: "Bonde" },
  { min: 25, nome: "Tropa" },
  { min: 50, nome: "Facção" },
  { min: 75, nome: "Cartel" },
  { min: 100, nome: "Império" },
] as const;

export type Patente = (typeof PATENTES)[number];

export function patente(total: number): { atual: Patente; proxima: Patente | null; faltam: number } {
  let atual: Patente = PATENTES[0];
  let proxima: Patente | null = null;
  for (const p of PATENTES) {
    if (total >= p.min) atual = p;
    else {
      proxima = p;
      break;
    }
  }
  return { atual, proxima, faltam: proxima ? proxima.min - total : 0 };
}

/** Referência simples de estrutura: 1 gerente para cada 10 membros. */
export const gerentesRecomendados = (membros: number): number => Math.ceil(membros / 10);

/* ------------------------------------------------------------------ *
 * Código de acesso e link de afiliação
 * ------------------------------------------------------------------ */

// 32 símbolos sem letras/números que se confundem (I, O, 0, 1 / l, o).
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALFABETO_SLUG = "abcdefghijkmnpqrstuvwxyz23456789";

function aleatorio(tamanho: number, alfabeto: string): string {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  let out = "";
  // 256 é múltiplo de 32, então o resto da divisão não favorece nenhum símbolo.
  for (const b of bytes) out += alfabeto.charAt(b % alfabeto.length);
  return out;
}

/** Código do líder, no formato HOST-XXXXX-XXXXX. */
export function gerarCodigo(): string {
  const s = aleatorio(10, ALFABETO_CODIGO);
  return `HOST-${s.slice(0, 5)}-${s.slice(5)}`;
}

export function gerarSlug(): string {
  return aleatorio(10, ALFABETO_SLUG);
}

/**
 * Aceita o código digitado de qualquer jeito (minúsculas, sem traço, sem o
 * "HOST" da frente) e devolve no formato oficial; null quando não é um código.
 */
export function normalizarCodigo(entrada: string): string | null {
  let s = entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("HOST")) s = s.slice(4);
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(s)) return null;
  return `HOST-${s.slice(0, 5)}-${s.slice(5)}`;
}

export const linkConvite = (origin: string, slug: string): string => `${origin}/convite/${slug}`;

/** O código vai depois do "#": essa parte do endereço não é enviada a nenhum servidor. */
export const linkPainel = (origin: string, codigo: string): string => `${origin}/lider#${codigo}`;

/** Só aceitamos destinos http(s) no botão de entrar. */
export const urlSegura = (url: string): boolean => /^https?:\/\/[^\s]+$/i.test(url.trim());

/** Texto da lista da organização, pronto para colar no Discord. */
export function listaParaDiscord(orgNome: string, membros: OrgMembro[]): string {
  const linhas = [`**${orgNome} — ${ATO} (${membros.length}/${LIMITE_MEMBROS})**`];
  for (const cargo of CARGOS) {
    const doCargo = membros.filter((m) => m.cargo === cargo.id);
    if (doCargo.length === 0) continue;
    linhas.push("", `**${cargo.plural} (${doCargo.length})**`);
    for (const m of doCargo) {
      const extras = [m.passaporte ? `#${m.passaporte}` : "", m.discord ? `@${m.discord.replace(/^@/, "")}` : ""].filter(Boolean);
      linhas.push(`• ${m.nome}${extras.length ? ` — ${extras.join(" · ")}` : ""}`);
    }
  }
  return linhas.join("\n");
}
