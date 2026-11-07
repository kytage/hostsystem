import { useMemo, useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MOTIVOS,
  PUNICOES_OPCOES,
  PUNICOES_VAR,
  RESULTADOS_VAR,
  USERSETS,
  type PunicaoRow,
} from "@/lib/punicoes";
import {
  filtrarRelatorio,
  gerarRelatorioPdf,
  RELATORIO_PADRAO,
  type RelatorioConfig,
} from "@/lib/relatorio-punicoes";

export interface RelatorioDialogProps {
  rows: PunicaoRow[];
  autor: string;
  onClose: () => void;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (d: number) => {
  const data = new Date();
  data.setDate(data.getDate() - (d - 1));
  return data.toISOString().slice(0, 10);
};

const PRESETS = [
  { label: "Hoje", dias: 1 },
  { label: "7 dias", dias: 7 },
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
] as const;

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Chips({
  opcoes,
  selecionados,
  onToggle,
}: {
  opcoes: { key: string; label: string }[];
  selecionados: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = selecionados.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              ativo
                ? "border-white/15 bg-white/[0.09] text-foreground"
                : "glass text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  descricao,
  checked,
  onChange,
}: {
  label: string;
  descricao: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        checked ? "border-primary/50 bg-primary/5" : "glass hover:border-primary/30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked ? "border-primary bg-primary" : "border-border"
        )}
      >
        {checked ? <span className="size-1.5 rounded-sm bg-primary-foreground" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{descricao}</span>
      </span>
    </button>
  );
}

