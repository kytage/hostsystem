/**
 * Ordenação e filtros da tela Players (só no navegador, sem consulta extra).
 */
import type { Player } from "@/lib/players";
import { cargoDoPlayer, lerGrupos, type CargoId } from "@/lib/player-perfil";

export type Ordenacao =
  | "nome"
  | "dinheiro_desc"
  | "dinheiro_asc"
  | "banco_desc"
  | "carteira_desc"
  | "level_desc"
  | "level_asc"
  | "coins_desc"
  | "veiculos_desc"
  | "itens_desc"
  | "grupos_desc"
  | "login_recente"
  | "login_antigo"
  | "passaporte_asc"
  | "passaporte_desc";

export const ORDENACOES: { id: Ordenacao; rotulo: string }[] = [
  { id: "nome", rotulo: "Nome (A–Z)" },
  { id: "dinheiro_desc", rotulo: "Mais dinheiro (banco + carteira)" },
  { id: "dinheiro_asc", rotulo: "Menos dinheiro" },
  { id: "banco_desc", rotulo: "Mais dinheiro no banco" },
  { id: "carteira_desc", rotulo: "Mais dinheiro na carteira" },
  { id: "level_desc", rotulo: "Maior level" },
  { id: "level_asc", rotulo: "Menor level" },
  { id: "coins_desc", rotulo: "Mais Host Coins" },
  { id: "veiculos_desc", rotulo: "Mais veículos" },
  { id: "itens_desc", rotulo: "Mais itens no inventário" },
  { id: "grupos_desc", rotulo: "Mais grupos" },
  { id: "login_recente", rotulo: "Login mais recente" },
  { id: "login_antigo", rotulo: "Sumidos há mais tempo" },
  { id: "passaporte_asc", rotulo: "Passaporte (menor → maior)" },
  { id: "passaporte_desc", rotulo: "Passaporte (maior → menor)" },
];

export type FaixaLevel = "todos" | "0-19" | "20-49" | "50-99" | "100-199" | "200+";
export const FAIXAS_LEVEL: { id: FaixaLevel; rotulo: string; min: number; max: number }[] = [
  { id: "todos", rotulo: "Qualquer level", min: 0, max: Infinity },
  { id: "0-19", rotulo: "Level 0–19", min: 0, max: 19 },
  { id: "20-49", rotulo: "Level 20–49", min: 20, max: 49 },
  { id: "50-99", rotulo: "Level 50–99", min: 50, max: 99 },
  { id: "100-199", rotulo: "Level 100–199", min: 100, max: 199 },
  { id: "200+", rotulo: "Level 200+", min: 200, max: Infinity },
];

export type FaixaDinheiro = "todos" | "ate10k" | "10k" | "100k" | "1m" | "10m";
export const FAIXAS_DINHEIRO: { id: FaixaDinheiro; rotulo: string; min: number; max: number }[] = [
  { id: "todos", rotulo: "Qualquer valor", min: -Infinity, max: Infinity },
  { id: "ate10k", rotulo: "Até R$ 10 mil", min: -Infinity, max: 10_000 },
  { id: "10k", rotulo: "R$ 10 mil ou mais", min: 10_000, max: Infinity },
  { id: "100k", rotulo: "R$ 100 mil ou mais", min: 100_000, max: Infinity },
  { id: "1m", rotulo: "R$ 1 milhão ou mais", min: 1_000_000, max: Infinity },
  { id: "10m", rotulo: "R$ 10 milhões ou mais", min: 10_000_000, max: Infinity },
];

export interface FiltrosExtras {
  ordenacao: Ordenacao;
  /** "todos", "sem" (sem cargo VIP) ou o id do cargo do topo. */
  cargo: "todos" | "sem" | CargoId;
  whitelist: "todas" | "ativa" | "nolist" | "sem_dado";
  level: FaixaLevel;
  dinheiro: FaixaDinheiro;
  veiculos: "todos" | "com" | "sem";
}

export const FILTROS_PADRAO: FiltrosExtras = {
  ordenacao: "nome",
  cargo: "todos",
  whitelist: "todas",
  level: "todos",
  dinheiro: "todos",
  veiculos: "todos",
};

export const dinheiroTotal = (p: Pick<Player, "banco" | "carteira">) => (p.banco || 0) + (p.carteira || 0);
const qtdItens = (p: Player) => p.inventario.reduce((s, i) => s + (i.qtd || 0), 0);
const tempo = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
const passaporteNum = (p: Player) => Number(p.passaporte) || Number.MAX_SAFE_INTEGER;

/** Quantos filtros extras estão ligados (para o botão "Limpar"). */
export function filtrosLigados(f: FiltrosExtras): number {
  return (
    Number(f.cargo !== "todos") +
    Number(f.whitelist !== "todas") +
    Number(f.level !== "todos") +
    Number(f.dinheiro !== "todos") +
    Number(f.veiculos !== "todos")
  );
}

export function passaNosFiltros(p: Player, f: FiltrosExtras): boolean {
  if (f.cargo !== "todos") {
    const c = cargoDoPlayer(lerGrupos(p.grupos))?.id ?? "sem";
    if (c !== f.cargo) return false;
  }
  if (f.whitelist === "ativa" && p.whitelist !== true) return false;
  if (f.whitelist === "nolist" && p.whitelist !== false) return false;
  if (f.whitelist === "sem_dado" && p.whitelist !== null) return false;
  const lv = FAIXAS_LEVEL.find((x) => x.id === f.level)!;
  if (p.level < lv.min || p.level > lv.max) return false;
  const din = FAIXAS_DINHEIRO.find((x) => x.id === f.dinheiro)!;
  const total = dinheiroTotal(p);
  if (total < din.min || total > din.max) return false;
  if (f.veiculos === "com" && p.veiculos.length === 0) return false;
  if (f.veiculos === "sem" && p.veiculos.length > 0) return false;
  return true;
}

export function ordenarPlayers(lista: Player[], o: Ordenacao): Player[] {
  const porNome = (a: Player, b: Player) => a.nome.localeCompare(b.nome, "pt-BR");
  const cmp: Record<Ordenacao, (a: Player, b: Player) => number> = {
    nome: porNome,
    dinheiro_desc: (a, b) => dinheiroTotal(b) - dinheiroTotal(a),
    dinheiro_asc: (a, b) => dinheiroTotal(a) - dinheiroTotal(b),
    banco_desc: (a, b) => b.banco - a.banco,
    carteira_desc: (a, b) => b.carteira - a.carteira,
    level_desc: (a, b) => b.level - a.level || b.xp - a.xp,
    level_asc: (a, b) => a.level - b.level || a.xp - b.xp,
    coins_desc: (a, b) => b.host_coins - a.host_coins,
    veiculos_desc: (a, b) => b.veiculos.length - a.veiculos.length,
    itens_desc: (a, b) => qtdItens(b) - qtdItens(a),
    grupos_desc: (a, b) => b.grupos.length - a.grupos.length,
    login_recente: (a, b) => Number(b.online) - Number(a.online) || tempo(b.ultimo_login) - tempo(a.ultimo_login),
    login_antigo: (a, b) => tempo(a.ultimo_login) - tempo(b.ultimo_login),
    passaporte_asc: (a, b) => passaporteNum(a) - passaporteNum(b),
    passaporte_desc: (a, b) => passaporteNum(b) - passaporteNum(a),
  };
  return [...lista].sort((a, b) => cmp[o](a, b) || porNome(a, b));
}
