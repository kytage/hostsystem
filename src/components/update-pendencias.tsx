import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ListChecks, Maximize2, Plus, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PlanningAttachments } from "@/components/update-planning-attachments";
import { deleteDevTask, patchDevTask, type ChecklistItem, type ColumnId, type DevTask, type Priority } from "@/lib/dev-tasks";
import { playSfx, setSfxMuted, sfxMuted } from "@/lib/sfx";

export const STATUS: { id: ColumnId; label: string; on: string; dot: string }[] = [
  { id: "backlog", label: "Planejado", on: "bg-white/[0.12] text-foreground", dot: "bg-white/40" },
  { id: "doing", label: "Em andamento", on: "bg-amber-500/20 text-amber-200", dot: "bg-amber-400" },
  { id: "review", label: "Em teste", on: "bg-sky-500/20 text-sky-200", dot: "bg-sky-400" },
  { id: "done", label: "Concluído", on: "bg-emerald-500/20 text-emerald-200", dot: "bg-emerald-400" },
];
const STATUS_MAP = Object.fromEntries(STATUS.map((s) => [s.id, s])) as Record<ColumnId, (typeof STATUS)[number]>;

const PRIORIDADES: { id: Priority; label: string; on: string; dot: string }[] = [
  { id: "alta", label: "Alta", on: "border-primary/50 bg-primary/15 text-red-200", dot: "bg-primary" },
  { id: "media", label: "Média", on: "border-amber-500/40 bg-amber-500/10 text-amber-200", dot: "bg-amber-400" },
  { id: "baixa", label: "Baixa", on: "border-white/20 bg-white/[0.08] text-foreground", dot: "bg-white/40" },
];
const PRIO_MAP = Object.fromEntries(PRIORIDADES.map((p) => [p.id, p])) as Record<Priority, (typeof PRIORIDADES)[number]>;

export const ETIQUETAS = ["Marketing", "Sistema", "Economia", "Carros", "Ilegal", "Polícia", "Interface", "Otimização", "Outros"];

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));
const fmtPrazo = (d: string) => d.split("-").reverse().join("/");
const atrasado = (t: DevTask) => !!t.prazo && t.column !== "done" && t.prazo < new Date().toLocaleDateString("en-CA");

/** Alterações de um tópico com atualização otimista da lista ["host-update"]. */
function usePatchTopico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof patchDevTask>[1] }) => patchDevTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["host-update"] });
      const antes = qc.getQueryData<DevTask[]>(["host-update"]);
      qc.setQueryData<DevTask[]>(["host-update"], (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { antes };
    },
    onError: (_e, _v, c) => {
      if (c?.antes) qc.setQueryData(["host-update"], c.antes);
      toast.error("Não foi possível salvar a alteração.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["host-update"] }),
  });
}

/** Marca/desmarca um item tocando o som certo (e a fanfarra quando fecha o checklist). */
function toggleItem(t: DevTask, itemId: string): ChecklistItem[] {
  const next = t.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
  const marcou = next.find((i) => i.id === itemId)?.done;
  const completou = marcou && next.length > 0 && next.every((i) => i.done);
  playSfx(completou ? "complete" : marcou ? "check" : "uncheck");
  if (completou) toast.success(`Checklist de “${t.title}” completo!`);
  return next;
}

