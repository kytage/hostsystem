import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventoModal } from "@/components/evento-modal";
import { getAuthUserData } from "@/lib/auth-cache";
import { fileImageToDataUrl } from "@/lib/clipboard-image";
import {
  EVENTO_INPUT_DEFAULT,
  atualizarEventoGestao,
  criarEventoGestao,
  fetchEventosDaEquipe,
  fetchStaffOptions,
  hojeISO,
  statusDef,
  type EventoGestao,
  type EventoInput,
} from "@/lib/eventos-gestao";
import { isCoordinatorPlus, useCanEditIlegal, useMyRole } from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";

/**
 * Cronograma da semana do Ilegal: atalho no topo do Painel Ilegal para ver e
 * adicionar rápido os eventos da equipe Ilegal. Usa a mesma tabela da página
 * Eventos e Cronograma (eventos_gestao), então tudo aparece lá também.
 */

const CHAVE = ["ilegal-semana-eventos"];

/* ------------------------------ datas (sem fuso) ------------------------------ */

function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
/** Domingo da semana da data (o calendário começa no domingo). */
function inicioDaSemana(iso: string): string {
  return addDias(iso, -new Date(`${iso}T12:00:00Z`).getUTCDay());
}
function paraData(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function paraISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rotuloDia(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return paraData(iso).toLocaleDateString("pt-BR", opts).replace(".", "");
}
function rotuloSemana(inicio: string): string {
  const fim = addDias(inicio, 6);
  return `${rotuloDia(inicio, { day: "2-digit", month: "short" })} a ${rotuloDia(fim, { day: "2-digit", month: "short" })}`;
}

/* ---------------------------------- botão ---------------------------------- */

export function IlegalSemanaEventos({ className }: { className?: string }) {
  const [aberto, setAberto] = useState(false);
  useRealtimeTable("eventos_gestao", [CHAVE]);

  const hoje = hojeISO();
  const semana = inicioDaSemana(hoje);
  // leve: sem banners, só para o resumo do botão
  const { data: daSemana = [] } = useQuery({
    queryKey: [...CHAVE, "resumo", semana],
    queryFn: () => fetchEventosDaEquipe("ilegal", semana, addDias(semana, 6), false),
    staleTime: 60_000,
  });
  const proximo = daSemana.find((e) => e.data >= hoje);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Ver e adicionar os eventos do Ilegal da semana"
        className={cn(
          "group flex h-9 min-w-0 items-center gap-2.5 rounded-full border border-primary/50 bg-gradient-to-r from-primary/30 via-primary/15 to-transparent pl-1 pr-4 text-left shadow-[0_0_24px_-8px] shadow-primary/70 transition-colors hover:border-primary hover:from-primary/40",
          className,
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <CalendarDays className="size-3.5" strokeWidth={2} />
        </span>
        <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.12em] text-foreground">
          Cronograma da semana
        </span>
        <span className="min-w-0 truncate text-[11.5px] text-foreground/60">
          {proximo
            ? `· Próximo: ${proximo.nome} — ${proximo.data === hoje ? "hoje" : rotuloDia(proximo.data, { weekday: "short" })} ${proximo.horario}`
            : daSemana.length === 0
              ? "· Nenhum evento nesta semana"
              : "· Semana encerrada"}
        </span>
        {daSemana.length > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-primary/25 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-foreground">
            {daSemana.length} {daSemana.length === 1 ? "evento" : "eventos"}
          </span>
        )}
      </button>
      {aberto && <CronogramaSemanaDialog onClose={() => setAberto(false)} />}
    </>
  );
}

/* ---------------------------------- janela --------------------------------- */

function CronogramaSemanaDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const canEdit = useCanEditIlegal();
  const { data: role } = useMyRole();
  const coordPlus = isCoordinatorPlus(role);
  const { data: meuId } = useQuery({
    queryKey: ["meu-user-id"],
    queryFn: async () => (await getAuthUserData()).user?.id ?? null,
    staleTime: 300_000,
  });

  const hoje = hojeISO();
  const [semana, setSemana] = useState(() => inicioDaSemana(hoje));
  const [mes, setMes] = useState(() => paraData(hoje));
  const [modal, setModal] = useState<{
    evento: EventoGestao | null;
    inicial?: Partial<EventoInput>;
  } | null>(null);

  // janela de datas: o mês do calendário inteiro + a semana escolhida
  const inicioMes = paraISO(new Date(mes.getFullYear(), mes.getMonth(), 1));
  const fimMes = paraISO(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
  const de = [inicioMes, semana].sort()[0]!;
  const ate = [fimMes, addDias(semana, 6)].sort()[1]!;

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: [...CHAVE, "janela", de, ate],
    queryFn: () => fetchEventosDaEquipe("ilegal", addDias(de, -7), addDias(ate, 7), true),
    placeholderData: (anterior) => anterior,
  });
  const { data: staffOptions = [] } = useQuery({
    queryKey: ["eventos-staff-options"],
    queryFn: fetchStaffOptions,
    staleTime: 120_000,
  });

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDias(semana, i)), [semana]);
  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoGestao[]>();
    for (const ev of eventos) mapa.set(ev.data, [...(mapa.get(ev.data) ?? []), ev]);
    return mapa;
  }, [eventos]);
  const diasComEvento = useMemo(() => [...porDia.keys()].map(paraData), [porDia]);
  const totalSemana = dias.reduce((n, d) => n + (porDia.get(d)?.length ?? 0), 0);

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: CHAVE });
    void queryClient.invalidateQueries({ queryKey: ["eventos-gestao"] });
    void queryClient.invalidateQueries({ queryKey: ["eventos"] });
  };
  const salvar = useMutation({
    mutationFn: async (v: { id: string | null; input: EventoInput }) => {
      if (v.id) await atualizarEventoGestao(v.id, v.input);
      else await criarEventoGestao(v.input);
    },
    onSuccess: (_r, v) => {
      invalidar();
      setModal(null);
      toast.success(v.id ? "Evento atualizado" : "Evento do Ilegal criado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu certo. Tente de novo."),
  });

  const podeEditar = (ev: EventoGestao) => coordPlus || (meuId != null && ev.criadoPorId === meuId);
  const irPara = (iso: string) => {
    setSemana(inicioDaSemana(iso));
    setMes(paraData(iso));
  };

  return (
    <>
      <Dialog open={!modal} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-[22px] sm:max-w-5xl sm:rounded-[22px]">
          <DialogHeader>
            <DialogTitle className="hc-titulo flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" /> Cronograma da semana — Ilegal
            </DialogTitle>
            <DialogDescription>
              Os eventos daqui são os mesmos da página Eventos e Cronograma, com a equipe Ilegal.
            </DialogDescription>
          </DialogHeader>

          {canEdit && (
            <AdicionarRapido
              dataSugerida={semana <= hoje && hoje <= addDias(semana, 6) ? hoje : semana}
              salvando={salvar.isPending && !modal}
              onAdicionar={(input) => salvar.mutate({ id: null, input })}
              onMaisOpcoes={(inicial) => setModal({ evento: null, inicial })}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="hc-dentro self-start p-2">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(d) => d && irPara(paraISO(d))}
                month={mes}
                onMonthChange={setMes}
                locale={ptBR}
                modifiers={{ evento: diasComEvento, semana: dias.map(paraData) }}
                modifiersClassNames={{
                  evento: "dia-com-evento",
                  semana: "bg-primary/10 first:rounded-l-md last:rounded-r-md",
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Semana anterior"
                  onClick={() => irPara(addDias(semana, -7))}
                  className="hc-seta !size-8"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <p className="text-[14px] font-semibold text-foreground">{rotuloSemana(semana)}</p>
                <button
                  type="button"
                  aria-label="Próxima semana"
                  onClick={() => irPara(addDias(semana, 7))}
                  className="hc-seta !size-8"
                >
                  <ChevronRight className="size-4" />
                </button>
                <span className="text-[11.5px] text-muted-foreground">
                  {totalSemana} {totalSemana === 1 ? "evento" : "eventos"}
                </span>
                {inicioDaSemana(hoje) !== semana && (
                  <button type="button" onClick={() => irPara(hoje)} className="hc-pilula ml-auto">
                    Esta semana
                  </button>
                )}
                {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>

              <div className="space-y-1.5">
                {dias.map((dia) => {
                  const lista = porDia.get(dia) ?? [];
                  const ehHoje = dia === hoje;
                  return (
                    <div
                      key={dia}
                      className={cn(
                        "flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2",
                        ehHoje && "border-primary/50 bg-primary/[0.07]",
                        lista.length === 0 && "items-center py-1.5",
                      )}
                    >
                      <div
                        className={cn(
                          "flex w-11 shrink-0 flex-col items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.04] py-1",
                          ehHoje && "border-primary/60 bg-primary/20",
                        )}
                      >
                        <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                          {rotuloDia(dia, { weekday: "short" })}
                        </span>
                        <span className="text-[15px] font-semibold leading-tight text-foreground">
                          {paraData(dia).getDate()}
                        </span>
                      </div>
                      {lista.length === 0 ? (
                        <div className="flex flex-1 items-center justify-between gap-2">
                          <span className="text-[11.5px] text-muted-foreground/70">
                            {ehHoje ? "Hoje · sem evento" : "Sem evento"}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                setModal({ evento: null, inicial: { equipe: "ilegal", data: dia } })
                              }
                              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                            >
                              <Plus className="size-3" /> Evento
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {lista.map((ev) => (
                            <CartaoEvento
                              key={ev.id}
                              evento={ev}
                              editavel={podeEditar(ev)}
                              onAbrir={() => setModal({ evento: ev })}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* o formulário completo abre por cima, com a janela do cronograma escondida enquanto isso */}
      {modal && (
        <EventoModal
          evento={modal.evento}
          inicial={modal.inicial ?? { equipe: "ilegal" }}
          staffOptions={staffOptions}
          saving={salvar.isPending}
          onClose={() => setModal(null)}
          onSave={(input) => salvar.mutate({ id: modal.evento?.id ?? null, input })}
        />
      )}
    </>
  );
}

/* ------------------------------ cartão do evento ----------------------------- */

function CartaoEvento({
  evento,
  editavel,
  onAbrir,
}: {
  evento: EventoGestao;
  editavel: boolean;
  onAbrir: () => void;
}) {
  const st = statusDef(evento.status);
  return (
    <button
      type="button"
      onClick={editavel ? onAbrir : undefined}
      title={editavel ? "Abrir para editar" : evento.nome}
      className={cn(
        "group overflow-hidden rounded-xl border border-white/[0.08] bg-black/30 text-left transition-colors",
        editavel ? "cursor-pointer hover:border-primary/50" : "cursor-default",
      )}
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-gradient-to-br from-primary/25 via-white/[0.03] to-transparent">
        {evento.bannerUrl ? (
          <img
            src={evento.bannerUrl}
            alt={`Banner de ${evento.nome}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center text-center">
            <span className="flex flex-col items-center gap-1 text-[10.5px] text-muted-foreground">
              <ImageIcon className="size-4" />
              {evento.solicitacaoBanner ? "Aguardando banner" : "Sem banner"}
            </span>
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur">
          <Clock className="size-3" /> {evento.horario}
        </span>
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[12.5px] font-semibold text-foreground">{evento.nome}</p>
        <p className="truncate text-[10.5px] text-muted-foreground">
          {st.emoji} {st.label}
          {evento.premiacao ? ` · 🏆 ${evento.premiacao}` : ""}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------ adicionar rápido ----------------------------- */

function AdicionarRapido({
  dataSugerida,
  salvando,
  onAdicionar,
  onMaisOpcoes,
}: {
  dataSugerida: string;
  salvando: boolean;
  onAdicionar: (input: EventoInput) => void;
  onMaisOpcoes: (inicial: Partial<EventoInput>) => void;
}) {
  const [nome, setNome] = useState("");
  const [data, setData] = useState(dataSugerida);
  const [horario, setHorario] = useState("20:00");
  const [banner, setBanner] = useState("");
  const [carregando, setCarregando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const campo =
    "h-9 rounded-xl border border-input bg-white/[0.03] px-3 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const valores = (): Partial<EventoInput> => ({
    equipe: "ilegal",
    nome,
    data,
    horario,
    bannerUrl: banner,
  });

  const escolherBanner = async (file: File | undefined) => {
    if (!file) return;
    setCarregando(true);
    try {
      const url = await fileImageToDataUrl(file, 1920);
      if (!url) toast.error("Selecione um arquivo de imagem");
      else setBanner(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar o banner");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/25 bg-primary/[0.05] p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim() || salvando) return;
        onAdicionar({ ...EVENTO_INPUT_DEFAULT, ...valores(), nome: nome.trim() });
        setNome("");
        setBanner("");
      }}
    >
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do evento (ex.: Guerra nos céus)"
        aria-label="Nome do evento"
        maxLength={120}
        className={cn(campo, "min-w-[200px] flex-1")}
      />
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        aria-label="Data"
        className={cn(campo, "w-[150px]")}
        required
      />
      <input
        type="time"
        value={horario}
        onChange={(e) => setHorario(e.target.value)}
        aria-label="Horário"
        className={cn(campo, "w-[110px]")}
        required
      />
      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void escolherBanner(e.target.files?.[0])}
      />
      {banner ? (
        <span className="relative h-9 w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/[0.12]">
          <img src={banner} alt="Banner escolhido" className="size-full object-cover" />
          <button
            type="button"
            aria-label="Tirar banner"
            onClick={() => setBanner("")}
            className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-black/70 text-white"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (arquivo.current) arquivo.current.value = "";
            arquivo.current?.click();
          }}
          className="pilula flex items-center gap-1.5 rounded-full"
        >
          {carregando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ImageIcon className="size-3.5" />
          )}{" "}
          Banner
        </button>
      )}
      <button
        type="button"
        onClick={() => onMaisOpcoes(valores())}
        title="Abrir o formulário completo (staff, premiação, repetir toda semana…)"
        className="pilula flex items-center gap-1.5 rounded-full"
      >
        <SlidersHorizontal className="size-3.5" /> Mais opções
      </button>
      <button
        type="submit"
        disabled={!nome.trim() || salvando}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {salvando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{" "}
        Adicionar
      </button>
    </form>
  );
}
