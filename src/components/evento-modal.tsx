import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Image as ImageIcon,
  Loader2,
  Repeat,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { RichTextarea } from "@/components/rich-textarea";
import { clipboardImageToDataUrl, fileImageToDataUrl } from "@/lib/clipboard-image";
import {
  ADICOES,
  DIAS_SEMANA,
  EQUIPES,
  EVENTO_INPUT_DEFAULT,
  STATUS_LIST,
  equipeDef,
  type AdicaoKey,
  type EquipeKey,
  type EventoGestao,
  type EventoInput,
  type EventoStatus,
  type FrequenciaKey,
  type StaffOption,
} from "@/lib/eventos-gestao";

export interface EventoModalProps {
  evento?: EventoGestao | null;
  staffOptions: StaffOption[];
  saving?: boolean;
  onSave: (input: EventoInput) => void;
  onClose: () => void;
}

function fromEvento(evento: EventoGestao): EventoInput {
  return {
    nome: evento.nome,
    equipe: evento.equipe,
    staff: evento.staff,
    todosDaArea: evento.todosDaArea,
    data: evento.data,
    horario: evento.horario,
    premiacao: evento.premiacao,
    informacoes: evento.informacoes,
    anexos: evento.anexos,
    status: evento.status,
    adicoes: evento.adicoes,
    solicitacaoBanner: evento.solicitacaoBanner,
    bannerUrl: evento.bannerUrl,
    frequencia: evento.frequencia,
    frequenciaDia: evento.frequenciaDia,
    frequenciaRepeticoes: evento.frequenciaRepeticoes,
  };
}

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-white/25";
const labelCls = "hc-sobre";