function Progresso({ feitos, total, className }: { feitos: number; total: number; className?: string }) {
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", pct === 100 ? "bg-emerald-400" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CheckBox({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-all duration-200 active:scale-90",
        done ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25 bg-black/30 hover:border-white/50",
      )}
    >
      <Check className={cn("size-3 transition-transform duration-200", done ? "scale-100" : "scale-0")} strokeWidth={3.2} />
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function PendenciasPanel({ projetos }: { projetos: DevTask[] }) {
  const patch = usePatchTopico();
  const [filtro, setFiltro] = useState<ColumnId | "todos" | "abertos">("abertos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [mudo, setMudo] = useState(false);
  useEffect(() => setMudo(sfxMuted()), []);

  const itens = projetos.flatMap((p) => p.checklist);
  const feitos = itens.filter((i) => i.done).length;
  const concluidos = projetos.filter((p) => p.column === "done").length;
  const lista = useMemo(() => {
    return projetos
      .filter((p) => (filtro === "todos" ? true : filtro === "abertos" ? p.column !== "done" : p.column === filtro))
      .sort((a, b) => Number(a.column === "done") - Number(b.column === "done"));
  }, [projetos, filtro]);
  const selecionado = projetos.find((p) => p.id === aberto) ?? null;

  const filtros: { id: typeof filtro; label: string; n: number }[] = [
    { id: "abertos", label: "Em aberto", n: projetos.length - concluidos },
    { id: "todos", label: "Todos", n: projetos.length },
    ...STATUS.map((s) => ({ id: s.id, label: s.label, n: projetos.filter((p) => p.column === s.id).length })),
  ];

  return (
    <section className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Tópicos", v: projetos.length, s: `${concluidos} concluído${concluidos === 1 ? "" : "s"}` },
          { k: "Itens do checklist", v: `${feitos}/${itens.length}`, s: "marcados" },
          { k: "Progresso geral", v: `${itens.length ? Math.round((feitos / itens.length) * 100) : 0}%`, s: "dos itens" },
          { k: "Prioridade alta", v: projetos.filter((p) => p.priority === "alta" && p.column !== "done").length, s: "em aberto" },
        ].map((c) => (
          <div key={c.k} className="glass rounded-2xl p-4">
            <p className="eyebrow">{c.k}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{c.v}</p>
            <p className="text-[11px] text-ink-3">{c.s}</p>
          </div>
        ))}
      </div>
      <Progresso feitos={feitos} total={itens.length} className="h-1" />

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass-inset flex flex-wrap gap-1 rounded-full p-1">
          {filtros.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                playSfx("click");
                setFiltro(f.id);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition-colors",
                filtro === f.id ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label} <span className="text-ink-3">{f.n}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const m = !mudo;
            setMudo(m);
            setSfxMuted(m);
            if (!m) playSfx("check");
          }}
          title={mudo ? "Ativar sons" : "Silenciar sons"}
          aria-label={mudo ? "Ativar sons" : "Silenciar sons"}
          className="glass-inset ml-auto grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          {mudo ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      {lista.length === 0 ? (
        <p className="glass-inset rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">Nenhuma pendência neste filtro.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {lista.map((t, i) => (
            <TopicoCard
              key={t.id}
              topico={t}
              index={i}
              onOpen={() => {
                playSfx("click");
                setAberto(t.id);
              }}
              onToggle={(itemId) => patch.mutate({ id: t.id, patch: { checklist: toggleItem(t, itemId) } })}
              onAdd={(text) => {
                playSfx("add");
                patch.mutate({ id: t.id, patch: { checklist: [...t.checklist, { id: novoId(), text, done: false }] } });
              }}
            />
          ))}
        </div>
      )}

      {selecionado && <TopicoDialog topico={selecionado} onClose={() => setAberto(null)} />}
    </section>
  );
}

