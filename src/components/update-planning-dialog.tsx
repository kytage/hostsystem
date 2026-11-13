import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RichText } from "@/components/rich-text";
import { RichTextarea } from "@/components/rich-textarea";
import { PlanningAttachments } from "@/components/update-planning-attachments";
import { updateDevTask, type DevTask } from "@/lib/dev-tasks";
import { UpdateEstrutura } from "@/components/update-estrutura";

export interface PlanningDialogProps {
  projeto: DevTask;
  initiallyEditing?: boolean;
  onClose: () => void;
}

const fieldClass = "w-full rounded-xl border border-input bg-black/25 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PlanningDialog({ projeto, initiallyEditing = false, onClose }: PlanningDialogProps) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(projeto);
  const [draft, setDraft] = useState(projeto);
  const [editing, setEditing] = useState(initiallyEditing);
  const [uploading, setUploading] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const save = useMutation({
    mutationFn: () => updateDevTask(projeto.id, draft),
    onSuccess: () => {
      setSaved(draft); setEditing(false);
      void qc.invalidateQueries({ queryKey: ["host-update"] });
      toast.success("Planejamento atualizado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar o planejamento."),
  });
  const close = () => {
    if (save.isPending || uploading) return;
    if (dirty && !window.confirm("Descartar as alterações não salvas deste planejamento?")) return;
    onClose();
  };
  const discard = () => {
    if (dirty && !window.confirm("Descartar as alterações deste planejamento?")) return;
    setDraft(saved); setEditing(false);
  };
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent aria-describedby={undefined} className="host-update-theme flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:rounded-none" onInteractOutside={(e) => e.preventDefault()}>
      <header className="border-b border-white/[0.06] px-5 py-5 pr-14 md:px-10 md:pr-16">
        <p className="hc-sobre mb-2">HOST UPDATE 3.0 / PLANEJAMENTO</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><DialogTitle className="hc-titulo min-w-0 break-words !text-[18px]">{saved.title}</DialogTitle>
          <div className="flex flex-wrap gap-2">{editing ? <><Button variant="outline" onClick={discard} disabled={save.isPending || uploading}>Descartar</Button><Button onClick={() => save.mutate()} disabled={!draft.title.trim() || save.isPending || uploading}>{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações</Button></> : <Button onClick={() => setEditing(true)}><Pencil className="size-4" /> Editar planejamento</Button>}</div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-10">
        <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
          <main className="min-w-0 space-y-8">
            {editing && <label className="block space-y-2 text-sm font-medium"><span className="hc-sobre block">Título</span><input aria-label="Título do planejamento" className={fieldClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>}
            <section className="space-y-3"><h3 className="hc-titulo">Descrição e planejamento</h3>{editing ? <RichTextarea value={draft.description} onChange={(description) => setDraft({ ...draft, description })} rows={14} inputClassName={`${fieldClass} resize-y`} /> : <RichText value={saved.description} className="break-words [overflow-wrap:anywhere]" />}</section>
            <UpdateEstrutura projetoId={projeto.id} />
            <PlanningAttachments files={editing ? draft.attachments : saved.attachments} onChange={editing ? (attachments) => setDraft((d) => ({ ...d, attachments })) : undefined} onBusy={setUploading} />
          </main>
          <aside className="space-y-5 border-t border-white/[0.06] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div><h3 className="hc-sobre mb-2">Status</h3><p className="text-sm">{{ backlog: "Planejado", doing: "Em andamento", review: "Em teste", done: "Concluído" }[saved.column]}</p></div>
            <label className="block space-y-2 text-xs text-muted-foreground"><span className="hc-sobre block">Categoria</span>{editing ? <input aria-label="Categoria do planejamento" className={fieldClass} value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} /> : <span className="block break-words text-sm text-foreground">{saved.tag}</span>}</label>
            <label className="block space-y-2 text-xs text-muted-foreground"><span className="hc-sobre block">Responsável</span>{editing ? <input aria-label="Responsável do planejamento" className={fieldClass} value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} /> : <span className="block break-words text-sm text-foreground">{saved.assignee || "Não definido"}</span>}</label>
          </aside>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}