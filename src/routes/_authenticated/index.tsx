import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  Clock,
  Code2,
  Inbox,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { MinhasPendenciasModal } from "@/components/minhas-pendencias-modal";
import { RankingPanel } from "@/components/ranking-panel";
import { fetchCards, getCurrentUsername } from "@/lib/kanban";
import { fetchDevTasks } from "@/lib/dev-tasks";
import { useRealtimeTable } from "@/lib/realtime";
import { ROLE_ORDER, useMyRole } from "@/lib/permissions";
import {
  fetchMinhasSolicitacoesAdmin,
  fetchPendenciasArea,
  marcarSolicitacaoAdminLida,
} from "@/lib/area-manager";
import { fetchEventos } from "@/lib/eventos";
import { CalendarMonth, dayKey } from "@/components/calendar-month";
import { TarefasPreview } from "@/components/home-pessoal";
import { Termometro } from "@/components/termometro";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — HOST" },
      { name: "description", content: "Visão geral do servidor: pendências, jogadores e desempenho." },
      { property: "og:title", content: "Dashboard — HOST" },
      { property: "og:description", content: "Visão geral do servidor: pendências, jogadores e desempenho." },
    ],
  }),
  component: Dashboard,
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hhmm = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useNow();

  useRealtimeTable("dev_tasks", [["dev-tasks"]]);
  useRealtimeTable("solicitacoes_admin", [["minhas-solicitacoes-admin"]]);
  useRealtimeTable("eventos", [["eventos"]]);
  useRealtimeTable("pendencias", [["pendencias-area"]]);

  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(dayKey(new Date()));

  const { data: eventos = [] } = useQuery({ queryKey: ["eventos"], queryFn: fetchEventos });
  const eventosDoDia = eventos.filter((e) => dayKey(new Date(e.dataInicio)) === selectedDay);
  const hojeKey = dayKey(new Date());
  const proximosEventos = eventos
    .filter((e) => dayKey(new Date(e.dataInicio)) > hojeKey)
    .sort((a, b) => +new Date(a.dataInicio) - +new Date(b.dataInicio))
    .slice(0, 5);

  const { data: myRole } = useMyRole();
  const isCoordinatorPlus = ROLE_ORDER.indexOf(myRole ?? "dev") <= ROLE_ORDER.indexOf("coordinator");

  const { data: caixaEntrada = [] } = useQuery({
    queryKey: ["minhas-solicitacoes-admin"],
    queryFn: fetchMinhasSolicitacoesAdmin,
    enabled: isCoordinatorPlus,
  });

  const lidaMutation = useMutation({
    mutationFn: marcarSolicitacaoAdminLida,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes-admin"] }),
  });

  const { data: tasks = [] } = useQuery({ queryKey: ["dev-tasks"], queryFn: fetchDevTasks });

  const { data: username = "" } = useQuery({
    queryKey: ["current-username"],
    queryFn: getCurrentUsername,
    staleTime: 300_000,
  });
  const { data: meusCards = [] } = useQuery({
    queryKey: ["kanban-cards"],
    queryFn: () => fetchCards(false),
    staleTime: 20_000,
  });
  const minhasAtivas = meusCards.filter((c) => c.criadoPor?.toLowerCase() === username.toLowerCase()).length;
  const emRevisao = tasks.filter((t) => t.column === "review").length;

  // Pendências aguardando aprovação (Área Manager + Ilegal) — só Coordinator+
  const { data: pendenciasArea = [] } = useQuery({
    queryKey: ["pendencias-area"],
    queryFn: fetchPendenciasArea,
    enabled: isCoordinatorPlus,
    staleTime: 20_000,
  });
  const aguardando = pendenciasArea.filter((p) => p.status === "pendente" && p.tipo === "solicitacao");
  const aguardandoIlegal = aguardando.filter((p) => p.area === "ilegal").length;
  const aguardandoManager = aguardando.length - aguardandoIlegal;

  const stats = [
    { label: "Tarefas em dev", value: tasks.length, icon: Code2, delta: "no quadro de desenvolvimento" },
    { label: "Em revisão", value: emRevisao, icon: Clock, delta: "aguardando validação" },
  ];

  const quickActions = [
    ...(isCoordinatorPlus
      ? [
          {
            label: "Aguardando aprovação",
            icon: Inbox,
            badge: aguardando.length,
            primary: true,
            title: `Manager: ${aguardandoManager} · Ilegal: ${aguardandoIlegal}`,
            onClick: () => navigate({ to: "/area-manager" }),
          },
        ]
      : []),
    {
      label: "Minhas pendências",
      icon: ClipboardList,
      badge: minhasAtivas,
      primary: !isCoordinatorPlus,
      title: "Status das minhas pendências",
      onClick: () => setStatusOpen(true),
    },
    {
      label: "Quadro de dev",
      icon: Code2,
      badge: 0,
      primary: false,
      title: "Quadro de desenvolvimento",
      onClick: () => navigate({ to: "/desenvolvimento" }),
    },
    {
      label: "Eventos",
      icon: Sparkles,
      badge: 0,
      primary: false,
      title: "Eventos e cronograma",
      onClick: () => navigate({ to: "/eventos" }),
    },
  ];

  const hora = now?.getHours() ?? 12;
  const saudacao = !now ? "Olá" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const diaSelecionado = selectedDay ? new Date(`${selectedDay}T12:00:00`) : null;

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-6 md:px-8 xl:px-10">
      {statusOpen && <MinhasPendenciasModal onClose={() => setStatusOpen(false)} />}

      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">HOST · Painel</p>
          <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.02em] md:text-[28px]">
            {saudacao}, {username || "…"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral do seu servidor FiveM</p>
        </div>
        <span className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" strokeWidth={1.7} />
          {now ? cap(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })) : "—"}
        </span>
      </header>

      {isCoordinatorPlus && caixaEntrada.length > 0 && (
        <a
          href="#caixa-entrada"
          className="glass animate-rise mt-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors hover:border-primary/30"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
          <span>
            Você tem{" "}
            <span className="font-semibold">
              {caixaEntrada.length} {caixaEntrada.length > 1 ? "solicitações administrativas" : "solicitação administrativa"}
            </span>{" "}
            na caixa de entrada.
          </span>
          <ArrowUpRight className="ml-auto size-4 text-muted-foreground" />
        </a>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        {/* Hero */}
        <section
          style={{ animationDelay: "60ms" }}
          className="glass-elevated animate-rise relative overflow-hidden rounded-[24px] p-6 md:p-7 lg:col-span-8"
        >
          <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-[28rem] rounded-full bg-primary/[0.09] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative flex flex-col gap-8 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Agora</p>
              <p className="mt-1 font-display text-[56px] font-semibold leading-none tracking-[-0.045em] tabular-nums md:text-[68px]">
                {now ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                <span className="text-ink-3">:{now ? String(now.getSeconds()).padStart(2, "0") : "--"}</span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {tasks.length} tarefas no quadro · {emRevisao} em revisão
              </p>
            </div>
            <div className="glass-inset flex min-w-0 flex-wrap justify-between gap-2 rounded-[20px] p-3 sm:justify-start sm:gap-3 sm:p-4">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  title={a.title}
                  className="group flex w-[68px] shrink-0 flex-col items-center gap-2 sm:w-[76px]"
                >
                  <span
                    className={cn(
                      "relative grid size-12 place-items-center rounded-full transition-all duration-200 group-hover:-translate-y-0.5 sm:size-14",
                      a.primary
                        ? "bg-primary text-white"
                        : "border border-white/[0.08] bg-white/[0.045] text-foreground group-hover:bg-white/[0.08]",
                    )}
                  >
                    <a.icon className="size-5" strokeWidth={1.6} />
                    {a.badge > 0 && (
                      <span
                        className={cn(
                          "absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                          a.primary ? "bg-foreground text-black" : "bg-primary text-white",
                        )}
                      >
                        {a.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-center text-[11px] leading-tight text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Ranking */}
        <div style={{ animationDelay: "120ms" }} className="animate-rise lg:col-span-4 lg:row-span-2">
          <RankingPanel variant="premium" />
        </div>

        {/* Stats */}
        {stats.map((s, i) => (
          <button
            key={s.label}
            onClick={() => navigate({ to: "/desenvolvimento" })}
            style={{ animationDelay: `${180 + i * 60}ms` }}
            className="glass surface-hover animate-rise group flex items-end justify-between rounded-[24px] p-5 text-left lg:col-span-4"
          >
            <div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <s.icon className="size-3.5" strokeWidth={1.7} /> {s.label}
              </p>
              <p className="mt-4 font-display text-5xl font-semibold leading-none tracking-[-0.045em] tabular-nums">
                {s.value}
              </p>
              <p className="mt-2 text-xs text-ink-3">{s.delta}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-muted-foreground transition-all duration-200 group-hover:border-primary/40 group-hover:text-foreground">
              <ArrowUpRight className="size-4" strokeWidth={1.7} />
            </span>
          </button>
        ))}

        {/* Calendário */}
        <section
          style={{ animationDelay: "300ms" }}
          className="glass surface-hover animate-rise rounded-[20px] p-5 lg:col-span-7"
        >
          <CalendarMonth eventos={eventos} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </section>

        {/* Agenda */}
        <section
          style={{ animationDelay: "360ms" }}
          className="glass surface-hover animate-rise flex flex-col rounded-[20px] p-5 lg:col-span-5"
        >
          <header className="flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow">{selectedDay === hojeKey ? "Eventos do dia" : "Eventos"}</p>
              <h2 className="mt-1 font-display text-lg font-semibold">
                {diaSelecionado
                  ? cap(diaSelecionado.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }))
                  : "—"}
              </h2>
            </div>
            <Link
              to="/eventos"
              aria-label="Abrir eventos e cronograma"
              className="grid size-8 shrink-0 place-items-center rounded-full border border-white/[0.08] text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <ArrowUpRight className="size-3.5" />
            </Link>
          </header>

          <div className="mt-4 space-y-2">
            {eventosDoDia.length === 0 && (
              <div className="glass-inset flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 text-center">
                <CalendarX2 className="size-5 text-ink-3" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground">Nenhum evento neste dia.</p>
              </div>
            )}
            {eventosDoDia.map((ev) => (
              <div key={ev.id} className="glass-inset rounded-2xl p-3">
                <p className="text-sm font-medium">{ev.titulo}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {hhmm(ev.dataInicio)}
                  {ev.dataFim && ` — ${hhmm(ev.dataFim)}`}
                  {ev.criadoPor && ` · ${ev.criadoPor}`}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs font-medium text-muted-foreground">Próximos eventos</p>
          <div className="mt-2 space-y-2">
            {proximosEventos.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.07] px-4 py-4 text-center text-xs text-ink-3">
                Nenhum evento futuro agendado.
              </div>
            )}
            {proximosEventos.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedDay(dayKey(new Date(ev.dataInicio)))}
                className="glass-inset w-full rounded-2xl p-3 text-left transition-colors duration-200 hover:border-white/15"
              >
                <p className="text-sm font-medium">{ev.titulo}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(ev.dataInicio).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  {" · "}
                  {hhmm(ev.dataInicio)}
                  {ev.criadoPor && ` · ${ev.criadoPor}`}
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Caixa de entrada — Solicitações Administrativas (Coordinator+) */}
      {isCoordinatorPlus && caixaEntrada.length > 0 && (
        <section id="caixa-entrada" className="glass animate-rise mt-4 rounded-[20px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Caixa de entrada</p>
              <h2 className="mt-1 font-display text-lg font-semibold">Solicitações administrativas</h2>
            </div>
            <span className="glass-inset rounded-full px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground">
              {caixaEntrada.length} pendente{caixaEntrada.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {caixaEntrada.map((s) => (
              <article key={s.id} className="glass-inset rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{s.titulo}</h3>
                    {s.descricao && (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{s.descricao}</p>
                    )}
                    {s.anexos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.anexos.map((a) => (
                          <a
                            key={a.url}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-white/[0.08]"
                          >
                            <Paperclip className="size-3" /> {a.nome}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-ink-3">
                      De <span className="font-medium text-muted-foreground">{s.criadoPor}</span> ·{" "}
                      {new Date(s.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={() => lidaMutation.mutate(s.id)}
                    disabled={lidaMutation.isPending}
                    className="shrink-0 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    Marcar como lida
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="animate-rise" style={{ animationDelay: "420ms" }}>
          <TarefasPreview />
        </div>
        <div className="animate-rise" style={{ animationDelay: "480ms" }}>
          <Termometro />
        </div>
      </div>
    </div>
  );
}
