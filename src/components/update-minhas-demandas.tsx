import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import type { ColumnId, DevTask } from "@/lib/dev-tasks";
import { parseEstrutura } from "@/lib/update-estrutura";
import { cn } from "@/lib/utils";

/** Cores completas por status, compartilhadas entre cards e demandas. */
export const STATUS_PILL: Record<ColumnId, { label: string; cls: string }> = {
  backlog: { label: "Planejado", cls: "bg-muted-foreground/20 text-foreground" },
  doing: { label: "Em andamento", cls: "bg-warning text-background" },
  review: { label: "Em teste", cls: "bg-info text-background" },
  done: { label: "Concluído", cls: "bg-success text-background" },
};

interface Demanda { id: string; projeto: DevTask; titulo: string; grupo: string; status: ColumnId }

export interface MinhasDemandasProps { projetos: DevTask[]; onOpen: (p: DevTask) => void }

/** Lista projetos e itens da estrutura cujo responsável é o usuário atual. */
export function MinhasDemandas({ projetos, onOpen }: MinhasDemandasProps) {
  const { data: username = "" } = useQuery({
    queryKey: ["notify-username"],
    staleTime: 300_000,
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) return "";
      const { data } = await supabase.from("profiles").select("username").eq("id", auth.user.id).maybeSingle();
      return (data?.username ?? "").toLowerCase();
    },
  });
  const ids = projetos.map((p) => p.id);
  const { data: estruturas = {} } = useQuery({
    queryKey: ["host-update", "estrutura-minhas", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("dev_tasks").select("id, estrutura").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.id, parseEstrutura(r.estrutura)]));
    },
  });

  const eu = (v: string) => !!username && v.trim().toLowerCase() === username;
  const demandas: Demanda[] = projetos.flatMap((p) => {
    const out: Demanda[] = [];
    if (eu(p.assignee)) out.push({ id: p.id, projeto: p, titulo: p.title, grupo: "Projeto", status: p.column });
    for (const g of estruturas[p.id] ?? []) for (const i of g.itens)
      if (i.responsaveis.some(eu)) out.push({ id: i.id, projeto: p, titulo: i.titulo, grupo: `${p.title} · ${g.titulo}`, status: i.status });
    return out;
  }).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const pendentes = demandas.filter((d) => d.status !== "done").length;

  return (
    <section className="glass hc p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="hc-icone">
          <ClipboardList className="size-4" strokeWidth={1.75} />
        </span>
        <h2 className="hc-titulo min-w-0 flex-1 truncate">Minhas demandas</h2>
        <span className="hc-selo tabular-nums">{pendentes}</span>
      </div>
      {demandas.length === 0 ? (
        <div className="hc-dentro flex flex-col items-center justify-center gap-2 px-4 py-6 text-center text-xs text-muted-foreground">
          <Inbox className="size-5 text-ink-3" strokeWidth={1.5} /> Nenhuma demanda direcionada a você
        </div>
      ) : (
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {demandas.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => onOpen(d.projeto)}
                className={cn("hc-dentro w-full px-3 py-2 text-left", d.status === "done" && "opacity-60")}>
                <div className="truncate text-[13px] font-semibold text-foreground">{d.titulo || "Sem título"}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-muted-foreground">{d.grupo}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_PILL[d.status].cls)}>{STATUS_PILL[d.status].label}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
