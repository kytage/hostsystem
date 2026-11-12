import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Nfc, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { brl, type Player } from "@/lib/players";

/**
 * Inclina o cartão na direção do mouse (o lado apontado afunda) e move o reflexo junto.
 * Longe do cartão a inclinação fica mais fraca. Um só requestAnimationFrame, que para
 * sozinho quando o cartão chega na posição.
 */
function useInclinacao(
  area: RefObject<HTMLDivElement | null>,
  inclina: RefObject<HTMLSpanElement | null>,
  sombra: RefObject<HTMLSpanElement | null>,
) {
  useEffect(() => {
    const a = area.current;
    const g = inclina.current;
    if (!a || !g) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let alvoX = 0;
    let alvoY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const quadro = () => {
      x += (alvoX - x) * 0.09;
      y += (alvoY - y) * 0.09;
      g.style.transform = `rotateX(${(-y * 13).toFixed(2)}deg) rotateY(${(x * 17).toFixed(2)}deg)`;
      g.style.setProperty("--gx", `${(50 + x * 46).toFixed(1)}%`);
      g.style.setProperty("--gy", `${(50 + y * 46).toFixed(1)}%`);
      g.style.setProperty("--tx", x.toFixed(3));
      const s = sombra.current;
      if (s)
        s.style.transform = `translateX(${(-x * 16).toFixed(1)}px) scaleX(${(1 - Math.abs(x) * 0.08).toFixed(3)})`;
      raf = Math.abs(alvoX - x) + Math.abs(alvoY - y) > 0.001 ? requestAnimationFrame(quadro) : 0;
    };
    const mover = (e: PointerEvent) => {
      const r = a.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const m = Math.max(Math.abs(nx), Math.abs(ny));
      const k = m <= 1 ? 1 : Math.max(0.28, 1.5 - 0.5 * m) / m;
      alvoX = nx * k;
      alvoY = ny * k;
      if (!raf) raf = requestAnimationFrame(quadro);
    };
    const sair = () => {
      alvoX = 0;
      alvoY = 0;
      if (!raf) raf = requestAnimationFrame(quadro);
    };
    window.addEventListener("pointermove", mover, { passive: true });
    document.documentElement.addEventListener("pointerleave", sair);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", mover);
      document.documentElement.removeEventListener("pointerleave", sair);
    };
  }, [area, inclina, sombra]);
}

// Tudo no cartão é medido em cqw (largura do cartão): ele encolhe ou cresce inteiro, sem cortar texto.
const rotulo =
  "block text-[length:max(7px,1.95cqw)] font-medium uppercase tracking-[0.22em] text-white/50";

