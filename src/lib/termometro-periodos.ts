/**
 * Períodos do queridômetro: hoje, a semana (desde segunda) e o mês (desde o dia 1).
 * As datas são de São Paulo, no formato AAAA-MM-DD (o mesmo da coluna `dia` dos votos).
 */
export type Periodo = "hoje" | "semana" | "mes";

export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
];

/** O dia `n` dias depois (ou antes, com `n` negativo) de `dia`. */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

/** Onde começa cada período para o dia `hoje`, e o dia de ontem. */
export function iniciosDosPeriodos(hoje: string): Record<Periodo, string> & { ontem: string } {
  const [a, m, d] = hoje.split("-").map(Number);
  const diaDaSemana = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = domingo
  return {
    hoje,
    semana: somarDias(hoje, -((diaDaSemana + 6) % 7)),
    mes: `${hoje.slice(0, 7)}-01`,
    ontem: somarDias(hoje, -1),
  };
}

/** "09/11" a partir de "2026-11-09". */
export const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
