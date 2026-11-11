/**
 * Pet HOSHI: cada staff cuida do seu. As barras caem com o tempo (como no Pou),
 * cuidar e jogar dá XP, e o XP vira nível — que alimenta o ranking da equipe.
 */
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export type Barra = "fome" | "sede" | "energia" | "carinho";

export interface HoshiPet {
  user_id: string;
  username: string;
  nome: string;
  xp: number;
  fome: number;
  sede: number;
  energia: number;
  carinho: number;
  recorde_petiscos: number;
  recorde_reflexo: number;
  cuidado_em: string;
  visual: Visual;
  /** Staff Coins: só mudam pelo banco (entrega do henrique ou compra na loja). */
  coins: number;
  /** Peças compradas, no formato "grupo:valor". */
  itens: string[];
}

/* ---------------- visual do HOSHI: trajes, peças e cores ---------------- */

/** Espaços onde uma peça pode ser vestida. */
export type Grupo = "traje" | "roupa" | "calca" | "chapeu" | "oculos" | "luvas" | "calcado" | "costas" | "efeito";
export const ESPACOS: Grupo[] = ["traje", "roupa", "calca", "chapeu", "oculos", "luvas", "calcado", "costas", "efeito"];
/** Partes do personagem que aceitam cor escolhida pelo usuário. */
export type ParteCor = "principal" | "detalhe" | "capuz" | "luvas" | "pes" | "acessorio";
export const PARTES: { id: ParteCor; nome: string }[] = [
  { id: "principal", nome: "Traje (cor principal)" },
  { id: "detalhe", nome: "Detalhes (barriga e orelhas)" },
  { id: "capuz", nome: "Capuz e orelhas" },
  { id: "luvas", nome: "Luvas" },
  { id: "pes", nome: "Calçados" },
  { id: "acessorio", nome: "Acessórios coloríveis" },
];
export type Cores = Record<ParteCor, string>;

/**
 * Visual salvo do pet. Cada espaço guarda o id da peça ("" = vazio) e
 * `cores` guarda só as partes que o usuário recoloriu.
 */
export interface Visual {
  traje: string;
  roupa: string;
  calca: string;
  chapeu: string;
  oculos: string;
  luvas: string;
  calcado: string;
  costas: string;
  efeito: string;
  cores: Partial<Cores>;
}
export const VISUAL_PADRAO: Visual = { traje: "traje:hoshi", roupa: "", calca: "", chapeu: "", oculos: "", luvas: "", calcado: "", costas: "", efeito: "", cores: {} };

export const PALETA: { nome: string; cor: string }[] = [
  { nome: "Vermelho HOST", cor: "#ce0e0e" },
  { nome: "Preto", cor: "#161616" },
  { nome: "Branco", cor: "#ffffff" },
  { nome: "Cinza", cor: "#8d8d8d" },
  { nome: "Laranja", cor: "#f08a24" },
  { nome: "Rosa pastel", cor: "#f7b6cf" },
  { nome: "Azul pastel", cor: "#a9d4f5" },
  { nome: "Lilás", cor: "#c9a7f0" },
  { nome: "Verde menta", cor: "#a8e6c1" },
  { nome: "Amarelo", cor: "#f6d046" },
];

export const CATEGORIAS: { id: string; nome: string; grupos: Grupo[] }[] = [
  { id: "trajes", nome: "Trajes completos", grupos: ["traje"] },
  { id: "roupas", nome: "Roupas", grupos: ["roupa", "calca"] },
  { id: "chapeus", nome: "Capuzes e chapéus", grupos: ["chapeu"] },
  { id: "rosto", nome: "Óculos e rosto", grupos: ["oculos"] },
  { id: "luvas", nome: "Luvas", grupos: ["luvas"] },
  { id: "calcados", nome: "Calçados", grupos: ["calcado"] },
  { id: "costas", nome: "Costas", grupos: ["costas"] },
  { id: "efeitos", nome: "Efeitos visuais", grupos: ["efeito"] },
];

export const ARCO_IRIS = ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"];

