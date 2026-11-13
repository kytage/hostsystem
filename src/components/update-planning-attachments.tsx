import { useQuery } from "@tanstack/react-query";
import { ExternalLink, File, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { planningFileUrl, uploadPlanningFile, type PlanningAttachment } from "@/lib/dev-tasks";

export interface PlanningAttachmentsProps {
  files: PlanningAttachment[];
  onChange?: ((files: PlanningAttachment[]) => void) | undefined;
  onBusy?: ((busy: boolean) => void) | undefined;
}

function AttachmentItem({ file, onRemove }: { file: PlanningAttachment; onRemove?: (() => void) | undefined }) {
  const { data: url, isPending, isError } = useQuery({ queryKey: ["planning-file", file.id], queryFn: () => planningFileUrl(file), staleTime: 3_000_000 });
  return <article className="hc-dentro min-w-0 overflow-hidden">
    {file.type.startsWith("image/") && url && <a href={url} target="_blank" rel="noreferrer" aria-label={`Abrir imagem ${file.nome}`}><img src={url} alt={file.nome} className="h-44 w-full bg-white/[0.05] object-contain" loading="lazy" /></a>}
    <div className="flex items-center gap-2 p-3">
      {isPending ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <File className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 break-all text-xs">{file.nome}{isError && <span className="block text-destructive">Não foi possível abrir o anexo.</span>}</span>
      {url && <Button variant="ghost" size="icon" asChild className="size-8 rounded-full"><a href={url} target="_blank" rel="noreferrer" title="Abrir anexo" aria-label={`Abrir anexo ${file.nome}`}><ExternalLink className="size-4" /></a></Button>}
      {onRemove && <Button variant="ghost" size="icon" className="size-8 rounded-full text-destructive" onClick={onRemove} title="Remover anexo" aria-label={`Remover anexo ${file.nome}`}><Trash2 className="size-4" /></Button>}
    </div>
  </article>;
}

export function PlanningAttachments({ files, onChange, onBusy }: PlanningAttachmentsProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const upload = async (selected: File[]) => {
    if (!onChange || busy || !selected.length) return;
    setBusy(true); onBusy?.(true);
    const uploaded: PlanningAttachment[] = [];
    try {
      for (const file of selected) uploaded.push(await uploadPlanningFile(file));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo."); }
    finally { onChange([...files, ...uploaded]); setBusy(false); onBusy?.(false); if (input.current) input.current.value = ""; }
  };
  const addLink = () => {
    try {
      const url = new URL(link.trim());
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      onChange?.([...files, { id: crypto.randomUUID(), nome: url.hostname + url.pathname, url: url.href, type: "link" }]); setLink("");
    } catch { toast.error("Informe um link http ou https válido."); }
  };
  return <section className="space-y-4" onPaste={onChange ? (e) => { const pasted = Array.from(e.clipboardData.files); if (pasted.length) { e.preventDefault(); void upload(pasted); } } : undefined}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="hc-titulo">Imagens e anexos <span className="text-muted-foreground">({files.length})</span></h3>
      {onChange && <><input ref={input} type="file" multiple className="hidden" aria-label="Arquivos do planejamento" onChange={(e) => void upload(Array.from(e.target.files ?? []))} /><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />} Adicionar arquivo</Button></>}
    </div>
    {onChange && <div className="flex gap-2"><input aria-label="Link do anexo" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="min-w-0 flex-1 rounded-xl border border-input bg-black/25 px-3 py-2 text-sm" /><Button variant="outline" onClick={addLink} disabled={!link.trim() || busy}>Adicionar link</Button></div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{files.map((file) => <AttachmentItem key={file.id} file={file} onRemove={onChange && !busy ? () => onChange(files.filter((f) => f.id !== file.id)) : undefined} />)}</div>
    {!files.length && <p className="rounded-[14px] border border-dashed border-white/[0.1] p-4 text-center text-sm text-muted-foreground">Nenhum anexo.</p>}
  </section>;
}