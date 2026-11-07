import { supabase } from "@/integrations/supabase/client";

export type ColumnId = "backlog" | "doing" | "review" | "done";
export type Priority = "alta" | "media" | "baixa";

export interface PlanningAttachment {
  id: string;
  nome: string;
  path?: string;
  url?: string;
  type: string;
}

export interface DevTask {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  tag: string;
  assignee: string;
  column: ColumnId;
  attachments: PlanningAttachment[];
}

export interface Pendencia {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  tag: string;
  createdAt: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  tag: string;
  assignee: string;
  column_id: string;
  attachments?: unknown;
}

interface PendenciaRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  tag: string;
  created_at: string;
}

function rowToTask(r: TaskRow): DevTask {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority as Priority,
    tag: r.tag,
    assignee: r.assignee,
    column: r.column_id as ColumnId,
    attachments: parsePlanningAttachments(r.attachments),
  };
}

export function parsePlanningAttachments(value: unknown): PlanningAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((a): a is PlanningAttachment => {
    if (typeof a !== "object" || a === null) return false;
    return typeof a.id === "string" && typeof a.nome === "string" && typeof a.type === "string"
      && (typeof a.path === "string" || (typeof a.url === "string" && /^https?:\/\//i.test(a.url)));
  });
}

export async function updateDevTask(id: string, input: Pick<DevTask, "title" | "description" | "tag" | "assignee" | "attachments">): Promise<void> {
  if (!input.title.trim()) throw new Error("Informe o título do projeto.");
  const { data, error } = await supabase.from("dev_tasks").update({
    title: input.title.trim(), description: input.description, tag: input.tag,
    assignee: input.assignee, attachments: input.attachments.map((a) => ({ ...a })),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("Projeto não encontrado ou sem permissão.");
}

export async function uploadPlanningFile(file: File): Promise<PlanningAttachment> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Entre novamente para enviar arquivos.");
  const id = crypto.randomUUID();
  const path = `${user.id}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("host-update-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return { id, nome: file.name, path, type: file.type };
}

export async function planningFileUrl(file: PlanningAttachment): Promise<string> {
  if (!file.path) return file.url ?? "";
  const { data, error } = await supabase.storage.from("host-update-files").createSignedUrl(file.path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

function rowToPendencia(r: PendenciaRow): Pendencia {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority as Priority,
    tag: r.tag,
    createdAt: new Date(r.created_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export async function fetchDevTasks(): Promise<DevTask[]> {
  const { data, error } = await supabase
    .from("dev_tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

export async function addDevTask(input: {
  title: string;
  description: string;
  priority: Priority;
  tag: string;
}): Promise<void> {
  const { error } = await supabase.from("dev_tasks").insert({
    title: input.title,
    description: input.description,
    priority: input.priority,
    tag: input.tag,
    assignee: "DEV",
    column_id: "backlog",
  });
  if (error) throw error;
}

export async function moveDevTask(id: string, column: ColumnId): Promise<void> {
  const { error } = await supabase
    .from("dev_tasks")
    .update({ column_id: column, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDevTask(id: string): Promise<void> {
  const { error } = await supabase.from("dev_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPendencias(): Promise<Pendencia[]> {
  const { data, error } = await supabase
    .from("pendencias")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PendenciaRow[]).map(rowToPendencia);
}

export async function forwardPendencia(p: Pendencia): Promise<void> {
  const { error: insertError } = await supabase.from("dev_tasks").insert({
    title: p.title,
    description: p.description,
    priority: p.priority,
    tag: p.tag,
    assignee: "DEV",
    column_id: "backlog",
  });
  if (insertError) throw insertError;
  const { error: deleteError } = await supabase
    .from("pendencias")
    .delete()
    .eq("id", p.id);
  if (deleteError) throw deleteError;
}
