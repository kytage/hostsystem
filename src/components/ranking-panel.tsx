import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal } from "lucide-react";
import { fetchCards, getCurrentUsername } from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Painel fixo de ranking: usuários que mais criaram solicitações no
 * desenvolvimento (cards ativos + arquivados). Visível para todos os cargos.
 */
export function RankingPanel({ variant = "vertical" }: { variant?: "vertical" | "horizontal" | "premium" }) {
  useRealtimeTable("kanban_cards", [
    ["kanban-cards"],
    ["kanban-cards-arquivados"],
  ]);

  const { data: username = "" } = useQuery({
    queryKey: ["current-username"],
    queryFn: getCurrentUsername,
    staleTime: 300_000,
  });
  const { data: ativos = [] } = useQuery({
    queryKey: ["kanban-cards"],
    queryFn: () => fetchCards(false),
    staleTime: 20_000,
  });
  const { data: arquivados = [] } = useQuery({
    queryKey: ["kanban-cards-arquivados"],
    queryFn: () => fetchCards(true),
    staleTime: 60_000,
  });
  // Contagem preservada de solicitações antigas já removidas do banco.
  const { data: base = [] } = useQuery({
    queryKey: ["kanban-ranking-base"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_ranking_base").select("autor, total");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of base) map.set(b.autor, b.total);
    for (const c of [...ativos, ...arquivados]) {
      const autor = c.criadoPor?.trim() || "—";
      map.set(autor, (map.get(autor) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([autor, total]) => ({ autor, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [ativos, arquivados]);

  const max = ranking[0]?.total ?? 1;

  if (variant === "premium") {
    const top = ranking.slice(0, 5);
    const leader = top[0];
    return (
      <section className="glass surface-hover flex h-full flex-col rounded-[24px] p-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Ranking</p>
            <h2 className="mt-1 font-display text-lg font-semibold">Solicitações</h2>
          </div>
          <span className="glass-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground">
            <Trophy className="size-3" strokeWidth={1.8} /> Top 5
          </span>
        </header>

        {!leader ? (
          <div className="glass-inset mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-4 py-8 text-center">
            <Trophy className="size-5 text-ink-3" strokeWidth={1.5} />
            <p className="text-[13px] text-muted-foreground">Sem solicitações ainda.</p>
            <p className="text-xs text-ink-3">O ranking aparece conforme a equipe abre pedidos no quadro.</p>
          </div>
        ) : (
          <>
            <div className="glass-inset mt-4 flex items-end justify-between rounded-2xl p-4">
              <div className="min-w-0">
                <p className="text-[11px] text-ink-3">1º lugar</p>
                <p className="mt-0.5 truncate text-base font-semibold">{leader.autor}</p>
              </div>
              <p className="font-display text-4xl font-semibold tracking-[-0.04em] tabular-nums">{leader.total}</p>
            </div>
            <ol className="mt-3 flex flex-1 flex-col gap-1">
              {top.map((r, i) => {
                const isMe = r.autor.toLowerCase() === username.toLowerCase();
                return (
                  <li
                    key={r.autor}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-white/[0.03]",
                      isMe && "bg-white/[0.04]",
                    )}
                  >
                    {isMe && <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary" />}
                    <span className="w-5 text-center text-xs tabular-nums text-ink-3">{i + 1}</span>
                    <span className="grid size-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.04] text-xs font-semibold uppercase">
                      {r.autor[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium">
                        {r.autor}
                        {isMe && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-primary">
                            você
                          </span>
                        )}
                      </p>
                      <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.06]">
                        <div
                          className={cn("h-full rounded-full", i === 0 ? "bg-foreground/80" : isMe ? "bg-primary" : "bg-white/25")}
                          style={{ width: `${(r.total / max) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-9 text-right text-[13px] font-semibold tabular-nums">{r.total}</span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    );
  }

  if (variant === "horizontal") {
    const top = ranking.slice(0, 5);
    return (
      <aside className="rounded-2xl glass p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Trophy className="size-3.5 text-warning" strokeWidth={1.8} />
            Ranking de solicitações
          </h2>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top 5
          </span>
        </div>
        {top.length === 0 && (
          <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
            Sem solicitações ainda.
          </p>
        )}
        <ol className="mt-3 flex flex-nowrap items-stretch gap-2 overflow-hidden">
          {top.map((r, i) => {
            const isMe = r.autor.toLowerCase() === username.toLowerCase();
            return (
              <li
                key={r.autor}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                  isMe
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-white/[0.035]",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    i === 0 && "bg-warning/15 text-warning",
                    i === 1 && "bg-muted text-muted-foreground",
                    i === 2 && "bg-warning/10 text-warning/70",
                    i > 2 && "text-muted-foreground/70",
                  )}
                >
                  {i < 3 ? <Medal className="size-3" /> : `${i + 1}º`}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-xs font-semibold",
                      isMe ? "text-primary" : "text-foreground",
                    )}
                  >
                    {r.autor}
                    {isMe && (
                      <span className="ml-1 text-[8px] font-semibold uppercase tracking-wide text-primary/70">
                        você
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        i === 0 ? "bg-warning" : "bg-primary/60",
                      )}
                      style={{ width: `${(r.total / max) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-foreground">
                  {r.total}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Trophy className="size-4 text-warning" strokeWidth={1.8} />
          Ranking de solicitações
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Top 10
        </span>
      </div>

      <ol className="mt-4 space-y-1.5">
        {ranking.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Sem solicitações ainda.
          </p>
        )}
        {ranking.map((r, i) => {
          const isMe = r.autor.toLowerCase() === username.toLowerCase();
          return (
            <li
              key={r.autor}
              className={cn(
                "group rounded-xl border border-transparent px-2.5 py-2 transition-colors",
                isMe
                  ? "border-primary/40 bg-primary/5"
                  : "hover:bg-secondary/40",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    i === 0 && "bg-warning/15 text-warning",
                    i === 1 && "bg-muted text-muted-foreground",
                    i === 2 && "bg-warning/10 text-warning/70",
                    i > 2 && "text-muted-foreground/70",
                  )}
                >
                  {i < 3 ? <Medal className="size-3.5" /> : `${i + 1}º`}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm font-semibold",
                    isMe ? "text-primary" : "text-foreground",
                  )}
                >
                  {r.autor}
                  {isMe && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary/70">
                      você
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-semibold text-foreground">
                  {r.total}
                </span>
              </div>
              <div className="mt-1.5 ml-[34px] h-1 overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    i === 0 ? "bg-warning" : "bg-primary/60",
                  )}
                  style={{ width: `${(r.total / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
