/**
 * Mini-games da praça (além da velha e do Mau-Mau):
 *   desafios de 1 contra 1: dama, ligue 4 e pedra-papel-tesoura;
 *   salas de festa (2 a 20 pessoas): reflexo e quiz.
 * Cada partida é uma linha de hoshi_jogos (ver hoki-jogos.ts); aqui ficam só as regras.
 */
import type { Jogo, Pessoa } from "@/lib/hoki-jogos";

/* ================= dama (8x8; pedra anda 1 casa para a frente e captura para os dois lados) ================= */
export type CorDama = "b" | "p";
export interface Dama {
  b: Pessoa;
  p: Pessoa;
  /** 64 casas: "" vazia, "b"/"p" pedra, "B"/"P" dama. */
  tab: string[];
  vez: CorDama;
  /** Peça que ainda está capturando (a captura em sequência continua com ela). */
  seguindo: number | null;
  vencedor: CorDama | null;
  ultima: [number, number] | null;
}
export interface Lance {
  de: number;
  para: number;
  /** Casa da peça capturada, se o lance for uma captura. */
  captura: number | null;
}
const corDe = (peca: string): CorDama | null => (peca ? (peca.toLowerCase() as CorDama) : null);
const ehDama = (peca: string) => peca === "B" || peca === "P";
const dentro = (l: number, c: number) => l >= 0 && l < 8 && c >= 0 && c < 8;

export function damaNova(b: Pessoa, p: Pessoa): Dama {
  const tab = Array.from({ length: 64 }, (_, i) => {
    const l = Math.floor(i / 8);
    const c = i % 8;
    if ((l + c) % 2 === 0) return "";
    return l < 3 ? "p" : l > 4 ? "b" : "";
  });
  return { b, p, tab, vez: "b", seguindo: null, vencedor: null, ultima: null };
}

/** Todos os lances da cor; se houver captura, só as capturas valem (captura obrigatória). */
export function lancesDama(e: Dama, cor: CorDama): Lance[] {
  const capturas: Lance[] = [];
  const simples: Lance[] = [];
  const frente = cor === "b" ? -1 : 1;
  for (let i = 0; i < 64; i++) {
    const peca = e.tab[i] ?? "";
    if (corDe(peca) !== cor) continue;
    if (e.seguindo !== null && e.seguindo !== i) continue;
    const l = Math.floor(i / 8);
    const c = i % 8;
    for (const [dl, dc] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const l1 = l + dl;
      const c1 = c + dc;
      if (!dentro(l1, c1)) continue;
      const vizinha = e.tab[l1 * 8 + c1] ?? "";
      if (!vizinha) {
        if (ehDama(peca) || dl === frente)
          simples.push({ de: i, para: l1 * 8 + c1, captura: null });
      } else if (corDe(vizinha) !== cor) {
        const l2 = l1 + dl;
        const c2 = c1 + dc;
        if (dentro(l2, c2) && !e.tab[l2 * 8 + c2])
          capturas.push({ de: i, para: l2 * 8 + c2, captura: l1 * 8 + c1 });
      }
    }
  }
  return capturas.length ? capturas : e.seguindo !== null ? [] : simples;
}

export function jogarDama(e: Dama, de: number, para: number, quem: string): Dama | null {
  if (e.vencedor || e[e.vez].id !== quem) return null;
  const lance = lancesDama(e, e.vez).find((x) => x.de === de && x.para === para);
  if (!lance) return null;
  const tab = e.tab.slice();
  let peca = tab[de] ?? "";
  tab[de] = "";
  if (lance.captura !== null) tab[lance.captura] = "";
  const linha = Math.floor(para / 8);
  const promove =
    !ehDama(peca) && ((e.vez === "b" && linha === 0) || (e.vez === "p" && linha === 7));
  if (promove) peca = peca.toUpperCase();
  tab[para] = peca;
  let proximo: Dama = { ...e, tab, ultima: [de, para], seguindo: null };
  // captura em sequência: a mesma peça continua, se puder capturar de novo (e não acabou de virar dama)
  if (lance.captura !== null && !promove) {
    const continua = lancesDama({ ...proximo, seguindo: para }, e.vez).some(
      (x) => x.captura !== null,
    );
    if (continua) return { ...proximo, seguindo: para };
  }
  const outra: CorDama = e.vez === "b" ? "p" : "b";
  proximo = { ...proximo, vez: outra };
  // perde quem fica sem peças ou sem lance
  if (lancesDama(proximo, outra).length === 0) proximo.vencedor = e.vez;
  return proximo;
}

