import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bug,
  Car,
  Check,
  AlertTriangle,
  ClipboardList,
  FileText,
  History,
  Inbox,
  Loader2,
  MessageSquare,
  Paperclip,
  PauseCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AREAS,
  ROLE_ORDER,
  useMyRole,
} from "@/lib/permissions";
import {
  aprovarPendencia,
  areaLabel,
  atualizarPendencia,
  excluirPendencia,
  enviarParaStandby,
  voltarParaPendente,
  pedirInformacoes,
  resolverObservacao,
  criarSolicitacaoAdmin,
  criarSolicitacaoArea,
  fetchPendenciasArea,
  fetchSolicitacoesAdmin,
  reprovarPendencia,
  TIPO_LABEL,
  type PendenciaArea,
  type TipoSolicitacao,
} from "@/lib/area-manager";
import { getCurrentUsername } from "@/lib/kanban";
import { listCoordinatorPlus } from "@/lib/users.functions";
import { useRealtimeTable } from "@/lib/realtime";
import { nomeImagemColada, pasteImageFromEvent } from "@/lib/clipboard-image";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { RichTextarea } from "@/components/rich-textarea";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/area-manager")({
  head: () => ({
    meta: [
      { title: "Área Manager — FiveM Host" },
      {
        name: "description",
        content:
          "Solicitações das áreas, aprovação pela coordenação e solicitações administrativas.",
      },
      { property: "og:title", content: "Área Manager — FiveM Host" },
      {
        property: "og:description",
        content:
          "Solicitações das áreas, aprovação pela coordenação e solicitações administrativas.",
      },
    ],
  }),
  component: AreaManagerPage,
});

type Aba = "area" | "bugs" | "cars" | "standby" | "admin";

const ABAS: { key: Aba; label: string; icon: typeof Bug }[] = [
  { key: "area", label: "Solicitações Área", icon: ClipboardList },
  { key: "bugs", label: "Report Bugs", icon: Bug },
  { key: "cars", label: "Report Cars", icon: Car },
  { key: "standby", label: "Stand-by", icon: PauseCircle },
  { key: "admin", label: "Solicitações Administrativas", icon: Inbox },
];

/** Cor do pontinho de cada status (o selo em si é neutro, como na tela inicial). */
const statusStyle: Record<string, string> = {
  pendente: "bg-warning",
  standby: "bg-chart-2",
  aprovada: "bg-success",
  reprovada: "bg-destructive",
};

const inputCls =
  "w-full rounded-xl glass-inset px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none";

const PRIORIDADE_OPTS = [
  { value: "baixa", label: "Prioridade baixa" },
  { value: "media", label: "Prioridade média" },
  { value: "alta", label: "Prioridade alta" },
];

