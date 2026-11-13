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
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[22px] glass-modal p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="hc-icone">
              <Scale className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="hc-sobre">Jurídico</p>
              <h2 className="hc-titulo mt-1">
                {organizacao || setagem}
              </h2>
              <p className="hc-nota mt-0.5">
                Denúncias aplicadas à setagem {setagem}
              </p>
            </div>
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

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando denúncias...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
            Nenhuma denúncia registrada para esta setagem.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="hc-dentro p-4">
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
