import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { getCurrentUsername } from "@/lib/kanban";

/**
 * Check-lists do painel Ilegal: tarefas em massa por setagem
 * (ex.: "Enviar aviso da reunião"). Cada check-list vira uma coluna
 * de caixinhas na tabela de Setagens; o staff marca setagem por setagem.
 */

export interface IlegalChecklist {
  id: string;
  nome: string;
  ordem: number;
  criadoPor: string;
  createdAt: string;
}

export interface MarcaChecklist {
  marcadoPor: string;
  createdAt: string;
}

/** checklist_id → (org_id → quem marcou) */
export type MarcasChecklist = Map<string, Map<string, MarcaChecklist>>;

// As tabelas novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const chaveMarca = (checklistId: string, orgId: string) => `${checklistId}:${orgId}`;

export async function fetchChecklists(): Promise<IlegalChecklist[]> {
  const { data, error } = await db
    .from("ilegal_checklists")
    .select("id, nome, ordem, criado_por, created_at")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { id: string; nome: string; ordem: number; criado_por: string; created_at: string }[]).map(
    (r) => ({ id: r.id, nome: r.nome, ordem: r.ordem, criadoPor: r.criado_por, createdAt: r.created_at }),
  );
}

export async function fetchMarcasChecklist(): Promise<MarcasChecklist> {
  const { data, error } = await db
    .from("ilegal_checklist_marcas")
    .select("checklist_id, org_id, marcado_por, created_at")
    .limit(20000);
  if (error) throw error;
  const mapa: MarcasChecklist = new Map();
  for (const r of (data ?? []) as { checklist_id: string; org_id: string; marcado_por: string; created_at: string }[]) {
    let porOrg = mapa.get(r.checklist_id);
    if (!porOrg) {
      porOrg = new Map();
      mapa.set(r.checklist_id, porOrg);
    }
    porOrg.set(r.org_id, { marcadoPor: r.marcado_por, createdAt: r.created_at });
  }
  return mapa;
}

export async function criarChecklist(nome: string, ordem: number): Promise<void> {
  const limpo = nome.trim();
  if (!limpo) throw new Error("Dê um nome para a check-list.");
  if (limpo.length > 80) throw new Error("Nome muito longo (máximo 80 letras).");
  const auth = await getAuthUserData();
  const { error } = await db.from("ilegal_checklists").insert({
    nome: limpo,
    ordem,
    criado_por: await getCurrentUsername(),
    criado_por_id: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function renomearChecklist(id: string, nome: string): Promise<void> {
  const limpo = nome.trim();
  if (!limpo) throw new Error("Dê um nome para a check-list.");
  if (limpo.length > 80) throw new Error("Nome muito longo (máximo 80 letras).");
  const { error } = await db.from("ilegal_checklists").update({ nome: limpo }).eq("id", id);
  if (error) throw error;
}

/** Remove a check-list e todas as marcações dela. */
export async function removerChecklist(id: string): Promise<void> {
  const { data, error } = await db.from("ilegal_checklists").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Sem permissão para remover esta check-list.");
}

/** Desmarca todas as caixinhas da check-list (para reaproveitar, ex.: aviso da próxima reunião). */
export async function limparChecklist(id: string): Promise<void> {
  const { error } = await db.from("ilegal_checklist_marcas").delete().eq("checklist_id", id);
  if (error) throw error;
}

export async function marcarChecklist(checklistId: string, orgId: string, marcar: boolean): Promise<void> {
  if (!marcar) {
    const { error } = await db
      .from("ilegal_checklist_marcas")
      .delete()
      .eq("checklist_id", checklistId)
      .eq("org_id", orgId);
    if (error) throw error;
    return;
  }
  const auth = await getAuthUserData();
  const { error } = await db.from("ilegal_checklist_marcas").insert({
    checklist_id: checklistId,
    org_id: orgId,
    marcado_por: await getCurrentUsername(),
    marcado_por_id: auth.user?.id ?? null,
  });
  // já marcada por outra pessoa ao mesmo tempo: fica marcada, sem erro
  if (error && error.code !== "23505") throw error;
}
