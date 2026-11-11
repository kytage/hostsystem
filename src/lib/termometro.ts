import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

/** Os seis emojis do queridômetro e o nome de cada um. */
export const QUERIDOMETRO = [
  { emoji: "❤️", nome: "amo" },
  { emoji: "💣", nome: "odeio" },
  { emoji: "🍌", nome: "deboche" },
  // o vaso de planta não existe na fonte de emojis do Windows 10; o broto aparece em todo lugar
  { emoji: "🌱", nome: "tanto faz" },
  { emoji: "🤮", nome: "nojo" },
  { emoji: "🐍", nome: "falsiane" },
] as const;
export const TERMOMETRO_EMOJIS: readonly string[] = QUERIDOMETRO.map((e) => e.emoji);

/** Quanto falta para o queridômetro zerar (meia-noite de São Paulo). */
export function faltaParaZerar(): { horas: number; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const numero = (tipo: string) => Number(partes.find((x) => x.type === tipo)?.value ?? 0) % 24;
  const resto = 24 * 60 - (numero("hour") * 60 + numero("minute"));
  return { horas: Math.floor(resto / 60), minutos: resto % 60 };
}

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

/** Em quem o usuário atual já votou hoje, e com qual emoji. */
export async function fetchMeusVotosHoje(): Promise<{ para: string; emoji: string }[]> {
  const auth = await getAuthUserData();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("termometro_votos")
    .select("para_user_id, emoji")
    .eq("dia", hoje())
    .eq("de_user_id", auth.user.id);
  if (error) throw error;
  return (data ?? []).map((r) => ({ para: r.para_user_id, emoji: r.emoji }));
}

export async function votarTermometro(
  paraUserId: string,
  paraUsername: string,
  emoji: string,
): Promise<void> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Não autenticado");
  if (auth.user.id === paraUserId) throw new Error("Não dá para entregar emoji para você mesmo.");
  if (!TERMOMETRO_EMOJIS.includes(emoji))
    throw new Error("Esse emoji não faz parte do queridômetro.");
  const { error } = await supabase.from("termometro_votos").insert({
    de_user_id: auth.user.id,
    para_user_id: paraUserId,
    para_username: paraUsername,
    emoji,
    dia: hoje(),
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("Você já entregou um emoji para essa pessoa hoje. Amanhã zera.");
    throw error;
  }
}
