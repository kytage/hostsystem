import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PED_CATEGORIES, PED_CATEGORY_LABELS, PED_FIELDS, PED_GROUPS, emptyPed, pedSchema, type PedInput } from "@/lib/peds-schema";
import { savePed } from "@/lib/peds.functions";

export type PedRow = Database["public"]["Tables"]["peds"]["Row"];
export interface PedDialogProps {
  ped: PedRow | null;
  categoria: PedInput["categoria"];
  onClose: () => void;
}
export function PedDialog({ ped, categoria, onClose }: PedDialogProps) {
  const [input, setInput] = useState<PedInput>(() => ped ? pedSchema.parse(ped) : emptyPed(categoria));
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const save = useServerFn(savePed);
  const mutation = useMutation({
    mutationFn: (value: PedInput) => save({ data: ped ? { id: ped.id, input: value } : { input: value } }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["peds"] }); toast.success(ped ? "Ped atualizado" : "Ped criado"); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = pedSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira os campos."); return; }
    setError(""); mutation.mutate(parsed.data);
  }
  function change(key: keyof PedInput, value: string) { setInput((old) => ({ ...old, [key]: value })); }
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="max-h-[90svh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle className="hc-titulo">{ped ? "Editar Ped" : "Novo Ped"}</DialogTitle><DialogDescription className="hc-nota">HOST · Controle Peds</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="ped-categoria" className="hc-sobre">Categoria</Label><Select value={input.categoria} onValueChange={(v) => change("categoria", v)}><SelectTrigger id="ped-categoria" className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{PED_CATEGORIES.map((v) => <SelectItem key={v} value={v}>{PED_CATEGORY_LABELS[v]}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="ped-grupo" className="hc-sobre">Grupo / Status</Label><Select value={input.grupo} onValueChange={(v) => change("grupo", v)}><SelectTrigger id="ped-grupo" className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{PED_GROUPS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
          {PED_FIELDS.map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`ped-${key}`} className="hc-sobre">{label}</Label><Input id={`ped-${key}`} value={input[key]} onChange={(e) => change(key, e.target.value)} required={key === "responsavel" || key === "arquivo"} maxLength={2000} /></div>)}
        </div>
        <div className="space-y-2"><Label htmlFor="ped-observacao" className="hc-sobre">Observação</Label><Textarea id="ped-observacao" className="rounded-xl" value={input.observacao} onChange={(e) => change("observacao", e.target.value)} rows={4} maxLength={10000} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}