export interface Peca {
  /** Identificador salvo no banco. As peças antigas mantêm o id de antes, para ninguém perder o que comprou. */
  id: string;
  grupo: Grupo;
  nome: string;
  /** Preço padrão em Staff Coins (o valor que vale é o da tabela hoshi_loja). */
  preco: number;
  /** Nível em que vira recompensa gratuita; 0 = não é recompensa de nível. */
  nivel: number;
  /** Cor que representa a peça na vitrine. */
  cor: string;
  tipo?: string;
  listras?: string[];
  /** Trajes: cores de fábrica de cada parte. */
  cores?: Partial<Cores>;
  /** Partes que o usuário pode recolorir quando usa esta peça. */
  recolore?: ParteCor[];
  /** Trajes: espaços que o traje ocupa (não combinam com ele). */
  ocupa?: Grupo[];
}

const TODAS: ParteCor[] = ["principal", "detalhe", "capuz", "luvas", "pes"];
/**
 * Catálogo do HOSHI. Preço e nível daqui são só o padrão: o banco (hoshi_loja)
 * é quem decide na hora da compra ou do resgate, e a tela lê de lá.
 * Mantenha o início de cada linha no formato { id, grupo, nome, preco, nivel } — a migração é gerada a partir dele.
 */
export const PECAS: Peca[] = [
  // trajes completos (capuz, orelhas e macacão)
  { id: "traje:hoshi", grupo: "traje", nome: "HOSHI clássico", preco: 0, nivel: 0, cor: "#ce0e0e", tipo: "redonda", cores: { principal: "#ce0e0e", detalhe: "#ffffff", capuz: "#ce0e0e", luvas: "#ffffff", pes: "#1c1c1c" }, recolore: ["principal", "detalhe"] },
  { id: "traje:urso", grupo: "traje", nome: "Ursinho", preco: 120, nivel: 0, cor: "#a8703f", tipo: "urso", cores: { principal: "#a8703f", detalhe: "#f1d9b5", capuz: "#a8703f", luvas: "#f1d9b5", pes: "#6e4524" }, recolore: TODAS },
  { id: "traje:gato", grupo: "traje", nome: "Gatinho", preco: 120, nivel: 0, cor: "#9a9aa3", tipo: "gato", cores: { principal: "#9a9aa3", detalhe: "#ffffff", capuz: "#9a9aa3", luvas: "#ffffff", pes: "#62626b" }, recolore: TODAS },
  { id: "traje:raposa", grupo: "traje", nome: "Raposinha", preco: 160, nivel: 0, cor: "#f08a24", tipo: "raposa", cores: { principal: "#f08a24", detalhe: "#fff3e0", capuz: "#f08a24", luvas: "#3a2418", pes: "#3a2418" }, recolore: ["principal", "capuz", "luvas", "pes"] },
  { id: "traje:coelho", grupo: "traje", nome: "Coelhinho Candy", preco: 0, nivel: 10, cor: "#f7b6cf", tipo: "coelho", cores: { principal: "#ffffff", detalhe: "#a9d4f5", capuz: "#f7b6cf", luvas: "#ffffff", pes: "#ffffff" }, recolore: ["capuz", "detalhe"], ocupa: ["chapeu"] },
  { id: "traje:panda", grupo: "traje", nome: "Panda", preco: 0, nivel: 20, cor: "#f4f4f4", tipo: "panda", cores: { principal: "#f4f4f4", detalhe: "#1c1c1c", capuz: "#f4f4f4", luvas: "#1c1c1c", pes: "#1c1c1c" }, recolore: [] },
  { id: "traje:original", grupo: "traje", nome: "HOST Original", preco: 0, nivel: 30, cor: "#161616", tipo: "original", cores: { principal: "#161616", detalhe: "#ce0e0e", capuz: "#161616", luvas: "#ce0e0e", pes: "#ce0e0e" }, recolore: [], ocupa: ["roupa"] },
  { id: "traje:veterano", grupo: "traje", nome: "Veterano", preco: 0, nivel: 50, cor: "#e0ad3a", tipo: "veterano", cores: { principal: "#1a1408", detalhe: "#f2c14e", capuz: "#e0ad3a", luvas: "#f2c14e", pes: "#f2c14e" }, recolore: [], ocupa: ["roupa"] },

  // roupas por cima do macacão
  { id: "roupa:preta", grupo: "roupa", nome: "Camiseta preta", preco: 30, nivel: 0, cor: "#161616" },
  { id: "roupa:branca", grupo: "roupa", nome: "Camiseta branca", preco: 30, nivel: 0, cor: "#f4f4f4" },
  { id: "roupa:listrada", grupo: "roupa", nome: "Listrada HOST", preco: 50, nivel: 0, cor: "#ce0e0e", listras: ["#ce0e0e", "#161616", "#ce0e0e", "#161616", "#ce0e0e"] },
  { id: "roupa:orgulho", grupo: "roupa", nome: "Camiseta arco-íris", preco: 60, nivel: 0, cor: "#ff8c00", listras: ARCO_IRIS },
  { id: "roupa:ouro", grupo: "roupa", nome: "Moletom ouro", preco: 90, nivel: 0, cor: "#e0ad3a" },
  { id: "calca:preta", grupo: "calca", nome: "Calça preta", preco: 20, nivel: 0, cor: "#161616" },
  { id: "calca:cinza", grupo: "calca", nome: "Calça cinza", preco: 20, nivel: 0, cor: "#6b6b6b" },
  { id: "calca:vermelha", grupo: "calca", nome: "Calça vermelha", preco: 25, nivel: 0, cor: "#a50b0b" },
  { id: "calca:jeans", grupo: "calca", nome: "Jeans", preco: 30, nivel: 0, cor: "#3f5f8a" },

  // capuzes e chapéus
  { id: "chapeu:bone-vermelho", grupo: "chapeu", nome: "Boné vermelho", preco: 25, nivel: 0, cor: "#ce0e0e", tipo: "bone" },
  { id: "chapeu:bone-preto", grupo: "chapeu", nome: "Boné preto", preco: 25, nivel: 0, cor: "#161616", tipo: "bone" },
  { id: "chapeu:bone-branco", grupo: "chapeu", nome: "Boné branco", preco: 25, nivel: 0, cor: "#f4f4f4", tipo: "bone" },
  { id: "chapeu:festa", grupo: "chapeu", nome: "Chapéu de festa", preco: 40, nivel: 0, cor: "#ce0e0e", tipo: "festa", recolore: ["acessorio"] },
  { id: "chapeu:cartola", grupo: "chapeu", nome: "Cartola", preco: 60, nivel: 0, cor: "#0d0d0d", tipo: "cartola" },
  { id: "chapeu:coroa", grupo: "chapeu", nome: "Coroa", preco: 150, nivel: 0, cor: "#f2c14e", tipo: "coroa" },
  { id: "chapeu:estrela", grupo: "chapeu", nome: "Tiara de estrela", preco: 0, nivel: 5, cor: "#f2c14e", tipo: "tiara" },

  // óculos e rosto
  { id: "oculos:escuros", grupo: "oculos", nome: "Óculos escuros", preco: 30, nivel: 0, cor: "#0d0d0d" },
  { id: "oculos:visor", grupo: "oculos", nome: "Visor vermelho", preco: 80, nivel: 0, cor: "#ff2a2a" },

  // luvas e calçados
  { id: "luvas:fofas", grupo: "luvas", nome: "Luvas fofas", preco: 35, nivel: 0, cor: "#ffffff", tipo: "fofas", recolore: ["luvas"] },
  { id: "luvas:ouro", grupo: "luvas", nome: "Luvas douradas", preco: 70, nivel: 0, cor: "#f2c14e", tipo: "ouro" },
  { id: "calcado:botas", grupo: "calcado", nome: "Botinhas", preco: 35, nivel: 0, cor: "#ffffff", tipo: "botas", recolore: ["pes"] },
  { id: "calcado:tenis", grupo: "calcado", nome: "Tênis", preco: 40, nivel: 0, cor: "#f4f4f4", tipo: "tenis" },

  // costas (as bandeiras e capas antigas viraram acessórios de costas)
  { id: "capa:vermelha", grupo: "costas", nome: "Capa de herói", preco: 50, nivel: 0, cor: "#ce0e0e", tipo: "capa" },
  { id: "capa:noite", grupo: "costas", nome: "Capa da noite", preco: 70, nivel: 0, cor: "#0d0d0d", tipo: "capa" },
  { id: "costas:mochila", grupo: "costas", nome: "Mochila", preco: 45, nivel: 0, cor: "#ce0e0e", tipo: "mochila", recolore: ["acessorio"] },
  { id: "bandeira:host", grupo: "costas", nome: "Bandeira HOST", preco: 40, nivel: 0, cor: "#ce0e0e", tipo: "bandeira-host" },
  { id: "bandeira:orgulho", grupo: "costas", nome: "Bandeira LGBT+", preco: 40, nivel: 0, cor: "#ff8c00", tipo: "bandeira", listras: ARCO_IRIS },
  { id: "bandeira:trans", grupo: "costas", nome: "Bandeira trans", preco: 40, nivel: 0, cor: "#f5a9b8", tipo: "bandeira", listras: ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"] },
  { id: "bandeira:brasil", grupo: "costas", nome: "Bandeira do Brasil", preco: 40, nivel: 0, cor: "#009c3b", tipo: "bandeira-brasil" },
  { id: "costas:asas", grupo: "costas", nome: "Asas", preco: 0, nivel: 15, cor: "#ffffff", tipo: "asas" },

  // efeitos visuais
  { id: "efeito:glitter", grupo: "efeito", nome: "Glitter dourado", preco: 60, nivel: 0, cor: "#ffd45a", tipo: "glitter" },
  { id: "efeito:glitter-rosa", grupo: "efeito", nome: "Glitter rosa", preco: 60, nivel: 0, cor: "#ff7ab8", tipo: "glitter" },
  { id: "efeito:glitter-iris", grupo: "efeito", nome: "Glitter arco-íris", preco: 90, nivel: 0, cor: "#ff8c00", tipo: "glitter", listras: ARCO_IRIS },
  { id: "efeito:aureola", grupo: "efeito", nome: "Auréola", preco: 70, nivel: 0, cor: "#ffe08a", tipo: "aureola" },
  { id: "efeito:aura-vermelha", grupo: "efeito", nome: "Aura vermelha", preco: 80, nivel: 0, cor: "#ff2a1a", tipo: "aura" },
  { id: "efeito:aura-ouro", grupo: "efeito", nome: "Aura dourada", preco: 80, nivel: 0, cor: "#ffc94a", tipo: "aura" },
  { id: "efeito:aura-iris", grupo: "efeito", nome: "Aura arco-íris", preco: 120, nivel: 0, cor: "#ff8c00", tipo: "aura", listras: ARCO_IRIS },
];

const POR_ID = new Map(PECAS.map((p) => [p.id, p]));
export const peca = (id: string | undefined | null) => (id ? POR_ID.get(id) : undefined);
export const trajeDe = (v: Visual) => peca(v.traje) ?? PECAS[0]!;
/** É de graça e já vem com o pet (não é da loja nem recompensa). */
export const ehBasica = (p: Pick<Peca, "preco" | "nivel">) => p.preco === 0 && p.nivel === 0;
/** O pet tem a peça? */
export const tem = (pet: Pick<HoshiPet, "itens">, p: Peca) => ehBasica(p) || pet.itens.includes(p.id);

const HEX = /^#[0-9a-f]{6}$/i;
export const ehHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** Quais partes podem ser recoloridas com o visual atual (depende do traje e dos acessórios). */
export function partesLivres(v: Visual): ParteCor[] {
  const livres = new Set<ParteCor>(trajeDe(v).recolore ?? []);
  for (const g of ESPACOS) if (g !== "traje") for (const parte of peca(v[g])?.recolore ?? []) livres.add(parte);
  return PARTES.map((p) => p.id).filter((p) => livres.has(p));
}
/** Cor final de cada parte: a escolhida pelo usuário quando a parte é recolorível, senão a de fábrica do traje. */
export function coresDe(v: Visual): Cores {
  const fabrica: Cores = { principal: "#ce0e0e", detalhe: "#ffffff", capuz: "#ce0e0e", luvas: "#ffffff", pes: "#1c1c1c", acessorio: "#ce0e0e", ...trajeDe(v).cores };
  const livres = partesLivres(v);
  for (const parte of livres) {
    const escolhida = v.cores[parte];
    if (ehHex(escolhida)) fabrica[parte] = escolhida;
  }
  return fabrica;
}

/**
 * Veste (ou tira) uma peça respeitando as regras de combinação e diz o que saiu:
 * um traje pode ocupar outros espaços, e vestir algo num espaço ocupado troca o traje pelo clássico.
 */
export function vestirPeca(v: Visual, p: Peca): { visual: Visual; removidas: Peca[] } {
  const removidas: Peca[] = [];
  const sai = (id: string) => {
    const antiga = peca(id);
    if (antiga && antiga.id !== p.id) removidas.push(antiga);
  };
  if (p.grupo === "traje") {
    if (v.traje === p.id) return { visual: v, removidas };
    const proximo: Visual = { ...v, traje: p.id, cores: {} };
    for (const g of p.ocupa ?? []) {
      sai(v[g]);
      proximo[g] = "";
    }
    return { visual: proximo, removidas };
  }
  if (v[p.grupo] === p.id) return { visual: { ...v, [p.grupo]: "" }, removidas };
  const proximo: Visual = { ...v, [p.grupo]: p.id };
  sai(v[p.grupo]);
  if (trajeDe(v).ocupa?.includes(p.grupo)) {
    sai(v.traje);
    proximo.traje = VISUAL_PADRAO.traje;
    proximo.cores = {};
  }
  return { visual: proximo, removidas };
}

/** Cores do pelo do modelo anterior, para manter a cor de quem já tinha personalizado. */
const PELO_ANTIGO: Record<string, string> = { creme: "#f3d9b1", caramelo: "#d99a55", marrom: "#8a5a3a", preto: "#2e2a2a", cinza: "#b9b9b9", rosa: "#f6a5c0", vermelho: "#e0524d", lilas: "#c9a7f0", menta: "#a8e6c1" };

/** Lê o visual salvo (inclusive o formato do modelo anterior) aceitando só peças e cores válidas. */
export function lerVisual(bruto: unknown): Visual {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const texto = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  let origem: Record<Grupo, string>;
  let cores: Record<string, unknown> = {};
  if (texto("traje")) {
    origem = Object.fromEntries(ESPACOS.map((g) => [g, texto(g)])) as Record<Grupo, string>;
    const salvas = o["cores"];
    cores = (salvas && typeof salvas === "object" ? salvas : {}) as Record<string, unknown>;
  } else {
    // formato antigo: valores sem prefixo e capa/bandeira em campos próprios
    const antigo = (grupo: string, vazio: string) => (texto(grupo) && texto(grupo) !== vazio ? `${grupo}:${texto(grupo)}` : "");
    origem = {
      traje: VISUAL_PADRAO.traje,
      roupa: antigo("roupa", "nenhuma"),
      calca: antigo("calca", "nenhuma"),
      chapeu: antigo("chapeu", "nenhum"),
      oculos: antigo("oculos", "nenhum"),
      luvas: "",
      calcado: "",
      costas: antigo("capa", "nenhuma") || antigo("bandeira", "nenhuma"),
      efeito: antigo("efeito", "nenhum"),
    };
    const pelo = PELO_ANTIGO[texto("pelo")];
    if (pelo) cores = { principal: pelo, capuz: pelo };
  }
  const out: Visual = { ...VISUAL_PADRAO, cores: {} };
  for (const g of ESPACOS) {
    const p = peca(origem[g]);
    if (p && p.grupo === g) out[g] = p.id;
  }
  for (const parte of PARTES) if (ehHex(cores[parte.id])) out.cores[parte.id] = cores[parte.id] as string;
  return out;
}

/** Quanto cada barra cai por hora. */
const DESGASTE: Record<Barra, number> = { fome: 5, sede: 7, energia: 2, carinho: 4 };
export const BARRAS: Barra[] = ["fome", "sede", "energia", "carinho"];
export const NIVEL_MAX = 99;

const limitar = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Aplica o desgaste do tempo que passou desde o último cuidado. */
export function aoVivo(pet: HoshiPet, agora = Date.now()): HoshiPet {
  const horas = Math.max(0, (agora - new Date(pet.cuidado_em).getTime()) / 3_600_000);
  return {
    ...pet,
    fome: limitar(pet.fome - DESGASTE.fome * horas),
    sede: limitar(pet.sede - DESGASTE.sede * horas),
    energia: limitar(pet.energia - DESGASTE.energia * horas),
    carinho: limitar(pet.carinho - DESGASTE.carinho * horas),
  };
}

/* ---------------- nível ---------------- */

/** XP total necessário para chegar a um nível. */
export const xpDoNivel = (nivel: number) => 40 * (nivel - 1) * (nivel - 1);
export const nivelDoXp = (xp: number) => Math.min(NIVEL_MAX, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40)));

