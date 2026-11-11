import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  Code2,
  Inbox,
  Paperclip,
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
import { HokiCard } from "@/components/hoki/hoki-card";
import { AtalhosCard } from "@/components/atalhos-card";
import { AvisosHero } from "@/components/avisos-hero";
import { OrganizacoesDestaque } from "@/components/organizacoes-destaque";
import { cn } from "@/lib/utils";
import { CartaoAndamento, CartaoMovimento } from "@/components/home-graficos";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — HOST" },
      {
        name: "description",
        content: "Visão geral do servidor: pendências, jogadores e desempenho.",
      },
      { property: "og:title", content: "Dashboard — HOST" },
      {
        property: "og:description",
        content: "Visão geral do servidor: pendências, jogadores e desempenho.",
      },
    ],
  }),
  component: Dashboard,
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hhmm = (d: string) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Barrinhas em pé, uma por item (até `maximo`). Sem itens, fica um trilho apagado. */
function Tiques({ n, cor, maximo = 12 }: { n: number; cor: string; maximo?: number }) {
  const total = Math.min(n, maximo);
  return (
    <span className="tiques" aria-hidden>
      {Array.from({ length: total || 6 }, (_, i) => (
        <i
          key={i}
          style={{
            height: `${48 + ((i * 37) % 52)}%`,
            animationDelay: `${i * 28}ms`,
            ...(total ? { background: cor } : {}),
          }}
        />
      ))}
    </span>
  );
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
  const isCoordinatorPlus =
    ROLE_ORDER.indexOf(myRole ?? "dev") <= ROLE_ORDER.indexOf("coordinator");

  const { data: caixaEntrada = [] } = useQuery({
    queryKey: ["minhas-solicitacoes-admin"],
    queryFn: fetchMinhasSolicitacoesAdmin,
    enabled: isCoordinatorPlus,
  });

  const lidaMutation = useMutation({
    mutationFn: marcarSolicitacaoAdminLida,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes-admin"] }),
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
  const minhasAtivas = meusCards.filter(
    (c) => c.criadoPor?.toLowerCase() === username.toLowerCase(),
  ).length;
  const emRevisao = tasks.filter((t) => t.column === "review").length;

  // Pendências aguardando aprovação (Área Manager + Ilegal) — só Coordinator+
  const { data: pendenciasArea = [] } = useQuery({
    queryKey: ["pendencias-area"],
    queryFn: fetchPendenciasArea,
    enabled: isCoordinatorPlus,
    staleTime: 20_000,
  });
  const aguardando = pendenciasArea.filter(
    (p) => p.status === "pendente" && p.tipo === "solicitacao",
  );
  const aguardandoIlegal = aguardando.filter((p) => p.area === "ilegal").length;
  const aguardandoManager = aguardando.length - aguardandoIlegal;

  const etapas = [
    { id: "backlog", label: "Planejado" },
    { id: "doing", label: "Em andamento" },
    { id: "review", label: "Em teste" },
    { id: "done", label: "Concluído" },
  ].map((e) => ({ ...e, n: tasks.filter((t) => t.column === e.id).length }));

  // movimento: quando os pedidos chegaram e quando foram concluídos
  const datasNovas = isCoordinatorPlus
    ? pendenciasArea.filter((p) => p.tipo === "solicitacao").map((p) => p.createdAt)
    : meusCards.map((c) => c.createdAt);
  const datasConcluidas = meusCards.flatMap((c) => (c.concluidoAt ? [c.concluidoAt] : []));

  // quadros do topo: o que pede atenção, com o caminho de cada um
  const proximo = proximosEventos[0];
  const quadros = [
    ...(isCoordinatorPlus
      ? [
          {
            titulo: "Aguardando aprovação",
            valor: aguardando.length,
            icon: Inbox,
            cor: "#ff5a4d",
            alerta: true,
            sub: `Manager ${aguardandoManager} · Ilegal ${aguardandoIlegal}`,
            dica: "Abrir as solicitações",
            onClick: () => void navigate({ to: "/area-manager" }),
          },
        ]
      : []),
    {
      titulo: "Minhas pendências",
      valor: minhasAtivas,
      icon: ClipboardList,
      cor: "#f0a04b",
      alerta: false,
      sub: "ativas no quadro",
      dica: "Ver o status das minhas pendências",
      onClick: () => setStatusOpen(true),
    },
    {
      titulo: "Quadro de dev",
      valor: tasks.length,
      icon: Code2,
      cor: "#e4e4e7",
      alerta: false,
      sub: `${emRevisao} em revisão`,
      dica: "Abrir o quadro de desenvolvimento",
      onClick: () => void navigate({ to: "/desenvolvimento" }),
    },
    {
      titulo: "Próximos eventos",
      valor: proximosEventos.length,
      icon: CalendarDays,
      cor: "#7ee787",
      alerta: false,
      sub: proximo ? proximo.titulo : "nenhum marcado",
      dica: "Abrir eventos e cronograma",
      onClick: () => void navigate({ to: "/eventos" }),
    },
  ];
  const pedindo = (isCoordinatorPlus ? aguardando.length : 0) + minhasAtivas;

  const hora = now?.getHours() ?? 12;
  const saudacao = !now ? "Olá" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const diaSelecionado = selectedDay ? new Date(`${selectedDay}T12:00:00`) : null;

  return (
    <div className="pagina">
      {statusOpen && <MinhasPendenciasModal onClose={() => setStatusOpen(false)} />}

      {/* 1º bloco: o que pede você agora (cada quadro leva direto ao lugar) e o quadro de avisos */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
        <section className="glass relative overflow-hidden rounded-[24px] p-4">
          <span aria-hidden className="pontilhado opacity-50" />
          <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[21px] font-semibold tracking-[-0.02em]">
                {saudacao}, {username || "…"}{" "}
                <span className="font-normal text-muted-foreground">
                  {pedindo > 0
                    ? `· ${pedindo} ${pedindo > 1 ? "itens pedem" : "item pede"} você`
                    : "· tudo em dia"}
                </span>
              </h1>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {now
                  ? cap(
                      now.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }),
                    )
                  : "—"}
              </p>
            </div>
            <OrganizacoesDestaque />
          </div>
          <div className="relative mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
            {quadros.map((q, n) => (
              <button
                key={q.titulo}
                onClick={q.onClick}
                title={q.dica}
                className="glass-inset surge group w-full rounded-2xl border p-3 text-left"
                style={{ animationDelay: `${120 + n * 60}ms` }}
              >
                <span className="flex items-center gap-2.5">
                  <span className="icone-quadro size-8 text-foreground/90">
                    <q.icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    {q.titulo}
                  </span>
                  <span
                    className={cn(
                      "font-display text-[17px] font-semibold tabular-nums",
                      q.alerta && q.valor > 0 ? "text-[#ff5a4d]" : "text-foreground",
                    )}
                  >
                    {q.valor}
                  </span>
                </span>
                <span className="mt-2.5 flex items-center gap-2.5">
                  <Tiques n={q.valor} cor={q.cor} />
                  <span className="min-w-0 truncate text-[11.5px] text-ink-3">{q.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <AvisosHero />
      </div>

      {isCoordinatorPlus && caixaEntrada.length > 0 && (
        <a
          href="#caixa-entrada"
          className="glass animate-rise mt-3 flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
          <span>
            Você tem{" "}
            <span className="font-semibold">
              {caixaEntrada.length}{" "}
              {caixaEntrada.length > 1
                ? "solicitações administrativas"
                : "solicitação administrativa"}
            </span>{" "}
            na caixa de entrada.
          </span>
          <ArrowUpRight className="ml-auto size-4 text-muted-foreground" />
        </a>
      )}

      <HokiCard />

      {/* andamento do desenvolvimento, movimento do quadro e atalhos */}
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <CartaoAndamento
          etapas={etapas}
          onAbrir={() => void navigate({ to: "/desenvolvimento" })}
          className="xl:col-span-3"
        />
        <CartaoMovimento
          novos={datasNovas}
          concluidos={datasConcluidas}
          legenda={
            isCoordinatorPlus ? "Solicitações que chegaram e pedidos concluídos" : "Pedidos do quadro, por dia"
          }
          className="xl:col-span-4"
        />

        <AtalhosCard className="md:col-span-2 xl:col-span-5" />
      </div>

      {/* calendário, agenda do dia e ranking, lado a lado */}
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        {/* Calendário */}
        <section
          style={{ animationDelay: "300ms" }}
          className="glass surface-hover animate-rise rounded-[22px] p-4 md:col-span-2 xl:col-span-5"
        >
          <CalendarMonth eventos={eventos} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </section>

        {/* Agenda */}
        <section
          style={{ animationDelay: "360ms" }}
          className="glass surface-hover animate-rise flex flex-col rounded-[22px] p-4 xl:col-span-3"
        >
          <header className="flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow">{selectedDay === hojeKey ? "Eventos do dia" : "Eventos"}</p>
              <h2 className="mt-1 font-display text-lg font-semibold">
                {diaSelecionado
                  ? cap(
                      diaSelecionado.toLocaleDateString("pt-BR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }),
                    )
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
                  {new Date(ev.dataInicio).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })}
                  {" · "}
                  {hhmm(ev.dataInicio)}
                  {ev.criadoPor && ` · ${ev.criadoPor}`}
                </p>
              </button>
            ))}
          </div>
        </section>

        <div
          className="animate-rise xl:col-span-4 [&>*]:h-full"
          style={{ animationDelay: "420ms" }}
        >
          <RankingPanel variant="premium" />
        </div>
      </div>

      {/* Caixa de entrada — Solicitações Administrativas (Coordinator+) */}
      {isCoordinatorPlus && caixaEntrada.length > 0 && (
        <section id="caixa-entrada" className="glass animate-rise mt-4 rounded-[20px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Caixa de entrada</p>
              <h2 className="mt-1 font-display text-lg font-semibold">
                Solicitações administrativas
              </h2>
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
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {s.descricao}
                      </p>
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

      {/* o queridômetro fica só dentro do HOKI (no termômetro da praça) */}
      <div className="mt-3 animate-rise" style={{ animationDelay: "420ms" }}>
        <TarefasPreview />
      </div>
    </div>
  );
}
