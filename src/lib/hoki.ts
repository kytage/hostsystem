/**
 * Pet HOKI: cada staff cuida do seu. As barras caem com o tempo (como no Pou),
 * cuidar e jogar dá XP, e o XP vira nível — que alimenta o ranking da equipe.
 */
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export type Barra = "fome" | "sede" | "energia" | "carinho" | "higiene";

export interface HokiPet {
  user_id: string;
  username: string;
  nome: string;
  xp: number;
  fome: number;
  sede: number;
  energia: number;
  carinho: number;
  /** Limpeza: cai com o tempo e com o trabalho na fazenda; o banho no chuveirão enche. Abaixo de 30, aparecem mosquitos. */
  higiene: number;
  recorde_petiscos: number;
  recorde_reflexo: number;
  /** Maior distância no parkour da praça, em metros. */
  recorde_parkour: number;
  /** Mochila: quantos de cada item (comida e bebida) o HOKI carrega. O limite é por peso (ver hoki-itens.ts). */
  inventario: Record<string, number>;
  /** Fazenda: quando cada canteiro foi colhido pela última vez (em milissegundos), para saber quando nasce de novo. */
  colheitas: Record<string, number>;
  cuidado_em: string;
  visual: Visual;
  /** Staff Coins: só mudam pelo banco (entrega do henrique ou compra na loja). */
  coins: number;
  /** Peças compradas, no formato "grupo:valor". */
  itens: string[];
}

/* ---------------- visual do HOKI: trajes, peças e cores ---------------- */

/** Espaços onde uma peça pode ser vestida. */
export type Grupo =
  | "traje"
  | "roupa"
  | "calca"
  | "chapeu"
  | "oculos"
  | "luvas"
  | "calcado"
  | "costas"
  | "efeito"
  | "podio";
export const ESPACOS: Grupo[] = [
  "traje",
  "roupa",
  "calca",
  "chapeu",
  "oculos",
  "luvas",
  "calcado",
  "costas",
  "efeito",
  "podio",
];
/** Espaços que nunca ficam vazios: tirar a peça volta para a básica. */
export const FIXOS: Grupo[] = ["traje", "podio"];
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
  /** Pódio onde o HOKI fica em exposição. */
  podio: string;
  cores: Partial<Cores>;
}
export const VISUAL_PADRAO: Visual = {
  traje: "traje:hoshi",
  roupa: "",
  calca: "",
  chapeu: "",
  oculos: "",
  luvas: "",
  calcado: "",
  costas: "",
  efeito: "",
  podio: "podio:pedra",
  cores: {},
};

/** Cores do corpo do HOKI: todas de graça. É o mesmo modelo, só troca o vermelho. */
export const PALETA: { nome: string; cor: string }[] = [
  { nome: "Vermelho HOST", cor: "#ce0e0e" },
  { nome: "Rosa", cor: "#f7a8c8" },
  { nome: "Coral", cor: "#f58a8a" },
  { nome: "Laranja", cor: "#f08a24" },
  { nome: "Amarelo", cor: "#f6d046" },
  { nome: "Creme", cor: "#e6d5b0" },
  { nome: "Verde menta", cor: "#8fe3b4" },
  { nome: "Verde", cor: "#3fa35b" },
  { nome: "Azul céu", cor: "#9fd8f5" },
  { nome: "Azul gelo", cor: "#a9cdf5" },
  { nome: "Azul", cor: "#3f7fe8" },
  { nome: "Azul marinho", cor: "#1f2a52" },
  { nome: "Lilás", cor: "#b08af0" },
  { nome: "Roxo", cor: "#6a3fc4" },
  { nome: "Vinho", cor: "#7a1020" },
  { nome: "Branco", cor: "#f4f4f2" },
  { nome: "Cinza", cor: "#8d8d8d" },
  { nome: "Preto", cor: "#1f1f23" },
];

/** Desligado: as roupas voltaram, agora vestidas por cima do modelo 3D original. */
export const SO_ORIGINAL = false;

