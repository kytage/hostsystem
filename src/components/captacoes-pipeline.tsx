import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Copy,
  LayoutGrid,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
  Users,
  Video,
  X,
  Handshake,
  Hourglass,
  PackageCheck,
} from "lucide-react";
import { Indice, Indices } from "@/components/indice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createReuniao,
  deleteCaptacao,
  deleteReuniao,
  fetchCaptacoes,
  fetchReunioes,
  moverCaptacao,
  STATUS_LABELS,
  TIPO_LABELS,
  type Captacao,
  type CaptacaoStatus,
  type CaptacaoTipo,
} from "@/lib/captacoes";
import { CaptacaoDialog, type CaptacaoPrefill } from "@/components/captacao-dialog";
import { toast } from "sonner";

const COLUNAS: { id: CaptacaoStatus; cor: string }[] = [
  { id: "pendente", cor: "bg-yellow-400" },
  { id: "aguardando", cor: "bg-orange-400" },
  { id: "aceito", cor: "bg-blue-400" },
  { id: "entregue", cor: "bg-violet-400" },
];

const TIPO_CORES: Record<CaptacaoTipo, string> = {
  pvp: "bg-violet-500/15 text-violet-400",
  hibrido: "bg-emerald-500/15 text-emerald-400",
  p1_crew: "bg-blue-500/15 text-blue-400",
};

function dataSP(iso: string): Date {
  return new Date(iso);
}

function labelDia(iso: string): { dia: string; mes: string; semana: string; hoje: boolean } {
  const d = dataSP(iso);
  const agora = new Date();
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hoje = fmt.format(d) === fmt.format(agora);
  return {
    dia: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" }).format(d),
    mes: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }).format(d).replace(".", ""),
    semana: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(d).replace(".", "").toUpperCase(),
    hoje,
  };
}

function horaSP(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(dataSP(iso));
}

interface Props {
  prefill: CaptacaoPrefill | null;
  onPrefillConsumed: () => void;
  novaAberta: boolean;
  onNovaChange: (aberta: boolean) => void;
}

