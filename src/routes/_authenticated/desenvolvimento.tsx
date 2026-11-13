import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  X,
  Loader2,
  Inbox,
  Code2,
  FlaskConical,
  CheckCircle2,
  Sparkles,
  Car,
  Skull,
  Bug,
  CircleDot,
  UserPlus,
  Trash2,
  Paperclip,
  Clock,
  FileText,
  MessageSquare,
  History,
  ListChecks,
  Search,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addDev,
  CardConflitoError,
  CATEGORIA_LABEL,
  COL_CONCLUIDO,
  COL_SOLICITACOES,
  COL_TESTE,
  createCard,
  deleteCard,
  devColuna,
  fetchCards,
  fetchDevs,
  fetchPatchNotes,
  fetchProfilesBasic,
  getCurrentUsername,
  moveCard,
  rowToCard,
  setDevUser,
  type Anexo,
  type Categoria,
  type ChecklistItem,
  type KanbanCard,
  type Prioridade,
} from "@/lib/kanban";
import { clipboardImageToDataUrl, nomeImagemColada } from "@/lib/clipboard-image";
import { KanbanCardModal } from "@/components/kanban-card-modal";
import { KanbanCardItem } from "@/components/kanban-card-item";

import { PatchNotePreview } from "@/components/patch-note-preview";
import { NovaSolicitacaoModal } from "@/components/desenvolvimento/nova-solicitacao";
import { HistoricoModal } from "@/components/historico-modal";
import { BuscarCardModal } from "@/components/buscar-card-modal";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { useRealtimeRowSync, useRealtimeTable } from "@/lib/realtime";
import type { Database } from "@/integrations/supabase/types";

type CardRow = Database["public"]["Tables"]["kanban_cards"]["Row"];
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/desenvolvimento")({
  head: () => ({
    meta: [
      { title: "Desenvolvimento — FiveM Host" },
      {
        name: "description",
        content: "Kanban de desenvolvimento: solicitações, devs, testes e Patch Notes.",
      },
      { property: "og:title", content: "Desenvolvimento — FiveM Host" },
      {
        property: "og:description",
        content: "Kanban de desenvolvimento: solicitações, devs, testes e Patch Notes.",
      },
    ],
  }),
  component: Desenvolvimento,
});

const CATEGORIA_ICON: Record<Categoria, LucideIcon> = {
  normal: CircleDot,
  ilegal: Skull,
  urgente: Bug,
  carro: Car,
};

const inputCls =
  "w-full rounded-xl border border-input bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

