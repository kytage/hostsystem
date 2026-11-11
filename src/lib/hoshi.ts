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

/* ---------------- aparência (grátis) e loja (Staff Coins) ---------------- */

export interface Visual {
  pelo: string;
  olhos: string;
  cabelo: string;
  corCabelo: string;
  roupa: string;
  calca: string;
  chapeu: string;
  oculos: string;
  capa: string;
  bandeira: string;
  efeito: string;
}
/** Grupos vendidos na loja. Pelo, olhos e cabelo são de graça e ficam fora daqui. */
export type Grupo = "roupa" | "calca" | "chapeu" | "oculos" | "capa" | "bandeira" | "efeito";

export const VISUAL_PADRAO: Visual = {
  pelo: "branco",
  olhos: "mel",
  cabelo: "nenhum",
  corCabelo: "preto",
  roupa: "host",
  calca: "nenhuma",
  chapeu: "nenhum",
  oculos: "nenhum",
  capa: "nenhuma",
  bandeira: "nenhuma",
  efeito: "nenhum",
};

export interface Opcao {
  id: string;
  nome: string;
  cor: string;
}
export const PELOS: Opcao[] = [
  { id: "branco", nome: "Branco", cor: "#fff6ec" },
  { id: "creme", nome: "Creme", cor: "#f3d9b1" },
  { id: "caramelo", nome: "Caramelo", cor: "#d99a55" },
  { id: "marrom", nome: "Marrom", cor: "#8a5a3a" },
  { id: "preto", nome: "Preto", cor: "#2e2a2a" },
  { id: "cinza", nome: "Cinza", cor: "#b9b9b9" },
  { id: "rosa", nome: "Rosa", cor: "#f6a5c0" },
  { id: "vermelho", nome: "Vermelho", cor: "#e0524d" },
  { id: "lilas", nome: "Lilás", cor: "#c9a7f0" },
  { id: "menta", nome: "Menta", cor: "#a8e6c1" },
];
export const OLHOS: Opcao[] = [
  { id: "mel", nome: "Mel", cor: "#c98a1f" },
  { id: "castanho", nome: "Castanho", cor: "#6b3f1d" },
  { id: "verde", nome: "Verde", cor: "#3fa34d" },
  { id: "azul", nome: "Azul", cor: "#3b8fd9" },
  { id: "cinza", nome: "Cinza", cor: "#8d9199" },
  { id: "vermelho", nome: "Vermelho", cor: "#ce0e0e" },
  { id: "roxo", nome: "Roxo", cor: "#8a4fd9" },
];
export const CABELOS: { id: string; nome: string; genero: "masculino" | "feminino" | null }[] = [
  { id: "nenhum", nome: "Sem cabelo", genero: null },
  { id: "topete", nome: "Topete", genero: "masculino" },
  { id: "espetado", nome: "Espetado", genero: "masculino" },
  { id: "franja", nome: "Franja curta", genero: "masculino" },
  { id: "longo", nome: "Longo", genero: "feminino" },
  { id: "chiquinhas", nome: "Maria-chiquinha", genero: "feminino" },
  { id: "coque", nome: "Coque", genero: "feminino" },
];
export const CORES_CABELO: Opcao[] = [
  { id: "preto", nome: "Preto", cor: "#1c1717" },
  { id: "castanho", nome: "Castanho", cor: "#6a3d1f" },
  { id: "loiro", nome: "Loiro", cor: "#e8c15a" },
  { id: "ruivo", nome: "Ruivo", cor: "#c8501e" },
  { id: "branco", nome: "Branco", cor: "#f1f1f1" },
  { id: "rosa", nome: "Rosa", cor: "#f277a8" },
  { id: "vermelho", nome: "Vermelho", cor: "#ce0e0e" },
];

export const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: "roupa", nome: "Roupas" },
  { id: "calca", nome: "Calças" },
  { id: "chapeu", nome: "Bonés e chapéus" },
  { id: "oculos", nome: "Óculos" },
  { id: "capa", nome: "Capas" },
  { id: "bandeira", nome: "Bandeiras" },
  { id: "efeito", nome: "Glitter e auras" },
];

export const ARCO_IRIS = ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"];

