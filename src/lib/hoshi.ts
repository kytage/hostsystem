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
}

/* ---------------- cosméticos ---------------- */

export interface Visual {
  roupa: string;
  chapeu: string;
  oculos: string;
  pescoco: string;
  capa: string;
  efeito: string;
}
export type Grupo = keyof Visual;

export const VISUAL_PADRAO: Visual = { roupa: "host", chapeu: "nenhum", oculos: "nenhum", pescoco: "colar", capa: "nenhuma", efeito: "nenhum" };

export const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: "roupa", nome: "Roupas" },
  { id: "chapeu", nome: "Chapéus" },
  { id: "oculos", nome: "Óculos" },
  { id: "pescoco", nome: "Pescoço" },
  { id: "capa", nome: "Capas" },
  { id: "efeito", nome: "Efeitos e brilhos" },
];

/** Todas as peças do guarda-roupa. Cada uma é liberada em um nível do pet. */
export const PECAS: { grupo: Grupo; valor: string; nome: string; nivel: number; cor: string }[] = [
  { grupo: "roupa", valor: "host", nome: "Camiseta HOST", nivel: 1, cor: "#ce0e0e" },
  { grupo: "roupa", valor: "preto", nome: "Moletom preto", nivel: 3, cor: "#161616" },
  { grupo: "roupa", valor: "grafite", nome: "Moletom grafite", nivel: 6, cor: "#4a4a4a" },
  { grupo: "roupa", valor: "neve", nome: "Neve", nivel: 10, cor: "#f2f2f2" },
  { grupo: "roupa", valor: "ouro", nome: "Ouro", nivel: 20, cor: "#e0ad3a" },
  { grupo: "roupa", valor: "lenda", nome: "Traje da Lenda", nivel: 40, cor: "#2a0303" },

  { grupo: "chapeu", valor: "nenhum", nome: "Sem chapéu", nivel: 1, cor: "#2a2a2a" },
  { grupo: "chapeu", valor: "bone", nome: "Boné HOST", nivel: 2, cor: "#ce0e0e" },
  { grupo: "chapeu", valor: "festa", nome: "Chapéu de festa", nivel: 5, cor: "#ce0e0e" },
  { grupo: "chapeu", valor: "cartola", nome: "Cartola", nivel: 15, cor: "#0d0d0d" },
  { grupo: "chapeu", valor: "coroa", nome: "Coroa", nivel: 35, cor: "#f2c14e" },

  { grupo: "oculos", valor: "nenhum", nome: "Sem óculos", nivel: 1, cor: "#2a2a2a" },
  { grupo: "oculos", valor: "escuros", nome: "Óculos escuros", nivel: 4, cor: "#0d0d0d" },
  { grupo: "oculos", valor: "visor", nome: "Visor vermelho", nivel: 18, cor: "#ff2a2a" },

  { grupo: "pescoco", valor: "colar", nome: "Colar de estrela", nivel: 1, cor: "#f2c14e" },
  { grupo: "pescoco", valor: "cachecol", nome: "Cachecol", nivel: 7, cor: "#ce0e0e" },
  { grupo: "pescoco", valor: "gravata", nome: "Gravata borboleta", nivel: 9, cor: "#ce0e0e" },

  { grupo: "capa", valor: "nenhuma", nome: "Sem capa", nivel: 1, cor: "#2a2a2a" },
  { grupo: "capa", valor: "vermelha", nome: "Capa de herói", nivel: 12, cor: "#ce0e0e" },
  { grupo: "capa", valor: "noite", nome: "Capa da noite", nivel: 25, cor: "#0d0d0d" },

  { grupo: "efeito", valor: "nenhum", nome: "Sem efeito", nivel: 1, cor: "#2a2a2a" },
  { grupo: "efeito", valor: "brilhos", nome: "Brilhos", nivel: 8, cor: "#f2c14e" },
  { grupo: "efeito", valor: "aura", nome: "Aura vermelha", nivel: 16, cor: "#ce0e0e" },
  { grupo: "efeito", valor: "aureola", nome: "Auréola", nivel: 30, cor: "#f2c14e" },
  { grupo: "efeito", valor: "lenda", nome: "Aura da Lenda", nivel: 45, cor: "#ff5a3a" },
];

/** Lê o visual salvo aceitando só peças que existem (o que não bater volta ao padrão). */
export function lerVisual(v: unknown): Visual {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<Grupo, unknown>>;
  const out = { ...VISUAL_PADRAO };
  for (const g of GRUPOS) {
    if (PECAS.some((p) => p.grupo === g.id && p.valor === o[g.id])) out[g.id] = o[g.id] as string;
  }
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

const COLUNAS = "user_id, username, nome, xp, fome, sede, energia, carinho, recorde_petiscos, recorde_reflexo, cuidado_em, visual";

/** Busca o pet do usuário logado; na primeira vez, cria um filhote. */
export async function meuPet(): Promise<HoshiPet> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Sessão não disponível.");
  const id = auth.user.id;
  const { data } = await supabase.from("hoshi_pets").select(COLUNAS).eq("user_id", id).maybeSingle();
  if (data) return { ...data, visual: lerVisual(data.visual) };
  const { data: perfil } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle();
  const { data: novo, error } = await supabase
    .from("hoshi_pets")
    .insert({ user_id: id, username: perfil?.username ?? "" })
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return { ...novo, visual: lerVisual(novo.visual) };
}

/** Salva o estado atual do pet (barras já com o desgaste aplicado). */
export async function salvarPet(pet: HoshiPet, patch: Partial<Omit<HoshiPet, "user_id" | "username" | "cuidado_em">>): Promise<HoshiPet> {
  const vivo = aoVivo(pet);
  const agora = new Date().toISOString();
  const { visual, ...resto } = patch;
  const proximo = { fome: vivo.fome, sede: vivo.sede, energia: vivo.energia, carinho: vivo.carinho, ...resto, ...(visual ? { visual: { ...visual } } : {}), cuidado_em: agora, updated_at: agora };
  const { data, error } = await supabase.from("hoshi_pets").update(proximo).eq("user_id", pet.user_id).select(COLUNAS).single();
  if (error) throw error;
  return { ...data, visual: lerVisual(data.visual) };
}

export async function rankingPets(): Promise<HoshiPet[]> {
  const { data, error } = await supabase.from("hoshi_pets").select(COLUNAS).order("xp", { ascending: false }).limit(10);
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, visual: lerVisual(p.visual) }));
}
