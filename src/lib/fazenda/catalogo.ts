/**
 * HOST FAZENDAS — catálogo (valores da especificação de gameplay).
 * É a fonte única de preços, tempos, XP e requisitos: o servidor usa estes
 * números para decidir tudo, e a interface só os mostra.
 */

export type Material = "tabua" | "tijolo" | "cimento" | "ferramenta";
export const MATERIAIS: { id: Material; nome: string; icone: string }[] = [
  { id: "tabua", nome: "Tábua", icone: "🌲" },
  { id: "tijolo", nome: "Tijolo", icone: "🧱" },
  { id: "cimento", nome: "Cimento", icone: "🏗️" },
  { id: "ferramenta", nome: "Ferramenta", icone: "🔧" },
];
export const nomeDoMaterial = (m: Material) => MATERIAIS.find((x) => x.id === m)?.nome ?? m;

const MIN = 60_000;
const H = 60 * MIN;

export interface Cultura {
  id: string;
  nome: string;
  icone: string;
  nivel: number;
  tempoMs: number;
  semente: number;
  venda: number;
  xpPlantar: number;
  xpColher: number;
  /** Cores do desenho 3D: folhagem e fruto. */
  folha: string;
  fruto: string;
}
export const CULTURAS: Cultura[] = [
  {
    id: "morango",
    nome: "Morango",
    icone: "🍓",
    nivel: 1,
    tempoMs: 1 * MIN,
    semente: 20,
    venda: 75,
    xpPlantar: 1,
    xpColher: 2,
    folha: "#3f9a34",
    fruto: "#e8333a",
  },
  {
    id: "alface",
    nome: "Alface",
    icone: "🥬",
    nivel: 2,
    tempoMs: 5 * MIN,
    semente: 30,
    venda: 105,
    xpPlantar: 1,
    xpColher: 3,
    folha: "#7ccf4a",
    fruto: "#a6e36a",
  },
  {
    id: "cenoura",
    nome: "Cenoura",
    icone: "🥕",
    nivel: 3,
    tempoMs: 15 * MIN,
    semente: 45,
    venda: 145,
    xpPlantar: 2,
    xpColher: 4,
    folha: "#4caf3a",
    fruto: "#f28a1e",
  },
  {
    id: "milho",
    nome: "Milho",
    icone: "🌽",
    nivel: 5,
    tempoMs: 30 * MIN,
    semente: 60,
    venda: 190,
    xpPlantar: 2,
    xpColher: 5,
    folha: "#5aa83a",
    fruto: "#f6cf3a",
  },
  {
    id: "tomate",
    nome: "Tomate",
    icone: "🍅",
    nivel: 8,
    tempoMs: 1 * H,
    semente: 85,
    venda: 265,
    xpPlantar: 3,
    xpColher: 7,
    folha: "#3f8f2f",
    fruto: "#e5342b",
  },
  {
    id: "girassol",
    nome: "Girassol",
    icone: "🌻",
    nivel: 12,
    tempoMs: 2 * H,
    semente: 110,
    venda: 350,
    xpPlantar: 4,
    xpColher: 9,
    folha: "#4f9c35",
    fruto: "#ffcf2a",
  },
  {
    id: "melancia",
    nome: "Melancia",
    icone: "🍉",
    nivel: 16,
    tempoMs: 4 * H,
    semente: 150,
    venda: 480,
    xpPlantar: 5,
    xpColher: 12,
    folha: "#3f8f2f",
    fruto: "#2f8f3a",
  },
  {
    id: "cafe",
    nome: "Café",
    icone: "☕",
    nivel: 22,
    tempoMs: 6 * H,
    semente: 200,
    venda: 640,
    xpPlantar: 6,
    xpColher: 15,
    folha: "#2f7a32",
    fruto: "#b3261e",
  },
  {
    id: "abobora",
    nome: "Abóbora",
    icone: "🎃",
    nivel: 30,
    tempoMs: 8 * H,
    semente: 250,
    venda: 830,
    xpPlantar: 7,
    xpColher: 19,
    folha: "#4a9a34",
    fruto: "#f08a24",
  },
  {
    id: "uva",
    nome: "Uva",
    icone: "🍇",
    nivel: 40,
    tempoMs: 12 * H,
    semente: 325,
    venda: 1080,
    xpPlantar: 9,
    xpColher: 24,
    folha: "#3f8f2f",
    fruto: "#7b3fbf",
  },
  {
    id: "cacau",
    nome: "Cacau",
    icone: "🍫",
    nivel: 55,
    tempoMs: 16 * H,
    semente: 425,
    venda: 1420,
    xpPlantar: 11,
    xpColher: 30,
    folha: "#2f7a32",
    fruto: "#a0632a",
  },
  {
    id: "pitaya",
    nome: "Pitaya",
    icone: "🐉",
    nivel: 70,
    tempoMs: 24 * H,
    semente: 550,
    venda: 1950,
    xpPlantar: 14,
    xpColher: 38,
    folha: "#4caf5a",
    fruto: "#ff4fa0",
  },
];
export const cultura = (id: string) => CULTURAS.find((c) => c.id === id);
/** Preço de arar um quadrado e o XP que dá. */
export const PRECO_ARAR = 30;
export const XP_ARAR = 1;
/** Lucro líquido de um ciclo (já sem a semente e o preparo da terra). */
export const lucroDe = (c: Cultura) => c.venda - c.semente - PRECO_ARAR;