export function CaptacoesPipeline({ prefill, onPrefillConsumed, novaAberta, onNovaChange }: Props) {
  const qc = useQueryClient();
  const [visao, setVisao] = useState<"kanban" | "tabela">("kanban");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<CaptacaoTipo | "todos">("todos");
  const [filtroCaptador, setFiltroCaptador] = useState<string>("todos");
  const [editando, setEditando] = useState<Captacao | null>(null);
  const [reuniaoPara, setReuniaoPara] = useState<Captacao | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CaptacaoStatus | null>(null);

  const { data: captacoes } = useQuery({ queryKey: ["captacoes"], queryFn: fetchCaptacoes });
  const { data: reunioes } = useQuery({ queryKey: ["captacoes-reunioes"], queryFn: fetchReunioes });

  const mover = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CaptacaoStatus }) =>
      moverCaptacao(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["captacoes"] }),
    onError: () => toast.error("Falha ao mover captação"),
  });

  const excluir = useMutation({
    mutationFn: deleteCaptacao,
    onSuccess: () => {
      toast.success("Captação removida");
      void qc.invalidateQueries({ queryKey: ["captacoes"] });
    },
    onError: () => toast.error("Falha ao remover"),
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (captacoes ?? []).filter(
      (c) =>
        (filtroTipo === "todos" || c.tipo === filtroTipo) &&
        (filtroCaptador === "todos" || c.captador === filtroCaptador) &&
        (!q ||
          c.organizacao.toLowerCase().includes(q) ||
          c.lider.toLowerCase().includes(q) ||
          c.contato.toLowerCase().includes(q)),
    );
  }, [captacoes, busca, filtroTipo, filtroCaptador]);

  const captadores = useMemo(
    () => [...new Set((captacoes ?? []).map((c) => c.captador).filter(Boolean))],
    [captacoes],
  );

  const agora = new Date();
  const reunioesFuturas = (reunioes ?? [])
    .filter((r) => new Date(r.dataHora) >= new Date(agora.getTime() - 3 * 3600_000))
    .slice(0, 4);
  const reunioesSemana = (reunioes ?? []).filter((r) => {
    const d = new Date(r.dataHora);
    return d >= agora && d.getTime() - agora.getTime() < 7 * 86400_000;
  });

  const kpis = [
    {
      label: "Em negociação",
      valor: (captacoes ?? []).filter((c) => c.status === "pendente" || c.status === "aguardando").length,
      sub: `${(captacoes ?? []).filter((c) => c.status === "pendente").length} pendentes, ${(captacoes ?? []).filter((c) => c.status === "aguardando").length} aguardando`,
      destaque: true,
      icone: Handshake,
    },
    {
      label: "Reuniões na semana",
      valor: reunioesSemana.length,
      sub: reunioesFuturas[0]
        ? `Próxima ${labelDia(reunioesFuturas[0].dataHora).hoje ? "hoje" : `${labelDia(reunioesFuturas[0].dataHora).dia}/${labelDia(reunioesFuturas[0].dataHora).mes}`} às ${horaSP(reunioesFuturas[0].dataHora)}`
        : "Nenhuma agendada",
      icone: CalendarDays,
    },
    {
      label: "Aguardando resposta",
      valor: (captacoes ?? []).filter((c) => c.status === "aguardando").length,
      sub: (captacoes ?? []).find((c) => c.status === "aguardando")?.organizacao ?? "—",
      icone: Hourglass,
    },
    {
      label: "A entregar",
      valor: (captacoes ?? []).filter((c) => c.status === "aceito").length,
      sub: (captacoes ?? []).some((c) => c.status === "aceito") ? "Org aceitou a proposta" : "Nenhuma aceita ainda",
      icone: PackageCheck,
    },
  ];

  const porColuna = (s: CaptacaoStatus) => filtradas.filter((c) => c.status === s);
  const negadas = filtradas.filter((c) => c.status === "negado");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3.5">
      {/* números das captações, no padrão da tela inicial */}
      <Indices>
        {kpis.map((k) => (
          <Indice
            key={k.label}
            valor={k.valor}
            titulo={k.label}
            nota={k.sub}
            icone={k.icone}
            alerta={Boolean(k.destaque) && k.valor > 0}
          />
        ))}
      </Indices>

      {/* Próximas reuniões */}
      <section className="glass hc p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-3">
            <span className="hc-icone">
              <CalendarDays className="size-4" strokeWidth={1.75} />
            </span>
            <span className="hc-titulo truncate">Próximas reuniões</span>
            <span className="hc-selo tabular-nums">{reunioesFuturas.length}</span>
          </h2>
          <button
            type="button"
            onClick={() => {
              const primeira = (captacoes ?? []).find((c) => c.status !== "entregue" && c.status !== "negado");
              if (primeira) setReuniaoPara(primeira);
              else toast.info("Crie uma captação primeiro");
            }}
            className="hc-pilula shrink-0"
          >
            <CalendarDays className="size-3.5" /> Agendar reunião
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reunioesFuturas.map((r) => {
            const cap = (captacoes ?? []).find((c) => c.id === r.captacaoId);
            const d = labelDia(r.dataHora);
            return (
              <div key={r.id} className="hc-dentro flex gap-3 p-3">
                <div
                  className={cn(
                    "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2",
                    // hoje ganha um fio vermelho, como no calendário da tela inicial
                    d.hoje ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_rgba(206,14,14,0.8)]" : "bg-muted text-foreground",
                  )}
                >
                  <span className="text-[9px] font-semibold">{d.hoje ? "HOJE" : d.semana}</span>
                  <span className="text-xl font-semibold leading-none font-display">{d.dia}</span>
                  <span className="text-[9px]">{d.mes}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {cap?.organizacao ?? "Reunião"}
                    </p>
                    {cap && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-semibold", TIPO_CORES[cap.tipo])}>
                        {TIPO_LABELS[cap.tipo]}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {horaSP(r.dataHora)} • <Video className="size-3" /> {r.meio}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.comQuem}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="size-3" /> {r.participantes || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  title="Remover reunião"
                  onClick={() => {
                    void deleteReuniao(r.id).then(() => {
                      toast.success("Reunião removida");
                      void qc.invalidateQueries({ queryKey: ["captacoes-reunioes"] });
                    });
                  }}
                  className="hc-seta !size-7 self-start hover:!border-destructive/40 hover:!bg-destructive/15 hover:!text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const primeira = (captacoes ?? []).find((c) => c.status !== "entregue" && c.status !== "negado");
              if (primeira) setReuniaoPara(primeira);
              else toast.info("Crie uma captação primeiro");
            }}
            className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-white/[0.1] text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <CalendarDays className="size-5" />
            <span className="text-xs font-semibold">Marcar reunião</span>
            <span className="text-[10px]">Escolha uma org do pipeline</span>
          </button>
        </div>
      </section>

      {/* Pipeline */}
      <section className="glass hc p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="flex min-w-0 items-center gap-3">
            <span className="hc-icone">
              <LayoutGrid className="size-4" strokeWidth={1.75} />
            </span>
            <span className="hc-titulo truncate">Pipeline</span>
            <span className="hc-selo tabular-nums">{filtradas.length}</span>
          </h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="segmentos" role="group" aria-label="Como mostrar o pipeline">
              <button
                type="button"
                aria-pressed={visao === "kanban"}
                onClick={() => setVisao("kanban")}
              >
                <LayoutGrid className="size-3.5" /> Kanban
              </button>
              <button
                type="button"
                aria-pressed={visao === "tabela"}
                onClick={() => setVisao("tabela")}
              >
                <Table2 className="size-3.5" /> Tabela
              </button>
            </div>
            <button
              type="button"
              onClick={() => onNovaChange(true)}
              className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> Nova captação
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="campo-busca w-56">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar org, líder ou contato"
              aria-label="Buscar captação"
            />
          </label>
          <div className="segmentos" role="group" aria-label="Filtrar por tipo">
            {(["todos", "p1_crew", "hibrido", "pvp"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={filtroTipo === t}
                onClick={() => setFiltroTipo(t)}
              >
                {t === "todos" ? "Todos" : TIPO_LABELS[t]}
              </button>
            ))}
          </div>
          <select
            value={filtroCaptador}
            onChange={(e) => setFiltroCaptador(e.target.value)}
            className="h-9 rounded-full border border-input bg-transparent px-3 text-[12.5px] text-foreground"
          >
            <option value="todos">Captador: Todos</option>
            {captadores.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {visao === "kanban" ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {COLUNAS.map((col) => (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.id);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) {
                    const cap = (captacoes ?? []).find((c) => c.id === dragId);
                    if (cap && cap.status !== col.id)
                      mover.mutate({ id: dragId, status: col.id });
                  }
                  setDragId(null);
                  setOverCol(null);
                }}
                className={cn(
                  "hc-dentro flex w-60 shrink-0 flex-col gap-2 p-2 transition-colors",
                  overCol === col.id && "!border-foreground/25 !bg-foreground/[0.06]",
                )}
              >
                <div className="flex items-center gap-2 px-1 pt-0.5">
                  <span className={cn("size-2 shrink-0 rounded-full", col.cor)} />
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{STATUS_LABELS[col.id]}</p>
                  <span className="hc-selo ml-auto shrink-0 tabular-nums">
                    {porColuna(col.id).length}
                  </span>
                </div>
                {porColuna(col.id).map((c) => (
                  <CardCaptacao
                    key={c.id}
                    c={c}
                    onEdit={() => setEditando(c)}
                    onDelete={() => {
                      if (window.confirm(`Remover a captação de ${c.organizacao}?`))
                        excluir.mutate(c.id);
                    }}
                    onReuniao={() => setReuniaoPara(c)}
                    dragProps={{
                      draggable: true,
                      onDragStart: () => setDragId(c.id),
                      onDragEnd: () => {
                        setDragId(null);
                        setOverCol(null);
                      },
                    }}
                  />
                ))}
                {porColuna(col.id).length === 0 && (
                  <div className="flex min-h-16 items-center justify-center rounded-xl border border-dashed border-white/[0.1] px-2 text-center text-[10.5px] text-muted-foreground">
                    {col.id === "aceito"
                      ? "Arraste para cá quando a org aceitar"
                      : col.id === "entregue"
                        ? "Org já assumiu a vaga"
                        : "Vazio"}
                  </div>
                )}
              </div>
            ))}
            {/* Negado */}
            <div className="hc-dentro flex w-40 shrink-0 flex-col gap-2 p-2">
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <span className="size-2 shrink-0 rounded-full bg-destructive" />
                <p className="truncate text-[12.5px] font-semibold text-foreground">Negado</p>
                <span className="hc-selo ml-auto shrink-0 tabular-nums">{negadas.length}</span>
              </div>
              {negadas.map((c) => (
                <CardCaptacao
                  key={c.id}
                  c={c}
                  compact
                  onEdit={() => setEditando(c)}
                  onDelete={() => {
                    if (window.confirm(`Remover a captação de ${c.organizacao}?`))
                      excluir.mutate(c.id);
                  }}
                  onReuniao={() => setReuniaoPara(c)}
                  dragProps={{
                    draggable: true,
                    onDragStart: () => setDragId(c.id),
                    onDragEnd: () => setDragId(null),
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  <th className="py-2 pr-3">Organização</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Líder</th>
                  <th className="py-2 pr-3">Vaga</th>
                  <th className="py-2 pr-3">Captador</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.03]">
                    <td className="py-2 pr-3 font-semibold text-foreground">{c.organizacao}</td>
                    <td className="py-2 pr-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TIPO_CORES[c.tipo])}>
                        {TIPO_LABELS[c.tipo]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.lider || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.local || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.captador || "—"}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={c.status}
                        onChange={(e) =>
                          mover.mutate({ id: c.id, status: e.target.value as CaptacaoStatus })
                        }
                        className="rounded-full border border-input bg-transparent px-2.5 py-1 text-[11px] text-foreground"
                      >
                        {(Object.keys(STATUS_LABELS) as CaptacaoStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditando(c)}
                        className="hc-seta !size-7 ml-auto"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <p className="mt-3 rounded-[14px] border border-dashed border-white/[0.1] px-4 py-6 text-center text-xs text-muted-foreground">
                Nenhuma captação encontrada.
              </p>
            )}
          </div>
        )}
      </section>

      <CaptacaoDialog
        open={novaAberta || !!prefill}
        onClose={() => {
          onNovaChange(false);
          onPrefillConsumed();
        }}
        prefill={prefill ?? undefined}
      />
      {editando && (
        <CaptacaoDialog open onClose={() => setEditando(null)} captacao={editando} />
      )}
      {reuniaoPara && (
        <ReuniaoDialog
          captacao={reuniaoPara}
          captacoes={captacoes ?? []}
          onTrocar={setReuniaoPara}
          onClose={() => setReuniaoPara(null)}
        />
      )}
    </div>
  );
}

