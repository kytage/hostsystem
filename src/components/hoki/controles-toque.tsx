import { useEffect, useRef, useState } from "react";
import { ChevronsUp, HandFist } from "lucide-react";
import { cn } from "@/lib/utils";

/** Raio da base do joystick (px) e quanto o pino anda. Com o dedo quase no fim, corre. */
const RAIO = 52;
const CORRE_ACIMA = 0.9;

/** A tela é de toque (celular ou tablet)? */
function usaToque() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

/**
 * Controles da praça no celular: joystick no canto esquerdo (andar; com o dedo
 * todo para fora, correr) e botão de pular no canto direito. Arrastar no resto da
 * tela continua girando a câmera, e tocar no chão continua andando até lá.
 */
export function ControlesDeToque({
  ativo,
  onJoystick,
  onPular,
  onSocar,
}: {
  ativo: boolean;
  onJoystick: (lado: number, frente: number, correr: boolean) => void;
  onPular: () => void;
  /** Botão de soco (sem ele, o botão não aparece). */
  onSocar?: () => void;
}) {
  const [toque, setToque] = useState(false);
  const base = useRef<HTMLDivElement>(null);
  const pino = useRef<HTMLDivElement>(null);
  const dedo = useRef<number | null>(null);
  const aviso = useRef(onJoystick);
  aviso.current = onJoystick;

  useEffect(() => setToque(usaToque()), []);
  // saiu da praça (ou o controle sumiu) com o dedo no joystick: para o HOKI
  useEffect(() => {
    if (!ativo) aviso.current(0, 0, false);
  }, [ativo]);
  useEffect(() => () => aviso.current(0, 0, false), []);

  if (!toque || !ativo) return null;

  const mover = (e: React.PointerEvent) => {
    const b = base.current?.getBoundingClientRect();
    if (!b) return;
    let dx = e.clientX - (b.left + b.width / 2);
    let dy = e.clientY - (b.top + b.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RAIO) {
      dx = (dx / d) * RAIO;
      dy = (dy / d) * RAIO;
    }
    if (pino.current) pino.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const forca = Math.min(1, d / RAIO);
    // zona morta pequena no meio, para não andar com o dedo só encostado
    if (forca < 0.12) return onJoystick(0, 0, false);
    onJoystick(dx / RAIO, -dy / RAIO, forca > CORRE_ACIMA);
  };
  const largar = () => {
    dedo.current = null;
    if (pino.current) pino.current.style.transform = "";
    onJoystick(0, 0, false);
  };

  return (
    <>
      <div
        ref={base}
        role="application"
        aria-label="Joystick: arraste para andar"
        className="absolute bottom-20 left-4 z-20 grid size-[120px] touch-none select-none place-items-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.stopPropagation();
          dedo.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          mover(e);
        }}
        onPointerMove={(e) => {
          if (dedo.current === e.pointerId) mover(e);
        }}
        onPointerUp={largar}
        onPointerCancel={largar}
        onLostPointerCapture={largar}
      >
        <div
          ref={pino}
          className="pointer-events-none size-12 rounded-full border border-white/70 bg-white/85 shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-transform duration-75"
        />
      </div>
      <button
        type="button"
        aria-label="Pular"
        className={cn(
          "absolute bottom-20 right-4 z-20 grid size-16 touch-none select-none place-items-center rounded-full",
          "border border-white/30 bg-white/90 text-black shadow-[0_8px_22px_rgba(0,0,0,0.45)] active:scale-95",
        )}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onPular();
        }}
      >
        <ChevronsUp className="size-7" strokeWidth={2.2} />
      </button>
      {onSocar && (
        <button
          type="button"
          aria-label="Soco"
          className={cn(
            "absolute bottom-[164px] right-6 z-20 grid size-12 touch-none select-none place-items-center rounded-full",
            "border border-white/30 bg-[#CE0E0E]/90 text-white shadow-[0_8px_22px_rgba(0,0,0,0.45)] active:scale-95",
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSocar();
          }}
        >
          <HandFist className="size-6" strokeWidth={2} />
        </button>
      )}
    </>
  );
}
