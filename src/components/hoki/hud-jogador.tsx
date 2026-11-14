import type { CSSProperties, ReactNode } from "react";
import {
  Apple,
  Backpack,
  Coins,
  Crown,
  Droplet,
  Heart,
  Moon,
  Shield,
  UserRound,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HUD do jogador, no estilo do Figma (HOST PROJECT · HUD): quatro quadradinhos
 * inclinados com brilho em volta (escudo = higiene, raio = energia, gota = sede,
 * maçã = fome) e, embaixo, o coração com dez barrinhas de vida.
 *
 * Fica sempre por cima da praça (o painel com o boneco no pódio saiu):
 * no topo os atalhos, o nome e as moedas; embaixo à esquerda as barras.
 * Cada quadradinho enche de baixo para cima conforme o valor; os de comida,
 * bebida e energia são botões (comer, beber e tirar uma soneca).
 * A vida fica cheia por enquanto: o soco ainda não tira vida (a arena PvP vem depois).
 */

type Tom = { de: string; ate: string; brilho: string };
export const TONS = {
  escudo: { de: "#3468a8", ate: "#1d3b66", brilho: "rgba(80,140,230,0.55)" },
  raio: { de: "#4f4396", ate: "#2a2459", brilho: "rgba(140,120,240,0.5)" },
  gota: { de: "#336b8f", ate: "#1c3f57", brilho: "rgba(90,170,220,0.5)" },
  maca: { de: "#56a332", ate: "#2f6b1a", brilho: "rgba(120,210,80,0.5)" },
  vida: { de: "#e0303a", ate: "#a3121b", brilho: "rgba(240,60,70,0.6)" },
} satisfies Record<string, Tom>;

/** Um quadradinho inclinado com o anel de brilho, como no Figma. */
export function Quadro({
  tom,
  valor,
  titulo,
  onClick,
  grande,
  children,
}: {
  tom: Tom;
  /** 0 a 100: quanto está cheio (enche de baixo para cima). */
  valor: number;
  titulo: string;
  onClick?: (() => void) | undefined;
  grande?: boolean;
  children: ReactNode;
}) {
  const baixo = valor < 30;
  const estilo = { "--de": tom.de, "--ate": tom.ate, "--brilho": tom.brilho } as CSSProperties;
  const corpo = (
    <>
      {/* anel de brilho em volta (o retângulo de fora do Figma) */}
      <span
        aria-hidden
        className="absolute inset-0 -skew-x-[8deg] rounded-[9px] border border-[color:var(--brilho)] shadow-[0_0_12px_var(--brilho)]"
      />
      {/* o quadradinho colorido, com a parte vazia escurecida em cima */}
      <span
        aria-hidden
        className="absolute inset-[3px] -skew-x-[8deg] overflow-hidden rounded-[7px] bg-gradient-to-b from-[color:var(--de)] to-[color:var(--ate)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.25)]"
      >
        <span
          className="absolute inset-x-0 top-0 bg-black/45 transition-[height] duration-700 ease-out"
          style={{ height: `${100 - Math.max(0, Math.min(100, valor))}%` }}
        />
      </span>
      <span className={cn("relative z-[1] text-white drop-shadow", baixo && "animate-pulse")}>
        {children}
      </span>
    </>
  );
  const classe = cn(
    "relative grid shrink-0 place-items-center",
    grande ? "h-[42px] w-[48px]" : "h-[36px] w-[42px]",
    onClick && "transition-transform duration-150 hover:-translate-y-0.5 active:scale-95",
  );
  const rotulo = `${titulo}: ${Math.round(valor)}%`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      className={classe}
      style={estilo}
    >
      {corpo}
    </button>
  ) : (
    <div title={rotulo} role="img" aria-label={rotulo} className={classe} style={estilo}>
      {corpo}
    </div>
  );
}

/** Botão pequeno de vidro escuro (mostrar o painel, mochila, dormir). */
function Mini({
  titulo,
  onClick,
  children,
}: {
  titulo: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="grid size-8 place-items-center rounded-lg border border-white/12 bg-black/70 text-white/85 shadow-[0_6px_16px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,color,border-color] hover:-translate-y-0.5 hover:border-white/25 hover:text-white active:scale-95"
    >
      {children}
    </button>
  );
}

