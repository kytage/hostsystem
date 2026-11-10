import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { getCurrentUsername } from "@/lib/kanban";

/** Marca o que a abertura deve fazer nesta aba: "login" (acabou de entrar) ou "feita". */
export const CHAVE_ABERTURA = "host-abertura";

/**
 * Símbolo da HOST em 3D: camadas empilhadas dão a espessura, ele flutua
 * sozinho e inclina acompanhando o ponteiro.
 */
export function Logo3D({ tamanho = 150, className }: { tamanho?: number; className?: string }) {
  const [giro, setGiro] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const mover = (e: PointerEvent) =>
      setGiro({ x: (0.5 - e.clientY / window.innerHeight) * 34, y: (e.clientX / window.innerWidth - 0.5) * 46 });
    window.addEventListener("pointermove", mover, { passive: true });
    return () => window.removeEventListener("pointermove", mover);
  }, []);
  const camadas = 14;
  return (
    <div className={cn("relative", className)} style={{ width: tamanho, height: tamanho * 0.954, perspective: 900 }}>
      <div className="size-full transition-transform duration-300 ease-out" style={{ transformStyle: "preserve-3d", transform: `rotateX(${giro.x}deg) rotateY(${giro.y}deg)` }}>
        <div className="logo3d-flutua relative size-full" style={{ transformStyle: "preserve-3d" }}>
          {/* A última camada é a frente clara; as de trás formam a lateral vermelha. */}
          {Array.from({ length: camadas }, (_, i) => (
            <div key={i} className="absolute inset-0" style={{ transform: `translateZ(${(i - camadas / 2) * 2.2}px)` }}>
              <Logo className={cn("size-full", i === camadas - 1 ? "[&_path]:fill-white" : "[&_path]:fill-[#7d0909]")} />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-[10%] -bottom-8 h-10 rounded-full bg-primary/50 blur-2xl" />
    </div>
  );
}

type Fase = "oculta" | "boasvindas" | "portal";

function faseInicial(): Fase {
  if (typeof window === "undefined") return "oculta";
  try {
    const marca = sessionStorage.getItem(CHAVE_ABERTURA);
    if (marca === "feita") return "oculta";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "oculta";
    return marca === "login" ? "portal" : "boasvindas";
  } catch {
    return "oculta";
  }
}

/**
 * Abertura do painel. Quem já estava logado vê uma tela de boas-vindas
 * (clique, Enter ou 2 segundos para entrar); quem acabou de digitar a senha
 * vai direto para o "portal": a logo avança na direção da tela e revela o painel.
 */
export function Abertura() {
  const [fase, setFase] = useState<Fase>(faseInicial);
  const { data: usuario = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000, enabled: fase !== "oculta" });
  const saiu = useRef(false);

  const entrar = useCallback(() => setFase((f) => (f === "boasvindas" ? "portal" : f)), []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_ABERTURA, "feita");
    } catch {
      // sem armazenamento: a abertura só aparece de novo ao recarregar
    }
  }, []);

  useEffect(() => {
    if (fase === "boasvindas") {
      const auto = setTimeout(entrar, 2200);
      const tecla = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " " || e.key === "Escape") && entrar();
      window.addEventListener("keydown", tecla);
      return () => {
        clearTimeout(auto);
        window.removeEventListener("keydown", tecla);
      };
    }
    if (fase === "portal" && !saiu.current) {
      saiu.current = true;
      // sem limpeza de propósito: o painel precisa aparecer mesmo se o efeito rodar de novo
      setTimeout(() => setFase("oculta"), 950);
    }
    return undefined;
  }, [fase, entrar]);

  if (fase === "oculta") return null;

  // Vai direto no <body>: precisa cobrir o menu lateral, e não só a área da página.
  return createPortal(
    <div
      onClick={entrar}
      role="dialog"
      aria-label="Abertura do painel HOST"
      className={cn("fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-black", fase === "portal" && "abertura-sai")}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 108%, rgba(206,14,14,0.55), transparent 70%)" }} />
      <div className="relative flex flex-col items-center text-center">
        <div className={cn(fase === "portal" && "abertura-portal")}>
          <Logo3D tamanho={170} />
        </div>
        <div className={cn("abertura-texto mt-12", fase === "portal" && "opacity-0 transition-opacity duration-200")}>
          <p className="eyebrow">HOST GROUP · Sistema e gestão</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Bem-vindo de volta{usuario ? `, ${usuario}` : ""}
          </h1>
          <p className="mt-3 text-xs text-muted-foreground">Clique ou aperte Enter para entrar</p>
        </div>
      </div>
      <p className="absolute bottom-6 text-[10px] uppercase tracking-[0.3em] text-ink-3">desenvolvido por henrique bonne</p>
    </div>,
    document.body,
  );
}
