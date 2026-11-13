import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Loader2,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmarPatchNote, type KanbanCard } from "@/lib/kanban";
import { gerarPatchNoteIA } from "@/lib/kanban.functions";

interface Item {
  cardId: string;
  texto: string;
}
interface Categoria {
  nome: string;
  itens: Item[];
}

function montarTexto(data: string, categorias: Categoria[]): string {
  const blocos = categorias
    .filter((c) => c.itens.length > 0)
    .map((c) => `${c.nome}\n${c.itens.map((i) => `• ${i.texto}`).join("\n")}`);
  return `PATCH NOTES — ${data}\n\n${blocos.join("\n\n")}`;
}

interface Props {
  cards: KanbanCard[];
  username: string;
  onClose: () => void;
  onConfirmado: () => void;
}

export function PatchNotePreview({ cards, username, onClose, onConfirmado }: Props) {
  const queryClient = useQueryClient();
  const gerarIA = useServerFn(gerarPatchNoteIA);
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const dataHoje = new Date().toLocaleDateString("pt-BR");

  useEffect(() => {
    let ativo = true;
    gerarIA({
      data: {
        cards: cards.map((c) => ({
          id: c.id,
          numero: c.numero,
          titulo: c.titulo,
          descricao: c.descricao,
          categoria: c.categoria,
          patchTexto: c.patchTexto,
        })),
      },
    })
      .then((res) => {
        if (ativo) setCategorias(res.categorias);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao gerar com IA.");
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const texto = useMemo(
    () => (categorias ? montarTexto(dataHoje, categorias) : ""),
    [categorias, dataHoje]
  );

  const totalItens = categorias?.reduce((acc, c) => acc + c.itens.length, 0) ?? 0;

  const confirmar = useMutation({
    mutationFn: () => {
      if (!categorias) throw new Error("Sem conteúdo.");
      const ids = categorias.flatMap((c) => c.itens.map((i) => i.cardId));
      // Arquiva TODOS os cards concluídos (não só os itens do patch note)
      return confirmarPatchNote({
        texto,
        cardIds: ids,
        todosCards: cards,
        geradoPor: username,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["kanban-arquivados"] });
      void queryClient.invalidateQueries({ queryKey: ["patch-notes"] });

      onConfirmado();
    },
  });

  const editarItem = (ci: number, ii: number, textoNovo: string) =>
    setCategorias((prev) =>
      prev?.map((c, i) =>
        i === ci
          ? { ...c, itens: c.itens.map((it, j) => (j === ii ? { ...it, texto: textoNovo } : it)) }
          : c
      ) ?? prev
    );

  const removerItem = (ci: number, ii: number) =>
    setCategorias((prev) =>
      prev
        ?.map((c, i) =>
          i === ci ? { ...c, itens: c.itens.filter((_, j) => j !== ii) } : c
        )
        .filter((c) => c.itens.length > 0) ?? prev
    );

  const moverItem = (ci: number, ii: number, dir: -1 | 1) =>
    setCategorias((prev) => {
      if (!prev) return prev;
      const alvo = ci + dir;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const copia = prev.map((c) => ({ ...c, itens: [...c.itens] }));
      const [item] = copia[ci]!.itens.splice(ii, 1);
      if (!item) return prev;
      copia[alvo]!.itens.push(item);
      return copia;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] glass-modal">
        <div className="flex items-center gap-3 border-b border-white/[0.06] p-5">
          <span className="hc-icone">
            <Sparkles className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="hc-titulo">Preview — Patch Notes</h2>
            <p className="hc-nota mt-1">
              Data: {dataHoje} · {totalItens} alterações · {categorias?.length ?? 0} categorias
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="hc-seta">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!categorias && !erro && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              A IA está organizando as {cards.length} alterações em categorias...
            </div>
          )}
          {erro && (
            <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {erro}
            </div>
          )}
          {categorias && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Editor estruturado */}
              <div className="space-y-4">
                {categorias.map((cat, ci) => (
                  <div key={ci} className="hc-dentro p-3.5">
                    <input
                      value={cat.nome}
                      onChange={(e) =>
                        setCategorias((prev) =>
                          prev?.map((c, i) =>
                            i === ci ? { ...c, nome: e.target.value } : c
                          ) ?? prev
                        )
                      }
                      className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                    <div className="mt-2 space-y-1.5">
                      {cat.itens.map((item, ii) => (
                        <div key={item.cardId} className="group flex items-center gap-1.5">
                          <input
                            value={item.texto}
                            onChange={(e) => editarItem(ci, ii, e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-transparent bg-black/25 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
                          />
                          <button
                            onClick={() => moverItem(ci, ii, -1)}
                            aria-label="Mover para categoria acima"
                            className="text-muted-foreground/0 hover:text-foreground group-hover:text-muted-foreground"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            onClick={() => moverItem(ci, ii, 1)}
                            aria-label="Mover para categoria abaixo"
                            className="text-muted-foreground/0 hover:text-foreground group-hover:text-muted-foreground"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            onClick={() => removerItem(ci, ii)}
                            aria-label="Remover item"
                            className="text-muted-foreground/0 hover:text-destructive group-hover:text-muted-foreground"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Texto final */}
              <div className="lg:sticky lg:top-0 lg:self-start">
                <div className="flex items-center justify-between">
                  <p className="hc-sobre">Texto final</p>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(texto);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 1200);
                    }}
                    className="hc-pilula"
                  >
                    {copiado ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copiar
                  </button>
                </div>
                <pre className="hc-dentro mt-2 max-h-[55vh] overflow-y-auto whitespace-pre-wrap p-4 font-sans text-sm text-foreground">
                  {texto}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-4">
          {confirmar.isError && (
            <p className="mr-auto text-xs font-semibold text-destructive">
              {confirmar.error instanceof Error
                ? confirmar.error.message
                : "Erro ao confirmar o Patch Note."}
            </p>
          )}
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Cancelar
          </button>
          <button
            onClick={() => confirmar.mutate()}
            disabled={!categorias || totalItens === 0 || confirmar.isPending}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            )}
          >
            {confirmar.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar e arquivar
          </button>
        </div>
      </div>
    </div>
  );
}
