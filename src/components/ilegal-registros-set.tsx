import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Gavel, Scale } from "lucide-react";
import { fmtDataHora } from "@/lib/kanban";
import { fetchPunicoesPorSetagem, type PunicaoRow, type PunicaoTipo } from "@/lib/punicoes";
import { cn } from "@/lib/utils";

interface IlegalRegistrosSetProps {
  /** Setagem (userset_sub) da organização ilegal. */
  setagem: string;
  /** Tipo de registro exibido: denúncias ou punições/júri (VAR). */
  tipo: PunicaoTipo;
  /**
   * Marco da última "Limpar Fac". Registros anteriores deixam de aparecer aqui,
   * mas continuam intactos em /punicoes.
   */
  desde?: string | null;
}

/**
 * Lista os registros de punições vinculados a uma setagem do Ilegal,
 * separados por tipo (denúncias ou júri/VAR: banimentos, cheat, formatação).
 */
export function IlegalRegistrosSet({ setagem, tipo, desde }: IlegalRegistrosSetProps) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["punicoes-setagem", setagem],
    queryFn: () => fetchPunicoesPorSetagem(setagem),
    enabled: Boolean(setagem),
  });

  const filtrados = useMemo<PunicaoRow[]>(
    () =>
      rows.filter(
        (r) => (r.tipo as PunicaoTipo) === tipo && (!desde || r.data_punicao >= desde)
      ),
    [rows, tipo, desde]
  );

  const Icon = tipo === "denuncia" ? Gavel : Scale;
  const vazio =
    tipo === "denuncia"
      ? "Nenhuma denúncia registrada para esta setagem."
      : "Nenhum registro de júri (VAR) para esta setagem.";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando registros...
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          <Icon className="size-3.5" />
          {tipo === "denuncia" ? "Denúncias" : "Punições · Júri"}
        </p>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {filtrados.length} registro{filtrados.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {vazio}
        </div>
      ) : (
        filtrados.map((row) => {
          const banido = /ban/i.test(row.punicao ?? "");
          return (
            <div key={row.id} className="rounded-xl border border-border bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {row.ticket_id || "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDataHora(row.data_punicao)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {row.resultado ? (
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    {row.resultado}
                  </span>
                ) : null}
                {row.punicao ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      banido
                        ? "bg-primary/15 text-primary"
                        : "bg-white/[0.05] text-muted-foreground"
                    )}
                  >
                    {row.punicao}
                    {row.duracao ? ` · ${row.duracao}` : ""}
                  </span>
                ) : null}
              </div>

              {row.motivo ? (
                <p className="mt-2 text-sm font-semibold text-foreground">{row.motivo}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                ID {row.jogador_id || "—"}
                {row.jogador ? ` · ${row.jogador}` : ""}
              </p>
              {row.observacao ? (
                <p className="mt-2 text-xs text-muted-foreground">{row.observacao}</p>
              ) : null}
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Staff: {row.staff || "—"}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}
