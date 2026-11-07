import { RichTextarea } from "@/components/rich-textarea";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ImagePlus,
  Loader2,
  Maximize2,
  NotebookPen,
  Plus,
  StickyNote,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addTarefa,
  COLUNAS_TAREFA,
  deleteTarefa,
  designarTarefa,
  fetchAnotacao,
  fetchTarefas,
  moveTarefa,
  saveAnotacao,
  updateTarefa,
  type ColunaTarefa,
  type Tarefa,
  type TipoTarefa,
} from "@/lib/tarefas";
import { createCard, getCurrentUsername, type Prioridade } from "@/lib/kanban";
import { listStaffSimple } from "@/lib/users.functions";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { fileImageToDataUrl, pasteImageFromEvent } from "@/lib/clipboard-image";
import { cn } from "@/lib/utils";

/** Renderiza texto com imagens coladas (linhas data:image/) como miniaturas. */
function DescricaoComImagens({ texto }: { texto: string }) {
  const partes = texto.split("\n").filter(Boolean);
  const linhas = partes.filter((p) => !p.startsWith("data:image/"));
  const imagens = partes.filter((p) => p.startsWith("data:image/"));
  return (
    <>
      {linhas.length > 0 && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {linhas.join("\n")}
        </p>
      )}
      {imagens.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {imagens.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="Print anexado à tarefa"
              className="h-16 rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------- Modal de visualizar/editar ------------------------- */

/** Divide a descrição entre texto e prints colados. */
function splitDescricao(texto: string): { texto: string; imagens: string[] } {
  const partes = texto.split("\n");
  return {
    texto: partes.filter((p) => !p.startsWith("data:image/")).join("\n"),
    imagens: partes.filter((p) => p.startsWith("data:image/")),
  };
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

interface TarefaModalProps {
  tarefa: Tarefa;
  onClose: () => void;
}

function TarefaModal({ tarefa, onClose }: TarefaModalProps) {
  const queryClient = useQueryClient();
  const inicial = splitDescricao(tarefa.descricao);

  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [texto, setTexto] = useState(inicial.texto);
  const [imagens, setImagens] = useState<string[]>(inicial.imagens);
  const [tipo, setTipo] = useState<TipoTarefa>(tarefa.tipo);
  const [quando, setQuando] = useState(toDatetimeLocal(tarefa.reuniaoAt));
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const descricaoFinal = [texto.trim(), ...imagens].filter(Boolean).join("\n");

  const salvar = useMutation({
    mutationFn: () =>
      updateTarefa(tarefa.id, {
        titulo: titulo.trim() || tarefa.titulo,
        descricao: descricaoFinal,
        tipo,
        reuniaoAt: tipo === "reuniao" && quando ? new Date(quando).toISOString() : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tarefas-particulares"] });
      toast.success("Tarefa atualizada.");
      onClose();
    },
    onError: () => toast.error("Não foi possível salvar a tarefa."),
  });

  const transformar = useMutation({
    mutationFn: async () => {
      const criadoPor = await getCurrentUsername();
      await createCard({
        titulo: titulo.trim() || tarefa.titulo,
        descricao: texto.trim(),
        categoria: "normal",
        prioridade,
        criadoPor,
        anexos: imagens.map((url, i) => ({ nome: `print-${i + 1}.png`, url })),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
      toast.success("Pendência criada em Desenvolvimento.");
      onClose();
    },
    onError: () => toast.error("Não foi possível criar a pendência."),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lightbox]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-3xl rounded-2xl glass-modal p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tarefa particular
            </p>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-transparent bg-transparent text-xl font-semibold text-foreground outline-none focus:border-border focus:bg-background focus:px-3 focus:py-1.5 font-display"
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
            <MinimalSelect
              value={tipo}
              onChange={(v) => setTipo(v as TipoTarefa)}
              className="mt-1 h-9 w-full"
              options={[
                { value: "tarefa", label: "Tarefa" },
                { value: "reuniao", label: "Reunião" },
              ]}
            />
          </div>
          {tipo === "reuniao" && (
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Data e hora
              </label>
              <input
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-border bg-black/25 px-3 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground">
              <ImagePlus className="size-3.5" /> Anexar print
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  for (const f of files) {
                    const url = await fileImageToDataUrl(f);
                    if (url) setImagens((p) => [...p, url]);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <RichTextarea
            className="mt-1"
            value={texto}
            onChange={setTexto}
            onPaste={(e) => pasteImageFromEvent(e, (url) => setImagens((p) => [...p, url]))}
            placeholder="Descrição — Ctrl+V cola print ou use “Anexar print”"
            inputClassName="min-h-64 w-full resize-y rounded-xl border border-border bg-black/25 p-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
          />
        </div>

        {imagens.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {imagens.map((src, i) => (
              <span key={i} className="group relative">
                <img
                  src={src}
                  alt={`Print ${i + 1} da tarefa`}
                  onClick={() => setLightbox(src)}
                  className="h-28 cursor-zoom-in rounded-lg border border-border object-cover"
                />
                <button
                  onClick={() => setImagens((p) => p.filter((_, j) => j !== i))}
                  aria-label="Remover print"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-destructive-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Salvar alterações
          </button>

          <div className="flex flex-1 items-center gap-2 sm:justify-end">
            <MinimalSelect
              value={prioridade}
              onChange={(v) => setPrioridade(v as Prioridade)}
              className="h-10 min-w-40"
              options={[
                { value: "baixa", label: "Prioridade baixa" },
                { value: "media", label: "Prioridade média" },
                { value: "alta", label: "Prioridade alta" },
              ]}
            />
            <button
              onClick={() => transformar.mutate()}
              disabled={transformar.isPending}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/50 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              {transformar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
              Transformar em pendência
            </button>
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <img
            src={lightbox}
            alt="Print ampliado"
            className="max-h-full max-w-full object-contain"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            aria-label="Fechar imagem"
            className="absolute right-4 top-4 rounded-lg bg-background/80 p-2 text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function TarefasParticulares() {
  const queryClient = useQueryClient();

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["tarefas-particulares"],
    queryFn: fetchTarefas,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["tarefas-particulares"] });

  const { data: staffs = [] } = useQuery({
    queryKey: ["staff-simple"],
    queryFn: () => listStaffSimple(),
  });

  const addMutation = useMutation({
    mutationFn: ({
      titulo,
      descricao,
      destinatarioId,
      designadaPor,
    }: {
      titulo: string;
      descricao: string;
      destinatarioId?: string | undefined;
      designadaPor?: string | undefined;
    }) =>
      destinatarioId
        ? designarTarefa({
            titulo,
            descricao,
            destinatarioId,
            designadaPor: designadaPor ?? "",
          })
        : addTarefa(titulo, descricao),
    onSuccess: invalidate,
  });
  const moveMutation = useMutation({
    mutationFn: ({ id, coluna }: { id: string; coluna: ColunaTarefa }) =>
      moveTarefa(id, coluna),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTarefa,
    onSuccess: invalidate,
  });

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prints, setPrints] = useState<string[]>([]);
  const [designar, setDesignar] = useState(false);
  const [destinatarioId, setDestinatarioId] = useState("");
  const [dragOver, setDragOver] = useState<ColunaTarefa | null>(null);
  const [aberta, setAberta] = useState<Tarefa | null>(null);

  const submit = async () => {
    const t = titulo.trim();
    if (!t || addMutation.isPending) return;
    if (designar && !destinatarioId) return;
    const descFinal = [descricao.trim(), ...prints].filter(Boolean).join("\n");
    let designadaPor: string | undefined;
    if (designar) designadaPor = await getCurrentUsername();
    addMutation.mutate({
      titulo: t,
      descricao: descFinal,
      destinatarioId: designar ? destinatarioId : undefined,
      designadaPor,
    });
    setTitulo("");
    setDescricao("");
    setPrints([]);
    setDestinatarioId("");
  };

  return (
    <section className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <NotebookPen className="size-4 text-primary" /> Tarefas particulares
        </h2>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
          somente você vê
        </span>
      </div>

      {/* Nova tarefa */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Título da tarefa..."
          className="h-9 flex-1 rounded-xl border border-border bg-black/25 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
        />
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          onPaste={(e) =>
            pasteImageFromEvent(e, (dataUrl) => setPrints((p) => [...p, dataUrl]))
          }
          placeholder="Descrição (opcional) — Ctrl+V cola print"
          className="h-9 flex-1 rounded-xl border border-border bg-black/25 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
        />
        <button
          onClick={() => setDesignar((d) => !d)}
          title="Designar tarefa para outro staff"
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors",
            designar
              ? "border-white/15 bg-white/[0.07] text-foreground"
              : "border-border text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
          )}
        >
          <UserPlus className="size-4" />
          Designar
        </button>
        <button
          onClick={() => void submit()}
          disabled={!titulo.trim() || (designar && !destinatarioId) || addMutation.isPending}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {addMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {designar ? "Designar" : "Adicionar"}
        </button>
      </div>

      {designar && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Para:</span>
          <MinimalSelect
            value={destinatarioId}
            onChange={setDestinatarioId}
            placeholder="Escolha o staff..."
            className="h-9 min-w-48"
            options={staffs.map((s) => ({ value: s.id, label: s.username }))}
          />
        </div>
      )}

      {prints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {prints.map((src, i) => (
            <span key={i} className="group relative">
              <img
                src={src}
                alt="Print a anexar"
                className="h-14 rounded-lg border border-border object-cover"
              />
              <button
                onClick={() => setPrints((p) => p.filter((_, j) => j !== i))}
                aria-label="Remover print"
                className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Colunas */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {COLUNAS_TAREFA.map((col) => {
          const items = tarefas.filter((t) => t.coluna === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                // Evita re-render a cada mousemove durante o drag
                setDragOver((d) => (d === col.key ? d : col.key));
              }}
              onDragLeave={() => setDragOver((d) => (d === col.key ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/tarefa-id");
                if (id) moveMutation.mutate({ id, coluna: col.key });
                setDragOver(null);
              }}
              className={cn(
                "min-h-32 rounded-xl border-dashed glass-inset p-2.5 transition-colors",
                dragOver === col.key && "border-primary/60 bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className={cn("size-2 rounded-full", col.dot)} />
                  {col.label}
                </span>
                <span className="text-xs text-muted-foreground/70">{items.length}</span>
              </div>
              <div className="space-y-2">
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Carregando...
                  </div>
                )}
                {!isLoading && items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground/60">
                    Arraste uma tarefa aqui
                  </p>
                )}
                {items.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/tarefa-id", t.id)}
                    className="group cursor-grab rounded-xl glass p-3 transition-colors hover:bg-accent/40 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => setAberta(t)}
                        title="Abrir tarefa"
                        className={cn(
                          "cursor-pointer text-sm font-semibold text-foreground hover:text-primary",
                          t.coluna === "concluido" && "line-through opacity-60"
                        )}
                      >
                        {t.titulo}
                      </h3>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() => setAberta(t)}
                          aria-label="Visualizar e editar tarefa"
                          className="rounded-lg p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-white/[0.08] hover:text-foreground group-hover:opacity-100"
                        >
                          <Maximize2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(t.id)}
                          aria-label="Excluir tarefa"
                          className="rounded-lg p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {t.tipo === "reuniao" && t.reuniaoAt && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Reunião •{" "}
                        {new Date(t.reuniaoAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {t.reuniaoConfirmada && " ✓"}
                      </p>
                    )}
                    {t.descricao && <DescricaoComImagens texto={t.descricao} />}
                    {t.designadaPor && (
                      <p className="mt-1.5 text-[10px] font-semibold text-primary/80">
                        Designada por {t.designadaPor}
                      </p>
                    )}
                    <div className="mt-2 flex gap-1">
                      {COLUNAS_TAREFA.filter((c) => c.key !== t.coluna).map((c) => (
                        <button
                          key={c.key}
                          onClick={() => moveMutation.mutate({ id: t.id, coluna: c.key })}
                          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          {c.key === "concluido" && <Check className="size-2.5" />}
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {aberta && (
        <TarefaModal
          key={aberta.id}
          tarefa={aberta}
          onClose={() => setAberta(null)}
        />
      )}
    </section>
  );
}

export function Anotacoes() {
  const { data, isLoading } = useQuery({
    queryKey: ["anotacoes"],
    queryFn: fetchAnotacao,
  });
  const [texto, setTexto] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data !== undefined) setTexto(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: saveAnotacao,
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const onChange = (value: string) => {
    setTexto(value);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveMutation.mutate(value), 800);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const saveNow = () => {
    if (timer.current) clearTimeout(timer.current);
    saveMutation.mutate(texto);
  };

  return (
    <section className="flex flex-col rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <StickyNote className="size-4 text-warning" /> Anotações
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {saveMutation.isPending && (
            <>
              <Loader2 className="size-3 animate-spin" /> Salvando...
            </>
          )}
          {saved && !saveMutation.isPending && (
            <>
              <Check className="size-3 text-success" /> Salvo
            </>
          )}
        </span>
      </div>
      <RichTextarea
        className="mt-4 flex-1"
        value={texto}
        onChange={onChange}
        disabled={isLoading}
        placeholder="Escreva suas anotações aqui... salvamento automático."
        inputClassName="min-h-48 w-full flex-1 resize-y rounded-xl border border-border bg-black/25 p-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
      />
      <button
        onClick={saveNow}
        disabled={saveMutation.isPending || isLoading}
        className="mt-2 inline-flex h-7 items-center justify-center gap-1.5 self-start rounded-lg border border-border px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50"
      >
        {saveMutation.isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3 text-success" />
        )}
        Salvar
      </button>
    </section>
  );
}

export function TarefasPreview() {
  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas-particulares"],
    queryFn: fetchTarefas,
  });
  const { data: anotacao = "" } = useQuery({
    queryKey: ["anotacoes"],
    queryFn: fetchAnotacao,
  });

  return (
    <Link
      to="/tarefas"
      className="group block rounded-2xl glass p-5 transition-colors hover:border-primary/50 hover:bg-accent/30"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <NotebookPen className="size-4 text-primary" /> Tarefas particulares
        </h2>
        <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Abrir <ArrowUpRight className="size-3.5" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {COLUNAS_TAREFA.map((col) => {
          const count = tarefas.filter((t) => t.coluna === col.key).length;
          return (
            <div
              key={col.key}
              className="rounded-xl glass-inset p-3 text-center"
            >
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", col.dot)} />
                {col.label}
              </span>
              <p className="mt-1 text-xl font-semibold text-foreground font-display">{count}</p>
            </div>
          );
        })}
      </div>

      {tarefas.filter((t) => t.coluna !== "concluido").slice(0, 3).map((t) => (
        <p
          key={t.id}
          className="mt-2 truncate text-xs text-muted-foreground first:mt-3"
        >
          • {t.titulo}
        </p>
      ))}

      <div className="mt-4 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <StickyNote className="size-3 text-warning" /> Anotações
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
          {anotacao.trim() || "Nenhuma anotação ainda."}
        </p>
      </div>
    </Link>
  );
}
