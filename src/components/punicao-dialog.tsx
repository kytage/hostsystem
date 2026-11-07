import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Siren, ShieldAlert, Check, Trash2, ImagePlus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileImageToDataUrl } from "@/lib/clipboard-image";
import {
  MOTIVOS,
  PUNICOES_OPCOES,
  PUNICOES_VAR,
  RESULTADOS_VAR,
  USERSETS,
  fetchResponsaveisDenuncia,
  fetchSetagensIlegal,
  parseLista,
  paraDataInput,
  deDataInput,
  type PunicaoInput,
  type PunicaoRow,
  type PunicaoTipo,
} from "@/lib/punicoes";

interface PunicaoDialogProps {
  /** Quando ausente, o modal inicia na seleção de área. */
  tipo?: PunicaoTipo | null;
  /** Libera a área VAR (Coordinator+ ou área "var"). */
  podeVar?: boolean;
  /** Libera a área Denúncias (Coordinator+ ou área "denuncias"). */
  podeDenuncia?: boolean;
  registro?: PunicaoRow | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: PunicaoInput) => void;
}

const vazio = (tipo: PunicaoTipo): PunicaoInput => ({
  tipo,
  data_punicao: paraDataInput(),
  ticket_id: "",
  resultado: "",
  responsaveis: [],
  jogador: "",
  jogador_id: "",
  userset: "",
  userset_sub: "",
  motivo: "",
  punicao: "",
  dias: null,
  duracao: "",
  provas: "",
  anexos: [],
  observacao: "",
});

const inputCls =
  "w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60";
const labelCls =
  "space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/**
 * Registro/edição de punição. Passo 1: escolha da área (Denúncia ou VAR).
 * Passo 2: formulário. Fecha somente pelo X ou Cancelar.
 */
