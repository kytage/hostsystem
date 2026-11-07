import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Crown,
  Download,
  FileText,
  Loader2,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FAIXAS_HORARIAS,
  fetchSetagensIlegal,
  fetchSetOnline,
  fetchSetOnlineHistorico,
  filtrarPorFaixa,
  filtrarSetsIlegal,
  horasDaFaixa,
  picoPorHora,
  resumoHistorico,
  seriePicoDiario,
  ONLINE_CATEGORIAS,
  ONLINE_PERIODOS,
  rankingPicos,
  resumoAtual,
  serieHistoricoSetagem,
  HORAS_PICO,
  type FaixaHoraria,
  type OnlinePeriodo,
  type RankingSetOnline,
} from "@/lib/ilegal-online";

import {
  aplicarFiltrosRelatorio,
  exportarRankingCsv,
  gerarRelatorioOnlinePdf,
  ORDENACOES_RELATORIO,
  RELATORIO_ONLINE_DEFAULT,
  type OrdenacaoRelatorio,
  type RelatorioOnlineConfig,
} from "@/lib/relatorio-online";
import { supabase } from "@/integrations/supabase/client";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { cn } from "@/lib/utils";

/** Cores fixas por categoria (mesma ordem de ONLINE_CATEGORIAS). */
const CORES: Record<string, string> = {
  Armas: "#ce0e0e",
  Muni: "#f59e0b",
  Lavagem: "#22c55e",
  Garagem: "#3b82f6",
  Drogas: "#a855f7",
  HPI: "#ec4899",
  "Guarnições": "#38bdf8",
  Restaurantes: "#eab308",
};


const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
} as const;

const TOOLTIP_LABEL_STYLE = {
  color: "hsl(var(--foreground))",
  fontWeight: 700,
} as const;

const TICK_STYLE = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
} as const;

const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

function fmtQuando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Nome de exibição do autor do relatório. */
async function autorAtual(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "—";
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data?.username ?? "—";
}

interface RelatorioModalProps {
  ranking: RankingSetOnline[];
  base: Pick<
    RelatorioOnlineConfig,
    "periodo" | "categoria" | "faixa" | "busca" | "minimo"
  >;
  onClose: () => void;
}

