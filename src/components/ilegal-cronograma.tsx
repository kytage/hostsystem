import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Flame,
  Loader2,
  Pencil,
  Plus,
  Search,
  Square,
  Target,
  Trash2,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { fetchCategorias } from "@/lib/ilegal-data";
import { getCurrentUsername } from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import {
  atualizarCronoItem,
  criarCronoItem,
  CRONO_COLUNAS,
  CRONO_PRIORIDADES,
  CRONO_TIPO_LABEL,
  defaultDataHoraInput,
  estaAtrasado,
  excluirCronoItem,
  fetchCronograma,
  isoToLocalInput,
  localInputToIso,
  moverCronoItem,
  ordenarCrono,
  salvarChecklist,
  type CronoColuna,
  type CronoItem,
  type CronoPasso,
  type CronoPrioridade,
  type CronoTipo,
} from "@/lib/ilegal-cronograma";
import { TextoFormatado } from "@/components/texto-formatado";
import { EditorTexto } from "@/components/editor-texto";

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

/** Selo de prioridade (canto do card) e botão no formulário. */
const PRIORIDADE_STYLE: Record<CronoPrioridade, string> = {
  urgente: "bg-red-600 text-white shadow-[0_0_14px_rgba(239,68,68,0.55)]",
  alta: "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40",
  normal: "bg-white/[0.07] text-muted-foreground ring-1 ring-white/10",
  baixa: "bg-white/[0.03] text-ink-3 ring-1 ring-white/[0.06]",
};

/** Cor do pontinho ao lado do nome de cada coluna. */
const COLUNA_STYLE: Record<CronoColuna, string> = {
  pendente: "bg-white/25",
  andamento: "bg-info",
  concluido: "bg-success",
};

const PROXIMA: Record<CronoColuna, CronoColuna | null> = {
  pendente: "andamento",
  andamento: "concluido",
  concluido: null,
};

const inputCls =
  "w-full rounded-xl glass-inset px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none";

interface Staff {
  username: string;
  avatar: string;
  doIlegal: boolean;
}

/** Equipe para mencionar como responsável (quem é do Ilegal aparece primeiro). */
async function fetchStaffs(): Promise<Staff[]> {
  const [{ data: perfis }, { data: areas }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("user_areas").select("user_id, area").eq("area", "ilegal"),
  ]);
  const doIlegal = new Set(((areas ?? []) as { user_id: string }[]).map((a) => a.user_id));
  return ((perfis ?? []) as { id: string; username: string; avatar_url: string | null }[])
    .filter((p) => p.username)
    .map((p) => ({ username: p.username, avatar: p.avatar_url ?? "", doIlegal: doIlegal.has(p.id) }))
    .sort(
      (a, b) =>
        Number(b.doIlegal) - Number(a.doIlegal) || a.username.localeCompare(b.username, "pt-BR"),
    );
}

interface FormState {
  titulo: string;
  descricao: string;
  tipo: CronoTipo;
  prioridade: CronoPrioridade;
  setagens: string[];
  responsaveis: string[];
  checklist: CronoPasso[];
  dataHora: string;
}

function fmtPrazo(iso: string | null, agora: number): { texto: string; tom: "atraso" | "breve" | "ok" | "nada" } {
  if (!iso) return { texto: "Sem prazo", tom: "nada" };
  const d = new Date(iso);
  const diff = d.getTime() - agora;
  const data = d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (diff < 0) return { texto: `Atrasado · ${data}`, tom: "atraso" };
  if (diff < 24 * 3600_000) {
    const h = Math.floor(diff / 3600_000);
    const m = Math.round((diff % 3600_000) / 60_000);
    return { texto: `Em ${h > 0 ? `${h}h ` : ""}${m}min · ${data}`, tom: "breve" };
  }
  return { texto: data, tom: "ok" };
}

