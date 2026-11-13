import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CircleDot,
  Crown,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  Network,
  PauseCircle,
  UserX,
  Users,
} from "lucide-react";
import { Indice, Indices } from "@/components/indice";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { AreasOrg } from "@/components/equipe/areas-org";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { useMyAreas } from "@/lib/permissions";
import { areaLabel } from "@/lib/area-manager";
import {
  AREAS_COM_PAGINA,
  GRUPOS_AREA,
  ordenarPendencias,
  saudeDaArea,
  useAreasDados,
  type AreaVisao,
} from "@/components/areas/use-areas-dados";

export const Route = createFileRoute("/_authenticated/areas/")({
  head: () => ({
    meta: [
      { title: "Áreas — HOST" },
      { name: "description", content: "Visão geral da cidade: áreas, líderes e pendências." },
    ],
  }),
  component: AreasPage,
});

const PRIO_DOT: Record<string, string> = { alta: "bg-primary", media: "bg-amber-400", baixa: "bg-white/40" };

/** Foto pequena + nome, para líderes e auxiliares no card da área. */
function Nome({ u, lider }: { u: { id: string; username: string; avatar_url: string }; lider?: boolean }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5",
        lider ? "border border-amber-300/20 bg-amber-300/[0.06]" : "border border-white/[0.07] bg-white/[0.03]",
      )}
    >
      <img
        src={u.avatar_url || DEFAULT_AVATAR_URL}
        alt=""
        className={cn("size-[18px] shrink-0 rounded-full object-cover", lider && "ring-1 ring-amber-300/50")}
      />
      <span className={cn("truncate text-[11.5px]", lider ? "font-medium text-foreground" : "text-muted-foreground")}>
        {u.username}
      </span>
    </span>
  );
}

