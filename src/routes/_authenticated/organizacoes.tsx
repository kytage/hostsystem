import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, CircleDashed, Search, Skull, Swords } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Indice, Indices } from "@/components/indice";
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
          <div className="segmentos" role="tablist" aria-label="Tipo de organização">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => void navigate({ search: a.id === "legais" ? {} : { aba: a.id }, replace: true })}
              >
                <a.icon className="size-3.5" /> {a.nome}
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
    <div className="flex flex-col gap-3.5">
      {/* busca e atalho para o Ilegal; embaixo, os números no padrão da tela inicial */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="campo-busca w-[240px]">
          <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar setagem, local, CDS…" aria-label="Buscar facção livre" />
        </label>
        {podeEditar && (
          <Link to="/ilegal" className="pilula rounded-full">
            Gerenciar no Ilegal <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
      <Indices>
        <Indice valor={isLoading ? "…" : total} titulo="Facções livres" cor="#10b981" icone={CircleDashed} />
        <Indice valor={isLoading ? "…" : totalGeral} titulo="Organizações no total" icone={Skull} />
      </Indices>

      <div className="grid gap-3.5 xl:grid-cols-2">
        {grupos.map((c) => (
          <section key={c.id} className="glass hc p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="hc-icone">
                  <Swords className="size-4" strokeWidth={1.75} />
                </span>
                <h3 className="hc-titulo truncate">{c.nome}</h3>
              </div>
              <span className="hc-selo shrink-0 tabular-nums">
                <i className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                {c.livres.length} livre{c.livres.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  <th className="py-1.5 pr-2">Setagem</th>
                  <th className="py-1.5 pr-2">Local</th>
                  <th className="py-1.5 pr-2">CDS</th>
                  <th className="py-1.5 pr-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {c.livres.map((o) => (
                  <tr key={o.id} className="border-b border-white/[0.06] border-l-2 border-l-emerald-500 transition-colors last:border-b-0 hover:bg-white/[0.03]">
                    <td className="py-2 pl-1.5 pr-2 font-semibold text-foreground">{o.setagem || "—"}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{o.local || "—"}</td>
                    <td className="py-2 pr-2 font-mono text-[11px] text-muted-foreground">{o.cds || "—"}</td>
                    <td className="max-w-40 truncate py-2 pr-2 text-muted-foreground" title={o.observacao}>
                      {o.observacao || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        ))}
      </div>
      {!isLoading && grupos.length === 0 && <p className="rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">{busca ? "Nenhuma facção livre com essa busca." : "Nenhuma facção livre no momento."}</p>}
    </div>
  );
}
