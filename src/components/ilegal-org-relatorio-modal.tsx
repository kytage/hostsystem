import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, X } from "lucide-react";
import {
  FAIXAS_HORARIAS,
  fetchSetOnlineHistorico,
  filtrarPorFaixa,
  limitesDoPeriodo,
  resumoHistorico,
  type FaixaHoraria,
} from "@/lib/ilegal-online";
import { fetchPunicoesPorSetagem } from "@/lib/punicoes";
import { fetchDetalhes, type IlegalOrg } from "@/lib/ilegal-data";
import {
  gerarRelatorioOrgPdf,
  filtrarRegistrosPorPeriodo,
  RELATORIO_ORG_DEFAULT,
  type RelatorioOrgConfig,
} from "@/lib/relatorio-org";
import { getCurrentUsername } from "@/lib/kanban";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { PeriodoField, erroDoPeriodoCustom } from "@/components/periodo-field";
import { cn } from "@/lib/utils";

interface IlegalOrgRelatorioModalProps {
  org: IlegalOrg;
  categoriaNome: string;
  onClose: () => void;
}

export const toggles: { key: keyof RelatorioOrgConfig; label: string; hint: string }[] = [
  { key: "incluirLogo", label: "Logo da facção", hint: "Imagem no topo do PDF" },
  { key: "incluirContatos", label: "Contatos e telefones", hint: "Nomes 1-3 e telefones" },
  { key: "incluirVips", label: "VIP FAC", hint: "Salários, baú, carro VIP, pounder..." },
  { key: "incluirOnlineResumo", label: "Resumo de online", hint: "Média, maior pico e último registro" },
  { key: "incluirPicoPorHora", label: "Pico por hora", hint: "Tabela de 0h a 23h" },
  { key: "incluirOnlineRegistros", label: "Registros de online", hint: "Lista bruta das capturas" },
  { key: "incluirDenuncias", label: "Denúncias", hint: "Registros da setagem" },
  { key: "incluirPunicoes", label: "Punições · Júri (VAR)", hint: "Banimentos, cheat, formatação" },
];

/** Monta o relatório consolidado de uma organização ilegal com filtros. */
export function IlegalOrgRelatorioModal({
  org,
  categoriaNome,
  onClose,
}: IlegalOrgRelatorioModalProps) {
  const [cfg, setCfg] = useState<RelatorioOrgConfig>({
    ...RELATORIO_ORG_DEFAULT,
    titulo: `Relatório — ${org.setagem}`,
  });
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  const set = <K extends keyof RelatorioOrgConfig>(key: K, value: RelatorioOrgConfig[K]) => {
    setErro("");
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  const { data: online = [], isLoading: carregandoOnline } = useQuery({
    queryKey: [
      "relatorio-org-online",
      org.setagem,
      cfg.periodo,
      cfg.intervalo.desde,
      cfg.intervalo.ate,
      org.limpoEm,
    ],
    queryFn: () => fetchSetOnlineHistorico(org.setagem, cfg.periodo, org.limpoEm, cfg.intervalo),
    enabled: Boolean(org.setagem),
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["punicoes-setagem", org.setagem],
    queryFn: () => fetchPunicoesPorSetagem(org.setagem),
    enabled: Boolean(org.setagem),
  });

  const onlineFiltrado = useMemo(
    () => filtrarPorFaixa(online, cfg.faixa),
    [online, cfg.faixa]
  );
  const registrosVisiveis = useMemo(() => {
    const { inicio, fim } = limitesDoPeriodo(cfg.periodo, cfg.intervalo);
    return filtrarRegistrosPorPeriodo(registros, inicio, org.limpoEm, fim);
  }, [registros, org.limpoEm, cfg.periodo, cfg.intervalo]);
  const resumo = useMemo(() => resumoHistorico(onlineFiltrado), [onlineFiltrado]);

  const gerar = async () => {
    const invalido = erroDoPeriodoCustom(cfg.periodo, cfg.intervalo);
    if (invalido) return setErro(invalido);
    setGerando(true);
    setErro("");
    try {
      const autor = await getCurrentUsername();
      const detalhes = await fetchDetalhes(org.id);
      await gerarRelatorioOrgPdf(
        { org, categoriaNome, detalhes, online: onlineFiltrado, registros: registrosVisiveis },
        cfg,
        { autor }
      );
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-input bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/30";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[22px] glass-modal p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="hc-icone">
              <FileText className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="hc-titulo">Relatório da organização</h2>
              <p className="hc-nota mt-1">
                {org.setagem} · {categoriaNome}
                {org.organizacao ? ` · ${org.organizacao}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-3">
            <span className="hc-sobre mb-1 block">Título</span>
            <input
              className={inputCls}
              value={cfg.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </label>
          <PeriodoField
            className="sm:col-span-1"
            label="Período do online"
            periodo={cfg.periodo}
            intervalo={cfg.intervalo}
            onPeriodo={(p) => set("periodo", p)}
            onIntervalo={(v) => set("intervalo", v)}
          />
          <label className="block">
            <span className="hc-sobre mb-1 block">
              Faixa horária
            </span>
            <MinimalSelect
              value={cfg.faixa}
              onChange={(v) => set("faixa", v as FaixaHoraria)}
              options={FAIXAS_HORARIAS.map((f) => ({ value: f.id, label: f.label }))}
            />
          </label>
          <label className="block">
            <span className="hc-sobre mb-1 block">
              Orientação
            </span>
            <MinimalSelect
              value={cfg.orientacao}
              onChange={(v) => set("orientacao", v as RelatorioOrgConfig["orientacao"])}
              options={[
                { value: "portrait", label: "Retrato" },
                { value: "landscape", label: "Paisagem" },
              ]}
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {toggles.map((t) => {
            const ativo = Boolean(cfg[t.key]);
            return (
              <button
                key={t.key}
                aria-pressed={ativo}
                onClick={() => set(t.key, !ativo as never)}
                title={t.hint}
                className={cn(
                  "hc-dentro p-3 text-left transition-colors",
                  ativo && "!border-foreground/30 !bg-foreground/[0.07]"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    ativo ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {t.label}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t.hint}</p>
              </button>
            );
          })}
        </div>

        {cfg.incluirOnlineRegistros && (
          <label className="mt-3 block max-w-48">
            <span className="hc-sobre mb-1 block">
              Limite de registros
            </span>
            <input
              type="number"
              min={1}
              max={500}
              className={inputCls}
              value={cfg.limiteRegistros}
              onChange={(e) => set("limiteRegistros", Number(e.target.value) || 0)}
            />
          </label>
        )}

        <label className="mt-3 block">
          <span className="hc-sobre mb-1 block">
            Observação (opcional)
          </span>
          <textarea
            className={cn(inputCls, "min-h-16 resize-y")}
            value={cfg.observacao}
            onChange={(e) => set("observacao", e.target.value)}
            placeholder="Contexto do relatório..."
          />
        </label>

        <div className="hc-dentro mt-4 p-3 text-xs text-muted-foreground">
          {carregandoOnline ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Carregando dados...
            </span>
          ) : (
            <>
              Prévia: <b className="text-foreground">{onlineFiltrado.length}</b> capturas de online
              (pico <b className="text-foreground">{resumo.pico}</b>, média {resumo.media}) ·{" "}
              <b className="text-foreground">{registrosVisiveis.length}</b> registros jurídicos.
              {org.limpoEm ? " Recorte após a última limpeza da facção." : ""}
            </>
          )}
        </div>

        {erro && <p className="mt-3 text-xs font-semibold text-primary">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Cancelar
          </button>
          <button
            onClick={() => void gerar()}
            disabled={gerando}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
