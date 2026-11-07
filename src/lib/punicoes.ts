import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PunicaoRow = Database["public"]["Tables"]["punicoes"]["Row"];

/** Tipos de registro: denúncia normal ou VAR (punições de hack). */
export type PunicaoTipo = "denuncia" | "var";

export const PUNICAO_TIPOS: { key: PunicaoTipo; label: string; descricao: string }[] = [
  { key: "denuncia", label: "Denúncias", descricao: "Punições normais originadas de denúncias" },
  { key: "var", label: "VAR", descricao: "Punições de hack analisadas pelo VAR" },
];

/** Usersets disponíveis para o denunciado. */
export const USERSETS = [
  { key: "ilegal", label: "Ilegal" },
  { key: "policia", label: "Policia" },
  { key: "comum", label: "Player comum (sem set)" },
] as const;
export type UsersetKey = (typeof USERSETS)[number]["key"];

/** Motivos de denúncia. `destaque` marca infrações graves. */
export const MOTIVOS: { label: string; destaque?: boolean }[] = [
  { label: "Quebra de regra comum" },
  { label: "Quebra de perímetro" },
  { label: "Power Gaming" },
  { label: "Force RP" },
  { label: "RDM" },
  { label: "VDM" },
  { label: "PIT" },
  { label: "Metagaming" },
  { label: "Anti amor à vida" },
  { label: "Discurso de ódio" },
  { label: "Flaming" },
  { label: "CL", destaque: true },
  { label: "Trash / Dark", destaque: true },
  { label: "Hack", destaque: true },
  { label: "Zaralho" },
];

/** Punições possíveis. `dias` indica campo de duração em dias. */
export const PUNICOES_OPCOES: { label: string; destaque?: boolean; dias?: boolean }[] = [
  { label: "Anulada" },
  { label: "Advertência Verbal" },
  { label: "Advertência 2" },
  { label: "Advertência 3" },
  { label: "Banimento Temporário", dias: true },
  { label: "Banimento Permanente", destaque: true },
];

/** Resultados possíveis da análise do VAR. */
export const RESULTADOS_VAR: { label: string; destaque?: boolean }[] = [
  { label: "Cheat", destaque: true },
  { label: "Formatação", destaque: true },
  { label: "Liberado" },
];

/** Punições aplicáveis pelo VAR. */
export const PUNICOES_VAR: { label: string; destaque?: boolean }[] = [
  { label: "Liberado" },
  { label: "Banido", destaque: true },
];

export interface PunicaoInput {
  tipo: PunicaoTipo;
  /** Data do registro no formato ISO (timestamptz). */
  data_punicao?: string;
  ticket_id: string;
  resultado: string;
  responsaveis: string[];
  jogador: string;
  jogador_id: string;
  userset: string;
  userset_sub: string;
  motivo: string;
  punicao: string;
  dias: number | null;
  duracao: string;
  provas: string;
  anexos: string[];
  observacao: string;
}

