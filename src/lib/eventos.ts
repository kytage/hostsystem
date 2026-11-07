import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getAuthUserData } from "@/lib/auth-cache";

export type EventoTipo =
  | "reuniao_staff"
  | "reuniao_imperio"
  | "evento_host"
  | "evento_races"
  | "evento_kids"
  | "competitive"
  | "var"
  | "mega_crash"
  | "dominas";

export interface EventoTipoDef {
  key: EventoTipo;
  label: string;
  emoji: string;
  /** classes tailwind para badge: bg/text/border */
  style: string;
  /** classe da bolinha no calendário */
  dot: string;
}

export const EVENTO_TIPOS: EventoTipoDef[] = [
  { key: "reuniao_staff", label: "Reunião Staff", emoji: "🛡️", style: "bg-blue-500/15 text-blue-400 border-blue-500/30", dot: "bg-blue-500" },
  { key: "reuniao_imperio", label: "Reunião Império (Ilegal)", emoji: "👑", style: "bg-purple-500/15 text-purple-400 border-purple-500/30", dot: "bg-purple-500" },
  { key: "evento_host", label: "Evento Host", emoji: "🎮", style: "bg-primary/15 text-primary border-primary/30", dot: "bg-primary" },
  { key: "evento_races", label: "Evento Races", emoji: "🏁", style: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  { key: "evento_kids", label: "Evento Kids", emoji: "🧸", style: "bg-pink-500/15 text-pink-400 border-pink-500/30", dot: "bg-pink-500" },
  { key: "competitive", label: "Competitive", emoji: "🏆", style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  { key: "var", label: "VAR", emoji: "🎯", style: "bg-lime-500/15 text-lime-400 border-lime-500/30", dot: "bg-lime-500" },
  { key: "mega_crash", label: "Mega Crash", emoji: "💥", style: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-500" },
  { key: "dominas", label: "Dominas", emoji: "⚔️", style: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", dot: "bg-cyan-500" },
];

export const EVENTO_TIPO_MAP: Record<string, EventoTipoDef> = Object.fromEntries(
  EVENTO_TIPOS.map((t) => [t.key, t])
);

const FALLBACK_TIPO: EventoTipoDef = EVENTO_TIPOS[2]!; // evento_host

export function eventoTipoDef(tipo: string): EventoTipoDef {
  return EVENTO_TIPO_MAP[tipo] ?? FALLBACK_TIPO;
}

type EventoRow = Database["public"]["Tables"]["eventos"]["Row"];

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string | null;
  tipo: EventoTipo;
  criadoPor: string;
  criadoPorId: string | null;
  createdAt: string;
}

function mapRow(r: EventoRow): Evento {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
    tipo: (r.tipo as EventoTipo) ?? "evento_host",
    criadoPor: r.criado_por,
    criadoPorId: r.criado_por_id,
    createdAt: r.created_at,
  };
}

export async function fetchEventos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("data_inicio", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export interface NovoEvento {
  titulo: string;
  descricao: string;
  dataInicio: string; // ISO
  dataFim?: string | null;
  tipo: EventoTipo;
}

export async function criarEvento(input: NovoEvento): Promise<void> {
  const auth = await getAuthUserData();
  let username = "";
  if (auth.user) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", auth.user.id)
      .maybeSingle();
    username = data?.username ?? "";
  }
  const { error } = await supabase.from("eventos").insert({
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    data_inicio: input.dataInicio,
    data_fim: input.dataFim ?? null,
    tipo: input.tipo,
    criado_por: username,
    criado_por_id: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function excluirEvento(id: string): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
}
