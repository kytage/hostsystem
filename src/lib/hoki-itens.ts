/**
 * Itens da mochila do HOKI (comidas e bebidas) e o que a fazenda dá.
 * A mochila aguenta 50 kg. Comer e beber gastam o item e enchem as barras.
 */
export interface Item {
  id: string;
  nome: string;
  emoji: string;
  /** Peso de uma unidade, em quilos. */
  peso: number;
  /** comida e bebida enchem as barras; presente é para dar aos outros (e também dá para usar). */
  tipo: "comida" | "bebida" | "presente";
  /** Nome do botão de usar, nos presentes ("Cheirar", "Abraçar"...). */
  usar?: string;
  /** Quanto cada barra sobe ao consumir uma unidade. */
  fome?: number;
  sede?: number;
  energia?: number;
  carinho?: number;
}

export const LIMITE_DA_MOCHILA = 50;

export const ITENS: Item[] = [
  // comidas da horta
  { id: "milho", nome: "Milho", emoji: "🌽", peso: 0.3, tipo: "comida", fome: 16 },
  { id: "cenoura", nome: "Cenoura", emoji: "🥕", peso: 0.15, tipo: "comida", fome: 10 },
  { id: "tomate", nome: "Tomate", emoji: "🍅", peso: 0.15, tipo: "comida", fome: 9, sede: 3 },
  { id: "batata", nome: "Batata", emoji: "🥔", peso: 0.25, tipo: "comida", fome: 14 },
  { id: "morango", nome: "Morango", emoji: "🍓", peso: 0.05, tipo: "comida", fome: 6, carinho: 3 },
  { id: "abobora", nome: "Abóbora", emoji: "🎃", peso: 2.5, tipo: "comida", fome: 40 },
  { id: "melancia", nome: "Melancia", emoji: "🍉", peso: 4, tipo: "comida", fome: 32, sede: 24 },
  { id: "uva", nome: "Uva", emoji: "🍇", peso: 0.3, tipo: "comida", fome: 10, sede: 8 },
  // frutas do pomar
  { id: "maca", nome: "Maçã", emoji: "🍎", peso: 0.2, tipo: "comida", fome: 12 },
  { id: "banana", nome: "Banana", emoji: "🍌", peso: 0.15, tipo: "comida", fome: 11, energia: 4 },
  { id: "laranja", nome: "Laranja", emoji: "🍊", peso: 0.2, tipo: "comida", fome: 8, sede: 12 },
  // dos bichos
  { id: "ovo", nome: "Ovo", emoji: "🥚", peso: 0.06, tipo: "comida", fome: 8, energia: 3 },
  // bebidas
  { id: "agua", nome: "Água da mina", emoji: "💧", peso: 0.5, tipo: "bebida", sede: 30 },
  { id: "leite", nome: "Leite", emoji: "🥛", peso: 0.5, tipo: "bebida", sede: 22, fome: 8 },
  {
    id: "coco",
    nome: "Água de coco",
    emoji: "🥥",
    peso: 0.8,
    tipo: "bebida",
    sede: 34,
    energia: 4,
  },
  { id: "cafe", nome: "Café", emoji: "☕", peso: 0.2, tipo: "bebida", sede: 10, energia: 18 },
  // presentes: colhidos na floricultura e na doceria da praça, para dar a outros HOKIs
  {
    id: "rosa",
    nome: "Rosa",
    emoji: "🌹",
    peso: 0.05,
    tipo: "presente",
    usar: "Cheirar",
    carinho: 6,
  },
  {
    id: "girassol",
    nome: "Girassol",
    emoji: "🌻",
    peso: 0.08,
    tipo: "presente",
    usar: "Cheirar",
    carinho: 5,
  },
  {
    id: "tulipa",
    nome: "Tulipa",
    emoji: "🌷",
    peso: 0.05,
    tipo: "presente",
    usar: "Cheirar",
    carinho: 5,
  },
  {
    id: "chocolate",
    nome: "Chocolate",
    emoji: "🍫",
    peso: 0.1,
    tipo: "presente",
    usar: "Comer",
    fome: 6,
    carinho: 8,
  },
  {
    id: "bala",
    nome: "Bala",
    emoji: "🍬",
    peso: 0.01,
    tipo: "presente",
    usar: "Comer",
    fome: 2,
    carinho: 4,
  },
  {
    id: "ursinho",
    nome: "Ursinho",
    emoji: "🧸",
    peso: 0.4,
    tipo: "presente",
    usar: "Abraçar",
    carinho: 15,
  },
];
const POR_ID = new Map(ITENS.map((i) => [i.id, i]));
export const item = (id: string) => POR_ID.get(id);

