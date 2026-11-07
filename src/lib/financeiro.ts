import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";

/**
 * Módulo financeiro (exclusivo Founder).
 *
 * Todo registro é ancorado em um "mês de competência" (`mes`), sempre
 * normalizado para o dia 01 em formato ISO `YYYY-MM-DD`. Isso permite
 * navegar mês a mês sem depender de fuso horário ou do dia do pagamento.
 */

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type SaidaTipo = "fixa" | "variavel" | "contrato";
export type SaidaSubtipo = "staff" | "servico" | "outro";
export type SaidaStatus = "pendente" | "atrasado" | "pago" | "cancelado";

export interface Entrada {
  id: string;
  mes: string;
  titulo: string;
  valor: number;
  observacao: string;
  criadoPor: string;
  createdAt: string;
}

export interface Saida {
  id: string;
  mes: string;
  titulo: string;
  valor: number;
  dataPagamento: string | null;
  tipo: SaidaTipo;
  subtipo: SaidaSubtipo;
  status: SaidaStatus;
  observacao: string;
  comprovante: string;
  criadoPor: string;
  createdAt: string;
}

export interface MesConfig {
  mes: string;
  entradaPrevista: number;
  saldoInicial: number;
  observacao: string;
}

/* ------------------------------------------------------------------ *
 * Rótulos e cores (tokens semânticos / paleta consistente)
 * ------------------------------------------------------------------ */

export const TIPO_LABELS: Record<SaidaTipo, string> = {
  fixa: "Fixa",
  variavel: "Variável",
  contrato: "Contrato",
};

export const SUBTIPO_LABELS: Record<SaidaSubtipo, string> = {
  staff: "Staff",
  servico: "Serviço/Manutenção",
  outro: "Outro",
};

