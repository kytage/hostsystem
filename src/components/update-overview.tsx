import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ColumnId, DevTask } from "@/lib/dev-tasks";
import { parseEstrutura } from "@/lib/update-estrutura";
import { cn } from "@/lib/utils";

const STATUS: { id: ColumnId; label: string; dot: string; bar: string }[] = [
  { id: "backlog", label: "Planejado", dot: "bg-muted-foreground", bar: "bg-muted-foreground/70" },
  { id: "doing", label: "Andamento", dot: "bg-warning", bar: "bg-warning" },
  { id: "review", label: "Teste", dot: "bg-info", bar: "bg-info" },
  { id: "done", label: "Concluído", dot: "bg-success", bar: "bg-success" },
];

export interface UpdateOverviewProps { projetos: DevTask[] }

/** Painel compacto com progresso geral, distribuição por status e itens da estrutura. */
export function UpdateOverview({ projetos }: UpdateOverviewProps) {
  const ids = projetos.map((p) => p.id);
  const { data: itens = [] } = useQuery({
    queryKey: ["host-update", "estrutura-resumo", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("dev_tasks").select("estrutura").in("id", ids);
      if (error) throw error;
      return (data ?? []).flatMap((r) => parseEstrutura(r.estrutura).flatMap((g) => g.itens));
    },
  });

  const total = projetos.length;
  const counts = STATUS.map((s) => ({ ...s, n: projetos.filter((p) => p.column === s.id).length }));
  const itensFeitos = itens.filter((i) => i.status === "done").length;
  const itensAndamento = itens.filter((i) => i.status === "doing" || i.status === "review").length;
  // Progresso ponderado: concluído = 1, teste = 0.75, andamento = 0.4.
  const peso: Record<ColumnId, number> = { backlog: 0, doing: 0.4, review: 0.75, done: 1 };
  const base = itens.length ? itens.map((i) => peso[i.status]) : projetos.map((p) => peso[p.column]);
  const pct = base.length ? Math.round((base.reduce((a, b) => a + b, 0) / base.length) * 100) : 0;
  const r = 26, c = 2 * Math.PI * r;

  return (
    <div className="glass hc flex w-full flex-wrap items-center gap-5 p-5 lg:w-auto">
      <div className="relative size-16 shrink-0" title="Progresso ponderado da atualização">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
          <circle cx="32" cy="32" r={r} className="fill-none stroke-secondary" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} className="fill-none stroke-primary transition-all" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
      </div>

      <div className="min-w-[260px] flex-1">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
          {counts.map((s) => s.n > 0 && (
            <div key={s.id} className={cn("h-full", s.bar)} style={{ width: `${(s.n / Math.max(1, total)) * 100}%` }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {counts.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 whitespace-nowrap leading-tight">
              <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{s.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-l border-white/[0.06] pl-4 leading-tight">
        <div className="hc-sobre">Itens entregues</div>
        <div className="mt-1 font-display text-base font-semibold tabular-nums text-foreground">{itensFeitos}<span className="text-muted-foreground">/{itens.length}</span></div>
        <div className="text-[11px] text-warning">{itensAndamento} em execução</div>
      </div>
    </div>
  );
}