export type TipoObjeto = "arvore" | "animal" | "decoracao";
export interface ItemDoCatalogo {
  id: string;
  nome: string;
  icone: string;
  tipo: TipoObjeto;
  nivel: number;
  /** Preço em Ouros (0 = não se compra com Ouros). */
  compra: number;
  /** Preço em Granas, para os itens especiais. */
  granas?: number;
  /** Produção: tempo, venda por coleta e XP. */
  tempoMs?: number;
  venda?: number;
  xp?: number;
  produto?: string;
  /** Peça do pacote 3D (ou desenho próprio) usada no mundo. */
  modelo: string;
  /** Item que não aparece na loja (prêmios de evento, projetos e conquistas). */
  premio?: boolean;
}
export const ARVORES: ItemDoCatalogo[] = [
  {
    id: "macieira",
    nome: "Macieira",
    icone: "🍎",
    tipo: "arvore",
    nivel: 3,
    compra: 250,
    tempoMs: 30 * MIN,
    venda: 55,
    xp: 3,
    modelo: "macieira",
  },
  {
    id: "bananeira",
    nome: "Bananeira",
    icone: "🍌",
    tipo: "arvore",
    nivel: 8,
    compra: 650,
    tempoMs: 2 * H,
    venda: 145,
    xp: 6,
    modelo: "bananeira",
  },
  {
    id: "laranjeira",
    nome: "Laranjeira",
    icone: "🍊",
    tipo: "arvore",
    nivel: 15,
    compra: 1200,
    tempoMs: 4 * H,
    venda: 250,
    xp: 10,
    modelo: "laranjeira",
  },
  {
    id: "coqueiro",
    nome: "Coqueiro",
    icone: "🥥",
    tipo: "arvore",
    nivel: 25,
    compra: 2400,
    tempoMs: 8 * H,
    venda: 440,
    xp: 16,
    modelo: "coqueiro",
  },
  {
    id: "mangueira",
    nome: "Mangueira",
    icone: "🥭",
    tipo: "arvore",
    nivel: 40,
    compra: 4600,
    tempoMs: 12 * H,
    venda: 720,
    xp: 24,
    modelo: "mangueira",
  },
];
export const ANIMAIS: ItemDoCatalogo[] = [
  {
    id: "galinha",
    nome: "Galinha",
    icone: "🐔",
    tipo: "animal",
    nivel: 2,
    compra: 280,
    produto: "Ovos",
    tempoMs: 20 * MIN,
    venda: 45,
    xp: 2,
    modelo: "galinha",
  },
  {
    id: "vaca",
    nome: "Vaca",
    icone: "🐄",
    tipo: "animal",
    nivel: 6,
    compra: 850,
    produto: "Leite",
    tempoMs: 2 * H,
    venda: 160,
    xp: 6,
    modelo: "vaca",
  },
  {
    id: "ovelha",
    nome: "Ovelha",
    icone: "🐑",
    tipo: "animal",
    nivel: 12,
    compra: 1350,
    produto: "Lã",
    tempoMs: 4 * H,
    venda: 280,
    xp: 10,
    modelo: "ovelha",
  },
  {
    id: "cabra",
    nome: "Cabra",
    icone: "🐐",
    tipo: "animal",
    nivel: 18,
    compra: 2100,
    produto: "Leite",
    tempoMs: 6 * H,
    venda: 420,
    xp: 14,
    modelo: "cabra",
  },
  {
    id: "pato",
    nome: "Pato",
    icone: "🦆",
    tipo: "animal",
    nivel: 26,
    compra: 2800,
    produto: "Ovos",
    tempoMs: 8 * H,
    venda: 540,
    xp: 18,
    modelo: "pato",
  },
];
/** Galinha entregue pelo tutorial: mesmo ciclo da galinha da loja, mas não se vende (só se guarda). */
export const GALINHA_INICIAL = "galinha";
export const DECORACOES: ItemDoCatalogo[] = [
  {
    id: "flores-rosa",
    nome: "Flores rosas",
    icone: "🌸",
    tipo: "decoracao",
    nivel: 1,
    compra: 40,
    modelo: "flor_rosa",
  },
  {
    id: "flores-brancas",
    nome: "Flores brancas",
    icone: "🌼",
    tipo: "decoracao",
    nivel: 1,
    compra: 40,
    modelo: "flor_branca",
  },
  {
    id: "flores-azuis",
    nome: "Flores azuis",
    icone: "💠",
    tipo: "decoracao",
    nivel: 2,
    compra: 40,
    modelo: "flor_azul",
  },
  {
    id: "toco",
    nome: "Banquinho de toco",
    icone: "🌲",
    tipo: "decoracao",
    nivel: 2,
    compra: 60,
    modelo: "toco",
  },
  {
    id: "feno",
    nome: "Fardo de feno",
    icone: "🌾",
    tipo: "decoracao",
    nivel: 3,
    compra: 90,
    modelo: "feno",
  },
  {
    id: "trigo",
    nome: "Tufo de trigo",
    icone: "🌾",
    tipo: "decoracao",
    nivel: 4,
    compra: 110,
    modelo: "trigo",
  },
  {
    id: "caixote",
    nome: "Caixote de madeira",
    icone: "📦",
    tipo: "decoracao",
    nivel: 5,
    compra: 150,
    modelo: "caixote",
  },
  {
    id: "canteiro-cenoura",
    nome: "Horta de cenouras",
    icone: "🥕",
    tipo: "decoracao",
    nivel: 6,
    compra: 320,
    modelo: "canteiro_cenoura",
  },
  {
    id: "canteiro-trigo",
    nome: "Horta de trigo",
    icone: "🌾",
    tipo: "decoracao",
    nivel: 9,
    compra: 380,
    modelo: "canteiro_trigo",
  },
  {
    id: "carroca",
    nome: "Carroça de feno",
    icone: "🛒",
    tipo: "decoracao",
    nivel: 10,
    compra: 900,
    modelo: "carroca",
  },
  {
    id: "mesa",
    nome: "Mesa de piquenique",
    icone: "🧺",
    tipo: "decoracao",
    nivel: 14,
    compra: 1200,
    modelo: "mesa",
  },
  {
    id: "fogueira",
    nome: "Fogueira com caldeirão",
    icone: "🔥",
    tipo: "decoracao",
    nivel: 18,
    compra: 1600,
    modelo: "fogueira",
  },
  {
    id: "moinho-host",
    nome: "Moinho HOST",
    icone: "🌬️",
    tipo: "decoracao",
    nivel: 5,
    compra: 0,
    granas: 5,
    modelo: "moinho",
  },
  {
    id: "estatua-host",
    nome: "Estátua do HOKI",
    icone: "🗿",
    tipo: "decoracao",
    nivel: 10,
    compra: 0,
    granas: 8,
    modelo: "estatua",
  },
  // prêmios (não aparecem na loja)
  {
    id: "espantalho",
    nome: "Espantalho HOST",
    icone: "🧑‍🌾",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "espantalho",
    premio: true,
  },
  {
    id: "fonte-colheita",
    nome: "Fonte da Colheita",
    icone: "⛲",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "fonte",
    premio: true,
  },
  {
    id: "placa-garagem",
    nome: "Placa da Garagem",
    icone: "🏷️",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "placa",
    premio: true,
  },
  {
    id: "placa-pomar",
    nome: "Placa do Pomar",
    icone: "🏷️",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "placa",
    premio: true,
  },
  {
    id: "capivara",
    nome: "Capivara",
    icone: "🐹",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "capivara",
    premio: true,
  },
  {
    id: "arara",
    nome: "Arara",
    icone: "🦜",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "arara",
    premio: true,
  },
  {
    id: "trofeu-mestre",
    nome: "Troféu Mestre",
    icone: "🏆",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "trofeu",
    premio: true,
  },
  {
    id: "trofeu-ilha",
    nome: "Troféu Ilha Completa",
    icone: "🏆",
    tipo: "decoracao",
    nivel: 1,
    compra: 0,
    modelo: "trofeu",
    premio: true,
  },
  ...CULTURAS.map((c) => ({
    id: `placa-${c.id}`,
    nome: `Placa de Ouro: ${c.nome}`,
    icone: "🥇",
    tipo: "decoracao" as const,
    nivel: 1,
    compra: 0,
    modelo: "placa",
    premio: true,
  })),
];
export const ITENS: ItemDoCatalogo[] = [...ARVORES, ...ANIMAIS, ...DECORACOES];
export const item = (id: string) => ITENS.find((i) => i.id === id);