export function progresso(xp: number) {
  const nivel = nivelDoXp(xp);
  const base = xpDoNivel(nivel);
  const proximo = xpDoNivel(nivel + 1);
  return { nivel, noNivel: xp - base, paraSubir: proximo - base, pct: nivel >= NIVEL_MAX ? 100 : ((xp - base) / (proximo - base)) * 100 };
}

const TITULOS = [
  { min: 1, nome: "Filhote" },
  { min: 5, nome: "Mascote" },
  { min: 10, nome: "Parceiro" },
  { min: 20, nome: "Guardião" },
  { min: 35, nome: "Estrela" },
  { min: 50, nome: "Lenda da HOST" },
];
export const titulo = (nivel: number) => [...TITULOS].reverse().find((t) => nivel >= t.min)?.nome ?? "Filhote";

export type Humor = "feliz" | "normal" | "triste" | "dormindo";
export function humor(p: HoshiPet): Humor {
  if (p.energia <= 12) return "dormindo";
  const media = (p.fome + p.sede + p.carinho) / 3;
  return media >= 65 ? "feliz" : media >= 30 ? "normal" : "triste";
}

export function fala(p: HoshiPet): string {
  if (p.energia <= 12) return "Zzz… preciso de uma soneca.";
  const menor = BARRAS.filter((b) => b !== "energia").sort((a, b) => p[a] - p[b])[0] ?? "fome";
  if (p[menor] < 30) return { fome: "Tô com fome! Tem um petisco aí?", sede: "Que sede… me dá uma água?", carinho: "Senti sua falta. Faz um carinho?", energia: "" }[menor];
  if (humor(p) === "feliz") return "Tô feliz demais hoje!";
  return "Bora trabalhar junto?";
}

