import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addDevTask, moveDevTask, type ColumnId } from "@/lib/dev-tasks";
import { CATEGORIAS, COLUNAS } from "@/lib/update-board";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputCls =
  "rounded-xl border border-input bg-black/25 px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

/** Janela de "Novo projeto" do HOST UPDATE. Também abre ao encaminhar uma pendência para o Update. */
export function NovoProjetoModal({
  onClose,
  onCriado,
  inicial,
}: {
  onClose: () => void;
  /** Recebe o id do projeto criado. */
  onCriado: (id: string) => void | Promise<void>;
  inicial?: { titulo?: string; descricao?: string };
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0] ?? "Outros");
  const [responsavel, setResponsavel] = useState("");
  const [status, setStatus] = useState<ColumnId>("backlog");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    const t = titulo.trim();
    if (!t || salvando) return;
    setSalvando(true);
    try {
      const id = await addDevTask({
        title: t,
        description: descricao.trim(),
        priority: "media",
        tag: categoria,
      });
      // ajusta responsável e status após criação
      if (status !== "backlog") await moveDevTask(id, status);
      if (responsavel.trim()) {
        await supabase.from("dev_tasks").update({ assignee: responsavel.trim() }).eq("id", id);
      }
      await onCriado(id);
    } catch {
      toast.error("Não foi possível adicionar o projeto. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Novo projeto" className="w-full max-w-md rounded-[22px] glass-modal p-5">
        <div className="flex items-center justify-between">
          <h2 className="hc-titulo">Novo projeto</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do projeto"
            className={cn(inputCls, "w-full")}
            autoFocus
          />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={3}
            className={cn(inputCls, "w-full resize-none")}
          />
          <div className="grid grid-cols-2 gap-2">
            <MinimalSelect
              value={categoria}
              onChange={setCategoria}
              options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
            />
            <MinimalSelect
              value={status}
              onChange={(v) => setStatus(v as ColumnId)}
              options={COLUNAS.map((c) => ({ value: c.id, label: c.label }))}
            />
          </div>
          <input
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Responsável"
            className={cn(inputCls, "w-full")}
          />
          <Button onClick={() => void criar()} disabled={!titulo.trim() || salvando} className="w-full shadow-none">
            {salvando && <Loader2 className="size-4 animate-spin" />}
            Adicionar projeto
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
