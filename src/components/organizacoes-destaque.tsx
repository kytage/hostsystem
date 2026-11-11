import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Swords } from "lucide-react";
import { fetchEstabelecimentos } from "@/lib/captacoes";
import { fetchCategorias } from "@/lib/ilegal-data";
import { isSemLocal } from "@/lib/ilegal-status";
import { useRealtimeTable } from "@/lib/realtime";

/**
 * Atalho em destaque da tela inicial para "Organizações livres", com a
 * contagem do que está livre agora (legais e facções). Toda a equipe vê.
 */
export function OrganizacoesDestaque() {
  useRealtimeTable("captacoes_estabelecimentos", [["captacoes-estabelecimentos"]]);
  useRealtimeTable("ilegal_orgs", [["organizacoes-faccoes"]]);
  const { data: legais = [] } = useQuery({ queryKey: ["captacoes-estabelecimentos"], queryFn: fetchEstabelecimentos, staleTime: 60_000 });
  const { data: categorias = [] } = useQuery({ queryKey: ["organizacoes-faccoes"], queryFn: fetchCategorias, staleTime: 60_000 });
  const legaisLivres = legais.filter((e) => e.status === "livre").length;
  const faccoesLivres = categorias.reduce((s, c) => s + c.orgs.filter((o) => o.status === "Livre" && !isSemLocal(o.local)).length, 0);

  return (
    <Link
      to="/organizacoes"
      className="group flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/20 via-primary/[0.08] to-transparent py-2 pl-2 pr-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60"
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-[0_0_24px_rgba(206,14,14,0.5)]">
        <Building2 className="size-5" strokeWidth={1.8} />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-[#120404]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-red-200">Organizações livres</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-foreground/85">
          <span className="flex items-center gap-1">
            <Building2 className="size-3.5 text-ink-3" /> <b className="tabular-nums">{legaisLivres}</b> legais
          </span>
          <span className="flex items-center gap-1">
            <Swords className="size-3.5 text-ink-3" /> <b className="tabular-nums">{faccoesLivres}</b> facções
          </span>
        </span>
      </span>
      <ArrowUpRight className="ml-1 size-4 shrink-0 text-red-200 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
