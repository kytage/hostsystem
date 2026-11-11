/**
 * Partidas online da praça do HOKI: jogo da velha (desafio entre duas pessoas)
 * e Mau-Mau (jogo de cartas de descarte, em salas abertas para a equipe).
 * O estado de cada partida fica em uma linha de `hoshi_jogos`; toda jogada
 * confere a versão lida, então duas jogadas ao mesmo tempo não se atropelam.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface Pessoa {
  id: string;
  nome: string;
}

/* ---------------- jogo da velha ---------------- */

export type Marca = "x" | "o";
export interface Velha {
  x: Pessoa;
  o: Pessoa;
  tab: (Marca | null)[];
  vez: Marca;
  vencedor: Marca | "empate" | null;
}

const LINHAS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export function linhaVencedora(tab: (Marca | null)[]): number[] | null {
  return LINHAS.find(([a, b, c]) => tab[a!] && tab[a!] === tab[b!] && tab[a!] === tab[c!]) ?? null;
}
export function jogarVelha(e: Velha, casa: number, quem: string): Velha | null {
  if (e.vencedor || e.tab[casa] || e[e.vez].id !== quem) return null;
  const tab = e.tab.slice();
  tab[casa] = e.vez;
  const venceu = linhaVencedora(tab);
  return {
    ...e,
    tab,
    vez: e.vez === "x" ? "o" : "x",
    vencedor: venceu ? e.vez : tab.every(Boolean) ? "empate" : null,
  };
}

/* ---------------- Mau-Mau (cartas) ---------------- */

/** Naipes do baralho da HOST: vermelho, ouro, prata e grafite. "x" é curinga. */
export type Naipe = "v" | "o" | "p" | "g";
export const NAIPES: { id: Naipe; nome: string; cor: string; texto: string }[] = [
  { id: "v", nome: "Vermelho", cor: "#ce0e0e", texto: "#ffffff" },
  { id: "o", nome: "Ouro", cor: "#e0ad3a", texto: "#0a0a0a" },
  { id: "p", nome: "Prata", cor: "#e8e8e8", texto: "#0a0a0a" },
  { id: "g", nome: "Grafite", cor: "#3d3d3d", texto: "#ffffff" },
];
export interface Carta {
  id: number;
  n: Naipe | "x";
  /** "1".."9", "pula", "volta", "+2", "curinga" ou "+4" */
  v: string;
}
export interface Cartas {
  dono: string;
  jogadores: Pessoa[];
  maos: Record<string, Carta[]>;
  monte: Carta[];
  mesa: Carta | null;
  naipe: Naipe;
  vez: number;
  sentido: 1 | -1;
  vencedor: string | null;
  aviso: string;
}
export const MAX_JOGADORES = 8;

