import { useMemo, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Loader2,
  Pencil,
  Plus,
  Target,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { fetchCategorias } from "@/lib/ilegal-data";
import { getCurrentUsername } from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import {
  atualizarCronoItem,
  criarCronoItem,
  CRONO_COLUNAS,
  CRONO_TIPO_LABEL,
  defaultDataHoraInput,
  excluirCronoItem,
  fetchCronograma,
  isoToLocalInput,
  localInputToIso,
  moverCronoItem,
  type CronoColuna,
  type CronoItem,
  type CronoTipo,
} from "@/lib/ilegal-cronograma";

const TIPO_ICON: Record<CronoTipo, typeof Target> = {
  roleplay: Users,
  missao: Target,
  entrega: Truck,
};

const TIPO_STYLE: Record<CronoTipo, string> = {
  roleplay: "bg-info/15 text-info",
  missao: "bg-warning/15 text-warning",
  entrega: "bg-violet-500/15 text-violet-400",
};

/** Cor do pontinho ao lado do nome de cada coluna. */
const COLUNA_STYLE: Record<CronoColuna, string> = {
  pendente: "bg-white/25",
  andamento: "bg-info",
  concluido: "bg-success",
};

const inputCls =
  "w-full rounded-xl glass-inset px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none";

interface FormState {
  titulo: string;
  descricao: string;
  tipo: CronoTipo;
  setagem: string;
  dataHora: string;
  responsavel: string;
}

const FORM_VAZIO = (responsavel: string): FormState => ({
  titulo: "",
  descricao: "",
  tipo: "roleplay",
  setagem: "",
  dataHora: defaultDataHoraInput(),
  responsavel,
});

function fmtQuando(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cronograma de RP do Ilegal — quadro Pendente / Andamento / Concluído. */
export function IlegalCronograma() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ item: CronoItem | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useRealtimeTable("ilegal_cronograma", [["ilegal-cronograma"]]);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["ilegal-cronograma"],
    queryFn: fetchCronograma,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
  });

  const setagemOptions = useMemo(
    () =>
      categorias.flatMap((c) =>
        c.orgs.map((o) => ({
          value: o.setagem,
          label: `${o.setagem} — ${o.organizacao || o.local || c.nome}`,
        }))
      ),
    [categorias]
  );

  const porColuna = useMemo(() => {
    const map: Record<CronoColuna, CronoItem[]> = {
      pendente: [],
      andamento: [],
      concluido: [],
    };
    for (const i of itens) map[i.coluna]?.push(i);
    return map;
  }, [itens]);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ilegal-cronograma"] });

  const mover = useMutation({
    mutationFn: ({ id, coluna }: { id: string; coluna: CronoColuna }) =>
      moverCronoItem(id, coluna),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao mover o card."),
  });

  const excluir = useMutation({
    mutationFn: excluirCronoItem,
    onSuccess: () => {
      toast.success("Item removido.");
      invalidate();
    },
    onError: () => toast.error("Erro ao remover item."),
  });

  const onDrop = (e: DragEvent<HTMLDivElement>, coluna: CronoColuna) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const item = itens.find((i) => i.id === id);
    if (!item || item.coluna === coluna) return;
    mover.mutate({ id, coluna });
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1">
          <CalendarClock className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="hc-titulo">Cronograma de RP</h2>
          <span className="hc-nota">
            Arraste os cards conforme o andamento
          </span>
        </div>
        <button
          onClick={() => setModal({ item: null })}
          className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" /> Novo item
        </button>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando cronograma...
        </p>
      ) : (
        <div className="mt-4 grid gap-3.5 lg:grid-cols-3">
          {CRONO_COLUNAS.map((col) => {
            const lista = porColuna[col.id];
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, col.id)}
                className="glass hc flex min-h-52 flex-col p-4"
              >
                <header className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="hc-sobre flex items-center gap-2">
                    <span className={cn("size-1.5 rounded-full", COLUNA_STYLE[col.id])} />
                    {col.label}
                  </h3>
                  <span className="hc-selo tabular-nums">
                    {lista.length}
                  </span>
                </header>

                <div className="flex flex-1 flex-col gap-2.5">
                  {lista.length === 0 && (
                    <p className="rounded-[14px] border border-dashed border-white/[0.1] py-8 text-center text-[11px] text-muted-foreground">
                      Nada aqui
                    </p>
                  )}
                  {lista.map((item) => {
                    const Icon = TIPO_ICON[item.tipo];
                    return (
                      <article
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(item.id);
                          e.dataTransfer.setData("text/plain", item.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        className={cn(
                          "hc-dentro group cursor-grab p-3 transition-colors hover:!border-white/[0.14] active:cursor-grabbing",
                          dragId === item.id && "opacity-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold leading-tight text-foreground">
                            {item.titulo}
                          </h4>
                          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => setModal({ item })}
                              title="Editar"
                              className="hc-seta !size-6"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              onClick={() => excluir.mutate(item.id)}
                              title="Remover"
                              className="hc-seta !size-6 hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              TIPO_STYLE[item.tipo]
                            )}
                          >
                            <Icon className="size-2.5" />
                            {CRONO_TIPO_LABEL[item.tipo]}
                          </span>
                          {item.setagem && (
                            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                              {item.setagem}
                            </span>
                          )}
                        </div>

                        {item.descricao && (
                          <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
                            {item.descricao}
                          </p>
                        )}

                        <p className="mt-2 text-[10px] text-ink-3">
                          {fmtQuando(item.dataHora)}
                          {item.responsavel && ` · ${item.responsavel}`}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <CronoModal
          item={modal.item}
          setagemOptions={setagemOptions}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidate();
          }}
        />
      )}
    </section>
  );
}

