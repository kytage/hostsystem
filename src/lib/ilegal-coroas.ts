import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

/**
 * Controle de "coroas" (contatos de RP) por setagem do painel Ilegal.
 *
 * A semana vai de segunda 00:00 até domingo 23:59:59. Nada é apagado:
 * o contador da semana e o histórico são derivados de `created_at`,
 * então o "reset" de domingo acontece naturalmente na virada da semana.
 */

export interface IlegalCoroa {
  id: string;
  setagem: string;
  organizacao: string;
  motivo: string;
  criadoPor: string;
  createdAt: string;
}

export interface CoroaSemana {
  /** ISO do início da semana (segunda 00:00, horário local). */
  inicio: string;
  /** ISO do fim da semana (domingo 23:59:59, horário local). */
  fim: string;
  registros: IlegalCoroa[];
}

type Row = {
  id: string;
  setagem: string;
  organizacao: string;
  motivo: string;
  criado_por: string;
  created_at: string;
};

const rowToCoroa = (r: Row): IlegalCoroa => ({
  id: r.id,
  setagem: r.setagem,
  organizacao: r.organizacao,
  motivo: r.motivo,
  criadoPor: r.criado_por,
  createdAt: r.created_at,
});

/** Segunda-feira 00:00 (horário local) da semana que contém `ref`. */
export function inicioSemana(ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 = domingo → volta 6 dias; 1 = segunda → volta 0.
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Domingo 23:59:59.999 da semana que contém `ref`. */
export function fimSemana(ref: Date = new Date()): Date {
  const d = inicioSemana(ref);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function rotuloSemana(inicioISO: string): string {
  const ini = new Date(inicioISO);
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(ini)} — ${fmt(fim)}`;
}

/** Todos os registros de uma setagem (mais recentes primeiro). */
export async function fetchCoroas(setagem: string): Promise<IlegalCoroa[]> {
  const { data, error } = await supabase
    .from("ilegal_coroas")
    .select("id, setagem, organizacao, motivo, criado_por, created_at")
    .eq("setagem", setagem)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToCoroa);
}

/** Contagem da semana atual de todas as setagens (para a tabela). */
export async function fetchCoroasSemanaAtual(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("ilegal_coroas")
    .select("setagem")
    .gte("created_at", inicioSemana().toISOString())
    .lte("created_at", fimSemana().toISOString())
    .limit(5000);
  if (error) throw error;
  const mapa = new Map<string, number>();
  for (const r of (data ?? []) as { setagem: string }[]) {
    mapa.set(r.setagem, (mapa.get(r.setagem) ?? 0) + 1);
  }
  return mapa;
}

export async function registrarCoroa(input: {
  setagem: string;
  organizacao: string;
  motivo: string;
  criadoPor: string;
}): Promise<void> {
  const motivo = input.motivo.trim();
  if (!motivo) throw new Error("Escreva o motivo da coroa.");
  const auth = await getAuthUserData();
  const { error } = await supabase.from("ilegal_coroas").insert({
    setagem: input.setagem,
    organizacao: input.organizacao,
    motivo,
    criado_por: input.criadoPor,
    criado_por_id: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function excluirCoroa(id: string): Promise<void> {
  const { error } = await supabase.from("ilegal_coroas").delete().eq("id", id);
  if (error) throw error;
}

/** Separa registros em semana atual e histórico agrupado por semana. */
export function agruparPorSemana(registros: IlegalCoroa[]): {
  atual: IlegalCoroa[];
  historico: CoroaSemana[];
} {
  const iniAtual = inicioSemana().getTime();
  const atual: IlegalCoroa[] = [];
  const buckets = new Map<string, IlegalCoroa[]>();

  for (const r of registros) {
    const d = new Date(r.createdAt);
    const ini = inicioSemana(d);
    if (ini.getTime() === iniAtual) {
      atual.push(r);
      continue;
    }
    const key = ini.toISOString();
    const lista = buckets.get(key) ?? [];
    lista.push(r);
    buckets.set(key, lista);
  }

  const historico: CoroaSemana[] = [...buckets.entries()]
    .map(([inicio, lista]) => {
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 6);
      fim.setHours(23, 59, 59, 999);
      return { inicio, fim: fim.toISOString(), registros: lista };
    })
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));

  return { atual, historico };
}