export interface Expansao {
  tamanho: number;
  nivel: number;
  ouros: number;
  vizinhos: number;
  granas: number;
  objetos: number;
}
export const EXPANSOES: Expansao[] = [
  { tamanho: 8, nivel: 1, ouros: 0, vizinhos: 0, granas: 0, objetos: 24 },
  { tamanho: 10, nivel: 5, ouros: 2500, vizinhos: 1, granas: 6, objetos: 36 },
  { tamanho: 12, nivel: 12, ouros: 8000, vizinhos: 2, granas: 12, objetos: 52 },
  { tamanho: 14, nivel: 22, ouros: 20000, vizinhos: 3, granas: 20, objetos: 72 },
  { tamanho: 16, nivel: 35, ouros: 45000, vizinhos: 4, granas: 30, objetos: 96 },
  { tamanho: 18, nivel: 55, ouros: 90000, vizinhos: 5, granas: 45, objetos: 128 },
  { tamanho: 20, nivel: 75, ouros: 160000, vizinhos: 6, granas: 65, objetos: 160 },
];
export const expansaoDe = (tamanho: number) =>
  EXPANSOES.find((e) => e.tamanho === tamanho) ?? EXPANSOES[0]!;
export const proximaExpansao = (tamanho: number) => EXPANSOES.find((e) => e.tamanho > tamanho);