/** O que cada lugar da fazenda dá: o item, quantos por colheita e em quanto tempo nasce de novo. */
export type Cultura =
  | "milho"
  | "cenoura"
  | "tomate"
  | "batata"
  | "morango"
  | "abobora"
  | "melancia"
  | "uva"
  | "maca"
  | "banana"
  | "laranja"
  | "coco"
  | "cafe"
  | "ovo"
  | "leite"
  | "agua"
  | "rosa"
  | "girassol"
  | "tulipa"
  | "chocolate"
  | "bala"
  | "ursinho";
const MIN = 60_000;
export const CULTURAS: Record<
  Cultura,
  { item: string; quantos: number; cresce: number; verbo: string }
> = {
  milho: { item: "milho", quantos: 2, cresce: 4 * MIN, verbo: "colher" },
  cenoura: { item: "cenoura", quantos: 2, cresce: 3 * MIN, verbo: "colher" },
  tomate: { item: "tomate", quantos: 2, cresce: 3 * MIN, verbo: "colher" },
  batata: { item: "batata", quantos: 2, cresce: 4 * MIN, verbo: "colher" },
  morango: { item: "morango", quantos: 3, cresce: 2.5 * MIN, verbo: "colher" },
  abobora: { item: "abobora", quantos: 1, cresce: 8 * MIN, verbo: "colher" },
  melancia: { item: "melancia", quantos: 1, cresce: 10 * MIN, verbo: "colher" },
  uva: { item: "uva", quantos: 2, cresce: 5 * MIN, verbo: "colher" },
  maca: { item: "maca", quantos: 2, cresce: 5 * MIN, verbo: "apanhar" },
  banana: { item: "banana", quantos: 3, cresce: 6 * MIN, verbo: "apanhar" },
  laranja: { item: "laranja", quantos: 2, cresce: 5 * MIN, verbo: "apanhar" },
  coco: { item: "coco", quantos: 1, cresce: 7 * MIN, verbo: "apanhar" },
  cafe: { item: "cafe", quantos: 2, cresce: 6 * MIN, verbo: "colher" },
  ovo: { item: "ovo", quantos: 2, cresce: 4 * MIN, verbo: "pegar" },
  leite: { item: "leite", quantos: 1, cresce: 6 * MIN, verbo: "tirar" },
  agua: { item: "agua", quantos: 1, cresce: 0.5 * MIN, verbo: "encher" },
  rosa: { item: "rosa", quantos: 2, cresce: 3 * MIN, verbo: "colher" },
  girassol: { item: "girassol", quantos: 1, cresce: 3 * MIN, verbo: "colher" },
  tulipa: { item: "tulipa", quantos: 2, cresce: 3 * MIN, verbo: "colher" },
  chocolate: { item: "chocolate", quantos: 1, cresce: 5 * MIN, verbo: "pegar" },
  bala: { item: "bala", quantos: 3, cresce: 3 * MIN, verbo: "pegar" },
  ursinho: { item: "ursinho", quantos: 1, cresce: 10 * MIN, verbo: "pegar" },
};

/** Peso da mochila inteira, em quilos. */
export function pesoDaMochila(inventario: Record<string, number>) {
  let kg = 0;
  for (const [id, n] of Object.entries(inventario)) kg += (item(id)?.peso ?? 0) * n;
  return Math.round(kg * 100) / 100;
}

/** Quantas unidades deste item ainda cabem na mochila. */
export function quantosCabem(inventario: Record<string, number>, id: string) {
  const peso = item(id)?.peso ?? 0;
  if (peso <= 0) return 0;
  return Math.max(0, Math.floor((LIMITE_DA_MOCHILA - pesoDaMochila(inventario) + 1e-6) / peso));
}

/** O quanto o lugar da fazenda já cresceu (0 = acabou de ser colhido, 1 = pronto). */
export function crescimento(cultura: Cultura, colhidoEm: number | undefined, agora = Date.now()) {
  if (!colhidoEm) return 1;
  return Math.min(1, Math.max(0, (agora - colhidoEm) / CULTURAS[cultura].cresce));
}

/** "2 min" ou "40 s": quanto falta para o lugar ficar pronto de novo. */
export function faltaParaCrescer(
  cultura: Cultura,
  colhidoEm: number | undefined,
  agora = Date.now(),
) {
  const resto = colhidoEm ? CULTURAS[cultura].cresce - (agora - colhidoEm) : 0;
  if (resto <= 0) return "";
  return resto >= MIN ? `${Math.ceil(resto / MIN)} min` : `${Math.ceil(resto / 1000)} s`;
}
