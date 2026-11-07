import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, ChevronLeft, ChevronRight, Users, CheckCircle2, Clock3, Archive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { PedDialog, type PedRow } from "@/components/peds/ped-dialog";
import { PedsList } from "@/components/peds/peds-list";
import { PedsTable, type PedColumn } from "@/components/peds/peds-table";
import { PedsViewControls } from "@/components/peds/peds-view-controls";
import { pedCategory, summarizePeds } from "@/lib/peds-records";
import { cn } from "@/lib/utils";
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
    { label: "Total de registros", value: summary.total, icon: Users, tone: "text-foreground" },
    { label: "Setados", value: summary.setados, icon: CheckCircle2, tone: "text-info" },
    { label: "Não setados", value: summary.naoSetados, icon: Clock3, tone: "text-warning" },
    { label: "Removidos", value: summary.removidos, icon: Archive, tone: "text-muted-foreground" },
  ];
  return <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5 p-4 md:p-6">
    <PageHeader title="Peds" subtitle="PED / KIDS" actions={<Button onClick={() => setEditing(null)}><Plus className="size-4" /> Novo Ped</Button>} />
    <section aria-label="Resumo de Peds" className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">{metrics.map(({ label, value, icon: Icon, tone }) => <div key={label} className="border-l-2 border-border px-4 first:border-primary"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={cn("size-3.5", tone)} /><p>{label}</p></div><p className={cn("mt-2 text-3xl font-semibold tabular-nums font-display", tone)}>{value}</p></div>)}</section>
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-l-2 border-primary pl-3 text-xs text-muted-foreground"><span>Skin padrão feminino · <code className="text-foreground">mp_f_freemode_01</code></span><span>Skin padrão masculino · <code className="text-foreground">mp_m_freemode_01</code></span></div>
    <Tabs value={categoria} onValueChange={(v) => { const next = PED_CATEGORIES.find((c) => c === v); if (next) { setCategoria(next); setGrupo("todos"); setPage(1); } }}><TabsList className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">{PED_CATEGORIES.map((c) => <TabsTrigger key={c} value={c} className="gap-2 rounded-none border-b-2 border-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">{PED_CATEGORY_LABELS[c]}<span className="text-[10px] tabular-nums text-muted-foreground">{rows.filter((r) => pedCategory(r) === c).length}</span></TabsTrigger>)}</TabsList></Tabs>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_200px]">
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar Peds" className="pl-9" placeholder="Buscar skin, Discord, passaporte, observação…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      <Select value={grupo} onValueChange={(v) => { setGrupo(v); setPage(1); }}><SelectTrigger aria-label="Filtrar grupo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os grupos</SelectItem>{PED_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
      <Select value={responsavel} onValueChange={(v) => { setResponsavel(v); setPage(1); }}><SelectTrigger aria-label="Filtrar responsável"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os responsáveis</SelectItem>{owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{PED_CATEGORY_LABELS[categoria]}</span><span className="mx-2">·</span>{filtered.length} registros</div><PedsViewControls view={view} onView={setView} compact={compact} onCompact={() => setCompact((v) => !v)} columns={columns} onColumns={setColumns} /></div>
    {shown.length ? view === "table" ? <PedsTable rows={shown} columns={columns} compact={compact} onEdit={setEditing} onDelete={setRemoving} /> : <PedsList rows={shown} onEdit={setEditing} onDelete={setRemoving} /> : <div className="border-y border-border py-16 text-center text-sm text-muted-foreground">Nenhum Ped encontrado.</div>}
    <div className="flex items-center justify-end gap-3"><span className="text-xs text-muted-foreground">{currentPage} / {totalPages}</span><Button size="icon" variant="outline" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" aria-label="Próxima página" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></Button></div>
    {editing !== undefined && <PedDialog ped={editing} categoria={categoria} onClose={() => setEditing(undefined)} />}
    <AlertDialog open={Boolean(removing)} onOpenChange={(open) => { if (!open && !deletion.isPending) setRemoving(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Mover Ped para Removidos?</AlertDialogTitle><AlertDialogDescription>{removing?.arquivo} sairá dos registros ativos e não contará no total. Todas as informações serão preservadas na aba Removidos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deletion.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deletion.isPending} onClick={(e) => { e.preventDefault(); if (removing) deletion.mutate(removing.id); }}>{deletion.isPending ? "Movendo…" : "Confirmar remoção"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}