import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ListChecks, BarChart3, Trophy, Activity, Clock, CalendarDays, PackageCheck, Loader2 } from "lucide-react";
import { Indice, Indices } from "@/components/indice";
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
      <div className="my-8 w-full max-w-3xl rounded-[22px] glass-modal">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <h2 className="hc-titulo">
              Status das pendências
            </h2>
            <p className="hc-nota mt-0.5">
              Acompanhe suas solicitações no desenvolvimento
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-4" />
          </button>
        </header>

        <nav className="border-b border-white/[0.06] px-5 py-3">
          <div className="segmentos" role="tablist" aria-label="Seções">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setTab(t.key)}
              >
                <t.icon className="size-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-5">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </p>
          )}

          {!loading && activeTab === "minhas" && (
            <div className="space-y-3">
              <div className="segmentos" role="group" aria-label="Filtrar por status">
                {FILTROS.map((f) => {
                  const count =
                    f.key === "todas"
                      ? minhas.length
                      : minhas.filter((c) => statusFiltro(c) === f.key).length;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={filtro === f.key}
                      onClick={() => setFiltro(f.key)}
                    >
                      {f.label}
                      <span className="tabular-nums opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {minhasFiltradas.length === 0 && (
                  <p className="rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
                    {minhas.length === 0
                      ? "Você ainda não criou nenhuma pendência."
                      : "Nenhuma pendência neste filtro."}
                  </p>
                )}
                {minhasFiltradas.map((c) => (
                  <article
                    key={c.id}
                    className="hc-dentro p-4"
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
                        <p className="mt-2 text-[11px] text-ink-3">
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
              <p className="hc-titulo">
                Entregas de {meuDev.nome}
              </p>
              {(() => {
                const s = devStats(todos, meuDev);
                return (
                  <Indices className="mt-3" colunas={3}>
                    <Indice valor={s.h24} titulo="Últimas 24h" icone={Clock} />
                    <Indice valor={s.d7} titulo="Últimos 7 dias" icone={CalendarDays} />
                    <Indice valor={s.total} titulo="Total" icone={PackageCheck} />
                  </Indices>
                );
              })()}
            </div>
          )}

          {!loading && activeTab === "analise" && (
            <div className="space-y-4">
              {devs.length === 0 && (
                <p className="rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
                  Nenhum dev cadastrado.
                </p>
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
                    className="hc-dentro p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.total} entregas no total
                      </p>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-foreground/85"
                        style={{ width: `${(s.total / max) * 100}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">24h</p>
                        <p className="font-semibold tabular-nums text-foreground">{s.h24}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">7 dias</p>
                        <p className="font-semibold tabular-nums text-foreground">{s.d7}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold tabular-nums text-foreground">{s.total}</p>
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
                <p className="rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
                  Sem solicitações ainda.
                </p>
              )}
              {ranking.map((r, i) => (
                <li
                  key={r.autor}
                  className={cn(
                    "hc-dentro flex items-center justify-between px-4 py-2.5",
                    r.autor.toLowerCase() === username.toLowerCase() &&
                      "!border-primary/50",
                  )}
                >
                  <span className="flex items-center gap-3 text-sm text-foreground">
                    <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      {i + 1}º
                    </span>
                    <span className="font-semibold">{r.autor}</span>
                  </span>
                  <span className="hc-selo tabular-nums">
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