export const TODAS_AS_CATEGORIAS: { id: string; nome: string; grupos: Grupo[] }[] = [
  { id: "trajes", nome: "Trajes completos", grupos: ["traje"] },
  { id: "roupas", nome: "Roupas", grupos: ["roupa", "calca"] },
  { id: "chapeus", nome: "Capuzes e chapéus", grupos: ["chapeu"] },
  { id: "rosto", nome: "Óculos e rosto", grupos: ["oculos"] },
  { id: "luvas", nome: "Luvas", grupos: ["luvas"] },
  { id: "calcados", nome: "Calçados", grupos: ["calcado"] },
  { id: "costas", nome: "Costas", grupos: ["costas"] },
  { id: "efeitos", nome: "Efeitos visuais", grupos: ["efeito"] },
  { id: "podios", nome: "Pódios", grupos: ["podio"] },
];
export const CATEGORIAS = SO_ORIGINAL
  ? TODAS_AS_CATEGORIAS.filter((c) => c.grupos.includes("podio"))
  : TODAS_AS_CATEGORIAS;

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
  /** Raridade mostrada na loja. */
  raridade?: Raridade;
  /** Peça exclusiva: só este usuário (nome de login, em minúsculas) vê e usa. Não está à venda. */
  exclusivo?: string;
}
export type Raridade = "comum" | "raro" | "epico" | "lendario";
export const RARIDADES: Record<Raridade, { nome: string; cor: string }> = {
  comum: { nome: "Comum", cor: "#8d8d8d" },
  raro: { nome: "Raro", cor: "#3f7fe8" },
  epico: { nome: "Épico", cor: "#8e5bd9" },
  lendario: { nome: "Lendário", cor: "#e0a52e" },
};

/** Fantasia completa: é o HOKI de sempre com um conjunto por cima; `ocupa` são os espaços que ela preenche. */
const fantasia = (
  id: string,
  nome: string,
  preco: number,
  nivel: number,
  principal: string,
  ocupa: Grupo[],
): Peca => ({
  id,
  grupo: "traje",
  nome,
  preco,
  nivel,
  cor: principal,
  tipo: "redonda",
  cores: { principal, detalhe: "#ffffff" },
  recolore: ["principal"],
  ocupa,
});
/**
 * Catálogo do HOKI. Preço e nível daqui são só o padrão: o banco (hoshi_loja)
 * é quem decide na hora da compra ou do resgate, e a tela lê de lá.
 * Todas as peças vestem por cima do modelo 3D original (ver pecas3d.ts);
 * as que já existiam mantêm o id de antes, para ninguém perder o que comprou.
 */
