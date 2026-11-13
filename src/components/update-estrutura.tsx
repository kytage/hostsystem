import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { supabase } from "@/integrations/supabase/client";
import type { ColumnId } from "@/lib/dev-tasks";
import { fetchEstrutura, progressoEstrutura, saveEstrutura, type EstruturaGrupo, type EstruturaItem } from "@/lib/update-estrutura";
import { cn } from "@/lib/utils";

const STATUS: { id: ColumnId; label: string; dot: string; chip: string }[] = [
  { id: "backlog", label: "Planejado", dot: "bg-muted-foreground", chip: "bg-muted text-foreground border-white/[0.08]" },
  { id: "doing", label: "Em andamento", dot: "bg-warning", chip: "bg-warning/25 text-warning border-warning/60" },
  { id: "review", label: "Em teste", dot: "bg-info", chip: "bg-info/25 text-info border-info/60" },
  { id: "done", label: "Concluído", dot: "bg-success", chip: "bg-success/25 text-success border-success/60" },
];
const field = "w-full rounded-xl border border-input bg-black/25 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring";

export function UpdateEstrutura({ projetoId }: { projetoId: string }) {
  const qc = useQueryClient();
  const key = ["host-update-estrutura", projetoId];
  const { data: grupos = [], isLoading } = useQuery({ queryKey: key, queryFn: () => fetchEstrutura(projetoId) });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["host-update-usuarios"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").order("username");
      return (data ?? []).map((p) => p.username).filter(Boolean);
    },
    staleTime: 300_000,
  });
  const [saving, setSaving] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState("");

  const persist = async (next: EstruturaGrupo[]) => {
    const prev = grupos;
    qc.setQueryData(key, next);
    setSaving(true);
    try { await saveEstrutura(projetoId, next); void qc.invalidateQueries({ queryKey: ["host-update"] }); }
    catch (e) { qc.setQueryData(key, prev); toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };
  const updGrupo = (id: string, fn: (g: EstruturaGrupo) => EstruturaGrupo) => persist(grupos.map((g) => (g.id === id ? fn(g) : g)));

  const addGrupo = () => {
    const t = novoGrupo.trim();
    if (!t) return;
    setNovoGrupo("");
    void persist([...grupos, { id: crypto.randomUUID(), titulo: t, itens: [] }]);
  };
  const { feitos, total } = progressoEstrutura(grupos);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="hc-titulo">Estrutura do projeto</h3>
        {total > 0 && <span className="hc-selo tabular-nums">{feitos}/{total} concluídos</span>}
        {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : grupos.map((g) => (
        <GrupoBloco key={g.id} grupo={g} usuarios={usuarios}
          onRename={(titulo) => void updGrupo(g.id, (x) => ({ ...x, titulo }))}
          onRemove={() => { if (window.confirm(`Excluir "${g.titulo}" e todos os seus itens?`)) void persist(grupos.filter((x) => x.id !== g.id)); }}
          onClone={() => {
            const clone: EstruturaGrupo = {
              id: crypto.randomUUID(),
              titulo: `${g.titulo} (cópia)`,
              itens: g.itens.map((i) => ({ ...i, id: crypto.randomUUID() })),
            };
            const idx = grupos.findIndex((x) => x.id === g.id);
            const next = [...grupos];
            next.splice(idx + 1, 0, clone);
            void persist(next);
          }}
          onItens={(itens) => void updGrupo(g.id, (x) => ({ ...x, itens }))}
        />
      ))}
      <div className="flex gap-2">
        <input className={field} placeholder="Novo subtítulo (ex.: WINXS COFFE)" value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addGrupo(); }} />
        <Button variant="outline" onClick={addGrupo} disabled={!novoGrupo.trim()}><Plus className="size-4" /> Subtítulo</Button>
      </div>
    </section>
  );
}