/* ---------------- cuidados ---------------- */

export interface Cuidado {
  id: "comida" | "bebida" | "carinho" | "soneca";
  label: string;
  barra: Barra;
  ganho: number;
  xp: number;
}
export const CUIDADOS: Cuidado[] = [
  { id: "comida", label: "Comida", barra: "fome", ganho: 28, xp: 8 },
  { id: "bebida", label: "Bebida", barra: "sede", ganho: 30, xp: 6 },
  { id: "carinho", label: "Carinho", barra: "carinho", ganho: 22, xp: 5 },
  { id: "soneca", label: "Soneca", barra: "energia", ganho: 45, xp: 5 },
];

/** Jogar cansa: cada partida gasta energia. */
export const ENERGIA_POR_JOGO = 12;
/** Teto de XP por partida, para o ranking refletir cuidado e não só cliques. */
export const XP_MAX_JOGO = 36;

/* ---------------- nomes ---------------- */

const PREFIXOS = ["Capitão", "Dona", "Sir", "Mestre", "Chef", "Xerife", "Dr.", "Mini", "Super", "Lorde"];
const NOMES = ["Hoshi", "Floco", "Pipoca", "Algodão", "Estrela", "Nuvem", "Biscoito", "Pompom", "Cometa", "Trovão"];
export function sugerirNome(): string {
  const sorteio = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)] as T;
  return Math.random() < 0.5 ? sorteio(NOMES) : `${sorteio(PREFIXOS)} ${sorteio(NOMES)}`;
}
export const nomeValido = (n: string) => /^[\p{L}\p{N} .'-]{2,18}$/u.test(n.trim());

/* ---------------- banco ---------------- */

type Linha = Omit<HoshiPet, "visual" | "itens"> & { visual: unknown; itens: unknown };
const doBanco = (d: Linha): HoshiPet => ({ ...d, visual: lerVisual(d.visual), itens: Array.isArray(d.itens) ? d.itens.filter((i): i is string => typeof i === "string") : [] });

const COLUNAS = "user_id, username, nome, xp, fome, sede, energia, carinho, recorde_petiscos, recorde_reflexo, cuidado_em, visual, coins, itens";

/** Busca o pet do usuário logado; na primeira vez, cria um filhote. */
export async function meuPet(): Promise<HoshiPet> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Sessão não disponível.");
  const id = auth.user.id;
  const { data } = await supabase.from("hoshi_pets").select(COLUNAS).eq("user_id", id).maybeSingle();
  if (data) return doBanco(data);
  const { data: perfil } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle();
  const { data: novo, error } = await supabase
    .from("hoshi_pets")
    .insert({ user_id: id, username: perfil?.username ?? "" })
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return doBanco(novo);
}