// ---------------- XP e níveis (1 a 250) ----------------
export const NIVEL_MAXIMO = 250;
/** XP acumulado necessário para alcançar um nível. */
export function xpDoNivel(n: number) {
  const nivel = Math.max(1, Math.min(NIVEL_MAXIMO, Math.floor(n)));
  if (nivel <= 10) return 10 * nivel * (nivel - 1);
  const k = nivel - 10;
  return 900 + 200 * k + 12 * k * k;
}
export const XP_MAXIMO = xpDoNivel(NIVEL_MAXIMO);
/** Maior nível cujo requisito cabe no XP acumulado. */
export function nivelDoXp(xp: number) {
  let lo = 1;
  let hi = NIVEL_MAXIMO;
  while (lo < hi) {
    const m = Math.ceil((lo + hi) / 2);
    if (xpDoNivel(m) <= xp) lo = m;
    else hi = m - 1;
  }
  return lo;
}
/** Progresso dentro do nível atual (para a barra de XP). */
export function progressoDoNivel(xp: number) {
  const nivel = nivelDoXp(xp);
  if (nivel >= NIVEL_MAXIMO) return { nivel, noNivel: 0, paraSubir: 0, pct: 100, maximo: true };
  const base = xpDoNivel(nivel);
  const proximo = xpDoNivel(nivel + 1);
  return {
    nivel,
    noNivel: xp - base,
    paraSubir: proximo - base,
    pct: ((xp - base) / (proximo - base)) * 100,
    maximo: false,
  };
}