function CronoModal({
  item,
  setagemOptions,
  onClose,
  onSaved,
}: {
  item: CronoItem | null;
  setagemOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    item
      ? {
          titulo: item.titulo,
          descricao: item.descricao,
          tipo: item.tipo,
          setagem: item.setagem,
          dataHora: isoToLocalInput(item.dataHora),
          responsavel: item.responsavel,
        }
      : FORM_VAZIO("")
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const salvar = useMutation({
    mutationFn: async () => {
      const responsavel = form.responsavel.trim() || (await getCurrentUsername());
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        setagem: form.tipo === "entrega" ? form.setagem : form.setagem,
        dataHora: localInputToIso(form.dataHora),
        responsavel,
      };
      if (item) await atualizarCronoItem(item.id, payload);
      else await criarCronoItem(payload);
    },
    onSuccess: () => {
      toast.success(item ? "Item atualizado." : "Item adicionado ao cronograma.");
      onSaved();
    },
    onError: () => toast.error("Erro ao salvar item."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[22px] glass-modal p-5">
        <header className="flex items-center justify-between">
          <h3 className="hc-titulo">
            {item ? "Editar item" : "Novo item do cronograma"}
          </h3>
          <button
            onClick={onClose}
            className="hc-seta"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-4 space-y-3">
          <input
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Título do RP / missão"
            maxLength={140}
            className={inputCls}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="hc-sobre mb-1.5 block">
                Tipo
              </label>
              <MinimalSelect
                value={form.tipo}
                onChange={(v) => set("tipo", v as CronoTipo)}
                options={(
                  Object.keys(CRONO_TIPO_LABEL) as CronoTipo[]
                ).map((t) => ({ value: t, label: CRONO_TIPO_LABEL[t] }))}
              />
            </div>
            <div>
              <label className="hc-sobre mb-1.5 block">
                Data e hora
              </label>
              <input
                type="datetime-local"
                value={form.dataHora}
                onChange={(e) => set("dataHora", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="hc-sobre mb-1.5 block">
              Setagem da organização
            </label>
            <MinimalSelect
              value={form.setagem}
              onChange={(v) => set("setagem", v)}
              options={[{ value: "", label: "Sem setagem" }, ...setagemOptions]}
              placeholder="Selecionar setagem..."
            />
          </div>

          <textarea
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Descrição / roteiro do RP..."
            rows={4}
            className={cn(inputCls, "resize-y")}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Cancelar
          </button>
          <button
            onClick={() => salvar.mutate()}
            disabled={!form.titulo.trim() || salvar.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {item ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
