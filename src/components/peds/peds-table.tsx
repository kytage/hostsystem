import { Copy, Pencil, Archive, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isRemovedPed } from "@/lib/peds-records";
import type { PedRow } from "./ped-dialog";

export const PED_COLUMNS = [
  ["responsavel", "Responsável"], ["tamanho", "Tamanho"], ["discord_ped", "Discord · Ped"],
  ["passaporte_ped", "Passaporte · Ped"], ["discord_responsavel", "Discord · Responsável"],
  ["passaporte_responsavel", "Passaporte · Responsável"], ["adicao", "Adição"],
] as const;
export type PedColumn = typeof PED_COLUMNS[number][0];
export interface PedsTableProps {
  rows: PedRow[]; columns: PedColumn[]; compact: boolean;
  onEdit: (ped: PedRow) => void; onDelete: (ped: PedRow) => void;
}
function PedCell({ value, copy }: { value: string; copy: boolean }) {
  return <div className="flex items-center gap-1"><span className={cn("max-w-48 break-words", copy && "font-mono text-[11px]")}>{value || "—"}</span>{copy && value && <Button variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground" title="Copiar valor" aria-label={`Copiar ${value}`} onClick={() => { void navigator.clipboard.writeText(value).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar")); }}><Copy className="size-3" /></Button>}</div>;
}
export function PedsTable({ rows, columns, compact, onEdit, onDelete }: PedsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = PED_COLUMNS.filter(([key]) => columns.includes(key));
  return <div className="max-w-full overflow-x-auto border-y border-border">
    <table className="w-full border-collapse text-left text-xs" aria-label="Planilha de Peds">
      <thead className="bg-muted/50 text-muted-foreground"><tr><th className="min-w-52 px-3 py-3 font-medium">Arquivo / Skin</th><th className="px-3 py-3 font-medium">Status</th>{visible.map(([key, label]) => <th key={key} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}<th className="sticky right-0 bg-muted px-3 py-3 text-right font-medium">Ações</th></tr></thead>
      <tbody>{rows.map((ped) => <PedTableRow key={ped.id} ped={ped} visible={visible} compact={compact} expanded={expanded === ped.id} onExpand={() => setExpanded(expanded === ped.id ? null : ped.id)} onEdit={onEdit} onDelete={onDelete} />)}</tbody>
    </table>
  </div>;
}
interface RowProps extends Pick<PedsTableProps, "compact" | "onEdit" | "onDelete"> {
  ped: PedRow; visible: (typeof PED_COLUMNS)[number][]; expanded: boolean; onExpand: () => void;
}
function PedTableRow({ ped, visible, compact, expanded, onExpand, onEdit, onDelete }: RowProps) {
  const removed = isRemovedPed(ped);
  const spacing = cn("border-b border-border px-3 align-middle", compact ? "py-2" : "py-4");
  return <>
    <tr className="group bg-black/25 transition-colors hover:bg-muted/30">
      <td className={spacing}><div className="flex items-center gap-2"><Button size="icon" variant="ghost" className="size-6 shrink-0" aria-label={`Detalhes ${ped.arquivo}`} aria-expanded={expanded} onClick={onExpand}><ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} /></Button><span className="max-w-56 break-all font-semibold">{ped.arquivo}</span>{ped.arquivo && <Button variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground" title="Copiar arquivo da skin" aria-label={`Copiar arquivo ${ped.arquivo}`} onClick={() => { void navigator.clipboard.writeText(ped.arquivo).then(() => toast.success("Arquivo da skin copiado"), () => toast.error("Não foi possível copiar")); }}><Copy className="size-3" /></Button>}</div></td>
      <td className={spacing}><span className={cn("inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium", removed ? "bg-destructive/10 text-destructive" : ped.grupo === "Setado" ? "bg-info/10 text-info" : "bg-warning/10 text-warning")}>{removed ? "Removido" : ped.grupo}</span></td>
      {visible.map(([key]) => <td key={key} className={spacing}><PedCell value={ped[key]} copy={key.includes("discord") || key.includes("passaporte")} /></td>)}
      <td className={cn(spacing, "sticky right-0 bg-black/25 group-hover:bg-muted")}><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="size-7" title="Editar Ped" aria-label={`Editar ${ped.arquivo}`} onClick={() => onEdit(ped)}><Pencil className="size-3.5" /></Button>{!removed && <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Mover para Removidos" aria-label={`Remover ${ped.arquivo}`} onClick={() => onDelete(ped)}><Archive className="size-3.5" /></Button>}</div></td>
    </tr>
    {expanded && <tr className="bg-muted/20"><td colSpan={visible.length + 3} className="border-b border-border p-4"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{PED_COLUMNS.map(([key, label]) => <div key={key}><dt className="mb-1 text-[10px] text-muted-foreground">{label}</dt><dd><PedCell value={ped[key]} copy={key.includes("discord") || key.includes("passaporte")} /></dd></div>)}</dl><p className="mt-4 whitespace-pre-wrap break-words text-muted-foreground">{ped.observacao || "Sem observações"}</p></td></tr>}
  </>;
}