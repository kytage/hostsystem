import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, ChevronLeft, ChevronRight, Users, CheckCircle2, Clock3, Archive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Indice, Indices } from "@/components/indice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { PedDialog, type PedRow } from "@/components/peds/ped-dialog";
import { PedsList } from "@/components/peds/peds-list";
import { PedsTable, type PedColumn } from "@/components/peds/peds-table";
import { PedsViewControls } from "@/components/peds/peds-view-controls";
import { pedCategory, summarizePeds } from "@/lib/peds-records";
import { pedsQueryOptions } from "@/lib/peds-query";
import { deletePed } from "@/lib/peds.functions";
import { PED_CATEGORIES, PED_CATEGORY_LABELS, PED_GROUPS, type PedInput } from "@/lib/peds-schema";

export function PedsContent() {
  const { data: rows } = useSuspenseQuery(pedsQueryOptions);
  const [categoria, setCategoria] = useState<PedInput["categoria"]>("Crianças");
  const [search, setSearch] = useState("");
  const [grupo, setGrupo] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "details">("table");
  const [compact, setCompact] = useState(true);
  const [columns, setColumns] = useState<PedColumn[]>(["responsavel", "tamanho", "discord_ped", "passaporte_ped", "adicao"]);
  const [editing, setEditing] = useState<PedRow | null | undefined>(undefined);
  const [removing, setRemoving] = useState<PedRow | null>(null);
  const queryClient = useQueryClient();
  const remove = useServerFn(deletePed);
  const deletion = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["peds"] }); setRemoving(null); toast.success("Ped movido para Removidos"); }, onError: (e: Error) => toast.error(e.message) });
  const normalized = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = rows.filter((r) => pedCategory(r) === categoria && (grupo === "todos" || (pedCategory(r) === "Removidos" ? "Removido" : r.grupo) === grupo) && (responsavel === "todos" || r.responsavel === responsavel) && (!normalized || [r.arquivo, r.responsavel, r.discord_ped, r.passaporte_ped, r.discord_responsavel, r.passaporte_responsavel, r.adicao, r.observacao, r.tamanho].join(" ").toLocaleLowerCase("pt-BR").includes(normalized)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, totalPages);
  const shown = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const owners = [...new Set(rows.map((r) => r.responsavel).filter(Boolean))].sort();
  const summary = summarizePeds(rows);
  const metrics = [
    { label: "Total de registros", value: summary.total, icon: Users },
    { label: "Setados", value: summary.setados, icon: CheckCircle2, cor: "var(--color-info)" },
    { label: "Não setados", value: summary.naoSetados, icon: Clock3, cor: "var(--color-warning)" },
    { label: "Removidos", value: summary.removidos, icon: Archive },
  ];
  return <div className="pagina min-w-0 space-y-4">
    <PageHeader title="Peds" subtitle="PED / KIDS" actions={<Button className="text-[13px]" onClick={() => setEditing(null)}><Plus className="size-4" /> Novo Ped</Button>} />
    <section aria-label="Resumo de Peds"><Indices>{metrics.map(({ label, value, icon, cor }) => <Indice key={label} valor={value} titulo={label} icone={icon} cor={cor} />)}</Indices></section>
    <div className="flex flex-wrap gap-2 px-1 text-xs text-muted-foreground"><span className="hc-selo">Skin padrão feminino · <code className="text-foreground">mp_f_freemode_01</code></span><span className="hc-selo">Skin padrão masculino · <code className="text-foreground">mp_m_freemode_01</code></span></div>
    <Tabs value={categoria} onValueChange={(v) => { const next = PED_CATEGORIES.find((c) => c === v); if (next) { setCategoria(next); setGrupo("todos"); setPage(1); } }}><TabsList className="segmentos h-auto max-w-full justify-start">{PED_CATEGORIES.map((c) => <TabsTrigger key={c} value={c} className="flex-none gap-2">{PED_CATEGORY_LABELS[c]}<span className="text-[10.5px] tabular-nums opacity-60">{rows.filter((r) => pedCategory(r) === c).length}</span></TabsTrigger>)}</TabsList></Tabs>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_200px]">
      <label className="campo-busca w-full"><Search className="size-[15px] shrink-0" strokeWidth={1.75} /><input aria-label="Buscar Peds" placeholder="Buscar skin, Discord, passaporte, observação…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
      <Select value={grupo} onValueChange={(v) => { setGrupo(v); setPage(1); }}><SelectTrigger aria-label="Filtrar grupo" className="rounded-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os grupos</SelectItem>{PED_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
      <Select value={responsavel} onValueChange={(v) => { setResponsavel(v); setPage(1); }}><SelectTrigger aria-label="Filtrar responsável" className="rounded-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os responsáveis</SelectItem>{owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5 px-1"><span className="hc-titulo">{PED_CATEGORY_LABELS[categoria]}</span><span className="hc-selo tabular-nums">{filtered.length} registros</span></div><PedsViewControls view={view} onView={setView} compact={compact} onCompact={() => setCompact((v) => !v)} columns={columns} onColumns={setColumns} /></div>
    {shown.length ? view === "table" ? <PedsTable rows={shown} columns={columns} compact={compact} onEdit={setEditing} onDelete={setRemoving} /> : <PedsList rows={shown} onEdit={setEditing} onDelete={setRemoving} /> : <div className="glass hc py-16 text-center text-sm text-muted-foreground">Nenhum Ped encontrado.</div>}
    <div className="flex items-center justify-end gap-3"><span className="text-xs tabular-nums text-muted-foreground">{currentPage} / {totalPages}</span><button type="button" className="hc-seta !size-9 disabled:pointer-events-none disabled:opacity-50" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></button><button type="button" className="hc-seta !size-9 disabled:pointer-events-none disabled:opacity-50" aria-label="Próxima página" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></button></div>
    {editing !== undefined && <PedDialog ped={editing} categoria={categoria} onClose={() => setEditing(undefined)} />}
    <AlertDialog open={Boolean(removing)} onOpenChange={(open) => { if (!open && !deletion.isPending) setRemoving(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="hc-titulo">Mover Ped para Removidos?</AlertDialogTitle><AlertDialogDescription>{removing?.arquivo} sairá dos registros ativos e não contará no total. Todas as informações serão preservadas na aba Removidos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deletion.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction className={buttonVariants({ variant: "destructive" })} disabled={deletion.isPending} onClick={(e) => { e.preventDefault(); if (removing) deletion.mutate(removing.id); }}>{deletion.isPending ? "Movendo…" : "Confirmar remoção"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}