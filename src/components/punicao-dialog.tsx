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
  "w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm font-normal tracking-normal text-foreground outline-none placeholder:text-ink-3 focus:border-white/25";
/** Rótulo do campo no padrão da HOME. O que fica dentro dele usa `font-normal` e `tracking-normal` para não herdar o negrito e o espaçamento largo. */
const labelCls = "hc-sobre flex flex-col gap-1.5";

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
            className="group relative size-20 overflow-hidden rounded-xl border border-white/[0.08]"
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
        <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/[0.1] text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground">
          <ImagePlus className="size-4" />
          <span className="text-[10px] normal-case tracking-normal">Adicionar</span>
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
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[22px] glass-modal p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="hc-sobre">
              {area === "var" ? "VAR" : area === "denuncia" ? "Denúncia" : "Selecionar área"}
            </p>
            <h2 className="hc-titulo mt-1.5">
              {registro ? "Editar punição" : "Nova punição"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
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
                "hc-dentro p-5 text-left transition-colors",
                !podeDenuncia && "cursor-not-allowed opacity-50"
              )}
            >
              <span className="hc-icone">
                <Siren className="size-4" strokeWidth={1.75} />
              </span>
              <p className="hc-titulo mt-3">Denúncia</p>
              <p className="hc-nota mt-1">
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
                "hc-dentro p-5 text-left transition-colors",
                !podeVar && "cursor-not-allowed opacity-50"
              )}
            >
              <span className="hc-icone">
                <ShieldAlert className="size-4" strokeWidth={1.75} />
              </span>
              <p className="hc-titulo mt-3">VAR</p>
              <p className="hc-nota mt-1">
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
                          "pilula !h-8 !px-3 !text-xs normal-case tracking-normal",
                          ativo ? "pilula-ativa" : r.destaque && "!border-primary/40 !text-primary"
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
                          "pilula !h-8 !px-3 !text-xs normal-case tracking-normal",
                          ativo ? "pilula-ativa" : p.destaque && "!border-primary/40 !text-primary"
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
                  className="pilula mr-auto rounded-full"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="pilula rounded-full"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!podeSalvar || saving}
                onClick={submit}
                className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
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
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground transition-colors hover:border-white/20"
                >
                  <span className={form.responsaveis.length === 0 ? "text-ink-3" : ""}>
                    {form.responsaveis.length === 0
                      ? "Clique para selecionar..."
                      : form.responsaveis.join(", ")}
                  </span>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", abrirResponsaveis && "rotate-180")}
                  />
                </button>
                {abrirResponsaveis ? (
                  <div className="hc-dentro flex flex-wrap gap-2 p-2">
                    {responsaveisDisponiveis.length === 0 ? (
                      <span className="px-1 py-0.5 text-xs font-normal normal-case tracking-normal text-muted-foreground">
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
                              "pilula !h-8 !gap-1.5 !px-3 !text-xs normal-case tracking-normal",
                              ativo && "pilula-ativa"
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
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground transition-colors hover:border-white/20"
                >
                  <span className={form.motivo ? "" : "text-ink-3"}>
                    {form.motivo || "Clique para selecionar..."}
                  </span>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", abrirMotivo && "rotate-180")}
                  />
                </button>
                {abrirMotivo ? (
                  <div className="hc-dentro flex flex-wrap gap-2 p-2">
                    {MOTIVOS.map((m) => {
                      const ativo = form.motivo === m.label;
                      return (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => set("motivo", m.label)}
                          className={cn(
                            "pilula !h-8 !px-3 !text-xs normal-case tracking-normal",
                            ativo
                              ? "pilula-ativa"
                              : m.destaque && "!border-primary/40 !text-primary"
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
                          "pilula !h-8 !px-3 !text-xs normal-case tracking-normal",
                          ativo ? "pilula-ativa" : p.destaque && "!border-primary/40 !text-primary"
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  {punicaoAtual?.dias ? (
                    <span className="flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1 text-xs normal-case tracking-normal text-muted-foreground">
                      Dias
                      <input
                        type="number"
                        min={1}
                        value={form.dias ?? ""}
                        onChange={(e) =>
                          set("dias", e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-16 rounded-md border border-white/[0.08] bg-black/25 px-2 py-0.5 text-xs font-normal text-foreground outline-none focus:border-white/25"
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
                  className="pilula mr-auto rounded-full"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="pilula rounded-full"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!podeSalvar || saving}
                onClick={submit}
                className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
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