export function EventoModal({
  evento,
  staffOptions,
  saving,
  onSave,
  onClose,
}: EventoModalProps) {
  const [form, setForm] = useState<EventoInput>(() =>
    evento ? fromEvento(evento) : { ...EVENTO_INPUT_DEFAULT }
  );
  const [busca, setBusca] = useState("");
  const bannerInput = useRef<HTMLInputElement>(null);
  const [carregandoBanner, setCarregandoBanner] = useState(false);

  const set = <K extends keyof EventoInput>(key: K, value: EventoInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const equipe = equipeDef(form.equipe);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? staffOptions.filter((s) => s.username.toLowerCase().includes(termo))
      : staffOptions;
    return base.slice(0, 60);
  }, [busca, staffOptions]);

  const daArea = useMemo(
    () => staffOptions.filter((s) => s.areas.includes(equipe.area)).length,
    [staffOptions, equipe.area]
  );

  const selecionados = new Set(form.staff.map((s) => s.id));

  const toggleStaff = (opt: StaffOption) => {
    setForm((f) => {
      const existe = f.staff.some((s) => s.id === opt.id);
      return {
        ...f,
        todosDaArea: false,
        staff: existe
          ? f.staff.filter((s) => s.id !== opt.id)
          : [...f.staff, { id: opt.id, username: opt.username }],
      };
    });
  };

  const toggleAdicao = (key: AdicaoKey) =>
    setForm((f) => ({
      ...f,
      adicoes: f.adicoes.includes(key)
        ? f.adicoes.filter((a) => a !== key)
        : [...f.adicoes, key],
    }));

  const escolherBanner = async (file: File | undefined) => {
    if (!file) return;
    setCarregandoBanner(true);
    try {
      // Banner do evento: 2190x1080 — mantém proporção original, sem cortar.
      const url = await fileImageToDataUrl(file, 1920);
      if (!url) {
        toast.error("Selecione um arquivo de imagem");
        return;
      }
      set("bannerUrl", url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar o banner");
    } finally {
      setCarregandoBanner(false);
    }
  };

  const colarAnexo = async (e: React.ClipboardEvent) => {
    const url = await clipboardImageToDataUrl(e.nativeEvent as ClipboardEvent);
    if (url) {
      e.preventDefault();
      setForm((f) => ({ ...f, anexos: [...f.anexos, url] }));
      toast.success("Imagem anexada");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do evento");
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-5xl rounded-[22px] glass-modal">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5">
          <div className="min-w-0">
            <p className="hc-sobre">
              {evento ? "Editar evento" : "Novo evento"}
            </p>
            <h2 className="hc-titulo mt-1.5 truncate">
              {form.nome || "Sem nome"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="hc-seta"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-5">
          {/* Coluna principal */}
          <div className="space-y-5 lg:col-span-3">
            <div>
              <label className={labelCls}>Nome do evento</label>
              <input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex.: Corrida da Meia-Noite"
                className={cn(inputCls, "mt-1 text-base font-semibold")}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Equipe</label>
                <div className="mt-1">
                  <MinimalSelect
                    value={form.equipe}
                    onChange={(v) => set("equipe", v as EquipeKey)}
                    options={EQUIPES.map((e) => ({ value: e.key, label: `${e.emoji} ${e.label}` }))}
                  />
                </div>
              </div>
              <div>
                <label className={cn(labelCls, "flex items-center gap-1")}>
                  <CalendarDays className="size-3" /> Data
                </label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => set("data", e.target.value)}
                  className={cn(inputCls, "mt-1")}
                />
              </div>
              <div>
                <label className={cn(labelCls, "flex items-center gap-1")}>
                  <Clock className="size-3" /> Horário
                </label>
                <input
                  type="time"
                  value={form.horario}
                  onChange={(e) => set("horario", e.target.value || "21:00")}
                  className={cn(inputCls, "mt-1")}
                />
              </div>
            </div>

            <div>
              <label className={cn(labelCls, "flex items-center gap-1")}>
                <Trophy className="size-3" /> Premiação
              </label>
              <input
                value={form.premiacao}
                onChange={(e) => set("premiacao", e.target.value)}
                placeholder="Ex.: R$ 500.000 + veículo VIP"
                className={cn(inputCls, "mt-1")}
              />
            </div>

            <div>
              <label className={labelCls}>Informações</label>
              <div className="mt-1">
                <RichTextarea
                  value={form.informacoes}
                  onChange={(v) => set("informacoes", v)}
                  rows={7}
                  placeholder="Regras, links, detalhes... (cole imagens com Ctrl+V)"
                  inputClassName={inputCls}
                  onPaste={colarAnexo}
                />
              </div>
              {form.anexos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.anexos.map((src, i) => (
                    <div key={i} className="relative">
                      <img
                        src={src}
                        alt={`Anexo ${i + 1}`}
                        className="size-20 rounded-xl border border-white/[0.08] object-cover"
                      />
                      <button
                        onClick={() =>
                          setForm((f) => ({ ...f, anexos: f.anexos.filter((_, idx) => idx !== i) }))
                        }
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        aria-label="Remover anexo"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banner */}
            <div className="hc-dentro p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="hc-titulo flex items-center gap-1.5">
                    <ImageIcon className="size-4 text-muted-foreground" /> Banner do evento
                  </p>
                  <p className="hc-nota mt-0.5">
                    Tamanho recomendado 2190x1080 — exibido completo, sem cortes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => set("solicitacaoBanner", !form.solicitacaoBanner)}
                    className={cn(
                      "pilula !h-[30px] !gap-1.5 !px-3 !text-xs",
                      form.solicitacaoBanner && "pilula-ativa"
                    )}
                  >
                    <Check className="size-3" />
                    Solicitar banner: {form.solicitacaoBanner ? "Sim" : "Não"}
                  </button>
                  <button
                    onClick={() => bannerInput.current?.click()}
                    className="hc-pilula"
                  >
                    {carregandoBanner ? "Carregando..." : form.bannerUrl ? "Trocar" : "Anexar banner"}
                  </button>
                  <input
                    ref={bannerInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void escolherBanner(e.target.files?.[0])}
                  />
                </div>
              </div>
              {form.bannerUrl && (
                <div className="relative mt-3 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
                  <img
                    src={form.bannerUrl}
                    alt="Banner do evento"
                    className="w-full object-contain"
                    style={{ aspectRatio: "2190 / 1080" }}
                  />
                  <button
                    onClick={() => set("bannerUrl", "")}
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-destructive"
                    aria-label="Remover banner"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-5 lg:col-span-2">
            {/* Staff */}
            <div className="hc-dentro p-4">
              <p className="hc-titulo flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" /> Staff responsável
              </p>

              <button
                onClick={() =>
                  setForm((f) => ({ ...f, todosDaArea: !f.todosDaArea, staff: f.todosDaArea ? f.staff : [] }))
                }
                className={cn(
                  "pilula mt-3 w-full justify-center !text-xs",
                  form.todosDaArea && "pilula-ativa"
                )}
              >
                Todos da área {equipe.label} ({daArea})
              </button>

              <label className="campo-busca mt-3">
                <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar pelo nome..."
                  aria-label="Pesquisar pelo nome"
                />
              </label>

              {form.staff.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {form.staff.map((s) => (
                    <span
                      key={s.id}
                      className="hc-selo !text-foreground"
                    >
                      {s.username}
                      <button
                        onClick={() =>
                          setForm((f) => ({ ...f, staff: f.staff.filter((x) => x.id !== s.id) }))
                        }
                        aria-label={`Remover ${s.username}`}
                      >
                        <X className="size-3 text-muted-foreground" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                {filtrados.map((opt) => {
                  const ativo = selecionados.has(opt.id);
                  const naArea = opt.areas.includes(equipe.area);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleStaff(opt)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                        ativo
                          ? "bg-white/[0.08] text-foreground"
                          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                      )}
                    >
                      <span className="truncate font-semibold">{opt.username}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {naArea && <span className="text-[10px] opacity-70">{equipe.emoji}</span>}
                        {ativo && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })}
                {filtrados.length === 0 && (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    Nenhum usuário encontrado.
                  </p>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <div className="mt-1.5 space-y-1.5">
                {STATUS_LIST.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => set("status", s.key as EventoStatus)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                      form.status === s.key
                        ? s.style
                        : "border-white/[0.08] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{s.emoji}</span> {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Adições */}
            <div>
              <label className={labelCls}>Adições</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  onClick={() => set("adicoes", [])}
                  className={cn(
                    "pilula !h-8 !px-3 !text-xs",
                    form.adicoes.length === 0 && "pilula-ativa"
                  )}
                >
                  Não tem
                </button>
                {ADICOES.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => toggleAdicao(a.key)}
                    className={cn(
                      "pilula !h-8 !px-3 !text-xs",
                      form.adicoes.includes(a.key) && "pilula-ativa"
                    )}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequência */}
            <div className="hc-dentro p-4">
              <p className="hc-titulo flex items-center gap-1.5">
                <Repeat className="size-4 text-muted-foreground" /> Frequência
              </p>
              <div className="mt-2">
                <MinimalSelect
                  value={form.frequencia}
                  onChange={(v) => set("frequencia", v as FrequenciaKey)}
                  options={[
                    { value: "unico", label: "Evento único" },
                    { value: "semanal", label: "Toda semana (recorrente)" },
                  ]}
                />
              </div>
              {form.frequencia === "semanal" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Dia da semana</label>
                    <div className="mt-1">
                      <MinimalSelect
                        value={String(form.frequenciaDia ?? "")}
                        onChange={(v) => set("frequenciaDia", v === "" ? null : Number(v))}
                        options={[
                          { value: "", label: "Usar a data escolhida" },
                          ...DIAS_SEMANA.map((d) => ({ value: String(d.valor), label: d.label })),
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Repetir X vezes</label>
                    <input
                      type="number"
                      min={0}
                      max={52}
                      value={form.frequenciaRepeticoes}
                      onChange={(e) => set("frequenciaRepeticoes", Math.max(0, Number(e.target.value) || 0))}
                      className={cn(inputCls, "mt-1")}
                    />
                  </div>
                  {!evento && (
                    <p className="col-span-2 text-[11px] text-muted-foreground">
                      As próximas {form.frequenciaRepeticoes} semanas serão criadas automaticamente.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] p-5">
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Descartar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {evento ? "Salvar alterações" : "Criar evento"}
          </button>
        </footer>
      </div>
    </div>
  );
}
