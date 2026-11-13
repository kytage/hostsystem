import { useMemo, useState } from "react";
import { FileStack, Loader2, Search, X } from "lucide-react";
import {
  FAIXAS_HORARIAS,
  fetchSetOnlineHistorico,
  filtrarPorFaixa,
  limitesDoPeriodo,
  type FaixaHoraria,
} from "@/lib/ilegal-online";
import { fetchPunicoesPorSetagem } from "@/lib/punicoes";
import { fetchDetalhes, type IlegalCategoria, type IlegalOrg } from "@/lib/ilegal-data";
import {
  filtrarRegistrosPorPeriodo,
  gerarRelatorioOrgPdf,
  RELATORIO_ORG_DEFAULT,
  type RelatorioOrgConfig,
} from "@/lib/relatorio-org";
import { getCurrentUsername } from "@/lib/kanban";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { PeriodoField, erroDoPeriodoCustom } from "@/components/periodo-field";
import { toggles } from "@/components/ilegal-org-relatorio-modal";
import { cn } from "@/lib/utils";

interface Props {
  categorias: IlegalCategoria[];
  onClose: () => void;
}

type Modo = "separado" | "juntos";

/** Relatório de várias setagens: um PDF por setagem ou todas num PDF só. */
export function IlegalRelatorioMultiModal({ categorias, onClose }: Props) {
  const [cfg, setCfg] = useState<RelatorioOrgConfig>({ ...RELATORIO_ORG_DEFAULT });
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<Modo>("juntos");
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");

  const set = <K extends keyof RelatorioOrgConfig>(k: K, v: RelatorioOrgConfig[K]) => {
    setErro("");
    setCfg((p) => ({ ...p, [k]: v }));
  };

  const orgs = useMemo(
    () =>
      categorias.flatMap((c) =>
        c.orgs.filter((o) => o.setagem.trim()).map((o) => ({ org: o, categoriaNome: c.nome }))
      ),
    [categorias]
  );
  const q = busca.trim().toLowerCase();
  const visiveis = orgs.filter(
    ({ org, categoriaNome }) =>
      !q ||
      [org.setagem, org.organizacao, categoriaNome].join(" ").toLowerCase().includes(q)
  );

  const alternar = (id: string) => {
    setErro("");
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const todasVisiveisMarcadas = visiveis.length > 0 && visiveis.every((v) => selecionadas.has(v.org.id));
  const alternarVisiveis = () =>
    setSelecionadas((prev) => {
      const n = new Set(prev);
      for (const v of visiveis) {
        if (todasVisiveisMarcadas) n.delete(v.org.id);
        else n.add(v.org.id);
      }
      return n;
    });

  const montarDados = async (org: IlegalOrg, categoriaNome: string) => {
    const { inicio, fim } = limitesDoPeriodo(cfg.periodo, cfg.intervalo);
    const [online, registros, detalhes] = await Promise.all([
      fetchSetOnlineHistorico(org.setagem, cfg.periodo, org.limpoEm, cfg.intervalo),
      fetchPunicoesPorSetagem(org.setagem),
      fetchDetalhes(org.id),
    ]);
    return {
      org,
      categoriaNome,
      detalhes,
      online: filtrarPorFaixa(online, cfg.faixa),
      registros: filtrarRegistrosPorPeriodo(registros, inicio, org.limpoEm, fim),
    };
  };

  const gerar = async () => {
    const invalido = erroDoPeriodoCustom(cfg.periodo, cfg.intervalo);
    if (invalido) return setErro(invalido);
    const escolhidas = orgs.filter((o) => selecionadas.has(o.org.id));
    if (escolhidas.length === 0) return setErro("Selecione ao menos uma setagem.");
    setErro("");
    try {
      const autor = await getCurrentUsername();
      let doc: import("jspdf").jsPDF | undefined;
      for (const [i, { org, categoriaNome }] of escolhidas.entries()) {
        setProgresso(`Gerando ${i + 1}/${escolhidas.length} — ${org.setagem}`);
        const dados = await montarDados(org, categoriaNome);
        const c = { ...cfg, titulo: cfg.titulo.trim() || `Relatório — ${org.setagem}` };
        if (modo === "separado") {
          await gerarRelatorioOrgPdf(dados, { ...c, titulo: `Relatório — ${org.setagem}` }, { autor });
        } else {
          doc = await gerarRelatorioOrgPdf(dados, { ...c, titulo: `Relatório — ${org.setagem}` }, { autor }, { doc, salvar: false });
        }
      }
      if (modo === "juntos" && doc) {
        doc.save(`relatorio-setagens-${escolhidas.length}-${new Date().toLocaleDateString("sv-SE")}.pdf`);
      }
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar os relatórios.");
    } finally {
      setProgresso("");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[22px] glass-modal p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="hc-icone">
              <FileStack className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="hc-titulo">Relatório de várias setagens</h2>
              <p className="hc-nota mt-1">
                Denúncias e VAR são filtradas pela data registrada da punição dentro do período.
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="hc-seta">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PeriodoField
            periodo={cfg.periodo}
            intervalo={cfg.intervalo}
            onPeriodo={(p) => set("periodo", p)}
            onIntervalo={(v) => set("intervalo", v)}
          />
          <label className="block">
            <span className="hc-sobre mb-1 block">Faixa horária</span>
            <MinimalSelect value={cfg.faixa} onChange={(v) => set("faixa", v as FaixaHoraria)}
              options={FAIXAS_HORARIAS.map((f) => ({ value: f.id, label: f.label }))} />
          </label>
          <label className="block">
            <span className="hc-sobre mb-1 block">Formato</span>
            <MinimalSelect value={modo} onChange={(v) => setModo(v as Modo)}
              options={[
                { value: "juntos", label: "Um PDF com todas" },
                { value: "separado", label: "Um PDF por setagem" },
              ]} />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
          {toggles.map((t) => {
            const ativo = Boolean(cfg[t.key]);
            return (
              <button key={t.key} aria-pressed={ativo} onClick={() => set(t.key, !ativo as never)} title={t.hint}
                className={cn("hc-dentro p-2.5 text-left transition-colors",
                  ativo && "!border-foreground/30 !bg-foreground/[0.07]")}>
                <p className={cn("text-xs font-semibold", ativo ? "text-foreground" : "text-muted-foreground")}>{t.label}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label className="campo-busca grow basis-56">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar setagem..."
              aria-label="Buscar setagem" />
          </label>
          <button onClick={alternarVisiveis} className="pilula rounded-full">
            {todasVisiveisMarcadas ? "Desmarcar todas" : "Marcar todas"}
          </button>
          <span className="hc-selo tabular-nums">{selecionadas.size} selecionada(s)</span>
        </div>

        <div className="mt-3 grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {visiveis.map(({ org, categoriaNome }) => {
            const on = selecionadas.has(org.id);
            return (
              <button key={org.id} aria-pressed={on} onClick={() => alternar(org.id)}
                className={cn("hc-dentro px-3 py-2 text-left text-xs transition-colors",
                  on && "!border-foreground/30 !bg-foreground/[0.07]")}>
                <span className={cn("font-semibold", on ? "text-foreground" : "text-muted-foreground")}>{org.setagem}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {categoriaNome}{org.organizacao ? ` · ${org.organizacao}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        {erro && <p className="mt-3 text-xs font-semibold text-destructive">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          {progresso && <span className="mr-auto text-xs text-muted-foreground">{progresso}</span>}
          <button onClick={onClose} className="pilula rounded-full">
            Cancelar
          </button>
          <button onClick={() => void gerar()} disabled={Boolean(progresso)}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60">
            {progresso ? <Loader2 className="size-4 animate-spin" /> : <FileStack className="size-4" />}
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
