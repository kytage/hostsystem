import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export type CronoTipo = "roleplay" | "missao" | "entrega";
export type CronoColuna = "pendente" | "andamento" | "concluido";

export const CRONO_TIPO_LABEL: Record<CronoTipo, string> = {
  roleplay: "Roleplay",
  missao: "Missão",
  entrega: "Entrega de organização",
};

export const CRONO_COLUNAS: { id: CronoColuna; label: string }[] = [
  { id: "pendente", label: "Pendente" },
  { id: "andamento", label: "Em andamento" },
  { id: "concluido", label: "Concluído" },
];

export interface CronoItem {
  id: string;
  titulo: string;
  descricao: string;
  tipo: CronoTipo;
  setagem: string;
  dataHora: string | null;
  responsavel: string;
  coluna: CronoColuna;
  ordem: number;
  criadoPor: string;
  createdAt: string;
}

type Row = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  setagem: string;
  data_hora: string | null;
  responsavel: string;
  coluna: string;
  ordem: number;
  criado_por: string;
  created_at: string;
};

function rowTo(r: Row): CronoItem {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    tipo: r.tipo as CronoTipo,
    setagem: r.setagem,
    dataHora: r.data_hora,
    responsavel: r.responsavel,
    coluna: r.coluna as CronoColuna,
    ordem: r.ordem,
    criadoPor: r.criado_por,
    createdAt: r.created_at,
  };
}

export async function fetchCronograma(): Promise<CronoItem[]> {
  const { data, error } = await supabase
    .from("ilegal_cronograma")
    .select(
      "id, titulo, descricao, tipo, setagem, data_hora, responsavel, coluna, ordem, criado_por, created_at"
    )
    .order("data_hora", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(rowTo);
}

export interface CronoInput {
  titulo: string;
  descricao: string;
  tipo: CronoTipo;
  setagem: string;
  dataHora: string | null;
  responsavel: string;
}

export async function criarCronoItem(input: CronoInput): Promise<void> {
  const auth = await getAuthUserData();
  const { error } = await supabase.from("ilegal_cronograma").insert({
    titulo: input.titulo,
    descricao: input.descricao,
    tipo: input.tipo,
    setagem: input.setagem,
    data_hora: input.dataHora,
    responsavel: input.responsavel,
    coluna: "pendente",
    criado_por_id: auth.user?.id ?? null,
    criado_por: input.responsavel,
  });
  if (error) throw error;
}

export async function atualizarCronoItem(
  id: string,
  input: CronoInput
): Promise<void> {
  const { error } = await supabase
    .from("ilegal_cronograma")
    .update({
      titulo: input.titulo,
      descricao: input.descricao,
      tipo: input.tipo,
      setagem: input.setagem,
      data_hora: input.dataHora,
      responsavel: input.responsavel,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function moverCronoItem(
  id: string,
  coluna: CronoColuna
): Promise<void> {
  const { error } = await supabase
    .from("ilegal_cronograma")
    .update({ coluna })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirCronoItem(id: string): Promise<void> {
  const { error } = await supabase.from("ilegal_cronograma").delete().eq("id", id);
  if (error) throw error;
}

/** Converte ISO -> valor aceito por <input type="datetime-local"> no fuso local. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Data/hora padrão: hoje às 20:00 (horário típico de RP). */
export function defaultDataHoraInput(): string {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  return isoToLocalInput(d.toISOString());
}

export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
