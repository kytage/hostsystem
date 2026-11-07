import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2, X } from "lucide-react";
import { FAIXAS_HORARIAS, fetchSetOnline, type FaixaHoraria } from "@/lib/ilegal-online";
import { fetchPunicoes } from "@/lib/punicoes";
import type { IlegalCategoria } from "@/lib/ilegal-data";
import {
  exportarGeralCsv,
  gerarRelatorioGeralPdf,
  montarDadosGerais,
  ORDENACOES_GERAL,
  RELATORIO_GERAL_DEFAULT,
  type OrdenacaoGeral,
  type RelatorioGeralConfig,
} from "@/lib/relatorio-geral-ilegal";
import { getCurrentUsername } from "@/lib/kanban";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { PeriodoField, erroDoPeriodoCustom } from "@/components/periodo-field";
import { cn } from "@/lib/utils";

interface IlegalRelatorioGeralModalProps {
  categorias: IlegalCategoria[];
  onClose: () => void;
}

const STATUS_OPCOES = ["todos", "Assumida", "Reservada", "Livre", "Fechado"];

const toggles: { key: keyof RelatorioGeralConfig; label: string; hint: string }[] = [
  { key: "incluirKpis", label: "Indicadores", hint: "Maior pico, média e punições" },
  { key: "incluirGraficoPicoDiario", label: "Pico diário", hint: "Evolução dia a dia" },
  { key: "incluirGraficoPicoHora", label: "Pico por hora", hint: "Comparativo de 0h a 23h" },
  { key: "incluirRankingOnline", label: "Ranking de online", hint: "Maiores picos por setagem" },
  { key: "incluirRankingPunicoes", label: "Ranking de punições", hint: "Setagens com mais registros" },
  { key: "incluirComparativoCategoria", label: "Comparativo por categoria", hint: "Armas, Drogas, Lavagem..." },
  { key: "incluirTabelaGeral", label: "Visão geral", hint: "Tabela com todas as setagens" },
  { key: "incluirListaPunicoes", label: "Lista de denúncias", hint: "Registros detalhados" },
  { key: "incluirListaVar", label: "Lista VAR", hint: "Cheat, formatação, banidos" },
];