export function HudDoJogador({
  dentro,
  compacto = false,
  nome,
  nivel,
  corNivel,
  coins,
  fome,
  sede,
  energia,
  higiene,
  vida = 100,
  onComer,
  onBeber,
  onDescansar,
  onMochila,
  onCorpo,
  onCosmeticos,
  onNome,
  onDormir,
}: {
  /** Acordado na praça (a barra de baixo vai para a direita e libera o canto esquerdo). */
  dentro: boolean;
  /** No cartão (fora da tela cheia): tudo um pouco menor. */
  compacto?: boolean;
  nome: string;
  nivel: number;
  corNivel: { fundo: string; texto: string };
  coins: number;
  fome: number;
  sede: number;
  energia: number;
  higiene: number;
  /** 0 a 100 (cheia enquanto o soco não tira vida). */
  vida?: number;
  onComer: () => void;
  onBeber: () => void;
  onDescansar: () => void;
  onMochila: () => void;
  onCorpo: () => void;
  onCosmeticos: () => void;
  onNome: () => void;
  /** Só aparece acordado na praça. */
  onDormir?: (() => void) | undefined;
}) {
  const barras = Math.round(Math.max(0, Math.min(100, vida)) / 10);
  return (
    <>
      {/* topo: atalhos, nível e nome, e as moedas */}
      <div
        className={cn(
          "absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5 pr-14",
          compacto && "origin-top-left scale-[0.9]",
        )}
      >
        <Mini titulo="Mochila" onClick={onMochila}>
          <Backpack className="size-4" strokeWidth={1.8} />
        </Mini>
        <Mini titulo="Corpo: Masculino ou Feminino" onClick={onCorpo}>
          <UserRound className="size-4" strokeWidth={1.8} />
        </Mini>
        <Mini titulo="Cosméticos" onClick={onCosmeticos}>
          <Crown className="size-4 text-amber-300" strokeWidth={1.8} />
        </Mini>
        {onDormir && (
          <Mini titulo="Dormir (voltar para o berço)" onClick={onDormir}>
            <Moon className="size-4" strokeWidth={1.8} />
          </Mini>
        )}
        <button
          type="button"
          onClick={onNome}
          title="Mudar o nome (até 6 letras)"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/12 bg-black/70 px-2 text-[11.5px] font-semibold text-white backdrop-blur-md transition-colors hover:border-white/25"
        >
          <span
            className="rounded px-1.5 text-[10px] font-extrabold leading-[16px]"
            style={{ background: corNivel.fundo, color: corNivel.texto }}
          >
            {nivel}
          </span>
          <span className="max-w-[90px] truncate uppercase tracking-wide">{nome}</span>
        </button>
        <span
          className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-300/30 bg-black/70 px-2 text-[12px] font-bold tabular-nums text-amber-200 backdrop-blur-md"
          title="Staff Coins"
        >
          <Coins className="size-4 text-amber-300" strokeWidth={2} aria-hidden />
          {coins.toLocaleString("pt-BR")}
          <span className="sr-only"> Staff Coins</span>
        </span>
      </div>

      {/* barras: embaixo à esquerda (no celular ficam em cima, para o joystick não cobrir) */}
      <div
        className={cn(
          "absolute left-3 z-20 flex flex-col gap-1.5 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]",
          dentro ? "bottom-3" : "bottom-[60px]",
          "pointer-coarse:bottom-auto pointer-coarse:top-14",
          compacto && "origin-bottom-left scale-[0.8] pointer-coarse:origin-top-left",
        )}
      >
        <div className="flex items-center gap-1 pl-[5px]">
          <Quadro tom={TONS.escudo} valor={higiene} titulo="Higiene">
            <Shield className="size-[18px]" fill="currentColor" strokeWidth={0} />
          </Quadro>
          <Quadro
            tom={TONS.raio}
            valor={energia}
            titulo="Energia (tocar: soneca)"
            onClick={onDescansar}
          >
            <Zap className="size-[18px]" fill="currentColor" strokeWidth={0} />
          </Quadro>
          <Quadro tom={TONS.gota} valor={sede} titulo="Sede (tocar: beber)" onClick={onBeber}>
            <Droplet className="size-[17px]" fill="currentColor" strokeWidth={0} />
          </Quadro>
          <Quadro tom={TONS.maca} valor={fome} titulo="Fome (tocar: comer)" onClick={onComer}>
            <Apple className="size-[18px]" fill="currentColor" strokeWidth={1.4} />
          </Quadro>
        </div>
        <div className="flex items-center gap-1.5">
          <Quadro tom={TONS.vida} valor={vida} titulo="Vida" grande>
            <Heart className="size-5" fill="currentColor" strokeWidth={0} />
          </Quadro>
          <div
            className="flex items-center gap-[3px]"
            role="meter"
            aria-label="Vida"
            aria-valuenow={vida}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[22px] w-[14px] -skew-x-[10deg] rounded-[3px] transition-colors duration-500",
                  i < barras
                    ? "bg-gradient-to-b from-[#e53941] to-[#b51a22] shadow-[0_0_8px_rgba(230,50,60,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]"
                    : "bg-[#5a3a3f]/55",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