export const PECAS: Peca[] = [
  {
    id: "traje:hoshi",
    grupo: "traje",
    nome: "HOKI clássico",
    preco: 0,
    nivel: 0,
    cor: "#ce0e0e",
    tipo: "redonda",
    cores: { principal: "#ce0e0e", detalhe: "#ffffff" },
    recolore: ["principal"],
  },
  fantasia("traje:street", "Street", 140, 0, "#ce0e0e", ["roupa", "calca", "calcado"]),
  fantasia("traje:gamer", "Gamer", 160, 0, "#8fe3b4", ["roupa", "calca", "chapeu", "calcado"]),
  fantasia("traje:explorador", "Explorador", 160, 0, "#e6d5b0", [
    "roupa",
    "calca",
    "chapeu",
    "calcado",
    "costas",
  ]),
  fantasia("traje:arcoiris", "Arco-íris", 160, 0, "#f58a8a", [
    "roupa",
    "chapeu",
    "calcado",
    "costas",
  ]),
  fantasia("traje:piloto", "Piloto", 170, 0, "#ce0e0e", ["roupa", "calca", "calcado", "luvas"]),
  fantasia("traje:inverno", "Inverno", 170, 0, "#a9cdf5", ["roupa", "calca", "chapeu", "calcado"]),
  fantasia("traje:pirata", "Pirata", 180, 0, "#1f2a52", ["roupa", "calca", "chapeu", "calcado"]),
  fantasia("traje:mago", "Mago", 190, 0, "#b08af0", [
    "roupa",
    "calca",
    "chapeu",
    "calcado",
    "costas",
  ]),
  fantasia("traje:astronauta", "Astronauta", 200, 0, "#9fd8f5", [
    "roupa",
    "calca",
    "chapeu",
    "calcado",
    "luvas",
  ]),
  fantasia("traje:cyber", "Cyber", 200, 0, "#1f1f23", ["roupa", "calca", "calcado", "luvas"]),
  // conjunto exclusivo do henrique: tudo preto, com boné, óculos de neve espelhados, jaqueta de zíper e calça cargo
  {
    ...fantasia("traje:sombra", "Sombra", 0, 0, "#141416", [
      "roupa",
      "calca",
      "calcado",
      "luvas",
      "chapeu",
      "oculos",
    ]),
    raridade: "lendario",
    exclusivo: "henrique",
  },
  fantasia("traje:coelho", "Doce Candy", 0, 10, "#f7a8c8", [
    "roupa",
    "calca",
    "chapeu",
    "calcado",
    "costas",
  ]),
  fantasia("traje:panda", "Panda", 0, 20, "#f4f4f2", ["calca", "calcado", "luvas"]),
  fantasia("traje:original", "HOST Original", 0, 30, "#1f1f23", ["roupa", "calca", "calcado"]),
  fantasia("traje:veterano", "Realeza", 0, 50, "#f4f4f2", ["roupa", "chapeu", "calcado", "costas"]),

  // parte de cima
  {
    id: "roupa:vermelha",
    grupo: "roupa",
    nome: "Camiseta vermelha",
    preco: 30,
    nivel: 0,
    cor: "#d9151b",
  },
  {
    id: "roupa:branca",
    grupo: "roupa",
    nome: "Camiseta branca",
    preco: 30,
    nivel: 0,
    cor: "#f4f4f2",
  },
  {
    id: "roupa:preta",
    grupo: "roupa",
    nome: "Camiseta preta",
    preco: 30,
    nivel: 0,
    cor: "#1c1c1f",
  },
  {
    id: "roupa:listrada",
    grupo: "roupa",
    nome: "Listrada HOST",
    preco: 50,
    nivel: 0,
    cor: "#ce0e0e",
  },
  {
    id: "roupa:orgulho",
    grupo: "roupa",
    nome: "Camiseta arco-íris",
    preco: 60,
    nivel: 0,
    cor: "#ff8c00",
  },
  {
    id: "roupa:moletom-preto",
    grupo: "roupa",
    nome: "Moletom preto",
    preco: 70,
    nivel: 0,
    cor: "#1c1c1f",
  },
  {
    id: "roupa:moletom-rosa",
    grupo: "roupa",
    nome: "Moletom rosa",
    preco: 70,
    nivel: 0,
    cor: "#f79ac0",
  },
  { id: "roupa:ouro", grupo: "roupa", nome: "Moletom ouro", preco: 90, nivel: 0, cor: "#e0ad3a" },
  { id: "roupa:jeans", grupo: "roupa", nome: "Jaqueta jeans", preco: 80, nivel: 0, cor: "#3d6fb4" },
  {
    id: "roupa:college",
    grupo: "roupa",
    nome: "Jaqueta college",
    preco: 90,
    nivel: 0,
    cor: "#1c1c1f",
  },
  {
    id: "roupa:vestido",
    grupo: "roupa",
    nome: "Vestido lilás",
    preco: 80,
    nivel: 0,
    cor: "#b692e8",
  },

  // parte de baixo
  { id: "calca:jeans", grupo: "calca", nome: "Shorts jeans", preco: 30, nivel: 0, cor: "#3d6fb4" },
  { id: "calca:caqui", grupo: "calca", nome: "Shorts cáqui", preco: 30, nivel: 0, cor: "#c9b08a" },
  {
    id: "calca:preta",
    grupo: "calca",
    nome: "Shorts esportivo",
    preco: 20,
    nivel: 0,
    cor: "#1c1c1f",
  },
  {
    id: "calca:cinza",
    grupo: "calca",
    nome: "Calça de moletom",
    preco: 20,
    nivel: 0,
    cor: "#9a9aa3",
  },
  {
    id: "calca:vermelha",
    grupo: "calca",
    nome: "Calça vermelha",
    preco: 25,
    nivel: 0,
    cor: "#d9151b",
  },
  { id: "calca:saia", grupo: "calca", nome: "Saia rosa", preco: 45, nivel: 0, cor: "#f79ac0" },

  // cabeça
  {
    id: "chapeu:bone-vermelho",
    grupo: "chapeu",
    nome: "Boné vermelho",
    preco: 25,
    nivel: 0,
    cor: "#d9151b",
  },
  {
    id: "chapeu:bone-preto",
    grupo: "chapeu",
    nome: "Boné preto",
    preco: 25,
    nivel: 0,
    cor: "#1c1c1f",
  },
  {
    id: "chapeu:bone-branco",
    grupo: "chapeu",
    nome: "Boné branco",
    preco: 25,
    nivel: 0,
    cor: "#f4f4f2",
  },
  {
    id: "chapeu:bucket",
    grupo: "chapeu",
    nome: "Chapéu bucket",
    preco: 35,
    nivel: 0,
    cor: "#e0cfae",
  },
  { id: "chapeu:gorro", grupo: "chapeu", nome: "Gorro lilás", preco: 35, nivel: 0, cor: "#b692e8" },
  {
    id: "chapeu:festa",
    grupo: "chapeu",
    nome: "Chapéu de festa",
    preco: 40,
    nivel: 0,
    cor: "#ce0e0e",
  },
  { id: "chapeu:laco", grupo: "chapeu", nome: "Laço rosa", preco: 45, nivel: 0, cor: "#ff8fc8" },
  { id: "chapeu:cartola", grupo: "chapeu", nome: "Cartola", preco: 60, nivel: 0, cor: "#18181b" },
  { id: "chapeu:fones", grupo: "chapeu", nome: "Fones gamer", preco: 70, nivel: 0, cor: "#3df58a" },
  {
    id: "chapeu:explorador",
    grupo: "chapeu",
    nome: "Chapéu de explorador",
    preco: 70,
    nivel: 0,
    cor: "#d9c39a",
  },
  {
    id: "chapeu:mago",
    grupo: "chapeu",
    nome: "Chapéu de mago",
    preco: 90,
    nivel: 0,
    cor: "#6a3fc4",
  },
  {
    id: "chapeu:pirata",
    grupo: "chapeu",
    nome: "Chapéu pirata",
    preco: 90,
    nivel: 0,
    cor: "#1b1f33",
  },
  { id: "chapeu:coroa", grupo: "chapeu", nome: "Coroa", preco: 150, nivel: 0, cor: "#f2c14e" },
  {
    id: "chapeu:estrela",
    grupo: "chapeu",
    nome: "Tiara de estrela",
    preco: 0,
    nivel: 5,
    cor: "#f2c14e",
  },

  // rosto, mãos e pés
  {
    id: "oculos:escuros",
    grupo: "oculos",
    nome: "Óculos escuros",
    preco: 30,
    nivel: 0,
    cor: "#141416",
  },
  {
    id: "oculos:visor",
    grupo: "oculos",
    nome: "Visor vermelho",
    preco: 80,
    nivel: 0,
    cor: "#ff2a2a",
  },
  { id: "luvas:fofas", grupo: "luvas", nome: "Luvas brancas", preco: 35, nivel: 0, cor: "#ffffff" },
  { id: "luvas:ouro", grupo: "luvas", nome: "Luvas douradas", preco: 70, nivel: 0, cor: "#f2c14e" },
  {
    id: "calcado:tenis",
    grupo: "calcado",
    nome: "Tênis branco",
    preco: 40,
    nivel: 0,
    cor: "#fafafa",
  },
  {
    id: "calcado:tenis-rosa",
    grupo: "calcado",
    nome: "Tênis rosa",
    preco: 45,
    nivel: 0,
    cor: "#f79ac0",
  },
  {
    id: "calcado:tenis-vermelho",
    grupo: "calcado",
    nome: "Tênis vermelho e preto",
    preco: 55,
    nivel: 0,
    cor: "#d9151b",
  },
  { id: "calcado:botas", grupo: "calcado", nome: "Botinhas", preco: 35, nivel: 0, cor: "#c98a45" },

  // costas
  { id: "costas:mochila", grupo: "costas", nome: "Mochila", preco: 45, nivel: 0, cor: "#d9151b" },
  {
    id: "costas:bolsa",
    grupo: "costas",
    nome: "Bolsa a tiracolo",
    preco: 45,
    nivel: 0,
    cor: "#e0cfae",
  },
  {
    id: "capa:vermelha",
    grupo: "costas",
    nome: "Capa de herói",
    preco: 50,
    nivel: 0,
    cor: "#ce0e0e",
  },
  { id: "capa:noite", grupo: "costas", nome: "Capa da noite", preco: 70, nivel: 0, cor: "#1b1f33" },
  {
    id: "capa:host",
    grupo: "costas",
    nome: "Capa HOST",
    preco: 90,
    nivel: 0,
    cor: "#ce0e0e",
    raridade: "raro",
  },
  {
    id: "capa:gelo",
    grupo: "costas",
    nome: "Capa de gelo",
    preco: 90,
    nivel: 0,
    cor: "#a9cdf5",
    raridade: "raro",
  },
  {
    id: "capa:arcoiris",
    grupo: "costas",
    nome: "Capa arco-íris",
    preco: 110,
    nivel: 0,
    cor: "#ff9a3c",
    raridade: "raro",
  },
  {
    id: "capa:real",
    grupo: "costas",
    nome: "Capa real",
    preco: 130,
    nivel: 0,
    cor: "#b3121b",
    raridade: "epico",
  },
  {
    id: "capa:fogo",
    grupo: "costas",
    nome: "Capa de fogo",
    preco: 150,
    nivel: 0,
    cor: "#ff7a2a",
    raridade: "epico",
  },
  {
    id: "bandeira:host",
    grupo: "costas",
    nome: "Bandeira HOST",
    preco: 40,
    nivel: 0,
    cor: "#ce0e0e",
  },
  {
    id: "bandeira:orgulho",
    grupo: "costas",
    nome: "Bandeira LGBT+",
    preco: 40,
    nivel: 0,
    cor: "#ff8c00",
  },
  {
    id: "bandeira:trans",
    grupo: "costas",
    nome: "Bandeira trans",
    preco: 40,
    nivel: 0,
    cor: "#5bcefa",
  },
  {
    id: "bandeira:brasil",
    grupo: "costas",
    nome: "Bandeira do Brasil",
    preco: 40,
    nivel: 0,
    cor: "#1f9a48",
  },
  { id: "costas:asas", grupo: "costas", nome: "Asas", preco: 0, nivel: 15, cor: "#ffffff" },

  // efeitos: auras que contornam o corpo, brilhos e coisas flutuando em volta
  {
    id: "efeito:glitter",
    grupo: "efeito",
    nome: "Glitter dourado",
    preco: 60,
    nivel: 0,
    cor: "#ffe28a",
  },
  {
    id: "efeito:glitter-rosa",
    grupo: "efeito",
    nome: "Glitter rosa",
    preco: 60,
    nivel: 0,
    cor: "#ff8fc8",
  },
  { id: "efeito:aureola", grupo: "efeito", nome: "Auréola", preco: 70, nivel: 0, cor: "#ffe28a" },
  {
    id: "efeito:aura-vermelha",
    grupo: "efeito",
    nome: "Aura vermelha",
    preco: 80,
    nivel: 0,
    cor: "#ff2a2a",
    raridade: "raro",
  },
  {
    id: "efeito:aura-ouro",
    grupo: "efeito",
    nome: "Aura dourada",
    preco: 80,
    nivel: 0,
    cor: "#ffc94a",
    raridade: "raro",
  },
  {
    id: "efeito:aura-gelo",
    grupo: "efeito",
    nome: "Aura de gelo",
    preco: 90,
    nivel: 0,
    cor: "#8fd0ff",
    raridade: "raro",
  },
  {
    id: "efeito:glitter-iris",
    grupo: "efeito",
    nome: "Glitter arco-íris",
    preco: 90,
    nivel: 0,
    cor: "#c98aff",
    raridade: "raro",
  },
  {
    id: "efeito:coracoes",
    grupo: "efeito",
    nome: "Corações",
    preco: 90,
    nivel: 0,
    cor: "#ff6a9a",
    raridade: "raro",
  },
  {
    id: "efeito:estrelas",
    grupo: "efeito",
    nome: "Estrelas em volta",
    preco: 100,
    nivel: 0,
    cor: "#ffe28a",
    raridade: "epico",
  },
  {
    id: "efeito:aura-iris",
    grupo: "efeito",
    nome: "Aura arco-íris",
    preco: 120,
    nivel: 0,
    cor: "#ff8c00",
    raridade: "epico",
  },
  {
    id: "efeito:aura-prata",
    grupo: "efeito",
    nome: "Aura prateada",
    preco: 0,
    nivel: 0,
    cor: "#d9dde3",
    raridade: "lendario",
    exclusivo: "henrique",
  },
  {
    id: "efeito:fogo",
    grupo: "efeito",
    nome: "Aura de fogo",
    preco: 140,
    nivel: 0,
    cor: "#ff5a1a",
    raridade: "lendario",
  },

  // pódios: a base onde o HOKI fica em exposição, com o nível na flâmula (os que já existiam mantêm o id)
  {
    id: "podio:pedra",
    grupo: "podio",
    nome: "Clássico",
    preco: 0,
    nivel: 0,
    cor: "#d4c4ac",
    tipo: "pedra",
    raridade: "comum",
  },
  {
    id: "podio:madeira",
    grupo: "podio",
    nome: "Madeira",
    preco: 60,
    nivel: 0,
    cor: "#9a6a3c",
    tipo: "madeira",
    raridade: "comum",
  },
  {
    id: "podio:grama",
    grupo: "podio",
    nome: "Jardim",
    preco: 100,
    nivel: 0,
    cor: "#63b73f",
    tipo: "grama",
    raridade: "raro",
  },
  {
    id: "podio:cristal",
    grupo: "podio",
    nome: "Gelo",
    preco: 110,
    nivel: 0,
    cor: "#a9dcff",
    tipo: "cristal",
    raridade: "raro",
  },
  {
    id: "podio:deserto",
    grupo: "podio",
    nome: "Deserto",
    preco: 110,
    nivel: 0,
    cor: "#e3c98a",
    tipo: "deserto",
    raridade: "raro",
  },
  {
    id: "podio:lava",
    grupo: "podio",
    nome: "Vulcânico",
    preco: 180,
    nivel: 0,
    cor: "#ff5a1a",
    tipo: "lava",
    raridade: "epico",
  },
  {
    id: "podio:tecnologico",
    grupo: "podio",
    nome: "Tecnológico",
    preco: 200,
    nivel: 0,
    cor: "#23e0ff",
    tipo: "tecnologico",
    raridade: "epico",
  },
  {
    id: "podio:oceanico",
    grupo: "podio",
    nome: "Oceânico",
    preco: 200,
    nivel: 0,
    cor: "#4fd0e8",
    tipo: "oceanico",
    raridade: "epico",
  },
  {
    id: "podio:galactico",
    grupo: "podio",
    nome: "Galáctico",
    preco: 220,
    nivel: 0,
    cor: "#5a34b0",
    tipo: "galactico",
    raridade: "epico",
  },
  {
    id: "podio:nuvem",
    grupo: "podio",
    nome: "Divino",
    preco: 320,
    nivel: 0,
    cor: "#f4f1ea",
    tipo: "nuvem",
    raridade: "lendario",
  },
  {
    id: "podio:sombrio",
    grupo: "podio",
    nome: "Sombrio",
    preco: 320,
    nivel: 0,
    cor: "#8a3fd8",
    tipo: "sombrio",
    raridade: "lendario",
  },
  {
    id: "podio:campeao",
    grupo: "podio",
    nome: "Real",
    preco: 350,
    nivel: 0,
    cor: "#b3121b",
    tipo: "campeao",
    raridade: "lendario",
  },
];

