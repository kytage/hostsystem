import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export type CronoTipo = "roleplay" | "missao" | "entrega";
export type CronoColuna = "pendente" | "andamento" | "concluido";
export type CronoPrioridade = "baixa" | "normal" | "alta" | "urgente";

export const CRONO_PRIORIDADES: { id: CronoPrioridade; label: string }[] = [
  { id: "urgente", label: "Urgente" },
  { id: "alta", label: "Alta" },
  { id: "normal", label: "Normal" },
  { id: "baixa", label: "Baixa" },
];

/** Peso para ordenar: urgente primeiro. */
export const PRIORIDADE_PESO: Record<CronoPrioridade, number> = {
  urgente: 0,
  alta: 1,
  normal: 2,
  baixa: 3,
};

export interface CronoPasso {
  texto: string;
  feito: boolean;
}

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
  prioridade: CronoPrioridade;
  /** Staffs mencionados como responsáveis. */
  responsaveis: string[];
  /** Setagens envolvidas (pode ser mais de uma). */
  setagens: string[];
  checklist: CronoPasso[];
  concluidoEm: string | null;
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
  prioridade?: string | null;
  responsaveis?: string[] | null;
  setagens?: string[] | null;
  checklist?: unknown;
  concluido_em?: string | null;
};

const PRIORIDADES_VALIDAS = new Set(["baixa", "normal", "alta", "urgente"]);

function lerChecklist(v: unknown): CronoPasso[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) => ({
      texto: String((p as { texto?: unknown })?.texto ?? "").trim(),
      feito: !!(p as { feito?: unknown })?.feito,
    }))
    .filter((p) => p.texto);
}

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
    prioridade: (PRIORIDADES_VALIDAS.has(r.prioridade ?? "")
      ? r.prioridade
      : "normal") as CronoPrioridade,
    responsaveis: r.responsaveis?.length
      ? r.responsaveis
      : r.responsavel
        ? [r.responsavel]
        : [],
    setagens: r.setagens?.length ? r.setagens : r.setagem ? [r.setagem] : [],
    checklist: lerChecklist(r.checklist),
    concluidoEm: r.concluido_em ?? null,
  };
}

/** Prazo passou e o item ainda não foi concluído. */
export function estaAtrasado(item: Pick<CronoItem, "dataHora" | "coluna">, agora = Date.now()) {
  if (!item.dataHora || item.coluna === "concluido") return false;
  return new Date(item.dataHora).getTime() < agora;
}

/** Ordem dentro da coluna: prioridade (urgente no topo) e depois o prazo mais próximo. */
export function ordenarCrono(itens: CronoItem[]): CronoItem[] {
  return [...itens].sort((a, b) => {
    const p = PRIORIDADE_PESO[a.prioridade] - PRIORIDADE_PESO[b.prioridade];
    if (p) return p;
    const ta = a.dataHora ? new Date(a.dataHora).getTime() : Infinity;
    const tb = b.dataHora ? new Date(b.dataHora).getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function fetchCronograma(): Promise<CronoItem[]> {
  const { data, error } = await supabase
    .from("ilegal_cronograma")
    .select("*")
    .order("data_hora", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(rowTo);
}

export interface CronoInput {
  titulo: string;
  descricao: string;
  tipo: CronoTipo;
  dataHora: string | null;
  responsavel: string;
  prioridade: CronoPrioridade;
  responsaveis: string[];
  setagens: string[];
  checklist: CronoPasso[];
}

function camposNovos(input: CronoInput) {
  return {
    prioridade: input.prioridade,
    responsaveis: input.responsaveis,
    setagens: input.setagens,
    checklist: input.checklist.map((p) => ({ texto: p.texto, feito: p.feito })) as unknown as never,
  };
}

export async function criarCronoItem(input: CronoInput): Promise<void> {
  const auth = await getAuthUserData();
  const { error } = await supabase.from("ilegal_cronograma").insert({
    titulo: input.titulo,
    descricao: input.descricao,
    tipo: input.tipo,
    setagem: input.setagens[0] ?? "",
    data_hora: input.dataHora,
    responsavel: input.responsavel,
    ...camposNovos(input),
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
      setagem: input.setagens[0] ?? "",
      data_hora: input.dataHora,
      responsavel: input.responsavel,
      ...camposNovos(input),
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
    .update({
      coluna,
      concluido_em: coluna === "concluido" ? new Date().toISOString() : null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

/** Marca/desmarca um passo do checklist direto no card. */
export async function salvarChecklist(id: string, checklist: CronoPasso[]): Promise<void> {
  const { error } = await supabase
    .from("ilegal_cronograma")
    .update({ checklist: checklist as unknown as never } as never)
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
