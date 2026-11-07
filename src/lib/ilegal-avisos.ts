import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export interface IlegalAvisoConfirmacao {
  userId: string;
  username: string;
  createdAt: string;
}

export interface IlegalAviso {
  id: string;
  titulo: string;
  texto: string;
  criadoPor: string;
  createdAt: string;
  confirmacoes: IlegalAvisoConfirmacao[];
}

type Row = {
  id: string;
  titulo: string;
  texto: string;
  criado_por: string;
  created_at: string;
  ilegal_aviso_confirmacoes:
    | { user_id: string; username: string; created_at: string }[]
    | null;
};

export async function fetchIlegalAvisos(): Promise<IlegalAviso[]> {
  const { data, error } = await supabase
    .from("ilegal_avisos")
    .select(
      "id, titulo, texto, criado_por, created_at, ilegal_aviso_confirmacoes(user_id, username, created_at)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    texto: r.texto,
    criadoPor: r.criado_por,
    createdAt: r.created_at,
    confirmacoes: (r.ilegal_aviso_confirmacoes ?? []).map((c) => ({
      userId: c.user_id,
      username: c.username,
      createdAt: c.created_at,
    })),
  }));
}

export async function criarIlegalAviso(input: {
  titulo: string;
  texto: string;
  criadoPor: string;
}): Promise<void> {
  const auth = await getAuthUserData();
  const { error } = await supabase.from("ilegal_avisos").insert({
    titulo: input.titulo,
    texto: input.texto,
    criado_por: input.criadoPor,
    criado_por_id: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function excluirIlegalAviso(id: string): Promise<void> {
  const { error } = await supabase.from("ilegal_avisos").delete().eq("id", id);
  if (error) throw error;
}

export async function confirmarIlegalAviso(
  avisoId: string,
  username: string
): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Sessão expirada.");
  const { error } = await supabase.from("ilegal_aviso_confirmacoes").insert({
    aviso_id: avisoId,
    user_id: auth.user.id,
    username,
  });
  // 23505 = confirmação já existente: idempotente, não é erro para o usuário.
  if (error && error.code !== "23505") throw error;
}

export async function removerConfirmacaoIlegal(avisoId: string): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Sessão expirada.");
  const { error } = await supabase
    .from("ilegal_aviso_confirmacoes")
    .delete()
    .eq("aviso_id", avisoId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}