/* ---------- Card do pipeline ---------- */

function CardCaptacao({
  c,
  compact,
  onEdit,
  onDelete,
  onReuniao,
  dragProps,
}: {
  c: Captacao;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReuniao: () => void;
  dragProps: React.HTMLAttributes<HTMLDivElement> & { draggable: boolean };
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div
      {...dragProps}
      className={cn(
        "hc-dentro cursor-grab p-2.5 transition-colors hover:!border-foreground/15 active:cursor-grabbing",
        c.status === "negado" && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-semibold", TIPO_CORES[c.tipo])}>
          {TIPO_LABELS[c.tipo]}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            className="hc-seta !size-6"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
          {menu && (
            <div className="glass-modal absolute right-0 top-7 z-20 w-36 rounded-[14px] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-foreground hover:bg-muted"
              >
                <Pencil className="size-3" /> Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onReuniao();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-foreground hover:bg-muted"
              >
                <CalendarDays className="size-3" /> Agendar reunião
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3" /> Remover
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{c.organizacao}</p>
      {!compact && (
        <>
          {c.lider && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="size-3" /> {c.lider} <span className="italic">líder</span>
            </p>
          )}
          {c.contato && (
            <button
              type="button"
              title="Copiar contato"
              onClick={() => {
                void navigator.clipboard.writeText(c.contato);
                toast.success("Contato copiado");
              }}
              className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {c.contato.length > 14 ? `${c.contato.slice(0, 4)}…${c.contato.slice(-4)}` : c.contato}
              <Copy className="size-3" />
            </button>
          )}
          {c.local && (
            <p className="mt-1.5 flex min-w-0 items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{c.local}</span>
            </p>
          )}
          {c.onlineEsperado && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="size-3 shrink-0" /> {c.onlineEsperado}
            </p>
          )}
          {c.observacao && (
            <p className="mt-1.5 line-clamp-2 border-l-2 border-foreground/15 pl-2 text-[10px] italic text-muted-foreground">
              {c.observacao}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {c.captador && (
                <span className="flex items-center gap-1">
                  <span className="flex size-4 items-center justify-center rounded-full bg-foreground/15 text-[8px] font-semibold text-foreground">
                    {c.captador.slice(0, 1).toUpperCase()}
                  </span>
                  {c.captador}
                </span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Dialog de reunião ---------- */

function ReuniaoDialog({
  captacao,
  captacoes,
  onTrocar,
  onClose,
}: {
  captacao: Captacao;
  captacoes: Captacao[];
  onTrocar: (c: Captacao) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const agora = new Date();
  agora.setHours(21, 0, 0, 0);
  const padrao = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [dataHora, setDataHora] = useState(padrao);
  const [meio, setMeio] = useState("Call no Discord");
  const [comQuem, setComQuem] = useState(
    captacao.lider ? `Com ${captacao.lider}, líder da org` : "",
  );
  const [participantes, setParticipantes] = useState("");

  const salvar = useMutation({
    mutationFn: () =>
      createReuniao({
        captacaoId: captacao.id,
        dataHora: new Date(dataHora).toISOString(),
        meio,
        comQuem,
        participantes,
      }),
    onSuccess: () => {
      toast.success("Reunião agendada");
      void qc.invalidateQueries({ queryKey: ["captacoes-reunioes"] });
      onClose();
    },
    onError: () => toast.error("Falha ao agendar"),
  });

  const inputCls =
    "w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "hc-sobre mb-1.5 block";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="hc-titulo">Agendar reunião</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Organização</label>
            <select
              className={inputCls}
              value={captacao.id}
              onChange={(e) => {
                const c = captacoes.find((x) => x.id === e.target.value);
                if (c) onTrocar(c);
              }}
            >
              {captacoes
                .filter((c) => c.status !== "entregue" && c.status !== "negado")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.organizacao}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data e horário</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Meio</label>
            <input className={inputCls} value={meio} onChange={(e) => setMeio(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Com quem</label>
            <input
              className={inputCls}
              value={comQuem}
              onChange={(e) => setComQuem(e.target.value)}
              placeholder="Ex.: Com Nevez, líder da org"
            />
          </div>
          <div>
            <label className={labelCls}>Participantes HOST</label>
            <input
              className={inputCls}
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              placeholder="Ex.: henrique e palestino"
            />
          </div>
          <button
            type="button"
            disabled={!dataHora || salvar.isPending}
            onClick={() => salvar.mutate()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            Agendar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
