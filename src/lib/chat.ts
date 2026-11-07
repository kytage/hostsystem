import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { getAuthUserData } from "@/lib/auth-cache";
import { roleRank } from "@/lib/roles";

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  texto: string;
  createdAt: string;
}

export type PresenceStatus = "online" | "ocupado" | "ausente" | "invisivel";

export const STATUS_CONFIG: Record<
  PresenceStatus,
  { label: string; dot: string }
> = {
  online: { label: "Online", dot: "bg-success" },
  ocupado: { label: "Ocupado", dot: "bg-destructive" },
  ausente: { label: "Ausente", dot: "bg-warning" },
  invisivel: { label: "Invisível", dot: "bg-muted-foreground" },
};

export interface ChatProfile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  status: string;
  role: string;
}

export async function fetchChatProfiles(): Promise<ChatProfile[]> {
  const [{ data, error }, { data: rolesData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, avatar_url, bio, status")
      .order("username", { ascending: true }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw error;
  const roleMap = new Map<string, string>();
  for (const r of (rolesData ?? []) as { user_id: string; role: string }[]) {
    const cur = roleMap.get(r.user_id);
    if (!cur || roleRank(r.role) < roleRank(cur)) {
      roleMap.set(r.user_id, r.role);
    }
  }
  return ((data ?? []) as Omit<ChatProfile, "role">[]).map((p) => ({
    ...p,
    role: roleMap.get(p.id) ?? "staff",
  }));
}

export async function updateMyStatus(status: PresenceStatus): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", auth.user.id);
  if (error) throw error;
}

export async function updateMyBio(bio: string): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ bio })
    .eq("id", auth.user.id);
  if (error) throw error;
}

export async function fetchChatMessages(limit = 60): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, user_id, username, avatar_url, texto, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      avatarUrl: r.avatar_url || DEFAULT_AVATAR_URL,
      texto: r.texto,
      createdAt: r.created_at,
    }))
    .reverse();
}

export async function sendChatMessage(texto: string): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();
  const { error } = await supabase.from("chat_messages").insert({
    user_id: auth.user.id,
    username: profile?.username ?? "staff",
    avatar_url: profile?.avatar_url ?? "",
    texto,
  });
  if (error) throw error;
}

/** Renderiza o texto destacando menções @usuario e @everyone */
export function renderMentions(texto: string): { text: string; mention: boolean }[] {
  const parts = texto.split(/(@everyone|@[\w.+-]+)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, mention: p.startsWith("@") }));
}
