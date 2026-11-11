import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

/**
 * Correio da praça (cartão postal). A carta da direção vai para todos e cada
 * um confirma a leitura; a carta direta vai para uma pessoa, assinada ou
 * anônima, e pode levar uma flor (ou outro presente) da mochila.
 * Quem mandou fica guardado no banco, mas nenhum usuário consegue ler.
 */
export interface Carta {
  id: string;
  tipo: "direcao" | "direta";
  /** Nome de quem mandou (vazio quando é anônima). */
  de_nome: string;
  para_user_id: string | null;
  titulo: string;
  texto: string;
  /** Presente anexado (id do item da mochila), ou vazio. */
  flor: string;
  anonima: boolean;
  created_at: string;
}

const COLUNAS = "id, tipo, de_nome, para_user_id, titulo, texto, flor, anonima, created_at";
// as tabelas do correio ainda não estão nos tipos gerados do banco
const cartas = () => supabase.from("hoki_cartas" as never);
const lidas = () => supabase.from("hoki_cartas_lidas" as never);

/** As cartas que posso ler: as da direção e as diretas para mim (as mais novas primeiro). */
export async function minhasCartas(): Promise<Carta[]> {
  const { data, error } = await cartas()
    .select(COLUNAS)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as Carta[];
}

/** Quais cartas eu já li (ou confirmei). */
export async function minhasLeituras(): Promise<string[]> {
  const auth = await getAuthUserData();
  if (!auth.user) return [];
  const { data, error } = await lidas().select("carta_id").eq("user_id", auth.user.id);
  if (error) throw error;
  return ((data ?? []) as unknown as { carta_id: string }[]).map((l) => l.carta_id);
}

/** Marca a carta como lida. Devolve true só na primeira vez (para entregar a flor uma vez só). */
export async function confirmarLeitura(id: string): Promise<boolean> {
  const { error } = await lidas().insert({ carta_id: id } as never);
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

export async function enviarCarta(c: {
  tipo: "direcao" | "direta";
  para: string | null;
  titulo: string;
  texto: string;
  flor: string;
  anonima: boolean;
}): Promise<void> {
  const { error } = await cartas().insert({
    tipo: c.tipo,
    para_user_id: c.tipo === "direta" ? c.para : null,
    titulo: c.titulo.trim().slice(0, 80),
    texto: c.texto.trim().slice(0, 1200),
    flor: c.flor,
    anonima: c.tipo === "direta" && c.anonima,
  } as never);
  if (error) throw error;
}

/** Quem já confirmou a leitura de uma carta da direção (só Coordinator+ consegue ver). */
export async function leiturasDaCarta(id: string): Promise<{ user_id: string; lida_em: string }[]> {
  const { data, error } = await lidas().select("user_id, lida_em").eq("carta_id", id);
  if (error) throw error;
  return (data ?? []) as unknown as { user_id: string; lida_em: string }[];
}