/** Salva o estado atual do pet (barras já com o desgaste aplicado). */
export async function salvarPet(pet: HoshiPet, patch: Partial<Omit<HoshiPet, "user_id" | "username" | "cuidado_em" | "coins" | "itens">>): Promise<HoshiPet> {
  const vivo = aoVivo(pet);
  const agora = new Date().toISOString();
  const { visual, ...resto } = patch;
  const proximo = { fome: vivo.fome, sede: vivo.sede, energia: vivo.energia, carinho: vivo.carinho, ...resto, ...(visual ? { visual: { ...visual } } : {}), cuidado_em: agora, updated_at: agora };
  const { data, error } = await supabase.from("hoshi_pets").update(proximo).eq("user_id", pet.user_id).select(COLUNAS).single();
  if (error) throw error;
  return doBanco(data);
}

export async function rankingPets(): Promise<HoshiPet[]> {
  const { data, error } = await supabase.from("hoshi_pets").select(COLUNAS).order("xp", { ascending: false }).limit(10);
  if (error) throw error;
  return (data ?? []).map((p) => (doBanco(p)));
}

/** Todos os pets, por nome do staff (para o painel de entrega de coins). */
export async function todosPets(): Promise<HoshiPet[]> {
  const { data, error } = await supabase.from("hoshi_pets").select(COLUNAS).order("username").limit(300);
  if (error) throw error;
  return (data ?? []).map((p) => doBanco(p));
}

