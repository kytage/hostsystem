import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Plus, Trash2, X, History } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUsername } from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import {
  agruparPorSemana,
  excluirCoroa,
  fetchCoroas,
  fimSemana,
  registrarCoroa,
  rotuloSemana,
  type IlegalCoroa,
} from "@/lib/ilegal-coroas";

export interface IlegalCoroasModalProps {
  setagem: string;
  organizacao: string;
  canEdit: boolean;
  onClose: () => void;
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function Registro({
  coroa,
  canEdit,
  onDelete,
}: {
  coroa: IlegalCoroa;
  canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="hc-dentro flex items-start gap-3 px-3 py-2.5">
      <Crown className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-foreground">
          {coroa.motivo || "—"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {coroa.criadoPor || "—"} · {dataHora(coroa.createdAt)}
        </p>
      </div>
      {canEdit && (
        <button
          onClick={() => onDelete(coroa.id)}
          title="Remover registro"
          className="hc-seta hover:!bg-destructive hover:!text-destructive-foreground"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

export function IlegalCoroasModal({
  setagem,
  organizacao,
  canEdit,
  onClose,
}: IlegalCoroasModalProps) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [aba, setAba] = useState<"semana" | "historico">("semana");

  const queryKey = ["ilegal-coroas", setagem];
  useRealtimeTable("ilegal_coroas", [queryKey, ["ilegal-coroas-semana"]]);

  const { data: registros = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCoroas(setagem),
  });

  const { atual, historico } = useMemo(
    () => agruparPorSemana(registros),
    [registros]
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["ilegal-coroas-semana"] });
  };

  const addMutation = useMutation({
    mutationFn: async () =>
      registrarCoroa({
        setagem,
        organizacao,
        motivo,
        criadoPor: await getCurrentUsername(),
      }),
    onSuccess: () => {
      setMotivo("");
      invalidate();
      toast.success("Coroa registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMutation = useMutation({
    mutationFn: excluirCoroa,
    onSuccess: () => {
      invalidate();
      toast.success("Registro removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetEm = fimSemana().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] glass-modal">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="hc-icone">
              <Crown className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="hc-titulo">Coroas — {setagem}</h2>
              <p className="hc-nota mt-1">
                {organizacao || "Sem organização"} · contatos de RP da semana ·
                reseta em {resetEm}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hc-selo tabular-nums">
              {atual.length}
            </span>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="hc-seta"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!motivo.trim() || addMutation.isPending) return;
              addMutation.mutate();
            }}
            className="flex items-center gap-2 border-b border-white/[0.06] p-4"
          >
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da coroa (ex.: contato de RP com a polícia)"
              className="flex-1 rounded-xl border border-input bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
            />
            <button
              type="submit"
              disabled={!motivo.trim() || addMutation.isPending}
              className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Confirmar
            </button>
          </form>
        )}

        <div className="segmentos mx-4 mt-4 self-start" role="tablist" aria-label="Coroas por semana">
          {(
            [
              { id: "semana", label: "Semana atual", n: atual.length },
              { id: "historico", label: "Histórico", n: historico.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={aba === t.id}
              onClick={() => setAba(t.id)}
            >
              {t.label}{" "}
              <span className="tabular-nums opacity-60">({t.n})</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </div>
          ) : aba === "semana" ? (
            atual.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
                Nenhuma coroa registrada nesta semana.
              </p>
            ) : (
              <ul className="space-y-2">
                {atual.map((c) => (
                  <Registro
                    key={c.id}
                    coroa={c}
                    canEdit={canEdit}
                    onDelete={(id) => delMutation.mutate(id)}
                  />
                ))}
              </ul>
            )
          ) : historico.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
              Ainda não há semanas anteriores.
            </p>
          ) : (
            <div className="space-y-5">
              {historico.map((s) => (
                <section key={s.inicio}>
                  <h3 className="hc-sobre flex items-center gap-2">
                    <History className="size-3.5" /> {rotuloSemana(s.inicio)}
                    <span className="hc-selo tabular-nums tracking-normal">
                      {s.registros.length}
                    </span>
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {s.registros.map((c) => (
                      <Registro
                        key={c.id}
                        coroa={c}
                        canEdit={canEdit}
                        onDelete={(id) => delMutation.mutate(id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
