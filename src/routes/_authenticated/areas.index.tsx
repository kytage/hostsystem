import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, Crown, LayoutGrid, Loader2, Network } from "lucide-react";
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

function Rostos({ a }: { a: AreaVisao }) {
  const lista = [...a.lideres, ...a.membros.filter((m) => !a.lideres.includes(m))].slice(0, 4);
  return (
    <span className="flex items-center">
      {lista.map((u, i) => (
        <img
          key={u.id}
          src={u.avatar_url || DEFAULT_AVATAR_URL}
          alt={u.username}
          title={u.username}
          className={cn("size-6 rounded-full border-2 border-[#0c0c0c] object-cover", i > 0 && "-ml-1.5")}
        />
      ))}
      {a.membros.length > 4 && <span className="ml-1.5 text-[11px] text-ink-3">+{a.membros.length - 4}</span>}
    </span>
  );
}

function AreaCard({ a, index }: { a: AreaVisao; index: number }) {
  const saude = saudeDaArea(a);
  return (
    <Link
      to="/areas/$area"
      params={{ area: a.def.key }}
      className="glass surface-hover animate-rise group flex flex-col rounded-[20px] p-4 hover:-translate-y-0.5"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xl leading-none">{a.def.emoji}</span>
        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">{a.def.label}</span>
        <ArrowUpRight className="size-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-semibold leading-none tabular-nums">{a.abertas.length}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            em aberto
            {a.altas > 0 && <span className="text-primary"> · {a.altas} alta{a.altas === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <Rostos a={a} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
          <Crown className="size-3 shrink-0 text-ink-3" />
          <span className="truncate">{a.lideres.map((l) => l.username).join(", ") || "Sem líder"}</span>
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

  const kpis = [
    { k: "Áreas", v: visoes.length },
    { k: "Pessoas nas áreas", v: new Set(visoes.flatMap((v) => v.membros.map((m) => m.id))).size },
    { k: "Em aberto", v: visoes.reduce((s, v) => s + v.abertas.length, 0) },
    { k: "Em stand-by", v: visoes.reduce((s, v) => s + v.standby.length, 0) },
    { k: "Sem líder", v: visoes.filter((v) => v.lideres.length === 0).length },
  ];

  const seg = (on: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
      on ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader kicker="GERAL DA CIDADE" title="Áreas" subtitle="Quem cuida de cada área e o que precisa ser feito." />

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((c) => (
          <div key={c.k} className="border-l border-white/[0.08] pl-4">
            <p className="font-display text-2xl font-semibold tabular-nums">{carregando ? "—" : c.v}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.k}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-2">
        <div className="glass-inset inline-flex gap-1 rounded-full p-1">
          <button className={seg(escopo === "todas")} onClick={() => setEscopo("todas")}>Todas</button>
          <button className={seg(escopo === "minhas")} onClick={() => setEscopo("minhas")}>Minhas áreas</button>
        </div>
        <div className="glass-inset inline-flex gap-1 rounded-full p-1">
          <button className={seg(visao === "cards")} onClick={() => setVisao("cards")}>
            <LayoutGrid className="size-3.5" /> Visão geral
          </button>
          <button className={seg(visao === "org")} onClick={() => setVisao("org")}>
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
                  <div className="mb-3 flex items-baseline gap-2.5">
                    <h2 className="font-display text-sm font-semibold">{g.label}</h2>
                    <span className="text-[11px] text-ink-3">{g.descricao}</span>
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
                <h2 className="mb-3 font-display text-sm font-semibold">Demais áreas</h2>
                <ul className="glass divide-y divide-white/[0.05] rounded-[20px]">
                  {demais.map((a) => (
                    <li key={a.def.key} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-base leading-none">{a.def.emoji}</span>
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
            <h2 className="mb-3 font-display text-sm font-semibold">Fila da cidade</h2>
            <div className="glass rounded-[20px] p-2">
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