const POR_ID = new Map(PECAS.map((p) => [p.id, p]));
export const peca = (id: string | undefined | null) => (id ? POR_ID.get(id) : undefined);
export const trajeDe = (v: Visual) => peca(v.traje) ?? PECAS[0]!;
/** É de graça e já vem com o pet (não é da loja nem recompensa). */
export const ehBasica = (p: Pick<Peca, "preco" | "nivel" | "exclusivo">) =>
  p.preco === 0 && p.nivel === 0 && !p.exclusivo;
/** A peça aparece para este usuário? (as exclusivas só para o dono) */
export const apareceNaLoja = (p: Peca, username: string) =>
  !p.exclusivo || p.exclusivo === username.trim().toLowerCase();
/** O pet tem a peça? */
export const tem = (pet: Pick<HokiPet, "itens">, p: Peca) =>
  ehBasica(p) || pet.itens.includes(p.id);

const HEX = /^#[0-9a-f]{6}$/i;
export const ehHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** Quais partes podem ser recoloridas com o visual atual (depende do traje e dos acessórios). */
export function partesLivres(v: Visual): ParteCor[] {
  const livres = new Set<ParteCor>(trajeDe(v).recolore ?? []);
  for (const g of ESPACOS)
    if (g !== "traje") for (const parte of peca(v[g])?.recolore ?? []) livres.add(parte);
  return PARTES.map((p) => p.id).filter((p) => livres.has(p));
}
/** Cor final de cada parte: a escolhida pelo usuário quando a parte é recolorível, senão a de fábrica do traje. */
export function coresDe(v: Visual): Cores {
  const fabrica: Cores = {
    principal: "#ce0e0e",
    detalhe: "#ffffff",
    capuz: "#ce0e0e",
    luvas: "#ffffff",
    pes: "#1c1c1c",
    acessorio: "#ce0e0e",
    ...trajeDe(v).cores,
  };
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
  if (v[p.grupo] === p.id)
    return { visual: FIXOS.includes(p.grupo) ? v : { ...v, [p.grupo]: "" }, removidas };
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
const PELO_ANTIGO: Record<string, string> = {
  creme: "#f3d9b1",
  caramelo: "#d99a55",
  marrom: "#8a5a3a",
  preto: "#2e2a2a",
  cinza: "#b9b9b9",
  rosa: "#f6a5c0",
  vermelho: "#e0524d",
  lilas: "#c9a7f0",
  menta: "#a8e6c1",
};

/** Lê o visual salvo (inclusive o formato do modelo anterior) aceitando só peças e cores válidas. */
export function lerVisual(bruto: unknown): Visual {
  if (SO_ORIGINAL) {
    // sem roupas: só o pódio escolhido continua valendo
    const podio =
      bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>)["podio"] : "";
    return {
      ...VISUAL_PADRAO,
      podio:
        typeof podio === "string" && PECAS.some((p) => p.id === podio)
          ? podio
          : VISUAL_PADRAO.podio,
      cores: {},
    };
  }
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
    const antigo = (grupo: string, vazio: string) =>
      texto(grupo) && texto(grupo) !== vazio ? `${grupo}:${texto(grupo)}` : "";
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
      podio: "",
    };
    const pelo = PELO_ANTIGO[texto("pelo")];
    if (pelo) cores = { principal: pelo, capuz: pelo };
  }
  const out: Visual = { ...VISUAL_PADRAO, cores: {} };
  for (const g of ESPACOS) {
    const p = peca(origem[g]);
    if (p && p.grupo === g) out[g] = p.id;
  }
  for (const parte of PARTES)
    if (ehHex(cores[parte.id])) out.cores[parte.id] = cores[parte.id] as string;
  return out;
}

