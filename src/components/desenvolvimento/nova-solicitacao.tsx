import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIA_LABEL,
  createCard,
  type Anexo,
  type Categoria,
  type ChecklistItem,
  type Prioridade,
} from "@/lib/kanban";
import { clipboardImageToDataUrl, nomeImagemColada } from "@/lib/clipboard-image";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-input bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

export interface SolicitacaoInicial {
  titulo?: string;
  descricao?: string;
  prioridade?: Prioridade;
  categoria?: Categoria;
  anexos?: Anexo[];
}

/**
 * Janela completa de "Nova solicitação" do Desenvolvimento (título, descrição, categoria,
 * prioridade, observações, Patch Note, checklist e anexos). Usada na tela de
 * Desenvolvimento e ao encaminhar uma pendência de área para o Dev.
 */
export function NovaSolicitacaoModal({
  criadoPor,
  inicial,
  onClose,
  onCriado,
}: {
  criadoPor: string;
  inicial?: SolicitacaoInicial;
  onClose: () => void;
  /** Recebe o id do card criado no quadro de Desenvolvimento. */
  onCriado?: (cardId: string) => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? "normal");
  const [prioridade, setPrioridade] = useState<Prioridade>(inicial?.prioridade ?? "media");
  const [anexos, setAnexos] = useState<Anexo[]>(inicial?.anexos ?? []);
  const [obsDev, setObsDev] = useState("");
  const [patchTexto, setPatchTexto] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistItem, setChecklistItem] = useState("");
  const [novoAnexo, setNovoAnexo] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      const id = await createCard({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        categoria,
        prioridade,
        criadoPor: criadoPor || "desconhecido",
        anexos,
        obsDev: obsDev.trim(),
        patchTexto: patchTexto.trim(),
        checklist,
      });
      await onCriado?.(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kanban-cards"] });
      onClose();
    },
    onError: () => toast.error("Não foi possível criar a solicitação. Tente novamente."),
  });

  return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl glass">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Nova</span>
                <span className="rounded-full bg-chart-2/15 px-2 py-0.5 text-[11px] font-semibold text-chart-2">{CATEGORIA_LABEL[categoria]}</span>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-warning">{prioridade}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Solicitação</span>
              </div>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título da solicitação"
                autoFocus
                className="mt-2 w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground font-display"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Criado por <span className="font-semibold text-foreground/80">{criadoPor || "desconhecido"}</span>
              </p>
            </div>
            <button
              onClick={() => onClose()}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex gap-1 border-b border-border px-5 pt-3">
            <button className="flex items-center gap-1.5 rounded-t-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-foreground"><FileText className="size-3.5" /> Detalhes</button>
            <button disabled className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground opacity-60"><MessageSquare className="size-3.5" /> Comentários (0)</button>
            <button disabled className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground opacity-60"><History className="size-3.5" /> Histórico (0)</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-h-[min(560px,55vh)] flex-col">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Descrição</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva detalhadamente a solicitação..."
                  className={cn(inputCls, "min-h-[min(560px,55vh)] flex-1 resize-y")}
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Categoria</label>
                    <MinimalSelect value={categoria} onChange={(value) => setCategoria(value as Categoria)} options={Object.entries(CATEGORIA_LABEL).map(([value, label]) => ({ value, label }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Prioridade</label>
                    <MinimalSelect value={prioridade} onChange={(value) => setPrioridade(value as Prioridade)} options={[{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }]} />
                  </div>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><StickyNote className="size-3.5" /> Observações do desenvolvedor (interno)</label>
                  <textarea value={obsDev} onChange={(e) => setObsDev(e.target.value)} rows={2} placeholder="Anotações técnicas, não aparecem no Patch Note" className={cn(inputCls, "resize-none")} />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FileText className="size-3.5" /> Texto para Patch Note</label>
                  <textarea value={patchTexto} onChange={(e) => setPatchTexto(e.target.value)} rows={2} placeholder="Ex.: Corrigido o sistema... (vazio = IA gera)" className={cn(inputCls, "resize-none")} />
                </div>

                <div className="rounded-xl border border-border p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ListChecks className="size-3.5" /> Checklist</p>
                  {checklist.length > 0 && <div className="mt-2 space-y-1.5">{checklist.map((item, index) => <div key={`${item.texto}-${index}`} className="flex items-center gap-2 text-xs text-foreground"><span className="flex-1">{item.texto}</span><button type="button" onClick={() => setChecklist((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover item" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button></div>)}</div>}
                  <div className="mt-2 flex gap-2">
                    <input value={checklistItem} onChange={(e) => setChecklistItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && checklistItem.trim()) { e.preventDefault(); setChecklist((items) => [...items, { texto: checklistItem.trim(), feito: false }]); setChecklistItem(""); } }} placeholder="Adicionar item..." className="flex-1 rounded-lg border border-input bg-black/25 px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring" />
                    <button type="button" onClick={() => { if (!checklistItem.trim()) return; setChecklist((items) => [...items, { texto: checklistItem.trim(), feito: false }]); setChecklistItem(""); }} className="rounded-lg bg-white/[0.05] px-2.5 text-foreground hover:bg-white/[0.08]" aria-label="Adicionar item"><Plus className="size-3.5" /></button>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Paperclip className="size-3.5" /> Anexos / Imagens ({anexos.length})
                  </p>
              {anexos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {anexos.map((a, i) => (
                    <div key={`${a.nome}-${i}`} className="group overflow-hidden rounded-lg border border-border bg-black/25">
                      {(a.url.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.url)) && (
                        <img
                          src={a.url}
                          alt={a.nome}
                          className="h-32 w-full object-contain"
                        />
                      )}
                      <div className="flex items-center gap-2 border-t border-border px-2 py-1.5"><span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                        {a.nome}
                      </span>
                      <button
                        onClick={() => setAnexos(anexos.filter((_, j) => j !== i))}
                        aria-label="Remover anexo"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  value={novoAnexo}
                  onChange={(e) => setNovoAnexo(e.target.value)}
                  onPaste={(e) => {
                    void clipboardImageToDataUrl(e.nativeEvent).then((dataUrl) => {
                      if (!dataUrl) return; // texto comum segue o fluxo normal
                      e.preventDefault();
                      setAnexos((prev) => [
                        ...prev,
                        { nome: nomeImagemColada(), url: dataUrl },
                      ]);
                    });
                  }}
                  placeholder="Cole URL ou Ctrl+V com print..."
                  className="flex-1 rounded-lg border border-input bg-black/25 px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                />
                <button
                  onClick={() => {
                    const url = novoAnexo.trim();
                    if (!url) return;
                    const nome = url.split("/").pop()?.slice(0, 40) || "anexo";
                    setAnexos((prev) => [...prev, { nome, url }]);
                    setNovoAnexo("");
                  }}
                  className="rounded-lg bg-white/[0.05] px-2.5 text-foreground hover:bg-white/[0.08]"
                  aria-label="Adicionar anexo"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                Dica: copie um print e pressione Ctrl+V no campo acima para anexar.
              </p>
                </div>

                <button
                  onClick={() => titulo.trim() && criar.mutate()}
                  disabled={criar.isPending || !titulo.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {criar.isPending && <Loader2 className="size-4 animate-spin" />}
                  Criar solicitação
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
,
    document.body,
  );
}
