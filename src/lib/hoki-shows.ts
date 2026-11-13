/**
 * Eventos do Founder na praça do HOKI ("shows"): o Founder escolhe um evento e
 * todo mundo que está acordado na praça participa ao mesmo tempo.
 *
 * Só viaja pela rede o tipo, quem participa e um número de sorteio (semente).
 * Cada computador monta a coreografia sozinho a partir disso, então todo mundo
 * vê a mesma coisa sem precisar trocar mensagens durante o evento.
 */
export type TipoShow =
  "trovao" | "aviao" | "mergulho" | "batata" | "trenzinho" | "baile" | "fogos" | "gigantes";

export interface Show {
  tipo: TipoShow;
  /** Quem participa (ids, na ordem que o Founder mandou). */
  ids: string[];
  semente: number;
  /** Quem mandou (o banco confere se é Founder). */
  de: string;
}

export interface InfoShow {
  id: TipoShow;
  nome: string;
  emoji: string;
  texto: string;
  /** Mínimo de pessoas acordadas na praça para começar. */
  minimo: number;
}

export const SHOWS: InfoShow[] = [
  {
    id: "trovao",
    nome: "Trovão",
    emoji: "⚡",
    texto: "Um raio cai na praça e a tela de todo mundo treme por 5 s.",
    minimo: 0,
  },
  {
    id: "aviao",
    nome: "Passeio de avião",
    emoji: "✈️",
    texto: "Todos vão para a beira da ilha, embarcam e dão uma volta no mapa.",
    minimo: 1,
  },
  {
    id: "mergulho",
    nome: "Mergulho na fonte",
    emoji: "💦",
    texto: "Todos correm para a fonte do meio e pulam na água.",
    minimo: 1,
  },
  {
    id: "batata",
    nome: "Batata quente",
    emoji: "🥔",
    texto: "A batata passa de mão em mão; quem estiver com ela quando estourar congela por 60 s.",
    minimo: 2,
  },
  {
    id: "trenzinho",
    nome: "Trenzinho",
    emoji: "🚂",
    texto: "Todos fazem fila atrás de você e dão voltas em torno da fonte.",
    minimo: 1,
  },
  {
    id: "baile",
    nome: "Baile da praça",
    emoji: "🕺",
    texto: "Globo de luz na fonte e todo mundo dançando junto.",
    minimo: 1,
  },
  {
    id: "fogos",
    nome: "Fogos de artifício",
    emoji: "🎆",
    texto: "Queima de fogos no céu da praça; todos param para comemorar.",
    minimo: 0,
  },
  {
    id: "gigantes",
    nome: "Gigantes",
    emoji: "🦖",
    texto: "Todo mundo fica gigante por 20 s.",
    minimo: 1,
  },
];
export const infoDoShow = (t: TipoShow) => SHOWS.find((s) => s.id === t);
export const TIPOS_SHOW = SHOWS.map((s) => s.id);

/** Sorteio repetível: a mesma semente dá a mesma sequência em todos os computadores. */
export function sorteio(semente: number) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- batata quente ---------------- */

/** Quanto tempo quem explodiu fica congelado. */
export const CONGELA_S = 60;
/** Tempo para todos chegarem na roda antes da primeira rodada. */
export const BATATA_ENTRADA_S = 4;
/** Quanto a batata leva no ar de uma mão para outra. */
export const BATATA_VOO_S = 0.42;

export interface RodadaBatata {
  inicio: number;
  /** Quem começa com a batata. */
  primeiro: string;
  /** Cada passe: quando sai da mão e para quem vai. */
  passes: { t: number; de: string; para: string }[];
  explode: number;
  eliminado: string;
}
export interface Batata {
  rodadas: RodadaBatata[];
  vencedor: string | null;
  /** Quando o evento termina (segundos desde o começo). */
  fim: number;
}

/**
 * Monta a partida inteira: em cada rodada a batata pula entre quem ainda está
 * no jogo e estoura num momento sorteado; quem estiver com ela é eliminado.
 * Repete até sobrar uma pessoa.
 */
export function gerarBatata(ids: string[], semente: number): Batata {
  const r = sorteio(semente);
  const vivos = [...ids];
  const rodadas: RodadaBatata[] = [];
  let t = BATATA_ENTRADA_S;
  while (vivos.length > 1) {
    const primeiro = vivos[Math.floor(r() * vivos.length)]!;
    // o pavio encurta quando sobra pouca gente, para o fim ser mais rápido
    const pavio = (vivos.length > 3 ? 5 : 3.8) + r() * 3.6;
    const explode = t + pavio;
    const passes: RodadaBatata["passes"] = [];
    let com = primeiro;
    let q = t + 0.7 + r() * 0.4;
    while (q < explode - BATATA_VOO_S) {
      const outros = vivos.filter((v) => v !== com);
      const para = outros[Math.floor(r() * outros.length)]!;
      passes.push({ t: q, de: com, para });
      com = para;
      q += BATATA_VOO_S + 0.25 + r() * 0.6;
    }
    rodadas.push({ inicio: t, primeiro, passes, explode, eliminado: com });
    vivos.splice(vivos.indexOf(com), 1);
    t = explode + 2.6;
  }
  return { rodadas, vencedor: vivos[0] ?? null, fim: t + 1.6 };
}

/** Com quem está a batata no instante `s` (ou no ar entre duas pessoas). */
export function batataEm(b: Batata, s: number) {
  const rodada = b.rodadas.find((x) => s >= x.inicio && s < x.explode + 0.05);
  if (!rodada) return null;
  let com = rodada.primeiro;
  for (const p of rodada.passes) {
    if (s < p.t) break;
    if (s < p.t + BATATA_VOO_S)
      return { rodada, voo: { de: p.de, para: p.para, k: (s - p.t) / BATATA_VOO_S } };
    com = p.para;
  }
  return { rodada, com, falta: rodada.explode - s };
}

/* ---------------- duração de cada evento ---------------- */

export function duracaoDoShow(show: Pick<Show, "tipo" | "ids" | "semente">): number {
  switch (show.tipo) {
    case "trovao":
      return 6;
    case "aviao":
      return 27;
    case "mergulho":
      return 14;
    case "batata":
      return gerarBatata(show.ids, show.semente).fim;
    case "trenzinho":
      return 19;
    case "baile":
      return 16;
    case "fogos":
      return 13;
    case "gigantes":
      return 20;
  }
}
