import { supabase } from "@/integrations/supabase/client";

/**
 * Histórico de online das facções — registros inseridos a cada hora
 * pelo servidor FiveM via REST API (webhook = 'faccoes').
 */
export interface SetOnlineRow {
  id: number;
  webhook: string;
  category: string;
  set_name: string;
  set_label: string;
  amount: number;
  hour: number;
  captured_at: string;
}

/** Categorias exibidas, na ordem fixa pedida. */
export const ONLINE_CATEGORIAS = [
  "Armas",
  "Muni",
  "Lavagem",
  "Garagem",
  "Drogas",
  "HPI",
  "Guarnições",
  "Restaurantes",
] as const;

export type OnlineCategoria = (typeof ONLINE_CATEGORIAS)[number];

/**
 * A API do FiveM envia as categorias em minúsculas e com nomes variados
 * ("munições", "guetto", ...). Normalizamos para os rótulos canônicos
 * usados na interface, senão os gráficos ficam todos zerados.
 */
function chaveNormalizada(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const ALIASES_CATEGORIA: Record<string, OnlineCategoria> = {
  armas: "Armas",
  arma: "Armas",
  muni: "Muni",
  municao: "Muni",
  municoes: "Muni",
  lavagem: "Lavagem",
  garagem: "Garagem",
  garagens: "Garagem",
  drogas: "Drogas",
  droga: "Drogas",
  hpi: "HPI",
  guarnicoes: "Guarnições",
  guarnicao: "Guarnições",
  restaurantes: "Restaurantes",
  restaurante: "Restaurantes",
};

/** Converte a categoria crua do webhook no rótulo canônico da interface. */
export function normalizarCategoria(valor: string): string {
  const chave = chaveNormalizada(valor ?? "");
  return ALIASES_CATEGORIA[chave] ?? (valor ?? "").trim();
}

function normalizarLinhas(rows: SetOnlineRow[]): SetOnlineRow[] {
  return rows.map((r) => ({ ...r, category: normalizarCategoria(r.category) }));
}


export type OnlinePeriodo =
  | "hoje"
  | "1d"
  | "3d"
  | "7d"
  | "30d"
  | "total"
  | "custom";

/**
 * Intervalo livre escolhido pelo usuário ("Personalizado"), no formato
 * YYYY-MM-DD. As duas pontas são dias cheios no horário de Brasília.
 */
export interface IntervaloDatas {
  desde: string;
  ate: string;
}

export const INTERVALO_VAZIO: IntervaloDatas = { desde: "", ate: "" };

export const ONLINE_PERIODOS: { id: OnlinePeriodo; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "1d", label: "24h" },
  { id: "3d", label: "3 dias" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "total", label: "Total" },
];

/** Períodos prontos + a opção de intervalo livre, usada nos relatórios. */
export const ONLINE_PERIODOS_COMPLETOS: { id: OnlinePeriodo; label: string }[] = [
  ...ONLINE_PERIODOS,
  { id: "custom", label: "Personalizado" },
];

export function labelPeriodo(p: OnlinePeriodo): string {
  if (p === "custom") return "Personalizado";
  return ONLINE_PERIODOS.find((x) => x.id === p)?.label ?? p;
}

/** Dia (YYYY-MM-DD) às 00:00 de Brasília. O Brasil não tem horário de verão desde 2019. */
export function inicioDiaBrasilia(data: string | null | undefined): Date | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dia (YYYY-MM-DD) às 23:59:59.999 de Brasília — fecha o dia escolhido. */
export function fimDiaBrasilia(data: string | null | undefined): Date | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T23:59:59.999-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Início e fim (inclusivos) do período; em "custom" usa as datas escolhidas. */
export function limitesDoPeriodo(
  periodo: OnlinePeriodo,
  intervalo?: IntervaloDatas | null
): { inicio: Date | null; fim: Date | null } {
  if (periodo === "custom") {
    return {
      inicio: inicioDiaBrasilia(intervalo?.desde),
      fim: fimDiaBrasilia(intervalo?.ate),
    };
  }
  return { inicio: inicioDoPeriodo(periodo), fim: null };
}

