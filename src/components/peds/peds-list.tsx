import { Pencil, Archive, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PedRow } from "@/components/peds/ped-dialog";
import { PED_CATEGORY_LABELS } from "@/lib/peds-schema";
import { isRemovedPed, pedCategory } from "@/lib/peds-records";

export interface PedsListProps { rows: PedRow[]; onEdit: (ped: PedRow) => void; onDelete: (ped: PedRow) => void; }
function Identifier({ value, label }: { value: string; label: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <div className="flex min-w-0 items-start gap-1"><span className="break-all font-mono text-xs">{value}</span><button type="button" className="hc-seta !size-6" title={`Copiar ${label}`} aria-label={`Copiar ${label}`} onClick={() => { void navigator.clipboard.writeText(value).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar")); }}><Copy className="size-3" /></button></div>;
}
export function PedsList({ rows, onEdit, onDelete }: PedsListProps) {
  return <div className="glass hc divide-y divide-white/[0.06]">
    {rows.map((ped) => <article key={ped.id} className="p-5 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{PED_CATEGORY_LABELS[pedCategory(ped)]}</span><span className="hc-selo"><i className={cn("size-1.5 rounded-full", isRemovedPed(ped) ? "bg-destructive" : ped.grupo === "Setado" ? "bg-info" : "bg-warning")} aria-hidden />{isRemovedPed(ped) ? "Removido" : ped.grupo}</span><span className="text-xs text-muted-foreground">{ped.tamanho}</span></div><h3 className="hc-titulo break-all">{ped.arquivo || "Sem arquivo"}</h3></div>
        <div className="flex shrink-0 gap-1.5"><button type="button" className="hc-seta" aria-label={`Editar ${ped.arquivo}`} title="Editar Ped" onClick={() => onEdit(ped)}><Pencil className="size-3.5" /></button>{!isRemovedPed(ped) && <button type="button" className="hc-seta !text-destructive hover:!border-destructive/40 hover:!bg-destructive/15" aria-label={`Remover ${ped.arquivo}`} title="Mover para Removidos" onClick={() => onDelete(ped)}><Archive className="size-3.5" /></button>}</div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <div><dt className="hc-sobre mb-1">Responsável Peds</dt><dd className="text-sm">{ped.responsavel || "—"}</dd></div>
        <div><dt className="hc-sobre mb-1">Discord · Ped</dt><dd><Identifier value={ped.discord_ped} label="Discord do Ped" /></dd></div>
        <div><dt className="hc-sobre mb-1">Passaporte · Ped</dt><dd><Identifier value={ped.passaporte_ped} label="passaporte do Ped" /></dd></div>
        <div><dt className="hc-sobre mb-1">Adição</dt><dd className="break-all text-sm">{ped.adicao || "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="hc-sobre mb-1">Discord · Responsável</dt><dd><Identifier value={ped.discord_responsavel} label="Discord do responsável" /></dd></div>
        <div><dt className="hc-sobre mb-1">Passaporte · Responsável</dt><dd><Identifier value={ped.passaporte_responsavel} label="passaporte do responsável" /></dd></div>
      </dl>
      {ped.observacao && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{ped.observacao}</p>}
    </article>)}
  </div>;
}