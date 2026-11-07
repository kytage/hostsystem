import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ListChecks, BarChart3, Trophy, Activity } from "lucide-react";
import {
  COL_CONCLUIDO,
  COL_SOLICITACOES,
  COL_TESTE,
  fetchCards,
  fetchDevs,
  getCurrentUsername,
  fmtDataHora,
  type KanbanCard,
  type KanbanDev,
} from "@/lib/kanban";
import { ROLE_ORDER, useMyRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type TabKey = "minhas" | "meus-feitos" | "analise" | "ranking";
type FiltroStatus =
  | "todas"
  | "aguardando"
  | "desenvolvimento"
  | "teste"
  | "concluido"
  | "arquivado";

const FILTROS: { key: FiltroStatus; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "aguardando", label: "Aguardando dev" },
  { key: "desenvolvimento", label: "Em desenvolvimento" },
  { key: "teste", label: "Em teste" },
  { key: "concluido", label: "Concluído" },
  { key: "arquivado", label: "Arquivado" },
];

const H24 = 24 * 60 * 60 * 1000;
const D7 = 7 * H24;

/** Rótulo humano da coluna atual do card. */
function colunaLabel(card: KanbanCard, devs: KanbanDev[]): string {
  if (card.coluna === COL_SOLICITACOES) return "Aguardando aprovação/dev";
  if (card.coluna === COL_TESTE) return "Em teste";
  if (card.coluna === COL_CONCLUIDO) return "Concluído";
  const dev = devs.find((d) => `dev_${d.slug}` === card.coluna);
  return dev ? `Em desenvolvimento · ${dev.nome}` : card.status;
}

function colunaTone(card: KanbanCard): string {
  if (card.coluna === COL_SOLICITACOES) return "bg-warning/15 text-warning";
  if (card.coluna === COL_TESTE) return "bg-info/15 text-info";
  if (card.coluna === COL_CONCLUIDO) return "bg-success/15 text-success";
  return "bg-info/15 text-info";
}

/** Classifica o card em uma das categorias de filtro. */
function statusFiltro(card: KanbanCard): FiltroStatus {
  if (card.arquivado) return "arquivado";
  if (card.coluna === COL_SOLICITACOES) return "aguardando";
  if (card.coluna === COL_TESTE) return "teste";
  if (card.coluna === COL_CONCLUIDO) return "concluido";
  return "desenvolvimento";
}

/** Contagem de entregas de um dev em janelas de tempo. */
function devStats(cards: KanbanCard[], dev: KanbanDev) {
  const meus = cards.filter(
    (c) =>
      c.concluidoAt &&
      (c.responsavel === dev.nome ||
        c.concluidoPor?.toLowerCase() === dev.nome.toLowerCase()),
  );
  const agora = Date.now();
  const dentro = (ms: number) =>
    meus.filter((c) => agora - new Date(c.concluidoAt!).getTime() <= ms).length;
  return { h24: dentro(H24), d7: dentro(D7), total: meus.length };
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl glass-inset p-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground font-display">{value}</p>
    </div>
  );
}

/**
 * Modal "Status das pendências": pendências criadas pelo usuário logado,
 * histórico de entregas para devs, análise comparativa (Direção+) e ranking
 * público de quem mais abre solicitações.
 */