function TopicoCard({
  topico: t,
  index,
  onOpen,
  onToggle,
  onAdd,
}: {
  topico: DevTask;
  index: number;
  onOpen: () => void;
  onToggle: (itemId: string) => void;
  onAdd: (text: string) => void;
}) {
  const [novo, setNovo] = useState("");
  const feitos = t.checklist.filter((i) => i.done).length;
  const st = STATUS_MAP[t.column];
  const pr = PRIO_MAP[t.priority] ?? PRIO_MAP.media;
  const add = () => {
    const v = novo.trim();
    if (!v) return;
    onAdd(v);
    setNovo("");
  };
  return (
    <article
      className={cn("glass animate-rise flex flex-col rounded-[20px] p-4 transition-colors hover:border-white/15", t.column === "done" && "opacity-70")}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium", st.on)}>
              <span className={cn("size-1.5 rounded-full", st.dot)} /> {st.label}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10.5px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", pr.dot)} /> {pr.label}
            </span>
            {t.tag && <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{t.tag}</span>}
          </div>
          <button onClick={onOpen} className="mt-2 block text-left font-display text-[15px] font-semibold leading-snug hover:text-primary">
            {t.title}
          </button>
        </div>
        <button onClick={onOpen} aria-label={`Abrir ${t.title}`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground">
          <Maximize2 className="size-3.5" />
        </button>
      </header>

      <div className="mt-3 flex items-center gap-2.5">
        <Progresso feitos={feitos} total={t.checklist.length} />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {feitos}/{t.checklist.length}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {t.checklist.map((i) => (
          <li key={i.id} className="flex items-start gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/[0.03]">
            <span className="pt-px">
              <CheckBox done={i.done} onClick={() => onToggle(i.id)} label={i.text} />
            </span>
            <span className={cn("text-[13px] leading-snug transition-colors", i.done ? "text-ink-3 line-through" : "text-foreground/90")}>{i.text}</span>
          </li>
        ))}
        {t.checklist.length === 0 && <li className="px-1.5 py-1 text-xs text-ink-3">Sem itens ainda — adicione o primeiro.</li>}
      </ul>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Adicionar item e Enter"
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-black/30 px-2.5 text-xs outline-none placeholder:text-ink-3 focus:border-white/20"
        />
        {t.prazo && (
          <span className={cn("flex shrink-0 items-center gap-1 text-[11px]", atrasado(t) ? "text-primary" : "text-muted-foreground")}>
            <CalendarDays className="size-3" /> {fmtPrazo(t.prazo)}
          </span>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function TopicoDialog({ topico: t, onClose }: { topico: DevTask; onClose: () => void }) {
  const qc = useQueryClient();
  const patch = usePatchTopico();
  const [titulo, setTitulo] = useState(t.title);
  const [descricao, setDescricao] = useState(t.description);
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);
  const novoRef = useRef<HTMLInputElement>(null);
  const set = (p: Parameters<typeof patchDevTask>[1]) => patch.mutate({ id: t.id, patch: p });
  const feitos = t.checklist.filter((i) => i.done).length;

  const remover = useMutation({
    mutationFn: () => deleteDevTask(t.id),
    onSuccess: () => {
      playSfx("remove");
      void qc.invalidateQueries({ queryKey: ["host-update"] });
      onClose();
    },
    onError: () => toast.error("Não foi possível excluir o tópico."),
  });

  const add = () => {
    const v = novo.trim();
    if (!v) return;
    playSfx("add");
    set({ checklist: [...t.checklist, { id: novoId(), text: v, done: false }] });
    setNovo("");
    novoRef.current?.focus();
  };

  const label = "mb-2 block text-xs text-muted-foreground";
  const chip = "rounded-lg border px-3 py-1.5 text-xs transition-colors";

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <header className="border-b border-white/[0.07] px-6 pb-5 pt-6 pr-14">
          <div className="glass-inset inline-flex flex-wrap gap-1 rounded-xl p-1">
            {STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.id === t.column) return;
                  playSfx(s.id === "done" ? "complete" : "click");
                  set({ column: s.id });
                }}
                className={cn("rounded-lg px-3 py-1.5 text-xs transition-colors", t.column === s.id ? s.on : "text-muted-foreground hover:text-foreground")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <DialogTitle asChild>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => titulo.trim() && titulo !== t.title && set({ title: titulo })}
              aria-label="Título do tópico"
              className="mt-4 w-full bg-transparent font-display text-xl font-semibold outline-none"
            />
          </DialogTitle>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <span className={label}>Prioridade</span>
              <div className="flex gap-2">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      playSfx("click");
                      set({ priority: p.id });
                    }}
                    className={cn(chip, t.priority === p.id ? p.on : "border-white/[0.08] text-muted-foreground hover:text-foreground")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={label}>Prazo</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={t.prazo ?? ""}
                  onChange={(e) => set({ prazo: e.target.value || null })}
                  className="h-9 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-sm outline-none [color-scheme:dark] focus:border-white/20"
                />
                {t.prazo && (
                  <button onClick={() => set({ prazo: null })} aria-label="Limpar prazo" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <span className={label}>Etiqueta</span>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    playSfx("click");
                    set({ tag: e });
                  }}
                  className={cn(chip, t.tag === e ? "border-white/20 bg-white/[0.1] text-foreground" : "border-dashed border-white/[0.1] text-muted-foreground hover:text-foreground")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={() => descricao !== t.description && set({ description: descricao })}
              rows={3}
              placeholder="Detalhes, contexto e combinados deste tópico…"
              className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 text-sm outline-none placeholder:text-ink-3 focus:border-white/20"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="size-3.5" /> Checklist
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {feitos}/{t.checklist.length}
              </span>
            </div>
            <Progresso feitos={feitos} total={t.checklist.length} />
            <ul className="mt-3 space-y-0.5">
              {t.checklist.map((i) => (
                <li key={i.id} className="group flex items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.03]">
                  <CheckBox done={i.done} onClick={() => set({ checklist: toggleItem(t, i.id) })} label={i.text} />
                  <input
                    defaultValue={i.text}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== i.text) set({ checklist: t.checklist.map((x) => (x.id === i.id ? { ...x, text: v } : x)) });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    aria-label="Texto do item"
                    className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", i.done && "text-ink-3 line-through")}
                  />
                  <button
                    onClick={() => {
                      playSfx("remove");
                      set({ checklist: t.checklist.filter((x) => x.id !== i.id) });
                    }}
                    aria-label={`Remover ${i.text}`}
                    className="grid size-7 place-items-center rounded-full text-ink-3 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                ref={novoRef}
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Adicionar item e Enter"
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 text-sm outline-none placeholder:text-ink-3 focus:border-white/20"
              />
              <button onClick={add} disabled={!novo.trim()} className="flex h-10 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
                <Plus className="size-4" /> Adicionar
              </button>
            </div>
          </div>

          <PlanningAttachments files={t.attachments} onChange={(attachments) => set({ attachments })} onBusy={setBusy} />

          <div className="flex justify-end border-t border-white/[0.07] pt-4">
            <button
              onClick={() => window.confirm(`Excluir o tópico “${t.title}”?`) && remover.mutate()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Excluir tópico
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