/** Normaliza os campos jsonb do registro para arrays de string. */
export function parseLista(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** Converte um timestamp em valor de <input type="date"> no fuso local. */
export function paraDataInput(value?: string | null): string {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return paraDataInput(null);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** Converte "YYYY-MM-DD" do input em ISO (meio-dia local, evita virada de fuso). */
export function deDataInput(value: string): string {
  if (!value) return new Date().toISOString();
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}


/** Lista todos os registros, mais recentes primeiro. */
export async function fetchPunicoes(): Promise<PunicaoRow[]> {
  const { data, error } = await supabase
    .from("punicoes")
    .select("*")
    .order("data_punicao", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Responsáveis: área "denuncias" + cargos Coordinator pra cima. */
export async function fetchResponsaveisDenuncia(): Promise<string[]> {
  const ids = new Set<string>();

  const { data: areas, error } = await supabase
    .from("user_areas")
    .select("user_id")
    .eq("area", "denuncias");
  if (error) throw error;
  (areas ?? []).forEach((a) => ids.add(a.user_id));

  const { data: roles, error: e1 } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["founder", "c_level", "direcao", "coordinator"]);
  if (e1) throw e1;
  (roles ?? []).forEach((r) => ids.add(r.user_id));

  if (ids.size === 0) return [];
  const { data: perfis, error: e2 } = await supabase
    .from("profiles")
    .select("username")
    .in("id", Array.from(ids));
  if (e2) throw e2;
  return (perfis ?? [])
    .map((p) => p.username)
    .filter((u): u is string => !!u)
    .sort((a, b) => a.localeCompare(b));
}

/** Setagens cadastradas no painel do Ilegal (para o sub-set). */
export async function fetchSetagensIlegal(): Promise<string[]> {
  const { data, error } = await supabase
    .from("ilegal_orgs")
    .select("setagem, organizacao")
    .order("categoria")
    .order("ordem");
  if (error) throw error;
  return (data ?? [])
    .map((o) => o.setagem)
    .filter((s): s is string => !!s && s.trim().length > 0);
}

/** Denúncias aplicadas a uma setagem específica do Ilegal. */
export async function fetchPunicoesPorSetagem(setagem: string): Promise<PunicaoRow[]> {
  const { data, error } = await supabase
    .from("punicoes")
    .select("*")
    .eq("userset", "ilegal")
    .eq("userset_sub", setagem)
    .order("data_punicao", { ascending: false });
  if (error) throw error;
  return data ?? [];
}


export async function criarPunicao(
  input: PunicaoInput,
  staff: { id: string | null; username: string }
): Promise<void> {
  const { error } = await supabase.from("punicoes").insert({
    ...input,
    staff: staff.username,
    staff_id: staff.id,
  });
  if (error) throw error;
}

export async function atualizarPunicao(
  id: string,
  patch: Partial<PunicaoInput>
): Promise<void> {
  const { error } = await supabase.from("punicoes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function excluirPunicao(id: string): Promise<void> {
  const { error } = await supabase.from("punicoes").delete().eq("id", id);
  if (error) throw error;
}

/** Série de 14 dias com contagem por tipo, para o gráfico principal. */
export function serieDiaria(rows: PunicaoRow[], dias = 14) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const buckets: { dia: string; label: string; denuncia: number; var: number }[] = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    buckets.push({
      dia: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      denuncia: 0,
      var: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.dia, b]));
  for (const row of rows) {
    const key = new Date(row.data_punicao).toISOString().slice(0, 10);
    const bucket = index.get(key);
    if (!bucket) continue;
    if (row.tipo === "var") bucket.var += 1;
    else bucket.denuncia += 1;
  }
  return buckets;
}

/** Períodos de filtro do dashboard, em dias (0 = total/histórico completo). */
export const PERIODOS = [
  { key: 1, label: "1 dia" },
  { key: 3, label: "3 dias" },
  { key: 7, label: "7 dias" },
  { key: 30, label: "30 dias" },
  { key: 0, label: "Total" },
] as const;

/** Filtra registros pelo período em dias (0 retorna tudo). */
export function filtrarPorPeriodo(rows: PunicaoRow[], dias: number): PunicaoRow[] {
  if (dias <= 0) return rows;
  const limite = new Date();
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - (dias - 1));
  return rows.filter((r) => new Date(r.data_punicao) >= limite);
}

/** Contagem agrupada por um campo de texto (motivo, userset etc.), decrescente. */
export function contagemPor(
  rows: PunicaoRow[],
  campo: "motivo" | "userset" | "resultado"
): { nome: string; total: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    let nome = (row[campo] ?? "").trim();
    if (!nome) continue;
    if (campo === "userset") {
      const u = USERSETS.find((s) => s.key === nome);
      nome = u?.label ?? nome;
    }
    map.set(nome, (map.get(nome) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
}

/** Top staffs por quantidade de punições aplicadas. */
export function rankingStaff(rows: PunicaoRow[], limite = 6) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const nome = row.staff.trim() || "—";
    map.set(nome, (map.get(nome) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([staff, total]) => ({ staff, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}