/** Quanto cada barra cai por hora. */
const DESGASTE: Record<Barra, number> = { fome: 5, sede: 7, energia: 2, carinho: 4, higiene: 3 };
export const BARRAS: Barra[] = ["fome", "sede", "energia", "carinho", "higiene"];
/** Abaixo disso o HOKI está sujo (com mosquitos em volta). */
export const SUJO_ABAIXO_DE = 30;
export const NIVEL_MAX = 99;

const limitar = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Aplica o desgaste do tempo que passou desde o último cuidado. */
export function aoVivo(pet: HokiPet, agora = Date.now()): HokiPet {
  const horas = Math.max(0, (agora - new Date(pet.cuidado_em).getTime()) / 3_600_000);
  return {
    ...pet,
    fome: limitar(pet.fome - DESGASTE.fome * horas),
    sede: limitar(pet.sede - DESGASTE.sede * horas),
    energia: limitar(pet.energia - DESGASTE.energia * horas),
    carinho: limitar(pet.carinho - DESGASTE.carinho * horas),
    higiene: limitar(pet.higiene - DESGASTE.higiene * horas),
  };
}

/* ---------------- nível ---------------- */

/** XP total necessário para chegar a um nível. */
export const xpDoNivel = (nivel: number) => 40 * (nivel - 1) * (nivel - 1);
export const nivelDoXp = (xp: number) =>
  Math.min(NIVEL_MAX, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40)));