/** Relatório geral de todas as setagens do Ilegal, com filtros e rankings. */
export function IlegalRelatorioGeralModal({
  categorias,
  onClose,
}: IlegalRelatorioGeralModalProps) {
  const [cfg, setCfg] = useState<RelatorioGeralConfig>(RELATORIO_GERAL_DEFAULT);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  const set = <K extends keyof RelatorioGeralConfig>(key: K, value: RelatorioGeralConfig[K]) => {
    setErro("");
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  const { data: online = [], isLoading: carregandoOnline } = useQuery({
    queryKey: ["relatorio-geral-online", cfg.periodo, cfg.intervalo.desde, cfg.intervalo.ate],
    queryFn: () => fetchSetOnline(cfg.periodo, cfg.intervalo),
  });

  const { data: punicoes = [], isLoading: carregandoPunicoes } = useQuery({
    queryKey: ["relatorio-geral-punicoes"],
    queryFn: fetchPunicoes,
  });

  const dados = useMemo(
    () => montarDadosGerais(categorias, online, punicoes, cfg),
    [categorias, online, punicoes, cfg]
  );

  const topPico = dados.linhas.reduce(
    (max, l) => (l.pico > max.pico ? l : max),
    { setagem: "—", pico: 0 }
  );
  const totalPunicoes = dados.linhas.reduce((acc, l) => acc + l.total, 0);

  const carregando = carregandoOnline || carregandoPunicoes;

  const gerar = async () => {
    const invalido = erroDoPeriodoCustom(cfg.periodo, cfg.intervalo);
    if (invalido) return setErro(invalido);
    setGerando(true);
    setErro("");
    try {
      const autor = await getCurrentUsername();
      await gerarRelatorioGeralPdf(dados, cfg, { autor });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
              <FileText className="size-5 text-primary" /> Relatório geral do Ilegal
            </h2>
            <p className="text-xs text-muted-foreground">
              Todas as setagens · online, horários de pico, denúncias e VAR
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-3">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Título</span>
            <input
              className={inputCls}
              value={cfg.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </label>

          <PeriodoField
            periodo={cfg.periodo}
            intervalo={cfg.intervalo}
            onPeriodo={(p) => set("periodo", p)}
            onIntervalo={(v) => set("intervalo", v)}
          />
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
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Categoria</span>
            <MinimalSelect
              value={cfg.categoria}
              onChange={(v) => set("categoria", v)}
              options={[
                { value: "todas", label: "Todas" },
                ...categorias.map((c) => ({ value: c.id, label: c.nome })),
              ]}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Status</span>
            <MinimalSelect
              value={cfg.status}
              onChange={(v) => set("status", v)}
              options={STATUS_OPCOES.map((s) => ({
                value: s,
                label: s === "todos" ? "Todos" : s,
              }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Ordenar por
            </span>
            <MinimalSelect
              value={cfg.ordenacao}
              onChange={(v) => set("ordenacao", v as OrdenacaoGeral)}
              options={ORDENACOES_GERAL.map((o) => ({ value: o.id, label: o.label }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Orientação
            </span>
            <MinimalSelect
              value={cfg.orientacao}
              onChange={(v) => set("orientacao", v as RelatorioGeralConfig["orientacao"])}
              options={[
                { value: "portrait", label: "Retrato" },
                { value: "landscape", label: "Paisagem" },
              ]}
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
              value={cfg.minimoPico}
              onChange={(e) => set("minimoPico", Number(e.target.value) || 0)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Linhas no ranking (0 = todas)
            </span>
            <input
              type="number"
              min={0}
              max={200}
              className={inputCls}
              value={cfg.limiteRanking}
              onChange={(e) => set("limiteRanking", Number(e.target.value) || 0)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Limite de registros jurídicos
            </span>
            <input
              type="number"
              min={0}
              max={500}
              className={inputCls}
              value={cfg.limiteRegistros}
              onChange={(e) => set("limiteRegistros", Number(e.target.value) || 0)}
            />
          </label>
        </div>

        <button
          onClick={() => set("somenteComOrganizacao", !cfg.somenteComOrganizacao)}
          className={cn(
            "mt-3 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            cfg.somenteComOrganizacao
              ? "border-white/15 bg-white/[0.07] text-foreground"
              : "border-border text-muted-foreground hover:bg-white/[0.08]"
          )}
        >
          Somente setagens com organização
        </button>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {toggles.map((t) => {
            const ativo = Boolean(cfg[t.key]);
            return (
              <button
                key={t.key}
                onClick={() => set(t.key, !ativo as never)}
                title={t.hint}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  ativo
                    ? "border-white/15 bg-white/[0.07]"
                    : "border-border bg-white/[0.035] hover:bg-accent/50"
                )}
              >
                <p className={cn("text-xs font-semibold", ativo ? "text-primary" : "text-foreground")}>
                  {t.label}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t.hint}</p>
              </button>
            );
          })}
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Observação (opcional)
          </span>
          <textarea
            className={cn(inputCls, "min-h-16 resize-y")}
            value={cfg.observacao}
            onChange={(e) => set("observacao", e.target.value)}
            placeholder="Contexto do relatório..."
          />
        </label>

        <div className="mt-4 rounded-xl glass-inset p-3 text-xs text-muted-foreground">
          {carregando ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Carregando dados...
            </span>
          ) : (
            <>
              Prévia: <b className="text-foreground">{dados.linhas.length}</b> setagens ·{" "}
              <b className="text-foreground">{dados.online.length}</b> capturas de online · maior
              pico <b className="text-primary">{topPico.pico}</b> ({topPico.setagem}) ·{" "}
              <b className="text-foreground">{totalPunicoes}</b> punições.
            </>
          )}
        </div>

        {erro && <p className="mt-3 text-xs font-semibold text-primary">{erro}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            onClick={() => exportarGeralCsv(dados.linhas)}
            disabled={carregando || dados.linhas.length === 0}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-60"
          >
            <FileSpreadsheet className="size-4" /> CSV
          </button>
          <button
            onClick={() => void gerar()}
            disabled={gerando || carregando}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