/* ================= ligue 4 (7 colunas x 6 linhas) ================= */
export type CorLigue = "v" | "a";
export interface Ligue4 {
  v: Pessoa;
  a: Pessoa;
  tab: string[];
  vez: CorLigue;
  vencedor: CorLigue | "empate" | null;
  linha: number[] | null;
}
export const ligue4Novo = (v: Pessoa, a: Pessoa): Ligue4 => ({
  v,
  a,
  tab: Array<string>(42).fill(""),
  vez: "v",
  vencedor: null,
  linha: null,
});
function quatro(tab: string[], i: number): number[] | null {
  const cor = tab[i];
  if (!cor) return null;
  const l = Math.floor(i / 7);
  const c = i % 7;
  for (const [dl, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const) {
    const seq = [i];
    for (const s of [1, -1])
      for (let k = 1; k < 4; k++) {
        const ll = l + dl * k * s;
        const cc = c + dc * k * s;
        if (ll < 0 || ll > 5 || cc < 0 || cc > 6 || tab[ll * 7 + cc] !== cor) break;
        seq.push(ll * 7 + cc);
      }
    if (seq.length >= 4) return seq;
  }
  return null;
}
export function jogarLigue4(e: Ligue4, coluna: number, quem: string): Ligue4 | null {
  if (e.vencedor || e[e.vez].id !== quem || coluna < 0 || coluna > 6) return null;
  let casa = -1;
  for (let l = 5; l >= 0; l--)
    if (!e.tab[l * 7 + coluna]) {
      casa = l * 7 + coluna;
      break;
    }
  if (casa < 0) return null;
  const tab = e.tab.slice();
  tab[casa] = e.vez;
  const linha = quatro(tab, casa);
  return {
    ...e,
    tab,
    vez: e.vez === "v" ? "a" : "v",
    linha,
    vencedor: linha ? e.vez : tab.every(Boolean) ? "empate" : null,
  };
}

/* ================= pedra, papel e tesoura (melhor de 3) ================= */
export type Mao = "pedra" | "papel" | "tesoura";
export const MAOS: { id: Mao; emoji: string; nome: string }[] = [
  { id: "pedra", emoji: "✊", nome: "Pedra" },
  { id: "papel", emoji: "✋", nome: "Papel" },
  { id: "tesoura", emoji: "✌️", nome: "Tesoura" },
];
export interface Ppt {
  a: Pessoa;
  b: Pessoa;
  rodada: number;
  escolhas: { a?: Mao; b?: Mao };
  placar: { a: number; b: number };
  historico: { a: Mao; b: Mao; vencedor: "a" | "b" | "empate" }[];
  vencedor: "a" | "b" | null;
}
export const pptNovo = (a: Pessoa, b: Pessoa): Ppt => ({
  a,
  b,
  rodada: 1,
  escolhas: {},
  placar: { a: 0, b: 0 },
  historico: [],
  vencedor: null,
});
const GANHA_DE: Record<Mao, Mao> = { pedra: "tesoura", papel: "pedra", tesoura: "papel" };
export function jogarPpt(e: Ppt, mao: Mao, quem: string): Ppt | null {
  if (e.vencedor) return null;
  const lado = e.a.id === quem ? "a" : e.b.id === quem ? "b" : null;
  if (!lado || e.escolhas[lado]) return null;
  const escolhas = { ...e.escolhas, [lado]: mao };
  if (!escolhas.a || !escolhas.b) return { ...e, escolhas };
  const v: "a" | "b" | "empate" =
    escolhas.a === escolhas.b ? "empate" : GANHA_DE[escolhas.a] === escolhas.b ? "a" : "b";
  const placar = { a: e.placar.a + (v === "a" ? 1 : 0), b: e.placar.b + (v === "b" ? 1 : 0) };
  return {
    ...e,
    escolhas: {},
    placar,
    rodada: e.rodada + 1,
    historico: [...e.historico, { a: escolhas.a, b: escolhas.b, vencedor: v }],
    vencedor: placar.a >= 2 ? "a" : placar.b >= 2 ? "b" : null,
  };
}

/* ================= quem joga cada desafio, e o nome de cada jogo ================= */
export function participantes(j: Pick<Jogo, "tipo" | "estado">): [Pessoa, Pessoa] | null {
  const e = j.estado as Record<string, Pessoa | undefined>;
  const par = (a?: Pessoa, b?: Pessoa): [Pessoa, Pessoa] | null => (a && b ? [a, b] : null);
  if (j.tipo === "velha") return par(e["x"], e["o"]);
  if (j.tipo === "dama") return par(e["b"], e["p"]);
  if (j.tipo === "ligue4") return par(e["v"], e["a"]);
  if (j.tipo === "ppt") return par(e["a"], e["b"]);
  return null;
}
export const NOME_DO_JOGO: Record<Jogo["tipo"], string> = {
  velha: "jogo da velha",
  cartas: "Mau-Mau",
  dama: "dama",
  ligue4: "ligue 4",
  ppt: "pedra, papel e tesoura",
  festa: "festa",
};
/** Desafios de 1 contra 1 que dá para mandar clicando em alguém perto. */
export const DESAFIOS: {
  tipo: "velha" | "dama" | "ligue4" | "ppt";
  nome: string;
  emoji: string;
}[] = [
  { tipo: "velha", nome: "Jogo da velha", emoji: "#️⃣" },
  { tipo: "dama", nome: "Dama", emoji: "⚫" },
  { tipo: "ligue4", nome: "Ligue 4", emoji: "🔴" },
  { tipo: "ppt", nome: "Pedra, papel e tesoura", emoji: "✊" },
];

/* ================= salas de festa (2 a 20 pessoas): reflexo e quiz ================= */
export type ModoFesta = "reflexo" | "quiz";
export const MAX_FESTA = 20;
export const RODADAS_FESTA = 5;
export interface Festa {
  dono: string;
  modo: ModoFesta;
  jogadores: Pessoa[];
  pontos: Record<string, number>;
  /** 0 enquanto espera começar. */
  rodada: number;
  fase: "lobby" | "rodada" | "resultado" | "fim";
  /** Reflexo: quanto esperar (ms) até o "AGORA!" da rodada. */
  atraso: number;
  /** Quiz: qual pergunta (posição em PERGUNTAS). */
  pergunta: number;
  ordem: number[];
  /** t = tempo de reação ou de resposta (ms; -1 = clicou antes da hora); op = opção escolhida no quiz. */
  respostas: Record<string, { t: number; op: number }>;
  ultimo: { vencedores: string[]; certa: number | null } | null;
  /** Muda a cada rodada: é assim que cada tela sabe que começou uma nova. */
  id: number;
}
export const festaNova = (dono: Pessoa, modo: ModoFesta): Festa => ({
  dono: dono.id,
  modo,
  jogadores: [dono],
  pontos: {},
  rodada: 0,
  fase: "lobby",
  atraso: 0,
  pergunta: 0,
  ordem: [],
  respostas: {},
  ultimo: null,
  id: 0,
});
export function entrarNaFesta(e: Festa, p: Pessoa): Festa | null {
  if (
    e.fase !== "lobby" ||
    e.jogadores.length >= MAX_FESTA ||
    e.jogadores.some((j) => j.id === p.id)
  )
    return null;
  return { ...e, jogadores: [...e.jogadores, p] };
}
export function sairDaFesta(e: Festa, quem: string): Festa {
  const jogadores = e.jogadores.filter((j) => j.id !== quem);
  return { ...e, jogadores, dono: e.dono === quem ? (jogadores[0]?.id ?? e.dono) : e.dono };
}
function sortear(n: number) {
  const l = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [l[i], l[k]] = [l[k]!, l[i]!];
  }
  return l;
}
/** Começa a próxima rodada (quem chama é o dono da sala). */
export function proximaRodada(e: Festa): Festa {
  const rodada = e.rodada + 1;
  if (rodada > RODADAS_FESTA) return { ...e, fase: "fim" };
  const ordem = e.ordem.length ? e.ordem : sortear(PERGUNTAS.length).slice(0, RODADAS_FESTA);
  return {
    ...e,
    rodada,
    fase: "rodada",
    atraso: 1500 + Math.floor(Math.random() * 2600),
    pergunta: ordem[rodada - 1] ?? 0,
    ordem,
    respostas: {},
    id: e.id + 1,
  };
}
export function responderFesta(e: Festa, quem: string, r: { t: number; op: number }): Festa | null {
  if (e.fase !== "rodada" || e.respostas[quem] || !e.jogadores.some((j) => j.id === quem))
    return null;
  return { ...e, respostas: { ...e.respostas, [quem]: r } };
}
/** Fecha a rodada e soma os pontos. Qualquer um pode fechar quando todos responderam ou o tempo acabou. */
export function fecharRodada(e: Festa): Festa {
  if (e.fase !== "rodada") return e;
  const pontos = { ...e.pontos };
  const soma = (id: string, n: number) => (pontos[id] = (pontos[id] ?? 0) + n);
  let vencedores: string[] = [];
  let certa: number | null = null;
  if (e.modo === "reflexo") {
    // mais rápido +3, segundo +2, terceiro +1 (quem clicou antes da hora fica sem)
    const validas = Object.entries(e.respostas)
      .filter(([, r]) => r.t > 0)
      .sort((x, y) => x[1].t - y[1].t);
    validas.slice(0, 3).forEach(([id], k) => soma(id, 3 - k));
    vencedores = validas.slice(0, 1).map(([id]) => id);
  } else {
    // acertou +2, e quem acertou mais rápido ganha +1
    certa = PERGUNTAS[e.pergunta]?.certa ?? null;
    const acertos = Object.entries(e.respostas)
      .filter(([, r]) => r.op === certa)
      .sort((x, y) => x[1].t - y[1].t);
    acertos.forEach(([id], k) => soma(id, k === 0 ? 3 : 2));
    vencedores = acertos.map(([id]) => id);
  }
  return {
    ...e,
    pontos,
    fase: e.rodada >= RODADAS_FESTA ? "fim" : "resultado",
    ultimo: { vencedores, certa },
  };
}

