import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ListChecks, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  criarChecklist,
  limparChecklist,
  removerChecklist,
  renomearChecklist,
  type IlegalChecklist,
  type MarcasChecklist,
} from "@/lib/ilegal-checklists";
import { cn } from "@/lib/utils";

export interface IlegalChecklistsModalProps {
  checklists: IlegalChecklist[];
  marcas: MarcasChecklist;
  /** ids das setagens que contam no total (as Fechado ficam de fora) */
  orgIds: string[];
  canEdit: boolean;
  onClose: () => void;
}

const campo =
  "h-9 w-full rounded-xl border border-input bg-white/[0.03] px-3 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Menu das check-lists: criar, renomear, desmarcar tudo e remover. */
export function IlegalChecklistsModal({ checklists, marcas, orgIds, canEdit, onClose }: IlegalChecklistsModalProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{ id: string; acao: "remover" | "limpar" } | null>(null);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["ilegal-checklists"] });
  const falhou = (e: Error) => toast.error(e.message || "Não deu certo. Tente de novo.");

  const criar = useMutation({
    mutationFn: () => criarChecklist(nome, checklists.length),
    onSuccess: async () => {
      await atualizar();
      toast.success(`Check-list “${nome.trim()}” criada.`);
      setNome("");
    },
    onError: falhou,
  });
  const renomear = useMutation({
    mutationFn: (v: { id: string; nome: string }) => renomearChecklist(v.id, v.nome),
    onSuccess: async () => {
      await atualizar();
      setEditando(null);
    },
    onError: falhou,
  });
  const executar = useMutation({
    mutationFn: async (v: { id: string; acao: "remover" | "limpar" }) => {
      if (v.acao === "remover") await removerChecklist(v.id);
      else await limparChecklist(v.id);
    },
    onSuccess: async (_r, v) => {
      await atualizar();
      toast.success(v.acao === "remover" ? "Check-list removida." : "Caixinhas desmarcadas.");
      setConfirmar(null);
    },
    onError: falhou,
  });

  const feitas = (id: string) => {
    const porOrg = marcas.get(id);
    return porOrg ? orgIds.filter((o) => porOrg.has(o)).length : 0;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-[22px] sm:max-w-lg sm:rounded-[22px]">
        <DialogHeader>
          <DialogTitle className="hc-titulo flex items-center gap-2">
            <ListChecks className="size-4" /> Check-lists
          </DialogTitle>
          <DialogDescription>
            Cada check-list vira uma coluna de caixinhas na tabela de Setagens. O staff marca em cada
            setagem quando terminar a tarefa.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (nome.trim() && !criar.isPending) criar.mutate();
            }}
          >
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Enviar aviso da reunião"
              aria-label="Nome da nova check-list"
              className={campo}
              autoFocus
            />
            <button
              type="submit"
              disabled={!nome.trim() || criar.isPending}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Criar
            </button>
          </form>
        )}

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {checklists.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.1] p-5 text-center text-[13px] text-muted-foreground">
              Nenhuma check-list ainda.{canEdit ? " Escreva o nome acima e clique em Criar." : ""}
            </p>
          ) : (
            checklists.map((c) => {
              const n = feitas(c.id);
              const total = orgIds.length;
              const pedido = confirmar?.id === c.id ? confirmar.acao : null;
              return (
                <div key={c.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  {editando?.id === c.id ? (
                    <form
                      className="flex items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        renomear.mutate(editando);
                      }}
                    >
                      <input
                        value={editando.nome}
                        onChange={(e) => setEditando({ id: c.id, nome: e.target.value })}
                        maxLength={80}
                        aria-label="Novo nome"
                        className={cn(campo, "h-8")}
                        autoFocus
                      />
                      <button type="submit" title="Salvar" className="grid size-8 place-items-center rounded-full hover:bg-foreground/10">
                        {renomear.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      </button>
                      <button type="button" title="Cancelar" onClick={() => setEditando(null)} className="grid size-8 place-items-center rounded-full hover:bg-foreground/10">
                        <X className="size-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground" title={c.nome}>
                          {c.nome}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className={cn("tabular-nums", n === total && total > 0 && "text-success")}>
                            {n} de {total}
                          </span>{" "}
                          setagens feitas{c.criadoPor ? ` · criada por ${c.criadoPor}` : ""}
                        </p>
                      </div>
                      {canEdit && !pedido && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            title="Renomear"
                            onClick={() => setEditando({ id: c.id, nome: c.nome })}
                            className="grid size-7 place-items-center rounded-full text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            title="Desmarcar todas as caixinhas (para usar de novo)"
                            onClick={() => setConfirmar({ id: c.id, acao: "limpar" })}
                            disabled={n === 0}
                            className="grid size-7 place-items-center rounded-full text-foreground/50 hover:bg-foreground/10 hover:text-foreground disabled:opacity-30"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>
                          <button
                            title="Remover check-list"
                            onClick={() => setConfirmar({ id: c.id, acao: "remover" })}
                            className="grid size-7 place-items-center rounded-full text-foreground/50 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {pedido && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2 text-[12px]">
                      <span className="flex-1 text-foreground/80">
                        {pedido === "remover"
                          ? "Remover esta check-list e todas as marcações dela?"
                          : `Desmarcar as ${n} caixinhas desta check-list?`}
                      </span>
                      <button onClick={() => setConfirmar(null)} className="pilula rounded-full !h-7 !px-3 !text-[12px]">
                        Cancelar
                      </button>
                      <button
                        onClick={() => executar.mutate({ id: c.id, acao: pedido })}
                        disabled={executar.isPending}
                        className={cn(
                          "flex h-7 items-center gap-1 rounded-full px-3 font-semibold",
                          pedido === "remover" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
                        )}
                      >
                        {executar.isPending && <Loader2 className="size-3.5 animate-spin" />}
                        {pedido === "remover" ? "Remover" : "Desmarcar"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
