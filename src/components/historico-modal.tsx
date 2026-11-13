import { Check, Copy, FileText, History, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CATEGORIA_LABEL,
  fetchCards,
  fetchDevs,
  fetchPatchNoteCards,
  fetchPatchNotes,
  fmtDataHora,
  getCurrentUsername,
  type Categoria,
  type KanbanCard,
  type PatchNote,
} from "@/lib/kanban";
import { KanbanCardModal, CATEGORIA_STYLE } from "@/components/kanban-card-modal";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { cn } from "@/lib/utils";

export interface HistoricoModalProps {
  onClose: () => void;
}

const inputCls =
  "h-9 rounded-xl border border-input bg-black/25 px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

type Tab = "patch" | "arquivados";

/**
 * Histórico unificado: Patch Notes publicados + solicitações arquivadas.
 * Substitui as antigas rotas /patch-notes e /arquivados.
 */
export function HistoricoModal({ onClose }: HistoricoModalProps) {
  const [tab, setTab] = useState<Tab>("patch");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] glass-modal">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] p-5">
          <div>
            <h2 className="hc-titulo">Histórico</h2>
            <p className="hc-nota mt-1">
              Patch Notes publicados e solicitações arquivadas — nada é deletado
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="segmentos" role="tablist" aria-label="Seções do histórico">
              {(
                [
                  { key: "patch", label: "Patch Notes" },
                  { key: "arquivados", label: "Arquivados" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="hc-seta"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "patch" ? <PatchNotesTab /> : <ArquivadosTab />}
        </div>
      </div>
    </div>
  );
}

function PatchNotesTab() {
  const [selected, setSelected] = useState<PatchNote | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [logAberto, setLogAberto] = useState(false);
  const [logCopiado, setLogCopiado] = useState(false);

  const { data: patchNotes = [], isLoading } = useQuery({
    queryKey: ["patch-notes"],
    queryFn: fetchPatchNotes,
  });
  const { data: cardsVinculados = [] } = useQuery({
    queryKey: ["patch-note-cards", selected?.id],
    queryFn: () => fetchPatchNoteCards(selected!.id),
    enabled: !!selected,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="hc-titulo">
              Patch Notes #{String(selected.numero).padStart(3, "0")}
            </h3>
            <p className="hc-nota mt-1">
              {new Date(selected.publicadoEm).toLocaleDateString("pt-BR")} ·{" "}
              {selected.totalAlteracoes} alterações · gerado por {selected.geradoPor}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(selected.texto);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1200);
              }}
              className="hc-pilula"
            >
              {copiado ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              Copiar
            </button>
            <button
              onClick={() => setSelected(null)}
              className="hc-pilula"
            >
              Voltar
            </button>
          </div>
        </div>
        <pre className="hc-dentro whitespace-pre-wrap p-4 font-sans text-sm text-foreground">
          {selected.texto}
        </pre>

        {/* Log de auditoria gerado no arquivamento */}
        {selected.logTexto && (
          <div className="hc-dentro">
            <button
              onClick={() => setLogAberto((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="size-4 text-muted-foreground" strokeWidth={1.8} />
                Log de arquivamento
              </span>
              <span className="flex items-center gap-2">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigator.clipboard.writeText(selected.logTexto);
                    setLogCopiado(true);
                    setTimeout(() => setLogCopiado(false), 1200);
                  }}
                  className="hc-selo hover:!text-foreground"
                >
                  {logCopiado ? "Copiado" : "Copiar log"}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {logAberto ? "Ocultar" : "Ver"}
                </span>
              </span>
            </button>
            {logAberto && (
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap border-t border-white/[0.06] p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
                {selected.logTexto}
              </pre>
            )}
          </div>
        )}

        <div>
          <h4 className="hc-sobre">
            Cards relacionados ({cardsVinculados.length})
          </h4>
          <div className="mt-2.5 space-y-1.5">
            {cardsVinculados.map((c) => (
              <div
                key={c.id}
                className="hc-dentro flex items-center justify-between gap-3 px-3.5 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">
                  <span className="text-muted-foreground">#{c.numero}</span> {c.titulo}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {c.concluidoPor && (
                    <span className="text-xs text-muted-foreground">{c.concluidoPor}</span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      CATEGORIA_STYLE[c.categoria]
                    )}
                  >
                    {c.categoria}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Devs envolvidos:{" "}
            {[...new Set(cardsVinculados.map((c) => c.concluidoPor).filter(Boolean))].join(", ") ||
              "—"}{" "}
            · Publicado em {fmtDataHora(selected.publicadoEm)}
          </p>
        </div>
      </div>
    );
  }

  if (patchNotes.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-white/[0.1] p-10 text-center text-sm text-muted-foreground">
        Nenhum Patch Note publicado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {patchNotes.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p)}
          className="hc-dentro flex w-full items-center gap-4 p-4 text-left"
        >
          <span className="hc-icone">
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Patch Notes #{String(p.numero).padStart(3, "0")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(p.publicadoEm).toLocaleDateString("pt-BR")} · {p.totalAlteracoes} alterações
              · por {p.geradoPor}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ArquivadosTab() {
  const [busca, setBusca] = useState("");
  const [fDev, setFDev] = useState("");
  const [fCategoria, setFCategoria] = useState<Categoria | "">("");
  const [fData, setFData] = useState("");
  const [selected, setSelected] = useState<KanbanCard | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["kanban-arquivados"],
    queryFn: () => fetchCards(true),
  });
  const { data: devs = [] } = useQuery({ queryKey: ["kanban-devs"], queryFn: fetchDevs });
  const { data: patchNotes = [] } = useQuery({
    queryKey: ["patch-notes"],
    queryFn: fetchPatchNotes,
  });
  const { data: username = "" } = useQuery({
    queryKey: ["my-username-kanban"],
    queryFn: getCurrentUsername,
    staleTime: 60_000,
  });

  const filtrados = useMemo(
    () =>
      cards.filter((c) => {
        if (fDev && c.responsavel !== fDev) return false;
        if (fCategoria && c.categoria !== fCategoria) return false;
        if (fData && !c.createdAt.startsWith(fData)) return false;
        if (busca) {
          const q = busca.toLowerCase();
          const pn = patchNotes.find((p) => p.id === c.patchnoteId);
          const alvo = [
            c.titulo,
            c.descricao,
            String(c.numero),
            c.patchTexto,
            c.obsDev,
            pn ? `patch notes #${pn.numero}` : "",
          ]
            .join(" ")
            .toLowerCase();
          if (!alvo.includes(q)) return false;
        }
        return true;
      }),
    [cards, fDev, fCategoria, fData, busca, patchNotes]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="campo-busca min-w-56 flex-1">
          <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Palavra-chave, ID, título, descrição..."
            aria-label="Buscar solicitação arquivada"
          />
        </label>
        <div className="min-w-36">
          <MinimalSelect
            value={fDev}
            onChange={setFDev}
            placeholder="Dev"
            options={[
              { value: "", label: "Dev (todos)" },
              ...devs.map((d) => ({ value: d.nome, label: d.nome })),
            ]}
          />
        </div>
        <div className="min-w-36">
          <MinimalSelect
            value={fCategoria}
            onChange={(v) => setFCategoria(v as Categoria | "")}
            placeholder="Categoria"
            options={[
              { value: "", label: "Categoria (todas)" },
              ...Object.entries(CATEGORIA_LABEL).map(([k, l]) => ({ value: k, label: l })),
            ]}
          />
        </div>
        <input
          type="date"
          value={fData}
          onChange={(e) => setFData(e.target.value)}
          className={inputCls}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando arquivo...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-white/[0.1] p-10 text-center text-sm text-muted-foreground">
          Nenhuma solicitação arquivada encontrada.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            {filtrados.length} resultado{filtrados.length !== 1 && "s"}
          </p>
          {filtrados.map((c) => {
            const pn = patchNotes.find((p) => p.id === c.patchnoteId);
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="hc-dentro flex w-full items-center gap-4 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{c.numero}</span>
                    <h3 className="text-sm font-semibold text-foreground">{c.titulo}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        CATEGORIA_STYLE[c.categoria]
                      )}
                    >
                      {CATEGORIA_LABEL[c.categoria]}
                    </span>
                    {pn && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Patch #{String(pn.numero).padStart(3, "0")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {c.descricao || "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {c.status} · por {c.criadoPor || "—"} · {fmtDataHora(c.createdAt)}
                    {c.responsavel && ` · dev: ${c.responsavel}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <KanbanCardModal
          card={cards.find((c) => c.id === selected.id) ?? selected}
          username={username || "desconhecido"}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
