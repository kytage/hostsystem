import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NivelModelo, PixFaixa } from "@/lib/captacoes";
import { cn } from "@/lib/utils";

interface Props {
  model: NivelModelo;
  pix: PixFaixa[];
  onModel: (value: NivelModelo) => void;
  onPix: (value: PixFaixa[]) => void;
  onClose: () => void;
  onReset: () => void;
}
const inputClass = "w-full rounded-md border border-input bg-black/25 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const fields = [
  ["titulo", "Título do nível"], ["faixa", "Faixa de online"],
  ["liderancaQtd", "Quantidade de pessoas — Liderança"], ["lideranca", "VIPs e benefícios — Liderança"],
  ["gerenciaQtd", "Quantidade de pessoas — Gerência"], ["gerencia", "VIPs e benefícios — Gerência"],
  ["vipFacTitulo", "Nome do VIP FAC"], ["vipFacDuracao", "Duração do VIP FAC"],
  ["camp", "Camp interno"], ["campExtras", "Prêmios, quantidades e duração"],
] as const;

export function ProposalBenefitsEditor({ model, pix, onModel, onPix, onClose, onReset }: Props) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Benefícios da proposta — {model.titulo}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => <label key={key} className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          <textarea rows={2} maxLength={2000} className={cn(inputClass, "resize-y")} value={model[key] ?? (key === "vipFacTitulo" ? "VIP FAC ULTIMATE" : key === "vipFacDuracao" ? "até o WIPE" : "")}
            onChange={event => onModel({ ...model, [key]: event.target.value })} />
        </label>)}
        <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          <span>Benefícios VIP FAC (um por linha)</span>
          <textarea rows={6} maxLength={10000} className={inputClass} value={model.vipFac.join("\n")}
            onChange={event => onModel({ ...model, vipFac: event.target.value.split("\n") })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={model.pix} onChange={event => onModel({ ...model, pix: event.target.checked })} /> Incluir remuneração via Pix
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Faixas de remuneração via Pix</legend>
        {pix.map((row, index) => <div key={`faixa-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">Online
            <input aria-label={`Online faixa ${index + 1}`} type="number" min={0} max={100000} step={1} className={inputClass} value={row.online}
              onChange={event => onPix(pix.map((value, i) => i === index ? { ...value, online: Number(event.target.value) } : value))} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Valor (R$)
            <input aria-label={`Valor faixa ${index + 1}`} type="number" min={0} max={100000000} step="0.01" className={inputClass} value={row.valor}
              onChange={event => onPix(pix.map((value, i) => i === index ? { ...value, valor: Number(event.target.value) } : value))} />
          </label>
          <Button variant="ghost" size="icon" aria-label={`Remover faixa ${index + 1}`} title="Remover faixa" onClick={() => onPix(pix.filter((_, i) => i !== index))}><Trash2 /></Button>
        </div>)}
        <Button variant="outline" size="sm" disabled={pix.length >= 30} onClick={() => onPix([...pix, { online: Math.max(0, ...pix.map(row => row.online)) + 5, valor: 0 }])}><Plus /> Adicionar faixa</Button>
      </fieldset>
      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
        <Button variant="outline" onClick={onReset}>Restaurar padrão do nível</Button>
        <Button onClick={onClose}>Concluir ajustes</Button>
      </div>
    </DialogContent>
  </Dialog>;
}