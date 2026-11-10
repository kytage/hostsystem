import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FilePenLine, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getCurrentUsername } from "@/lib/kanban";
import { criarConteudo } from "@/lib/marketing";
import {
  atualizarLead,
  atualizarReferencia,
  CATEGORIAS_VIDEO,
  criarLead,
  criarReferencia,
  ehLink,
  excluirLead,
  excluirReferencia,
  fetchLeads,
  fetchReferencias,
  INTERESSES,
  LEAD_STATUS,
  LEAD_TIPOS,
  LEAD_VAZIO,
  lerLink,
  NICHOS,
  REDES,
  REFERENCIA_VAZIA,
  rotulo,
  type Lead,
  type LeadInput,
  type Referencia,
  type ReferenciaInput,
} from "@/lib/marketing-leads";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";

const KEY_LEADS = ["marketing-leads"];
const KEY_REFS = ["marketing-referencias"];

const campo =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm outline-none transition-colors [color-scheme:dark] placeholder:text-ink-3 focus:border-white/25";
const seletorLinha = "h-8 rounded-lg border border-white/[0.08] bg-black/30 px-2 text-xs outline-none [color-scheme:dark] focus:border-white/25";
const rotuloCls = "mb-1.5 block text-xs text-muted-foreground";
const seg = (on: boolean) =>
  cn("rounded-full px-3 py-1.5 text-xs transition-colors", on ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground");

const numero = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".0", "")} mi` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")} mil` : String(n));
const hoje = () => new Date().toLocaleDateString("en-CA");

function Opcoes({ lista }: { lista: { id: string; label: string }[] }) {
  return (
    <>
      {lista.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </>
  );
}

function Seletor({ titulo, value, onChange, lista }: { titulo: string; value: string; onChange: (v: string) => void; lista: { id: string; label: string }[] }) {
  return (
    <label className="block">
      <span className={rotuloCls}>{titulo}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={campo}>
        <Opcoes lista={lista} />
      </select>
    </label>
  );
}

function Kpis({ itens, carregando }: { itens: { k: string; v: ReactNode }[]; carregando: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
      {itens.map((c) => (
        <div key={c.k} className="border-l border-white/[0.08] pl-4">
          <p className="font-display text-2xl font-semibold tabular-nums">{carregando ? "—" : c.v}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{c.k}</p>
        </div>
      ))}
    </div>
  );
}

function CampoRapido({ placeholder, rotulo: nome, ocupado, onEnviar }: { placeholder: string; rotulo: string; ocupado: boolean; onEnviar: (texto: string) => void }) {
  const [texto, setTexto] = useState("");
  return (
    <div className="glass flex items-center gap-2 rounded-[20px] p-2">
      <Plus className="ml-2.5 size-4 shrink-0 text-ink-3" />
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && texto.trim() && !ocupado) {
            onEnviar(texto.trim());
            setTexto("");
          }
        }}
        placeholder={placeholder}
        aria-label={nome}
        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
      />
      {ocupado && <Loader2 className="mr-2 size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function Busca({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="glass-inset flex h-9 w-full items-center gap-2 rounded-full px-3 sm:w-56">
      <Search className="size-3.5 shrink-0 text-ink-3" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Buscar" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-3" />
    </label>
  );
}

