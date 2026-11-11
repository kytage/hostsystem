/**
 * Cores do Ilegal: cada categoria tem a sua, e ela aparece igual no resumo, na
 * faixa da planilha e no filete da linha.
 */
export const HEX_CATEGORIA: Record<string, string> = {
  armas: "#ef4444",
  municao: "#f97316",
  lavagem: "#10b981",
  garagem: "#0ea5e9",
  drogas: "#8b5cf6",
  hpi: "#ec4899",
  a_definir: "#71717a",
};
export const hexDaCategoria = (id: string) => HEX_CATEGORIA[id] ?? "#71717a";

/** Cores do status da setagem e da situação da entrega. */
export const HEX_STATUS = {
  Assumida: "#34d399",
  Reservada: "#fbbf24",
  Livre: "#38bdf8",
  Fechado: "#71717a",
} as const;
export const HEX_SITUACAO = {
  Entregue: "#34d399",
  Pendente: "#fb923c",
  ".": "#52525b",
} as const;
/** Série das assumidas pelo maior pico de online (A 10+, B 5–9, C 0–4). */
export const HEX_SERIE = { A: "#fbbf24", B: "#34d399", C: "#ef4444" } as const;
