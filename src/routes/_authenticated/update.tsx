import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, FileDown, Loader2, Maximize2, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDevTask,
  deleteDevTask,
  fetchDevTasks,
  moveDevTask,
  type ColumnId,
  type DevTask,
} from "@/lib/dev-tasks";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlanningDialog } from "@/components/update-planning-dialog";
import { UpdateOverview } from "@/components/update-overview";
import { MinhasDemandas, STATUS_PILL } from "@/components/update-minhas-demandas";

export const Route = createFileRoute("/_authenticated/update")({
  head: () => ({
    meta: [
      { title: "HOST UPDATE 2.1 — FiveM Host" },
      {
        name: "description",
        content: "Projetos e novidades da atualização HOST 2.1.",
      },
      { property: "og:title", content: "HOST UPDATE 2.1 — FiveM Host" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Projetos e novidades da atualização HOST 2.1.",
      },
    ],
  }),
  component: HostUpdate,
});

const COLUNAS: { id: ColumnId; label: string; dot: string }[] = [
  { id: "backlog", label: "Planejado", dot: "bg-muted-foreground" },
  { id: "doing", label: "Em andamento", dot: "bg-warning" },
  { id: "review", label: "Em teste", dot: "bg-info" },
  { id: "done", label: "Concluído", dot: "bg-success" },
];

const CATEGORIAS = [
  "Sistema",
  "Ilegal",
  "Polícia",
  "Economia",
  "Carros",
  "Interface",
  "Otimização",
  "Outros",
];

const inputCls =
  "rounded-md border border-input bg-black/25 px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

