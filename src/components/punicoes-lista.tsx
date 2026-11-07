import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { fmtDataHora } from "@/lib/kanban";
import type { PunicaoRow } from "@/lib/punicoes";

interface PunicoesListaProps {
  rows: PunicaoRow[];
  /** Autor do registro ou Coordinator+ podem editar. */
  podeEditar: (row: PunicaoRow) => boolean;
  /** Apenas Coordinator+ podem excluir. */
  podeExcluir: (row: PunicaoRow) => boolean;
  onEdit: (row: PunicaoRow) => void;
  onDelete: (row: PunicaoRow) => void;
}

/** Tabela minimalista de registros de punição. */
export function PunicoesLista({
  rows,
  podeEditar,
  podeExcluir,
  onEdit,
  onDelete,
}: PunicoesListaProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nenhum registro por aqui ainda.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl glass">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 text-left font-semibold">Ticket</th>
            <th className="px-4 py-3 text-left font-semibold">Denunciado</th>
            <th className="px-4 py-3 text-left font-semibold">Userset</th>
            <th className="px-4 py-3 text-left font-semibold">Motivo</th>
            <th className="px-4 py-3 text-left font-semibold">Punição</th>
            <th className="px-4 py-3 text-left font-semibold">Duração</th>
            <th className="px-4 py-3 text-left font-semibold">Staff</th>
            <th className="px-4 py-3 text-left font-semibold">Data</th>
            <th className="px-4 py-3 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                {row.ticket_id || "—"}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">
                  {row.jogador || `ID ${row.jogador_id || "—"}`}
                </p>
                {row.jogador && row.jogador_id ? (
                  <p className="text-xs text-muted-foreground">ID {row.jogador_id}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {row.userset === "ilegal"
                  ? `Ilegal${row.userset_sub ? ` · ${row.userset_sub}` : ""}`
                  : row.userset === "policia"
                    ? "Policia"
                    : row.userset === "comum"
                      ? "Player comum"
                      : "—"}
              </td>
              <td className="max-w-[220px] px-4 py-3">
                <p className="truncate text-foreground/90" title={row.motivo}>
                  {row.motivo || "—"}
                </p>
                {row.observacao ? (
                  <p className="truncate text-xs text-muted-foreground" title={row.observacao}>
                    {row.observacao}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-foreground/90">{row.punicao || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.duracao || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.staff || "—"}</td>

              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {fmtDataHora(row.data_punicao)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {row.provas ? (
                    <a
                      href={row.provas}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir provas"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                  {podeEditar(row) ? (
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => onEdit(row)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                  {podeExcluir(row) ? (
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => onDelete(row)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