export function PunicaoDialog({
  tipo,
  podeVar = false,
  podeDenuncia = true,
  registro,
  saving = false,
  onClose,
  onSubmit,
}: PunicaoDialogProps) {
  /** Com acesso a apenas uma das áreas, o passo de escolha é dispensado. */
  const areaInicial: PunicaoTipo | null = registro
    ? (registro.tipo as PunicaoTipo)
    : (tipo ?? (podeDenuncia && !podeVar ? "denuncia" : !podeDenuncia && podeVar ? "var" : null));
  const [area, setArea] = useState<PunicaoTipo | null>(areaInicial);

  const [form, setForm] = useState<PunicaoInput>(vazio(area ?? "denuncia"));
  const [abrirResponsaveis, setAbrirResponsaveis] = useState(false);
  const [abrirMotivo, setAbrirMotivo] = useState(false);

  useEffect(() => {
    if (registro) {
      setForm({
        tipo: registro.tipo as PunicaoTipo,
        data_punicao: paraDataInput(registro.data_punicao),
        ticket_id: registro.ticket_id ?? "",
        resultado: (registro as { resultado?: string }).resultado ?? "",
        responsaveis: parseLista(registro.responsaveis),
        jogador: registro.jogador,
        jogador_id: registro.jogador_id,
        userset: registro.userset ?? "",
        userset_sub: registro.userset_sub ?? "",
        motivo: registro.motivo,
        punicao: registro.punicao,
        dias: registro.dias ?? null,
        duracao: registro.duracao,
        provas: registro.provas,
        anexos: parseLista(registro.anexos),
        observacao: registro.observacao,
      });
    } else if (area) {
      setForm(vazio(area));
    }
  }, [registro, area]);

  const set = <K extends keyof PunicaoInput>(key: K, value: PunicaoInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { data: responsaveisDisponiveis = [] } = useQuery({
    queryKey: ["responsaveis-denuncia"],
    queryFn: fetchResponsaveisDenuncia,
    staleTime: 60_000,
    enabled: area === "denuncia",
  });

  const { data: setagens = [] } = useQuery({
    queryKey: ["ilegal-setagens"],
    queryFn: fetchSetagensIlegal,
    staleTime: 60_000,
    enabled: area !== null,
  });

  const punicaoAtual = PUNICOES_OPCOES.find((p) => p.label === form.punicao);
  const podeSalvar =
    form.ticket_id.trim().length > 0 &&
    form.jogador_id.trim().length > 0 &&
    form.punicao.length > 0 &&
    (area === "var" ? form.resultado.length > 0 : form.motivo.length > 0);

  const toggleResponsavel = (nome: string) =>
    set(
      "responsaveis",
      form.responsaveis.includes(nome)
        ? form.responsaveis.filter((r) => r !== nome)
        : [...form.responsaveis, nome]
    );

  const handleArquivos = async (files: FileList | null) => {
    if (!files) return;
    const novos: string[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileImageToDataUrl(file);
      if (dataUrl) novos.push(dataUrl);
    }
    if (novos.length > 0) set("anexos", [...form.anexos, ...novos]);
  };

  const submit = () =>
    onSubmit({
      ...form,
      tipo: area ?? "denuncia",
      data_punicao: deDataInput(form.data_punicao ?? ""),
      duracao:
        punicaoAtual?.dias && form.dias
          ? `${form.dias} dia${form.dias > 1 ? "s" : ""}`
          : form.punicao === "Banimento Permanente"
            ? "Permanente"
            : "",
      dias: punicaoAtual?.dias ? form.dias : null,
    });

  /** Campo de data do registro — compartilhado entre Denúncia e VAR. */
  const campoData = (
    <label className={labelCls}>
      Data
      <input
        type="date"
        className={inputCls}
        value={form.data_punicao ?? paraDataInput()}
        onChange={(e) => set("data_punicao", e.target.value)}
      />
    </label>
  );

  /** Campo de link de registro/prova — compartilhado entre Denúncia e VAR. */
  const campoLink = (
    <label className={cn(labelCls, "md:col-span-2")}>
      Link de registro (prova)
      <input
        className={inputCls}
        value={form.provas}
        onChange={(e) => set("provas", e.target.value)}
        placeholder="https://discord.com/channels/..."
      />
    </label>
  );

  /** Bloco de anexos (imagens) — compartilhado entre Denúncia e VAR. */
  const blocoAnexos = (
    <div className={cn(labelCls, "md:col-span-2")}>
      Anexos (imagens)
      <div className="flex flex-wrap items-center gap-2">
        {form.anexos.map((src, i) => (
          <div
            key={`${i}-${src.slice(-16)}`}
            className="group relative size-20 overflow-hidden rounded-lg border border-border"
          >
            <img src={src} alt={`Prova ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label="Remover anexo"
              onClick={() =>
                set("anexos", form.anexos.filter((_, idx) => idx !== i))
              }
              className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
          <ImagePlus className="size-4" />
          <span className="text-[10px] normal-case">Adicionar</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleArquivos(e.target.files)}
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl glass-modal p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              {area === "var" ? "VAR" : area === "denuncia" ? "Denúncia" : "Selecionar área"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground font-display">
              {registro ? "Editar punição" : "Nova punição"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Passo 1 — escolha da área */}
        {!area ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => podeDenuncia && setArea("denuncia")}
              disabled={!podeDenuncia}
              className={cn(
                "rounded-xl border border-border p-5 text-left transition-colors",
                podeDenuncia
                  ? "hover:border-primary hover:bg-muted/40"
                  : "cursor-not-allowed opacity-50"
              )}
            >
              <Siren className="size-5 text-primary" />
              <p className="mt-3 text-base font-semibold text-foreground">Denúncia</p>
              <p className="text-xs text-muted-foreground">
                {podeDenuncia
                  ? "Punições normais originadas de tickets de denúncia."
                  : "Apenas Coordinator+ ou área Denúncias."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => podeVar && setArea("var")}
              disabled={!podeVar}
              className={cn(
                "rounded-xl border border-border p-5 text-left transition-colors",
                podeVar
                  ? "hover:border-primary hover:bg-muted/40"
                  : "cursor-not-allowed opacity-50"
              )}
            >
              <ShieldAlert className="size-5 text-blue-500" />
              <p className="mt-3 text-base font-semibold text-foreground">VAR</p>
              <p className="text-xs text-muted-foreground">
                {podeVar
                  ? "Punições de hack analisadas pelo VAR."
                  : "Apenas Coordinator+ ou área VAR."}
              </p>
            </button>
          </div>
        ) : area === "var" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelCls}>
                Ticket
                <input
                  className={inputCls}
                  value={form.ticket_id}
                  onChange={(e) =>
                    set("ticket_id", e.target.value.toUpperCase().slice(0, 12))
                  }
                  placeholder="Ex: A7F12B"
                />
              </label>

              <label className={labelCls}>
                ID
                <input
                  className={inputCls}
                  value={form.jogador_id}
                  onChange={(e) => set("jogador_id", e.target.value)}
                  placeholder="Ex: 1042"
                />
              </label>

              {campoData}

              <label className={labelCls}>
                Userset
                <select
                  className={inputCls}
                  value={form.userset}
                  onChange={(e) => {
                    set("userset", e.target.value);
                    set("userset_sub", "");
                  }}
                >
                  <option value="">Selecione...</option>
                  {USERSETS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.userset === "ilegal" ? (
                <label className={labelCls}>
                  Sub-set (setagem do Ilegal)
                  <select
                    className={inputCls}
                    value={form.userset_sub}
                    onChange={(e) => set("userset_sub", e.target.value)}
                  >
                    <option value="">Selecione a setagem...</option>
                    {setagens.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={labelCls}>
                  Nome do jogador (opcional)
                  <input
                    className={inputCls}
                    value={form.jogador}
                    onChange={(e) => set("jogador", e.target.value)}
                    placeholder="Nome do analisado"
                  />
                </label>
              )}

              <div className={cn(labelCls, "md:col-span-2")}>
                Resultado
                <div className="flex flex-wrap items-center gap-2">
                  {RESULTADOS_VAR.map((r) => {
                    const ativo = form.resultado === r.label;
                    return (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => set("resultado", r.label)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold normal-case transition-colors",
                          ativo
                            ? r.destaque
                              ? "border-white/15 bg-white/[0.09] text-foreground"
                              : "border-foreground/40 bg-muted text-foreground"
                            : r.destaque
                              ? "border-primary/40 text-primary hover:bg-primary/10"
                              : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={cn(labelCls, "md:col-span-2")}>
                Punição
                <div className="flex flex-wrap items-center gap-2">
                  {PUNICOES_VAR.map((p) => {
                    const ativo = form.punicao === p.label;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => set("punicao", p.label)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold normal-case transition-colors",
                          ativo
                            ? p.destaque
                              ? "border-white/15 bg-white/[0.09] text-foreground"
                              : "border-foreground/40 bg-muted text-foreground"
                            : p.destaque
                              ? "border-primary/40 text-primary hover:bg-primary/10"
                              : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {campoLink}

              {blocoAnexos}

              <label className={cn(labelCls, "md:col-span-2")}>
                Observação
                <textarea
                  className={cn(inputCls, "min-h-[90px] resize-y normal-case")}
                  value={form.observacao}
                  onChange={(e) => set("observacao", e.target.value)}
                  placeholder="Detalhes da análise do VAR..."
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {!registro && !tipo ? (
                <button
                  type="button"
                  onClick={() => setArea(null)}
                  className="mr-auto rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!podeSalvar || saving}
                onClick={submit}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {registro ? "Salvar" : "Registrar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelCls}>
                ID do ticket
                <input
                  className={inputCls}
                  value={form.ticket_id}
                  onChange={(e) =>
                    set("ticket_id", e.target.value.toUpperCase().slice(0, 12))
                  }
                  placeholder="Ex: A7F12B"
                />
              </label>

              <label className={labelCls}>
                ID do denunciado
                <input
                  className={inputCls}
                  value={form.jogador_id}
                  onChange={(e) => set("jogador_id", e.target.value)}
                  placeholder="Ex: 1042"
                />
              </label>

              {campoData}

              <div className={cn(labelCls, "md:col-span-2")}>
                Responsáveis (área Denúncias)
                <button
                  type="button"
                  onClick={() => setAbrirResponsaveis((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-black/25 px-3 py-2 text-sm normal-case text-foreground transition-colors hover:border-foreground/30"
                >
                  <span className={form.responsaveis.length === 0 ? "text-muted-foreground/60" : ""}>
                    {form.responsaveis.length === 0
                      ? "Clique para selecionar..."
                      : form.responsaveis.join(", ")}
                  </span>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", abrirResponsaveis && "rotate-180")}
                  />
                </button>
                {abrirResponsaveis ? (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-black/25 p-2">
                    {responsaveisDisponiveis.length === 0 ? (
                      <span className="px-1 py-0.5 text-xs normal-case text-muted-foreground">
                        Nenhum usuário com a área "Denuncias" cadastrada.
                      </span>
                    ) : (
                      responsaveisDisponiveis.map((nome) => {
                        const ativo = form.responsaveis.includes(nome);
                        return (
                          <button
                            key={nome}
                            type="button"
                            onClick={() => toggleResponsavel(nome)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold normal-case transition-colors",
                              ativo
                                ? "border-white/15 bg-white/[0.09] text-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {ativo ? <Check className="size-3" /> : null}
                            {nome}
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>

              <label className={labelCls}>
                Userset
                <select
                  className={inputCls}
                  value={form.userset}
                  onChange={(e) => {
                    set("userset", e.target.value);
                    set("userset_sub", "");
                  }}
                >
                  <option value="">Selecione...</option>
                  {USERSETS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.userset === "ilegal" ? (
                <label className={labelCls}>
                  Sub-set (setagem do Ilegal)
                  <select
                    className={inputCls}
                    value={form.userset_sub}
                    onChange={(e) => set("userset_sub", e.target.value)}
                  >
                    <option value="">Selecione a setagem...</option>
                    {setagens.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={labelCls}>
                  Nome do jogador (opcional)
                  <input
                    className={inputCls}
                    value={form.jogador}
                    onChange={(e) => set("jogador", e.target.value)}
                    placeholder="Nome do denunciado"
                  />
                </label>
              )}

              <div className={cn(labelCls, "md:col-span-2")}>
                Motivo
                <button
                  type="button"
                  onClick={() => setAbrirMotivo((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-black/25 px-3 py-2 text-sm normal-case text-foreground transition-colors hover:border-foreground/30"
                >
                  <span className={form.motivo ? "" : "text-muted-foreground/60"}>
                    {form.motivo || "Clique para selecionar..."}
                  </span>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", abrirMotivo && "rotate-180")}
                  />
                </button>
                {abrirMotivo ? (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-black/25 p-2">
                    {MOTIVOS.map((m) => {
                      const ativo = form.motivo === m.label;
                      return (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => set("motivo", m.label)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold normal-case transition-colors",
                            ativo
                              ? m.destaque
                                ? "border-white/15 bg-white/[0.09] text-foreground"
                                : "border-foreground/40 bg-muted text-foreground"
                              : m.destaque
                                ? "border-primary/40 text-primary hover:bg-primary/10"
                                : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className={cn(labelCls, "md:col-span-2")}>
                Punição
                <div className="flex flex-wrap items-center gap-2">
                  {PUNICOES_OPCOES.map((p) => {
                    const ativo = form.punicao === p.label;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => set("punicao", p.label)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold normal-case transition-colors",
                          ativo
                            ? p.destaque
                              ? "border-white/15 bg-white/[0.09] text-foreground"
                              : "border-foreground/40 bg-muted text-foreground"
                            : p.destaque
                              ? "border-primary/40 text-primary hover:bg-primary/10"
                              : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  {punicaoAtual?.dias ? (
                    <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs normal-case text-muted-foreground">
                      Dias
                      <input
                        type="number"
                        min={1}
                        value={form.dias ?? ""}
                        onChange={(e) =>
                          set("dias", e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-16 rounded border border-border bg-black/25 px-2 py-0.5 text-xs text-foreground outline-none focus:border-primary/60"
                      />
                    </span>
                  ) : null}
                </div>
              </div>

              {campoLink}

              {blocoAnexos}

              <label className={cn(labelCls, "md:col-span-2")}>
                Observação
                <textarea
                  className={cn(inputCls, "min-h-[110px] resize-y normal-case")}
                  value={form.observacao}
                  onChange={(e) => set("observacao", e.target.value)}
                  placeholder="Detalhes da análise, contexto, reincidência..."
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {!registro && !tipo ? (
                <button
                  type="button"
                  onClick={() => setArea(null)}
                  className="mr-auto rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!podeSalvar || saving}
                onClick={submit}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {registro ? "Salvar" : "Registrar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