function AreaManagerPage() {
  const [aba, setAba] = useState<Aba>("area");
  const { data: myRole } = useMyRole();
  const isCoordinatorPlus =
    ROLE_ORDER.indexOf(myRole ?? "dev") <= ROLE_ORDER.indexOf("coordinator");

  useRealtimeTable("pendencias", [["pendencias-area"]]);
  useRealtimeTable("solicitacoes_admin", [["solicitacoes-admin"]]);

  return (
    <div className="pagina">
      <PageHeader
        title="Área Manager"
        subtitle="Crie solicitações da sua área. Coordinator+ aprova antes de ir para o Desenvolvimento."
      />

      <div className="mt-5 max-w-full overflow-x-auto [scrollbar-width:none]">
        <div className="segmentos" role="tablist" aria-label="Seções do Área Manager">
          {ABAS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={aba === a.key}
              onClick={() => setAba(a.key)}
            >
              <a.icon className="size-3.5" /> {a.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "standby" ? (
        <SecaoStandby isCoordinatorPlus={isCoordinatorPlus} />
      ) : aba !== "admin" ? (
        <SecaoPendencias
          tipo={aba === "area" ? "solicitacao" : aba === "bugs" ? "report_bug" : "report_car"}
          comArea={aba === "area"}
          isCoordinatorPlus={isCoordinatorPlus}
        />
      ) : (
        <SecaoAdmin />
      )}
    </div>
  );
}

function EditarPendenciaDialog({
  p,
  onClose,
}: {
  p: PendenciaArea;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(p.titulo);
  const [descricao, setDescricao] = useState(p.descricao);
  const [prioridade, setPrioridade] = useState(p.prioridade || "media");

  const salvar = useMutation({
    mutationFn: () =>
      atualizarPendencia(p.id, {
        titulo: titulo.trim() || p.titulo,
        descricao: descricao.trim(),
        prioridade,
      }),
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      void queryClient.invalidateQueries({ queryKey: ["pendencias-area"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[22px] glass-modal p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="hc-titulo">Editar solicitação</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
            className={inputCls}
          />
          <RichTextarea
            value={descricao}
            onChange={setDescricao}
            placeholder="Descrição"
            inputClassName={cn(inputCls, "min-h-28 w-full resize-y")}
          />
          <MinimalSelect
            value={prioridade}
            onChange={setPrioridade}
            options={PRIORIDADE_OPTS}
          />
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

function NovaPendenciaDialog({
  tipo,
  comArea,
  onClose,
}: {
  tipo: TipoSolicitacao;
  comArea: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [area, setArea] = useState<string>("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; url: string }[]>([]);

  const criar = useMutation({
    mutationFn: async () => {
      const criadoPor = await getCurrentUsername();
      await criarSolicitacaoArea({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade,
        area: comArea ? (area as never) : "",
        tipo,
        criadoPor,
        anexos,
      });
    },
    onSuccess: () => {
      toast.success("Solicitação criada — aguardando aprovação.");
      void queryClient.invalidateQueries({ queryKey: ["pendencias-area"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const enviar = () => {
    if (!titulo.trim()) {
      toast.error("Informe um título.");
      return;
    }
    if (comArea && !area) {
      toast.error("Selecione a área.");
      return;
    }
    criar.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] glass-modal">
        {/* Header — igual ao modal de edição */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="hc-selo">
                NOVO
              </span>
              <span className="hc-selo">
                {TIPO_LABEL[tipo].toUpperCase()}
              </span>
              <span className="hc-selo capitalize">
                {prioridade === "media" ? "Média" : prioridade}
              </span>
              <span className="hc-selo">
                aguardando aprovação
              </span>
            </div>
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título da solicitação"
              className="mt-2 w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground font-display"
            />
            <div className="hc-nota mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>Nova {TIPO_LABEL[tipo].toLowerCase()} — será enviada para aprovação da coordenação</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Abas — mesmas do modal de edição (só "Detalhes" funciona antes de criar) */}
        <div className="shrink-0 px-5 pt-4">
          <div className="segmentos" role="tablist" aria-label="Seções da solicitação">
            {(
              [
                ["detalhes", "Detalhes", FileText],
                ["comentarios", "Comentários (0)", MessageSquare],
                ["historico", "Histórico (0)", History],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === "detalhes"}
                disabled={key !== "detalhes"}
                className="disabled:opacity-50"
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Coluna esquerda: Descrição total */}
            <div>
              <label className="hc-sobre mb-1.5 block">
                Descrição
              </label>
              <RichTextarea
                value={descricao}
                onChange={setDescricao}
                rows={28}
                placeholder="Descreva com detalhes, links, referências..."
                inputClassName={cn(inputCls, "h-full min-h-[560px] w-full resize-y")}
              />
            </div>

            {/* Coluna direita */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {comArea && (
                  <div>
                    <label className="hc-sobre mb-1.5 block">
                      Área
                    </label>
                    <MinimalSelect
                      value={area}
                      onChange={setArea}
                      placeholder="Selecione a área..."
                      options={AREAS.map((a) => ({ value: a.key, label: a.label }))}
                    />
                  </div>
                )}
                <div>
                  <label className="hc-sobre mb-1.5 block">
                    Prioridade
                  </label>
                  <MinimalSelect
                    value={prioridade}
                    onChange={setPrioridade}
                    options={PRIORIDADE_OPTS}
                  />
                </div>
              </div>

              {/* Anexos / Imagens com previews grandes */}
              <div className="hc-dentro p-3.5">
                <p className="hc-sobre flex items-center gap-1.5">
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
                          className="hc-dentro group relative overflow-hidden"
                        >
                          {isImg ? (
                            <img
                              src={a.url}
                              alt={a.nome}
                              className="h-40 w-full bg-black/[0.04] object-contain dark:bg-black/25"
                            />
                          ) : (
                            <div className="flex h-40 flex-col items-center justify-center gap-2 p-3 text-center">
                              <Paperclip className="size-8 text-muted-foreground" />
                              <span className="line-clamp-2 text-xs text-foreground">{a.nome}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1 border-t border-white/[0.06] bg-card/80 px-2 py-1.5">
                            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                              {a.nome}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAnexos((arr) => arr.filter((_, j) => j !== i))}
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
                    value={anexoUrl}
                    onChange={(e) => setAnexoUrl(e.target.value)}
                    onPaste={(e) =>
                      pasteImageFromEvent(e, (dataUrl) =>
                        setAnexos((a) => [...a, { nome: nomeImagemColada(), url: dataUrl }])
                      )
                    }
                    placeholder="Cole URL ou Ctrl+V com print..."
                    className="flex-1 rounded-xl border border-input bg-transparent px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = anexoUrl.trim();
                      if (!url) return;
                      const nome = url.split("/").pop()?.slice(0, 40) || "anexo";
                      setAnexos((a) => [...a, { nome, url }]);
                      setAnexoUrl("");
                    }}
                    className="hc-seta"
                    aria-label="Adicionar anexo"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Dica: copie um print e pressione Ctrl+V no campo acima para anexar.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] p-5">
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={criar.isPending}
            className="flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {criar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar para aprovação
          </button>
        </div>
      </div>
    </div>
  );
}

function PendCard({
  p,
  compact,
  isCoordinatorPlus,
  meuUsername,
  onAprovar,
  onReprovar,
  onExcluir,
  onStandby,
  onVoltar,
  aprovando,
  reprovando,
  excluindo,
  movendo,
}: {
  p: PendenciaArea;
  compact?: boolean;
  isCoordinatorPlus: boolean;
  meuUsername: string;
  onAprovar: (p: PendenciaArea) => void;
  onReprovar: (id: string) => void;
  onExcluir: (id: string) => void;
  onStandby: (id: string) => void;
  onVoltar: (id: string) => void;
  aprovando: boolean;
  reprovando: boolean;
  excluindo: boolean;
  movendo: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [comentando, setComentando] = useState(false);
  const queryClient = useQueryClient();
  const faltaInfo = !!p.obsCoordenacao && !p.obsResolvida;
  const souAutor =
    !!meuUsername && p.criadoPor.trim().toLowerCase() === meuUsername.trim().toLowerCase();
  const podeExcluir = isCoordinatorPlus || (souAutor && p.status === "pendente");
  const podeEditar =
    (souAutor && p.status === "pendente") ||
    (isCoordinatorPlus && p.status === "standby");

  return (
    <article
      className={cn(
        // sem a classe "hc" e sem desfoque: as janelas de editar e de pedir informações abrem
        // aqui dentro e precisam cobrir a tela inteira
        "glass relative rounded-[22px] p-5 backdrop-filter-none",
        faltaInfo && "!border-primary/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="hc-titulo">{p.titulo}</h3>
        <span className="hc-selo capitalize">
          <i className={cn("size-1.5 rounded-full", statusStyle[p.status])} aria-hidden />
          {p.status === "standby" ? "Stand-by" : p.status}
        </span>
        {p.area && (
          <span className="hc-selo">
            {areaLabel(p.area)}
          </span>
        )}
        <span className="hc-selo capitalize">
          {p.prioridade}
        </span>

        {faltaInfo && (
          <span className="hc-estado">
            <i aria-hidden /> Falta informação
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {isCoordinatorPlus && (p.status === "pendente" || p.status === "standby") && (
            <button
              onClick={() => setComentando(true)}
              aria-label="Pedir mais informações"
              title="Comentar / pedir mais informações ao autor"
              className="hc-seta"
            >
              <MessageSquare className="size-3.5" />
            </button>
          )}
          {podeEditar && (
            <button
              onClick={() => setEditando(true)}
              aria-label="Editar solicitação"
              title="Editar solicitação"
              className="hc-seta"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {podeExcluir && (
            <button
              onClick={() => {
                if (window.confirm("Excluir esta solicitação?")) onExcluir(p.id);
              }}
              disabled={excluindo}
              aria-label="Excluir solicitação"
              title={isCoordinatorPlus ? "Excluir solicitação" : "Excluir minha solicitação"}
              className="hc-seta hover:!bg-destructive/15 hover:!text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {p.descricao && (
        <p
          className={cn(
            "mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground",
            compact && "line-clamp-2 text-xs"
          )}
        >
          {p.descricao}
        </p>
      )}
      {p.anexos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {p.anexos.map((a) => (
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
        Criado por <span className="font-medium text-muted-foreground">{p.criadoPor || "—"}</span>
        {p.aprovadoPor && (
          <>
            {" "}· {p.status === "reprovada" ? "Reprovado" : "Aprovado"} por{" "}
            <span className="font-medium text-muted-foreground">{p.aprovadoPor}</span>
          </>
        )}
        {" "}· {new Date(p.createdAt).toLocaleString("pt-BR")}
      </p>
      {faltaInfo && (
        <div className="hc-dentro mt-3 p-3.5">
          <p className="hc-sobre flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-primary" /> Falta informação — @
            {p.criadoPor || "autor"}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
            {p.obsCoordenacao}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-3">
            por <span className="font-medium text-muted-foreground">{p.obsPor}</span>
            {p.obsAt && <> · {new Date(p.obsAt).toLocaleString("pt-BR")}</>}
          </p>
          {(souAutor || isCoordinatorPlus) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {podeEditar && (
                <button
                  onClick={() => setEditando(true)}
                  className="flex h-[30px] items-center gap-1.5 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Pencil className="size-3.5" /> Editar solicitação
                </button>
              )}
              <button
                onClick={() => {
                  void resolverObservacao(p.id)
                    .then(() => {
                      toast.success("Marcado como resolvido.");
                      void queryClient.invalidateQueries({
                        queryKey: ["pendencias-area"],
                      });
                    })
                    .catch((e: Error) => toast.error(e.message));
                }}
                className="hc-pilula"
              >
                <Check className="size-3.5" /> Marcar como resolvido
              </button>
            </div>
          )}
        </div>
      )}

      {isCoordinatorPlus && (p.status === "pendente" || p.status === "standby") && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onAprovar(p)}
            disabled={aprovando}
            className="flex h-[30px] items-center gap-1.5 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Aprovar → Desenvolvimento
          </button>
          <button
            onClick={() => onReprovar(p.id)}
            disabled={reprovando}
            className="flex h-[30px] items-center gap-1.5 rounded-full bg-destructive/15 px-3 text-[11.5px] font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
          >
            <X className="size-3.5" /> Reprovar
          </button>
          {p.status === "pendente" ? (
            <button
              onClick={() => onStandby(p.id)}
              disabled={movendo}
              title="Guardar para analisar/fazer futuramente"
              className="hc-pilula disabled:opacity-50"
            >
              <PauseCircle className="size-3.5" /> Stand-by
            </button>
          ) : (
            <button
              onClick={() => onVoltar(p.id)}
              disabled={movendo}
              title="Voltar para a fila de pendentes"
              className="hc-pilula disabled:opacity-50"
            >
              <Undo2 className="size-3.5" /> Voltar p/ pendentes
            </button>
          )}
        </div>
      )}

      {editando && <EditarPendenciaDialog p={p} onClose={() => setEditando(false)} />}
      {comentando && <PedirInfoDialog p={p} onClose={() => setComentando(false)} />}
    </article>
  );
}


function PedirInfoDialog({
  p,
  onClose,
}: {
  p: PendenciaArea;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState(p.obsCoordenacao);

  const enviar = useMutation({
    mutationFn: async () => {
      const quem = await getCurrentUsername();
      await pedirInformacoes(p, quem, texto);
    },
    onSuccess: () => {
      toast.success(`@${p.criadoPor || "autor"} foi notificado.`);
      void queryClient.invalidateQueries({ queryKey: ["pendencias-area"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[22px] glass-modal p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="hc-titulo">
              Pedir mais informações
            </h2>
            <p className="hc-nota mt-1">
              Mencionando{" "}
              <span className="font-semibold text-foreground">
                @{p.criadoPor || "autor"}
              </span>{" "}
              — ele será notificado e a solicitação ficará em destaque.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <RichTextarea
          className="mt-4"
          autoFocus
          value={texto}
          onChange={setTexto}
          placeholder="Ex.: falta informar as coordenadas e o valor do item..."
          inputClassName={cn(inputCls, "min-h-28 w-full resize-y")}
        />

        <button
          onClick={() => enviar.mutate()}
          disabled={enviar.isPending || !texto.trim()}
          className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {enviar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar comentário
        </button>
      </div>
    </div>
  );
}

function usePendenciaActions(isCoordinatorPlus: boolean) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pendencias-area"] });
  };

  const { data: meuUsername } = useQuery({
    queryKey: ["meu-username"],
    queryFn: getCurrentUsername,
    staleTime: 5 * 60_000,
  });

  const aprovarMutation = useMutation({
    mutationFn: async (p: PendenciaArea) => {
      const quem = await getCurrentUsername();
      await aprovarPendencia(p, quem);
    },
    onSuccess: () => {
      toast.success("Aprovada e enviada para o Desenvolvimento.");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const reprovarMutation = useMutation({
    mutationFn: async (id: string) => {
      const quem = await getCurrentUsername();
      await reprovarPendencia(id, quem);
    },
    onSuccess: () => {
      toast.success("Solicitação reprovada.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const excluirMutation = useMutation({
    mutationFn: (id: string) => excluirPendencia(id),
    onSuccess: () => {
      toast.success("Solicitação excluída.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const standbyMutation = useMutation({
    mutationFn: async (id: string) => {
      const quem = await getCurrentUsername();
      await enviarParaStandby(id, quem);
    },
    onSuccess: () => {
      toast.success("Movida para Stand-by.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const voltarMutation = useMutation({
    mutationFn: (id: string) => voltarParaPendente(id),
    onSuccess: () => {
      toast.success("Voltou para a fila de pendentes.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    isCoordinatorPlus,
    meuUsername: meuUsername ?? "",
    onAprovar: (p: PendenciaArea) => aprovarMutation.mutate(p),
    onReprovar: (id: string) => reprovarMutation.mutate(id),
    onExcluir: (id: string) => excluirMutation.mutate(id),
    onStandby: (id: string) => standbyMutation.mutate(id),
    onVoltar: (id: string) => voltarMutation.mutate(id),
    aprovando: aprovarMutation.isPending,
    reprovando: reprovarMutation.isPending,
    excluindo: excluirMutation.isPending,
    movendo: standbyMutation.isPending || voltarMutation.isPending,
  };
}

function SecaoStandby({ isCoordinatorPlus }: { isCoordinatorPlus: boolean }) {
  const cardProps = usePendenciaActions(isCoordinatorPlus);
  const { data: pendencias = [], isLoading } = useQuery({
    queryKey: ["pendencias-area"],
    queryFn: fetchPendenciasArea,
  });
  const lista = pendencias.filter((p) => p.status === "standby");

  return (
    <div className="mt-4">
      <h2 className="flex items-center gap-2.5 px-1">
        <span className="hc-titulo">Stand-by</span>
        <span className="hc-selo tabular-nums">{lista.length}</span>
      </h2>
      <p className="hc-nota mt-1.5 px-1">
        Solicitações guardadas por Coordinator+ para analisar ou fazer
        futuramente. Edite quando quiser e envie para o Desenvolvimento.
      </p>
      <div className="mt-3 space-y-2.5">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-white/[0.1] p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        )}
        {!isLoading && lista.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
            Nada em Stand-by por aqui.
          </div>
        )}
        {lista.map((p) => (
          <PendCard key={p.id} p={p} {...cardProps} />
        ))}
      </div>
    </div>
  );
}

function SecaoPendencias({
  tipo,
  comArea,
  isCoordinatorPlus,
}: {
  tipo: TipoSolicitacao;
  comArea: boolean;
  isCoordinatorPlus: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [filtroArea, setFiltroArea] = useState<string>("todas");
  const cardProps = usePendenciaActions(isCoordinatorPlus);

  const { data: pendencias = [], isLoading } = useQuery({
    queryKey: ["pendencias-area"],
    queryFn: fetchPendenciasArea,
  });

  const lista = pendencias
    .filter((p) => p.tipo === tipo)
    .filter((p) => filtroArea === "todas" || p.area === filtroArea);
  const pendentes = lista
    .filter((p) => p.status === "pendente")
    .sort((a, b) => {
      const fa = a.obsCoordenacao && !a.obsResolvida ? 0 : 1;
      const fb = b.obsCoordenacao && !b.obsResolvida ? 0 : 1;
      return fa - fb;
    });
  const resolvidas = lista.filter(
    (p) => p.status === "aprovada" || p.status === "reprovada"
  );

  return (
    <div className="mt-4 space-y-4">

      {criando && (
        <NovaPendenciaDialog
          tipo={tipo}
          comArea={comArea}
          onClose={() => setCriando(false)}
        />
      )}

      {/* filtro por área (quando a aba tem área) e o botão de criar, na mesma linha */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        {comArea && (
          <>
            <span className="hc-sobre">Filtrar por área</span>
            <div className="w-56">
              <MinimalSelect
                className="rounded-full"
                value={filtroArea}
                onChange={setFiltroArea}
                options={[
                  { value: "todas", label: "Todas as áreas" },
                  ...AREAS.map((a) => ({ value: a.key, label: a.label })),
                ]}
              />
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="ml-auto flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> Nova {TIPO_LABEL[tipo]}
        </button>
      </div>

      {/* Lista: pendentes + lateral de resolvidas */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="flex items-center gap-2.5 px-1">
            <span className="hc-titulo">{TIPO_LABEL[tipo]}s pendentes</span>
            <span className="hc-selo tabular-nums">{pendentes.length}</span>
          </h2>
          <div className="mt-3 space-y-2.5">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-white/[0.1] p-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando...
              </div>
            )}
            {!isLoading && pendentes.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
                Nenhuma pendência aguardando aprovação.
              </div>
            )}
            {pendentes.map((p) => (
              <PendCard key={p.id} p={p} {...cardProps} />
            ))}
          </div>
        </section>

        <aside>
          <h2 className="flex items-center gap-2.5 px-1">
            <span className="hc-titulo">Aprovadas / Reprovadas</span>
            <span className="hc-selo tabular-nums">{resolvidas.length}</span>
          </h2>
          <div className="mt-3 max-h-[70vh] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
            {resolvidas.length === 0 && !isLoading && (
              <div className="rounded-[22px] border border-dashed border-white/[0.1] p-6 text-center text-xs text-muted-foreground">
                Nada resolvido ainda.
              </div>
            )}
            {resolvidas.map((p) => (
              <PendCard key={p.id} p={p} compact {...cardProps} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SecaoAdmin() {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [destinatarioId, setDestinatarioId] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; url: string }[]>([]);

  const fetchCoords = useServerFn(listCoordinatorPlus);
  const { data: coordenadores = [] } = useQuery({
    queryKey: ["coordinator-plus"],
    queryFn: () => fetchCoords(),
  });
  const { data: enviadas = [], isLoading } = useQuery({
    queryKey: ["solicitacoes-admin"],
    queryFn: fetchSolicitacoesAdmin,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const criadoPor = await getCurrentUsername();
      const dest = coordenadores.find((c) => c.id === destinatarioId);
      if (!dest) throw new Error("Selecione o destinatário.");
      await criarSolicitacaoAdmin({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        anexos,
        destinatarioId: dest.id,
        destinatarioNome: dest.username,
        criadoPor,
      });
    },
    onSuccess: () => {
      toast.success("Solicitação administrativa enviada.");
      setTitulo("");
      setDescricao("");
      setAnexos([]);
      setDestinatarioId("");
      void queryClient.invalidateQueries({ queryKey: ["solicitacoes-admin"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!titulo.trim()) {
            toast.error("Informe um título.");
            return;
          }
          criarMutation.mutate();
        }}
        className="glass rounded-[22px] p-5"
      >
        {/* sem a classe "hc": a lista de destinatários abre por cima e não pode ser cortada */}
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <Inbox className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="hc-titulo">Nova Solicitação Administrativa</h2>
            <p className="hc-nota mt-0.5">De Manager para cargo Coordinator ou superior.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
            className={inputCls}
          />
          <MinimalSelect
            value={destinatarioId}
            onChange={setDestinatarioId}
            placeholder="Para qual Staff (Coordinator+)..."
            options={coordenadores.map((c) => ({
              value: c.id,
              label: c.username,
            }))}
          />
        </div>
        <RichTextarea
          className="mt-3"
          value={descricao}
          onChange={setDescricao}
          placeholder="Descrição detalhada da solicitação..."
          rows={5}
          inputClassName={cn(inputCls, "w-full resize-y")}
        />
        {/* Anexos / imagens por URL */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              value={anexoUrl}
              onChange={(e) => setAnexoUrl(e.target.value)}
              onPaste={(e) =>
                pasteImageFromEvent(e, (dataUrl) =>
                  setAnexos((a) => [...a, { nome: nomeImagemColada(), url: dataUrl }])
                )
              }
              placeholder="URL de anexo ou imagem — ou Ctrl+V com print..."
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => {
                const url = anexoUrl.trim();
                if (!url) return;
                setAnexos((a) => [
                  ...a,
                  { nome: url.split("/").pop() || "anexo", url },
                ]);
                setAnexoUrl("");
              }}
              className="pilula shrink-0 rounded-full"
            >
              <Paperclip className="size-3.5" /> Anexar
            </button>
          </div>
          {anexos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <span
                  key={a.url}
                  className="hc-selo"
                >
                  <Paperclip className="size-3" /> {a.nome}
                  <button
                    type="button"
                    onClick={() =>
                      setAnexos((arr) => arr.filter((_, j) => j !== i))
                    }
                    className="text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={criarMutation.isPending}
          className="mt-4 flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {criarMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar solicitação
        </button>
      </form>

      <section>
        <h2 className="flex items-center gap-2.5 px-1">
          <span className="hc-titulo">Solicitações enviadas</span>
          <span className="hc-selo tabular-nums">{enviadas.length}</span>
        </h2>
        <div className="mt-3 space-y-2.5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-white/[0.1] p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </div>
          )}
          {!isLoading && enviadas.length === 0 && (
            <div className="rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitação administrativa enviada.
            </div>
          )}
          {enviadas.map((s) => (
            <article
              key={s.id}
              className="glass hc p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="hc-titulo">{s.titulo}</h3>
                <span className="hc-selo capitalize">
                  <i
                    className={cn(
                      "size-1.5 rounded-full",
                      s.status === "pendente" ? "bg-warning" : "bg-success"
                    )}
                    aria-hidden
                  />
                  {s.status}
                </span>
                <span className="hc-selo">
                  Para: {s.destinatarioNome}
                </span>
              </div>
              {s.descricao && (
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
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
                      className="hc-selo !text-foreground hover:!bg-white/[0.09]"
                    >
                      <Paperclip className="size-3" /> {a.nome}
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-2.5 text-xs text-ink-3">
                Criado por <span className="font-medium text-muted-foreground">{s.criadoPor}</span> ·{" "}
                {new Date(s.createdAt).toLocaleString("pt-BR")}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
