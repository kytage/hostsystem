// Quadro de colunas com arrastar e soltar (funil de captação e esteira de conteúdo).
import { useState, type CSSProperties, type ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ArrowRightLeft } from "lucide-react";
import { MenuAcoes } from "./sobrepostos.tsx";
import { cn } from "./kit.tsx";

export interface ColunaDoQuadro {
  id: string;
  nome: string;
  cor?: string | undefined;
  dica?: string | undefined;
  /** coluna mais estreita e apagada (ex.: Pausada, Perdida) */
  discreta?: boolean;
}

interface Props<T extends { id: string }> {
  colunas: ColunaDoQuadro[];
  itens: T[];
  colunaDe: (item: T) => string;
  cartao: (item: T) => ReactNode;
  aoMover: (item: T, colunaId: string) => void;
  aoAbrir: (item: T) => void;
  vazio?: string;
}

function Coluna({ coluna, total, children }: { coluna: ColunaDoQuadro; total: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <section ref={setNodeRef} className={cn("quadro-coluna vidro", coluna.discreta && "opacity-80")} data-sobre={isOver} aria-label={coluna.nome}>
      <header className="quadro-coluna-topo" title={coluna.dica}>
        <i style={{ "--cor": coluna.cor } as CSSProperties} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{coluna.nome}</span>
        <span className="contador">{total}</span>
      </header>
      <div className="quadro-lista">{children}</div>
    </section>
  );
}

function Cartao<T extends { id: string }>({ item, colunas, colunaAtual, cartao, aoMover, aoAbrir }: { item: T; colunas: ColunaDoQuadro[]; colunaAtual: string; cartao: (i: T) => ReactNode; aoMover: (i: T, c: string) => void; aoAbrir: (i: T) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} className="quadro-cartao relative" data-arrastando={isDragging} {...attributes} {...listeners} role="button" tabIndex={0} onClick={() => aoAbrir(item)} onKeyDown={(e) => e.key === "Enter" && aoAbrir(item)}>
      {cartao(item)}
      {/* para quem não consegue arrastar (celular): mover pelo menu */}
      <div className="absolute right-1 top-1" onPointerDown={(e) => e.stopPropagation()}>
        <MenuAcoes
          rotulo="Mover para"
          gatilho={
            <button type="button" className="grid size-7 place-items-center rounded-lg text-tx-3 hover:bg-white/10 hover:text-white" aria-label="Mover para outra coluna" title="Mover para…" onClick={(e) => e.stopPropagation()}>
              <ArrowRightLeft size={13} />
            </button>
          }
          acoes={colunas.filter((c) => c.id !== colunaAtual).map((c) => ({ rotulo: c.nome, aoClicar: () => aoMover(item, c.id) }))}
        />
      </div>
    </div>
  );
}

export function Quadro<T extends { id: string }>({ colunas, itens, colunaDe, cartao, aoMover, aoAbrir, vazio = "Nada aqui" }: Props<T>) {
  const [arrastando, setArrastando] = useState<T | null>(null);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }));
  const comecar = (e: DragStartEvent) => setArrastando(itens.find((i) => i.id === e.active.id) ?? null);
  const soltar = (e: DragEndEvent) => {
    const item = itens.find((i) => i.id === e.active.id);
    setArrastando(null);
    if (!item || !e.over) return;
    const destino = String(e.over.id);
    if (destino !== colunaDe(item)) aoMover(item, destino);
  };
  return (
    <DndContext sensors={sensores} onDragStart={comecar} onDragEnd={soltar} onDragCancel={() => setArrastando(null)}>
      <div className="quadro">
        {colunas.map((col) => {
          const daColuna = itens.filter((i) => colunaDe(i) === col.id);
          return (
            <Coluna key={col.id} coluna={col} total={daColuna.length}>
              {daColuna.length === 0 ? <p className="px-1 py-3 text-center text-[12px] text-tx-3">{vazio}</p> : daColuna.map((i) => <Cartao key={i.id} item={i} colunas={colunas} colunaAtual={col.id} cartao={cartao} aoMover={aoMover} aoAbrir={aoAbrir} />)}
            </Coluna>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>{arrastando ? <div className="quadro-cartao quadro-cartao-solto">{cartao(arrastando)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
