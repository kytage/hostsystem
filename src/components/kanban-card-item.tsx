import { memo, useCallback } from "react";
import { Car, CircleDot, Skull, Bug, Trash2, type LucideIcon } from "lucide-react";
import { CATEGORIA_LABEL, COL_TESTE, type Categoria, type KanbanCard } from "@/lib/kanban";
import { CATEGORIA_STYLE, PRIORIDADE_STYLE } from "@/components/kanban-card-modal";
import { cn } from "@/lib/utils";

export const CATEGORIA_ICON: Record<Categoria, LucideIcon> = {
  normal: CircleDot,
  ilegal: Skull,
  urgente: Bug,
  carro: Car,
};

export interface KanbanCardItemProps {
  card: KanbanCard;
  /** Card sendo arrastado neste momento (usado apenas para o estado visual). */
  dragging: boolean;
  onSelect: (card: KanbanCard) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

/**
 * Card individual do Kanban.
 * Memoizado: durante o drag apenas o card afetado re-renderiza, o que mantém
 * o arraste fluido mesmo com dezenas de cards no quadro.
 */
export const KanbanCardItem = memo(function KanbanCardItem({
  card,
  dragging,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
}: KanbanCardItemProps) {
  const Icon = CATEGORIA_ICON[card.categoria];

  const handleClick = useCallback(() => onSelect(card), [onSelect, card]);
  const handleDragStart = useCallback(() => onDragStart(card.id), [onDragStart, card.id]);
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(card.id);
    },
    [onDelete, card.id],
  );

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      style={{ contain: "layout paint" }}
      className={cn(
        "group cursor-grab rounded-xl glass p-3 transition-[border-color,opacity,transform] duration-150 hover:border-primary/30 active:cursor-grabbing",
        dragging && "scale-[0.98] opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              CATEGORIA_STYLE[card.categoria],
            )}
          >
            <Icon className="size-3" />
            {CATEGORIA_LABEL[card.categoria]}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
              PRIORIDADE_STYLE[card.prioridade],
            )}
          >
            {card.prioridade}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground/60">#{card.numero}</span>
          <button
            onClick={handleDelete}
            aria-label="Remover card"
            className="text-muted-foreground/0 transition-colors hover:text-destructive group-hover:text-muted-foreground"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">
        {card.titulo}
      </h3>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-muted-foreground/70">{card.criadoPor}</span>
        {card.responsavel && (
          <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-foreground">
            {card.responsavel}
          </span>
        )}
        {card.coluna === COL_TESTE && card.testeStatus && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              card.testeStatus === "Aprovado"
                ? "bg-success/15 text-success"
                : card.testeStatus === "Reprovado"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-warning/15 text-warning",
            )}
          >
            {card.testeStatus}
          </span>
        )}
      </div>
    </article>
  );
});