// ---------------- cores do nível (plaquinha) ----------------
export interface CorLevel {
  id: string;
  nome: string;
  nivel: number;
  fundo: string;
  texto: string;
}
export const CORES_LEVEL: CorLevel[] = [
  { id: "vermelho", nome: "Vermelho padrão", nivel: 1, fundo: "#FF5555", texto: "#000000" },
  { id: "dourado", nome: "Dourado", nivel: 35, fundo: "#FFAA00", texto: "#000000" },
  { id: "verde_claro", nome: "Verde-claro", nivel: 45, fundo: "#55FF55", texto: "#000000" },
  { id: "amarelo", nome: "Amarelo", nivel: 55, fundo: "#FFFF55", texto: "#000000" },
  { id: "roxo_claro", nome: "Roxo-claro", nivel: 65, fundo: "#FF55FF", texto: "#000000" },
  { id: "branco", nome: "Branco", nivel: 75, fundo: "#FFFFFF", texto: "#000000" },
  { id: "azul", nome: "Azul", nivel: 85, fundo: "#5555FF", texto: "#FFFFFF" },
  { id: "verde_escuro", nome: "Verde-escuro", nivel: 95, fundo: "#00AA00", texto: "#000000" },
  {
    id: "vermelho_escuro",
    nome: "Vermelho-escuro",
    nivel: 150,
    fundo: "#AA0000",
    texto: "#FFFFFF",
  },
  {
    id: "turquesa_escuro",
    nome: "Turquesa-escuro",
    nivel: 150,
    fundo: "#00AAAA",
    texto: "#000000",
  },
  { id: "roxo_escuro", nome: "Roxo-escuro", nivel: 200, fundo: "#AA00AA", texto: "#FFFFFF" },
  { id: "cinza_escuro", nome: "Cinza-escuro", nivel: 200, fundo: "#555555", texto: "#FFFFFF" },
  { id: "preto", nome: "Preto", nivel: 250, fundo: "#000000", texto: "#FFFFFF" },
];
export const corLevel = (id: string | null | undefined) =>
  CORES_LEVEL.find((c) => c.id === id) ?? CORES_LEVEL[0]!;
/** Cor que a plaquinha mostra: a equipada, se o nível já libera; senão o vermelho padrão. */
export const corDoSelo = (id: string | null | undefined, nivel: number) => {
  const c = corLevel(id);
  return nivel >= c.nivel ? c : CORES_LEVEL[0]!;
};

// ---------------- trator, baterias ----------------
export const TRATORES = {
  trator: { nome: "Trator", nivel: 20, compra: 12000, area: [2, 2] as [number, number] },
  superTrator: { nome: "Super Trator", nivel: 40, compra: 40000, area: [2, 4] as [number, number] },
};
export type QualTrator = keyof typeof TRATORES;
export const CARGAS_INICIAIS = 20;
export const CARGAS_MAXIMAS = 100;
export const BATERIAS = [
  { id: "bateria-20", cargas: 20, ouros: 1500, granas: 2 },
  { id: "bateria-50", cargas: 50, ouros: 3000, granas: 4 },
];

// ---------------- projetos ----------------
export type Meta =
  | { tipo: "colheitas"; cultura?: string; quantidade: number }
  | { tipo: "coletas"; produto?: "ovos" | "la" | "arvore"; quantidade: number }
  | { tipo: "trator"; quantidade: number }
  | { tipo: "adubacoes"; quantidade: number }
  | { tipo: "colocados"; item: string; quantidade: number };
