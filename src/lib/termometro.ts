import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

export const TERMOMETRO_EMOJIS = [
  "🔥", "❤️", "😂", "👏", "🤝", "💪", "🧠", "⭐", "😴", "🍀",
] as const;

export interface TermometroVoto {
  id: string;
  paraUserId: string;
  paraUsername: string;
  emoji: string;
  dia: string;
}

function hoje(): string {
  // Data local de São Paulo (reseta a cada 24h)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function fetchTermometroHoje(): Promise<TermometroVoto[]> {
  const { data, error } = await supabase
    .from("termometro_votos")
    .select("id, para_user_id, para_username, emoji, dia")
    .eq("dia", hoje());
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    paraUserId: r.para_user_id,
    paraUsername: r.para_username,
    emoji: r.emoji,
    dia: r.dia,
  }));
}

/** IDs em quem o usuário atual já votou hoje */
export async function fetchMeusVotosHoje(): Promise<string[]> {
  const auth = await getAuthUserData();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("termometro_votos")
    .select("para_user_id")
    .eq("dia", hoje())
    .eq("de_user_id", auth.user.id);
  if (error) throw error;
  return (data ?? []).map((r) => r.para_user_id);
}

export async function votarTermometro(
  paraUserId: string,
  paraUsername: string,
  emoji: string
): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Não autenticado");
  if (auth.user.id === paraUserId) throw new Error("Você não pode votar em si mesmo 😅");
  const { error } = await supabase.from("termometro_votos").insert({
    de_user_id: auth.user.id,
    para_user_id: paraUserId,
    para_username: paraUsername,
    emoji,
    dia: hoje(),
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("Você já votou nessa pessoa hoje. Volte amanhã!");
    throw error;
  }
}