const embaralhar = <T>(l: T[]) => {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

function baralho(): Carta[] {
  const cartas: Omit<Carta, "id">[] = [];
  for (const { id: n } of NAIPES) {
    for (let k = 1; k <= 9; k++) cartas.push({ n, v: String(k) }, { n, v: String(k) });
    for (const v of ["pula", "volta", "+2"]) cartas.push({ n, v }, { n, v });
  }
  for (let k = 0; k < 4; k++) cartas.push({ n: "x", v: "curinga" }, { n: "x", v: "+4" });
  return embaralhar(cartas).map((c, id) => ({ ...c, id }));
}

export const salaNova = (dono: Pessoa): Cartas => ({
  dono: dono.id,
  jogadores: [dono],
  maos: {},
  monte: [],
  mesa: null,
  naipe: "v",
  vez: 0,
  sentido: 1,
  vencedor: null,
  aviso: "",
});

export function comecarCartas(e: Cartas): Cartas {
  const monte = baralho();
  const maos: Record<string, Carta[]> = {};
  for (const j of e.jogadores) maos[j.id] = monte.splice(0, 7);
  // a primeira carta da mesa é sempre um número
  const i = monte.findIndex((c) => c.n !== "x" && /^\d$/.test(c.v));
  const [mesa] = monte.splice(i, 1);
  return {
    ...e,
    maos,
    monte,
    mesa: mesa ?? null,
    naipe: (mesa?.n ?? "v") as Naipe,
    vez: 0,
    sentido: 1,
    vencedor: null,
    aviso: "Partida começou!",
  };
}

export const podeJogar = (e: Cartas, c: Carta) =>
  c.n === "x" || c.n === e.naipe || c.v === e.mesa?.v;

const proximo = (e: Pick<Cartas, "jogadores" | "sentido">, de: number, passos = 1) => {
  const n = e.jogadores.length;
  return (((de + e.sentido * passos) % n) + n) % n;
};

/** Tira cartas do monte; quando acaba, o monte ganha um baralho novo embaralhado. */
function comprarDoMonte(monte: Carta[], qtd: number): [Carta[], Carta[]] {
  let m = monte.slice();
  if (m.length < qtd)
    m = m.concat(
      baralho().map((c) => ({ ...c, id: c.id + 1000 + Math.floor(Math.random() * 1e6) })),
    );
  return [m.slice(0, qtd), m.slice(qtd)];
}

export function jogarCarta(
  e: Cartas,
  quem: string,
  cartaId: number,
  naipeEscolhido?: Naipe,
): Cartas | null {
  const atual = e.jogadores[e.vez];
  if (e.vencedor || !atual || atual.id !== quem) return null;
  const mao = e.maos[quem] ?? [];
  const carta = mao.find((c) => c.id === cartaId);
  if (!carta || !podeJogar(e, carta)) return null;
  if (carta.n === "x" && !naipeEscolhido) return null;

  const maos = { ...e.maos, [quem]: mao.filter((c) => c.id !== cartaId) };
  let { sentido, monte } = e;
  let pular = 1;
  let aviso = `${atual.nome} jogou.`;
  if (carta.v === "volta") {
    sentido = (sentido * -1) as 1 | -1;
    if (e.jogadores.length === 2) pular = 2;
    aviso = `${atual.nome} inverteu o sentido.`;
  }
  const alvo = e.jogadores[proximo({ jogadores: e.jogadores, sentido }, e.vez)]!;
  if (carta.v === "pula") {
    pular = 2;
    aviso = `${alvo.nome} foi pulado.`;
  }
  if (carta.v === "+2" || carta.v === "+4") {
    const qtd = carta.v === "+2" ? 2 : 4;
    const [compradas, resto] = comprarDoMonte(monte, qtd);
    monte = resto;
    maos[alvo.id] = [...(maos[alvo.id] ?? []), ...compradas];
    pular = 2;
    aviso = `${alvo.nome} comprou ${qtd} e perdeu a vez.`;
  }
  const venceu = maos[quem]!.length === 0;
  return {
    ...e,
    maos,
    monte,
    sentido,
    mesa: carta,
    naipe: carta.n === "x" ? naipeEscolhido! : carta.n,
    vez: venceu ? e.vez : proximo({ jogadores: e.jogadores, sentido }, e.vez, pular),
    vencedor: venceu ? quem : null,
    aviso: venceu ? `${atual.nome} venceu!` : aviso,
  };
}

/** Sem carta para jogar: compra uma e passa a vez. */
export function comprarCarta(e: Cartas, quem: string): Cartas | null {
  const atual = e.jogadores[e.vez];
  if (e.vencedor || !atual || atual.id !== quem) return null;
  const [compradas, monte] = comprarDoMonte(e.monte, 1);
  return {
    ...e,
    monte,
    maos: { ...e.maos, [quem]: [...(e.maos[quem] ?? []), ...compradas] },
    vez: proximo(e, e.vez),
    aviso: `${atual.nome} comprou uma carta.`,
  };
}

/** Alguém saiu no meio: tira a pessoa e devolve as cartas dela ao monte. */
export function sairDasCartas(e: Cartas, quem: string): Cartas {
  const i = e.jogadores.findIndex((j) => j.id === quem);
  if (i < 0) return e;
  const jogadores = e.jogadores.filter((j) => j.id !== quem);
  const { [quem]: devolvidas = [], ...maos } = e.maos;
  let vez = e.vez;
  if (i < vez) vez--;
  if (vez >= jogadores.length) vez = 0;
  const sobrou = jogadores.length === 1 && e.mesa ? jogadores[0]!.id : null;
  return {
    ...e,
    jogadores,
    maos,
    monte: [...e.monte, ...devolvidas],
    vez,
    dono: e.dono === quem ? (jogadores[0]?.id ?? e.dono) : e.dono,
    vencedor: e.vencedor ?? sobrou,
    aviso: "Um jogador saiu.",
  };
}

/* ---------------- banco ---------------- */

export interface Jogo<T = unknown> {
  id: string;
  tipo: "velha" | "cartas" | "dama" | "ligue4" | "ppt" | "festa";
  status: "aberto" | "jogando" | "fim";
  estado: T;
  versao: number;
  criado_por: string;
  updated_at: string;
}
const COLUNAS = "id, tipo, status, estado, versao, criado_por, updated_at";

/** Partidas em aberto ou em andamento nas últimas 3 horas. */
export async function jogosAtivos(): Promise<Jogo[]> {
  const desde = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("hoshi_jogos")
    .select(COLUNAS)
    .neq("status", "fim")
    .gte("updated_at", desde)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as Jogo[];
}

export async function buscarJogo(id: string): Promise<Jogo | null> {
  const { data, error } = await supabase
    .from("hoshi_jogos")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Jogo | null;
}

export async function criarJogo(tipo: Jogo["tipo"], estado: object): Promise<Jogo> {
  const { data, error } = await supabase
    .from("hoshi_jogos")
    .insert({ tipo, estado: estado as unknown as Json })
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return data as Jogo;
}

/** Grava o novo estado só se ninguém jogou antes; devolve false quando perdeu a corrida. */
export async function gravarJogo(
  jogo: Pick<Jogo, "id" | "versao">,
  estado: object,
  status: Jogo["status"],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("hoshi_jogos")
    .update({
      estado: estado as unknown as Json,
      status,
      versao: jogo.versao + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jogo.id)
    .eq("versao", jogo.versao)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function apagarJogo(id: string): Promise<void> {
  await supabase.from("hoshi_jogos").delete().eq("id", id);
}

/**
 * Lê a partida, aplica a jogada e grava. Se outra pessoa jogou no meio do
 * caminho, lê de novo e tenta outra vez. `fn` devolve null quando a jogada não vale.
 */
export async function mutarJogo<T extends object>(
  id: string,
  fn: (e: T, j: Jogo<T>) => { estado: T; status: Jogo["status"] } | null,
): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const j = (await buscarJogo(id)) as Jogo<T> | null;
    if (!j) return false;
    const r = fn(j.estado, j);
    if (!r) return false;
    if (await gravarJogo(j, r.estado, r.status)) return true;
  }
  return false;
}
