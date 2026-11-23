// Datas em português do Brasil. Datas do painel são "AAAA-MM-DD"; momentos são ISO.

const MESES_CURTOS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const dois = (n: number) => String(n).padStart(2, "0");
export const paraData = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const hoje = () => paraData(new Date());
export function deData(data: string): Date {
  const [a, m, d] = data.slice(0, 10).split("-").map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}
export function somarDias(data: string, dias: number): string {
  const d = deData(data);
  d.setDate(d.getDate() + dias);
  return paraData(d);
}
/** Dias de hoje até a data (negativo = já passou). */
export function diasAte(data: string): number {
  return Math.round((deData(data).getTime() - deData(hoje()).getTime()) / 86_400_000);
}

/** "21 de nov." (com o ano se não for o atual). */
export function formatarData(data: string | null | undefined): string {
  if (!data) return "";
  const d = deData(data);
  const ano = d.getFullYear() === new Date().getFullYear() ? "" : ` de ${d.getFullYear()}`;
  return `${d.getDate()} de ${MESES_CURTOS[d.getMonth()]}${ano}`;
}
/** "sábado, 21 de novembro" */
export function formatarDataLonga(data: string): string {
  const d = deData(data);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
export const diaDaSemanaCurto = (data: string) => DIAS_CURTOS[deData(data).getDay()] ?? "";
export const nomeDoMes = (ano: number, mes: number) => `${MESES[mes]} de ${ano}`;

/** "hoje", "amanhã", "ontem", "em 3 dias", "há 5 dias" ou a data. */
export function prazoRelativo(data: string | null | undefined): string {
  if (!data) return "sem data";
  const n = diasAte(data);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n > 1 && n <= 6) return `em ${n} dias`;
  if (n < -1 && n >= -30) return `há ${-n} dias`;
  return formatarData(data);
}

/** Momento ISO → "há 2 h", "há 3 dias", "21 de nov." */
export function relativo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return formatarData(paraData(new Date(iso)));
}

/** Momento ISO → "21 de nov. às 14:30" */
export function formatarMomento(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatarData(paraData(d))} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export const numero = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toLocaleString("pt-BR"));
/** 12400 → "12,4 mil" */
export function numeroCurto(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
}

export function saudacao(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
