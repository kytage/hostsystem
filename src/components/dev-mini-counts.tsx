import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Inbox, Code2, CheckCircle2, type LucideIcon } from "lucide-react";
import {
  COL_CONCLUIDO,
  COL_SOLICITACOES,
  devColuna,
  fetchCards,
  fetchDevs,
} from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";

interface MiniCount {
  icon: LucideIcon;
  value: number;
  dot: string;
}

/**
 * Três mini contadores do Kanban de Desenvolvimento:
 * amarelo = solicitações pendentes, azul = Brenno + Miguel, verde = concluídos hoje.
 * Renderizados apenas como ícone + quantidade, para a sidebar.
 */
export function DevMiniCounts({ className }: { className?: string }) {
  useRealtimeTable("kanban_cards", [["kanban-cards"], ["dev-mini-counts"]]);

  const { data: cards = [] } = useQuery({
    queryKey: ["dev-mini-counts"],
    queryFn: () => fetchCards(false),
    staleTime: 30_000,
  });
  const { data: devs = [] } = useQuery({
    queryKey: ["kanban-devs-mini"],
    queryFn: fetchDevs,
    staleTime: 60_000,
  });

  const items = useMemo<MiniCount[]>(() => {
    const pendentes = cards.filter((c) => c.coluna === COL_SOLICITACOES).length;
    const brennoMiguel = devs
      .filter((d) => /brenno|miguel/i.test(d.nome))
      .reduce(
        (acc, d) =>
          acc +
          cards.filter((c) => c.coluna === devColuna(d.slug) || c.responsavel === d.nome).length,
        0,
      );
    const agora = new Date();
    const concluidosHoje = cards.filter((c) => {
      if (!c.concluidoAt) return false;
      const d = new Date(c.concluidoAt);
      return (
        d.getFullYear() === agora.getFullYear() &&
        d.getMonth() === agora.getMonth() &&
        d.getDate() === agora.getDate()
      );
    }).length;

    return [
      { icon: Inbox, value: pendentes, dot: "text-warning" },
      { icon: Code2, value: brennoMiguel, dot: "text-info" },
      { icon: CheckCircle2, value: concluidosHoje, dot: "text-success" },
    ];
  }, [cards, devs]);


  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <span
            key={i}
            className="flex items-center gap-0.5 rounded-md bg-white/5 px-1 py-0.5 text-[10px] font-semibold leading-none"
          >
            <Icon className={cn("size-3", it.dot)} strokeWidth={2.4} />
            <span className="text-foreground/80">{it.value}</span>
          </span>
        );
      })}
    </span>
  );
}
