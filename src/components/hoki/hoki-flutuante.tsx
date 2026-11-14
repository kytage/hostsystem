import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TreePalm } from "lucide-react";
import { meuPet } from "@/lib/hoki";
import { meuLugar, usePresencaHoki } from "@/lib/hoki-presenca";
import { hokiNaTela, ROTA_DO_HOKI } from "@/lib/hoki-lugar";

/**
 * O HOKI fora da tela dele: um botão redondo de vidro no canto de baixo, só com a ilha em branco
 * e, quando há gente acordada na praça, quantos são. Limpo: sem brilho atrás e sem boiar.
 * Clicar leva para a tela do HOKI. (O visual está em src/styles.css, "Movimento do site".)
 */
export function HokiFlutuante() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: pet } = useQuery({ queryKey: ["hoki-meu"], queryFn: meuPet, staleTime: Infinity });
  const { outros } = usePresencaHoki();
  // na tela do HOKI ele já está lá, inteiro; na tela inicial o HOKI não aparece, nem este atalho
  if (pathname === "/" || hokiNaTela(pathname) || !pet) return null;

  const euAcordado = !meuLugar().dorme;
  const naPraca = Object.values(outros).filter((o) => !o.dorme).length + (euAcordado ? 1 : 0);
  const rotulo =
    naPraca > 0 ? `Voltar para o HOKI (${naPraca} na praça agora)` : "Voltar para o HOKI";

  return (
    <Link
      to={ROTA_DO_HOKI}
      aria-label={rotulo}
      title={rotulo}
      className="hoki-flutuante"
      data-som-passar
    >
      <TreePalm aria-hidden className="hoki-flutuante-ilha" strokeWidth={1.75} />
      {naPraca > 0 && <span className="hoki-flutuante-conta">{naPraca}</span>}
    </Link>
  );
}
