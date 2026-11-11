import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Search, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CaptacoesEstabelecimentos } from "@/components/captacoes-estabelecimentos";
import { fetchCategorias } from "@/lib/ilegal-data";
import { isSemLocal } from "@/lib/ilegal-status";
import { ROLE_ORDER, useCanEditIlegal, useMyRole } from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated/organizacoes")({
  validateSearch: (s: Record<string, unknown>): { aba?: "legais" | "faccoes" } => (s["aba"] === "faccoes" ? { aba: "faccoes" } : {}),
  head: () => ({
    meta: [
      { title: "Organizações livres — HOST" },
      { name: "description", content: "O que está livre ou ocupado na cidade, para a equipe ajudar a encontrar quem assuma." },
    ],
  }),
  component: OrganizacoesLivres,
});

/** Manager para cima pode editar as organizações legais (o banco confere de novo). */
const ehManagerPlus = (role: string | undefined) => !!role && ROLE_ORDER.indexOf(role as (typeof ROLE_ORDER)[number]) <= ROLE_ORDER.indexOf("manager");

/**
 * Organizações livres: página aberta a toda a equipe.
 * "Organizações legais" mostra a situação dos estabelecimentos (edição só Manager+);
 * "Facções" lista só as organizações ilegais livres para serem assumidas.
 */
function OrganizacoesLivres() {
  const { aba = "legais" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: role } = useMyRole();
  useRealtimeTable("captacoes_estabelecimentos", [["captacoes-estabelecimentos"]]);
  useRealtimeTable("captacoes_categorias", [["captacoes-estab-categorias"]]);
  useRealtimeTable("ilegal_orgs", [["organizacoes-faccoes"]]);

  const abas = [
    { id: "legais" as const, nome: "Organizações legais", icon: Building2 },
    { id: "faccoes" as const, nome: "Facções", icon: Swords },
  ];

  return (
    <div className="pagina">
      <PageHeader
        kicker="HOST · Equipe"
        title="Organizações livres"
        subtitle="Veja o que está livre ou ocupado e ajude a encontrar alguém para assumir."
        actions={
          <div className="flex gap-1 rounded-full border border-white/[0.08] bg-black/40 p-1" role="tablist">
            {abas.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => void navigate({ search: a.id === "legais" ? {} : { aba: a.id }, replace: true })}
                className={cn("flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors", aba === a.id ? "bg-white text-black" : "text-muted-foreground hover:text-foreground")}
              >
                <a.icon className="size-4" /> {a.nome}
              </button>
            ))}
          </div>
        }
      />
      <div className="mt-5">{aba === "legais" ? <CaptacoesEstabelecimentos podeEditar={ehManagerPlus(role)} /> : <Faccoes />}</div>
    </div>
  );
}

/** Facções: só as organizações ilegais livres (com local definido), agrupadas por tipo. */
function Faccoes() {
  const podeEditar = useCanEditIlegal();
  const [busca, setBusca] = useState("");
  const { data: categorias = [], isLoading } = useQuery({ queryKey: ["organizacoes-faccoes"], queryFn: fetchCategorias, staleTime: 30_000 });

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return categorias
      .map((c) => ({
        ...c,
        livres: c.orgs.filter((o) => o.status === "Livre" && !isSemLocal(o.local) && (!termo || [o.setagem, o.local, o.cds, o.grupo, o.observacao].join(" ").toLowerCase().includes(termo))),
      }))
      .filter((c) => c.livres.length > 0);
  }, [categorias, busca]);
  const total = grupos.reduce((s, c) => s + c.livres.length, 0);
  const totalGeral = categorias.reduce((s, c) => s + c.orgs.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-wrap items-center gap-6 rounded-2xl p-4">
        <div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" /> Facções livres
          </p>
          <p className="font-display text-2xl font-semibold">{isLoading ? "…" : total}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Organizações no total</p>
          <p className="font-display text-2xl font-semibold">{isLoading ? "…" : totalGeral}</p>
        </div>
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar setagem, local, CDS…" aria-label="Buscar facção livre" className="h-9 w-[240px] rounded-full border border-white/[0.09] bg-black/40 pl-8 pr-3 text-[13px] outline-none placeholder:text-ink-3 focus:border-white/30" />
        </label>
        {podeEditar && (
          <Link to="/ilegal" className="flex h-9 items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 text-xs font-medium transition-colors hover:bg-white/[0.06]">
            Gerenciar no Ilegal <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {grupos.map((c) => (
          <section key={c.id} className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide">{c.nome}</h3>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                {c.livres.length} livre{c.livres.length === 1 ? "" : "s"}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-2">Setagem</th>
                  <th className="py-1.5 pr-2">Local</th>
                  <th className="py-1.5 pr-2">CDS</th>
                  <th className="py-1.5 pr-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {c.livres.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 border-l-2 border-l-emerald-500 last:border-b-0">
                    <td className="py-2 pl-1.5 pr-2 font-semibold">{o.setagem || "—"}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{o.local || "—"}</td>
                    <td className="py-2 pr-2 font-mono text-[11px] text-muted-foreground">{o.cds || "—"}</td>
                    <td className="max-w-40 truncate py-2 pr-2 text-muted-foreground" title={o.observacao}>
                      {o.observacao || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      {!isLoading && grupos.length === 0 && <p className="glass rounded-2xl px-4 py-10 text-center text-sm text-muted-foreground">{busca ? "Nenhuma facção livre com essa busca." : "Nenhuma facção livre no momento."}</p>}
    </div>
  );
}
