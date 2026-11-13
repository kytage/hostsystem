import { RichTextarea } from "@/components/rich-textarea";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, CheckCircle2, ListTodo, Loader2, PencilLine, Plus, X } from "lucide-react";
import { addTarefa, confirmarReuniao, fetchTarefas, type TipoTarefa } from "@/lib/tarefas";
import { playPlim } from "@/lib/cutucar";

/** yyyy-mm-dd do dia atual, no fuso local. */
function hojeISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function horaAgora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ------------------------- Pop-up de criação rápida ------------------------- */

function NovaPendenciaDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoTarefa>("tarefa");
  const [data, setData] = useState(hojeISO());
  const [hora, setHora] = useState(horaAgora());
  const [descricao, setDescricao] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      addTarefa(titulo.trim(), descricao.trim(), {
        tipo,
        reuniaoAt: tipo === "reuniao" ? new Date(`${data}T${hora}`).toISOString() : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tarefas-particulares"] });
      onClose();
    },
  });

  const valido = titulo.trim().length > 0 && (tipo === "tarefa" || (!!data && !!hora));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[22px] glass-modal p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hc-icone">
              <PencilLine className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="hc-titulo">Nova pendência particular</h2>
              <p className="hc-nota mt-0.5">
                Vai direto para o seu quadro de tarefas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título..."
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-white/30"
          />

          <div className="segmentos w-full" role="group" aria-label="Tipo da pendência">
            {(
              [
                { key: "tarefa" as TipoTarefa, label: "Tarefa", icon: ListTodo },
                { key: "reuniao" as TipoTarefa, label: "Reunião", icon: CalendarClock },
              ]
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={tipo === o.key}
                onClick={() => setTipo(o.key)}
                className="flex-1 justify-center"
              >
                <o.icon className="size-3.5" /> {o.label}
              </button>
            ))}
          </div>

          {tipo === "reuniao" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-white/30"
              />
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-white/30"
              />
            </div>
          )}

          <RichTextarea
            value={descricao}
            onChange={setDescricao}
            placeholder="Descrição (opcional)"
            inputClassName="min-h-20 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-white/30"
          />

          {addMutation.isError && (
            <p className="text-xs font-semibold text-destructive">
              Não foi possível adicionar. Tente novamente.
            </p>
          )}

          <button
            onClick={() => addMutation.mutate()}
            disabled={!valido || addMutation.isPending}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {addMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Alarme de reuniões --------------------------- */

function ReuniaoAlarme() {
  const queryClient = useQueryClient();
  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas-particulares"],
    queryFn: fetchTarefas,
    refetchInterval: 60_000,
  });

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const vencidas = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          t.tipo === "reuniao" &&
          !t.reuniaoConfirmada &&
          t.coluna !== "concluido" &&
          t.reuniaoAt !== null &&
          new Date(t.reuniaoAt).getTime() <= agora
      ),
    [tarefas, agora]
  );

  const ativa = vencidas[0] ?? null;
  const somRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificadasRef = useRef<Set<string>>(new Set());

  // Pede permissão de notificação do navegador (uma vez), para avisar
  // mesmo com a aba em segundo plano.
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  // Dispara notificação nativa do navegador uma vez por reunião vencida.
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const t of vencidas) {
      if (notificadasRef.current.has(t.id)) continue;
      notificadasRef.current.add(t.id);
      const hora = t.reuniaoAt
        ? new Date(t.reuniaoAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "";
      const n = new Notification("Reunião agora", {
        body: `${t.titulo}${hora ? ` — ${hora}` : ""}`,
        tag: `reuniao-${t.id}`,
      });
      n.onclick = () => window.focus();
    }
  }, [vencidas]);

  useEffect(() => {
    if (!ativa) {
      if (somRef.current) clearInterval(somRef.current);
      somRef.current = null;
      return;
    }
    playPlim();
    somRef.current = setInterval(playPlim, 6000);
    return () => {
      if (somRef.current) clearInterval(somRef.current);
      somRef.current = null;
    };
  }, [ativa?.id]);

  const confirmar = useMutation({
    mutationFn: (id: string) => confirmarReuniao(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas-particulares"] }),
  });

  if (!ativa) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[110] w-[min(92vw,26rem)] -translate-x-1/2 rounded-[22px] border !border-primary/50 glass-modal p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <BellRing className="size-4 animate-pulse" /> Reunião agora
      </p>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{ativa.titulo}</p>
      {ativa.reuniaoAt && (
        <p className="text-xs text-muted-foreground">
          {new Date(ativa.reuniaoAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
      <button
        onClick={() => confirmar.mutate(ativa.id)}
        disabled={confirmar.isPending}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {confirmar.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Reunião confirmada
      </button>
    </div>
  );
}

/* ------------------------------ Botão (lápis) ------------------------------ */

export function QuickPendenciaButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nova pendência particular"
        title="Nova pendência particular"
        data-sem-elastico
        className="grid size-8 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
      >
        <PencilLine className="size-[15px]" strokeWidth={1.6} />
      </button>
      {open && <NovaPendenciaDialog onClose={() => setOpen(false)} />}
      <ReuniaoAlarme />
    </>
  );
}
