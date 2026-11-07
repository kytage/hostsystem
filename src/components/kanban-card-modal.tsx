import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Paperclip,
  MessageSquare,
  History,
  ListChecks,
  StickyNote,
  FileText,
  Save,
  RotateCcw,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { RichTextarea } from "@/components/rich-textarea";
import { RichText } from "@/components/rich-text";
import {
  addComentario,
  CATEGORIA_LABEL,
  fetchComentarios,
  fetchHistorico,
  fmtDataHora,
  isDevColuna,
  TESTE_OPCOES,
  updateCard,
  type Anexo,
  type Categoria,
  type ChecklistItem,
  type KanbanCard,
  type Prioridade,
} from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import { clipboardImageToDataUrl, nomeImagemColada, pasteImageFromEvent } from "@/lib/clipboard-image";

export const CATEGORIA_STYLE: Record<Categoria, string> = {
  normal: "bg-chart-2/15 text-chart-2",
  ilegal: "bg-accent-foreground/15 text-accent-foreground",
  urgente: "bg-destructive/15 text-destructive",
  carro: "bg-warning/15 text-warning",
};

export const PRIORIDADE_STYLE: Record<Prioridade, string> = {
  alta: "bg-destructive/15 text-destructive",
  media: "bg-warning/15 text-warning",
  baixa: "bg-success/15 text-success",
};