/** Perguntas do quiz (a opção certa é a posição em `certa`). */
export const PERGUNTAS: { q: string; ops: [string, string, string, string]; certa: number }[] = [
  {
    q: "Qual é a capital do Brasil?",
    ops: ["São Paulo", "Brasília", "Rio de Janeiro", "Salvador"],
    certa: 1,
  },
  {
    q: "Quantos jogadores um time de futebol tem em campo?",
    ops: ["9", "10", "11", "12"],
    certa: 2,
  },
  {
    q: "Qual é o maior planeta do sistema solar?",
    ops: ["Saturno", "Terra", "Netuno", "Júpiter"],
    certa: 3,
  },
  {
    q: "Em que ano o Brasil foi pentacampeão da Copa?",
    ops: ["1994", "1998", "2002", "2006"],
    certa: 2,
  },
  {
    q: "Qual é o oceano que banha o litoral brasileiro?",
    ops: ["Atlântico", "Pacífico", "Índico", "Ártico"],
    certa: 0,
  },
  { q: "Quantos lados tem um hexágono?", ops: ["5", "6", "7", "8"], certa: 1 },
  {
    q: "Qual animal é conhecido como o rei da selva?",
    ops: ["Tigre", "Elefante", "Leão", "Onça"],
    certa: 2,
  },
  { q: "Quanto é 7 × 8?", ops: ["54", "56", "58", "64"], certa: 1 },
  {
    q: "Qual é o metal mais usado em fios elétricos?",
    ops: ["Ouro", "Ferro", "Cobre", "Prata"],
    certa: 2,
  },
  { q: "Qual é a cor do HOST?", ops: ["Azul", "Verde", "Vermelho", "Roxo"], certa: 2 },
  { q: "Quantas horas tem um dia?", ops: ["12", "20", "24", "48"], certa: 2 },
  { q: "Qual destes é um planeta anão?", ops: ["Plutão", "Marte", "Vênus", "Mercúrio"], certa: 0 },
  {
    q: "Qual é o maior país da América do Sul?",
    ops: ["Argentina", "Brasil", "Peru", "Colômbia"],
    certa: 1,
  },
  {
    q: "Qual instrumento tem teclas brancas e pretas?",
    ops: ["Violão", "Bateria", "Piano", "Flauta"],
    certa: 2,
  },
  {
    q: "Qual é o idioma oficial do Brasil?",
    ops: ["Espanhol", "Português", "Inglês", "Tupi"],
    certa: 1,
  },
  { q: "Quantos minutos tem uma hora?", ops: ["30", "60", "90", "100"], certa: 1 },
  {
    q: "Qual é o estado do Brasil com a cidade de Manaus?",
    ops: ["Pará", "Amazonas", "Acre", "Roraima"],
    certa: 1,
  },
  { q: "Qual é o resultado de 15 + 27?", ops: ["32", "42", "41", "52"], certa: 1 },
  { q: "O que a abelha produz?", ops: ["Leite", "Seda", "Mel", "Cera de vela"], certa: 2 },
  {
    q: "Qual é o ponto mais alto do Brasil?",
    ops: ["Pico da Neblina", "Pico da Bandeira", "Monte Roraima", "Serra do Mar"],
    certa: 0,
  },
  { q: "Quantas cores tem o arco-íris?", ops: ["5", "6", "7", "8"], certa: 2 },
  { q: "Qual destes é um mamífero?", ops: ["Tubarão", "Golfinho", "Polvo", "Pinguim"], certa: 1 },
];
