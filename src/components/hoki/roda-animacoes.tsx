import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Check,
  Footprints,
  HandFist,
  MessageCircle,
  Music,
  Phone,
  RefreshCcw,
  RotateCw,
  Send,
  Skull,
  Sparkles,
  Square,
  TrendingDown,
  Utensils,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Reacao } from "./mascote";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/** Ícone de cada animação na roda. */
const ICONE: Partial<Record<Reacao, LucideIcon>> = {
  bracos: X,
  sim: Check,
  nao: Ban,
  telefone: Phone,
  comer: Utensils,
  girar: RotateCw,
  zumbi: Skull,
  arranhar: Skull,
  tombo: ArrowUpFromLine,
  levantar: ArrowUpFromLine,
  gancho: HandFist,
  arremessar: Send,
  dancar: Music,
  passinho: Footprints,
  conversar: MessageCircle,
  agachar: ArrowDownToLine,
  cambalhota: RefreshCcw,
  cair: TrendingDown,
  magia: Sparkles,
  consertar: Wrench,
};
const POR_PAGINA = 8;
const R_FORA = 168;
const R_DENTRO = 74;

/** Fatia da roda (em volta do centro, começando no topo). */
function fatia(i: number, n: number) {
  const passo = (Math.PI * 2) / n;
  const a0 = -Math.PI / 2 + i * passo - passo / 2 + 0.012;
  const a1 = a0 + passo - 0.024;
  const p = (r: number, a: number) =>
    `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  return `M ${p(R_DENTRO, a0)} L ${p(R_FORA, a0)} A ${R_FORA} ${R_FORA} 0 0 1 ${p(R_FORA, a1)} L ${p(R_DENTRO, a1)} A ${R_DENTRO} ${R_DENTRO} 0 0 0 ${p(R_DENTRO, a0)} Z`;
}

/**
 * Roda de animações (aperte B na praça): oito por página, Q e E trocam de
 * página, clique (ou número 1 a 8) toca, ESC fecha. No meio aparece o nome da
 * que está sob o mouse e o botão de parar a que está tocando.
 */
export function RodaDeAnimacoes({
  ativo,
  emotes,
  tocando,
  onEscolher,
  onParar,
}: {
  /** Só abre acordado na praça. */
  ativo: boolean;
  emotes: { id: Reacao; nome: string }[];
  tocando: Reacao | null;
  onEscolher: (id: Reacao) => void;
  onParar: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [sobre, setSobre] = useState<number | null>(null);
  const paginas = Math.max(1, Math.ceil(emotes.length / POR_PAGINA));
  const daPagina = useMemo(
    () => emotes.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA),
    [emotes, pagina],
  );

  useEffect(() => {
    if (!ativo) setAberta(false);
  }, [ativo]);

  useEffect(() => {
    const digitando = () => {
      const a = document.activeElement;
      return (
        !!a &&
        (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable)
      );
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (!ativo || digitando() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "KeyB") {
        e.preventDefault();
        setAberta((v) => {
          playSfx(v ? "close" : "open");
          return !v;
        });
        setSobre(null);
        return;
      }
      if (!aberta) return;
      // com a roda aberta, Q, E, ESC e os números são dela (não chegam ao jogo)
      if (/^(Escape|KeyQ|KeyE|Digit[1-8])$/.test(e.code)) e.stopImmediatePropagation();
      if (e.code === "Escape") {
        e.preventDefault();
        setAberta(false);
      } else if (e.code === "KeyQ" || e.code === "KeyE") {
        e.preventDefault();
        setPagina((p) => (p + (e.code === "KeyE" ? 1 : paginas - 1)) % paginas);
        setSobre(null);
      } else if (/^Digit[1-8]$/.test(e.code)) {
        const em = daPagina[Number(e.code.slice(5)) - 1];
        if (em) {
          e.preventDefault();
          onEscolher(em.id);
          setAberta(false);
        }
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [ativo, aberta, paginas, daPagina, onEscolher]);

  if (!ativo || !aberta) return null;
  const n = Math.max(daPagina.length, 4);
  const destaque = sobre !== null ? daPagina[sobre] : null;
  const nomeTocando = tocando ? emotes.find((e) => e.id === tocando)?.nome : null;

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/20 backdrop-blur-[6px]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setAberta(false);
      }}
      role="dialog"
      aria-label="Animações"
    >
      <div className="pf-pop relative" style={{ width: R_FORA * 2 + 8, height: R_FORA * 2 + 8 }}>
        <svg
          viewBox={`${-R_FORA - 4} ${-R_FORA - 4} ${R_FORA * 2 + 8} ${R_FORA * 2 + 8}`}
          className="absolute inset-0 size-full drop-shadow-[0_22px_50px_rgba(0,0,0,0.45)]"
        >
          <circle
            r={R_FORA + 3}
            fill="rgba(255,255,255,0.55)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1.5}
          />
          {Array.from({ length: n }, (_, i) => {
            const em = daPagina[i];
            const ativa = sobre === i && !!em;
            return (
              <path
                key={i}
                d={fatia(i, n)}
                className={cn("transition-[fill,stroke] duration-100", em && "cursor-pointer")}
                fill={
                  ativa
                    ? "#CE0E0E"
                    : em?.id === tocando
                      ? "rgba(206,14,14,0.16)"
                      : "rgba(255,255,255,0.9)"
                }
                stroke={ativa ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.07)"}
                strokeWidth={ativa ? 1.6 : 1}
                onPointerEnter={() => em && setSobre(i)}
                onPointerLeave={() => setSobre((s) => (s === i ? null : s))}
                onClick={() => {
                  if (!em) return;
                  onEscolher(em.id);
                  setAberta(false);
                }}
              />
            );
          })}
          <circle r={R_DENTRO - 6} fill="#ffffff" stroke="rgba(0,0,0,0.08)" />
        </svg>
        {/* ícones e nomes de cada fatia */}
        {daPagina.map((em, i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
          const r = (R_FORA + R_DENTRO) / 2;
          const Icone = ICONE[em.id] ?? Square;
          return (
            <div
              key={em.id}
              className={cn(
                "pointer-events-none absolute flex w-[84px] transition-transform duration-100 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center",
                sobre === i ? "scale-110 text-white" : "text-neutral-800",
              )}
              style={{ left: R_FORA + 4 + Math.cos(a) * r, top: R_FORA + 4 + Math.sin(a) * r }}
            >
              <Icone className="size-7" strokeWidth={1.6} />
              <span className="text-[10.5px] font-semibold leading-tight">{em.nome}</span>
            </div>
          );
        })}
        {/* meio: nome, parar e as teclas */}
        <div className="absolute left-1/2 top-1/2 flex w-[120px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          <p className="min-h-[16px] text-[12px] font-bold text-[#CE0E0E]">
            {destaque?.nome ?? nomeTocando ?? "Animações"}
          </p>
          <button
            type="button"
            disabled={!tocando}
            onClick={() => {
              onParar();
              setAberta(false);
            }}
            aria-label="Parar a animação"
            title="Parar a animação"
            className="my-1.5 grid size-9 place-items-center rounded-full bg-neutral-900 text-white shadow-[0_6px_14px_rgba(0,0,0,0.25)] transition-colors hover:bg-[#CE0E0E] disabled:opacity-25"
          >
            <span className="flex gap-1">
              <span className="h-3.5 w-1 rounded-sm bg-current" />
              <span className="h-3.5 w-1 rounded-sm bg-current" />
            </span>
          </button>
          <p className="font-mono text-[9.5px] font-semibold tracking-wider text-neutral-400">
            {paginas > 1 ? `Q ◀ ${pagina + 1}/${paginas} ▶ E` : "1 a 8"}
          </p>
          <p className="font-mono text-[9.5px] font-semibold tracking-wider text-neutral-400">
            ESC
          </p>
        </div>
      </div>
    </div>
  );
}