function CopyBtn({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copiar"
      onClick={() => {
        void navigator.clipboard.writeText(texto);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
    >
      {ok ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const inputCls =
  "w-full rounded-xl border border-input bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

interface Props {
  card: KanbanCard;
  username: string;
  onClose: () => void;
}

export function KanbanCardModal({ card, username, onClose }: Props) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(card.titulo);
  const [descricao, setDescricao] = useState(card.descricao);
  const [categoria, setCategoria] = useState<Categoria>(card.categoria);
  const [prioridade, setPrioridade] = useState<Prioridade>(card.prioridade);
  const [obsDev, setObsDev] = useState(card.obsDev);
  const [patchTexto, setPatchTexto] = useState(card.patchTexto);
  const [testeStatus, setTesteStatus] = useState(card.testeStatus ?? "Aguardando teste");
  const [anexos, setAnexos] = useState<Anexo[]>(card.anexos);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist);
  const [novoAnexo, setNovoAnexo] = useState("");
  const [anexoAberto, setAnexoAberto] = useState<Anexo | null>(null);
  const [novoItem, setNovoItem] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [aba, setAba] = useState<"detalhes" | "comentarios" | "historico">("detalhes");

  useRealtimeTable("card_comentarios", [["card-comentarios", card.id]]);
  useRealtimeTable("card_historico", [["card-historico", card.id]]);

  const { data: comentarios = [] } = useQuery({
    queryKey: ["card-comentarios", card.id],
    queryFn: () => fetchComentarios(card.id),
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["card-historico", card.id],
    queryFn: () => fetchHistorico(card.id),
  });

  const salvar = useMutation({
    mutationFn: (fields: Parameters<typeof updateCard>[1]) => updateCard(card.id, fields),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] }),
  });

  const comentar = useMutation({
    mutationFn: (texto: string) => addComentario(card.id, username, texto),
    onSuccess: () => {
      setNovoComentario("");
      void queryClient.invalidateQueries({ queryKey: ["card-comentarios", card.id] });
    },
  });

  /** Campos editáveis com pendência de gravação (salvar/descartar explícito). */
  const temAlteracoes =
    titulo.trim() !== card.titulo ||
    descricao.trim() !== card.descricao ||
    obsDev.trim() !== card.obsDev ||
    patchTexto.trim() !== card.patchTexto ||
    categoria !== card.categoria ||
    prioridade !== card.prioridade;

  const salvarAlteracoes = () => {
    salvar.mutate({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      obs_dev: obsDev.trim(),
      patch_texto: patchTexto.trim(),
      categoria,
      prioridade,
    });
  };

  const descartarAlteracoes = () => {
    setTitulo(card.titulo);
    setDescricao(card.descricao);
    setObsDev(card.obsDev);
    setPatchTexto(card.patchTexto);
    setCategoria(card.categoria);
    setPrioridade(card.prioridade);
  };


  const salvarAnexos = (lista: Anexo[]) => {
    setAnexos(lista);
    salvar.mutate({ anexos: lista });
  };

  const salvarChecklist = (lista: ChecklistItem[]) => {
    setChecklist(lista);
    salvar.mutate({ checklist: lista });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const emTeste = card.coluna === "teste";
  const emDev = isDevColuna(card.coluna);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl glass">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                #{card.numero}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  CATEGORIA_STYLE[categoria]
                )}
              >
                {CATEGORIA_LABEL[categoria]}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                  PRIORIDADE_STYLE[prioridade]
                )}
              >
                {prioridade}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {card.status}
              </span>
            </div>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}

              className="mt-2 w-full bg-transparent text-lg font-semibold text-foreground outline-none font-display"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>
                Criado por <span className="font-semibold text-foreground/80">{card.criadoPor || "—"}</span>
              </span>
              {card.aprovadoPor && (
                <span>
                  Aprovado por <span className="font-semibold text-foreground/80">{card.aprovadoPor}</span>
                </span>
              )}
              <span>{fmtDataHora(card.createdAt)}</span>
              {card.responsavel && <span>· Responsável: {card.responsavel}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-border px-5 pt-3">
          {(
            [
              ["detalhes", "Detalhes", FileText],
              ["comentarios", `Comentários (${comentarios.length})`, MessageSquare],
              ["historico", `Histórico (${historico.length})`, History],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors",
                aba === key
                  ? "bg-white/[0.05] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          {aba === "detalhes" && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Coluna esquerda: Descrição total */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Descrição
                </label>
                <RichTextarea
                  value={descricao}
                  onChange={setDescricao}
                  rows={28}
                  inputClassName={cn(inputCls, "h-full min-h-[560px] w-full resize-y")}
                />
              </div>

              {/* Coluna direita: outras infos */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Categoria
                    </label>
                    <MinimalSelect
                      value={categoria}
                      onChange={(val) => setCategoria(val as Categoria)}
                      options={Object.entries(CATEGORIA_LABEL).map(([k, l]) => ({
                        value: k,
                        label: l,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Prioridade
                    </label>
                    <MinimalSelect
                      value={prioridade}
                      onChange={(val) => setPrioridade(val as Prioridade)}

                      options={[
                        { value: "alta", label: "Alta" },
                        { value: "media", label: "Média" },
                        { value: "baixa", label: "Baixa" },
                      ]}
                    />
                  </div>
                </div>

                {emTeste && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Situação do teste
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TESTE_OPCOES.map((op) => (
                        <button
                          key={op}
                          onClick={() => {
                            setTesteStatus(op);
                            salvar.mutate({ teste_status: op });
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                            testeStatus === op
                              ? op === "Aprovado"
                                ? "border-success bg-success/15 text-success"
                                : op === "Reprovado"
                                  ? "border-destructive bg-destructive/15 text-destructive"
                                  : "border-white/15 bg-white/[0.09] text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <StickyNote className="size-3.5" /> Observações do desenvolvedor (interno)
                  </label>
                  <textarea
                    value={obsDev}
                    onChange={(e) => setObsDev(e.target.value)}

                    rows={2}
                    placeholder="Anotações técnicas, não aparecem no Patch Note"
                    className={cn(inputCls, "resize-none")}
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <FileText className="size-3.5" /> Texto para Patch Note
                  </label>
                  <div className="relative">
                    <textarea
                      value={patchTexto}
                      onChange={(e) => setPatchTexto(e.target.value)}

                      rows={2}
                      placeholder="Ex.: Corrigido o sistema de drive-by da Polícia. (vazio = IA gera)"
                      className={cn(inputCls, "resize-none pr-9")}
                    />
                    {patchTexto && (
                      <span className="absolute right-3 top-3">
                        <CopyBtn texto={patchTexto} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Checklist */}
                <div className="rounded-xl border border-border p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <ListChecks className="size-3.5" /> Checklist
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {checklist.map((item, i) => (
                      <div key={i} className="group flex items-center gap-2">
                        <button
                          onClick={() =>
                            salvarChecklist(
                              checklist.map((c, j) =>
                                j === i ? { ...c, feito: !c.feito } : c
                              )
                            )
                          }
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            item.feito
                              ? "border-success bg-success text-success-foreground"
                              : "border-border"
                          )}
                          aria-label={item.feito ? "Desmarcar" : "Marcar"}
                        >
                          {item.feito && <Check className="size-3" />}
                        </button>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            item.feito
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          )}
                        >
                          {item.texto}
                        </span>
                        <button
                          onClick={() =>
                            salvarChecklist(checklist.filter((_, j) => j !== i))
                          }
                          aria-label="Remover item"
                          className="text-muted-foreground/0 hover:text-destructive group-hover:text-muted-foreground"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={novoItem}
                      onChange={(e) => setNovoItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && novoItem.trim()) {
                          salvarChecklist([
                            ...checklist,
                            { texto: novoItem.trim(), feito: false },
                          ]);
                          setNovoItem("");
                        }
                      }}
                      placeholder="Adicionar item..."
                      className="flex-1 rounded-lg border border-input bg-black/25 px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                    <button
                      onClick={() => {
                        if (!novoItem.trim()) return;
                        salvarChecklist([
                          ...checklist,
                          { texto: novoItem.trim(), feito: false },
                        ]);
                        setNovoItem("");
                      }}
                      className="rounded-lg bg-white/[0.05] px-2.5 text-foreground hover:bg-white/[0.08]"
                      aria-label="Adicionar item"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Datas do fluxo */}
                <div className="rounded-xl border border-border p-3.5 text-xs text-muted-foreground">
                  <p>Entrou em desenvolvimento: {fmtDataHora(card.entrouDevAt)}</p>
                  <p className="mt-1">
                    Concluído: {fmtDataHora(card.concluidoAt)}
                    {card.concluidoPor && ` por ${card.concluidoPor}`}
                  </p>
                </div>

                {/* Anexos / Imagens com previews grandes */}
                <div className="rounded-xl border border-border p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Paperclip className="size-3.5" /> Anexos / Imagens ({anexos.length})
                  </p>
                  {anexos.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {anexos.map((a, i) => {
                        const isImg =
                          a.url.startsWith("data:image/") ||
                          /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.url);
                        return (
                          <div
                            key={i}
                            className="group relative overflow-hidden rounded-lg border border-border bg-black/25"
                          >
                            {isImg ? (
                              <button
                                type="button"
                                onClick={() => setAnexoAberto(a)}
                                className="block w-full cursor-zoom-in"
                                title={a.nome}
                                aria-label={`Expandir imagem ${a.nome}`}
                              >
                                <img
                                  src={a.url}
                                  alt={a.nome}
                                  className="h-40 w-full object-contain bg-black/25 transition-transform group-hover:scale-105"
                                />
                              </button>
                            ) : (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-40 flex-col items-center justify-center gap-2 p-3 text-center"
                              >
                                <Paperclip className="size-8 text-muted-foreground" />
                                <span className="line-clamp-2 text-xs text-primary hover:underline">
                                  {a.nome}
                                </span>
                              </a>
                            )}
                            <div className="flex items-center justify-between gap-1 border-t border-border bg-card/80 px-2 py-1.5">
                              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                                {a.nome}
                              </span>
                              <CopyBtn texto={a.url} />
                              <button
                                onClick={() => salvarAnexos(anexos.filter((_, j) => j !== i))}
                                aria-label="Remover anexo"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {anexos.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Nenhum anexo.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      value={novoAnexo}
                      onChange={(e) => setNovoAnexo(e.target.value)}
                      onPaste={(e) => {
                        void clipboardImageToDataUrl(e.nativeEvent).then((dataUrl) => {
                          if (!dataUrl) return;
                          e.preventDefault();
                          salvarAnexos([...anexos, { nome: nomeImagemColada(), url: dataUrl }]);
                        });
                      }}
                      placeholder="Cole URL ou Ctrl+V com print..."
                      className="flex-1 rounded-lg border border-input bg-black/25 px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                    <button
                      onClick={() => {
                        const url = novoAnexo.trim();
                        if (!url) return;
                        const nome = url.split("/").pop()?.slice(0, 40) || "anexo";
                        salvarAnexos([...anexos, { nome, url }]);
                        setNovoAnexo("");
                      }}
                      className="rounded-lg bg-white/[0.05] px-2.5 text-foreground hover:bg-white/[0.08]"
                      aria-label="Adicionar anexo"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                    Dica: copie um print e pressione Ctrl+V no campo acima para anexar.
                  </p>
                </div>
              </div>
            </div>
          )}




          {aba === "comentarios" && (
            <div className="space-y-3">
              {comentarios.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum comentário ainda.
                </p>
              )}
              {comentarios.map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-foreground">
                    {c.autor}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {fmtDataHora(c.createdAt)}
                    </span>
                  </p>
                  {c.texto.startsWith("data:image/") ? (
                    <img
                      src={c.texto}
                      alt="Imagem enviada no comentário"
                      className="mt-2 max-h-64 rounded-lg border border-border"
                    />
                  ) : (
                    <RichText value={c.texto} className="mt-1" />
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novoComentario.trim())
                      comentar.mutate(novoComentario.trim());
                  }}
                  onPaste={(e) =>
                    pasteImageFromEvent(e, (dataUrl) => comentar.mutate(dataUrl))
                  }
                  placeholder="Escreva um comentário ou cole um print (Ctrl+V)..."
                  className={inputCls}
                />
                <button
                  onClick={() => novoComentario.trim() && comentar.mutate(novoComentario.trim())}
                  disabled={comentar.isPending}
                  className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {comentar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Enviar"
                  )}
                </button>
              </div>
            </div>
          )}

          {aba === "historico" && (
            <div className="space-y-2">
              {historico.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação registrada.
                </p>
              )}
              {historico.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border px-3.5 py-2.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{h.autor}</span> moveu de{" "}
                    <span className="font-semibold text-foreground">{h.deColuna}</span> para{" "}
                    <span className="font-semibold text-foreground">{h.paraColuna}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground/70">
                    {fmtDataHora(h.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barra de ações: salvar ou descartar alterações */}
        {temAlteracoes && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-white/[0.035] px-5 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Você tem alterações não salvas nesta pendência.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={descartarAlteracoes}
                disabled={salvar.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" /> Descartar
              </button>
              <button
                type="button"
                onClick={salvarAlteracoes}
                disabled={salvar.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {salvar.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Salvar alterações
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Lightbox do anexo — abre na mesma aba, dentro do site */}
      {anexoAberto && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Imagem ampliada: ${anexoAberto.nome}`}
        >
          <button
            type="button"
            onClick={() => setAnexoAberto(null)}
            aria-label="Fechar imagem"
            className="absolute right-4 top-4 rounded-full glass-modal p-2 text-foreground transition-colors hover:bg-white/[0.08]"
          >
            <X className="size-5" />
          </button>
          <img
            src={anexoAberto.url}
            alt={anexoAberto.nome}
            className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
          />
          <p className="mt-3 max-w-[92vw] truncate text-xs text-muted-foreground">
            {anexoAberto.nome}
          </p>
        </div>
      )}
    </div>
  );
}