function AreaCard({ a, index }: { a: AreaVisao; index: number }) {
  const saude = saudeDaArea(a);
  const auxiliares = a.membros.filter((m) => !a.lideres.includes(m));
  const MAX_AUX = 6;
  return (
    <Link
      to="/areas/$area"
      params={{ area: a.def.key }}
      className="glass hc animate-rise group flex flex-col p-5"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="hc-icone text-[17px] leading-none">{a.def.emoji}</span>
        <span className="hc-titulo min-w-0 flex-1 truncate">{a.def.label}</span>
        <span className="hc-seta" aria-hidden>
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
            <Crown className="size-3 text-amber-300" fill="currentColor" fillOpacity={0.25} />
            Líder{a.lideres.length > 1 ? "es" : ""}
          </p>
          {a.lideres.length === 0 ? (
            <p className="text-[11.5px] text-ink-3">Sem líder definido</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {a.lideres.map((l) => (
                <Nome key={l.id} u={l} lider />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Auxiliares <span className="font-normal tracking-normal">{auxiliares.length}</span>
          </p>
          {auxiliares.length === 0 ? (
            <p className="text-[11.5px] text-ink-3">Ninguém ainda</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {auxiliares.slice(0, MAX_AUX).map((u) => (
                <Nome key={u.id} u={u} />
              ))}
              {auxiliares.length > MAX_AUX && (
                <span className="self-center text-[11px] text-ink-3">+{auxiliares.length - MAX_AUX}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{a.abertas.length}</span>
          em aberto
          {a.altas > 0 && (
            <span className="text-primary">
              · {a.altas} alta{a.altas === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-ink-3">
          <span className={cn("size-1.5 rounded-full", saude.dot)} /> {saude.label}
        </span>
      </div>
    </Link>
  );
}

function AreasPage() {
  const { visoes, equipe, carregando, erro } = useAreasDados();
  const { data: minhas = [] } = useMyAreas();
  const navigate = useNavigate();
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [visao, setVisao] = useState<"cards" | "org">("cards");

  const filtradas = useMemo(
    () => (escopo === "minhas" ? visoes.filter((v) => minhas.includes(v.def.key)) : visoes),
    [visoes, escopo, minhas],
  );
  const principais = filtradas.filter((v) => AREAS_COM_PAGINA.has(v.def.key));
  const demais = filtradas.filter((v) => !AREAS_COM_PAGINA.has(v.def.key));
  const fila = useMemo(() => ordenarPendencias(visoes.flatMap((v) => v.abertas)).slice(0, 8), [visoes]);

  const semLider = visoes.filter((v) => v.lideres.length === 0).length;
  const kpis = [
    { k: "Áreas", v: visoes.length, icone: MapIcon, nota: "na cidade" },
    {
      k: "Pessoas nas áreas",
      v: new Set(visoes.flatMap((v) => v.membros.map((m) => m.id))).size,
      icone: Users,
      nota: "em pelo menos uma área",
    },
    { k: "Em aberto", v: visoes.reduce((s, v) => s + v.abertas.length, 0), icone: CircleDot, nota: "pendências das áreas" },
    { k: "Em stand-by", v: visoes.reduce((s, v) => s + v.standby.length, 0), icone: PauseCircle, nota: "pausadas por enquanto" },
    { k: "Sem líder", v: semLider, icone: UserX, nota: "precisam de alguém", alerta: semLider > 0 },
  ];

  return (
    <div className="pagina">
      <PageHeader kicker="GERAL DA CIDADE" title="Áreas" subtitle="Quem cuida de cada área e o que precisa ser feito." />

      <Indices className="mt-5">
        {kpis.map((c) => (
          <Indice
            key={c.k}
            valor={carregando ? "—" : c.v}
            titulo={c.k}
            nota={c.nota}
            icone={c.icone}
            alerta={!carregando && c.alerta}
          />
        ))}
      </Indices>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="segmentos" role="group" aria-label="Quais áreas mostrar">
          <button type="button" aria-pressed={escopo === "todas"} onClick={() => setEscopo("todas")}>
            Todas
          </button>
          <button type="button" aria-pressed={escopo === "minhas"} onClick={() => setEscopo("minhas")}>
            Minhas áreas
          </button>
        </div>
        <div className="segmentos" role="group" aria-label="Como mostrar">
          <button type="button" aria-pressed={visao === "cards"} onClick={() => setVisao("cards")}>
            <LayoutGrid className="size-3.5" /> Visão geral
          </button>
          <button type="button" aria-pressed={visao === "org"} onClick={() => setVisao("org")}>
            <Network className="size-3.5" /> Organograma
          </button>
        </div>
      </div>

      {erro ? (
        <p className="glass-inset mt-5 rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
          Não foi possível carregar as áreas. Tente novamente.
        </p>
      ) : carregando ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando áreas…
        </div>
      ) : visao === "org" ? (
        <div className="mt-5">
          <AreasOrg
            membros={equipe}
            areas={visoes.map((v) => v.def)}
            onSelectArea={(key) => {
              if (AREAS_COM_PAGINA.has(key)) void navigate({ to: "/areas/$area", params: { area: key } });
            }}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {filtradas.length === 0 && (
              <p className="glass-inset rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
                Você ainda não faz parte de nenhuma área.
              </p>
            )}
            {GRUPOS_AREA.map((g) => {
              const cards = principais.filter((v) => (v.def.grupo ?? "operacao") === g.key);
              if (cards.length === 0) return null;
              return (
                <section key={g.key}>
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1">
                    <h2 className="hc-titulo">{g.label}</h2>
                    <span className="hc-nota">{g.descricao}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {cards.map((a, i) => (
                      <AreaCard key={a.def.key} a={a} index={i} />
                    ))}
                  </div>
                </section>
              );
            })}
            {demais.length > 0 && (
              <section>
                <h2 className="hc-titulo mb-3 px-1">Demais áreas</h2>
                <ul className="glass hc divide-y divide-white/[0.05]">
                  {demais.map((a) => (
                    <li key={a.def.key} className="flex items-center gap-3 px-4 py-3">
                      <span className="hc-icone !size-8 text-[15px] leading-none">{a.def.emoji}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.def.label}</span>
                      <span className="hidden truncate text-[11px] text-ink-3 sm:block">
                        {a.lideres.map((l) => l.username).join(", ") || "Sem líder"}
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {a.abertas.length} em aberto
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <h2 className="hc-titulo mb-3 px-1">Fila da cidade</h2>
            <div className="glass hc p-2">
              {fila.length === 0 ? (
                <p className="px-3 py-10 text-center text-xs text-ink-3">Nenhuma pendência em aberto.</p>
              ) : (
                <ul>
                  {fila.map((p) => {
                    const corpo = (
                      <>
                        <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", PRIO_DOT[p.prioridade] ?? PRIO_DOT["media"])} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px]">{p.titulo}</span>
                          <span className="block truncate text-[11px] text-ink-3">
                            {areaLabel(p.area)} · {p.criadoPor || "—"}
                          </span>
                        </span>
                      </>
                    );
                    const cls = "flex items-start gap-2.5 rounded-xl px-3 py-2";
                    return (
                      <li key={p.id}>
                        {AREAS_COM_PAGINA.has(p.area) ? (
                          <Link to="/areas/$area" params={{ area: p.area }} className={cn(cls, "transition-colors hover:bg-white/[0.04]")}>
                            {corpo}
                          </Link>
                        ) : (
                          <div className={cls}>{corpo}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
