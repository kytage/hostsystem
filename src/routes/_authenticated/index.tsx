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
import { HoshiCard } from "@/components/hoshi/hoshi-card";
import { TemasCarousel } from "@/components/temas-carousel";
import { AvisosHero } from "@/components/avisos-hero";
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

  const etapas = [
    { id: "backlog", label: "Planejado" },
    { id: "doing", label: "Em andamento" },
    { id: "review", label: "Em teste" },
    { id: "done", label: "Concluído" },
  ].map((e) => ({ ...e, n: tasks.filter((t) => t.column === e.id).length }));
  const maiorEtapa = Math.max(1, ...etapas.map((e) => e.n));
  const linhas = [
    { k: "Em revisão", v: emRevisao, icon: Clock },
    { k: "Minhas pendências ativas", v: minhasAtivas, icon: ClipboardList },
    ...(isCoordinatorPlus ? [{ k: "Aguardando aprovação", v: aguardando.length, icon: Inbox }] : []),
    { k: "Próximos eventos", v: proximosEventos.length, icon: CalendarDays },
  ];

  const hora = now?.getHours() ?? 12;
  const saudacao = !now ? "Olá" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const diaSelecionado = selectedDay ? new Date(`${selectedDay}T12:00:00`) : null;

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-6 md:px-8 xl:px-10">
      {statusOpen && <MinhasPendenciasModal onClose={() => setStatusOpen(false)} />}

      {/* Abertura editorial: saudação grande sobre imagem, relógio e ações em pílulas */}
      <section className="animate-rise relative overflow-hidden rounded-[32px] border border-white/[0.07] bg-[#050505]">
        <img src="/img/ondas.jpg" alt="" aria-hidden className="foto-metal pointer-events-none absolute inset-y-0 right-0 h-full w-[62%] object-cover" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-transparent" />
        <div className="relative flex min-h-[300px] flex-col justify-between gap-10 p-6 md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">HOST GROUP · Sistema e gestão</p>
              <h1 className="text-metal mt-3 font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] md:text-[60px]">
                {saudacao},
                <br />
                {username || "…"}
              </h1>
            </div>
            <div className="w-full text-right sm:w-auto">
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight md:text-4xl">
                {now ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                <span className="text-ink-3">:{now ? String(now.getSeconds()).padStart(2, "0") : "--"}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {now ? cap(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })) : "—"}
              </p>
              <AvisosHero />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                title={a.title}
                className={cn("pilula group", a.primary && "pilula-ativa")}
              >
                <a.icon className="size-4" strokeWidth={1.7} />
                {a.label}
                {a.badge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-white">{a.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {isCoordinatorPlus && caixaEntrada.length > 0 && (
        <a href="#caixa-entrada" className="glass animate-rise mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
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

      <HoshiCard />

      {/* Operação em números (um bloco só, sem cartões repetidos) + atalhos em carrossel */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <section className="metal animate-rise rounded-[28px] p-6 lg:col-span-5" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Operação agora</p>
            <button onClick={() => navigate({ to: "/desenvolvimento" })} aria-label="Abrir quadro de desenvolvimento" className="grid size-8 place-items-center rounded-full border border-white/[0.08] text-muted-foreground transition-colors hover:text-foreground">
              <ArrowUpRight className="size-3.5" />
            </button>
          </div>
          <p className="text-metal mt-5 font-display text-[76px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{tasks.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">tarefas no quadro de desenvolvimento</p>

          {/* distribuição por etapa */}
          <div className="mt-6 flex h-16 items-end gap-2" role="img" aria-label="Tarefas por etapa">
            {etapas.map((e) => (
              <div key={e.id} className="flex h-full flex-1 items-end">
                <div className="barra-cresce w-full rounded-t-md bg-gradient-to-t from-white/10 to-white/60" style={{ height: `${Math.max(6, (e.n / maiorEtapa) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-center text-[10.5px] text-ink-3">
            {etapas.map((e) => (
              <span key={e.id} className="flex-1">
                <span className="block tabular-nums text-foreground/80">{e.n}</span>
                {e.label}
              </span>
            ))}
          </div>

          <dl className="mt-6 divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {linhas.map((l) => (
              <div key={l.k} className="flex items-center gap-3 py-3 text-sm">
                <l.icon className="size-4 text-ink-3" strokeWidth={1.6} />
                <dt className="text-muted-foreground">{l.k}</dt>
                <dd className="ml-auto font-display text-lg font-semibold tabular-nums">{l.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* coluna da direita: atalhos em cima e ranking embaixo, ocupando a mesma altura do bloco ao lado */}
        <div className="animate-rise flex flex-col gap-4 lg:col-span-7" style={{ animationDelay: "140ms" }}>
          <TemasCarousel />
          <div className="flex-1 [&>*]:h-full">
            <RankingPanel variant="premium" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
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