function GrupoBloco({ grupo, usuarios, onRename, onRemove, onClone, onItens }: { grupo: EstruturaGrupo; usuarios: string[]; onRename: (t: string) => void; onRemove: () => void; onClone: () => void; onItens: (i: EstruturaItem[]) => void }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(grupo.titulo);
  const [novo, setNovo] = useState<EstruturaItem | null>(null);
  const feitos = grupo.itens.filter((i) => i.status === "done").length;
  return (
    <div className="hc-dentro">
      <div className="group flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        {editando ? <>
          <input autoFocus className={field} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Button size="icon" variant="ghost" className="size-7 rounded-full" aria-label="Salvar" onClick={() => { if (titulo.trim()) { onRename(titulo.trim()); setEditando(false); } }}><Check className="size-3.5" /></Button>
          <Button size="icon" variant="ghost" className="size-7 rounded-full" aria-label="Cancelar" onClick={() => { setTitulo(grupo.titulo); setEditando(false); }}><X className="size-3.5" /></Button>
        </> : <>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground">{grupo.titulo}</h4>
          <span className="hc-selo tabular-nums">{feitos}/{grupo.itens.length}</span>
          <div className="ml-auto flex opacity-60 transition-opacity group-hover:opacity-100">
            <Button size="icon" variant="ghost" className="size-7 rounded-full" aria-label="Editar subtítulo" onClick={() => setEditando(true)}><Pencil className="size-3.5" /></Button>
            <Button size="icon" variant="ghost" className="size-7 rounded-full" aria-label="Clonar subtítulo" onClick={onClone}><Copy className="size-3.5" /></Button>
            <Button size="icon" variant="ghost" className="size-7 rounded-full hover:text-destructive" aria-label="Excluir subtítulo" onClick={onRemove}><Trash2 className="size-3.5" /></Button>
          </div>
        </>}
      </div>
      <ul className="divide-y divide-white/[0.06]">
         {grupo.itens.map((it) => (
          <ItemLinha key={it.id} item={it} usuarios={usuarios}
            onSave={(n) => onItens(grupo.itens.map((x) => (x.id === it.id ? n : x)))}
            onRemove={() => { if (window.confirm(`Excluir "${it.titulo}"?`)) onItens(grupo.itens.filter((x) => x.id !== it.id)); }} />
        ))}
      </ul>
      <div className="px-4 py-2">
        {novo ? <ItemForm item={novo} usuarios={usuarios} onCancel={() => setNovo(null)} onSave={(n) => { onItens([...grupo.itens, n]); setNovo(null); }} />
          : <Button variant="ghost" size="sm" className="h-7 gap-1 px-1 text-xs text-muted-foreground" onClick={() => setNovo({ id: crypto.randomUUID(), titulo: "", responsaveis: [], status: "backlog", descricao: "" })}><Plus className="size-3.5" /> Adicionar item</Button>}
      </div>
    </div>
  );
}

function ItemLinha({ item, usuarios, onSave, onRemove }: { item: EstruturaItem; usuarios: string[]; onSave: (i: EstruturaItem) => void; onRemove: () => void }) {
  const [editando, setEditando] = useState(false);
  if (editando) return <li className="px-4 py-3"><ItemForm item={item} usuarios={usuarios} onCancel={() => setEditando(false)} onSave={(n) => { onSave(n); setEditando(false); }} /></li>;
  const st = STATUS.find((s) => s.id === item.status) ?? STATUS[0]!;
  return (
    <li className="group flex items-start gap-3 px-4 py-2.5">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", st.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className={cn("text-sm font-semibold", item.status === "done" && "text-muted-foreground line-through")}>{item.titulo}</span>
          <span className="text-[11px] text-muted-foreground">{item.responsaveis.length ? item.responsaveis.join(", ") : "Sem responsável"}</span>
        </div>
        {item.descricao && <p className="mt-0.5 whitespace-pre-line break-words text-xs text-muted-foreground">{item.descricao}</p>}
      </div>
      <div className="w-44 shrink-0">
        <MinimalSelect className={cn("rounded-full px-3 py-1 text-xs font-semibold", st.chip)} value={item.status}
          onChange={(v) => onSave({ ...item, status: v as ColumnId })} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} />
      </div>
      <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button size="icon" variant="ghost" className="size-7 rounded-full" aria-label="Editar item" onClick={() => setEditando(true)}><Pencil className="size-3.5" /></Button>
        <Button size="icon" variant="ghost" className="size-7 rounded-full hover:text-destructive" aria-label="Excluir item" onClick={onRemove}><Trash2 className="size-3.5" /></Button>
      </div>
    </li>
  );
}

function ItemForm({ item, usuarios, onSave, onCancel }: { item: EstruturaItem; usuarios: string[]; onSave: (i: EstruturaItem) => void; onCancel: () => void }) {
  const [d, setD] = useState(item);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_240px_150px]">
        <input autoFocus className={field} placeholder="Item (ex.: UNIFORME)" value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} />
        <ResponsaveisPicker value={d.responsaveis} usuarios={usuarios} onChange={(responsaveis) => setD({ ...d, responsaveis })} />
        <MinimalSelect value={d.status} onChange={(v) => setD({ ...d, status: v as ColumnId })} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} />
      </div>
      <textarea rows={2} className={cn(field, "resize-y")} placeholder="Descrição (opcional)" value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="rounded-full" disabled={!d.titulo.trim()} onClick={() => onSave({ ...d, titulo: d.titulo.trim(), descricao: d.descricao.trim() })}>Salvar</Button>
      </div>
    </div>
  );
}

/** Seletor de múltiplos responsáveis: chips removíveis + lista para adicionar. */
function ResponsaveisPicker({ value, usuarios, onChange }: { value: string[]; usuarios: string[]; onChange: (v: string[]) => void }) {
  const disponiveis = usuarios.filter((u) => !value.includes(u));
  return (
    <div className="flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-xl border border-input bg-white/[0.04] px-2 py-1">
      {value.map((r) => (
        <span key={r} className="hc-selo !text-foreground">
          {r}
          <button type="button" aria-label={`Remover ${r}`} className="transition-colors hover:text-destructive" onClick={() => onChange(value.filter((x) => x !== r))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <select
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs text-muted-foreground outline-none"
        value=""
        aria-label="Adicionar responsável"
        onChange={(e) => { const v = e.target.value; if (v && !value.includes(v)) onChange([...value, v]); }}
      >
        <option value="">{value.length ? "+ Adicionar" : "Responsáveis..."}</option>
        {disponiveis.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}
