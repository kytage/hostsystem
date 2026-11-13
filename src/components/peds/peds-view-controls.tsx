import { Columns3, Rows3, Table2, List, AlignJustify } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { PED_COLUMNS, type PedColumn } from "./peds-table";

export interface PedsViewControlsProps {
  view: "table" | "details"; onView: (view: "table" | "details") => void;
  compact: boolean; onCompact: () => void;
  columns: PedColumn[]; onColumns: (columns: PedColumn[]) => void;
}
export function PedsViewControls({ view, onView, compact, onCompact, columns, onColumns }: PedsViewControlsProps) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="segmentos" role="group" aria-label="Visualização">
      <button type="button" title="Planilha" aria-label="Visualização em planilha" aria-pressed={view === "table"} onClick={() => onView("table")}><Table2 className="size-3.5" /></button>
      <button type="button" title="Lista detalhada" aria-label="Visualização detalhada" aria-pressed={view === "details"} onClick={() => onView("details")}><List className="size-3.5" /></button>
    </div>
    {view === "table" && <><button type="button" className="hc-seta !size-9" aria-label="Alternar densidade" aria-pressed={compact} title={compact ? "Espaçamento confortável" : "Linhas compactas"} onClick={onCompact}>{compact ? <Rows3 className="size-4" /> : <AlignJustify className="size-4" />}</button>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="pilula rounded-full"><Columns3 className="size-3.5" /> Colunas</button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel><DropdownMenuSeparator />{PED_COLUMNS.map(([key, label]) => <DropdownMenuCheckboxItem key={key} checked={columns.includes(key)} onSelect={(e) => e.preventDefault()} onCheckedChange={(checked) => onColumns(checked ? [...columns, key] : columns.filter((c) => c !== key))}>{label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
    </>}
  </div>;
}