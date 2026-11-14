import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  CalendarX2,
  Check,
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
import { HOKI_NA_HOME } from "@/lib/hoki-lugar";
import { AtalhosCard } from "@/components/atalhos-card";
import { Contagem } from "@/components/contagem";
import { AvisosHero } from "@/components/avisos-hero";
import { OrganizacoesDestaque } from "@/components/organizacoes-destaque";
import { CartaoAndamento, CartaoMovimento } from "@/components/home-graficos";

/**
 * O HOKI aparece na tela inicial (para ocultar, veja src/lib/hoki-lugar.ts).
 * Enquanto estiver oculto, o código dele nem é baixado nesta tela.
 */
const HokiNaHome = HOKI_NA_HOME
  ? lazy(() => import("@/components/hoki/hoki-card").then((m) => ({ default: m.HokiCard })))
  : null;

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

/**
 * Tela inicial: uma grade de cartões de tamanhos diferentes, do mais urgente
 * para o menos. No alto, o que pede a pessoa agora (com os avisos e as
 * organizações livres ao lado); depois os números da equipe, a agenda e,
 * por fim, os atalhos. As classes `hc-*` ficam no fim de src/styles.css.
 */
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

  // índices do cartão de abertura: o que pede atenção, com o caminho de cada um
  const proximo = proximosEventos[0];
  const indices = [
    ...(isCoordinatorPlus
      ? [
          {
            titulo: "Aguardando aprovação",
            valor: aguardando.length,
            icon: Inbox,
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
      alerta: false,
      sub: "ativas no quadro",
      dica: "Ver o status das minhas pendências",
      onClick: () => setStatusOpen(true),
    },
    {
      titulo: "Quadro de dev",
      valor: tasks.length,
      icon: Code2,
      alerta: false,
      sub: `${emRevisao} em revisão`,
      dica: "Abrir o quadro de desenvolvimento",
      onClick: () => void navigate({ to: "/desenvolvimento" }),
    },
    {
      titulo: "Próximos eventos",
      valor: proximosEventos.length,
      icon: CalendarDays,
      alerta: false,
      sub: proximo ? proximo.titulo : "nenhum marcado",
      dica: "Abrir eventos e cronograma",
      onClick: () => void navigate({ to: "/eventos" }),
    },
  ];
  const pedindo = (isCoordinatorPlus ? aguardando.length : 0) + minhasAtivas;
  const naCaixa = isCoordinatorPlus ? caixaEntrada.length : 0;

  const hora = now?.getHours() ?? 12;
  const saudacao = !now ? "Olá" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const diaSelecionado = selectedDay ? new Date(`${selectedDay}T12:00:00`) : null;

  return (
    <>
      {statusOpen && <MinhasPendenciasModal onClose={() => setStatusOpen(false)} />}

      <div className="home">
        <div className="home-grade grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-3.5 xl:grid-cols-12">
          {/* 1. Abertura: quem chegou e o que pede atenção agora. Cada índice leva direto ao lugar. */}
          <section
            aria-labelledby="home-ola"
            className="glass hc hc-vidro hc-abertura flex flex-col p-5 sm:p-6 md:col-span-6 xl:col-span-8"
          >
            <span aria-hidden className="hc-brasa" />
            <span aria-hidden className="hc-reticula" />
            <p className="hc-sobre">
              {now
                ? now.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })
                : "—"}
            </p>
            <h1
              id="home-ola"
              className="mt-2.5 font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[34px]"
            >
              <span className="text-muted-foreground">{saudacao},</span> {username || "…"}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="hc-estado">
                {pedindo > 0 ? (
                  <i aria-hidden />
                ) : (
                  <Check className="size-3.5" strokeWidth={2} aria-hidden />
                )}
                {pedindo > 0
                  ? `${pedindo} ${pedindo > 1 ? "itens pedem" : "item pede"} você`
                  : "Tudo em dia"}
              </span>
              {naCaixa > 0 && (
                <a
                  href="#caixa-entrada"
                  className="hc-estado"
                  title={`Você tem ${naCaixa} ${
                    naCaixa > 1 ? "solicitações administrativas" : "solicitação administrativa"
                  } na caixa de entrada.`}
                >
                  <Inbox className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {naCaixa} na caixa de entrada
                  <ArrowDown className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden />
                </a>
              )}
            </div>

            {/* quantos cabem por linha depende da largura do próprio cartão (veja .hc-indices no styles.css) */}
            <div
              className="hc-indices mt-6 sm:mt-auto sm:pt-7"
              style={{ "--quantos": indices.length } as CSSProperties}
            >
              {indices.map((q) => (
                <button
                  key={q.titulo}
                  type="button"
                  onClick={q.onClick}
                  title={q.dica}
                  className="hc-indice"
                  data-alerta={q.alerta && q.valor > 0 ? "" : undefined}
                >
                  <span className="hc-indice-valor">
                    <Contagem valor={q.valor} />
                  </span>
                  {/* o ícone do índice; ao passar o mouse, vira a seta de "abrir" */}
                  <span className="hc-indice-icone" aria-hidden>
                    <q.icon strokeWidth={1.75} />
                    <ArrowUpRight strokeWidth={1.75} />
                  </span>
                  <span className="hc-indice-rotulo">{q.titulo}</span>
                  <span className="hc-indice-nota">{q.sub}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Ao lado da abertura: os avisos para confirmar e as organizações livres */}
          <div className="grid grid-cols-1 gap-3 md:col-span-6 md:grid-cols-2 md:gap-3.5 xl:col-span-4 xl:grid-cols-1 xl:grid-rows-[minmax(0,1fr)_auto]">
            <AvisosHero />
            <OrganizacoesDestaque />
          </div>

          {/* Caixa de entrada: solicitações administrativas (Coordinator+), só quando há alguma */}
          {naCaixa > 0 && (
            <section
              id="caixa-entrada"
              className="glass hc scroll-mt-4 p-5 md:col-span-6 xl:col-span-12"
            >
              <header className="flex items-center gap-3">
                <span className="hc-icone">
                  <Inbox className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="hc-sobre">Caixa de entrada</p>
                  <h2 className="hc-titulo mt-1">Solicitações administrativas</h2>
                </div>
                <span className="hc-estado tabular-nums">
                  <i aria-hidden />
                  {naCaixa} pendente{naCaixa > 1 ? "s" : ""}
                </span>
              </header>
              <div className="mt-4 grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                {caixaEntrada.map((s) => (
                  <article key={s.id} className="hc-dentro p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">{s.titulo}</h3>
                        {s.descricao && (
                          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
                            {s.descricao}
                          </p>
                        )}
                        {s.anexos.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {s.anexos.map((a) => (
                              <a
                                key={a.url}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hc-selo !text-foreground hover:!bg-white/[0.09]"
                              >
                                <Paperclip className="size-3" /> {a.nome}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="mt-2.5 text-xs text-ink-3">
                          De{" "}
                          <span className="font-medium text-muted-foreground">{s.criadoPor}</span> ·{" "}
                          {new Date(s.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => lidaMutation.mutate(s.id)}
                        disabled={lidaMutation.isPending}
                        className="hc-pilula shrink-0 disabled:opacity-50"
                      >
                        <Check className="size-3.5" strokeWidth={2} /> Marcar como lida
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* O HOKI, como sempre foi na tela inicial (src/lib/hoki-lugar.ts) */}
          {HokiNaHome && (
            <div className="md:col-span-6 xl:col-span-12">
              <Suspense fallback={null}>
                <HokiNaHome />
              </Suspense>
            </div>
          )}

          {/* 3. Os números da equipe: movimento do quadro, andamento do desenvolvimento e ranking */}
          <CartaoMovimento
            novos={datasNovas}
            concluidos={datasConcluidas}
            legenda={
              isCoordinatorPlus
                ? "Solicitações que chegaram e pedidos concluídos"
                : "Pedidos do quadro, por dia"
            }
            className="hc !p-5 md:col-span-6 xl:col-span-5"
          />
          <CartaoAndamento
            etapas={etapas}
            onAbrir={() => void navigate({ to: "/desenvolvimento" })}
            className="md:col-span-3 xl:col-span-3"
          />
          <div className="md:col-span-3 xl:col-span-4 [&>*]:h-full">
            <RankingPanel variant="premium" />
          </div>

          {/* 4. A agenda: calendário, eventos do dia escolhido e as tarefas particulares */}
          <section className="glass hc p-5 md:col-span-6 xl:col-span-5">
            <CalendarMonth
              eventos={eventos}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          </section>

          <section className="glass hc flex flex-col p-5 md:col-span-3 xl:col-span-3">
            <header className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="hc-sobre">{selectedDay === hojeKey ? "Eventos do dia" : "Eventos"}</p>
                <h2 className="mt-1.5 font-display text-[19px] font-semibold tracking-[-0.02em]">
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
                title="Abrir eventos e cronograma"
                className="hc-seta"
              >
                <ArrowUpRight className="size-3.5" />
              </Link>
            </header>

            <div className="mt-4 space-y-2">
              {eventosDoDia.length === 0 && (
                <div className="hc-dentro flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                  <CalendarX2 className="size-5 text-ink-3" strokeWidth={1.5} />
                  <p className="text-[13px] text-muted-foreground">Nenhum evento neste dia.</p>
                </div>
              )}
              {eventosDoDia.map((ev) => (
                <div key={ev.id} className="hc-dentro p-3">
                  <p className="text-[13.5px] font-medium">{ev.titulo}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {hhmm(ev.dataInicio)}
                    {ev.dataFim && ` — ${hhmm(ev.dataFim)}`}
                    {ev.criadoPor && ` · ${ev.criadoPor}`}
                  </p>
                </div>
              ))}
            </div>

            <p className="hc-sobre mt-5">Próximos eventos</p>
            <div className="mt-2.5 space-y-2">
              {proximosEventos.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-white/[0.1] px-4 py-4 text-center text-xs text-ink-3">
                  Nenhum evento futuro agendado.
                </div>
              )}
              {proximosEventos.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedDay(dayKey(new Date(ev.dataInicio)))}
                  className="hc-dentro w-full p-3 text-left"
                >
                  <p className="text-[13.5px] font-medium">{ev.titulo}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
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

          {/* o queridômetro fica só dentro do HOKI (no termômetro da praça) */}
          <div className="md:col-span-3 xl:col-span-4 [&>*]:h-full">
            <TarefasPreview />
          </div>

          {/* 5. Atalhos para as telas mais usadas */}
          <AtalhosCard className="md:col-span-6 xl:col-span-12" />
        </div>
      </div>
    </>
  );
}
