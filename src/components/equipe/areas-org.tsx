import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Crown,
  LayoutGrid,
  Scale,
  PartyPopper,
  Swords,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { Indice, Indices } from "@/components/indice";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_LABELS } from "@/lib/roles";
import { fetchPendenciasArea, type PendenciaArea, type StatusPendencia } from "@/lib/area-manager";
import { useRealtimeTable } from "@/lib/realtime";
import type { EquipeUser } from "@/lib/equipe-merge";
import { OrgCanvas } from "./org-canvas";
import { LiderGeralBloco, useLideresGerais, usePodeEditarLideresGerais } from "./lideres-gerais";

export interface AreaComGrupo {
  key: string;
  label: string;
  emoji: string;
  ordem?: number;
  grupo?: string | null;
}

interface GrupoDef {
  key: string;
  label: string;
  icon: LucideIcon;
  descricao: string;
}

const GRUPOS: GrupoDef[] = [
  { key: "legal", label: "LEGAL", icon: Scale, descricao: "Empresas e serviços da cidade" },
  { key: "confronto", label: "BASE PADRÃO", icon: Swords, descricao: "Ilegal × Polícia — lados rivais" },
  { key: "entretenimento", label: "ENTRETENIMENTO", icon: PartyPopper, descricao: "Eventos e competições" },
  { key: "operacao", label: "OPERAÇÃO", icon: LayoutGrid, descricao: "Staff, suporte e bastidores" },
];
const GRUPO_KEYS = new Set(GRUPOS.map((g) => g.key));

const DEFICIT_LIMITE = 2;
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

interface AreaResumo {
  def: AreaComGrupo;
  grupo: string;
  lideres: EquipeUser[];
  membros: EquipeUser[];
  pend: PendenciaArea[];
  abertas: number;
  standby: number;
  resolvidas30: number;
  ultimaAtividade: string | null;
}

type Saude = { label: string; tone: "ok" | "warn" | "danger" };

function saudeDa(a: AreaResumo): Saude {
  if (a.membros.length === 0) return { label: "Sem equipe", tone: "danger" };
  if (a.lideres.length === 0) return { label: "Sem líder", tone: "warn" };
  if (a.abertas > Math.max(3, a.membros.length * 3)) return { label: "Sobrecarregada", tone: "warn" };
  if (a.membros.length <= DEFICIT_LIMITE) return { label: "Equipe enxuta", tone: "warn" };
  return { label: "Fluindo", tone: "ok" };
}

const toneClass: Record<Saude["tone"], string> = {
  ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  warn: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-primary/35 bg-primary/10 text-primary",
};

function Avatars({ people, max = 5 }: { people: EquipeUser[]; max?: number }) {
  if (people.length === 0) return <span className="text-[11px] text-ink-3">—</span>;
  return (
    <div className="flex items-center">
      {people.slice(0, max).map((p, i) => (
        <img
          key={p.id}
          src={p.avatar_url || DEFAULT_AVATAR_URL}
          alt={p.username}
          title={`${p.username} · ${ROLE_LABELS[p.role]}`}
          draggable={false}
          className={cn("size-7 rounded-full border-2 border-black bg-black/40 object-cover", i > 0 && "-ml-2")}
        />
      ))}
      {people.length > max && (
        <span className="-ml-2 grid size-7 place-items-center rounded-full border-2 border-black bg-white/10 text-[10px] font-medium">
          +{people.length - max}
        </span>
      )}
    </div>
  );
}

