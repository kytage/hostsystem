/**
 * Leads do Marketing: possíveis clientes (criadores, líderes, comunidades) e
 * referências de tipos de vídeo da cena FiveM / cidades de RP.
 * O acesso é o mesmo do restante do Marketing (RLS can_access_marketing).
 */
import { supabase } from "@/integrations/supabase/client";

export const LEAD_STATUS = [
  { id: "novo", label: "Novo", dot: "bg-white/40" },
  { id: "contatado", label: "Contatado", dot: "bg-sky-400" },
  { id: "conversa", label: "Em conversa", dot: "bg-amber-400" },
  { id: "fechado", label: "Fechado", dot: "bg-emerald-400" },
  { id: "perdido", label: "Perdido", dot: "bg-primary" },
];

export const LEAD_TIPOS = [
  { id: "criador", label: "Criador de conteúdo" },
  { id: "streamer", label: "Streamer" },
  { id: "lider", label: "Líder de organização" },
  { id: "comunidade", label: "Comunidade / servidor" },
  { id: "player", label: "Player" },
  { id: "parceiro", label: "Marca / parceiro" },
];

export const NICHOS = [
  { id: "fivem", label: "FiveM" },
  { id: "rp", label: "Cidade RP" },
  { id: "outro", label: "Outro" },
];

export const REDES = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "twitch", label: "Twitch" },
  { id: "kick", label: "Kick" },
  { id: "discord", label: "Discord" },
  { id: "outro", label: "Outro" },
];

export const INTERESSES = [
  { id: "quente", label: "Quente" },
  { id: "morno", label: "Morno" },
  { id: "frio", label: "Frio" },
];

export const CATEGORIAS_VIDEO = [
  { id: "cinematico", label: "Trailer / Cinemático" },
  { id: "acao", label: "Ação / PVP" },
  { id: "humor", label: "Humor / Meme" },
  { id: "historia", label: "História de RP" },
  { id: "tutorial", label: "Tutorial / Dica" },
  { id: "bastidores", label: "Bastidores" },
  { id: "evento", label: "Evento" },
  { id: "anuncio", label: "Anúncio / Update" },
  { id: "react", label: "React" },
  { id: "trend", label: "Trend" },
  { id: "outro", label: "Outro" },
];

export const rotulo = (lista: { id: string; label: string }[], id: string): string => lista.find((x) => x.id === id)?.label ?? id;

export interface Lead {
  id: string;
  nome: string;
  tipo: string;
  nicho: string;
  plataforma: string;
  link: string;
  contato: string;
  seguidores: number;
  status: string;
  interesse: string;
  notas: string;
  responsavel: string;
  proximo_contato: string | null;
  created_at: string;
}
export type LeadInput = Omit<Lead, "id" | "created_at">;

export interface Referencia {
  id: string;
  titulo: string;
  link: string;
  plataforma: string;
  categoria: string;
  nicho: string;
  canal: string;
  views: number;
  notas: string;
  created_at: string;
}
export type ReferenciaInput = Omit<Referencia, "id" | "created_at">;

export const LEAD_VAZIO: LeadInput = {
  nome: "",
  tipo: "criador",
  nicho: "fivem",
  plataforma: "instagram",
  link: "",
  contato: "",
  seguidores: 0,
  status: "novo",
  interesse: "morno",
  notas: "",
  responsavel: "",
  proximo_contato: null,
};

export const REFERENCIA_VAZIA: ReferenciaInput = {
  titulo: "",
  link: "",
  plataforma: "tiktok",
  categoria: "outro",
  nicho: "fivem",
  canal: "",
  views: 0,
  notas: "",
};

const COLS_LEAD = "id, nome, tipo, nicho, plataforma, link, contato, seguidores, status, interesse, notas, responsavel, proximo_contato, created_at";
const COLS_REF = "id, titulo, link, plataforma, categoria, nicho, canal, views, notas, created_at";

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from("marketing_leads").select(COLS_LEAD).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarLead(input: LeadInput, criadoPor: string): Promise<void> {
  const { error } = await supabase.from("marketing_leads").insert({ ...input, criado_por: criadoPor });
  if (error) throw error;
}

export async function atualizarLead(id: string, patch: Partial<LeadInput>): Promise<void> {
  const { error } = await supabase
    .from("marketing_leads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirLead(id: string): Promise<void> {
  const { error } = await supabase.from("marketing_leads").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchReferencias(): Promise<Referencia[]> {
  const { data, error } = await supabase.from("marketing_referencias").select(COLS_REF).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarReferencia(input: ReferenciaInput, criadoPor: string): Promise<void> {
  const { error } = await supabase.from("marketing_referencias").insert({ ...input, criado_por: criadoPor });
  if (error) throw error;
}

export async function atualizarReferencia(id: string, patch: Partial<ReferenciaInput>): Promise<void> {
  const { error } = await supabase.from("marketing_referencias").update(patch).eq("id", id);
  if (error) throw error;
}

export async function excluirReferencia(id: string): Promise<void> {
  const { error } = await supabase.from("marketing_referencias").delete().eq("id", id);
  if (error) throw error;
}

export const ehLink = (texto: string): boolean => /^https?:\/\/\S+$/i.test(texto.trim());

/** Descobre a rede e o @usuario a partir de um link colado. */
export function lerLink(url: string): { plataforma: string; usuario: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m|vm)\./, "").toLowerCase();
  const partes = u.pathname.split("/").filter(Boolean);
  const primeira = partes[0] ?? "";
  const semArroba = (v: string) => v.replace(/^@/, "");
  const reservadas = new Set(["p", "reel", "reels", "stories", "explore", "watch", "shorts", "channel", "c", "playlist", "videos", "video", "invite", "t", "embed"]);
  const usuario = primeira && !reservadas.has(primeira.toLowerCase()) ? semArroba(primeira) : "";

  if (host === "instagram.com") return { plataforma: "instagram", usuario };
  if (host === "tiktok.com") return { plataforma: "tiktok", usuario: primeira.startsWith("@") ? semArroba(primeira) : "" };
  if (host === "youtube.com" || host === "youtu.be") return { plataforma: "youtube", usuario: primeira.startsWith("@") ? semArroba(primeira) : "" };
  if (host === "twitch.tv") return { plataforma: "twitch", usuario };
  if (host === "kick.com") return { plataforma: "kick", usuario };
  if (host === "discord.gg" || host === "discord.com") return { plataforma: "discord", usuario: "" };
  return { plataforma: "outro", usuario: "" };
}