/** Rótulo do período para títulos e PDFs, com as datas quando personalizado. */
export function labelPeriodoComIntervalo(
  periodo: OnlinePeriodo,
  intervalo?: IntervaloDatas | null
): string {
  if (periodo !== "custom") return labelPeriodo(periodo);
  const dia = (v: string) => (v ? v.split("-").reverse().join("/") : "");
  const desde = intervalo?.desde ?? "";
  const ate = intervalo?.ate ?? "";
  if (desde && ate) return `${dia(desde)} a ${dia(ate)}`;
  if (desde) return `a partir de ${dia(desde)}`;
  if (ate) return `até ${dia(ate)}`;
  return "Personalizado";
}

export function inicioDoPeriodo(periodo: OnlinePeriodo): Date | null {
  const agora = new Date();
  if (periodo === "total" || periodo === "custom") return null;
  if (periodo === "hoje") {
    const d = new Date(agora);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const dias = periodo === "1d" ? 1 : periodo === "3d" ? 3 : periodo === "7d" ? 7 : 30;
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
}

/**
 * O backend limita cada resposta a 1000 linhas. Sem paginação, um período com
 * muitos registros devolvia apenas as horas mais antigas e o painel aparecia
 * vazio no horário de pico. Aqui buscamos página por página até o fim.
 */
const PAGINA = 1000;

interface Paginavel {
  range: (
    de: number,
    ate: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

async function paginar(build: () => Paginavel, maximo = 40000): Promise<SetOnlineRow[]> {
  const todos: SetOnlineRow[] = [];
  for (let de = 0; de < maximo; de += PAGINA) {
    const { data, error } = await build().range(de, de + PAGINA - 1);
    if (error) throw error;
    const lote = (data ?? []) as SetOnlineRow[];
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}


/** Busca os registros do período (webhook 'faccoes'), mais antigos primeiro. */
/**
 * No período personalizado, só vale consultar depois que as duas datas foram
 * escolhidas — senão o painel baixaria o histórico inteiro à toa.
 */
function intervaloIncompleto(
  periodo: OnlinePeriodo,
  intervalo?: IntervaloDatas | null
): boolean {
  return periodo === "custom" && !(intervalo?.desde && intervalo?.ate);
}

export async function fetchSetOnline(
  periodo: OnlinePeriodo,
  intervalo?: IntervaloDatas | null
): Promise<SetOnlineRow[]> {
  if (intervaloIncompleto(periodo, intervalo)) return [];
  const { inicio, fim } = limitesDoPeriodo(periodo, intervalo);
  const desde = inicio?.toISOString();
  const ate = fim?.toISOString();
  const rows = await paginar(() => {
    let q = supabase
      .from("set_online_log")
      .select("*")
      .eq("webhook", "faccoes")
      .order("captured_at", { ascending: true });
    if (desde) q = q.gte("captured_at", desde);
    if (ate) q = q.lte("captured_at", ate);
    return q;
  });
  return normalizarLinhas(rows);
}


/** Faixas de horário para filtrar os dados. */
export type FaixaHoraria = "todas" | "pico" | "madrugada" | "manha" | "tarde" | "noite";

export const FAIXAS_HORARIAS: { id: FaixaHoraria; label: string; horas: number[] }[] = [
  { id: "todas", label: "Todas as horas", horas: Array.from({ length: 24 }, (_, i) => i) },
  { id: "pico", label: "Pico (20h-23h)", horas: [20, 21, 22, 23] },
  { id: "madrugada", label: "Madrugada (0h-5h)", horas: [0, 1, 2, 3, 4, 5] },
  { id: "manha", label: "Manhã (6h-11h)", horas: [6, 7, 8, 9, 10, 11] },
  { id: "tarde", label: "Tarde (12h-17h)", horas: [12, 13, 14, 15, 16, 17] },
  { id: "noite", label: "Noite (18h-23h)", horas: [18, 19, 20, 21, 22, 23] },
];

export function horasDaFaixa(faixa: FaixaHoraria): number[] {
  return FAIXAS_HORARIAS.find((f) => f.id === faixa)?.horas ?? [];
}

/** Filtra registros por faixa horária. */
export function filtrarPorFaixa(rows: SetOnlineRow[], faixa: FaixaHoraria): SetOnlineRow[] {
  if (faixa === "todas") return rows;
  const horas = new Set(horasDaFaixa(faixa));
  return rows.filter((r) => horas.has(r.hour));
}

/** Descarta registros anteriores ao marco de limpeza da facção. */
export function filtrarDesde(
  rows: SetOnlineRow[],
  desde: string | null | undefined
): SetOnlineRow[] {
  if (!desde) return rows;
  return rows.filter((r) => r.captured_at >= desde);
}

export interface ResumoHistorico {
  media: number;
  pico: number;
  picoHora: number | null;
  picoAt: string | null;
  registros: number;
  ultimo: number | null;
  ultimoAt: string | null;
}

/** Estatísticas do histórico individual de uma setagem. */
export function resumoHistorico(rows: SetOnlineRow[]): ResumoHistorico {
  if (rows.length === 0) {
    return {
      media: 0,
      pico: 0,
      picoHora: null,
      picoAt: null,
      registros: 0,
      ultimo: null,
      ultimoAt: null,
    };
  }
  let soma = 0;
  let pico = 0;
  let picoHora: number | null = null;
  let picoAt: string | null = null;
  let ultimo = rows[0]!;
  for (const r of rows) {
    const v = Number(r.amount);
    soma += v;
    if (v > pico) {
      pico = v;
      picoHora = r.hour;
      picoAt = r.captured_at;
    }
    if (r.captured_at > ultimo.captured_at) ultimo = r;
  }
  return {
    media: Math.round((soma / rows.length) * 10) / 10,
    pico,
    picoHora,
    picoAt,
    registros: rows.length,
    ultimo: Number(ultimo.amount),
    ultimoAt: ultimo.captured_at,
  };
}

export interface PicoHora {
  hour: number;
  label: string;
  pico: number;
  media: number;
}

/** Pico e média por hora do dia (0-23) para uma setagem. */
export function picoPorHora(rows: SetOnlineRow[]): PicoHora[] {
  const acc = new Map<number, { pico: number; soma: number; n: number }>();
  for (const r of rows) {
    const cur = acc.get(r.hour) ?? { pico: 0, soma: 0, n: 0 };
    const v = Number(r.amount);
    cur.pico = Math.max(cur.pico, v);
    cur.soma += v;
    cur.n += 1;
    acc.set(r.hour, cur);
  }
  return Array.from({ length: 24 }, (_, h) => {
    const cur = acc.get(h);
    return {
      hour: h,
      label: `${String(h).padStart(2, "0")}h`,
      pico: cur?.pico ?? 0,
      media: cur ? Math.round((cur.soma / cur.n) * 10) / 10 : 0,
    };
  });
}


export interface RankingSetOnline {
  setName: string;
  setLabel: string;
  category: string;
  /** Maior valor de online registrado. */
  pico: number;
  /** Hora (0-23) em que o pico ocorreu. */
  picoHora: number;
  /** Timestamp do registro de pico. */
  picoAt: string;
  media: number;
  registros: number;
}

/**
 * Ranking de setagens pelo maior pico de online no período,
 * respeitando filtros de categoria, faixa horária e busca textual.
 */
export function rankingPicos(
  rows: SetOnlineRow[],
  opts?: {
    categoria?: string | "todas";
    faixa?: FaixaHoraria;
    busca?: string;
    minimo?: number;
  }
): RankingSetOnline[] {
  const categoria = opts?.categoria ?? "todas";
  const horas = new Set(horasDaFaixa(opts?.faixa ?? "todas"));
  const busca = (opts?.busca ?? "").trim().toLowerCase();
  const minimo = opts?.minimo ?? 0;

  const mapa = new Map<string, RankingSetOnline & { soma: number }>();
  for (const r of rows) {
    if (categoria !== "todas" && r.category !== categoria) continue;
    if (!horas.has(r.hour)) continue;
    if (
      busca &&
      !r.set_name.toLowerCase().includes(busca) &&
      !r.set_label.toLowerCase().includes(busca)
    )
      continue;

    const amount = Number(r.amount);
    const atual = mapa.get(r.set_name);
    if (!atual) {
      mapa.set(r.set_name, {
        setName: r.set_name,
        setLabel: r.set_label || r.set_name,
        category: r.category,
        pico: amount,
        picoHora: r.hour,
        picoAt: r.captured_at,
        media: amount,
        registros: 1,
        soma: amount,
      });
      continue;
    }
    atual.registros += 1;
    atual.soma += amount;
    if (amount > atual.pico) {
      atual.pico = amount;
      atual.picoHora = r.hour;
      atual.picoAt = r.captured_at;
    }
  }

  return [...mapa.values()]
    .map(({ soma, ...rest }) => ({
      ...rest,
      media: Math.round((soma / rest.registros) * 10) / 10,
    }))
    .filter((r) => r.pico >= minimo)
    .sort((a, b) => b.pico - a.pico || a.setName.localeCompare(b.setName));
}


/**
 * Mantém apenas o registro MAIS RECENTE de cada (categoria, dia, hora),
 * evitando somar duplicados capturados mais de uma vez na mesma hora.
 */
function maisRecentePorHora(rows: SetOnlineRow[]): SetOnlineRow[] {
  const mapa = new Map<string, SetOnlineRow>();
  for (const r of rows) {
    const dia = diaLocal(r.captured_at);
    const key = `${r.category}|${dia}|${r.hour}`;
    const atual = mapa.get(key);
    if (!atual || atual.captured_at < r.captured_at) mapa.set(key, r);
  }
  return [...mapa.values()];
}

export interface PontoGrafico {
  hour: number;
  [categoria: string]: number;
}

/**
 * Série do gráfico: para cada hora (0-23), a MÉDIA de amount por categoria
 * dentro do período (cada dia/hora conta uma única vez — o registro mais recente).
 */
export function serieMediaPorHora(rows: SetOnlineRow[]): PontoGrafico[] {
  const dedup = maisRecentePorHora(rows);
  const soma = new Map<string, { total: number; n: number }>();
  for (const r of dedup) {
    const key = `${r.category}|${r.hour}`;
    const acc = soma.get(key) ?? { total: 0, n: 0 };
    acc.total += Number(r.amount);
    acc.n += 1;
    soma.set(key, acc);
  }
  const pontos: PontoGrafico[] = [];
  for (let h = 0; h < 24; h++) {
    const ponto: PontoGrafico = { hour: h };
    for (const cat of ONLINE_CATEGORIAS) {
      const acc = soma.get(`${cat}|${h}`);
      ponto[cat] = acc ? Math.round((acc.total / acc.n) * 10) / 10 : 0;
    }
    pontos.push(ponto);
  }
  return pontos;
}

/**
 * Setagens cadastradas no painel Ilegal (ilegal_orgs.setagem), em minúsculas.
 * Serve para exibir SOMENTE organizações que realmente existem no Ilegal,
 * descartando sets legais (guarnições, restaurantes, etc.).
 */
export async function fetchSetagensIlegal(): Promise<Set<string>> {
  const { data, error } = await supabase.from("ilegal_orgs").select("setagem");
  if (error) throw error;
  const set = new Set<string>();
  for (const r of (data ?? []) as { setagem: string | null }[]) {
    const v = (r.setagem ?? "").trim().toLowerCase();
    if (v) set.add(v);
  }
  return set;
}

/** Mantém apenas registros de setagens presentes no painel Ilegal. */
export function filtrarSetsIlegal(
  rows: SetOnlineRow[],
  permitidos: Set<string>
): SetOnlineRow[] {
  if (permitidos.size === 0) return [];
  return rows.filter((r) => permitidos.has((r.set_name ?? "").trim().toLowerCase()));
}

export interface PontoPicoDia {
  dia: string;
  label: string;
  /** Maior total simultâneo de online (soma das setagens numa mesma hora). */
  pico: number;
  /** Média dos totais por hora dentro da faixa considerada. */
  media: number;
  /** Hora em que o pico do dia ocorreu. */
  picoHora: number | null;
}

/**
 * Série diária no horário de pico: para cada dia, soma o online de todas as
 * setagens em cada hora da faixa e devolve o MÁXIMO e a média desses totais.
 */
export function seriePicoDiario(
  rows: SetOnlineRow[],
  horas: number[] = [...HORAS_PICO]
): PontoPicoDia[] {
  const permitidas = new Set(horas);
  // Registro mais recente por (set, dia, hora) evita duplicidade de captura.
  const dedup = new Map<string, SetOnlineRow>();
  for (const r of rows) {
    if (!permitidas.has(r.hour)) continue;
    const dia = diaLocal(r.captured_at);
    const key = `${r.set_name}|${dia}|${r.hour}`;
    const atual = dedup.get(key);
    if (!atual || atual.captured_at < r.captured_at) dedup.set(key, r);
  }
  // Total por (dia, hora).
  const totais = new Map<string, number>();
  for (const r of dedup.values()) {
    const dia = diaLocal(r.captured_at);
    const key = `${dia}|${r.hour}`;
    totais.set(key, (totais.get(key) ?? 0) + Number(r.amount));
  }
  const porDia = new Map<string, { pico: number; picoHora: number | null; soma: number; n: number }>();
  for (const [key, total] of totais) {
    const [dia, horaStr] = key.split("|");
    if (!dia) continue;
    const hora = Number(horaStr);
    const cur = porDia.get(dia) ?? { pico: 0, picoHora: null as number | null, soma: 0, n: 0 };
    cur.soma += total;
    cur.n += 1;
    if (total > cur.pico) {
      cur.pico = total;
      cur.picoHora = hora;
    }
    porDia.set(dia, cur);
  }
  return [...porDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dia, v]) => ({
      dia,
      label: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
      pico: v.pico,
      media: Math.round((v.soma / Math.max(1, v.n)) * 10) / 10,
      picoHora: v.picoHora,
    }));
}


export interface ResumoCategoria {
  categoria: OnlineCategoria;
  total: number;
  capturedAt: string | null;
}

/** Horários de pico exibidos na coluna "Média Online" da tabela de setagens. */
export const HORAS_PICO = [20, 21, 22, 23] as const;

/** Horários da coluna "Média Online" do /ilegal: 20h até 00h. */
export const HORAS_MEDIA = [20, 21, 22, 23, 0] as const;

export type SerieIlegal = "A" | "B" | "C";

/** Série pelo maior pico entre 20h–00h: A = 10+, B = 5–9, C = 0–4. */
export function serieDoPico(pico: number | null | undefined): SerieIlegal {
  const v = Number(pico ?? 0);
  if (v >= 10) return "A";
  if (v >= 5) return "B";
  return "C";
}

export interface SetagemOnlineResumo {
  /** Valor mais recente capturado em cada hora de pico (null = sem dado). */
  porHora: Record<number, number | null>;
  /** Soma das 4 horas de pico (20h + 21h + 22h + 23h). */
  soma: number;
  /** Maior valor entre as horas de pico. */
  pico: number;
  /** Hora em que o maior valor ocorreu (null = sem dado). */
  picoHora: number | null;
}

/**
 * Por setagem (set_name), pega o registro MAIS RECENTE de cada hora de pico
 * e calcula soma e maior pico entre os 4 horários. Retorna mapa: set_name -> resumo.
 */
export function mediaPorSetagem(rows: SetOnlineRow[]): Map<string, SetagemOnlineResumo> {
  const maisRecente = new Map<string, SetOnlineRow>();
  for (const r of rows) {
    const key = `${r.set_name}|${r.hour}`;
    const atual = maisRecente.get(key);
    if (!atual || atual.captured_at < r.captured_at) maisRecente.set(key, r);
  }
  const mapa = new Map<string, SetagemOnlineResumo>();
  for (const r of maisRecente.values()) {
    if (!HORAS_MEDIA.includes(r.hour as (typeof HORAS_MEDIA)[number])) continue;
    const cur =
      mapa.get(r.set_name) ??
      {
        porHora: { 20: null, 21: null, 22: null, 23: null, 0: null },
        soma: 0,
        pico: 0,
        picoHora: null as number | null,
      };
    const v = Number(r.amount);
    cur.porHora[r.hour] = v;
    cur.soma = (HORAS_MEDIA as readonly number[]).reduce((acc, h) => acc + (cur.porHora[h] ?? 0), 0);
    let pico = 0;
    let picoHora: number | null = null;
    for (const h of HORAS_MEDIA) {
      const val = cur.porHora[h];
      if (val !== null && val !== undefined && val > pico) {
        pico = val;
        picoHora = h;
      }
    }
    cur.pico = pico;
    cur.picoHora = picoHora;
    mapa.set(r.set_name, cur);
  }
  return mapa;
}

/** Histórico individual de uma setagem, mais antigos primeiro. */
export async function fetchSetOnlineHistorico(
  setName: string,
  periodo: OnlinePeriodo = "30d",
  desdeLimpeza?: string | null,
  intervalo?: IntervaloDatas | null
): Promise<SetOnlineRow[]> {
  if (intervaloIncompleto(periodo, intervalo)) return [];
  const { inicio, fim } = limitesDoPeriodo(periodo, intervalo);
  const limites = [inicio?.toISOString(), desdeLimpeza ?? undefined].filter(
    (v): v is string => Boolean(v)
  );
  const corte = limites.length > 0 ? limites.reduce((a, b) => (a > b ? a : b)) : null;
  const teto = fim?.toISOString();
  const rows = await paginar(() => {
    let q = supabase
      .from("set_online_log")
      .select("*")
      .eq("webhook", "faccoes")
      .eq("set_name", setName)
      .order("captured_at", { ascending: true });
    // O marco de limpeza da facção nunca é ultrapassado, mesmo em "Total".
    if (corte) q = q.gte("captured_at", corte);
    // No intervalo personalizado, para na data final escolhida.
    if (teto) q = q.lte("captured_at", teto);
    return q;
  }, 20000);
  return normalizarLinhas(rows);
}



export interface PontoHistorico {
  label: string;
  amount: number;
  capturedAt: string;
}

/** Série temporal individual: registro mais recente por (dia, hora). */
export function serieHistoricoSetagem(rows: SetOnlineRow[]): PontoHistorico[] {
  const dedup = new Map<string, SetOnlineRow>();
  for (const r of rows) {
    const dia = diaLocal(r.captured_at);
    const key = `${dia}|${r.hour}`;
    const atual = dedup.get(key);
    if (!atual || atual.captured_at < r.captured_at) dedup.set(key, r);
  }
  return [...dedup.values()]
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at))
    .map((r) => ({
      label: `${diaLocal(r.captured_at).slice(8, 10)}/${diaLocal(r.captured_at).slice(5, 7)} ${String(r.hour).padStart(2, "0")}h`,
      amount: Number(r.amount),
      capturedAt: r.captured_at,
    }));
}

/** Total online atual por categoria: soma dos registros MAIS RECENTES de cada set. */
export function resumoAtual(rows: SetOnlineRow[]): ResumoCategoria[] {
  const maisRecente = new Map<string, SetOnlineRow>();
  for (const r of rows) {
    const key = `${r.category}|${r.set_name}`;
    const atual = maisRecente.get(key);
    if (!atual || atual.captured_at < r.captured_at) maisRecente.set(key, r);
  }
  return ONLINE_CATEGORIAS.map((cat) => {
    const sets = [...maisRecente.values()].filter((r) => r.category === cat);
    const total = sets.reduce((acc, r) => acc + Number(r.amount), 0);
    const capturedAt = sets.reduce<string | null>(
      (max, r) => (max === null || r.captured_at > max ? r.captured_at : max),
      null
    );
    return { categoria: cat, total, capturedAt };
  });
}

/** Dia (YYYY-MM-DD) no fuso de Brasília — evita que 22h/23h caiam no dia seguinte (UTC). */
export function diaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
