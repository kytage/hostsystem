import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Clock,
  Flame,
  History,
  ImageOff,
  ImagePlus,
  Loader2,
  PartyPopper,
  Pencil,
  Repeat,
  Search,
  Send,
  Trash2,
  Trophy,
  Users,
  Activity,
  CheckCheck,
  Lightbulb,
} from "lucide-react";
import { Indice, Indices } from "@/components/indice";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RichText } from "@/components/rich-text";
import { EventoModal } from "@/components/evento-modal";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { Calendar } from "@/components/ui/calendar";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { getAuthUserData } from "@/lib/auth-cache";
import { publicarEventoDiscord } from "@/lib/eventos-discord.functions";
import { isCoordinatorPlus, useMyRole } from "@/lib/permissions";
import {
  ADICAO_MAP,
  EQUIPES,
  STATUS_LIST,
  atualizarEventoGestao,
  criarEventoGestao,
  despublicarDoCronograma,
  equipeDef,
  excluirEventoGestao,
  fetchEventosGestao,
  fetchStaffOptions,
  formatarData,
  publicarNoCronograma,
  salvarBannerEvento,
  statusDef,
  type EventoGestao,
  type EventoInput,
} from "@/lib/eventos-gestao";
import { fileImageToDataUrl } from "@/lib/clipboard-image";

export const Route = createFileRoute("/_authenticated/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — HOST" },
      {
        name: "description",
        content:
          "Criação e organização dos eventos do servidor: equipe, staff responsável, premiação, status, adições e banner.",
      },
      { property: "og:title", content: "Eventos — HOST" },
      {
        property: "og:description",
        content: "Criação e organização dos eventos do servidor HOST.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventosPage,
});

function hojeISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function EventosPage() {
  const queryClient = useQueryClient();
  useRealtimeTable("eventos_gestao", [["eventos-gestao"]]);

  const { data: role } = useMyRole();
  const coordPlus = isCoordinatorPlus(role);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-gestao"],
    queryFn: fetchEventosGestao,
  });
  const { data: staffOptions = [] } = useQuery({
    queryKey: ["eventos-staff-options"],
    queryFn: fetchStaffOptions,
    staleTime: 120_000,
  });
  const { data: meuId } = useQuery({
    queryKey: ["meu-user-id"],
    queryFn: async () => (await getAuthUserData()).user?.id ?? null,
    staleTime: 300_000,
  });

  const [modal, setModal] = useState<{ evento: EventoGestao | null } | null>(null);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fEquipe, setFEquipe] = useState("todas");
  const [diaSel, setDiaSel] = useState<Date | undefined>(undefined);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [fBanner, setFBanner] = useState("todos");
  /** Controla quais cards estão expandidos; ausente = padrão (aberto só para eventos de hoje). */
  const [estadosCard, setEstadosCard] = useState<Record<string, boolean>>({});
  const alternarCard = (id: string, aberto: boolean) =>
    setEstadosCard((prev) => ({ ...prev, [id]: aberto }));
  const bannerInput = useRef<HTMLInputElement>(null);
  const bannerAlvo = useRef<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["eventos-gestao"] });
    void queryClient.invalidateQueries({ queryKey: ["eventos"] });
  };

  const criar = useMutation({
    mutationFn: criarEventoGestao,
    onSuccess: () => {
      invalidate();
      setModal(null);
      toast.success("Evento criado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar evento"),
  });

  const atualizar = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EventoInput }) =>
      atualizarEventoGestao(id, input),
    onSuccess: () => {
      invalidate();
      setModal(null);
      toast.success("Evento atualizado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: excluirEventoGestao,
    onSuccess: () => {
      invalidate();
      toast.success("Evento removido");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  const publicar = useMutation({
    mutationFn: publicarNoCronograma,
    onSuccess: () => {
      invalidate();
      toast.success("Publicado no Cronograma do site");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar"),
  });

  const despublicar = useMutation({
    mutationFn: despublicarDoCronograma,
    onSuccess: () => {
      invalidate();
      toast.success("Removido do Cronograma");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover do Cronograma"),
  });

  const banner = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => salvarBannerEvento(id, url),
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.url ? "Banner enviado — evento marcado como Banner OK" : "Banner removido");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar o banner"),
  });

  /** Abre o seletor de arquivo guardando qual evento receberá o banner. */
  const pedirBanner = (id: string) => {
    bannerAlvo.current = id;
    if (bannerInput.current) bannerInput.current.value = "";
    bannerInput.current?.click();
  };

  const receberBanner = async (file: File | undefined) => {
    const id = bannerAlvo.current;
    bannerAlvo.current = null;
    if (!file || !id) return;
    try {
      // Banner 2190x1080 — mantém proporção, sem cortar.
      const url = await fileImageToDataUrl(file, 1920);
      if (!url) {
        toast.error("Selecione um arquivo de imagem");
        return;
      }
      banner.mutate({ id, url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar o banner");
    }
  };

  const podeEditar = (ev: EventoGestao) => coordPlus || (meuId != null && ev.criadoPorId === meuId);

  /** Situação do banner do evento: só aparece quando o banner foi solicitado. */
  const bannerStatus = (ev: EventoGestao): "aguardando" | "ok" | "nao_solicitado" => {
    if (!ev.solicitacaoBanner) return "nao_solicitado";
    return ev.bannerUrl ? "ok" : "aguardando";
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos.filter((ev) => {
      if (fStatus !== "todos" && ev.status !== fStatus) return false;
      if (fEquipe !== "todas" && ev.equipe !== fEquipe) return false;
      if (fBanner === "aguardando" && !(ev.solicitacaoBanner && !ev.bannerUrl)) return false;
      if (fBanner === "ok" && !(ev.solicitacaoBanner && ev.bannerUrl)) return false;
      if (termo && !`${ev.nome} ${ev.premiacao}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [eventos, busca, fStatus, fEquipe, fBanner]);

  const aguardandoBanner = useMemo(
    () =>
      eventos
        .filter((ev) => ev.solicitacaoBanner && !ev.bannerUrl)
        .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`)),
    [eventos]
  );

  const hoje = hojeISO();
  const diaSelISO = diaSel
    ? `${diaSel.getFullYear()}-${`${diaSel.getMonth() + 1}`.padStart(2, "0")}-${`${diaSel.getDate()}`.padStart(2, "0")}`
    : null;

  // Ordem cronológica: futuros/hoje primeiro (asc), passados separados (desc)
  const { proximos, passados } = useMemo(() => {
    const futuros = filtrados
      .filter((ev) => ev.data >= hoje)
      .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
    const antigos = filtrados
      .filter((ev) => ev.data < hoje)
      .sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`));
    return { proximos: futuros, passados: antigos };
  }, [filtrados, hoje]);

  const diasComEvento = useMemo(() => filtrados.map((ev) => parseISODate(ev.data)), [filtrados]);

  const eventosPainel = useMemo(() => {
    if (diaSelISO) return filtrados
      .filter((ev) => ev.data === diaSelISO)
      .sort((a, b) => a.horario.localeCompare(b.horario));
    return proximos.slice(0, 6);
  }, [diaSelISO, filtrados, proximos]);

  const contagem = useMemo(
    () => ({
      total: eventos.length,
      organizando: eventos.filter((e) => e.status === "organizando").length,
      andamento: eventos.filter((e) => e.status === "andamento").length,
      concluido: eventos.filter((e) => e.status === "concluido").length,
    }),
    [eventos]
  );

  const discord = useMutation({
    mutationFn: (ev: EventoGestao) => {
      const eq = equipeDef(ev.equipe);
      return publicarEventoDiscord({
        data: {
          id: ev.id,
          nome: ev.nome,
          equipeLabel: eq.label,
          equipeEmoji: eq.emoji,
          staff: ev.staff,
          todosDaArea: ev.todosDaArea,
          data: ev.data,
          horario: ev.horario,
          premiacao: ev.premiacao,
          informacoes: ev.informacoes,
          bannerUrl: ev.bannerUrl,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Publicado no Discord");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar no Discord"),
  });

  const renderCard = (ev: EventoGestao) => {
    const eq = equipeDef(ev.equipe);
    const st = statusDef(ev.status);
    const editavel = podeEditar(ev);
    const ehHoje = ev.data === hoje;
    const aberto = estadosCard[ev.id] ?? ehHoje;
    return (
      <article
        key={ev.id}
        className={cn("glass hc transition-colors", ehHoje && "!border-primary/60")}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Cabeçalho clicável — recolhe/expande o card */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={aberto}
              onClick={() => alternarCard(ev.id, !aberto)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  alternarCard(ev.id, !aberto);
                }
              }}
              className="flex min-w-0 flex-1 cursor-pointer select-none items-start gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            >
              {ev.bannerUrl && (
                <img
                  src={ev.bannerUrl}
                  alt={`Banner do evento ${ev.nome}`}
                  className="aspect-[2190/1080] w-20 shrink-0 self-start rounded-xl border border-white/[0.08] object-cover sm:w-28"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="hc-titulo">{ev.nome}</h2>
                  {ehHoje && (
                    <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <Flame className="size-3" /> HOJE
                    </span>
                  )}
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", eq.style)}>
                    {eq.emoji} {eq.label}
                  </span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", st.style)}>
                    {st.emoji} {st.label}
                  </span>
                  {ev.publicadoCronograma && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                      No cronograma
                    </span>
                  )}
                  {bannerStatus(ev) === "aguardando" && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                      <ImageOff className="size-3" /> AGUARDANDO BANNER
                    </span>
                  )}
                  {bannerStatus(ev) === "ok" && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                      <ImagePlus className="size-3" /> BANNER OK
                    </span>
                  )}
                  {ev.frequencia === "semanal" && (
                    <span className="hc-selo">
                      <Repeat className="size-3" /> Semanal
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarCheck2 className="size-3" /> {formatarData(ev.data)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {ev.horario}
                  </span>
                  {ev.premiacao && (
                    <span className="flex items-center gap-1">
                      <Trophy className="size-3" /> {ev.premiacao}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {ev.todosDaArea
                      ? `Todos da área ${eq.label}`
                      : ev.staff.map((s) => s.username).join(", ") || "sem responsável"}
                  </span>
                </div>

                {ev.adicoes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ev.adicoes.map((a) => (
                      <span
                        key={a}
                        className="hc-selo !text-foreground"
                      >
                        {ADICAO_MAP[a]?.emoji} {ADICAO_MAP[a]?.label ?? a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ações e controle de expansão — fora da área clicável */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  onClick={() =>
                    ev.publicadoCronograma ? despublicar.mutate(ev) : publicar.mutate(ev)
                  }
                  disabled={!editavel || publicar.isPending || despublicar.isPending}
                  title="Publicar no Cronograma do site"
                  className={cn(
                    "hc-pilula disabled:opacity-40",
                    ev.publicadoCronograma
                      ? "!border-emerald-500/30 !bg-emerald-500/15 !text-emerald-400"
                      : "disabled:hover:!border-[color:var(--gf-linha)] disabled:hover:!bg-[var(--gf-2)] disabled:hover:!text-[var(--gf-tx-1)]"
                  )}
                >
                  <CalendarCheck2 className="size-3.5" />
                  {ev.publicadoCronograma ? "No Cronograma" : "Publicar no Cronograma"}
                </button>
                <button
                  onClick={() => discord.mutate(ev)}
                  disabled={!editavel || discord.isPending}
                  title={
                    ev.publicadoDiscord
                      ? "Publicar novamente no Discord"
                      : "Publicar no Discord"
                  }
                  className={cn(
                    "hc-pilula disabled:opacity-40",
                    ev.publicadoDiscord
                      ? "!border-indigo-500/30 !bg-indigo-500/15 !text-indigo-400"
                      : "disabled:hover:!border-[color:var(--gf-linha)] disabled:hover:!bg-[var(--gf-2)] disabled:hover:!text-[var(--gf-tx-1)]"
                  )}
                >
                  {discord.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {ev.publicadoDiscord ? "No Discord" : "Discord"}
                </button>
                <button
                  onClick={() => setModal({ evento: ev })}
                  disabled={!editavel}
                  className="hc-seta disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Editar evento"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir o evento "${ev.nome}"?`)) excluir.mutate(ev.id);
                  }}
                  disabled={!editavel}
                  className="hc-seta hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Excluir evento"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <button
                onClick={() => alternarCard(ev.id, !aberto)}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                aria-label={aberto ? "Recolher detalhes" : "Ver detalhes"}
              >
                {aberto ? "recolher" : "ver detalhes"}
                <ChevronDown className={cn("size-4 transition-transform", aberto && "rotate-180")} />
              </button>
            </div>
          </div>

          {/* Conteúdo expandido: texto completo, anexos e autoria */}
          {aberto && (
            <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-3">
              {ev.informacoes && <RichText value={ev.informacoes} />}

              {ev.anexos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ev.anexos.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      <img
                        src={src}
                        alt={`Anexo ${i + 1} do evento ${ev.nome}`}
                        className="size-20 rounded-xl border border-white/[0.08] object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground/70">
                criado por {ev.criadoPor || "equipe"}
              </p>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="pagina">
      <PageHeader
        title="Eventos e Cronograma"
        subtitle="Criação, organização e publicação dos eventos do servidor"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="campo-busca w-56">
              <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar evento..."
                aria-label="Buscar evento"
              />
            </label>
            <div className="w-44">
              <MinimalSelect
                value={fEquipe}
                onChange={setFEquipe}
                options={[
                  { value: "todas", label: "Todas as equipes" },
                  ...EQUIPES.map((e) => ({ value: e.key, label: `${e.emoji} ${e.label}` })),
                ]}
              />
            </div>
            <div className="w-44">
              <MinimalSelect
                value={fStatus}
                onChange={setFStatus}
                options={[
                  { value: "todos", label: "Todos os status" },
                  ...STATUS_LIST.map((s) => ({ value: s.key, label: `${s.emoji} ${s.label}` })),
                ]}
              />
            </div>
            <div className="w-48">
              <MinimalSelect
                value={fBanner}
                onChange={setFBanner}
                options={[
                  { value: "todos", label: "Banner: todos" },
                  { value: "aguardando", label: "🖼️ Aguardando banner" },
                  { value: "ok", label: "✅ Banner OK" },
                ]}
              />
            </div>
            <button
              onClick={() => setModal({ evento: null })}
              className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            >
              <CalendarPlus className="size-4" /> Novo evento
            </button>
          </div>
        }
      />

      {/* números do cronograma, no padrão da tela inicial */}
      <Indices className="mt-5">
        <Indice valor={contagem.total} titulo="Total" icone={CalendarDays} />
        <Indice valor={contagem.organizando} titulo="Organizando" icone={Lightbulb} />
        <Indice valor={contagem.andamento} titulo="Em andamento" icone={Activity} />
        <Indice valor={contagem.concluido} titulo="Concluídos" icone={CheckCheck} />
      </Indices>

      {/* Histórico de eventos passados (topo) */}
      {passados.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setMostrarHistorico((v) => !v)}
            className="pilula rounded-full"
          >
            <History className="size-3.5" />
            Histórico ({passados.length} {passados.length === 1 ? "evento passado" : "eventos passados"})
            <ChevronDown
              className={cn("size-3.5 transition-transform", mostrarHistorico && "rotate-180")}
            />
          </button>
          {mostrarHistorico && (
            <div className="mt-3.5 space-y-3.5 opacity-80">{passados.map(renderCard)}</div>
          )}
        </div>
      )}

      {/* Fila de banners solicitados */}
      {aguardandoBanner.length > 0 && (
        <section className="glass hc mt-3.5 p-5">
          <div className="flex items-center gap-3">
            <span className="hc-icone">
              <ImageOff className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="hc-titulo">AGUARDANDO BANNER</h2>
              <p className="hc-nota mt-0.5">
                Clique em um evento para enviar o banner — ele passa para “Banner OK”.
              </p>
            </div>
            {/* pede ação: o ponto vermelho, como na tela inicial */}
            <span className="hc-estado tabular-nums">
              <i aria-hidden />
              {aguardandoBanner.length}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {aguardandoBanner.map((ev) => (
              <button
                key={ev.id}
                onClick={() => pedirBanner(ev.id)}
                disabled={banner.isPending}
                className="hc-dentro flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-foreground disabled:opacity-40"
              >
                {banner.isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="size-3.5 text-muted-foreground" />
                )}
                <span className="max-w-52 truncate">{ev.nome}</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {formatarData(ev.data)} · {ev.horario}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <input
        ref={bannerInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void receberBanner(e.target.files?.[0])}
      />

      {/* Calendário + Próximos eventos */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[auto_1fr]">
        <div className="glass hc calendario-hc p-3">
          <Calendar
            mode="single"
            selected={diaSel}
            onSelect={setDiaSel}
            locale={ptBR}
            modifiers={{ evento: diasComEvento }}
            modifiersClassNames={{ evento: "dia-com-evento" }}
          />
        </div>
        <div className="glass hc p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="hc-icone">
              <CalendarDays className="size-4" strokeWidth={1.75} />
            </span>
            <p className="hc-titulo min-w-0 flex-1 truncate">
              {diaSelISO ? `Eventos de ${formatarData(diaSelISO)}` : "Próximos eventos"}
            </p>
            {diaSel && (
              <button type="button" onClick={() => setDiaSel(undefined)} className="hc-pilula">
                Ver próximos
              </button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {eventosPainel.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum evento {diaSelISO ? "neste dia" : "programado"}.
              </p>
            ) : (
              eventosPainel.map((ev) => {
                const eq = equipeDef(ev.equipe);
                const ehHoje = ev.data === hoje;
                return (
                  <button
                    key={ev.id}
                    onClick={() => setModal({ evento: ev })}
                    className={cn(
                      "hc-dentro flex w-full items-center gap-3 px-3 py-2.5 text-left",
                      ehHoje && "!border-primary/60 !bg-primary/10",
                    )}
                  >
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.05]">
                      <span className="text-sm font-semibold leading-none text-foreground">
                        {parseISODate(ev.data).getDate()}
                      </span>
                      <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                        {parseISODate(ev.data).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                        {ev.nome}
                        {ehHoje && <span className="text-[10px] font-semibold text-primary">HOJE</span>}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {ev.horario} · {eq.emoji} {eq.label}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando eventos...
        </div>
      ) : proximos.length === 0 && passados.length === 0 ? (
        <div className="mt-3.5 rounded-[22px] border border-dashed border-white/[0.1] p-12 text-center">
          <PartyPopper className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum evento por aqui. Crie o primeiro em “Novo evento”.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3.5">{proximos.map(renderCard)}</div>
        </>
      )}

      {modal && (
        <EventoModal
          evento={modal.evento}
          staffOptions={staffOptions}
          saving={criar.isPending || atualizar.isPending}
          onClose={() => setModal(null)}
          onSave={(input) => {
            if (modal.evento) atualizar.mutate({ id: modal.evento.id, input });
            else criar.mutate(input);
          }}
        />
      )}
    </div>
  );
}
