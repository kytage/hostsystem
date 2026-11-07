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

const statusStyle: Record<string, string> = {
  pendente: "bg-warning/15 text-warning",
  aprovada: "bg-success/15 text-success",
  reprovada: "bg-destructive/15 text-destructive",
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
        className="rounded-2xl glass p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardList className="size-4 text-primary" /> Nova solicitação de
          Ilegal
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Precisa de aprovação de um Coordinator+ para entrar na aba de
          Desenvolvimento.
        </p>

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
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
            >
              <Paperclip className="size-3.5" /> Anexar
            </button>
          </div>
          {anexos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <span
                  key={`${a.url}-${i}`}
                  className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
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
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Aguardando aprovação ({pendentes.length})
          </h2>
          <div className="mt-3 space-y-2.5">
            {isLoading && (
              <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Carregando...
              </p>
            )}
            {!isLoading && pendentes.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
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
          <h2 className="text-sm font-semibold text-foreground">
            Resolvidas ({resolvidas.length})
          </h2>
          <div className="mt-3 max-h-[70vh] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
            {resolvidas.length === 0 && !isLoading && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
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
    <article className="rounded-2xl glass p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{p.titulo}</h3>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
            statusStyle[p.status]
          )}
        >
          {p.status}
        </span>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {p.prioridade}
        </span>
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

      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Criado por <span className="font-semibold">{p.criadoPor || "—"}</span>
        {p.aprovadoPor && (
          <>
            {" "}· {p.status === "reprovada" ? "Reprovado" : "Aprovado"} por{" "}
            <span className="font-semibold">{p.aprovadoPor}</span>
          </>
        )}{" "}
        · {new Date(p.createdAt).toLocaleString("pt-BR")}
      </p>

      {isCoordinatorPlus && p.status === "pendente" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAprovar}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success hover:text-success-foreground disabled:opacity-50"
          >
            <Check className="size-3.5" /> Aprovar → Desenvolvimento
          </button>
          <button
            onClick={onReprovar}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
          >
            <X className="size-3.5" /> Reprovar
          </button>
        </div>
      )}
    </article>
  );
}