export function progresso(xp: number) {
  const nivel = nivelDoXp(xp);
  const base = xpDoNivel(nivel);
  const proximo = xpDoNivel(nivel + 1);
  return {
    nivel,
    noNivel: xp - base,
    paraSubir: proximo - base,
    pct: nivel >= NIVEL_MAX ? 100 : ((xp - base) / (proximo - base)) * 100,
  };
}

const TITULOS = [
  { min: 1, nome: "Filhote" },
  { min: 5, nome: "Mascote" },
  { min: 10, nome: "Parceiro" },
  { min: 20, nome: "Guardião" },
  { min: 35, nome: "Estrela" },
  { min: 50, nome: "Lenda da HOST" },
];
export const titulo = (nivel: number) =>
  [...TITULOS].reverse().find((t) => nivel >= t.min)?.nome ?? "Filhote";

export type Humor = "feliz" | "normal" | "triste" | "dormindo";
export function humor(p: HokiPet): Humor {
  if (p.energia <= 12) return "dormindo";
  const media = (p.fome + p.sede + p.carinho) / 3;
  return media >= 65 ? "feliz" : media >= 30 ? "normal" : "triste";
}

export function fala(p: HokiPet): string {
  if (p.energia <= 12) return "Zzz… preciso de uma soneca.";
  const menor = BARRAS.filter((b) => b !== "energia").sort((a, b) => p[a] - p[b])[0] ?? "fome";
  if (p[menor] < 30)
    return {
      fome: "Tô com fome! Tem um petisco aí?",
      sede: "Que sede… me dá uma água?",
      carinho: "Senti sua falta. Faz um carinho?",
      higiene: "Tô sujinho… bora no chuveirão da praça?",
      energia: "",
    }[menor];
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

/** O nome do HOKI vira letreiro 3D em cima dele: no máximo 6 letras ou números, sem espaço. */
export const NOME_MAX = 6;
const NOMES = [
  "Hoki",
  "Floco",
  "Pipoca",
  "Nuvem",
  "Cometa",
  "Trovão",
  "Pompom",
  "Bolota",
  "Paçoca",
  "Pingo",
  "Fubá",
  "Faísca",
  "Luna",
  "Thor",
  "Kiko",
  "Tico",
  "Bidu",
  "Mel",
  "Rique",
  "Fofo",
];
export function sugerirNome(): string {
  return NOMES[Math.floor(Math.random() * NOMES.length)] ?? "Hoki";
}
export function nomeValido(n: string) {
  const letras = Array.from(n.trim());
  return (
    letras.length >= 2 && letras.length <= NOME_MAX && /^[\p{L}\p{N}]+$/u.test(letras.join(""))
  );
}
/** Texto do letreiro: só letras e números, em maiúsculas, cortado em 6 (nomes antigos podem ser maiores). */
export const nomeDoLetreiro = (n: string) =>
  Array.from(n.replace(/[^\p{L}\p{N}]/gu, ""))
    .slice(0, NOME_MAX)
    .join("")
    .toUpperCase() || "HOKI";

/* ---------------- banco ---------------- */

type Linha = Omit<HokiPet, "visual" | "itens" | "inventario" | "colheitas"> & {
  visual: unknown;
  itens: unknown;
  inventario: unknown;
  colheitas: unknown;
};
/** Lê um mapa "nome → número" vindo do banco, ficando só com números válidos e não negativos. */
const numeros = (bruto: unknown): Record<string, number> =>
  bruto && typeof bruto === "object" && !Array.isArray(bruto)
    ? Object.fromEntries(
        Object.entries(bruto as Record<string, unknown>).flatMap(([k, v]) =>
          typeof v === "number" && Number.isFinite(v) && v > 0 ? [[k.slice(0, 32), v]] : [],
        ),
      )
    : {};
const doBanco = (d: Linha): HokiPet => ({
  ...d,
  visual: lerVisual(d.visual),
  itens: Array.isArray(d.itens) ? d.itens.filter((i): i is string => typeof i === "string") : [],
  inventario: numeros(d.inventario),
  colheitas: numeros(d.colheitas),
  // pets lidos antes da higiene existir (ou de uma versão antiga do site) começam limpinhos
  higiene: typeof d.higiene === "number" && Number.isFinite(d.higiene) ? d.higiene : 100,
});

const COLUNAS =
  "user_id, username, nome, xp, fome, sede, energia, carinho, higiene, recorde_petiscos, recorde_reflexo, recorde_parkour, cuidado_em, visual, coins, itens, inventario, colheitas";

/** Busca o pet do usuário logado; na primeira vez, cria um filhote. */
export async function meuPet(): Promise<HokiPet> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Sessão não disponível.");
  const id = auth.user.id;
  const { data } = await supabase
    .from("hoshi_pets")
    .select(COLUNAS)
    .eq("user_id", id)
    .maybeSingle();
  if (data) return doBanco(data);
  const { data: perfil } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  const { data: novo, error } = await supabase
    .from("hoshi_pets")
    .insert({ user_id: id, username: perfil?.username ?? "" })
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return doBanco(novo);
}

