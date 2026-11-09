import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Crown, ExternalLink, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { criarSolicitacaoArea, excluirPendencia, type PendenciaArea } from "@/lib/area-manager";
import { getCurrentUsername } from "@/lib/kanban";
import { isCoordinatorPlus, useMyAreas, useMyRole, type AreaKey } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { playSfx } from "@/lib/sfx";
import type { EquipeUser } from "@/lib/equipe-merge";
import {
  AREAS_COM_PAGINA,
  GRUPOS_AREA,
  isOnline,
  ordenarPendencias,
  saudeDaArea,
  useAreasDados,
} from "@/components/areas/use-areas-dados";

export const Route = createFileRoute("/_authenticated/areas/$area")({
  head: () => ({ meta: [{ title: "Área — HOST" }] }),
  component: AreaPage,
});

const PRIORIDADES = [
  { id: "alta", label: "Alta", dot: "bg-primary", on: "border-primary/50 bg-primary/15 text-red-200" },
  { id: "media", label: "Média", dot: "bg-amber-400", on: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  { id: "baixa", label: "Baixa", dot: "bg-white/40", on: "border-white/20 bg-white/[0.08] text-foreground" },
];
const prioridade = (id: string) => PRIORIDADES.find((p) => p.id === id) ?? PRIORIDADES[1]!;

type Aba = "abertas" | "standby" | "aprovadas" | "reprovadas";
const dias = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
const haQuanto = (iso: string) => {
  const d = dias(iso);
  return d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
};

function AreaPage() {
  const { area } = Route.useParams();
  const { visoes, carregando } = useAreasDados();
  const { data: role } = useMyRole();
  const { data: minhas = [] } = useMyAreas();
  const { data: eu = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });
  const [aba, setAba] = useState<Aba>("abertas");
  const v = visoes.find((x) => x.def.key === area);

  const coord = isCoordinatorPlus(role);
  const podeAdicionar = coord || minhas.includes(area);

  const listas = useMemo<Record<Aba, PendenciaArea[]>>(() => {
    const doStatus = (s: string) =>
      (v?.pendencias ?? [])
        .filter((p) => p.status === s)
        .sort((a, b) => (b.aprovadoAt ?? b.createdAt).localeCompare(a.aprovadoAt ?? a.createdAt));
    return {
      abertas: v?.abertas ?? [],
      standby: ordenarPendencias(v?.standby ?? []),
      aprovadas: doStatus("aprovada"),
      reprovadas: doStatus("reprovada"),
    };
  }, [v]);

  const voltar = (
    <Link to="/areas" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-3.5" /> Áreas
    </Link>
  );

  if (!AREAS_COM_PAGINA.has(area) || (!carregando && !v)) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 py-8 md:px-8">
        {voltar}
        <p className="glass-inset mt-6 rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
          Esta área não tem uma tela própria.
        </p>
      </div>
    );
  }
  if (!v) {
    return (
      <div className="mt-24 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando área…
      </div>
    );
  }

  const saude = saudeDaArea(v);
  const grupo = GRUPOS_AREA.find((g) => g.key === v.def.grupo)?.label;
  const maisAntiga = v.abertas.reduce<PendenciaArea | null>((m, p) => (!m || p.createdAt < m.createdAt ? p : m), null);
  const resumo = [
    v.abertas.length === 0
      ? "Nada em aberto no momento."
      : `${v.abertas.length} pendência${v.abertas.length === 1 ? "" : "s"} em aberto${v.altas ? `, ${v.altas} de prioridade alta` : ""}.`,
    maisAntiga && dias(maisAntiga.createdAt) > 0 ? `A mais antiga foi aberta ${haQuanto(maisAntiga.createdAt)}.` : null,
    v.standby.length ? `${v.standby.length} aguardando em stand-by.` : null,
    v.lideres.length === 0 ? "A área ainda não tem líder." : null,
  ].filter(Boolean) as string[];

  const abas: { id: Aba; label: string }[] = [
    { id: "abertas", label: "Em aberto" },
    { id: "standby", label: "Stand-by" },
    { id: "aprovadas", label: "Aprovadas" },
    { id: "reprovadas", label: "Reprovadas" },
  ];

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 md:px-8 md:py-8">
      {voltar}
      <header className="animate-rise mt-4 flex flex-wrap items-center gap-4">
        <span className="glass grid size-14 place-items-center rounded-2xl text-3xl">{v.def.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{grupo ?? "Área"}</p>
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{v.def.label}</h1>
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", saude.dot)} /> {saude.label}
        </span>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          {podeAdicionar ? (
            <NovaPendencia area={area} eu={eu} />
          ) : (
            <p className="glass-inset rounded-2xl px-4 py-3 text-xs text-muted-foreground">
              Só quem faz parte desta área pode adicionar pendências.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-1">
            {abas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  aba === a.id ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label} <span className="text-ink-3">{listas[a.id].length}</span>
              </button>
            ))}
            {coord && (
              <Link to="/area-manager" className="ml-auto flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Aprovar no Área Manager <ExternalLink className="size-3" />
              </Link>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {listas[aba].map((p) => (
              <PendenciaItem key={p.id} p={p} podeExcluir={coord || (p.criadoPor === eu && p.status === "pendente")} />
            ))}
            {listas[aba].length === 0 && (
              <li className="glass-inset rounded-2xl px-4 py-12 text-center text-sm text-ink-3">Nada por aqui.</li>
            )}
          </ul>
        </main>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section>
            <h2 className="mb-2 font-display text-sm font-semibold">Em resumo</h2>
            <ul className="space-y-1.5 text-[13px] leading-snug text-muted-foreground">
              {resumo.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-display text-sm font-semibold">Liderança</h2>
            <div className="space-y-1">
              {v.lideres.map((u) => (
                <Pessoa key={u.id} u={u} lider />
              ))}
              {v.lideres.length === 0 && <p className="text-xs text-ink-3">Sem líder definido.</p>}
            </div>
          </section>
          <section>
            <h2 className="mb-2 font-display text-sm font-semibold">
              Equipe <span className="font-normal text-ink-3">{v.membros.length}</span>
            </h2>
            <div className="space-y-1">
              {v.membros
                .filter((m) => !v.lideres.includes(m))
                .map((u) => (
                  <Pessoa key={u.id} u={u} />
                ))}
              {v.membros.length === 0 && <p className="text-xs text-ink-3">Ninguém nesta área ainda.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Pessoa({ u, lider }: { u: EquipeUser; lider?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl py-1">
      <span className="relative shrink-0">
        <img src={u.avatar_url || DEFAULT_AVATAR_URL} alt="" className="size-8 rounded-lg border border-white/10 object-cover" />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-black", isOnline(u) ? "bg-emerald-500" : "bg-white/25")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-[13px] font-medium">
          {lider && <Crown className="size-3 text-primary" />}
          {u.username}
        </span>
        <span className="block truncate text-[11px] text-ink-3">{ROLE_LABELS[u.role]}</span>
      </span>
    </div>
  );
}

function NovaPendencia({ area, eu }: { area: string; eu: string }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prio, setPrio] = useState("media");
  const [foco, setFoco] = useState(false);
  const aberto = foco || titulo.length > 0;

  const criar = useMutation({
    mutationFn: () =>
      criarSolicitacaoArea({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade: prio,
        area: area as AreaKey,
        tipo: "solicitacao",
        criadoPor: eu,
      }),
    onSuccess: () => {
      playSfx("add");
      setTitulo("");
      setDescricao("");
      setPrio("media");
      void qc.invalidateQueries({ queryKey: ["pendencias-area"] });
    },
    onError: () => toast.error("Não foi possível adicionar a pendência."),
  });
  const enviar = () => {
    if (titulo.trim() && eu && !criar.isPending) criar.mutate();
  };

  return (
    <div
      className="glass rounded-[20px] p-2"
      onFocus={() => setFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFoco(false);
      }}
    >
      <div className="flex items-center gap-2">
        <Plus className="ml-2.5 size-4 shrink-0 text-ink-3" />
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          maxLength={160}
          placeholder="O que precisa ser feito nesta área?"
          aria-label="Título da nova pendência"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
        {criar.isPending && <Loader2 className="mr-2 size-4 animate-spin text-muted-foreground" />}
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="space-y-2 px-2 pb-1 pt-1">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Detalhes (opcional)"
              aria-label="Detalhes da pendência"
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-white/20"
            />
            <div className="flex items-center gap-1.5">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrio(p.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    prio === p.id ? p.on : "border-white/[0.08] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={enviar}
                disabled={!titulo.trim() || criar.isPending}
                className="ml-auto rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendenciaItem({ p, podeExcluir }: { p: PendenciaArea; podeExcluir: boolean }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const pr = prioridade(p.prioridade);
  const temObs = !!p.obsCoordenacao && !p.obsResolvida;
  const excluir = useMutation({
    mutationFn: () => excluirPendencia(p.id),
    onSuccess: () => {
      playSfx("remove");
      void qc.invalidateQueries({ queryKey: ["pendencias-area"] });
    },
    onError: () => toast.error("Não foi possível excluir a pendência."),
  });

  return (
    <li className="glass animate-rise rounded-2xl">
      <button onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={cn("size-2 shrink-0 rounded-full", pr.dot)} title={`Prioridade ${pr.label.toLowerCase()}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.titulo}</span>
          <span className="block truncate text-[11px] text-ink-3">
            {p.criadoPor || "—"} · {haQuanto(p.createdAt)}
          </span>
        </span>
        {temObs && <MessageSquare className="size-3.5 shrink-0 text-amber-300" aria-label="Coordenação pediu informações" />}
        <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200", aberto && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-white/[0.05] px-4 py-3 text-sm text-muted-foreground">
            {p.descricao ? (
              <RichText value={p.descricao} className="break-words [overflow-wrap:anywhere]" />
            ) : (
              <p className="text-xs text-ink-3">Sem detalhes.</p>
            )}
            {temObs && (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
                <b>{p.obsPor || "Coordenação"}:</b> {p.obsCoordenacao}
              </p>
            )}
            {podeExcluir && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir “${p.titulo}”?`)) excluir.mutate();
                  }}
                  disabled={excluir.isPending}
                  className="flex items-center gap-1.5 text-xs text-ink-3 transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