export interface EtapaDeProjeto {
  materiais: Partial<Record<Material, number>>;
  metas: Meta[];
  recompensa: { xp: number; ouros: number; granas?: number; itens?: string[] };
  beneficio: string;
}
export interface Projeto {
  id: string;
  nome: string;
  icone: string;
  nivel: number;
  etapas: EtapaDeProjeto[];
  modelo: string;
}
export const PROJETOS: Projeto[] = [
  {
    id: "galinheiro",
    nome: "Galinheiro",
    icone: "🐔",
    nivel: 8,
    modelo: "galinheiro",
    etapas: [
      {
        materiais: { tabua: 4, tijolo: 2, cimento: 2 },
        metas: [{ tipo: "coletas", produto: "ovos", quantidade: 10 }],
        recompensa: { xp: 150, ouros: 500 },
        beneficio: "Abriga 4 galinhas com coleta em grupo.",
      },
      {
        materiais: { tabua: 6, tijolo: 4, cimento: 4, ferramenta: 2 },
        metas: [{ tipo: "coletas", produto: "ovos", quantidade: 25 }],
        recompensa: { xp: 250, ouros: 1000 },
        beneficio: "Abriga 8 galinhas.",
      },
    ],
  },
  {
    id: "aprisco",
    nome: "Aprisco",
    icone: "🐑",
    nivel: 15,
    modelo: "aprisco",
    etapas: [
      {
        materiais: { tabua: 6, tijolo: 4, cimento: 4 },
        metas: [{ tipo: "coletas", produto: "la", quantidade: 10 }],
        recompensa: { xp: 220, ouros: 800 },
        beneficio: "Abriga 4 ovelhas com coleta em grupo.",
      },
      {
        materiais: { tabua: 8, tijolo: 6, cimento: 6, ferramenta: 2 },
        metas: [{ tipo: "coletas", produto: "la", quantidade: 25 }],
        recompensa: { xp: 350, ouros: 1500 },
        beneficio: "Abriga 8 ovelhas.",
      },
    ],
  },
  {
    id: "garagem",
    nome: "Garagem",
    icone: "🚜",
    nivel: 20,
    modelo: "garagem",
    etapas: [
      {
        materiais: { tabua: 6, tijolo: 6, cimento: 6, ferramenta: 2 },
        metas: [{ tipo: "trator", quantidade: 25 }],
        recompensa: { xp: 300, ouros: 2000, itens: ["placa-garagem"] },
        beneficio: "Ganha a Placa da Garagem.",
      },
      {
        materiais: { tabua: 10, tijolo: 10, cimento: 10, ferramenta: 4 },
        metas: [{ tipo: "trator", quantidade: 75 }],
        recompensa: { xp: 600, ouros: 4000 },
        beneficio: "Libera o Super Trator no nível 40.",
      },
    ],
  },
  {
    id: "pomar",
    nome: "Pomar Comunitário",
    icone: "🌳",
    nivel: 25,
    modelo: "pomar",
    etapas: [
      {
        materiais: { tabua: 8, cimento: 4 },
        metas: [{ tipo: "coletas", produto: "arvore", quantidade: 30 }],
        recompensa: { xp: 400, ouros: 2000, itens: ["placa-pomar"] },
        beneficio: "Ganha a Placa do Pomar.",
      },
      {
        materiais: { tabua: 12, cimento: 6, ferramenta: 4 },
        metas: [
          { tipo: "coletas", produto: "arvore", quantidade: 60 },
          { tipo: "adubacoes", quantidade: 10 },
        ],
        recompensa: { xp: 700, ouros: 4000 },
        beneficio: "Coleta em grupo de até 8 árvores maduras.",
      },
    ],
  },
  {
    id: "reserva",
    nome: "Reserva HOST",
    icone: "🦜",
    nivel: 35,
    modelo: "reserva",
    etapas: [
      {
        materiais: { tabua: 10, tijolo: 8, cimento: 8, ferramenta: 4 },
        metas: [
          { tipo: "colocados", item: "bananeira", quantidade: 2 },
          { tipo: "colheitas", cultura: "melancia", quantidade: 30 },
        ],
        recompensa: { xp: 600, ouros: 3000, itens: ["capivara"] },
        beneficio: "Ganha uma Capivara decorativa.",
      },
      {
        materiais: { tabua: 14, tijolo: 12, cimento: 12, ferramenta: 6 },
        metas: [
          { tipo: "coletas", produto: "arvore", quantidade: 40 },
          { tipo: "colheitas", cultura: "abobora", quantidade: 50 },
        ],
        recompensa: { xp: 1000, ouros: 5000, granas: 3, itens: ["arara"] },
        beneficio: "Ganha uma Arara decorativa.",
      },
    ],
  },
];
export const projeto = (id: string) => PROJETOS.find((p) => p.id === id);