export function MinhasPendenciasModal({ onClose }: { onClose: () => void }) {
  const { data: myRole } = useMyRole();
  const isDirecaoPlus =
    ROLE_ORDER.indexOf(myRole ?? "dev") <= ROLE_ORDER.indexOf("direcao");

  const { data: username = "" } = useQuery({
    queryKey: ["current-username"],
    queryFn: getCurrentUsername,
    staleTime: 300_000,
  });
  const { data: devs = [] } = useQuery({
    queryKey: ["kanban-devs"],
    queryFn: fetchDevs,
    staleTime: 60_000,
  });
  const { data: ativos = [], isLoading: l1 } = useQuery({
    queryKey: ["kanban-cards"],
    queryFn: () => fetchCards(false),
    staleTime: 20_000,
  });
  const { data: arquivados = [], isLoading: l2 } = useQuery({
    queryKey: ["kanban-cards-arquivados"],
    queryFn: () => fetchCards(true),
    staleTime: 60_000,
  });

  const todos = useMemo(() => [...ativos, ...arquivados], [ativos, arquivados]);

  const [filtro, setFiltro] = useState<FiltroStatus>("todas");

  const minhas = useMemo(() => {
    const u = username.toLowerCase();
    return todos
      .filter((c) => c.criadoPor?.toLowerCase() === u)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [todos, username]);

  const minhasFiltradas = useMemo(() => {
    if (filtro === "todas") return minhas;
    return minhas.filter((c) => statusFiltro(c) === filtro);
  }, [minhas, filtro]);

  const meuDev = useMemo(
    () => devs.find((d) => d.nome.toLowerCase() === username.toLowerCase()),
    [devs, username],
  );

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of todos) {
      const autor = c.criadoPor?.trim() || "—";
      map.set(autor, (map.get(autor) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([autor, total]) => ({ autor, total }))
      .sort((a, b) => b.total - a.total);
  }, [todos]);

  const tabs = useMemo(() => {
    const t: { key: TabKey; label: string; icon: typeof ListChecks }[] = [
      { key: "minhas", label: "Minhas pendências", icon: ListChecks },
    ];
    if (meuDev) t.push({ key: "meus-feitos", label: "Meus feitos", icon: Activity });
    if (isDirecaoPlus)
      t.push({ key: "analise", label: "Análise devs", icon: BarChart3 });
    t.push({ key: "ranking", label: "Ranking", icon: Trophy });
    return t;
  }, [meuDev, isDirecaoPlus]);

  const [tab, setTab] = useState<TabKey>("minhas");
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "minhas";

  const loading = l1 || l2;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-2xl glass-modal">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Status das pendências
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe suas solicitações no desenvolvimento
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <nav className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                activeTab === t.key
                  ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                  : "border border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="p-5">
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          )}

          {!loading && activeTab === "minhas" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTROS.map((f) => {
                  const count =
                    f.key === "todas"
                      ? minhas.length
                      : minhas.filter((c) => statusFiltro(c) === f.key).length;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFiltro(f.key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        filtro === f.key
                          ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                          : "border border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {f.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px]",
                          filtro === f.key
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-white/[0.05] text-muted-foreground",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {minhasFiltradas.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {minhas.length === 0
                      ? "Você ainda não criou nenhuma pendência."
                      : "Nenhuma pendência neste filtro."}
                  </p>
                )}
                {minhasFiltradas.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-xl glass-inset p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          #{c.numero} · {c.titulo}
                        </p>
                        {c.descricao && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {c.descricao}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground/70">
                          Criada em {fmtDataHora(c.createdAt)}
                          {c.concluidoAt && ` · Concluída em ${fmtDataHora(c.concluidoAt)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            colunaTone(c),
                          )}
                        >
                          {colunaLabel(c, devs)}
                        </span>
                        {c.arquivado && (
                          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-success">
                            Já postada em patch notes
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {!loading && activeTab === "meus-feitos" && meuDev && (
            <div>
              <p className="text-sm font-semibold text-foreground">
                Entregas de {meuDev.nome}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {(() => {
                  const s = devStats(todos, meuDev);
                  return (
                    <>
                      <StatBox label="Últimas 24h" value={s.h24} />
                      <StatBox label="Últimos 7 dias" value={s.d7} />
                      <StatBox label="Total" value={s.total} />
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {!loading && activeTab === "analise" && (
            <div className="space-y-4">
              {devs.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum dev cadastrado.</p>
              )}
              {devs.map((d) => {
                const s = devStats(todos, d);
                const max = Math.max(
                  1,
                  ...devs.map((x) => devStats(todos, x).total),
                );
                return (
                  <div
                    key={d.id}
                    className="rounded-xl glass-inset p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.total} entregas no total
                      </p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(s.total / max) * 100}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">24h</p>
                        <p className="font-semibold text-foreground">{s.h24}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">7 dias</p>
                        <p className="font-semibold text-foreground">{s.d7}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold text-foreground">{s.total}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && activeTab === "ranking" && (
            <ol className="space-y-2">
              {ranking.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem solicitações ainda.</p>
              )}
              {ranking.map((r, i) => (
                <li
                  key={r.autor}
                  className={cn(
                    "flex items-center justify-between rounded-xl glass-inset px-4 py-2.5",
                    r.autor.toLowerCase() === username.toLowerCase() &&
                      "border-primary/50",
                  )}
                >
                  <span className="flex items-center gap-3 text-sm text-foreground">
                    <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                      {i + 1}º
                    </span>
                    <span className="font-semibold">{r.autor}</span>
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    {r.total} solicitaç{r.total === 1 ? "ão" : "ões"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