/** Cronograma de RP do Ilegal — quadro Pendente / Andamento / Concluído. */
export function IlegalCronograma() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ item: CronoItem | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState<"todas" | CronoPrioridade>("todas");
  const [filtroResp, setFiltroResp] = useState("todos");
  const [agora, setAgora] = useState(() => Date.now());

  // atualiza "em 2h" / "atrasado" sozinho
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useRealtimeTable("ilegal_cronograma", [["ilegal-cronograma"]]);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["ilegal-cronograma"],
    queryFn: fetchCronograma,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
  });
  const { data: staffs = [] } = useQuery({
    queryKey: ["crono-staffs"],
    queryFn: fetchStaffs,
    staleTime: 5 * 60_000,
  });
  const { data: eu = "" } = useQuery({
    queryKey: ["my-username-crono"],
    queryFn: getCurrentUsername,
    staleTime: Infinity,
  });

  const setagemOptions = useMemo(
    () =>
      categorias.flatMap((c) =>
        c.orgs
          .filter((o) => o.setagem.trim())
          .map((o) => ({
            value: o.setagem,
            label: `${o.setagem} — ${o.organizacao || o.local || c.nome}`,
          })),
      ),
    [categorias],
  );
  const orgDaSetagem = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categorias) for (const o of c.orgs) if (o.setagem) m.set(o.setagem, o.organizacao);
    return m;
  }, [categorias]);
  const avatarDe = useMemo(() => new Map(staffs.map((s) => [s.username, s.avatar])), [staffs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (filtroPrioridade !== "todas" && i.prioridade !== filtroPrioridade) return false;
      if (filtroResp === "meus" && !i.responsaveis.includes(eu)) return false;
      if (filtroResp !== "todos" && filtroResp !== "meus" && !i.responsaveis.includes(filtroResp))
        return false;
      if (!q) return true;
      return [i.titulo, i.descricao, ...i.setagens, ...i.responsaveis, CRONO_TIPO_LABEL[i.tipo]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [itens, busca, filtroPrioridade, filtroResp, eu]);

  const porColuna = useMemo(() => {
    const map: Record<CronoColuna, CronoItem[]> = { pendente: [], andamento: [], concluido: [] };
    for (const i of filtrados) map[i.coluna]?.push(i);
    for (const k of Object.keys(map) as CronoColuna[]) map[k] = ordenarCrono(map[k]);
    return map;
  }, [filtrados]);

  const abertos = itens.filter((i) => i.coluna !== "concluido");
  const urgentes = abertos.filter((i) => i.prioridade === "urgente");
  const atrasados = abertos.filter((i) => estaAtrasado(i, agora));
  const meus = abertos.filter((i) => eu && i.responsaveis.includes(eu));

  const respOptions = useMemo(() => {
    const nomes = new Set<string>();
    for (const i of itens) for (const r of i.responsaveis) nomes.add(r);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["ilegal-cronograma"] });

  const mover = useMutation({
    mutationFn: ({ id, coluna }: { id: string; coluna: CronoColuna }) => moverCronoItem(id, coluna),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao mover o card."),
  });

  const excluir = useMutation({
    mutationFn: excluirCronoItem,
    onSuccess: () => {
      toast.success("Item removido.");
      invalidate();
    },
    onError: () => toast.error("Erro ao remover item (só editores do Ilegal removem)."),
  });

  const marcarPasso = useMutation({
    mutationFn: ({ item, idx }: { item: CronoItem; idx: number }) =>
      salvarChecklist(
        item.id,
        item.checklist.map((p, i) => (i === idx ? { ...p, feito: !p.feito } : p)),
      ),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao marcar o passo."),
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
          <CalendarClock className="size-4 text-sky-300" strokeWidth={1.75} />
          <h2 className="hc-titulo">Cronograma de RP</h2>
          <span className="hc-nota">Urgentes ficam no topo · arraste os cards conforme o andamento</span>
        </div>
        <button
          onClick={() => setModal({ item: null })}
          className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" /> Novo item
        </button>
      </div>

      {/* resumo: urgentes, atrasados e os meus */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <button
          onClick={() => setFiltroPrioridade(filtroPrioridade === "urgente" ? "todas" : "urgente")}
          className={cn(
            "glass hc flex items-center gap-3 p-3.5 text-left transition-colors",
            urgentes.length > 0 && "!border-red-500/50 bg-red-600/[0.12] crono-urgente",
            filtroPrioridade === "urgente" && "ring-2 ring-red-500/60",
          )}
        >
          <span
            className={cn(
              "grid size-9 place-items-center rounded-full",
              urgentes.length ? "bg-red-600 text-white" : "bg-white/[0.05] text-ink-3",
            )}
          >
            <Flame className="size-4" />
          </span>
          <span>
            <span className="block text-xl font-bold tabular-nums leading-none text-foreground">
              {urgentes.length}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Urgentes
            </span>
          </span>
        </button>
        <div
          className={cn(
            "glass hc flex items-center gap-3 p-3.5",
            atrasados.length > 0 && "!border-orange-500/40",
          )}
        >
          <span
            className={cn(
              "grid size-9 place-items-center rounded-full",
              atrasados.length ? "bg-orange-500/20 text-orange-300" : "bg-white/[0.05] text-ink-3",
            )}
          >
            <AlarmClock className="size-4" />
          </span>
          <span>
            <span className="block text-xl font-bold tabular-nums leading-none text-foreground">
              {atrasados.length}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Atrasados
            </span>
          </span>
        </div>
        <button
          onClick={() => setFiltroResp(filtroResp === "meus" ? "todos" : "meus")}
          className={cn(
            "glass hc flex items-center gap-3 p-3.5 text-left",
            filtroResp === "meus" && "ring-2 ring-sky-400/50",
          )}
        >
          <span className="grid size-9 place-items-center rounded-full bg-sky-500/15 text-sky-300">
            <UserRound className="size-4" />
          </span>
          <span>
            <span className="block text-xl font-bold tabular-nums leading-none text-foreground">
              {meus.length}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Comigo
            </span>
          </span>
        </button>
      </div>

      {/* filtros */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="campo-busca w-full sm:w-64">
          <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar título, setagem, staff..."
            aria-label="Buscar no cronograma"
          />
        </label>
        <div className="w-44">
          <MinimalSelect
            value={filtroPrioridade}
            onChange={(v) => setFiltroPrioridade(v as typeof filtroPrioridade)}
            className="pilula rounded-full"
            options={[
              { value: "todas", label: "Toda prioridade" },
              ...CRONO_PRIORIDADES.map((p) => ({ value: p.id, label: p.label })),
            ]}
          />
        </div>
        <div className="w-48">
          <MinimalSelect
            value={filtroResp}
            onChange={setFiltroResp}
            className="pilula rounded-full"
            options={[
              { value: "todos", label: "Todos os responsáveis" },
              { value: "meus", label: "Só os meus" },
              ...respOptions.map((r) => ({ value: r, label: `@${r}` })),
            ]}
          />
        </div>
        {(busca || filtroPrioridade !== "todas" || filtroResp !== "todos") && (
          <button
            onClick={() => {
              setBusca("");
              setFiltroPrioridade("todas");
              setFiltroResp("todos");
            }}
            className="pilula rounded-full"
          >
            <X className="size-3.5" /> Limpar filtros
          </button>
        )}
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
                  <span className="hc-selo tabular-nums">{lista.length}</span>
                </header>

                <div className="flex flex-1 flex-col gap-2.5">
                  {lista.length === 0 && (
                    <p className="rounded-[14px] border border-dashed border-white/[0.1] py-8 text-center text-[11px] text-muted-foreground">
                      Nada aqui
                    </p>
                  )}
                  {lista.map((item) => (
                    <CronoCard
                      key={item.id}
                      item={item}
                      agora={agora}
                      arrastando={dragId === item.id}
                      avatarDe={avatarDe}
                      orgDaSetagem={orgDaSetagem}
                      onDragStart={(e) => {
                        setDragId(item.id);
                        e.dataTransfer.setData("text/plain", item.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onEditar={() => setModal({ item })}
                      onExcluir={() => {
                        if (confirm(`Remover "${item.titulo}" do cronograma?`)) excluir.mutate(item.id);
                      }}
                      onAvancar={() => {
                        const prox = PROXIMA[item.coluna];
                        if (prox) mover.mutate({ id: item.id, coluna: prox });
                      }}
                      onPasso={(idx) => marcarPasso.mutate({ item, idx })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <CronoModal
          item={modal.item}
          eu={eu}
          staffs={staffs}
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

function CronoCard({
  item,
  agora,
  arrastando,
  avatarDe,
  orgDaSetagem,
  onDragStart,
  onDragEnd,
  onEditar,
  onExcluir,
  onAvancar,
  onPasso,
}: {
  item: CronoItem;
  agora: number;
  arrastando: boolean;
  avatarDe: Map<string, string>;
  orgDaSetagem: Map<string, string>;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onAvancar: () => void;
  onPasso: (idx: number) => void;
}) {
  const Icon = TIPO_ICON[item.tipo];
  const urgente = item.prioridade === "urgente" && item.coluna !== "concluido";
  const prazo = fmtPrazo(item.dataHora, agora);
  const atrasado = item.coluna !== "concluido" && prazo.tom === "atraso";
  const feitos = item.checklist.filter((p) => p.feito).length;
  const total = item.checklist.length;
  const [verPassos, setVerPassos] = useState(false);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "hc-dentro group relative cursor-grab p-3 transition-colors hover:!border-white/[0.14] active:cursor-grabbing",
        urgente && "crono-urgente !border-red-500/60 bg-red-600/[0.10]",
        !urgente && item.prioridade === "alta" && item.coluna !== "concluido" && "!border-orange-500/30",
        item.coluna === "concluido" && "opacity-70",
        arrastando && "opacity-50",
      )}
    >
      {urgente && (
        <div className="-mx-3 -mt-3 mb-2.5 flex items-center gap-1.5 rounded-t-[13px] bg-red-600 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white">
          <AlertTriangle className="size-3" /> Urgente
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-tight text-foreground">{item.titulo}</h4>
        <div className="flex shrink-0 items-center gap-1">
          {!urgente && item.prioridade !== "normal" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider",
                PRIORIDADE_STYLE[item.prioridade],
              )}
            >
              {CRONO_PRIORIDADES.find((p) => p.id === item.prioridade)?.label}
            </span>
          )}
          <div className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {PROXIMA[item.coluna] && (
              <button
                onClick={onAvancar}
                title={item.coluna === "pendente" ? "Mover para Em andamento" : "Marcar como concluído"}
                className="hc-seta !size-6"
              >
                <ArrowRight className="size-3" />
              </button>
            )}
            <button onClick={onEditar} title="Editar" className="hc-seta !size-6">
              <Pencil className="size-3" />
            </button>
            <button
              onClick={onExcluir}
              title="Remover"
              className="hc-seta !size-6 hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            TIPO_STYLE[item.tipo],
          )}
        >
          <Icon className="size-2.5" />
          {CRONO_TIPO_LABEL[item.tipo]}
        </span>
        {item.setagens.map((s) => (
          <span
            key={s}
            title={orgDaSetagem.get(s) || undefined}
            className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
          >
            {s}
            {orgDaSetagem.get(s) ? (
              <span className="ml-1 font-sans font-normal text-ink-3">· {orgDaSetagem.get(s)}</span>
            ) : null}
          </span>
        ))}
      </div>

      {item.descricao && (
        <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
          <TextoFormatado texto={item.descricao} />
        </p>
      )}

      {total > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setVerPassos((v) => !v)}
            className="flex w-full items-center gap-2 text-[10.5px] font-semibold text-muted-foreground"
          >
            <CheckSquare className="size-3" />
            {feitos}/{total} passos
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className="block h-full rounded-full bg-success transition-all"
                style={{ width: `${(feitos / total) * 100}%` }}
              />
            </span>
          </button>
          {verPassos && (
            <ul className="mt-1.5 space-y-1">
              {item.checklist.map((p, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => onPasso(idx)}
                    className="flex w-full items-start gap-1.5 text-left text-[11.5px] text-foreground/90"
                  >
                    {p.feito ? (
                      <CheckSquare className="mt-px size-3.5 shrink-0 text-success" />
                    ) : (
                      <Square className="mt-px size-3.5 shrink-0 text-ink-3" />
                    )}
                    <span className={cn(p.feito && "text-ink-3 line-through")}>{p.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "flex items-center gap-1 text-[10.5px]",
            atrasado
              ? "font-bold text-red-400"
              : prazo.tom === "breve" && item.coluna !== "concluido"
                ? "font-semibold text-amber-300"
                : "text-ink-3",
          )}
        >
          <AlarmClock className="size-3" />
          {item.coluna === "concluido" && item.concluidoEm
            ? `Concluído ${new Date(item.concluidoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
            : prazo.texto}
        </span>
        {item.responsaveis.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="flex -space-x-1.5">
              {item.responsaveis.slice(0, 3).map((r) => (
                <img
                  key={r}
                  src={avatarDe.get(r) || DEFAULT_AVATAR_URL}
                  alt=""
                  title={`@${r}`}
                  className="size-5 rounded-full bg-white/10 object-cover ring-2 ring-[#141414]"
                />
              ))}
            </span>
            <span className="max-w-32 truncate text-[10.5px] font-medium text-muted-foreground">
              {item.responsaveis.map((r) => `@${r}`).join(" ")}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}

function CronoModal({
  item,
  eu,
  staffs,
  setagemOptions,
  onClose,
  onSaved,
}: {
  item: CronoItem | null;
  eu: string;
  staffs: Staff[];
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
          prioridade: item.prioridade,
          setagens: item.setagens,
          responsaveis: item.responsaveis,
          checklist: item.checklist,
          dataHora: isoToLocalInput(item.dataHora),
        }
      : {
          titulo: "",
          descricao: "",
          tipo: "roleplay",
          prioridade: "normal",
          setagens: [],
          responsaveis: eu ? [eu] : [],
          checklist: [],
          dataHora: defaultDataHoraInput(),
        },
  );
  const [novoPasso, setNovoPasso] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addPasso = () => {
    const texto = novoPasso.trim();
    if (!texto) return;
    set("checklist", [...form.checklist, { texto, feito: false }]);
    setNovoPasso("");
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const criador = eu || (await getCurrentUsername());
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        prioridade: form.prioridade,
        setagens: form.setagens,
        responsaveis: form.responsaveis,
        checklist: form.checklist,
        dataHora: localInputToIso(form.dataHora),
        // quem criou o card (aparece no histórico); os responsáveis vão na lista acima
        responsavel: item?.responsavel || criador,
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
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[22px] glass-modal p-5">
        <header className="flex items-center justify-between">
          <h3 className="hc-titulo">{item ? "Editar item" : "Novo item do cronograma"}</h3>
          <button onClick={onClose} className="hc-seta">
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-4 space-y-3.5">
          <input
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Título do RP / missão"
            maxLength={140}
            className={inputCls}
          />

          <div>
            <label className="hc-sobre mb-1.5 block">Prioridade</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CRONO_PRIORIDADES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set("prioridade", p.id)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1 rounded-xl text-[12px] font-bold transition",
                    form.prioridade === p.id
                      ? PRIORIDADE_STYLE[p.id]
                      : "bg-white/[0.03] text-ink-3 ring-1 ring-white/[0.06] hover:text-foreground",
                  )}
                >
                  {p.id === "urgente" && <Flame className="size-3.5" />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="hc-sobre mb-1.5 block">Tipo</label>
              <MinimalSelect
                value={form.tipo}
                onChange={(v) => set("tipo", v as CronoTipo)}
                options={(Object.keys(CRONO_TIPO_LABEL) as CronoTipo[]).map((t) => ({
                  value: t,
                  label: CRONO_TIPO_LABEL[t],
                }))}
              />
            </div>
            <div>
              <label className="hc-sobre mb-1.5 block">Prazo</label>
              <input
                type="datetime-local"
                value={form.dataHora}
                onChange={(e) => set("dataHora", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="hc-sobre mb-1.5 block">Responsáveis</label>
            <Chips
              itens={form.responsaveis.map((r) => `@${r}`)}
              onRemover={(i) => set("responsaveis", form.responsaveis.filter((_, k) => k !== i))}
            />
            <MinimalSelect
              value=""
              onChange={(v) => v && !form.responsaveis.includes(v) && set("responsaveis", [...form.responsaveis, v])}
              placeholder="Mencionar staff..."
              options={staffs
                .filter((s) => !form.responsaveis.includes(s.username))
                .map((s) => ({
                  value: s.username,
                  label: `@${s.username}${s.doIlegal ? " · Ilegal" : ""}`,
                }))}
            />
          </div>

          <div>
            <label className="hc-sobre mb-1.5 block">Setagens envolvidas</label>
            <Chips
              itens={form.setagens}
              mono
              onRemover={(i) => set("setagens", form.setagens.filter((_, k) => k !== i))}
            />
            <MinimalSelect
              value=""
              onChange={(v) => v && !form.setagens.includes(v) && set("setagens", [...form.setagens, v])}
              placeholder="Adicionar setagem..."
              options={setagemOptions.filter((o) => !form.setagens.includes(o.value))}
            />
          </div>

          <div>
            <label className="hc-sobre mb-1.5 block">Checklist (passos)</label>
            {form.checklist.length > 0 && (
              <ul className="mb-2 space-y-1">
                {form.checklist.map((p, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-sm">
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "checklist",
                          form.checklist.map((x, k) => (k === idx ? { ...x, feito: !x.feito } : x)),
                        )
                      }
                    >
                      {p.feito ? (
                        <CheckSquare className="size-4 text-success" />
                      ) : (
                        <Square className="size-4 text-ink-3" />
                      )}
                    </button>
                    <span className={cn("flex-1", p.feito && "text-ink-3 line-through")}>{p.texto}</span>
                    <button
                      type="button"
                      onClick={() => set("checklist", form.checklist.filter((_, k) => k !== idx))}
                      className="text-ink-3 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={novoPasso}
                onChange={(e) => setNovoPasso(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPasso();
                  }
                }}
                placeholder="Ex.: Avisar líderes no Discord"
                maxLength={160}
                className={inputCls}
              />
              <button type="button" onClick={addPasso} className="pilula shrink-0 rounded-full">
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          <EditorTexto
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Descrição / roteiro do RP..."
            rows={4}
            className={cn(inputCls, "resize-y")}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="pilula rounded-full">
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

function Chips({
  itens,
  mono,
  onRemover,
}: {
  itens: string[];
  mono?: boolean;
  onRemover: (i: number) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {itens.map((t, i) => (
        <span
          key={t}
          className={cn(
            "flex items-center gap-1 rounded-full bg-white/[0.06] py-0.5 pl-2.5 pr-1 text-[12px] font-semibold text-foreground",
            mono && "font-mono",
          )}
        >
          {t}
          <button
            type="button"
            onClick={() => onRemover(i)}
            className="grid size-4 place-items-center rounded-full text-ink-3 hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