function Desenvolvimento() {
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const [selected, setSelected] = useState<KanbanCard | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | null>(null);
  const [novoDev, setNovoDev] = useState("");
  const [showNovoDev, setShowNovoDev] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showBusca, setShowBusca] = useState(false);

  // Patch incremental: o payload do evento é aplicado direto no cache, sem
  // refetch da lista — é o que garante que dois devs vejam o mesmo estado
  // do card praticamente no mesmo instante.
  useRealtimeRowSync<CardRow, KanbanCard>({
    table: "kanban_cards",
    queryKey: ["kanban-cards"],
    mapRow: rowToCard,
    belongs: (row) => row.arquivado === false,
    sort: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  });
  useRealtimeTable("kanban_devs", [["kanban-devs"]]);
  useRealtimeTable("patch_notes", [["patch-notes"]]);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["kanban-cards"],
    queryFn: () => fetchCards(false),
  });
  const { data: devs = [] } = useQuery({
    queryKey: ["kanban-devs"],
    queryFn: fetchDevs,
  });
  const { data: patchNotes = [] } = useQuery({
    queryKey: ["patch-notes"],
    queryFn: fetchPatchNotes,
  });
  const { data: username = "" } = useQuery({
    queryKey: ["my-username-kanban"],
    queryFn: getCurrentUsername,
    staleTime: 60_000,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["kanban-profiles-basic"],
    queryFn: fetchProfilesBasic,
    staleTime: 60_000,
  });

  const vincularDev = useMutation({
    mutationFn: ({ devId, userId }: { devId: string; userId: string | null }) =>
      setDevUser(devId, userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["kanban-devs"] }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });

  const moveMutation = useMutation({
    mutationFn: ({ card, para }: { card: KanbanCard; para: string }) =>
      moveCard(card, para, devs, username || "sistema"),
    onMutate: async ({ card, para }) => {
      await queryClient.cancelQueries({ queryKey: ["kanban-cards"] });
      const prev = queryClient.getQueryData<KanbanCard[]>(["kanban-cards"]);
      const agora = new Date().toISOString();
      queryClient.setQueryData<KanbanCard[]>(["kanban-cards"], (old) =>
        (old ?? []).map((t) =>
          t.id === card.id
            ? {
                ...t,
                coluna: para,
                // Atualiza a data de conclusão otimista para o card ir ao
                // topo da coluna Concluído imediatamente ao arrastar.
                concluidoAt: para === COL_CONCLUIDO ? agora : t.concluidoAt,
              }
            : t
        )
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["kanban-cards"], ctx.prev);
      const conflito = e instanceof CardConflitoError;
      toast[conflito ? "warning" : "error"](
        conflito ? "Card já movido" : "Não foi possível mover",
        { description: e instanceof Error ? e.message : "Tente novamente." }
      );
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: invalidate,
  });

  const addDevMutation = useMutation({
    mutationFn: addDev,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kanban-devs"] });
      setNovoDev("");
      setShowNovoDev(false);
    },
  });

  // ---- Handlers estáveis: evitam re-render de todos os cards a cada interação ----
  const handleSelect = useCallback((card: KanbanCard) => setSelected(card), []);
  const handleDelete = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);
  const handleDragStart = useCallback((id: string) => setDragId(id), []);
  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setOverColumn(null);
  }, []);

  // Filtro de categoria aplica-se aos cards visíveis
  const visiveis = useMemo(
    () => (filtroCategoria ? cards.filter((c) => c.categoria === filtroCategoria) : cards),
    [cards, filtroCategoria]
  );

  const aguardandoPatch = useMemo(
    () => cards.filter((c) => c.coluna === COL_CONCLUIDO && !c.patchnoteGerado),
    [cards]
  );

  const colunas = useMemo<
    {
      id: string;
      title: string;
      icon: LucideIcon;
      dot: string;
      owner?: string | undefined;
    }[]
  >(
    () => [
      { id: COL_SOLICITACOES, title: "Solicitações", icon: Inbox, dot: "bg-chart-2" },
      ...devs.map((d) => ({
        id: devColuna(d.slug),
        title: `DEV ${d.nome.toUpperCase()}`,
        icon: Code2,
        dot: "bg-primary",
        owner: d.userId
          ? (profiles.find((p) => p.id === d.userId)?.username ?? undefined)
          : undefined,
      })),
      { id: COL_TESTE, title: "Teste", icon: FlaskConical, dot: "bg-warning" },
      { id: COL_CONCLUIDO, title: "Concluído", icon: CheckCircle2, dot: "bg-success" },
    ],
    [devs, profiles]
  );

  /**
   * Agrupa os cards por coluna em uma única passagem (antes era um filter+sort
   * por coluna a cada render, O(colunas × cards)).
   */
  const itemsPorColuna = useMemo(() => {
    const mapa = new Map<string, KanbanCard[]>();
    for (const c of visiveis) {
      const lista = mapa.get(c.coluna);
      if (lista) lista.push(c);
      else mapa.set(c.coluna, [c]);
    }
    const concluidos = mapa.get(COL_CONCLUIDO);
    if (concluidos) {
      // Card mais recente no topo da coluna Concluído.
      concluidos.sort(
        (a, b) =>
          new Date(b.concluidoAt ?? b.createdAt).getTime() -
          new Date(a.concluidoAt ?? a.createdAt).getTime()
      );
    }
    return mapa;
  }, [visiveis]);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // ---- Dashboard stats ----
  const stats = useMemo(() => {
    const semanaAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const concluidosSemana = cards.filter(
      (c) => c.concluidoAt && new Date(c.concluidoAt).getTime() > semanaAtras
    ).length;
    const bugs = cards.filter((c) => c.categoria === "urgente").length;

    return [
      {
        label: "Aguardando dev",
        value: cards.filter((c) => c.coluna === COL_SOLICITACOES).length,
      },
      ...devs.map((d) => {
        // Contabiliza tudo que é do dev (na coluna dele OU já em teste/concluído sob
        // responsabilidade dele) — assim o número não "desaparece" ao arrastar o card.
        const total = cards.filter(
          (c) => c.coluna === devColuna(d.slug) || c.responsavel === d.nome
        ).length;
        return { label: `${d.nome} (total)`, value: total };
      }),
      { label: "Aguardando teste", value: cards.filter((c) => c.coluna === COL_TESTE).length },
      { label: "Aguardando Patch Note", value: aguardandoPatch.length },
      { label: "Bugs abertos", value: bugs },
      { label: "Concluídos na semana", value: concluidosSemana },
      { label: "Patch Notes", value: patchNotes.length },
    ];
  }, [cards, devs, aguardandoPatch.length, patchNotes.length]);


  return (
    <div className="flex h-full min-w-0 flex-col px-3 py-3 md:px-4">
      <PageHeader
        title="Desenvolvimento"
        subtitle="Solicitações → Dev → Teste → Concluído — sincronizado em tempo real"
        actions={
          <>
            <button
              onClick={() => setShowBusca(true)}
              title="Buscar solicitação (inclusive arquivadas)"
              aria-label="Buscar solicitação"
              className="flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
            <button
              onClick={() => setShowHistorico(true)}
              title="Histórico — Patch Notes e arquivados"
              aria-label="Histórico — Patch Notes e arquivados"
              className="flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <Clock className="size-4" />
            </button>

            <button
              onClick={() => setShowNovoDev(true)}
              className="flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
            >
              <UserPlus className="size-4" /> Novo dev
            </button>
            <button
              onClick={() => setShowPatch(true)}
              disabled={aguardandoPatch.length === 0}
              className="flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-3.5 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              <Sparkles className="size-4" /> Patch Notes ({aguardandoPatch.length})
            </button>
          </>
        }
      />

      {/* Filtro (esquerda) + stats — sem barra de arrastar */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Filtro por categoria — à esquerda */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFiltroCategoria(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              filtroCategoria === null
                ? "border-white/15 bg-white/[0.09] text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Todas
          </button>
          {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((cat) => {
            const Icon = CATEGORIA_ICON[cat];
            return (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(filtroCategoria === cat ? null : cat)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  filtroCategoria === cat
                    ? "border-white/15 bg-white/[0.09] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3" /> {CATEGORIA_LABEL[cat]}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex shrink-0 items-center gap-2 rounded-lg glass px-2.5 py-1.5"
            >
              <span className="text-lg font-semibold leading-none text-foreground font-display">{s.value}</span>
              <span className="text-[10px] font-medium leading-tight text-muted-foreground">
                {s.label}
              </span>
            </div>
          ))}
        </div>

      </div>




      {isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando quadro...
        </div>
      ) : (
        <div className="mt-3 min-h-0 flex-1 overflow-x-auto pb-2 scrollbar-thin">
          <div className="flex h-full min-w-full gap-3">
            {colunas.map((col) => {
              const items = itemsPorColuna.get(col.id) ?? [];

              const isConcluido = col.id === COL_CONCLUIDO;
              return (
                <section
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overColumn !== col.id) setOverColumn(col.id);
                  }}
                  onDragLeave={() => setOverColumn((c) => (c === col.id ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const card = dragId ? cardsById.get(dragId) : undefined;
                    if (card) moveMutation.mutate({ card, para: col.id });
                    setDragId(null);
                    setOverColumn(null);
                  }}
                  className={cn(
                    "flex h-full min-w-[260px] flex-1 flex-col rounded-2xl border transition-colors",
                    isConcluido
                      ? "border-success/30 bg-success/10"
                      : overColumn === col.id
                        ? "border-primary/50 bg-accent/40"
                        : "border-border bg-card/50"
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                        {col.id.startsWith("dev_") && (
                          <span className="shrink-0 rounded-full bg-info/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-info">
                            Em andamento
                          </span>
                        )}
                        <span className={cn("size-2 shrink-0 rounded-full", col.dot)} />
                        <span className="truncate">{col.title}</span>
                      </h2>
                      {col.owner && (
                        <p className="mt-0.5 truncate pl-4 text-[10px] text-muted-foreground">
                          @{col.owner}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {items.length}
                    </span>
                  </div>

                  {col.id === COL_SOLICITACOES && (
                    <button
                      onClick={() => setShowNew(true)}
                      className="mx-2.5 mt-2.5 flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Plus className="size-4" /> Nova solicitação
                    </button>
                  )}

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 scrollbar-thin">
                    {items.map((t) => (
                      <KanbanCardItem
                        key={t.id}
                        card={t}
                        dragging={dragId === t.id}
                        onSelect={handleSelect}
                        onDelete={handleDelete}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))}

                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Solte cards aqui
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal nova solicitação */}
      {showNew && (
        <NovaSolicitacaoModal criadoPor={username} onClose={() => setShowNew(false)} />
      )}

      {/* Modal devs — adicionar e vincular a usuários reais */}
      {showNovoDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl glass p-6">
            <h2 className="text-lg font-semibold text-foreground font-display">Desenvolvedores</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Vincule cada coluna ao usuário real do sistema — assim o card do dev pertence de
              fato à conta dele.
            </p>

            <div className="mt-4 space-y-2">
              {devs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2.5"
                >
                  <span className="min-w-20 flex-1 truncate text-sm font-semibold text-foreground">
                    {d.nome}
                  </span>
                  <div className="w-56 shrink-0">
                    <MinimalSelect
                      value={d.userId ?? ""}
                      onChange={(v) =>
                        vincularDev.mutate({ devId: d.id, userId: v === "" ? null : v })
                      }
                      placeholder="Vincular usuário"
                      options={[
                        { value: "", label: "Sem vínculo" },
                        ...profiles.map((p) => ({ value: p.id, label: p.username })),
                      ]}
                    />
                  </div>
                </div>
              ))}
              {devs.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhum dev cadastrado
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2 border-t border-border pt-4">
              <input
                value={novoDev}
                onChange={(e) => setNovoDev(e.target.value)}
                placeholder="Nome do novo dev"
                className={inputCls}
              />
              <button
                onClick={() => novoDev.trim() && addDevMutation.mutate(novoDev)}
                disabled={addDevMutation.isPending || !novoDev.trim()}
                className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {addDevMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Adicionar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal do card */}
      {selected && (
        <KanbanCardModal
          card={cards.find((c) => c.id === selected.id) ?? selected}
          username={username || "desconhecido"}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Preview Patch Notes */}
      {showPatch && (
        <PatchNotePreview
          cards={aguardandoPatch}
          username={username || "desconhecido"}
          onClose={() => setShowPatch(false)}
          onConfirmado={() => setShowPatch(false)}
        />
      )}

      {/* Busca global de solicitações (inclusive arquivadas) */}
      {showBusca && (
        <BuscarCardModal
          onClose={() => setShowBusca(false)}
          onSelect={(card) => {
            setShowBusca(false);
            setSelected(card);
          }}
        />
      )}

      {/* Histórico: Patch Notes publicados + solicitações arquivadas */}
      {showHistorico && <HistoricoModal onClose={() => setShowHistorico(false)} />}
    </div>
  );
}
