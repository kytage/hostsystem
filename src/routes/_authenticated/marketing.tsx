import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Camera, ChevronLeft, ChevronRight, Columns3, ExternalLink, FilePenLine, Loader2, Lock, Plus, Send, Trash2, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { MarketingLeads } from "@/components/marketing/leads";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getCurrentUsername } from "@/lib/kanban";
import {
  canAccessCombined,
  useAreaPermissions,
  useAreas,
  useMyAreas,
  useMyRole,
  usePermissions,
} from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import {
  atualizarConteudo,
  chaveDia,
  criarConteudo,
  deInput,
  excluirConteudo,
  fetchConteudos,
  FORMATOS,
  hora,
  paraInput,
  PLATAFORMAS,
  STATUS_CONTEUDO,
  TIPOS_POSTAGEM,
  type Conteudo,
  type ConteudoInput,
  type Plataforma,
  type StatusConteudo,
  type TipoPostagem,
} from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — HOST" },
      { name: "description", content: "Cronograma de gravações e publicações do Instagram e TikTok." },
    ],
  }),
  component: MarketingPage,
});

const KEY = ["marketing-conteudos"];
type Rascunho = Partial<Conteudo> | null;
type Filtro = "todas" | Plataforma;
type Tipo = "gravacao" | "post";
interface Evento {
  c: Conteudo;
  tipo: Tipo;
  iso: string;
}

function usePatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ConteudoInput> }) => atualizarConteudo(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const antes = qc.getQueryData<Conteudo[]>(KEY);
      qc.setQueryData<Conteudo[]>(KEY, (o) => o?.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return { antes };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(KEY, ctx.antes);
      toast.error("Não foi possível salvar a alteração.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

function MarketingPage() {
  const { data: role, isLoading: l1 } = useMyRole();
  const { data: areas = [], isLoading: l2 } = useMyAreas();
  const { data: perms, isLoading: l3 } = usePermissions();
  const { data: areaPerms, isLoading: l4 } = useAreaPermissions();
  const pode = !!role && canAccessCombined(role, areas, "marketing", perms, areaPerms);

  if (l1 || l2 || l3 || l4) {
    return (
      <div className="mt-24 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (!pode) {
    return (
      <div className="pagina">
        <PageHeader kicker="REDES SOCIAIS" title="Marketing" />
        <p className="glass-inset mt-6 flex items-center justify-center gap-2 rounded-2xl px-4 py-14 text-sm text-muted-foreground">
          <Lock className="size-4" /> Área restrita a Coordinator+ e à equipe de Marketing.
        </p>
      </div>
    );
  }
  return <Painel />;
}

function Painel() {
  useRealtimeTable("marketing_conteudos", [KEY]);
  const { data: todos = [], isLoading } = useQuery({ queryKey: KEY, queryFn: fetchConteudos });
  const [visao, setVisao] = useState<"calendario" | "pipeline" | "rascunhos" | "leads">("calendario");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [rascunho, setRascunho] = useState<Rascunho>(null);

  const lista = useMemo(() => (filtro === "todas" ? todos : todos.filter((c) => c.plataformas.includes(filtro))), [todos, filtro]);
  const rascunhos = lista.filter((c) => c.status === "rascunho");
  const agora = new Date();
  const agoraIso = agora.toISOString();
  const mesAtual = chaveDia(agora).slice(0, 7);
  const proximas = lista
    .filter((c) => c.data_gravacao && c.data_gravacao >= agoraIso && c.status !== "publicado")
    .sort((a, b) => a.data_gravacao!.localeCompare(b.data_gravacao!));
  const fila = lista
    .filter((c) => c.data_publicacao && c.data_publicacao >= agoraIso && c.status !== "publicado")
    .sort((a, b) => a.data_publicacao!.localeCompare(b.data_publicacao!));

  const kpis = [
    { k: "Próximas gravações", v: proximas.length },
    { k: "Publicações na fila", v: fila.length },
    { k: "Publicados no mês", v: lista.filter((c) => c.status === "publicado" && c.data_publicacao && chaveDia(new Date(c.data_publicacao)).slice(0, 7) === mesAtual).length },
    { k: "Ideias", v: lista.filter((c) => c.status === "ideia").length },
    { k: "Views publicadas", v: lista.reduce((s, c) => s + c.views, 0).toLocaleString("pt-BR") },
  ];
  const seg = (on: boolean) =>
    cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors", on ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        kicker="REDES SOCIAIS"
        title="Marketing"
        subtitle="Cronograma de gravações e publicações da cidade."
        actions={
          <Button onClick={() => setRascunho({})}>
            <Plus className="size-4" /> Novo conteúdo
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((c) => (
          <div key={c.k} className="border-l border-white/[0.08] pl-4">
            <p className="font-display text-2xl font-semibold tabular-nums">{isLoading ? "—" : c.v}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.k}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-2">
        <div className={cn("glass-inset inline-flex gap-1 rounded-full p-1", visao === "leads" && "invisible")} aria-hidden={visao === "leads"}>
          <button className={seg(filtro === "todas")} onClick={() => setFiltro("todas")}>Todas</button>
          {PLATAFORMAS.map((p) => (
            <button key={p.id} className={seg(filtro === p.id)} onClick={() => setFiltro(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="glass-inset inline-flex gap-1 rounded-full p-1">
          <button className={seg(visao === "calendario")} onClick={() => setVisao("calendario")}>
            <CalendarDays className="size-3.5" /> Cronograma
          </button>
          <button className={seg(visao === "pipeline")} onClick={() => setVisao("pipeline")}>
            <Columns3 className="size-3.5" /> Produção
          </button>
          <button className={seg(visao === "rascunhos")} onClick={() => setVisao("rascunhos")}>
            <FilePenLine className="size-3.5" /> Rascunhos <span className="text-ink-3">{rascunhos.length}</span>
          </button>
          <button className={seg(visao === "leads")} onClick={() => setVisao("leads")}>
            <UserSearch className="size-3.5" /> Leads
          </button>
        </div>
      </div>

      {visao === "leads" ? (
        <MarketingLeads />
      ) : isLoading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando conteúdos…
        </div>
      ) : visao === "calendario" ? (
        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Calendario lista={lista} onAbrir={setRascunho} />
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Proximos titulo="Próximas gravações" icon={Camera} itens={proximas} campo="data_gravacao" onAbrir={setRascunho} />
            <Proximos titulo="Fila de publicação" icon={Send} itens={fila} campo="data_publicacao" onAbrir={setRascunho} />
          </aside>
        </div>
      ) : visao === "rascunhos" ? (
        <Rascunhos itens={rascunhos} onAbrir={setRascunho} />
      ) : (
        <Pipeline lista={lista} onAbrir={setRascunho} />
      )}

      {rascunho && <ConteudoDialog key={rascunho.id ?? "novo"} inicial={rascunho} onClose={() => setRascunho(null)} />}
    </div>
  );
}

function Siglas({ c }: { c: Conteudo }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {PLATAFORMAS.filter((p) => c.plataformas.includes(p.id)).map((p) => (
        <span key={p.id} title={p.label} className={cn("rounded border px-1 text-[9px] font-semibold leading-[14px]", p.cls)}>{p.sigla}</span>
      ))}
    </span>
  );
}

function AreasTags({ ids }: { ids: string[] }) {
  const { data: areas = [] } = useAreas();
  if (ids.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {ids.map((id) => {
        const a = areas.find((x) => x.key === id);
        return (
          <span key={id} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 text-[10px] leading-4 text-muted-foreground">
            {a ? `${a.emoji} ${a.label}` : id}
          </span>
        );
      })}
    </span>
  );
}

function SeloCampanha({ c }: { c: Conteudo }) {
  if (c.tipo_postagem !== "campanha") return null;
  return <span className="rounded-full border border-primary/35 bg-primary/10 px-1.5 text-[10px] leading-4 text-red-200">Campanha</span>;
}

function Rascunhos({ itens, onAbrir }: { itens: Conteudo[]; onAbrir: (c: Conteudo) => void }) {
  const qc = useQueryClient();
  const patch = usePatch();
  const { data: eu = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });
  const [titulo, setTitulo] = useState("");
  const [convertendo, setConvertendo] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: () =>
      criarConteudo(
        {
          titulo: titulo.trim(), roteiro: "", plataformas: ["instagram", "tiktok"], formato: "reels", status: "rascunho",
          data_gravacao: null, data_publicacao: null, responsavel: "", local: "", link: "", views: 0, curtidas: 0, areas: [], tipo_postagem: "comum",
        },
        eu,
      ),
    onSuccess: () => {
      playSfx("add");
      setTitulo("");
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.error("Não foi possível salvar o rascunho."),
  });
  const enviar = () => {
    if (titulo.trim() && eu && !criar.isPending) criar.mutate();
  };

  return (
    <section className="mx-auto mt-5 max-w-3xl">
      <div className="glass flex items-center gap-2 rounded-[20px] p-2">
        <Plus className="ml-2.5 size-4 shrink-0 text-ink-3" />
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Anote uma ideia sem data e aperte Enter"
          aria-label="Novo rascunho"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
        {criar.isPending && <Loader2 className="mr-2 size-4 animate-spin text-muted-foreground" />}
      </div>

      <ul className="mt-3 space-y-2">
        {itens.map((c) => (
          <li key={c.id} className="glass animate-rise rounded-2xl">
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => onAbrir(c)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{c.titulo}</span>
                {c.roteiro && <span className="block truncate text-[11.5px] text-ink-3">{c.roteiro}</span>}
                {(c.areas.length > 0 || c.tipo_postagem === "campanha") && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <SeloCampanha c={c} />
                    <AreasTags ids={c.areas} />
                  </span>
                )}
              </button>
              <button
                onClick={() => setConvertendo((v) => (v === c.id ? null : c.id))}
                aria-expanded={convertendo === c.id}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Converter <ArrowRight className="size-3" />
              </button>
            </div>
            <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", convertendo === c.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] px-4 py-2.5">
                  <span className="mr-1 text-[11px] text-ink-3">Enviar para</span>
                  {STATUS_CONTEUDO.map((s) => (
                    <button
                      key={s.id}
                      tabIndex={convertendo === c.id ? 0 : -1}
                      onClick={() => {
                        playSfx("check");
                        setConvertendo(null);
                        patch.mutate({ id: c.id, patch: { status: s.id } });
                        toast.success(`“${c.titulo}” foi para ${s.label}.`);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                    >
                      <span className={cn("size-1.5 rounded-full", s.dot)} /> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </li>
        ))}
        {itens.length === 0 && <li className="glass-inset rounded-2xl px-4 py-12 text-center text-sm text-ink-3">Nenhum rascunho por aqui.</li>}
      </ul>
    </section>
  );
}

function Proximos({ titulo, icon: Icon, itens, campo, onAbrir }: {
  titulo: string;
  icon: typeof Camera;
  itens: Conteudo[];
  campo: "data_gravacao" | "data_publicacao";
  onAbrir: (c: Conteudo) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold">
        <Icon className="size-3.5 text-ink-3" /> {titulo}
        {itens.length > 0 && <span className="font-sans text-[11px] font-normal tabular-nums text-ink-3">{itens.length}</span>}
      </h2>
      {itens.length === 0 ? (
        <p className="text-xs text-ink-3">Nada agendado.</p>
      ) : (
        // todos os itens aparecem; se a lista ficar comprida, ela rola dentro da coluna
        <ul className="-mr-1 max-h-[46vh] space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {itens.map((c) => {
            const d = new Date(c[campo]!);
            return (
              <li key={c.id}>
                <button onClick={() => onAbrir(c)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]">
                  <span className="w-9 shrink-0 text-center">
                    <span className="block font-display text-base font-semibold leading-none tabular-nums">{d.getDate()}</span>
                    <span className="text-[9.5px] uppercase text-ink-3">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{c.titulo}</span>
                    <span className="block truncate text-[11px] text-ink-3">{hora(c[campo]!)}{c.responsavel && ` · ${c.responsavel}`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Calendario({ lista, onAbrir }: { lista: Conteudo[]; onAbrir: (r: Partial<Conteudo>) => void }) {
  const patch = usePatch();
  const [ref, setRef] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [sobre, setSobre] = useState<string | null>(null);
  const hoje = chaveDia(new Date());

  const dias = useMemo(() => {
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1 - ref.getDay());
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate() + ref.getDay();
    const total = Math.ceil(fim / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i));
  }, [ref]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    const add = (c: Conteudo, tipo: Tipo, iso: string | null) => {
      if (!iso) return;
      const k = chaveDia(new Date(iso));
      m.set(k, [...(m.get(k) ?? []), { c, tipo, iso }]);
    };
    for (const c of lista) {
      add(c, "gravacao", c.data_gravacao);
      add(c, "post", c.data_publicacao);
    }
    for (const v of m.values()) v.sort((a, b) => a.iso.localeCompare(b.iso));
    return m;
  }, [lista]);

  const soltar = (e: React.DragEvent, dia: Date) => {
    e.preventDefault();
    setSobre(null);
    const [id, tipo] = e.dataTransfer.getData("text/plain").split("|");
    const c = lista.find((x) => x.id === id);
    if (!c) return;
    const campo = tipo === "gravacao" ? "data_gravacao" : "data_publicacao";
    const atual = c[campo];
    if (!atual) return;
    const o = new Date(atual);
    const nova = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), o.getHours(), o.getMinutes());
    if (nova.getTime() === o.getTime()) return;
    playSfx("click");
    patch.mutate({ id: c.id, patch: { [campo]: nova.toISOString() } });
  };

  const mudarMes = (n: number) => setRef((r) => new Date(r.getFullYear(), r.getMonth() + n, 1));

  return (
    <section className="glass min-w-0 rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-1">
        <h2 className="flex-1 font-display text-base font-semibold capitalize">{ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
        <span className="mr-2 hidden items-center gap-3 text-[11px] text-ink-3 sm:flex">
          <span className="flex items-center gap-1"><Camera className="size-3 text-primary" /> Gravação</span>
          <span className="flex items-center gap-1"><Send className="size-3 text-sky-300" /> Publicação</span>
        </span>
        <button onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"><ChevronLeft className="size-4" /></button>
        <button onClick={() => mudarMes(1)} aria-label="Próximo mês" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"><ChevronRight className="size-4" /></button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 pb-1.5 text-center text-[10.5px] uppercase tracking-wider text-ink-3">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((d) => {
              const k = chaveDia(d);
              const evs = porDia.get(k) ?? [];
              const foraMes = d.getMonth() !== ref.getMonth();
              return (
                <div
                  key={k}
                  onDragOver={(e) => { e.preventDefault(); setSobre(k); }}
                  onDragLeave={() => setSobre((s) => (s === k ? null : s))}
                  onDrop={(e) => soltar(e, d)}
                  className={cn(
                    "group flex min-h-[104px] flex-col gap-0.5 rounded-xl border p-1 transition-colors",
                    sobre === k ? "border-primary/40 bg-primary/5" : "border-white/[0.04] bg-white/[0.012]",
                    foraMes && "opacity-40",
                  )}
                >
                  <div className="flex items-center justify-between px-1">
                    <span className={cn("grid size-5 place-items-center rounded-full text-[11px] tabular-nums", k === hoje ? "bg-primary font-semibold text-white" : "text-muted-foreground")}>{d.getDate()}</span>
                    <button
                      onClick={() => onAbrir({ data_publicacao: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18).toISOString() })}
                      aria-label={`Novo conteúdo em ${d.toLocaleDateString("pt-BR")}`}
                      className="grid size-5 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  {evs.map((ev) => {
                    const Icon = ev.tipo === "gravacao" ? Camera : Send;
                    return (
                      <button
                        key={ev.c.id + ev.tipo}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", `${ev.c.id}|${ev.tipo}`)}
                        onClick={() => onAbrir(ev.c)}
                        title={`${ev.tipo === "gravacao" ? "Gravação" : "Publicação"} · ${hora(ev.iso)} · ${ev.c.titulo}`}
                        className={cn(
                          "flex w-full cursor-grab items-center gap-1 rounded-md px-1 py-0.5 text-left text-[10.5px] transition-colors active:cursor-grabbing",
                          ev.tipo === "gravacao" ? "bg-primary/15 hover:bg-primary/25" : "bg-sky-500/10 hover:bg-sky-500/20",
                          ev.c.status === "publicado" && "opacity-60",
                        )}
                      >
                        <Icon className={cn("size-2.5 shrink-0", ev.tipo === "gravacao" ? "text-red-300" : "text-sky-300")} />
                        <span className="min-w-0 flex-1 truncate">{ev.c.titulo}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pipeline({ lista, onAbrir }: { lista: Conteudo[]; onAbrir: (c: Conteudo) => void }) {
  const patch = usePatch();
  const [sobre, setSobre] = useState<StatusConteudo | null>(null);
  return (
    <div className="mt-5 flex gap-3 overflow-x-auto pb-3">
      {STATUS_CONTEUDO.map((s) => {
        const cards = lista.filter((c) => c.status === s.id);
        return (
          <section
            key={s.id}
            onDragOver={(e) => { e.preventDefault(); setSobre(s.id); }}
            onDragLeave={() => setSobre((o) => (o === s.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const id = e.dataTransfer.getData("text/plain");
              const c = lista.find((x) => x.id === id);
              if (!c || c.status === s.id) return;
              playSfx(s.id === "publicado" ? "complete" : "click");
              patch.mutate({ id, patch: { status: s.id } });
            }}
            className={cn("flex min-h-64 w-[230px] shrink-0 flex-col rounded-2xl border p-2 transition-colors", sobre === s.id ? "border-primary/40 bg-primary/5" : "border-white/[0.05] bg-white/[0.012]")}
          >
            <header className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-xs font-medium">
              <span className={cn("size-1.5 rounded-full", s.dot)} /> {s.label}
              <span className="ml-auto text-ink-3">{cards.length}</span>
            </header>
            <div className="space-y-1.5">
              {cards.map((c) => (
                <button
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  onClick={() => onAbrir(c)}
                  className="glass surface-hover block w-full cursor-grab rounded-xl p-2.5 text-left active:cursor-grabbing"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-ink-3">{FORMATOS.find((f) => f.id === c.formato)?.label ?? c.formato}</span>
                    <Siglas c={c} />
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[13px] font-medium leading-snug">{c.titulo}</span>
                  {(c.areas.length > 0 || c.tipo_postagem === "campanha") && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      <SeloCampanha c={c} />
                      <AreasTags ids={c.areas} />
                    </span>
                  )}
                  {(c.data_gravacao || c.data_publicacao || c.responsavel) && (
                    <span className="mt-1.5 block truncate text-[10.5px] text-ink-3">
                      {c.status === "publicado" && c.views > 0
                        ? `${c.views.toLocaleString("pt-BR")} views`
                        : [
                            c.data_publicacao ? new Date(c.data_publicacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null,
                            c.responsavel || null,
                          ].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ConteudoDialog({ inicial, onClose }: { inicial: Partial<Conteudo>; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: eu = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });
  const { data: todasAreas = [] } = useAreas();
  const [f, setF] = useState({
    titulo: inicial.titulo ?? "",
    roteiro: inicial.roteiro ?? "",
    plataformas: inicial.plataformas ?? (["instagram", "tiktok"] as Plataforma[]),
    formato: inicial.formato ?? "reels",
    status: inicial.status ?? ("ideia" as StatusConteudo),
    gravacao: paraInput(inicial.data_gravacao ?? null),
    publicacao: paraInput(inicial.data_publicacao ?? null),
    responsavel: inicial.responsavel ?? "",
    local: inicial.local ?? "",
    link: inicial.link ?? "",
    views: inicial.views ?? 0,
    curtidas: inicial.curtidas ?? 0,
    areas: inicial.areas ?? ([] as string[]),
    tipo_postagem: inicial.tipo_postagem ?? ("comum" as TipoPostagem),
  });
  const ehRascunho = f.status === "rascunho";
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));
  const fim = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    onClose();
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const input: ConteudoInput = {
        titulo: f.titulo.trim(),
        roteiro: f.roteiro,
        plataformas: f.plataformas,
        formato: f.formato,
        status: f.status,
        data_gravacao: ehRascunho ? null : deInput(f.gravacao),
        data_publicacao: ehRascunho ? null : deInput(f.publicacao),
        responsavel: f.responsavel.trim(),
        local: f.local.trim(),
        link: f.link.trim(),
        views: f.views,
        curtidas: f.curtidas,
        areas: f.areas,
        tipo_postagem: f.tipo_postagem,
      };
      if (inicial.id) await atualizarConteudo(inicial.id, input);
      else await criarConteudo(input, eu);
    },
    onSuccess: () => {
      playSfx("add");
      fim();
    },
    onError: () => toast.error("Não foi possível salvar o conteúdo."),
  });
  const remover = useMutation({
    mutationFn: () => excluirConteudo(inicial.id!),
    onSuccess: () => {
      playSfx("remove");
      fim();
    },
    onError: () => toast.error("Não foi possível excluir o conteúdo."),
  });

  const label = "mb-1.5 block text-xs text-muted-foreground";
  const campo = "h-10 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm outline-none [color-scheme:dark] placeholder:text-ink-3 focus:border-white/20";
  const chip = (on: boolean) => cn("rounded-lg border px-3 py-1.5 text-xs transition-colors", on ? "border-white/20 bg-white/[0.1] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <header className="border-b border-white/[0.07] px-6 pb-4 pt-6 pr-14">
          <div className="flex flex-wrap gap-1">
            {[{ id: "rascunho" as StatusConteudo, label: "Rascunho", dot: "bg-white/20" }, ...STATUS_CONTEUDO].map((s) => (
              <button key={s.id} onClick={() => set("status", s.id)} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition-colors", f.status === s.id ? "bg-white/[0.12] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <span className={cn("size-1.5 rounded-full", s.dot)} /> {s.label}
              </button>
            ))}
          </div>
          <DialogTitle asChild>
            <input autoFocus value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Título do conteúdo" aria-label="Título do conteúdo" className="mt-3 w-full bg-transparent font-display text-xl font-semibold outline-none placeholder:text-ink-3" />
          </DialogTitle>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <span className={label}>Redes</span>
              <div className="flex gap-2">
                {PLATAFORMAS.map((p) => {
                  const on = f.plataformas.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => set("plataformas", on ? f.plataformas.filter((x) => x !== p.id) : [...f.plataformas, p.id])} className={cn("rounded-lg border px-3 py-1.5 text-xs transition-colors", on ? p.cls : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className={label}>Formato</span>
              <div className="flex flex-wrap gap-1.5">
                {FORMATOS.map((x) => <button key={x.id} onClick={() => set("formato", x.id)} className={chip(f.formato === x.id)}>{x.label}</button>)}
              </div>
            </div>
          </div>

          <div>
            <span className={label}>Tipo de postagem</span>
            <div className="flex gap-2">
              {TIPOS_POSTAGEM.map((t) => <button key={t.id} onClick={() => set("tipo_postagem", t.id)} className={chip(f.tipo_postagem === t.id)}>{t.label}</button>)}
            </div>
          </div>

          <div>
            <span className={label}>Áreas relacionadas</span>
            <div className="flex flex-wrap gap-1.5">
              {todasAreas.map((a) => {
                const on = f.areas.includes(a.key);
                return <button key={a.key} aria-pressed={on} onClick={() => set("areas", on ? f.areas.filter((x) => x !== a.key) : [...f.areas, a.key])} className={chip(on)}>{a.emoji} {a.label}</button>;
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!ehRascunho && (
              <>
                <label className="block"><span className={label}>Gravação</span><input type="datetime-local" value={f.gravacao} onChange={(e) => set("gravacao", e.target.value)} className={campo} /></label>
                <label className="block"><span className={label}>Publicação</span><input type="datetime-local" value={f.publicacao} onChange={(e) => set("publicacao", e.target.value)} className={campo} /></label>
              </>
            )}
            <label className="block"><span className={label}>Responsável</span><input value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Quem cuida deste conteúdo" className={campo} /></label>
            <label className="block"><span className={label}>Local da gravação</span><input value={f.local} onChange={(e) => set("local", e.target.value)} placeholder="Ex.: Praça central" className={campo} /></label>
          </div>

          <label className="block">
            <span className={label}>Roteiro e legenda</span>
            <textarea value={f.roteiro} onChange={(e) => set("roteiro", e.target.value)} rows={5} placeholder="Ideia, cenas, falas, legenda e hashtags…" className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 text-sm outline-none placeholder:text-ink-3 focus:border-white/20" />
          </label>

          {f.status === "publicado" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_110px_110px]">
              <label className="block">
                <span className={label}>Link da publicação</span>
                <span className="relative block">
                  <input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" className={cn(campo, "pr-9")} />
                  {/^https?:\/\//i.test(f.link) && (
                    <a href={f.link} target="_blank" rel="noreferrer" aria-label="Abrir publicação" className="absolute right-2.5 top-3 text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" /></a>
                  )}
                </span>
              </label>
              <label className="block"><span className={label}>Views</span><input type="number" min={0} value={f.views} onChange={(e) => set("views", Math.max(0, Number(e.target.value) || 0))} className={campo} /></label>
              <label className="block"><span className={label}>Curtidas</span><input type="number" min={0} value={f.curtidas} onChange={(e) => set("curtidas", Math.max(0, Number(e.target.value) || 0))} className={campo} /></label>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/[0.07] px-6 py-3">
          {inicial.id ? (
            <button onClick={() => { if (window.confirm(`Excluir “${f.titulo}”?`)) remover.mutate(); }} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive">
              <Trash2 className="size-3.5" /> Excluir
            </button>
          ) : <span />}
          <Button onClick={() => salvar.mutate()} disabled={!f.titulo.trim() || salvar.isPending}>
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