/** Salva o estado atual do pet (barras já com o desgaste aplicado). */
export async function salvarPet(
  pet: HokiPet,
  patch: Partial<Omit<HokiPet, "user_id" | "username" | "cuidado_em" | "coins" | "itens">>,
): Promise<HokiPet> {
  const vivo = aoVivo(pet);
  const agora = new Date().toISOString();
  const { visual, ...resto } = patch;
  const proximo = {
    fome: vivo.fome,
    sede: vivo.sede,
    energia: vivo.energia,
    carinho: vivo.carinho,
    higiene: vivo.higiene,
    ...resto,
    ...(visual ? { visual: { ...visual } } : {}),
    cuidado_em: agora,
    updated_at: agora,
  };
  const { data, error } = await supabase
    .from("hoshi_pets")
    .update(proximo)
    .eq("user_id", pet.user_id)
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return doBanco(data);
}

export async function rankingPets(): Promise<HokiPet[]> {
  const { data, error } = await supabase
    .from("hoshi_pets")
    .select(COLUNAS)
    .order("xp", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((p) => doBanco(p));
}

/** Ranking do parkour: quem foi mais longe (só quem já jogou). */
export async function rankingParkour(): Promise<HokiPet[]> {
  const { data, error } = await supabase
    .from("hoshi_pets")
    .select(COLUNAS)
    .gt("recorde_parkour", 0)
    .order("recorde_parkour", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((p) => doBanco(p));
}

/** Todos os pets, por nome do staff (para o painel de entrega de coins). */
export async function todosPets(): Promise<HokiPet[]> {
  const { data, error } = await supabase
    .from("hoshi_pets")
    .select(COLUNAS)
    .order("username")
    .limit(300);
  if (error) throw error;
  return (data ?? []).map((p) => doBanco(p));
}

/** Quem pode entregar Staff Coins. A regra de verdade é conferida no banco. */
export const ENTREGADOR_DE_COINS = "henrique";

/** Entrega (ou tira, com número negativo) Staff Coins de um staff. Só funciona para o henrique. */
export async function darCoins(userId: string, quantidade: number): Promise<number> {
  const { data, error } = await supabase.rpc(
    "hoshi_dar_coins" as never,
    { p_alvo: userId, p_qtd: quantidade } as never,
  );
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
  const config = new Map(
    ((data ?? []) as { item: string; preco: number; nivel: number | null }[]).map((l) => [
      l.item,
      l,
    ]),
  );
  return PECAS.map((p) => {
    const c = config.get(p.id);
    return c && !p.exclusivo ? { ...p, preco: c.preco, nivel: c.nivel ?? 0 } : p;
  });
}
