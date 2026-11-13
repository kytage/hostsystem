import { supabase } from "@/integrations/supabase/client";
import type { QuadroRanking } from "@/components/hoki/ranking-arco";

/** Os rankings do arco da praça, na ordem em que o E troca. */
export type ChaveRanking = "horas" | "level" | "solicitacoes" | "captacoes" | "dormindo";

const horas = (min: number) => {
  if (min < 60) return `${min} MIN`;
  return `${Math.floor(min / 60)} HR`;
};

export const RANKINGS: {
  chave: ChaveRanking;
  titulo: string;
  sub: string;
  valor: (n: number) => string;
}[] = [
  { chave: "horas", titulo: "Top Horas", sub: "Tempo total no site", valor: horas },
  { chave: "level", titulo: "Top Level", sub: "Nível na HOST FAZENDAS", valor: (n) => `NV ${n}` },
  { chave: "solicitacoes", titulo: "Top Solicitações", sub: "Pendências abertas nas áreas", valor: (n) => `${n}` },
  { chave: "captacoes", titulo: "Top Captações", sub: "Captações registradas", valor: (n) => `${n}` },
  { chave: "dormindo", titulo: "Top Dormindo", sub: "Tempo do HOKI no berço", valor: horas },
];

export type DadosRanking = Record<ChaveRanking, { nome: string; valor: number }[]>;

const vazio = (): DadosRanking => ({ horas: [], level: [], solicitacoes: [], captacoes: [], dormindo: [] });

/** Os Top 5 de cada ranking (o banco monta tudo de uma vez). */
export async function buscarRankings(): Promise<DadosRanking> {
  const { data, error } = await supabase.rpc("hoki_rankings" as never);
  if (error) throw error;
  const bruto = (data ?? {}) as Record<string, unknown>;
  const dados = vazio();
  for (const r of RANKINGS) {
    const lista = Array.isArray(bruto[r.chave]) ? (bruto[r.chave] as { nome?: unknown; valor?: unknown }[]) : [];
    dados[r.chave] = lista
      .map((l) => ({ nome: String(l.nome ?? "").slice(0, 24), valor: Number(l.valor) || 0 }))
      .filter((l) => l.nome)
      .slice(0, 5);
  }
  return dados;
}

/** O que vai escrito no arco para o ranking `i`. */
export function quadroDoRanking(dados: DadosRanking | undefined, i: number): QuadroRanking {
  const n = RANKINGS.length;
  const pagina = ((i % n) + n) % n;
  const r = RANKINGS[pagina]!;
  return {
    titulo: r.titulo,
    sub: dados ? r.sub : "Carregando…",
    linhas: (dados?.[r.chave] ?? []).map((l) => ({ nome: l.nome, valor: r.valor(l.valor) })),
    pagina,
    total: n,
  };
}

/**
 * Conta um minuto de acesso (e, se o HOKI está no berço, um minuto dormindo).
 * O banco só aceita um por minuto por pessoa, mesmo com várias abas abertas.
 */
export async function registrarAcesso(dormindo: boolean): Promise<void> {
  await supabase.rpc("hoki_registrar_acesso" as never, { p_dormindo: dormindo } as never);
}
