import { RichTextarea } from "@/components/rich-textarea";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ClipboardList,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { ROLE_ORDER, useMyRole } from "@/lib/permissions";
import { getCurrentUsername } from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import { nomeImagemColada, pasteImageFromEvent } from "@/lib/clipboard-image";
import {
  aprovarPendencia,
  criarSolicitacaoArea,
  fetchPendenciasArea,
  reprovarPendencia,
  type PendenciaArea,
} from "@/lib/area-manager";

const inputCls =
  "w-full rounded-xl glass-inset px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none";

const PRIORIDADE_OPTS = [
  { value: "baixa", label: "Prioridade baixa" },
  { value: "media", label: "Prioridade média" },
  { value: "alta", label: "Prioridade alta" },
];

/** Cor do pontinho de cada status (o selo em si é neutro, como na tela inicial). */
const statusStyle: Record<string, string> = {
  pendente: "bg-warning",
  aprovada: "bg-success",
  reprovada: "bg-destructive",
};

/**
 * Solicitações da área Ilegal — mesmo fluxo do Área Manager:
 * criada aqui, aprovada por Coordinator+ e enviada ao Desenvolvimento.
 */
export function IlegalSolicitacoes() {
  const queryClient = useQueryClient();
  const { data: myRole } = useMyRole();
  const isCoordinatorPlus =
    ROLE_ORDER.indexOf(myRole ?? "dev") <= ROLE_ORDER.indexOf("coordinator");

  useRealtimeTable("pendencias", [["pendencias-area"]]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; url: string }[]>([]);

  const { data: pendencias = [], isLoading } = useQuery({
    queryKey: ["pendencias-area"],
    queryFn: fetchPendenciasArea,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pendencias-area"] });
    void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
  };

  const criar = useMutation({
    mutationFn: async () => {
      const criadoPor = await getCurrentUsername();
      await criarSolicitacaoArea({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade,
        area: "ilegal",
        tipo: "solicitacao",
        criadoPor,
        anexos,
      });
    },
    onSuccess: () => {
      toast.success("Solicitação criada — aguardando aprovação Coordinator+.");
      setTitulo("");
      setDescricao("");
      setAnexos([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const aprovar = useMutation({
    mutationFn: async (p: PendenciaArea) => {
      const quem = await getCurrentUsername();
      await aprovarPendencia(p, quem);
    },
    onSuccess: () => {
      toast.success("Aprovada e enviada para o Desenvolvimento.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reprovar = useMutation({
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

  const lista = pendencias.filter(
    (p) => p.area === "ilegal" && p.tipo === "solicitacao"
  );
  const pendentes = lista.filter((p) => p.status === "pendente");
  const resolvidas = lista.filter((p) => p.status !== "pendente");

  return (
    <section className="mt-6 space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!titulo.trim()) {
            toast.error("Informe um título.");
            return;
          }
          criar.mutate();
        }}
        className="glass rounded-[22px] p-5"
      >
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <ClipboardList className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="hc-titulo">Nova solicitação de Ilegal</h2>
            <p className="hc-nota mt-0.5">
              Precisa de aprovação de um Coordinator+ para entrar na aba de
              Desenvolvimento.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da solicitação"
            maxLength={140}
            className={inputCls}
          />
          <MinimalSelect
            value={prioridade}
            onChange={setPrioridade}
            options={PRIORIDADE_OPTS}
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

        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={anexoUrl}
              onChange={(e) => setAnexoUrl(e.target.value)}
              onPaste={(e) =>
                pasteImageFromEvent(e, (dataUrl) =>
                  setAnexos((a) => [
                    ...a,
                    { nome: nomeImagemColada(), url: dataUrl },
                  ])
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
              className="pilula shrink-0 self-center"
            >
              <Paperclip className="size-3.5" /> Anexar
            </button>
          </div>
          {anexos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <span
                  key={`${a.url}-${i}`}
                  className="hc-selo"
                >
                  <Paperclip className="size-3" />
                  <span className="max-w-40 truncate">{a.nome}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAnexos((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={criar.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {criar.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Enviar solicitação
          </button>
        </div>
      </form>

      <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="hc-titulo px-1">
            Aguardando aprovação ({pendentes.length})
          </h2>
          <div className="mt-3 space-y-2.5">
            {isLoading && (
              <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Carregando...
              </p>
            )}
            {!isLoading && pendentes.length === 0 && (
              <p className="rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
                Nenhuma solicitação aguardando aprovação.
              </p>
            )}
            {pendentes.map((p) => (
              <PendItem
                key={p.id}
                p={p}
                isCoordinatorPlus={isCoordinatorPlus}
                onAprovar={() => aprovar.mutate(p)}
                onReprovar={() => reprovar.mutate(p.id)}
                busy={aprovar.isPending || reprovar.isPending}
              />
            ))}
          </div>
        </div>

        <aside>
          <h2 className="hc-titulo px-1">
            Resolvidas ({resolvidas.length})
          </h2>
          <div className="mt-3 max-h-[70vh] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
            {resolvidas.length === 0 && !isLoading && (
              <p className="rounded-[22px] border border-dashed border-white/[0.1] p-6 text-center text-xs text-muted-foreground">
                Nada resolvido ainda.
              </p>
            )}
            {resolvidas.map((p) => (
              <PendItem
                key={p.id}
                p={p}
                compact
                isCoordinatorPlus={false}
                onAprovar={() => undefined}
                onReprovar={() => undefined}
                busy={false}
              />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PendItem({
  p,
  compact,
  isCoordinatorPlus,
  onAprovar,
  onReprovar,
  busy,
}: {
  p: PendenciaArea;
  compact?: boolean;
  isCoordinatorPlus: boolean;
  onAprovar: () => void;
  onReprovar: () => void;
  busy: boolean;
}) {
  return (
    <article className="glass hc p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="hc-titulo">{p.titulo}</h3>
        <span className="hc-selo capitalize">
          <i className={cn("size-1.5 rounded-full", statusStyle[p.status])} aria-hidden />
          {p.status}
        </span>
        <span className="hc-selo capitalize">
          {p.prioridade}
        </span>
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
        )}{" "}
        · {new Date(p.createdAt).toLocaleString("pt-BR")}
      </p>

      {isCoordinatorPlus && p.status === "pendente" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAprovar}
            disabled={busy}
            className="flex h-[30px] items-center gap-1.5 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Aprovar → Desenvolvimento
          </button>
          <button
            onClick={onReprovar}
            disabled={busy}
            className="flex h-[30px] items-center gap-1.5 rounded-full bg-destructive/15 px-3 text-[11.5px] font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
          >
            <X className="size-3.5" /> Reprovar
          </button>
        </div>
      )}
    </article>
  );
}