// ---------------- missões, conquistas, maestria e evento ----------------
export interface Recompensa {
  ouros?: number;
  xp?: number;
  granas?: number;
  materiais?: Readonly<Partial<Record<Material, number>>>;
  itens?: readonly string[];
  titulo?: string;
}
export const MISSOES_DIARIAS = [
  {
    id: "d-colher",
    nome: "Colher 20 canteiros",
    alvo: 20,
    contador: "colheitas",
    recompensa: { ouros: 250, xp: 40, materiais: { tabua: 1 } },
  },
  {
    id: "d-coletar",
    nome: "Coletar 3 produções de árvores ou animais",
    alvo: 3,
    contador: "coletas",
    recompensa: { ouros: 200, xp: 30, materiais: { tijolo: 1 } },
  },
  {
    id: "d-plantar",
    nome: "Arar e plantar 12 canteiros",
    alvo: 12,
    contador: "plantios",
    recompensa: { ouros: 200, xp: 25, materiais: { cimento: 1 } },
  },
  {
    id: "d-adubar",
    nome: "Adubar 3 canteiros de amigos",
    alvo: 3,
    contador: "adubacoes",
    recompensa: { ouros: 200, xp: 30, materiais: { ferramenta: 1 } },
  },
] as const;
export const BONUS_DIARIO = {
  id: "d-bonus",
  nome: "Concluir 3 diárias no mesmo dia",
  alvo: 3,
  recompensa: { ouros: 300, xp: 60 },
};
export const MISSOES_SEMANAIS = [
  {
    id: "s-colher",
    nome: "Colher 150 canteiros",
    alvo: 150,
    recompensa: { ouros: 1500, xp: 220, materiais: { tabua: 3 } },
  },
  {
    id: "s-coletar",
    nome: "Coletar 30 produções de árvores ou animais",
    alvo: 30,
    recompensa: { ouros: 1200, xp: 180, materiais: { tijolo: 3 } },
  },
  {
    id: "s-dias",
    nome: "Concluir diárias em 3 dias diferentes",
    alvo: 3,
    recompensa: { ouros: 1000, xp: 150, materiais: { cimento: 3 } },
  },
  {
    id: "s-ajuda",
    nome: "Adubar 12 canteiros de amigos ou colher mais 80 depois da semanal de 150",
    alvo: 12,
    recompensa: { ouros: 1000, xp: 150, materiais: { ferramenta: 3 } },
  },
] as const;
export const BONUS_SEMANAL = {
  id: "s-bonus",
  nome: "Completar as 4 semanais",
  alvo: 4,
  recompensa: { ouros: 2000, xp: 300, granas: 2 },
};
export const NIVEL_SEMANAIS = 5;

export const CONQUISTAS = [
  {
    id: "primeira-colheita",
    nome: "Primeira Colheita",
    condicao: "Colher 1 canteiro",
    recompensa: { ouros: 100, xp: 10 },
  },
  {
    id: "fazenda-movimento",
    nome: "Fazenda em Movimento",
    condicao: "Colher 100 canteiros",
    recompensa: { ouros: 1000, xp: 100, granas: 1 },
  },
  {
    id: "maos-na-terra",
    nome: "Mãos na Terra",
    condicao: "Colher 1.000 canteiros",
    recompensa: { ouros: 8000, xp: 500, granas: 3 },
  },
  {
    id: "boa-vizinhanca",
    nome: "Boa Vizinhança",
    condicao: "Adubar 50 canteiros de amigos",
    recompensa: { ouros: 3000, xp: 200, granas: 2 },
  },
  {
    id: "construtor",
    nome: "Construtor da Ilha",
    condicao: "Concluir 3 projetos completos",
    recompensa: { ouros: 5000, xp: 350, granas: 3 },
  },
  {
    id: "ilha-completa",
    nome: "Ilha Completa",
    condicao: "Liberar o terreno 20 × 20",
    recompensa: { ouros: 10000, itens: ["trofeu-ilha"] },
  },
  {
    id: "mestre-culturas",
    nome: "Mestre das Culturas",
    condicao: "Maestria máxima em 6 culturas",
    recompensa: { ouros: 10000, titulo: "Mestre das Culturas" },
  },
] as const;
export const conquista = (id: string) => CONQUISTAS.find((c) => c.id === id);
export const MAESTRIA = [
  { medalha: "Bronze", colheitas: 50, recompensa: { ouros: 300, xp: 50 } },
  { medalha: "Prata", colheitas: 200, recompensa: { ouros: 1200, xp: 150 } },
  { medalha: "Ouro", colheitas: 500, recompensa: { ouros: 3000, xp: 300 } },
] as const;

