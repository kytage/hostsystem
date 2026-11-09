import { supabase } from "@/integrations/supabase/client";

export interface InventarioItem {
  item: string;
  qtd: number;
}

export interface Player {
  id: string;
  license: string;
  passaporte: string | null;
  nome: string;
  idade: number | null;
  telefone: string | null;
  banco: number;
  carteira: number;
  grupos: string[];
  inventario: InventarioItem[];
  veiculos: string[];
  discord_id: string | null;
  discord_nome: string | null;
  online: boolean;
  level: number;
  xp: number;
  rank_vip: string | null;
  host_coins: number;
  kills: number;
  mortes: number;
  headshots: number;
  maior_sequencia: number;
  ultimo_login: string | null;
  updated_at: string;
}

function parseInventario(v: unknown): InventarioItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is { item: string; qtd?: unknown } => typeof i === "object" && i !== null && typeof (i as { item?: unknown }).item === "string")
    .map((i) => ({ item: i.item, qtd: Number(i.qtd) || 1 }));
}

export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from("players").select("*").order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    license: r.license,
    passaporte: r.passaporte,
    nome: r.nome,
    idade: r.idade,
    telefone: r.telefone,
    banco: Number(r.banco) || 0,
    carteira: Number(r.carteira) || 0,
    grupos: r.grupos ?? [],
    inventario: parseInventario(r.inventario),
    veiculos: r.veiculos ?? [],
    discord_id: r.discord_id,
    discord_nome: r.discord_nome,
    online: r.online,
    level: r.level ?? 1,
    xp: r.xp ?? 0,
    rank_vip: r.rank_vip,
    host_coins: Number(r.host_coins) || 0,
    kills: r.kills ?? 0,
    mortes: r.mortes ?? 0,
    headshots: r.headshots ?? 0,
    maior_sequencia: r.maior_sequencia ?? 0,
    ultimo_login: r.ultimo_login,
    updated_at: r.updated_at,
  }));
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** "cellphone-1794023603" → "cellphone" (remove o serial do item). */
export const itemBase = (item: string) => item.replace(/-\d{6,}$/, "");

export type ItemTipo = "arma" | "municao" | "eletronico" | "outro";
export function itemTipo(item: string): ItemTipo {
  const i = item.toLowerCase();
  if (i.includes("ammo")) return "municao";
  if (i.startsWith("weapon_")) return "arma";
  if (/(cellphone|tablet|radio|smarthost|phone)/.test(i)) return "eletronico";
  return "outro";
}

export const LEVEL_MAX = 250;
export const kd = (p: Pick<Player, "kills" | "mortes">) => (p.mortes ? p.kills / p.mortes : p.kills);