/** Cartão 3D "Banco Host": frente com o saldo, verso com carteira e HOST Coins. */
export function CartaoBancoHost({
  p,
  saldo,
  coins,
  className,
  style,
}: {
  p: Player;
  saldo: number;
  coins: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [virado, setVirado] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const inclinaRef = useRef<HTMLSpanElement>(null);
  const sombraRef = useRef<HTMLSpanElement>(null);
  useInclinacao(areaRef, inclinaRef, sombraRef);

  const [inteiro, centavos] = saldo
    .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(",");
  const final = p.passaporte ? p.passaporte.padStart(4, "0") : "••••";
  const titular = (p.nome || "Sem nome").toUpperCase();
  const virar = () => setVirado((v) => !v);

  return (
    <div className={cn("inv-banco", className)} style={style}>
      <div ref={areaRef} className="inv-cartao-area">
        <span className="inv-cartao-aura" aria-hidden />
        <button
          type="button"
          onClick={virar}
          aria-pressed={virado}
          aria-label={`Cartão Banco Host de ${p.nome || "player"}: saldo de ${brl(p.banco)}. Clique para virar.`}
          className="inv-cartao"
        >
          <span ref={inclinaRef} className="inv-cartao-tilt">
            <span className="inv-cartao-giro">
              <span className="inv-cartao-miolo" style={{ "--z": "0.45px" } as CSSProperties} />
              <span className="inv-cartao-miolo" style={{ "--z": "-0.45px" } as CSSProperties} />

              <span className="inv-face inv-face-frente">
                <span className="inv-face-marca" aria-hidden>
                  <Logo className="h-full [&_path]:fill-white" />
                </span>
                <span className="relative flex h-full flex-col p-[6.2%]">
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-[1.9cqw]">
                      <Logo className="h-[3.5cqw] [&_path]:fill-white" />
                      <span className="font-display text-[2.8cqw] font-bold tracking-[0.24em] text-white">
                        BANCO HOST
                      </span>
                    </span>
                    <Nfc className="size-[4.6cqw] text-white/70" strokeWidth={1.6} />
                  </span>
                  <span className="inv-chip mt-[5%]" aria-hidden />
                  <span className={cn(rotulo, "mt-auto")}>Saldo disponível</span>
                  <span className="mt-[0.9cqw] block truncate font-display text-[7cqw] font-semibold leading-none tracking-tight text-white tabular-nums">
                    {inteiro}
                    <span className="text-white/45">,{centavos}</span>
                    <span className="ml-[1.4cqw] text-[2.55cqw] font-medium tracking-normal text-white/60">
                      BRL
                    </span>
                  </span>
                  <span className="inv-relevo mt-[4.5%] block font-mono text-[2.9cqw] tracking-[0.22em] text-white/75">
                    •••• •••• •••• {final}
                  </span>
                  <span className="mt-[4%] flex items-end justify-between gap-[2.8cqw]">
                    <span className="min-w-0">
                      <span className={rotulo}>Titular</span>
                      <span className="block truncate text-[2.8cqw] font-semibold tracking-[0.08em] text-white">
                        {titular}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={rotulo}>Nível VIP</span>
                      <span
                        className={cn(
                          "block text-[2.7cqw] font-semibold",
                          p.rank_vip ? "text-amber-200" : "text-white/85",
                        )}
                      >
                        {p.rank_vip ?? "Sem VIP"}
                      </span>
                    </span>
                  </span>
                </span>
                <span className="inv-face-brilho" aria-hidden />
                <span className="inv-face-reflexo" aria-hidden />
              </span>

              <span className="inv-face inv-face-verso">
                <span className="inv-tarja" aria-hidden />
                <span className="flex h-[73%] flex-col px-[6.2%] pb-[5%] pt-[5%]">
                  <span className="flex items-center gap-[1.9cqw]">
                    <span className="inv-assinatura">{p.nome || "—"}</span>
                    <span className="grid h-[7cqw] shrink-0 place-items-center rounded-[1cqw] bg-white/90 px-[1.9cqw] font-mono text-[2.55cqw] font-semibold text-black">
                      #{p.passaporte ?? "—"}
                    </span>
                  </span>
                  <span className="mt-[6%] grid grid-cols-2 gap-[2.8cqw]">
                    <span className="min-w-0">
                      <span className={rotulo}>Carteira</span>
                      <span className="mt-[0.5cqw] block truncate font-display text-[3.5cqw] font-semibold text-white tabular-nums">
                        {brl(p.carteira)}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className={rotulo}>HOST Coins</span>
                      <span className="mt-[0.5cqw] block truncate font-display text-[3.5cqw] font-semibold text-white tabular-nums">
                        {Math.round(coins).toLocaleString("pt-BR")}
                      </span>
                    </span>
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-[2.8cqw] text-[length:max(7px,2.1cqw)] tracking-[0.06em] text-white/45">
                    <span>Banco Host · uso exclusivo do titular</span>
                    <Logo className="h-[3.7cqw] shrink-0 [&_path]:fill-white/80" />
                  </span>
                </span>
                <span className="inv-face-reflexo" aria-hidden />
              </span>
            </span>
          </span>
        </button>
        <span ref={sombraRef} className="inv-cartao-sombra" aria-hidden />
      </div>
      <button type="button" onClick={virar} className="inv-cartao-virar">
        <Repeat2 className="size-3.5" strokeWidth={1.8} />
        {virado ? "Ver frente do cartão" : "Virar cartão"}
      </button>
    </div>
  );
}