export interface Peca {
  grupo: Grupo;
  valor: string;
  nome: string;
  /** Preço em Staff Coins. Zero = já vem com o pet. */
  preco: number;
  cor: string;
  /** Formato da peça, quando o grupo tem mais de um (boné, cartola, glitter, aura…). */
  tipo?: string;
  /** Listras horizontais, de cima para baixo. */
  listras?: string[];
}
/** Loja do HOSHI. Os preços valem de verdade no banco (tabela hoshi_loja); aqui é só a vitrine. */
export const PECAS: Peca[] = [
  { grupo: "roupa", valor: "host", nome: "Camiseta HOST", preco: 0, cor: "#ce0e0e" },
  { grupo: "roupa", valor: "nenhuma", nome: "Sem roupa", preco: 0, cor: "#2a2a2a" },
  { grupo: "roupa", valor: "preta", nome: "Camiseta preta", preco: 30, cor: "#161616" },
  { grupo: "roupa", valor: "branca", nome: "Camiseta branca", preco: 30, cor: "#f4f4f4" },
  { grupo: "roupa", valor: "listrada", nome: "Listrada HOST", preco: 50, cor: "#ce0e0e", listras: ["#ce0e0e", "#161616", "#ce0e0e", "#161616", "#ce0e0e"] },
  { grupo: "roupa", valor: "orgulho", nome: "Camiseta arco-íris", preco: 60, cor: "#ff8c00", listras: ARCO_IRIS },
  { grupo: "roupa", valor: "ouro", nome: "Moletom ouro", preco: 90, cor: "#e0ad3a" },

  { grupo: "calca", valor: "nenhuma", nome: "Sem calça", preco: 0, cor: "#2a2a2a" },
  { grupo: "calca", valor: "preta", nome: "Calça preta", preco: 20, cor: "#161616" },
  { grupo: "calca", valor: "cinza", nome: "Calça cinza", preco: 20, cor: "#6b6b6b" },
  { grupo: "calca", valor: "vermelha", nome: "Calça vermelha", preco: 25, cor: "#a50b0b" },
  { grupo: "calca", valor: "jeans", nome: "Jeans", preco: 30, cor: "#3f5f8a" },

  { grupo: "chapeu", valor: "nenhum", nome: "Sem chapéu", preco: 0, cor: "#2a2a2a" },
  { grupo: "chapeu", valor: "bone-vermelho", nome: "Boné vermelho", preco: 25, cor: "#ce0e0e", tipo: "bone" },
  { grupo: "chapeu", valor: "bone-preto", nome: "Boné preto", preco: 25, cor: "#161616", tipo: "bone" },
  { grupo: "chapeu", valor: "bone-branco", nome: "Boné branco", preco: 25, cor: "#f4f4f4", tipo: "bone" },
  { grupo: "chapeu", valor: "festa", nome: "Chapéu de festa", preco: 40, cor: "#ce0e0e", tipo: "festa" },
  { grupo: "chapeu", valor: "cartola", nome: "Cartola", preco: 60, cor: "#0d0d0d", tipo: "cartola" },
  { grupo: "chapeu", valor: "coroa", nome: "Coroa", preco: 150, cor: "#f2c14e", tipo: "coroa" },

  { grupo: "oculos", valor: "nenhum", nome: "Sem óculos", preco: 0, cor: "#2a2a2a" },
  { grupo: "oculos", valor: "escuros", nome: "Óculos escuros", preco: 30, cor: "#0d0d0d" },
  { grupo: "oculos", valor: "visor", nome: "Visor vermelho", preco: 80, cor: "#ff2a2a" },

  { grupo: "capa", valor: "nenhuma", nome: "Sem capa", preco: 0, cor: "#2a2a2a" },
  { grupo: "capa", valor: "vermelha", nome: "Capa de herói", preco: 50, cor: "#ce0e0e" },
  { grupo: "capa", valor: "noite", nome: "Capa da noite", preco: 70, cor: "#0d0d0d" },

  { grupo: "bandeira", valor: "nenhuma", nome: "Sem bandeira", preco: 0, cor: "#2a2a2a" },
  { grupo: "bandeira", valor: "host", nome: "Bandeira HOST", preco: 40, cor: "#ce0e0e", tipo: "host" },
  { grupo: "bandeira", valor: "orgulho", nome: "Bandeira LGBT+", preco: 40, cor: "#ff8c00", listras: ARCO_IRIS },
  { grupo: "bandeira", valor: "trans", nome: "Bandeira trans", preco: 40, cor: "#f5a9b8", listras: ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"] },
  { grupo: "bandeira", valor: "brasil", nome: "Bandeira do Brasil", preco: 40, cor: "#009c3b", tipo: "brasil" },

  { grupo: "efeito", valor: "nenhum", nome: "Sem efeito", preco: 0, cor: "#2a2a2a" },
  { grupo: "efeito", valor: "glitter", nome: "Glitter dourado", preco: 60, cor: "#ffd45a", tipo: "glitter" },
  { grupo: "efeito", valor: "glitter-rosa", nome: "Glitter rosa", preco: 60, cor: "#ff7ab8", tipo: "glitter" },
  { grupo: "efeito", valor: "glitter-iris", nome: "Glitter arco-íris", preco: 90, cor: "#ff8c00", tipo: "glitter", listras: ARCO_IRIS },
  { grupo: "efeito", valor: "aureola", nome: "Auréola", preco: 70, cor: "#ffe08a", tipo: "aureola" },
  { grupo: "efeito", valor: "aura-vermelha", nome: "Aura vermelha", preco: 80, cor: "#ff2a1a", tipo: "aura" },
  { grupo: "efeito", valor: "aura-ouro", nome: "Aura dourada", preco: 80, cor: "#ffc94a", tipo: "aura" },
  { grupo: "efeito", valor: "aura-iris", nome: "Aura arco-íris", preco: 120, cor: "#ff8c00", tipo: "aura", listras: ARCO_IRIS },
];

export const idItem = (p: Pick<Peca, "grupo" | "valor">) => `${p.grupo}:${p.valor}`;
export const pecaDe = (grupo: Grupo, valor: string) => PECAS.find((p) => p.grupo === grupo && p.valor === valor);
/** O pet tem a peça? As de preço zero já vêm com ele. */
export const tem = (pet: Pick<HoshiPet, "itens">, p: Peca) => p.preco === 0 || pet.itens.includes(idItem(p));

/** Lê o visual salvo aceitando só opções que existem (o que não bater volta ao padrão). */
export function lerVisual(v: unknown): Visual {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof Visual, unknown>>;
  const out = { ...VISUAL_PADRAO };
  const livre: [keyof Visual, { id: string }[]][] = [
    ["pelo", PELOS],
    ["olhos", OLHOS],
    ["cabelo", CABELOS],
    ["corCabelo", CORES_CABELO],
  ];
  for (const [campo, opcoes] of livre) if (opcoes.some((x) => x.id === o[campo])) out[campo] = o[campo] as string;
  for (const g of GRUPOS) if (PECAS.some((p) => p.grupo === g.id && p.valor === o[g.id])) out[g.id] = o[g.id] as string;
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
export async function comprarItem(peca: Peca): Promise<void> {
  const { error } = await supabase.rpc("hoshi_comprar" as never, { p_item: idItem(peca) } as never);
  if (error) throw new Error(error.message);
}
