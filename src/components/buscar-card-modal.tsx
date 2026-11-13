import { Archive, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCards, type KanbanCard } from "@/lib/kanban";
import { CATEGORIA_STYLE } from "@/components/kanban-card-modal";
import { cn } from "@/lib/utils";

export interface BuscarCardModalProps {
  onSelect: (card: KanbanCard) => void;
  onClose: () => void;
}

/**
 * Busca global de solicitações: pesquisa em TODOS os cards,
 * incluindo os arquivados, por título, descrição ou número.
 */
export function BuscarCardModal({ onSelect, onClose }: BuscarCardModalProps) {
  const [busca, setBusca] = useState("");

  const { data: ativos = [], isLoading: loadingAtivos } = useQuery({
    queryKey: ["kanban-cards"],
    queryFn: () => fetchCards(false),
  });
  const { data: arquivados = [], isLoading: loadingArquivados } = useQuery({
    queryKey: ["kanban-arquivados"],
    queryFn: () => fetchCards(true),
  });

  const isLoading = loadingAtivos || loadingArquivados;

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return [...ativos, ...arquivados]
      .filter((c) =>
        [c.titulo, c.descricao, String(c.numero), c.responsavel, c.criadoPor]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 30);
  }, [busca, ativos, arquivados]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24 backdrop-blur-sm">
      <div className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-[22px] glass-modal">
        <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
          <label className="campo-busca flex-1">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por palavra, título ou #número..."
              aria-label="Buscar solicitação"
            />
          </label>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </div>
          ) : !busca.trim() ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Digite para buscar em todas as solicitações — inclusive arquivadas.
            </p>
          ) : resultados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma solicitação encontrada para "{busca}".
            </p>
          ) : (
            <div className="space-y-1.5">
              {resultados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className="hc-dentro flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      <span className="mr-1.5 text-[10px] font-medium text-muted-foreground">
                        #{c.numero}
                      </span>
                      {c.titulo}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.criadoPor}
                      {c.responsavel ? ` → ${c.responsavel}` : ""}
                    </p>
                  </div>
                  {c.arquivado && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <Archive className="size-3" /> Arquivado
                    </span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      CATEGORIA_STYLE[c.categoria]
                    )}
                  >
                    {c.categoria}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
