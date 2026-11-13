import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Swords } from "lucide-react";
import { fetchEstabelecimentos } from "@/lib/captacoes";
import { fetchCategorias } from "@/lib/ilegal-data";
import { isSemLocal } from "@/lib/ilegal-status";
import { useRealtimeTable } from "@/lib/realtime";

/**
 * Cartão em destaque da tela inicial para "Organizações livres", com a
 * contagem do que está livre agora (legais e facções). Toda a equipe vê.
 * O cartão inteiro leva à tela das organizações.
 */
export function OrganizacoesDestaque() {
  useRealtimeTable("captacoes_estabelecimentos", [["captacoes-estabelecimentos"]]);
  useRealtimeTable("ilegal_orgs", [["organizacoes-faccoes"]]);
  const { data: legais = [] } = useQuery({
    queryKey: ["captacoes-estabelecimentos"],
    queryFn: fetchEstabelecimentos,
    staleTime: 60_000,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["organizacoes-faccoes"],
    queryFn: fetchCategorias,
    staleTime: 60_000,
  });
  const legaisLivres = legais.filter((e) => e.status === "livre").length;
  const faccoesLivres = categorias.reduce(
    (s, c) => s + c.orgs.filter((o) => o.status === "Livre" && !isSemLocal(o.local)).length,
    0,
  );

  const numero =
    "font-display text-[30px] font-medium leading-none tracking-[-0.04em] tabular-nums text-foreground";
  return (
    <Link
      to="/organizacoes"
      className="glass hc hc-vidro flex w-full flex-col justify-between gap-5 p-5"
    >
      {/* luz localizada: o vermelho da HOST e anéis finos saindo do ícone */}
      <span aria-hidden className="hc-luz-icone" />
      <span className="flex items-center gap-3">
        <span className="hc-icone hc-icone-vivo">
          <Building2 className="size-4" strokeWidth={1.9} />
        </span>
        <span className="hc-sobre min-w-0 flex-1 truncate !text-foreground">
          Organizações livres
        </span>
        <span className="hc-seta" aria-hidden>
          <ArrowUpRight className="size-3.5" />
        </span>
      </span>
      <span className="flex flex-wrap items-end gap-x-8 gap-y-3 text-[12.5px] text-muted-foreground">
        <span className="flex items-baseline gap-2">
          <b className={numero}>{legaisLivres}</b>
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5 translate-y-[2px] text-ink-3" /> legais
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <b className={numero}>{faccoesLivres}</b>
          <span className="flex items-center gap-1.5">
            <Swords className="size-3.5 translate-y-[2px] text-ink-3" /> facções
          </span>
        </span>
      </span>
    </Link>
  );
}