export function MarketingLeads() {
  const [aba, setAba] = useState<"clientes" | "videos">("clientes");
  return (
    <section className="mt-5">
      <div className="glass-inset inline-flex gap-1 rounded-full p-1">
        <button className={seg(aba === "clientes")} onClick={() => setAba("clientes")}>Possíveis clientes</button>
        <button className={seg(aba === "videos")} onClick={() => setAba("videos")}>Tipos de vídeo</button>
      </div>
      <div className="mt-5">{aba === "clientes" ? <Clientes /> : <Videos />}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Possíveis clientes
 * ------------------------------------------------------------------ */

function Clientes() {
  const qc = useQueryClient();
  useRealtimeTable("marketing_leads", [KEY_LEADS]);
  const { data: leads = [], isLoading, isError } = useQuery({ queryKey: KEY_LEADS, queryFn: fetchLeads });
  const { data: eu = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });
  const [status, setStatus] = useState("todos");
  const [nicho, setNicho] = useState("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Lead | null>(null);
  const recarregar = () => void qc.invalidateQueries({ queryKey: KEY_LEADS });

  const criar = useMutation({
    mutationFn: (texto: string) => {
      const lido = ehLink(texto) ? lerLink(texto) : null;
      const input: LeadInput = lido
        ? { ...LEAD_VAZIO, nome: lido.usuario ? `@${lido.usuario}` : `Perfil no ${rotulo(REDES, lido.plataforma)}`, plataforma: lido.plataforma, link: texto }
        : { ...LEAD_VAZIO, nome: texto.slice(0, 80) };
      return criarLead(input, eu);
    },
    onSuccess: () => {
      playSfx("add");
      recarregar();
    },
    onError: () => toast.error("Não foi possível salvar o lead."),
  });
  const mudar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LeadInput> }) => atualizarLead(id, patch),
    onSuccess: recarregar,
    onError: () => toast.error("Não foi possível salvar a alteração."),
  });

  const q = busca.trim().toLowerCase();
  const lista = useMemo(
    () =>
      leads.filter(
        (l) =>
          (status === "todos" || l.status === status) &&
          (nicho === "todos" || l.nicho === nicho) &&
          (!q || [l.nome, l.contato, l.responsavel, l.notas, l.link].some((v) => v.toLowerCase().includes(q))),
      ),
    [leads, status, nicho, q],
  );

  const conta = (s: string) => leads.filter((l) => l.status === s).length;
  const decididos = conta("fechado") + conta("perdido");
  const kpis = [
    { k: "Leads", v: leads.length },
    { k: "Novos", v: conta("novo") },
    { k: "Em conversa", v: conta("conversa") },
    { k: "Fechados", v: conta("fechado") },
    { k: "Conversão", v: decididos ? `${Math.round((conta("fechado") / decididos) * 100)}%` : "—" },
  ];

  return (
    <div>
      <Kpis itens={kpis} carregando={isLoading} />
      <div className="mt-5">
        <CampoRapido placeholder="Cole o link do perfil ou escreva o nome e aperte Enter" rotulo="Novo lead" ocupado={criar.isPending} onEnviar={(t) => eu && criar.mutate(t)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="glass-inset flex flex-wrap gap-1 rounded-full p-1">
          <button className={seg(status === "todos")} onClick={() => setStatus("todos")}>Todos <span className="text-ink-3">{leads.length}</span></button>
          {LEAD_STATUS.map((s) => (
            <button key={s.id} className={seg(status === s.id)} onClick={() => setStatus(s.id)}>
              {s.label} <span className="text-ink-3">{conta(s.id)}</span>
            </button>
          ))}
        </div>
        <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Filtrar por nicho" className={cn(seletorLinha, "ml-auto h-9 rounded-full px-3")}>
          <option value="todos">Todos os nichos</option>
          <Opcoes lista={NICHOS} />
        </select>
        <Busca value={busca} onChange={setBusca} />
      </div>

      {isError ? (
        <p className="glass-inset mt-4 rounded-2xl px-4 py-12 text-center text-sm text-muted-foreground">Não foi possível carregar os leads.</p>
      ) : isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando leads…</div>
      ) : lista.length === 0 ? (
        <p className="glass-inset mt-4 rounded-2xl px-4 py-12 text-center text-sm text-muted-foreground">
          {leads.length === 0 ? "Nenhum lead ainda. Cole o link de um perfil acima para começar." : "Nenhum lead com esses filtros."}
        </p>
      ) : (
        <ul className="glass mt-4 divide-y divide-white/[0.05] rounded-[20px]">
          {lista.map((l) => {
            const st = LEAD_STATUS.find((s) => s.id === l.status);
            const atrasado = !!l.proximo_contato && l.proximo_contato < hoje() && l.status !== "fechado" && l.status !== "perdido";
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", st?.dot ?? "bg-white/40")} />
                <button onClick={() => setEditando(l)} className="min-w-0 flex-1 basis-48 text-left">
                  <span className="block truncate text-sm font-medium">{l.nome}</span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {[rotulo(LEAD_TIPOS, l.tipo), rotulo(NICHOS, l.nicho), rotulo(REDES, l.plataforma), l.seguidores > 0 ? `${numero(l.seguidores)} seguidores` : "", l.responsavel].filter(Boolean).join(" · ")}
                  </span>
                </button>
                {l.proximo_contato && (
                  <span className={cn("shrink-0 text-[11px] tabular-nums", atrasado ? "text-red-300" : "text-muted-foreground")} title="Próximo contato">
                    {l.proximo_contato.split("-").reverse().slice(0, 2).join("/")}
                  </span>
                )}
                <span className="shrink-0 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10.5px] text-muted-foreground">{rotulo(INTERESSES, l.interesse)}</span>
                <select value={l.status} onChange={(e) => mudar.mutate({ id: l.id, patch: { status: e.target.value } })} aria-label={`Status de ${l.nome}`} className={seletorLinha}>
                  <Opcoes lista={LEAD_STATUS} />
                </select>
                {ehLink(l.link) ? (
                  <a href={l.link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir perfil de ${l.nome}`} title="Abrir perfil" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </a>
                ) : (
                  <span className="size-8 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editando && <LeadDialog lead={editando} onClose={() => setEditando(null)} onMudou={recarregar} />}
    </div>
  );
}

function LeadDialog({ lead, onClose, onMudou }: { lead: Lead; onClose: () => void; onMudou: () => void }) {
  const [f, setF] = useState<LeadInput>(() => {
    const { id: _id, created_at: _c, ...resto } = lead;
    return resto;
  });
  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setF((o) => ({ ...o, [k]: v }));
  const fim = () => {
    onMudou();
    onClose();
  };
  const salvar = useMutation({
    mutationFn: () => atualizarLead(lead.id, { ...f, nome: f.nome.trim(), link: f.link.trim() }),
    onSuccess: fim,
    onError: () => toast.error("Não foi possível salvar o lead."),
  });
  const remover = useMutation({
    mutationFn: () => excluirLead(lead.id),
    onSuccess: () => {
      playSfx("remove");
      fim();
    },
    onError: () => toast.error("Não foi possível excluir o lead."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
        <DialogTitle>Lead</DialogTitle>
        <div className="space-y-3">
          <label className="block">
            <span className={rotuloCls}>Nome</span>
            <input value={f.nome} onChange={(e) => set("nome", e.target.value)} maxLength={80} className={campo} />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Seletor titulo="Status" value={f.status} onChange={(v) => set("status", v)} lista={LEAD_STATUS} />
            <Seletor titulo="Tipo" value={f.tipo} onChange={(v) => set("tipo", v)} lista={LEAD_TIPOS} />
            <Seletor titulo="Nicho" value={f.nicho} onChange={(v) => set("nicho", v)} lista={NICHOS} />
            <Seletor titulo="Rede" value={f.plataforma} onChange={(v) => set("plataforma", v)} lista={REDES} />
            <Seletor titulo="Interesse" value={f.interesse} onChange={(v) => set("interesse", v)} lista={INTERESSES} />
            <label className="block">
              <span className={rotuloCls}>Seguidores</span>
              <input type="number" min={0} value={f.seguidores} onChange={(e) => set("seguidores", Math.max(0, Math.round(Number(e.target.value) || 0)))} className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={rotuloCls}>Link do perfil</span>
            <input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" inputMode="url" className={campo} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={rotuloCls}>Contato</span>
              <input value={f.contato} onChange={(e) => set("contato", e.target.value)} placeholder="Discord, WhatsApp…" className={campo} />
            </label>
            <label className="block">
              <span className={rotuloCls}>Responsável</span>
              <input value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Quem cuida" className={campo} />
            </label>
            <label className="block">
              <span className={rotuloCls}>Próximo contato</span>
              <input type="date" value={f.proximo_contato ?? ""} onChange={(e) => set("proximo_contato", e.target.value || null)} className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={rotuloCls}>Notas</span>
            <textarea value={f.notas} onChange={(e) => set("notas", e.target.value)} rows={3} placeholder="O que foi conversado, proposta, próximos passos…" className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-white/25" />
          </label>
          <Rodape nome={f.nome} salvando={salvar.isPending} podeSalvar={f.nome.trim().length > 0} onSalvar={() => salvar.mutate()} onExcluir={() => remover.mutate()} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Rodape({ nome, salvando, podeSalvar, onSalvar, onExcluir }: { nome: string; salvando: boolean; podeSalvar: boolean; onSalvar: () => void; onExcluir: () => void }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Excluir “${nome}”?`)) onExcluir();
        }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-3.5" /> Excluir
      </button>
      <button type="button" onClick={onSalvar} disabled={!podeSalvar || salvando} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40">
        {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tipos de vídeo (referências)
 * ------------------------------------------------------------------ */

function Videos() {
  const qc = useQueryClient();
  useRealtimeTable("marketing_referencias", [KEY_REFS]);
  const { data: refs = [], isLoading, isError } = useQuery({ queryKey: KEY_REFS, queryFn: fetchReferencias });
  const { data: eu = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });
  const [categoria, setCategoria] = useState("todas");
  const [nicho, setNicho] = useState("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Referencia | null>(null);
  const recarregar = () => void qc.invalidateQueries({ queryKey: KEY_REFS });

  const criar = useMutation({
    mutationFn: (texto: string) => {
      const lido = ehLink(texto) ? lerLink(texto) : null;
      const input: ReferenciaInput = lido
        ? { ...REFERENCIA_VAZIA, titulo: lido.usuario ? `Vídeo de @${lido.usuario}` : `Vídeo do ${rotulo(REDES, lido.plataforma)}`, plataforma: lido.plataforma, canal: lido.usuario, link: texto }
        : { ...REFERENCIA_VAZIA, titulo: texto.slice(0, 120) };
      return criarReferencia(input, eu);
    },
    onSuccess: () => {
      playSfx("add");
      recarregar();
    },
    onError: () => toast.error("Não foi possível salvar a referência."),
  });
  const mudar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ReferenciaInput> }) => atualizarReferencia(id, patch),
    onSuccess: recarregar,
    onError: () => toast.error("Não foi possível salvar a alteração."),
  });
  const rascunho = useMutation({
    mutationFn: (r: Referencia) =>
      criarConteudo(
        {
          titulo: r.titulo,
          roteiro: [`Referência: ${r.link || "sem link"}`, `Tipo de vídeo: ${rotulo(CATEGORIAS_VIDEO, r.categoria)}`, r.notas].filter(Boolean).join("\n"),
          plataformas: ["instagram", "tiktok"],
          formato: "reels",
          status: "rascunho",
          data_gravacao: null,
          data_publicacao: null,
          responsavel: "",
          local: "",
          link: "",
          views: 0,
          curtidas: 0,
          areas: [],
          tipo_postagem: "comum",
        },
        eu,
      ),
    onSuccess: () => {
      playSfx("check");
      void qc.invalidateQueries({ queryKey: ["marketing-conteudos"] });
      toast.success("Virou rascunho. Está na aba Rascunhos.");
    },
    onError: () => toast.error("Não foi possível criar o rascunho."),
  });

  const q = busca.trim().toLowerCase();
  const lista = useMemo(
    () =>
      refs.filter(
        (r) =>
          (categoria === "todas" || r.categoria === categoria) &&
          (nicho === "todos" || r.nicho === nicho) &&
          (!q || [r.titulo, r.canal, r.notas, r.link].some((v) => v.toLowerCase().includes(q))),
      ),
    [refs, categoria, nicho, q],
  );

  const porCategoria = CATEGORIAS_VIDEO.map((c) => ({ ...c, n: refs.filter((r) => r.categoria === c.id).length }));
  const maisUsada = [...porCategoria].sort((a, b) => b.n - a.n)[0];
  const kpis = [
    { k: "Referências", v: refs.length },
    { k: "FiveM", v: refs.filter((r) => r.nicho === "fivem").length },
    { k: "Cidade RP", v: refs.filter((r) => r.nicho === "rp").length },
    { k: "Sem tipo definido", v: refs.filter((r) => r.categoria === "outro").length },
    { k: "Tipo mais salvo", v: maisUsada && maisUsada.n > 0 ? maisUsada.label : "—" },
  ];

  return (
    <div>
      <Kpis itens={kpis.map((c) => ({ k: c.k, v: typeof c.v === "string" ? <span className="text-base">{c.v}</span> : c.v }))} carregando={isLoading} />
      <div className="mt-5">
        <CampoRapido placeholder="Cole o link do vídeo ou escreva a ideia e aperte Enter" rotulo="Nova referência de vídeo" ocupado={criar.isPending} onEnviar={(t) => eu && criar.mutate(t)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por tipo de vídeo" className={cn(seletorLinha, "h-9 rounded-full px-3")}>
          <option value="todas">Todos os tipos ({refs.length})</option>
          {porCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.n})
            </option>
          ))}
        </select>
        <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Filtrar por nicho" className={cn(seletorLinha, "h-9 rounded-full px-3")}>
          <option value="todos">Todos os nichos</option>
          <Opcoes lista={NICHOS} />
        </select>
        <span className="ml-auto" />
        <Busca value={busca} onChange={setBusca} />
      </div>

      {isError ? (
        <p className="glass-inset mt-4 rounded-2xl px-4 py-12 text-center text-sm text-muted-foreground">Não foi possível carregar as referências.</p>
      ) : isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando referências…</div>
      ) : lista.length === 0 ? (
        <p className="glass-inset mt-4 rounded-2xl px-4 py-12 text-center text-sm text-muted-foreground">
          {refs.length === 0 ? "Nenhuma referência ainda. Cole o link de um vídeo acima para começar." : "Nenhuma referência com esses filtros."}
        </p>
      ) : (
        <ul className="glass mt-4 divide-y divide-white/[0.05] rounded-[20px]">
          {lista.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <button onClick={() => setEditando(r)} className="min-w-0 flex-1 basis-48 text-left">
                <span className="block truncate text-sm font-medium">{r.titulo}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {[rotulo(REDES, r.plataforma), rotulo(NICHOS, r.nicho), r.canal ? `@${r.canal}` : "", r.views > 0 ? `${numero(r.views)} views` : ""].filter(Boolean).join(" · ")}
                </span>
              </button>
              <select value={r.categoria} onChange={(e) => mudar.mutate({ id: r.id, patch: { categoria: e.target.value } })} aria-label={`Tipo de vídeo de ${r.titulo}`} className={seletorLinha}>
                <Opcoes lista={CATEGORIAS_VIDEO} />
              </select>
              <button
                onClick={() => eu && !rascunho.isPending && rascunho.mutate(r)}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <FilePenLine className="size-3.5" /> Virar rascunho
              </button>
              {ehLink(r.link) ? (
                <a href={r.link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir vídeo ${r.titulo}`} title="Abrir vídeo" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-foreground">
                  <ExternalLink className="size-4" />
                </a>
              ) : (
                <span className="size-8 shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}

      {editando && <ReferenciaDialog referencia={editando} onClose={() => setEditando(null)} onMudou={recarregar} />}
    </div>
  );
}

function ReferenciaDialog({ referencia, onClose, onMudou }: { referencia: Referencia; onClose: () => void; onMudou: () => void }) {
  const [f, setF] = useState<ReferenciaInput>(() => {
    const { id: _id, created_at: _c, ...resto } = referencia;
    return resto;
  });
  const set = <K extends keyof ReferenciaInput>(k: K, v: ReferenciaInput[K]) => setF((o) => ({ ...o, [k]: v }));
  const fim = () => {
    onMudou();
    onClose();
  };
  const salvar = useMutation({
    mutationFn: () => atualizarReferencia(referencia.id, { ...f, titulo: f.titulo.trim(), link: f.link.trim(), canal: f.canal.trim().replace(/^@/, "") }),
    onSuccess: fim,
    onError: () => toast.error("Não foi possível salvar a referência."),
  });
  const remover = useMutation({
    mutationFn: () => excluirReferencia(referencia.id),
    onSuccess: () => {
      playSfx("remove");
      fim();
    },
    onError: () => toast.error("Não foi possível excluir a referência."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
        <DialogTitle>Referência de vídeo</DialogTitle>
        <div className="space-y-3">
          <label className="block">
            <span className={rotuloCls}>Título</span>
            <input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} maxLength={120} className={campo} />
          </label>
          <label className="block">
            <span className={rotuloCls}>Link do vídeo</span>
            <input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" inputMode="url" className={campo} />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Seletor titulo="Tipo de vídeo" value={f.categoria} onChange={(v) => set("categoria", v)} lista={CATEGORIAS_VIDEO} />
            <Seletor titulo="Nicho" value={f.nicho} onChange={(v) => set("nicho", v)} lista={NICHOS} />
            <Seletor titulo="Rede" value={f.plataforma} onChange={(v) => set("plataforma", v)} lista={REDES} />
            <label className="block">
              <span className={rotuloCls}>Canal / perfil</span>
              <input value={f.canal} onChange={(e) => set("canal", e.target.value)} placeholder="@perfil" className={campo} />
            </label>
            <label className="block">
              <span className={rotuloCls}>Views</span>
              <input type="number" min={0} value={f.views} onChange={(e) => set("views", Math.max(0, Math.round(Number(e.target.value) || 0)))} className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={rotuloCls}>Por que funciona</span>
            <textarea value={f.notas} onChange={(e) => set("notas", e.target.value)} rows={3} placeholder="Gancho, formato, o que dá para adaptar para a HOST…" className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-white/25" />
          </label>
          <Rodape nome={f.titulo} salvando={salvar.isPending} podeSalvar={f.titulo.trim().length > 0} onSalvar={() => salvar.mutate()} onExcluir={() => remover.mutate()} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
