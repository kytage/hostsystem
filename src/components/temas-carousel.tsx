import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const R2 = "https://image.hostgg.com.br";

/** Atalhos do painel em cartões com imagem. As artes são itens e carros da própria cidade. */
const TEMAS = [
  { rota: "/ilegal", titulo: "Ilegal", texto: "Organizações, setagens e painéis dos líderes.", img: `${R2}/inventory/WEAPON_SPECIALCARBINE_MK2.png` },
  { rota: "/players", titulo: "Players", texto: "Personagens, inventário e garagem.", img: `${R2}/game/garage/tfr32.png` },
  { rota: "/marketing", titulo: "Marketing", texto: "Gravações, publicações e leads.", img: `${R2}/inventory/cellphone.png` },
  { rota: "/areas", titulo: "Áreas", texto: "Quem cuida de cada área e o que falta.", img: `${R2}/inventory/radio.png` },
  { rota: "/eventos", titulo: "Eventos", texto: "Cronograma e gestão dos eventos.", img: `${R2}/inventory/cake.png` },
  { rota: "/update", titulo: "Update 3.0", texto: "Pendências e novidades da atualização.", img: `${R2}/inventory/tablet.png` },
] as const;

export function TemasCarousel() {
  const navigate = useNavigate();
  const [ativo, setAtivo] = useState(1);
  const [parado, setParado] = useState(false);
  const total = TEMAS.length;
  const ir = (n: number) => setAtivo(((n % total) + total) % total);

  useEffect(() => {
    if (parado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setAtivo((a) => (a + 1) % total), 5200);
    return () => clearInterval(id);
  }, [parado, total]);

  return (
    <section
      className="relative"
      aria-roledescription="carrossel"
      aria-label="Atalhos do painel"
      onPointerEnter={() => setParado(true)}
      onPointerLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
    >
      <div className="relative h-[290px] overflow-hidden" style={{ perspective: 1400 }}>
        {TEMAS.map((t, i) => {
          // distância circular até o cartão ativo: -2..+3
          let d = i - ativo;
          if (d > total / 2) d -= total;
          if (d < -total / 2) d += total;
          const frente = d === 0;
          return (
            <button
              key={t.rota}
              onClick={() => (frente ? void navigate({ to: t.rota }) : ir(i))}
              aria-label={frente ? `Abrir ${t.titulo}` : `Ver ${t.titulo}`}
              aria-current={frente}
              tabIndex={Math.abs(d) > 2 ? -1 : 0}
              className={cn(
                "tema-card absolute left-1/2 top-2 flex h-[270px] w-[230px] flex-col overflow-hidden rounded-[26px] border text-left",
                frente ? "border-white/[0.14]" : "border-white/[0.06]",
              )}
              style={{
                transform: `translateX(calc(-50% + ${d * 178}px)) translateZ(${-Math.abs(d) * 150}px) rotateY(${d * -16}deg)`,
                opacity: Math.abs(d) > 2 ? 0 : 1 - Math.abs(d) * 0.28,
                zIndex: 10 - Math.abs(d),
                pointerEvents: Math.abs(d) > 2 ? "none" : "auto",
              }}
            >
              <span aria-hidden className={cn("absolute inset-0 transition-opacity duration-700", frente ? "opacity-100" : "opacity-40")} style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.16), rgba(60,60,60,0.25) 50%, #080808 100%)" }} />
              <span className="relative grid flex-1 place-items-center px-5 pt-5">
                <img src={t.img} alt="" loading="lazy" draggable={false} className={cn("max-h-[120px] w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)] transition-transform duration-700", frente ? "scale-110" : "scale-90 grayscale")} />
              </span>
              <span className="relative block px-5 pb-5 text-center">
                <span className="block font-display text-lg font-semibold">{t.titulo}</span>
                <span className="mt-1 block text-[11.5px] leading-snug text-foreground/65">{t.texto}</span>
                <span className={cn("mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-[11px] font-semibold text-black transition-opacity duration-500", frente ? "opacity-100" : "opacity-0")}>Abrir</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button onClick={() => ir(ativo - 1)} aria-label="Anterior" className="grid size-8 place-items-center rounded-full bg-white/[0.05] text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex gap-1.5">
          {TEMAS.map((t, i) => (
            <button key={t.rota} onClick={() => ir(i)} aria-label={`Ir para ${t.titulo}`} className={cn("h-1.5 rounded-full transition-all duration-500", i === ativo ? "w-6 bg-white" : "w-1.5 bg-white/25")} />
          ))}
        </div>
        <button onClick={() => ir(ativo + 1)} aria-label="Próximo" className="grid size-8 place-items-center rounded-full bg-white/[0.05] text-muted-foreground transition-colors hover:text-foreground">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
