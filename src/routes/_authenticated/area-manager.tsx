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

const statusStyle: Record<string, string> = {
  pendente: "bg-warning/15 text-warning",
  standby: "bg-chart-2/15 text-chart-2",
  aprovada: "bg-success/15 text-success",
  reprovada: "bg-destructive/15 text-destructive",
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
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-6 md:px-8 xl:px-10">
      <PageHeader
        title="Área Manager"
        subtitle="Crie solicitações da sua área. Coordinator+ aprova antes de ir para o Desenvolvimento."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              aba === a.key
                ? "border-white/15 bg-white/[0.09] text-foreground"
                : "glass text-muted-foreground hover:text-foreground"
            )}
          >
            <a.icon className="size-4" /> {a.label}
          </button>
        ))}
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
      <div className="w-full max-w-lg rounded-2xl glass-modal p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Editar solicitação</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
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
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl glass">
        {/* Header — igual ao modal de edição */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                NOVO
              </span>
              <span className="rounded-full bg-chart-2/15 px-2 py-0.5 text-[11px] font-semibold text-chart-2">
                {TIPO_LABEL[tipo].toUpperCase()}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize bg-warning/15 text-warning">
                {prioridade === "media" ? "Média" : prioridade}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>Nova {TIPO_LABEL[tipo].toLowerCase()} — será enviada para aprovação da coordenação</span>
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

        {/* Abas — mesmas do modal de edição */}
        <div className="flex gap-1 border-b border-border px-5 pt-3">
          {(
            [
              ["detalhes", "Detalhes", FileText],
              ["comentarios", "Comentários (0)", MessageSquare],
              ["historico", "Histórico (0)", History],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              disabled={key !== "detalhes"}
              className={cn(
                "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors",
                key === "detalhes"
                  ? "bg-white/[0.05] text-foreground"
                  : "text-muted-foreground/50"
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
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
                placeholder="Descreva com detalhes, links, referências..."
                inputClassName={cn(inputCls, "h-full min-h-[560px] w-full resize-y")}
              />
            </div>

            {/* Coluna direita */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {comArea && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
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
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
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
                            <img
                              src={a.url}
                              alt={a.nome}
                              className="h-40 w-full bg-black/25 object-contain"
                            />
                          ) : (
                            <div className="flex h-40 flex-col items-center justify-center gap-2 p-3 text-center">
                              <Paperclip className="size-8 text-muted-foreground" />
                              <span className="line-clamp-2 text-xs text-primary">{a.nome}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1 border-t border-border bg-card/80 px-2 py-1.5">
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
                    className="flex-1 rounded-lg border border-input bg-black/25 px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
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
                    className="rounded-lg bg-white/[0.05] px-2.5 text-foreground hover:bg-white/[0.08]"
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
        <div className="flex items-center justify-end gap-2 border-t border-border p-5">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={criar.isPending}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
        "rounded-2xl border p-4",
        faltaInfo
          ? "border-warning/60 bg-warning/5 ring-1 ring-warning/30"
          : "glass"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{p.titulo}</h3>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
            statusStyle[p.status]
          )}
        >
          {p.status === "standby" ? "Stand-by" : p.status}
        </span>
        {p.area && (
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {areaLabel(p.area)}
          </span>
        )}
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {p.prioridade}
        </span>

        {faltaInfo && (
          <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning">
            🚨 Falta informação
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {isCoordinatorPlus && (p.status === "pendente" || p.status === "standby") && (
            <button
              onClick={() => setComentando(true)}
              aria-label="Pedir mais informações"
              title="Comentar / pedir mais informações ao autor"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-warning/10 hover:text-warning"
            >
              <MessageSquare className="size-3.5" />
            </button>
          )}
          {podeEditar && (
            <button
              onClick={() => setEditando(true)}
              aria-label="Editar solicitação"
              title="Editar solicitação"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
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
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {p.descricao && (
        <p
          className={cn(
            "mt-1.5 whitespace-pre-line text-sm text-muted-foreground",
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
              className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Paperclip className="size-3" /> {a.nome}
            </a>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground/70">
        Criado por <span className="font-semibold">{p.criadoPor || "—"}</span>
        {p.aprovadoPor && (
          <>
            {" "}· {p.status === "reprovada" ? "Reprovado" : "Aprovado"} por{" "}
            <span className="font-semibold">{p.aprovadoPor}</span>
          </>
        )}
        {" "}· {new Date(p.createdAt).toLocaleString("pt-BR")}
      </p>
      {faltaInfo && (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
            <AlertTriangle className="size-3.5" /> Falta informação — @
            {p.criadoPor || "autor"}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">
            {p.obsCoordenacao}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            por <span className="font-semibold">{p.obsPor}</span>
            {p.obsAt && <> · {new Date(p.obsAt).toLocaleString("pt-BR")}</>}
          </p>
          {(souAutor || isCoordinatorPlus) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {podeEditar && (
                <button
                  onClick={() => setEditando(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
                className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
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
            className="flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success hover:text-success-foreground disabled:opacity-50"
          >
            <Check className="size-3.5" /> Aprovar → Desenvolvimento
          </button>
          <button
            onClick={() => onReprovar(p.id)}
            disabled={reprovando}
            className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
          >
            <X className="size-3.5" /> Reprovar
          </button>
          {p.status === "pendente" ? (
            <button
              onClick={() => onStandby(p.id)}
              disabled={movendo}
              title="Guardar para analisar/fazer futuramente"
              className="flex items-center gap-1.5 rounded-full bg-chart-2/15 px-3 py-1.5 text-xs font-semibold text-chart-2 transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <PauseCircle className="size-3.5" /> Stand-by
            </button>
          ) : (
            <button
              onClick={() => onVoltar(p.id)}
              disabled={movendo}
              title="Voltar para a fila de pendentes"
              className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
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
      <div className="w-full max-w-lg rounded-2xl glass-modal p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Pedir mais informações
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mencionando{" "}
              <span className="font-semibold text-primary">
                @{p.criadoPor || "autor"}
              </span>{" "}
              — ele será notificado e a solicitação ficará em destaque.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
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
          className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
    <div className="mt-6">
      <h2 className="text-base font-semibold text-foreground">
        Stand-by ({lista.length})
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Solicitações guardadas por Coordinator+ para analisar ou fazer
        futuramente. Edite quando quiser e envie para o Desenvolvimento.
      </p>
      <div className="mt-4 space-y-2.5">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        )}
        {!isLoading && lista.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
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
    <div className="mt-6 space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" /> Nova {TIPO_LABEL[tipo]}
        </button>
      </div>

      {criando && (
        <NovaPendenciaDialog
          tipo={tipo}
          comArea={comArea}
          onClose={() => setCriando(false)}
        />
      )}

      {/* Filtro por área */}
      {comArea && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filtrar por área
          </span>
          <div className="w-56">
            <MinimalSelect
              value={filtroArea}
              onChange={setFiltroArea}
              options={[
                { value: "todas", label: "Todas as áreas" },
                ...AREAS.map((a) => ({ value: a.key, label: a.label })),
              ]}
            />
          </div>
        </div>
      )}

      {/* Lista: pendentes + lateral de resolvidas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">
            {TIPO_LABEL[tipo]}s pendentes ({pendentes.length})
          </h2>
          <div className="mt-3 space-y-2.5">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando...
              </div>
            )}
            {!isLoading && pendentes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma pendência aguardando aprovação.
              </div>
            )}
            {pendentes.map((p) => (
              <PendCard key={p.id} p={p} {...cardProps} />
            ))}
          </div>
        </section>

        <aside>
          <h2 className="text-base font-semibold text-foreground">
            Aprovadas / Reprovadas ({resolvidas.length})
          </h2>
          <div className="mt-3 max-h-[70vh] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
            {resolvidas.length === 0 && !isLoading && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
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
    <div className="mt-6 space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!titulo.trim()) {
            toast.error("Informe um título.");
            return;
          }
          criarMutation.mutate();
        }}
        className="rounded-2xl glass p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Inbox className="size-4 text-primary" /> Nova Solicitação
          Administrativa
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          De Manager para cargo Coordinator ou superior.
        </p>
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
          <div className="flex gap-2">
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
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
            >
              <Paperclip className="size-3.5" /> Anexar
            </button>
          </div>
          {anexos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <span
                  key={a.url}
                  className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
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
          className="mt-4 flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
        <h2 className="text-base font-semibold text-foreground">
          Solicitações enviadas ({enviadas.length})
        </h2>
        <div className="mt-3 space-y-2.5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </div>
          )}
          {!isLoading && enviadas.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitação administrativa enviada.
            </div>
          )}
          {enviadas.map((s) => (
            <article
              key={s.id}
              className="rounded-2xl glass p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{s.titulo}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                    s.status === "pendente"
                      ? "bg-warning/15 text-warning"
                      : "bg-success/15 text-success"
                  )}
                >
                  {s.status}
                </span>
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Para: {s.destinatarioNome}
                </span>
              </div>
              {s.descricao && (
                <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
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
                      className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <Paperclip className="size-3" /> {a.nome}
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground/70">
                Criado por <span className="font-semibold">{s.criadoPor}</span> ·{" "}
                {new Date(s.createdAt).toLocaleString("pt-BR")}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