function AreaNode({ a, onOpen }: { a: AreaResumo; onOpen: () => void }) {
  const saude = saudeDa(a);
  const auxiliares = a.membros.filter((m) => !a.lideres.includes(m));
  return (
    <div className="glass hc flex w-[250px] flex-col gap-3 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2.5 text-left">
          <span className="hc-icone text-[17px] leading-none">{a.def.emoji}</span>
          <span className="min-w-0">
            <span className="hc-titulo block truncate">{a.def.label}</span>
            <span className="block text-[11px] text-muted-foreground">
              {a.membros.length} membro{a.membros.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpen}
          title="Ver pendências da área"
          className="hc-seta relative"
        >
          <ClipboardList className="size-3.5" />
          {a.abertas > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-white">
              {a.abertas}
            </span>
          )}
        </button>
      </div>

      <div className="hc-dentro px-2.5 py-2">
        <p className="hc-sobre mb-1.5 flex items-center gap-1">
          <Crown className="size-3 text-amber-300" /> Líder
        </p>
        {a.lideres.length === 0 ? (
          <p className="text-xs text-ink-3">Sem líder definido</p>
        ) : (
          <div className="flex flex-col gap-1">
            {a.lideres.map((l) => (
              <span key={l.id} className="flex items-center gap-2 text-[12.5px] font-medium">
                <img src={l.avatar_url || DEFAULT_AVATAR_URL} alt="" draggable={false} className="size-5 rounded-full object-cover" />
                {l.username}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Avatars people={auxiliares} />
        <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px]", toneClass[saude.tone])}>{saude.label}</span>
      </div>
    </div>
  );
}

export function AreasOrg({
  membros,
  areas,
  onSelectArea,
}: {
  membros: EquipeUser[];
  areas: AreaComGrupo[];
  onSelectArea: (areaKey: string) => void;
}) {
  useRealtimeTable("pendencias", [["pendencias-area"]]);
  const { data: pendencias = [] } = useQuery({
    queryKey: ["pendencias-area"],
    queryFn: fetchPendenciasArea,
    staleTime: 20_000,
  });
  const [aberta, setAberta] = useState<string | null>(null);
  const { data: lideresGerais = {} } = useLideresGerais();
  const podeEditarLideres = usePodeEditarLideresGerais();

  const resumo: AreaResumo[] = useMemo(() => {
    const agora = Date.now();
    return areas.map((def) => {
      const doArea = membros.filter((m) => m.areas.includes(def.key));
      const lideres = doArea.filter((m) => (m.areaNiveis ?? {})[def.key] === "lider");
      const pend = pendencias.filter((p) => p.area === def.key);
      const datas = pend.map((p) => p.aprovadoAt ?? p.createdAt).sort();
      return {
        def,
        grupo: def.grupo && GRUPO_KEYS.has(def.grupo) ? def.grupo : "operacao",
        lideres,
        membros: doArea,
        pend,
        abertas: pend.filter((p) => p.status === "pendente").length,
        standby: pend.filter((p) => p.status === "standby").length,
        resolvidas30: pend.filter(
          (p) => (p.status === "aprovada" || p.status === "reprovada") && p.aprovadoAt && agora - new Date(p.aprovadoAt).getTime() < TRINTA_DIAS,
        ).length,
        ultimaAtividade: datas.length ? datas[datas.length - 1]! : null,
      };
    });
  }, [areas, membros, pendencias]);

  const kpis = [
    { label: "Áreas", value: resumo.length, icon: LayoutGrid },
    { label: "Membros alocados", value: new Set(resumo.flatMap((a) => a.membros.map((m) => m.id))).size, icon: Users },
    { label: "Sem líder", value: resumo.filter((a) => a.lideres.length === 0).length, icon: Crown, warn: true },
    { label: "Pendências abertas", value: resumo.reduce((s, a) => s + a.abertas, 0), icon: ClipboardList, warn: true },
    { label: "Resolvidas · 30 dias", value: resumo.reduce((s, a) => s + a.resolvidas30, 0), icon: CheckCircle2 },
  ];

  const areaAberta = resumo.find((a) => a.def.key === aberta) ?? null;

  return (
    <div className="space-y-3.5">
      {/* números das áreas, no padrão da tela inicial (ponto vermelho = pede atenção) */}
      <Indices>
        {kpis.map((k) => (
          <Indice
            key={k.label}
            valor={k.value}
            titulo={k.label}
            icone={k.icon}
            alerta={k.warn && k.value > 0}
          />
        ))}
      </Indices>

      {/* Organograma das áreas */}
      <OrgCanvas height="min(78vh, 860px)">
        <div className="flex min-w-max flex-col items-center px-10 pb-16">
          <div className="glass hc flex items-center gap-3 px-5 py-3.5">
            <Logo className="h-6" />
            <div>
              <p className="hc-titulo">Áreas HOST</p>
              <p className="hc-nota mt-0.5">{resumo.length} áreas em {GRUPOS.length} grupos</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/15" />

          <div className="flex items-start justify-center">
            {GRUPOS.map((g, gi) => {
              const lista = resumo.filter((a) => a.grupo === g.key);
              const abertas = lista.reduce((s, a) => s + a.abertas, 0);
              const pessoas = new Set(lista.flatMap((a) => a.membros.map((m) => m.id))).size;
              return (
                <div
                  key={g.key}
                  className={cn(
                    "relative flex flex-col items-center px-6 pt-6",
                    "before:absolute before:left-0 before:right-1/2 before:top-0 before:border-t before:border-white/15 after:absolute after:left-1/2 after:right-0 after:top-0 after:border-t after:border-white/15",
                    gi === 0 && "before:hidden",
                    gi === GRUPOS.length - 1 && "after:hidden",
                  )}
                >
                  <span className="absolute left-1/2 top-0 h-6 w-px bg-white/15" />
                  <LiderGeralBloco
                    grupo={g.key}
                    rotulo={g.label}
                    ids={lideresGerais[g.key] ?? []}
                    membros={membros}
                    podeEditar={podeEditarLideres}
                  />
                  <div className="h-4 w-px bg-white/15" />
                  <div
                    className={cn(
                      "glass hc flex w-[300px] items-center gap-3 px-4 py-3",
                      g.key === "legal" && "!border-white/15",
                    )}
                  >
                    <span
                      className={cn(
                        "hc-icone !size-11",
                        g.key === "legal" ? "!text-foreground" : "!text-muted-foreground",
                      )}
                    >
                      <g.icon className="size-5" strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-semibold tracking-[0.18em]">{g.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{g.descricao}</p>
                    </div>
                    <div className="text-right text-[11px] leading-tight text-muted-foreground">
                      <p>
                        <span className="font-semibold text-foreground">{lista.length}</span> áreas
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">{pessoas}</span> pessoas
                      </p>
                      {abertas > 0 && <p className="text-primary">{abertas} abertas</p>}
                    </div>
                  </div>
                  {lista.length > 0 && <div className="h-5 w-px bg-white/15" />}
                  {g.key === "confronto" && lista.length === 2 ? (
                    <div className="flex items-center gap-2">
                      <AreaNode a={lista[0]!} onOpen={() => setAberta(lista[0]!.def.key)} />
                      <span className="hc-seta !size-9 font-display text-[11px] font-semibold tracking-wider">
                        VS
                      </span>
                      <AreaNode a={lista[1]!} onOpen={() => setAberta(lista[1]!.def.key)} />
                    </div>
                  ) : (
                    <div className={cn("grid gap-3", lista.length > 4 ? "grid-cols-2" : "grid-cols-1")}>
                      {lista.map((a) => (
                        <AreaNode key={a.def.key} a={a} onOpen={() => setAberta(a.def.key)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </OrgCanvas>

      {/* Painel de administração */}
      <section className="glass hc">
        <header className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5">
          <div>
            <p className="hc-sobre">Administração</p>
            <h3 className="hc-titulo mt-1.5">Como cada área está fluindo</h3>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <Activity className="size-3.5" /> Pendências vindas da Área Manager, em tempo real
          </p>
        </header>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                <th className="px-5 py-2.5 font-semibold">Área</th>
                <th className="px-3 py-2.5 font-semibold">Líder</th>
                <th className="px-3 py-2.5 font-semibold">Equipe</th>
                <th className="px-3 py-2.5 text-right font-semibold">Abertas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Stand-by</th>
                <th className="px-3 py-2.5 text-right font-semibold">Resolvidas 30d</th>
                <th className="px-3 py-2.5 font-semibold">Última atividade</th>
                <th className="px-5 py-2.5 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map((g) => {
                const lista = resumo.filter((a) => a.grupo === g.key);
                if (lista.length === 0) return null;
                return (
                  <Fragment key={g.key}>
                    <tr>
                      <td colSpan={8} className="hc-sobre px-5 pb-1.5 pt-4">
                        <span className="inline-flex items-center gap-1.5">
                          <g.icon className="size-3.5" /> {g.label}
                        </span>
                      </td>
                    </tr>
                    {lista.map((a) => {
                      const s = saudeDa(a);
                      return (
                        <tr
                          key={a.def.key}
                          onClick={() => setAberta(a.def.key)}
                          className="cursor-pointer border-t border-white/[0.06] transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-2.5">
                            <span className="flex items-center gap-2 font-medium">
                              <span>{a.def.emoji}</span> {a.def.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{a.lideres.map((l) => l.username).join(", ") || "—"}</td>
                          <td className="px-3 py-2.5">
                            <Avatars people={a.membros} max={4} />
                          </td>
                          <td className={cn("px-3 py-2.5 text-right tabular-nums", a.abertas > 0 && "text-foreground font-semibold")}>{a.abertas}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{a.standby}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{a.resolvidas30}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {a.ultimaAtividade ? new Date(a.ultimaAtividade).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-5 py-2.5">
                            <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", toneClass[s.tone])}>{s.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="h-3" />
      </section>

      {areaAberta && (
        <AreaDrawer area={areaAberta} onClose={() => setAberta(null)} onVerEquipe={() => onSelectArea(areaAberta.def.key)} />
      )}
    </div>
  );
}

const STATUS_TABS: { key: StatusPendencia; label: string }[] = [
  { key: "pendente", label: "Abertas" },
  { key: "standby", label: "Stand-by" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "reprovada", label: "Reprovadas" },
];

function AreaDrawer({ area, onClose, onVerEquipe }: { area: AreaResumo; onClose: () => void; onVerEquipe: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<StatusPendencia>("pendente");
  const lista = area.pend.filter((p) => p.status === tab);
  const saude = saudeDa(area);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="glass-modal animate-rise fixed bottom-4 right-4 top-4 z-50 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-[22px]">
        <div className="flex items-start justify-between p-5 pb-0">
          <div className="flex items-center gap-3">
            <span className="hc-icone !size-11 text-xl leading-none">{area.def.emoji}</span>
            <div>
              <p className="hc-sobre">{GRUPOS.find((g) => g.key === area.grupo)?.label ?? area.grupo}</p>
              <p className="mt-0.5 font-display text-lg font-semibold">{area.def.label}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="hc-seta">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {[
            { l: "Equipe", v: area.membros.length },
            { l: "Abertas", v: area.abertas },
            { l: "Resolv. 30d", v: area.resolvidas30 },
          ].map((k) => (
            <div key={k.l} className="hc-dentro p-3">
              <p className="hc-sobre">{k.l}</p>
              <p className="mt-1.5 font-display text-xl font-semibold tabular-nums">{k.v}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 pt-3">
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", toneClass[saude.tone])}>
            {saude.tone !== "ok" && <AlertTriangle className="mr-1 inline size-3" />}
            {saude.label}
          </span>
          <button onClick={onVerEquipe} className="hc-pilula">
            Ver membros na Equipe <ArrowUpRight className="size-3" />
          </button>
        </div>

        <div className="mt-4 px-5">
          <p className="hc-sobre">Pessoas</p>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {area.membros.length === 0 && <p className="hc-dentro px-3 py-3 text-xs text-ink-3">Ninguém nesta área ainda.</p>}
            {[...area.lideres, ...area.membros.filter((m) => !area.lideres.includes(m))].map((m) => {
              const lider = area.lideres.includes(m);
              return (
                <div key={m.id} className="hc-dentro flex items-center gap-2.5 px-3 py-2">
                  <img src={m.avatar_url || DEFAULT_AVATAR_URL} alt="" className="size-7 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{m.username}</p>
                    <p className="text-[11px] text-ink-3">{ROLE_LABELS[m.role]}</p>
                  </div>
                  <span className={cn("flex items-center gap-1 text-[11px]", lider ? "text-amber-300" : "text-ink-3")}>
                    {lider && <Crown className="size-3" />}
                    {lider ? "Líder" : "Auxiliar"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col px-5">
          <div className="flex items-center justify-between">
            <p className="hc-sobre">Pendências</p>
            <button onClick={() => navigate({ to: "/area-manager" })} className="hc-pilula">
              Área Manager <ArrowUpRight className="size-3" />
            </button>
          </div>
          <div
            className="segmentos mt-2 w-full"
            role="tablist"
            aria-label="Situação das pendências"
          >
            {STATUS_TABS.map((t) => {
              const n = area.pend.filter((p) => p.status === t.key).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 justify-center !px-2 !text-[11px]"
                >
                  {t.label} <span className="tabular-nums opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-5">
            {lista.length === 0 ? (
              <p className="hc-dentro px-3 py-6 text-center text-xs text-ink-3">Nada aqui.</p>
            ) : (
              lista.map((p) => (
                <div key={p.id} className="hc-dentro p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium">{p.titulo}</p>
                    {p.prioridade && <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-px text-[10px] capitalize text-muted-foreground">{p.prioridade}</span>}
                  </div>
                  {p.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.descricao}</p>}
                  <p className="mt-1.5 text-[11px] text-ink-3">
                    {p.criadoPor || "—"} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    {p.aprovadoPor ? ` · por ${p.aprovadoPor}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
