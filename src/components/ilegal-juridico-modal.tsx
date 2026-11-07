import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Scale } from "lucide-react";
import { fmtDataHora } from "@/lib/kanban";
import { fetchPunicoesPorSetagem } from "@/lib/punicoes";

interface IlegalJuridicoModalProps {
  setagem: string;
  organizacao?: string;
  onClose: () => void;
}

/**
 * Histórico jurídico de uma setagem do Ilegal: denúncias aplicadas ao set.
 * Fecha somente pelo X (padrão do SaaS).
 */
export function IlegalJuridicoModal({
  setagem,
  organizacao,
  onClose,
}: IlegalJuridicoModalProps) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["punicoes-setagem", setagem],
    queryFn: () => fetchPunicoesPorSetagem(setagem),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <Scale className="size-3.5" /> Jurídico
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground font-display">
              {organizacao || setagem}
            </h2>
            <p className="text-xs text-muted-foreground">
              Denúncias aplicadas à setagem {setagem}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando denúncias...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma denúncia registrada para esta setagem.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-border bg-black/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {row.ticket_id || "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmtDataHora(row.data_punicao)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{row.motivo}</p>
                <p className="text-xs text-muted-foreground">
                  {row.punicao}
                  {row.duracao ? ` · ${row.duracao}` : ""} · ID {row.jogador_id || "—"}
                </p>
                {row.observacao ? (
                  <p className="mt-2 text-xs text-muted-foreground">{row.observacao}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground/70">
                  Staff: {row.staff || "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
