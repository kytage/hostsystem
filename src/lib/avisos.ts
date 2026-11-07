import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export interface Aviso {
  id: string;
  titulo: string;
  texto: string;
  criadoPor: string;
  createdAt: string;
  confirmacoes: { userId: string; username: string; createdAt: string }[];
}

type AvisoRow = {
  id: string;
  titulo: string;
  texto: string;
  criado_por: string;
  created_at: string;
  aviso_confirmacoes: { user_id: string; username: string; created_at: string }[];
};

export async function fetchAvisos(): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from("avisos")
    .select("id, titulo, texto, criado_por, created_at, aviso_confirmacoes(user_id, username, created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AvisoRow[]).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    texto: r.texto,
    criadoPor: r.criado_por,
    createdAt: r.created_at,
    confirmacoes: (r.aviso_confirmacoes ?? []).map((c) => ({
      userId: c.user_id,
      username: c.username,
      createdAt: c.created_at,
    })),
  }));
}

export async function criarAviso(input: { titulo: string; texto: string; criadoPor: string }): Promise<void> {
  const auth = await getAuthUserData();
  const { error } = await supabase.from("avisos").insert({
    titulo: input.titulo,
    texto: input.texto,
    criado_por: input.criadoPor,
    criado_por_id: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function excluirAviso(id: string): Promise<void> {
  const { error } = await supabase.from("avisos").delete().eq("id", id);
  if (error) throw error;
}

export async function confirmarAviso(avisoId: string, username: string): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Não autenticado");
  const { error } = await supabase.from("aviso_confirmacoes").insert({
    aviso_id: avisoId,
    user_id: auth.user.id,
    username,
  });
  if (error) throw error;
}

export async function removerConfirmacao(avisoId: string): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("aviso_confirmacoes")
    .delete()
    .eq("aviso_id", avisoId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}