/** Quem pode entregar Staff Coins. A regra de verdade é conferida no banco. */
export const ENTREGADOR_DE_COINS = "henrique";

/** Entrega (ou tira, com número negativo) Staff Coins de um staff. Só funciona para o henrique. */
export async function darCoins(userId: string, quantidade: number): Promise<number> {
  const { data, error } = await supabase.rpc("hoshi_dar_coins" as never, { p_alvo: userId, p_qtd: quantidade } as never);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Compra uma peça da loja com os coins do próprio pet. O preço é o do banco. */
export async function comprarItem(p: Peca): Promise<void> {
  const { error } = await supabase.rpc("hoshi_comprar" as never, { p_item: p.id } as never);
  if (error) throw new Error(error.message);
}

/** Resgata de graça uma recompensa de nível. O banco confere o nível do pet. */
export async function resgatarItem(p: Peca): Promise<void> {
  const { error } = await supabase.rpc("hoshi_resgatar" as never, { p_item: p.id } as never);
  if (error) throw new Error(error.message);
}

/**
 * Catálogo com preço e nível vindos do banco (hoshi_loja). Se a tabela não
 * responder, vale o padrão do código — a compra continua sendo conferida no banco.
 */
export async function catalogo(): Promise<Peca[]> {
  const { data } = await supabase.from("hoshi_loja" as never).select("item, preco, nivel");
  const config = new Map(((data ?? []) as { item: string; preco: number; nivel: number | null }[]).map((l) => [l.item, l]));
  return PECAS.map((p) => {
    const c = config.get(p.id);
    return c ? { ...p, preco: c.preco, nivel: c.nivel ?? 0 } : p;
  });
}
