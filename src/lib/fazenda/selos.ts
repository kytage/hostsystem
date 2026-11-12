/**
 * Selo de nível da plaquinha (HOST FAZENDAS): nível da fazenda e a cor equipada de cada pessoa.
 * Quem ainda não criou a ilha não tem selo (a plaquinha mostra só nick, cargo e status).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-cache";
import { corDoSelo } from "./catalogo";

/** O meu nível do HOST FAZENDAS (o único nível do HOKI). Sem ilha ainda: nível 1. */
export interface MeuNivel {
  userId: string;
  nivel: number;
  xp: number;
  cor: string;
  temIlha: boolean;
}
export const CHAVE_MEU_NIVEL = ["fazenda-meu-nivel"] as const;
export function useMeuNivel() {
  return useQuery({
    queryKey: CHAVE_MEU_NIVEL,
    staleTime: 30_000,
    queryFn: async (): Promise<MeuNivel | null> => {
      const user = await getAuthUser();
      if (!user) return null;
      const { data } = await supabase
        .from("fazenda_jogadores" as never)
        .select("nivel, xp, cor")
        .eq("user_id" as never, user.id as never)
        .maybeSingle();
      const l = data as { nivel: number; xp: number; cor: string } | null;
      return {
        userId: user.id,
        nivel: l?.nivel ?? 1,
        xp: l?.xp ?? 0,
        cor: l?.cor ?? "vermelho",
        temIlha: !!l,
      };
    },
  });
}

export interface SeloDaPlaquinha {
  nivel: number;
  fundo: string;
  texto: string;
}
type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export function useSelos(ids: string[]) {
  const lista = [...new Set(ids.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["fazenda-selos", lista.join(",")],
    enabled: lista.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await (supabase.rpc as unknown as Rpc)("fazenda_selos", { ids: lista });
      const mapa: Record<string, SeloDaPlaquinha> = {};
      for (const r of (data ?? []) as { user_id: string; nivel: number; cor: string }[]) {
        const c = corDoSelo(r.cor, r.nivel);
        mapa[r.user_id] = { nivel: r.nivel, fundo: c.fundo, texto: c.texto };
      }
      return mapa;
    },
  });
}

export interface LinhaDoRanking {
  user_id: string;
  username: string;
  nivel: number;
  xp: number;
  cor: string;
}
export function useRankingDaFazenda(limite = 10) {
  return useQuery({
    queryKey: ["fazenda-ranking", limite],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase.rpc as unknown as Rpc)("fazenda_ranking", { limite });
      return (data ?? []) as LinhaDoRanking[];
    },
  });
}