function RelatorioOnlineModal({ ranking, base, onClose }: RelatorioModalProps) {
  const [cfg, setCfg] = useState<RelatorioOnlineConfig>({
    ...RELATORIO_ONLINE_DEFAULT,
    ...base,
  });
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = <K extends keyof RelatorioOnlineConfig>(
    key: K,
    value: RelatorioOnlineConfig[K]
  ) => setCfg((prev) => ({ ...prev, [key]: value }));

  /** Pré-visualização do recorte final (mesma regra usada no PDF). */
  const previa = useMemo(() => aplicarFiltrosRelatorio(ranking, cfg), [ranking, cfg]);

  const setagensDisponiveis = useMemo(() => {
    const base = ranking.filter(
      (r) => cfg.categoria === "todas" || r.category === cfg.categoria
    );
    return base
      .map((r) => ({ value: r.setName, label: `${r.setLabel} (${r.category})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ranking, cfg.categoria]);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const autor = await autorAtual();
      await gerarRelatorioOnlinePdf(ranking, cfg, { autor });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl glass p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground font-display">
              Relatório de Online
            </h2>
            <p className="text-xs text-muted-foreground">
              {previa.length} de {ranking.length} setagem(ns) no recorte atual
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Título
            </span>
            <input
              className={inputCls}
              value={cfg.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Período
              </span>
              <MinimalSelect
                value={cfg.periodo}
                onChange={(v) => set("periodo", v as OnlinePeriodo)}
                options={ONLINE_PERIODOS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Categoria / produto
              </span>
              <MinimalSelect
                value={cfg.categoria}
                onChange={(v) => {
                  set("categoria", v);
                  set("setagem", "todas");
                }}
                options={[
                  { value: "todas", label: "Todas as categorias" },
                  ...[...new Set(ranking.map((r) => r.category))]
                    .sort()
                    .map((c) => ({ value: c, label: c })),
                ]}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Organização / setagem
              </span>
              <MinimalSelect
                value={cfg.setagem}
                onChange={(v) => set("setagem", v)}
                options={[
                  { value: "todas", label: "Todas as setagens" },
                  ...setagensDisponiveis,
                ]}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Faixa horária
              </span>
              <MinimalSelect
                value={cfg.faixa}
                onChange={(v) => set("faixa", v as FaixaHoraria)}
                options={FAIXAS_HORARIAS.map((f) => ({ value: f.id, label: f.label }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Ordenar por
              </span>
              <MinimalSelect
                value={cfg.ordenar}
                onChange={(v) => set("ordenar", v as OrdenacaoRelatorio)}
                options={ORDENACOES_RELATORIO}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Pico mínimo
              </span>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={cfg.minimo}
                onChange={(e) => set("minimo", Number(e.target.value) || 0)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Limite de linhas (0 = todas)
              </span>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={cfg.limite}
                onChange={(e) => set("limite", Number(e.target.value) || 0)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Orientação
              </span>
              <MinimalSelect
                value={cfg.orientacao}
                onChange={(v) => set("orientacao", v as "portrait" | "landscape")}
                options={[
                  { value: "portrait", label: "Retrato" },
                  { value: "landscape", label: "Paisagem" },
                ]}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl glass-inset p-3">
            {(
              [
                ["incluirMedia", "Média"],
                ["incluirRegistros", "Nº de registros"],
                ["incluirHora", "Hora do pico"],
                ["incluirQuando", "Data do pico"],
                ["incluirResumoCategoria", "Resumo por categoria"],
              ] as [keyof RelatorioOnlineConfig, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
              >
                <input
                  type="checkbox"
                  checked={Boolean(cfg[key])}
                  onChange={(e) =>
                    set(key, e.target.checked as RelatorioOnlineConfig[typeof key])
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Observação
            </span>
            <textarea
              className={cn(inputCls, "min-h-20 resize-y")}
              value={cfg.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Contexto do relatório..."
            />
          </label>

          {erro && <p className="text-xs font-semibold text-primary">{erro}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => exportarRankingCsv(previa)}
            disabled={previa.length === 0}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            <Download className="size-4" /> CSV
          </button>
          <button
            onClick={gerar}
            disabled={gerando || previa.length === 0}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {gerando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function IlegalOnline() {
  const [periodo, setPeriodo] = useState<OnlinePeriodo>("7d");
  const [categoria, setCategoria] = useState<string>("todas");
  const [faixa, setFaixa] = useState<FaixaHoraria>("todas");
  const [busca, setBusca] = useState("");
  const [minimo, setMinimo] = useState(0);
  const [relatorio, setRelatorio] = useState(false);

  const { data: brutos = [], isLoading } = useQuery({
    queryKey: ["set-online-log", periodo],
    queryFn: () => fetchSetOnline(periodo),
    refetchInterval: 60_000,
  });

  /** Setagens cadastradas no Ilegal: só elas aparecem neste painel. */
  const { data: setsIlegal } = useQuery({
    queryKey: ["ilegal-setagens"],
    queryFn: fetchSetagensIlegal,
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(
    () => (setsIlegal ? filtrarSetsIlegal(brutos, setsIlegal) : []),
    [brutos, setsIlegal]
  );

  const resumo = useMemo(
    () => resumoAtual(rows).filter((r) => r.total > 0),
    [rows]
  );
  const totalGeral = resumo.reduce((acc, r) => acc + r.total, 0);

  /** Categorias realmente presentes no Ilegal (para os filtros). */
  const categoriasDisponiveis = useMemo(() => {
    const presentes = new Set(rows.map((r) => r.category));
    return ONLINE_CATEGORIAS.filter((c) => presentes.has(c));
  }, [rows]);

  const ranking = useMemo(
    () => rankingPicos(rows, { categoria, faixa, busca, minimo }),
    [rows, categoria, faixa, busca, minimo]
  );

  /** Top 12 organizações por pico, para o gráfico de barras. */
  const topOrgs = useMemo(() => ranking.slice(0, 12), [ranking]);

  /** Horas usadas no gráfico: faixa escolhida ou horário de pico (20h-23h). */
  const horasGrafico = useMemo(
    () => (faixa === "todas" ? [...HORAS_PICO] : horasDaFaixa(faixa)),
    [faixa]
  );

  const seriePico = useMemo(() => {
    const base = rows.filter(
      (r) => categoria === "todas" || r.category === categoria
    );
    return seriePicoDiario(base, horasGrafico);
  }, [rows, categoria, horasGrafico]);

  const picoMaximo = useMemo(
    () => seriePico.reduce((max, p) => (p.pico > max.pico ? p : max), {
      pico: 0,
      label: "—",
      picoHora: null as number | null,
      dia: "",
      media: 0,
    }),
    [seriePico]
  );

  const mediaPeriodo = useMemo(() => {
    if (seriePico.length === 0) return 0;
    const soma = seriePico.reduce((acc, p) => acc + p.pico, 0);
    return Math.round((soma / seriePico.length) * 10) / 10;
  }, [seriePico]);

  const rotuloFaixa =
    faixa === "todas"
      ? "Pico (20h-23h)"
      : FAIXAS_HORARIAS.find((f) => f.id === faixa)?.label ?? "";


  return (
    <div className="mt-6 space-y-6">
      {/* Filtro de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="size-4 text-primary" />
          Histórico de Online — Facções
          <span className="text-xs font-medium text-muted-foreground">
            (média por hora no período)
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full glass-modal p-1">
          {ONLINE_PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                periodo === p.id
                  ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                  : "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros avançados */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl glass p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Categoria
          </span>
          <MinimalSelect
            value={categoria}
            onChange={setCategoria}
            options={[
              { value: "todas", label: "Todas as categorias" },
              ...categoriasDisponiveis.map((c) => ({ value: c, label: c })),
            ]}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Faixa horária
          </span>
          <MinimalSelect
            value={faixa}
            onChange={(v) => setFaixa(v as FaixaHoraria)}
            options={FAIXAS_HORARIAS.map((f) => ({ value: f.id, label: f.label }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Buscar setagem
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputCls, "pl-9")}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: Armas01"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pico mínimo
          </span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={minimo}
            onChange={(e) => setMinimo(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      {/* TOP RANKING ONLINE */}
      <section className="rounded-2xl glass p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="size-4 text-primary" />
            Top Ranking Online
            <span className="text-xs font-medium text-muted-foreground">
              (maior pico por setagem)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportarRankingCsv(ranking)}
              disabled={ranking.length === 0}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-40"
            >
              <Download className="size-3.5" /> CSV
            </button>
            <button
              onClick={() => setRelatorio(true)}
              disabled={ranking.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <FileText className="size-3.5" /> Gerar relatório
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : ranking.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro no recorte selecionado.
          </p>
        ) : (
          <div className="space-y-1.5">
            {ranking.slice(0, 20).map((r, i) => (
              <div
                key={r.setName}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl glass-inset px-3 py-2",
                  i === 0 && "border-primary/40 bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    i === 0
                      ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                      : "bg-white/[0.05] text-muted-foreground"
                  )}
                >
                  {i === 0 ? <Crown className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-28 font-semibold text-foreground">{r.setLabel}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${CORES[r.category] ?? "#888"}22`,
                    color: CORES[r.category] ?? "hsl(var(--muted-foreground))",
                  }}
                >
                  {r.category}
                </span>
                <span className="text-sm font-semibold text-primary">
                  {r.pico} Online
                </span>
                <span className="text-xs text-muted-foreground">
                  às {String(r.picoHora).padStart(2, "0")}h · {fmtQuando(r.picoAt)}
                </span>
                <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    média <strong className="text-foreground">{r.media}</strong>
                  </span>
                  <span>
                    reg. <strong className="text-foreground">{r.registros}</strong>
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Maiores organizações (pico de online) */}
      <section className="rounded-2xl glass p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 text-primary" />
          Maiores organizações
          <span className="text-xs font-medium text-muted-foreground">
            (pico de online no recorte)
          </span>
        </h3>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : topOrgs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro no recorte selecionado.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, topOrgs.length * 30)}>
            <BarChart
              data={topOrgs}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="setLabel"
                width={130}
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number) => [`${v} online`, "Pico"]}
              />
              <Bar dataKey="pico" name="Pico" radius={[0, 6, 6, 0]} barSize={16}>
                {topOrgs.map((r) => (
                  <Cell key={r.setName} fill={CORES[r.category] ?? "#ce0e0e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Gráfico — máximo de online no horário de pico, por dia */}
      <section className="rounded-2xl glass p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Activity className="size-4 text-primary" />
            Máximo online no horário de pico
            <span className="text-xs font-medium text-muted-foreground">
              ({rotuloFaixa} · por dia)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full glass-inset px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              Média diária <span className="text-foreground">{mediaPeriodo}</span>
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Recorde {picoMaximo.pico}
              {picoMaximo.picoHora !== null
                ? ` · ${String(picoMaximo.picoHora).padStart(2, "0")}h ${picoMaximo.label}`
                : ""}
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : seriePico.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Activity className="size-6" />
            <p className="text-sm">Nenhum registro no horário de pico neste recorte.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={seriePico}
              margin={{ top: 12, right: 12, bottom: 0, left: -14 }}
            >
              <defs>
                <linearGradient id="gradPico" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ce0e0e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ce0e0e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number, n: string) => [`${v} online`, n]}
              />
              <Area
                type="monotone"
                dataKey="pico"
                name="Máximo"
                stroke="#ce0e0e"
                strokeWidth={2.5}
                fill="url(#gradPico)"
                dot={{ r: 2.5, fill: "#ce0e0e", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="media"
                name="Média do dia"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

      </section>

      {/* Resumo — total online atual por categoria */}
      <section className="rounded-2xl glass p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-primary" />
            Online agora por categoria
          </h3>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Total ilegal online: {totalGeral}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {resumo.map((r) => (
            <div
              key={r.categoria}
              className="rounded-xl glass-inset p-3 text-center"
            >
              <div
                className="mx-auto mb-2 h-1 w-8 rounded-full"
                style={{ backgroundColor: CORES[r.categoria] }}
              />
              <p className="text-xs font-semibold text-muted-foreground">{r.categoria}</p>
              <p className="mt-0.5 text-xl font-semibold text-foreground font-display">{r.total}</p>
              {r.capturedAt && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(r.capturedAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {relatorio && (
        <RelatorioOnlineModal
          ranking={ranking}
          base={{ periodo, categoria, faixa, busca, minimo }}
          onClose={() => setRelatorio(false)}
        />
      )}
    </div>
  );
}


interface SetHistoricoOnlineProps {
  setName: string;
  /** Marco da última limpeza da facção: nada anterior é exibido. */
  limpoEm?: string | null;
}

/** Histórico individual de online de uma setagem (aba "Histórico" do modal). */
export function SetHistoricoOnline({ setName, limpoEm }: SetHistoricoOnlineProps) {
  const [periodo, setPeriodo] = useState<OnlinePeriodo>("7d");
  const [faixa, setFaixa] = useState<FaixaHoraria>("todas");

  const { data: brutos = [], isLoading } = useQuery({
    queryKey: ["set-online-historico", setName, periodo, limpoEm ?? null],
    queryFn: () => fetchSetOnlineHistorico(setName, periodo, limpoEm),
    refetchInterval: 60_000,
  });

  const rows = useMemo(() => filtrarPorFaixa(brutos, faixa), [brutos, faixa]);
  const serie = useMemo(() => serieHistoricoSetagem(rows), [rows]);
  const horas = useMemo(() => picoPorHora(rows).filter((h) => h.pico > 0), [rows]);
  const resumo = useMemo(() => resumoHistorico(rows), [rows]);
  const ultimos = useMemo(() => [...rows].reverse().slice(0, 12), [rows]);

  const filtros = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-full glass-inset p-1">
        {ONLINE_PERIODOS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodo(p.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              periodo === p.id
                ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                : "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="w-44">
        <MinimalSelect
          value={faixa}
          onChange={(v) => setFaixa(v as FaixaHoraria)}
          options={FAIXAS_HORARIAS.map((f) => ({ value: f.id, label: f.label }))}
        />
      </div>
      {limpoEm && (
        <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[10px] font-semibold text-warning">
          Após limpeza · {new Date(limpoEm).toLocaleDateString("pt-BR")}
        </span>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="mt-5 space-y-4">
        {filtros}
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando histórico...
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {filtros}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Activity className="size-6" />
          <p className="text-sm">Nenhum registro de online neste recorte.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl glass-inset p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Média
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground font-display">{resumo.media}</p>
            </div>
            <div className="rounded-xl glass-inset p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Maior pico
              </p>
              <p className="mt-1 text-xl font-semibold text-primary font-display">{resumo.pico}</p>
              <p className="text-[10px] text-muted-foreground">
                {resumo.picoHora !== null
                  ? `${String(resumo.picoHora).padStart(2, "0")}h · ${new Date(
                      resumo.picoAt ?? ""
                    ).toLocaleDateString("pt-BR")}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl glass-inset p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Último
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground font-display">
                {resumo.ultimo ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {resumo.ultimoAt
                  ? new Date(resumo.ultimoAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl glass-inset p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Capturas
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground font-display">{rows.length}</p>
            </div>
          </div>

          <section className="rounded-xl glass-inset p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis allowDecimals={false} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Online"
                  stroke="#ce0e0e"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-xl glass-inset p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <BarChart3 className="size-3.5" /> Pico por hora
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={horas} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="pico" name="Pico" fill="#ce0e0e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="media" name="Média" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-white/[0.035] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Últimos registros
            </div>
            <div className="max-h-56 overflow-y-auto">
              {ultimos.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b border-border/50 px-4 py-2 text-xs last:border-0"
                >
                  <span className="text-muted-foreground">
                    {new Date(r.captured_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                    {r.amount} online
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