export const STATUS_LABELS: Record<SaidaStatus, string> = {
  pendente: "Pendente",
  atrasado: "Atrasado",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const STATUS_CLASSES: Record<SaidaStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  atrasado: "bg-destructive/15 text-destructive border-destructive/30",
  pago: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export const TIPO_CLASSES: Record<SaidaTipo, string> = {
  fixa: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  variavel: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  contrato: "bg-primary/15 text-primary border-primary/30",
};

/* ------------------------------------------------------------------ *
 * Utilidades de mês
 * ------------------------------------------------------------------ */

/** Primeiro dia do mês de `ref` em ISO `YYYY-MM-01`. */
export function mesKey(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Soma `delta` meses a uma chave de mês. */
export function addMeses(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date((y ?? 2026), (m ?? 1) - 1 + delta, 1);
  return mesKey(d);
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function mesLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MESES_PT[(m ?? 1) - 1]} ${y}`;
}

export function mesLabelCurto(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${(MESES_PT[(m ?? 1) - 1] ?? "").slice(0, 3)}/${String(y).slice(2)}`;
}

/**
 * Lista de meses disponíveis: 12 meses a partir do mês atual (futuros já
 * criados) mais quaisquer meses passados que tenham registros.
 */
export function listaMeses(mesesComDados: string[] = [], futuros = 12): string[] {
  const base = mesKey();
  const set = new Set<string>(mesesComDados);
  for (let i = 0; i <= futuros; i++) set.add(addMeses(base, i));
  return [...set].sort();
}

export function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** Converte texto digitado ("1.200,50" / "1200.5") em número. */
export function parseValor(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

type EntradaRow = {
  id: string;
  mes: string;
  titulo: string;
  valor: number | string;
  observacao: string;
  criado_por: string;
  created_at: string;
};

type SaidaRow = {
  id: string;
  mes: string;
  titulo: string;
  valor: number | string;
  data_pagamento: string | null;
  tipo: string;
  subtipo: string;
  status: string;
  observacao: string;
  comprovante: string;
  criado_por: string;
  created_at: string;
};

const num = (v: number | string): number => (typeof v === "number" ? v : Number(v) || 0);

const toEntrada = (r: EntradaRow): Entrada => ({
  id: r.id,
  mes: r.mes,
  titulo: r.titulo,
  valor: num(r.valor),
  observacao: r.observacao,
  criadoPor: r.criado_por,
  createdAt: r.created_at,
});

const toSaida = (r: SaidaRow): Saida => ({
  id: r.id,
  mes: r.mes,
  titulo: r.titulo,
  valor: num(r.valor),
  dataPagamento: r.data_pagamento,
  tipo: (r.tipo as SaidaTipo) ?? "variavel",
  subtipo: (r.subtipo as SaidaSubtipo) ?? "outro",
  status: (r.status as SaidaStatus) ?? "pendente",
  observacao: r.observacao,
  comprovante: r.comprovante,
  criadoPor: r.criado_por,
  createdAt: r.created_at,
});

export async function fetchEntradas(): Promise<Entrada[]> {
  const { data, error } = await supabase
    .from("financeiro_entradas")
    .select("id, mes, titulo, valor, observacao, criado_por, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as EntradaRow[]).map(toEntrada);
}

export async function fetchSaidas(): Promise<Saida[]> {
  const { data, error } = await supabase
    .from("financeiro_saidas")
    .select(
      "id, mes, titulo, valor, data_pagamento, tipo, subtipo, status, observacao, comprovante, criado_por, created_at"
    )
    .order("data_pagamento", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as SaidaRow[]).map(toSaida);
}

export async function fetchMeses(): Promise<Map<string, MesConfig>> {
  const { data, error } = await supabase
    .from("financeiro_meses")
    .select("mes, entrada_prevista, saldo_inicial, observacao");
  if (error) throw error;
  const map = new Map<string, MesConfig>();
  for (const r of (data ?? []) as {
    mes: string;
    entrada_prevista: number | string;
    saldo_inicial: number | string;
    observacao: string;
  }[]) {
    map.set(r.mes, {
      mes: r.mes,
      entradaPrevista: num(r.entrada_prevista),
      saldoInicial: num(r.saldo_inicial),
      observacao: r.observacao,
    });
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

async function autor(): Promise<{ nome: string; id: string | null }> {
  const auth = await getAuthUserData();
  const id = auth.user?.id ?? null;
  if (!id) return { nome: "", id: null };
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  return { nome: data?.username ?? "", id };
}

export async function salvarEntrada(input: {
  id?: string;
  mes: string;
  titulo: string;
  valor: number;
  observacao: string;
}): Promise<void> {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Informe o nome da entrada.");
  if (input.id) {
    const { error } = await supabase
      .from("financeiro_entradas")
      .update({
        mes: input.mes,
        titulo,
        valor: input.valor,
        observacao: input.observacao,
      })
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  const a = await autor();
  const { error } = await supabase.from("financeiro_entradas").insert({
    mes: input.mes,
    titulo,
    valor: input.valor,
    observacao: input.observacao,
    criado_por: a.nome,
    criado_por_id: a.id,
  });
  if (error) throw error;
}

export async function excluirEntrada(id: string): Promise<void> {
  const { error } = await supabase.from("financeiro_entradas").delete().eq("id", id);
  if (error) throw error;
}

export interface SaidaInput {
  id?: string;
  mes: string;
  titulo: string;
  valor: number;
  dataPagamento: string | null;
  tipo: SaidaTipo;
  subtipo: SaidaSubtipo;
  status: SaidaStatus;
  observacao: string;
  comprovante: string;
  /** Quantos meses futuros replicar (apenas para tipo "fixa"). */
  repetirMeses?: number;
}

/**
 * Salva uma saída. Para o tipo "fixa" em criação, replica o registro nos
 * meses seguintes (padrão: 11 meses à frente, totalizando 12 lançamentos),
 * mantendo o mesmo dia de pagamento quando possível.
 */
export async function salvarSaida(input: SaidaInput): Promise<void> {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Informe o título da saída.");

  const base = {
    titulo,
    valor: input.valor,
    tipo: input.tipo,
    subtipo: input.subtipo,
    status: input.status,
    observacao: input.observacao,
    comprovante: input.comprovante,
  };

  if (input.id) {
    const { error } = await supabase
      .from("financeiro_saidas")
      .update({ ...base, mes: input.mes, data_pagamento: input.dataPagamento })
      .eq("id", input.id);
    if (error) throw error;
    return;
  }

  const a = await autor();
  const repeticoes = input.tipo === "fixa" ? Math.max(0, input.repetirMeses ?? 11) : 0;
  const rows: {
    titulo: string;
    valor: number;
    tipo: SaidaTipo;
    subtipo: SaidaSubtipo;
    status: SaidaStatus;
    observacao: string;
    comprovante: string;
    mes: string;
    data_pagamento: string | null;
    criado_por: string;
    criado_por_id: string | null;
  }[] = [];

  for (let i = 0; i <= repeticoes; i++) {
    const mes = addMeses(input.mes, i);
    let dataPagamento = input.dataPagamento;
    if (dataPagamento && i > 0) {
      const dia = Number(dataPagamento.slice(8, 10));
      const [y, m] = mes.split("-").map(Number);
      const ultimoDia = new Date((y ?? 2026), (m ?? 1), 0).getDate();
      const diaFinal = Math.min(dia || 1, ultimoDia);
      dataPagamento = `${mes.slice(0, 8)}${String(diaFinal).padStart(2, "0")}`;
    }
    rows.push({
      ...base,
      mes,
      data_pagamento: dataPagamento,
      // Lançamentos futuros de uma fixa nascem pendentes.
      status: i === 0 ? input.status : "pendente",
      criado_por: a.nome,
      criado_por_id: a.id,
    });
  }

  const { error } = await supabase.from("financeiro_saidas").insert(rows);
  if (error) throw error;
}

export async function atualizarStatusSaida(id: string, status: SaidaStatus): Promise<void> {
  const { error } = await supabase.from("financeiro_saidas").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function excluirSaida(id: string): Promise<void> {
  const { error } = await supabase.from("financeiro_saidas").delete().eq("id", id);
  if (error) throw error;
}

export async function salvarMesConfig(input: {
  mes: string;
  entradaPrevista: number;
  saldoInicial: number;
  observacao?: string;
}): Promise<void> {
  const { error } = await supabase.from("financeiro_meses").upsert(
    {
      mes: input.mes,
      entrada_prevista: input.entradaPrevista,
      saldo_inicial: input.saldoInicial,
      observacao: input.observacao ?? "",
    },
    { onConflict: "mes" }
  );
  if (error) throw error;
}

/* ------------------------------------------------------------------ *
 * Agregações
 * ------------------------------------------------------------------ */

export interface ResumoMes {
  mes: string;
  entradasRegistradas: number;
  entradaPrevista: number;
  /** Maior entre previsto e registrado — base de caixa do mês. */
  entradasTotal: number;
  despesasPagas: number;
  despesasAbertas: number;
  despesasTotal: number;
  saldoInicial: number;
  saldo: number;
}

export function resumoDoMes(
  mes: string,
  entradas: Entrada[],
  saidas: Saida[],
  config: Map<string, MesConfig> | undefined
): ResumoMes {
  const cfg = config?.get(mes);
  const entradasRegistradas = entradas
    .filter((e) => e.mes === mes)
    .reduce((s, e) => s + e.valor, 0);
  const entradaPrevista = cfg?.entradaPrevista ?? 0;
  const entradasTotal = Math.max(entradaPrevista, entradasRegistradas);

  const doMes = saidas.filter((s) => s.mes === mes && s.status !== "cancelado");
  const despesasPagas = doMes.filter((s) => s.status === "pago").reduce((s, x) => s + x.valor, 0);
  const despesasAbertas = doMes.filter((s) => s.status !== "pago").reduce((s, x) => s + x.valor, 0);
  const saldoInicial = cfg?.saldoInicial ?? 0;

  return {
    mes,
    entradasRegistradas,
    entradaPrevista,
    entradasTotal,
    despesasPagas,
    despesasAbertas,
    despesasTotal: despesasPagas + despesasAbertas,
    saldoInicial,
    saldo: saldoInicial + entradasTotal - despesasPagas,
  };
}

/** Série de comparação (entradas x despesas x saldo) para o gráfico. */
export function serieMeses(
  meses: string[],
  entradas: Entrada[],
  saidas: Saida[],
  config: Map<string, MesConfig> | undefined
): { mes: string; label: string; entradas: number; despesas: number; saldo: number }[] {
  return meses.map((mes) => {
    const r = resumoDoMes(mes, entradas, saidas, config);
    return {
      mes,
      label: mesLabelCurto(mes),
      entradas: r.entradasTotal,
      despesas: r.despesasTotal,
      saldo: r.saldo,
    };
  });
}

/** Distribuição das despesas do mês por subtipo (gráfico de pizza). */
export function porSubtipo(mes: string, saidas: Saida[]): { nome: string; valor: number }[] {
  const mapa = new Map<SaidaSubtipo, number>();
  for (const s of saidas) {
    if (s.mes !== mes || s.status === "cancelado") continue;
    mapa.set(s.subtipo, (mapa.get(s.subtipo) ?? 0) + s.valor);
  }
  return [...mapa.entries()]
    .map(([k, valor]) => ({ nome: SUBTIPO_LABELS[k], valor }))
    .sort((a, b) => b.valor - a.valor);
}

/** Distribuição por tipo (fixa / variável / contrato). */
export function porTipo(mes: string, saidas: Saida[]): { nome: string; valor: number }[] {
  const mapa = new Map<SaidaTipo, number>();
  for (const s of saidas) {
    if (s.mes !== mes || s.status === "cancelado") continue;
    mapa.set(s.tipo, (mapa.get(s.tipo) ?? 0) + s.valor);
  }
  return [...mapa.entries()]
    .map(([k, valor]) => ({ nome: TIPO_LABELS[k], valor }))
    .sort((a, b) => b.valor - a.valor);
}
