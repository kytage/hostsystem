import { supabase } from "@/integrations/supabase/client";

export type Plataforma = "instagram" | "tiktok";
export type TipoPostagem = "comum" | "campanha";
export type StatusConteudo = "rascunho" | "ideia" | "roteiro" | "gravar" | "edicao" | "aprovacao" | "agendado" | "publicado";

export const PLATAFORMAS: { id: Plataforma; label: string; sigla: string; cls: string }[] = [
  { id: "instagram", label: "Instagram", sigla: "IG", cls: "border-pink-400/30 bg-pink-500/10 text-pink-200" },
  { id: "tiktok", label: "TikTok", sigla: "TT", cls: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200" },
];

export const FORMATOS = [
  { id: "reels", label: "Reels" },
  { id: "video", label: "Vídeo TikTok" },
  { id: "feed", label: "Post feed" },
  { id: "carrossel", label: "Carrossel" },
  { id: "stories", label: "Stories" },
];

export const TIPOS_POSTAGEM: { id: TipoPostagem; label: string }[] = [
  { id: "comum", label: "Comum" },
  { id: "campanha", label: "Campanha" },
];

export const STATUS_CONTEUDO: { id: StatusConteudo; label: string; dot: string }[] = [
  { id: "ideia", label: "Ideias", dot: "bg-white/40" },
  { id: "roteiro", label: "Roteiro", dot: "bg-violet-400" },
  { id: "gravar", label: "A gravar", dot: "bg-primary" },
  { id: "edicao", label: "Edição", dot: "bg-amber-400" },
  { id: "aprovacao", label: "Aprovação", dot: "bg-sky-400" },
  { id: "agendado", label: "Agendado", dot: "bg-cyan-400" },
  { id: "publicado", label: "Publicado", dot: "bg-emerald-400" },
];

export interface Conteudo {
  id: string;
  titulo: string;
  roteiro: string;
  plataformas: Plataforma[];
  formato: string;
  status: StatusConteudo;
  data_gravacao: string | null;
  data_publicacao: string | null;
  responsavel: string;
  local: string;
  link: string;
  views: number;
  curtidas: number;
  areas: string[];
  tipo_postagem: TipoPostagem;
}

export type ConteudoInput = Omit<Conteudo, "id">;

const COLUNAS = "id, titulo, roteiro, plataformas, formato, status, data_gravacao, data_publicacao, responsavel, local, link, views, curtidas, areas, tipo_postagem";

export async function fetchConteudos(): Promise<Conteudo[]> {
  const { data, error } = await supabase.from("marketing_conteudos").select(COLUNAS).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Conteudo[];
}

export async function criarConteudo(input: ConteudoInput, criadoPor: string): Promise<void> {
  const { error } = await supabase.from("marketing_conteudos").insert({ ...input, criado_por: criadoPor });
  if (error) throw error;
}

export async function atualizarConteudo(id: string, patch: Partial<ConteudoInput>): Promise<void> {
  const { error } = await supabase
    .from("marketing_conteudos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirConteudo(id: string): Promise<void> {
  const { error } = await supabase.from("marketing_conteudos").delete().eq("id", id);
  if (error) throw error;
}

/** Chave local do dia (AAAA-MM-DD), para agrupar no calendário. */
export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO do banco -> valor de <input type="datetime-local">. */
export function paraInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${chaveDia(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const deInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);
export const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