/** Festival da Colheita: 14 dias a partir da abertura da HOST FAZENDAS, com 48 h a mais para trocar as fichas. */
export const FESTIVAL = {
  id: "festival-colheita",
  nome: "Festival da Colheita",
  inicio: Date.UTC(2026, 10, 13, 3, 0, 0),
  duracaoMs: 14 * 24 * H,
  lojaExtraMs: 48 * H,
  colheitasPorFicha: 5,
  fichasPorDia: 20,
  trocas: [
    { id: "espantalho", nome: "Espantalho HOST", fichas: 20 },
    { id: "fonte-colheita", nome: "Fonte da Colheita", fichas: 50 },
    { id: "chapeu-colheita", nome: "Chapéu da Colheita (cosmético do HOKI)", fichas: 100 },
  ],
};

/** Marcos de nível (o que a interface avisa quando o jogador chega lá). */
export const MARCOS: { nivel: number; texto: string }[] = [
  { nivel: 5, texto: "Missões semanais e a primeira expansão" },
  { nivel: 8, texto: "Projeto Galinheiro" },
  { nivel: 15, texto: "Projeto Aprisco" },
  { nivel: 20, texto: "Trator, baterias e projeto Garagem" },
  { nivel: 25, texto: "Projeto Pomar Comunitário" },
  { nivel: 35, texto: "Projeto Reserva HOST" },
  { nivel: 40, texto: "Super Trator (depois da Garagem)" },
  { nivel: 75, texto: "Expansão máxima" },
  { nivel: 100, texto: "Título Mestre da HOST Fazendas e o Troféu Mestre" },
];

/** Configuração da ilha nova (primeiro acesso). */
export const INICIO = {
  ouros: 800,
  granas: 0,
  tamanho: 8,
  arados: [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ] as [number, number][],
  kit: {
    ouros: 200,
    xp: 15,
    materiais: { tabua: 2, tijolo: 2, cimento: 2 } as Partial<Record<Material, number>>,
  },
};
export const ETAPAS_TUTORIAL = [
  "Abra a Loja e escolha o Morango",
  "Plante Morango nos 4 canteiros preparados",
  "Espere 1 minuto: os morangos estão crescendo",
  "Colha os 4 canteiros",
  "Coloque a Galinha Inicial (ela está no seu inventário)",
  "Abra o Correio e pegue o Kit do Fazendeiro",
];
export const TUTORIAL_FIM = ETAPAS_TUTORIAL.length + 1;

/** Limites sociais. */
export const SOCIAL = {
  visitantesMax: 5,
  conviteMs: 15 * MIN,
  adubosPorIlha: 3,
  adubosPorDia: 10,
  aduboFracao: 0.15,
  aduboMaxMs: 30 * MIN,
  aduboMinRestanteMs: 60_000,
  xpAdubo: 3,
  presentesEnviarDia: 3,
  presentesReceberDia: 5,
  presenteValidadeMs: 7 * 24 * H,
  alcanceFerramenta: 3,
  /** Roubos: cada um faz até 3 por dia (uma vez em cada fazenda) e cada fazenda sofre até 3 por dia. */
  roubosPorDia: 3,
  roubosRecebidosPorDia: 3,
  /** Num roubo: as colheitas maduras mais valiosas, produções prontas e canteiros pisoteados. */
  rouboMaduros: 3,
  rouboProducoes: 2,
  rouboEstragos: 2,
};