function HostUpdate() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [selected, setSelected] = useState<{ projeto: DevTask; editing: boolean } | null>(null);
  const [over, setOver] = useState<ColumnId | null>(null);

  useRealtimeTable("dev_tasks", [["host-update"]]);

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["host-update"],
    queryFn: fetchDevTasks,
  });

  const mover = useMutation({
    mutationFn: ({ id, coluna }: { id: string; coluna: ColumnId }) =>
      moveDevTask(id, coluna),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["host-update"] }),
    onError: () => toast.error("Não foi possível alterar o projeto."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => deleteDevTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["host-update"] }),
    onError: () => toast.error("Não foi possível remover o projeto."),
  });

  const concluidos = projetos.filter((p) => p.column === "done").length;
  const progresso = projetos.length
    ? Math.round((concluidos / projetos.length) * 100)
    : 0;

  const createReport = async () => {
    if (reportLoading) return;
    setReportLoading(true);
    try {
      const current = await fetchDevTasks();
      const { gerarRelatorioHostUpdate } = await import("@/lib/relatorio-host-update");
      await gerarRelatorioHostUpdate(current);
      toast.success("Relatório PDF gerado.");
    } catch { toast.error("Não foi possível gerar o relatório. Tente novamente."); }
    finally { setReportLoading(false); }
  };

  return (
    <div className="host-update-theme mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        kicker="UPDATE"
        title="HOST UPDATE 2.1"
        subtitle={`Projetos e novidades desta atualização — ${concluidos}/${projetos.length} concluídos (${progresso}%)`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={isLoading || reportLoading} onClick={() => void createReport()}>
            {reportLoading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Criar relatório
          </Button>
          <Button
            onClick={() => setModal(true)}
            className="gap-1.5 text-[13px] shadow-none"
          >
            <Plus className="size-4" /> Novo projeto
          </Button>
          </div>
        }
      />

      {/* Barra de progresso */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progresso}%` }}
        />
      </div>

      {isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando projetos...
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const cards = projetos.filter((p) => p.column === col.id);
            return (
              <section
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
                onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault(); setOver(null);
                  const id = e.dataTransfer.getData("text/plain");
                  const p = projetos.find((x) => x.id === id);
                  if (!p || p.column === col.id) return;
                  qc.setQueryData<DevTask[]>(["host-update"], (old) => old?.map((x) => (x.id === id ? { ...x, column: col.id } : x)));
                  mover.mutate({ id, coluna: col.id });
                }}
                className={cn("flex min-h-40 min-w-0 flex-col rounded-md border-t border-border pt-3 transition-colors", over === col.id && "bg-primary/5 ring-1 ring-primary/30")}
              >
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={cn("size-2 rounded-full", col.dot)} />
                  <h2 className="text-[13px] font-semibold text-foreground">
                    {col.label}
                  </h2>
                  <span className="ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {cards.map((p) => (
                    <ProjetoCard
                      key={p.id}
                      projeto={p}
                      onMover={(coluna) => mover.mutate({ id: p.id, coluna })}
                      onRemover={() => remover.mutate(p.id)}
                      onOpen={(editing) => setSelected({ projeto: p, editing })}
                    />
                  ))}
                  {cards.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Nenhum projeto
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="space-y-4 2xl:sticky 2xl:top-6 2xl:self-start">
          <UpdateOverview projetos={projetos} />
          <MinhasDemandas projetos={projetos} onOpen={(p) => setSelected({ projeto: p, editing: false })} />
        </aside>
        </div>
      )}

      {selected && <PlanningDialog projeto={selected.projeto} initiallyEditing={selected.editing} onClose={() => setSelected(null)} />}
      {modal && (
        <NovoProjetoModal
          onClose={() => setModal(false)}
          onCriado={() => {
            qc.invalidateQueries({ queryKey: ["host-update"] });
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

function ProjetoCard({
  projeto,
  onMover,
  onRemover,
  onOpen,
}: {
  projeto: DevTask;
  onMover: (coluna: ColumnId) => void;
  onRemover: () => void;
  onOpen: (editing: boolean) => void;
}) {
  const pill = STATUS_PILL[projeto.column];
  return (
    <article draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", projeto.id); e.dataTransfer.effectAllowed = "move"; }}
      className="group cursor-grab rounded-2xl border border-border/50 bg-card/40 p-3.5 backdrop-blur-xl transition-colors hover:border-primary/40 active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{projeto.tag}</span>
          <button type="button" onClick={() => onOpen(false)} className="mt-1 block text-left text-sm font-semibold leading-snug text-foreground hover:text-primary">{projeto.title}</button>
        </div>
        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={`Editar ${projeto.title}`} onClick={() => onOpen(true)}><Pencil className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={onRemover} aria-label="Remover projeto" className="size-7 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-1.5 text-xs text-primary" onClick={() => onOpen(false)}>
          <Maximize2 className="size-3.5" /> Abrir
          {projeto.attachments.length > 0 && <span className="flex items-center gap-0.5 text-muted-foreground"><Paperclip className="size-3" />{projeto.attachments.length}</span>}
        </Button>
        <label className={cn("relative flex items-center rounded-full", pill.cls)}>
          <span className="sr-only">Status</span>
          <select value={projeto.column} onChange={(e) => onMover(e.target.value as ColumnId)}
            className="cursor-pointer appearance-none bg-transparent py-1 pl-3 pr-7 text-[11px] font-semibold outline-none">
            {COLUNAS.map((c) => <option key={c.id} value={c.id} className="bg-black/25 text-foreground">{c.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3" />
        </label>
      </div>
    </article>
  );
}

function NovoProjetoModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0] ?? "Outros");
  const [responsavel, setResponsavel] = useState("");
  const [status, setStatus] = useState<ColumnId>("backlog");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    const t = titulo.trim();
    if (!t || salvando) return;
    setSalvando(true);
    try {
      await addDevTask({
        title: t,
        description: descricao.trim(),
        priority: "media",
        tag: categoria,
      });
      // ajusta responsável e status após criação
      const lista = await fetchDevTasks();
      const criado = lista.find((p) => p.title === t);
      if (criado) {
        if (status !== "backlog") await moveDevTask(criado.id, status);
        if (responsavel.trim()) {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase
            .from("dev_tasks")
            .update({ assignee: responsavel.trim() })
            .eq("id", criado.id);
        }
      }
      onCriado();
    } catch {
      toast.error("Não foi possível adicionar o projeto. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Novo projeto" className="w-full max-w-md rounded-lg glass p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Novo projeto</h2>
          <Button variant="ghost" size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground"
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
          <Button
            onClick={() => void criar()}
            disabled={!titulo.trim() || salvando}
            className="w-full shadow-none"
          >
            {salvando && <Loader2 className="size-4 animate-spin" />}
            Adicionar projeto
          </Button>
        </div>
      </div>
    </div>
  );
}