export function RelatorioDialog({ rows, autor, onClose }: RelatorioDialogProps) {
  const [cfg, setCfg] = useState<RelatorioConfig>(RELATORIO_PADRAO);
  const [gerando, setGerando] = useState(false);

  const set = <K extends keyof RelatorioConfig>(key: K, value: RelatorioConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const toggleLista = (key: "usersets" | "motivos" | "punicoes" | "staffs", valor: string) =>
    setCfg((c) => ({
      ...c,
      [key]: c[key].includes(valor) ? c[key].filter((v) => v !== valor) : [...c[key], valor],
    }));

  const staffs = useMemo(
    () =>
      [...new Set(rows.map((r) => r.staff).filter((s) => !!s && s.trim()))]
        .sort((a, b) => a.localeCompare(b))
        .map((s) => ({ key: s, label: s })),
    [rows]
  );

  const opcoesPunicao = useMemo(() => {
    const base =
      cfg.tipo === "var"
        ? PUNICOES_VAR.map((p) => p.label)
        : cfg.tipo === "denuncia"
          ? PUNICOES_OPCOES.map((p) => p.label)
          : [...PUNICOES_OPCOES.map((p) => p.label), ...PUNICOES_VAR.map((p) => p.label)];
    return [...new Set(base)].map((l) => ({ key: l, label: l }));
  }, [cfg.tipo]);

  const opcoesMotivo = useMemo(() => {
    const base =
      cfg.tipo === "var"
        ? RESULTADOS_VAR.map((r) => r.label)
        : MOTIVOS.map((m) => m.label);
    return base.map((l) => ({ key: l, label: l }));
  }, [cfg.tipo]);

  const previa = useMemo(() => filtrarRelatorio(rows, cfg).length, [rows, cfg]);

  const gerar = async () => {
    if (previa === 0) {
      toast.error("Nenhum registro corresponde aos filtros escolhidos.");
      return;
    }
    setGerando(true);
    try {
      const total = await gerarRelatorioPdf(rows, cfg, { autor });
      toast.success(`Relatório gerado com ${total} registro(s).`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl glass-modal">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Registros
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground font-display">Gerar relatório em PDF</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha os filtros e as seções que devem aparecer no documento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-8 overflow-y-auto p-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Campo label="Título do relatório">
              <input
                value={cfg.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                className="w-full rounded-xl border border-border bg-black/25 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
              />
            </Campo>

            <Campo label="Tipo de registro">
              <Chips
                opcoes={[
                  { key: "ambos", label: "Denúncias + VAR" },
                  { key: "denuncia", label: "Denúncias" },
                  { key: "var", label: "VAR (hack)" },
                ]}
                selecionados={[cfg.tipo]}
                onToggle={(k) => {
                  setCfg((c) => ({
                    ...c,
                    tipo: k as RelatorioConfig["tipo"],
                    motivos: [],
                    punicoes: [],
                  }));
                }}
              />
            </Campo>

            <Campo label="Período">
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setCfg((c) => ({ ...c, de: diasAtras(p.dias), ate: hoje() }))}
                    className="rounded-lg glass px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCfg((c) => ({ ...c, de: "", ate: "" }))}
                  className="rounded-lg glass px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  Histórico completo
                </button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={cfg.de}
                  onChange={(e) => set("de", e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/25 px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                />
                <input
                  type="date"
                  value={cfg.ate}
                  onChange={(e) => set("ate", e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/25 px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
            </Campo>

            <Campo label="Userset (vazio = todos)">
              <Chips
                opcoes={USERSETS.map((u) => ({ key: u.key, label: u.label }))}
                selecionados={cfg.usersets}
                onToggle={(k) => toggleLista("usersets", k)}
              />
            </Campo>

            <Campo label={cfg.tipo === "var" ? "Resultado (vazio = todos)" : "Motivos (vazio = todos)"}>
              <Chips
                opcoes={opcoesMotivo}
                selecionados={cfg.motivos}
                onToggle={(k) => toggleLista("motivos", k)}
              />
            </Campo>

            <Campo label="Punição aplicada (vazio = todas)">
              <Chips
                opcoes={opcoesPunicao}
                selecionados={cfg.punicoes}
                onToggle={(k) => toggleLista("punicoes", k)}
              />
            </Campo>

            {staffs.length > 0 ? (
              <Campo label="Staff responsável (vazio = todos)">
                <Chips
                  opcoes={staffs}
                  selecionados={cfg.staffs}
                  onToggle={(k) => toggleLista("staffs", k)}
                />
              </Campo>
            ) : null}

            <Campo label="Buscar jogador / ID / ticket">
              <input
                value={cfg.jogador}
                onChange={(e) => set("jogador", e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-xl border border-border bg-black/25 px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </Campo>

            <Campo label="Observação impressa no PDF">
              <textarea
                value={cfg.observacao}
                onChange={(e) => set("observacao", e.target.value)}
                rows={3}
                placeholder="Contexto, destinatário do relatório, conclusões..."
                className="w-full resize-y rounded-xl border border-border bg-black/25 px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </Campo>
          </div>

          <div className="space-y-6">
            <Campo label="Seções do documento">
              <div className="space-y-2">
                <Toggle
                  label="Resumo executivo"
                  descricao="Cards com totais, banimentos e jogadores distintos."
                  checked={cfg.incluirResumo}
                  onChange={(v) => set("incluirResumo", v)}
                />
                <Toggle
                  label="Distribuição por motivo"
                  descricao="Tabela de motivos com percentual."
                  checked={cfg.incluirMotivos}
                  onChange={(v) => set("incluirMotivos", v)}
                />
                <Toggle
                  label="Distribuição por userset"
                  descricao="Ilegal, Polícia e player comum."
                  checked={cfg.incluirUsersets}
                  onChange={(v) => set("incluirUsersets", v)}
                />
                <Toggle
                  label="Ranking de staff"
                  descricao="Top 20 staffs por punições aplicadas."
                  checked={cfg.incluirRanking}
                  onChange={(v) => set("incluirRanking", v)}
                />
                <Toggle
                  label="Registros detalhados"
                  descricao="Tabela completa com data, jogador e punição."
                  checked={cfg.incluirTabela}
                  onChange={(v) => set("incluirTabela", v)}
                />
                <Toggle
                  label="Incluir observações e responsáveis"
                  descricao="Adiciona coluna extra na tabela detalhada."
                  checked={cfg.incluirObservacoes}
                  onChange={(v) => set("incluirObservacoes", v)}
                />
              </div>
            </Campo>

            <Campo label="Layout">
              <Chips
                opcoes={[
                  { key: "landscape", label: "Paisagem" },
                  { key: "portrait", label: "Retrato" },
                ]}
                selecionados={[cfg.orientacao]}
                onToggle={(k) => set("orientacao", k as RelatorioConfig["orientacao"])}
              />
            </Campo>

            <Campo label="Ordenação">
              <Chips
                opcoes={[
                  { key: "recentes", label: "Mais recentes" },
                  { key: "antigos", label: "Mais antigos" },
                ]}
                selecionados={[cfg.ordem]}
                onToggle={(k) => set("ordem", k as RelatorioConfig["ordem"])}
              />
            </Campo>

            <Campo label="Limite de registros">
              <Chips
                opcoes={[
                  { key: "0", label: "Todos" },
                  { key: "25", label: "25" },
                  { key: "50", label: "50" },
                  { key: "100", label: "100" },
                ]}
                selecionados={[String(cfg.limite)]}
                onToggle={(k) => set("limite", Number(k))}
              />
            </Campo>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Prévia
              </p>
              <p className="mt-2 text-3xl font-semibold leading-none text-foreground font-display">{previa}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                registro(s) serão incluídos no PDF
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void gerar()}
            disabled={gerando}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
