import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { meuPet } from "@/lib/hoki";
import { meuLugar, usePresencaHoki } from "@/lib/hoki-presenca";
import { hokiNaTela, ROTA_DO_HOKI } from "@/lib/hoki-lugar";
import { Hoki2D } from "./hoki-2d";

/**
 * O HOKI fora da tela dele: um botão flutuante no canto de baixo (vidro com
 * desfoque, boiando de leve, com um brilho pulsando atrás). Mostra o rosto do
 * seu HOKI e quantos estão acordados na praça; clicar leva para a tela do HOKI.
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
      className="hoki-flutuante group fixed bottom-5 right-5 z-[80] block size-14"
      data-som-passar
    >
      <span className="hoki-boia relative block size-full">
        {/* brilho pulsando atrás do vidro */}
        <span
          aria-hidden
          className="hoki-halo absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,rgba(229,35,27,0.55),rgba(229,35,27,0.12)_60%,transparent)] blur-md"
        />
        {/* o vidro: escuro, com desfoque do que está atrás e um fio de luz na borda */}
        <span className="absolute inset-0 overflow-hidden rounded-full border border-white/20 bg-black/45 shadow-[0_10px_30px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl transition-[border-color,transform] duration-300 group-hover:scale-105 group-hover:border-white/45">
          <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_30%_0%,rgba(255,255,255,0.16),transparent_55%)]" />
          <span className="absolute inset-[3px] block overflow-hidden rounded-full">
            <Hoki2D visual={pet.visual} busto />
          </span>
        </span>
        {/* quantos estão acordados na praça (ou a lua, se o seu está dormindo e a praça vazia) */}
        <span
          className={
            naPraca > 0
              ? "absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border border-black bg-emerald-400 px-1 text-[10px] font-bold tabular-nums text-black shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              : "absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full border border-black bg-zinc-700 text-[10px] text-white/80"
          }
        >
          {naPraca > 0 ? naPraca : "z"}
        </span>
      </span>
    </Link>
  );
}
