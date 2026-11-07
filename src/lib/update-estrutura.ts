import { supabase } from "@/integrations/supabase/client";
import type { ColumnId } from "@/lib/dev-tasks";

/** Item (Subtítulo 2): entrega com responsáveis e status próprios. */
export interface EstruturaItem {
  id: string;
  titulo: string;
  responsaveis: string[];
  status: ColumnId;
  descricao: string;
}

/** Subtítulo: agrupa itens dentro do projeto (ex.: WINXS COFFE). */
export interface EstruturaGrupo {
  id: string;
  titulo: string;
  itens: EstruturaItem[];
}

const STATUS: ColumnId[] = ["backlog", "doing", "review", "done"];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const listaNomes = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()))] : [];

/** Responsáveis: aceita a lista nova (responsaveis) ou o texto antigo (responsavel). */
const parseResponsaveis = (i: Record<string, unknown>): string[] => {
  const lista = listaNomes(i["responsaveis"]);
  if (lista.length) return lista;
  const antigo = str(i["responsavel"]).trim();
  return antigo ? [antigo] : [];
};

/** Converte o JSON salvo em estrutura válida, descartando entradas malformadas. */
export function parseEstrutura(value: unknown): EstruturaGrupo[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null && typeof g["id"] === "string")
    .map((g) => ({
      id: g["id"] as string,
      titulo: str(g["titulo"]),
      itens: (Array.isArray(g["itens"]) ? g["itens"] : [])
        .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null && typeof i["id"] === "string")
        .map((i) => ({
          id: i["id"] as string,
          titulo: str(i["titulo"]),
          responsaveis: parseResponsaveis(i),
          descricao: str(i["descricao"]),
          status: STATUS.includes(i["status"] as ColumnId) ? (i["status"] as ColumnId) : "backlog",
        })),
    }));
}

/** Progresso de itens concluídos sobre o total. */
export function progressoEstrutura(grupos: EstruturaGrupo[]): { feitos: number; total: number } {
  const itens = grupos.flatMap((g) => g.itens);
  return { feitos: itens.filter((i) => i.status === "done").length, total: itens.length };
}

export async function fetchEstrutura(id: string): Promise<EstruturaGrupo[]> {
  const { data, error } = await supabase.from("dev_tasks").select("estrutura").eq("id", id).single();
  if (error) throw error;
  return parseEstrutura(data?.estrutura);
}

export async function saveEstrutura(id: string, grupos: EstruturaGrupo[]): Promise<void> {
  const { data, error } = await supabase
    .from("dev_tasks")
    .update({ estrutura: grupos.map((g) => ({ ...g, itens: g.itens.map((i) => ({ ...i })) })), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Projeto não encontrado ou sem permissão.");
}
