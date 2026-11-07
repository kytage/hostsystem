import { Columns3, Rows3, Table2, List, AlignJustify } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { PED_COLUMNS, type PedColumn } from "./peds-table";

export interface PedsViewControlsProps {
  view: "table" | "details"; onView: (view: "table" | "details") => void;
  compact: boolean; onCompact: () => void;
  columns: PedColumn[]; onColumns: (columns: PedColumn[]) => void;
}
export function PedsViewControls({ view, onView, compact, onCompact, columns, onColumns }: PedsViewControlsProps) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5" role="group" aria-label="Visualização">
      <Button size="icon" variant={view === "table" ? "secondary" : "ghost"} className="size-8" title="Planilha" aria-label="Visualização em planilha" aria-pressed={view === "table"} onClick={() => onView("table")}><Table2 className="size-4" /></Button>
      <Button size="icon" variant={view === "details" ? "secondary" : "ghost"} className="size-8" title="Lista detalhada" aria-label="Visualização detalhada" aria-pressed={view === "details"} onClick={() => onView("details")}><List className="size-4" /></Button>
    </div>
    {view === "table" && <><Button variant="outline" size="icon" className="size-9" aria-label="Alternar densidade" aria-pressed={compact} title={compact ? "Espaçamento confortável" : "Linhas compactas"} onClick={onCompact}>{compact ? <Rows3 className="size-4" /> : <AlignJustify className="size-4" />}</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Columns3 className="size-4" /> Colunas</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel><DropdownMenuSeparator />{PED_COLUMNS.map(([key, label]) => <DropdownMenuCheckboxItem key={key} checked={columns.includes(key)} onSelect={(e) => e.preventDefault()} onCheckedChange={(checked) => onColumns(checked ? [...columns, key] : columns.filter((c) => c !== key))}>{label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
    </>}
  </div>;
}