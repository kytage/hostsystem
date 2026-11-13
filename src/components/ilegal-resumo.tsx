import {
  Bookmark,
  CircleDashed,
  MessageSquareText,
  PackageOpen,
  ShieldCheck,
  Skull,
  type LucideIcon,
} from "lucide-react";
import type { IlegalCategoria } from "@/lib/ilegal-data";
import { HEX_CATEGORIA } from "@/lib/ilegal-cores";
import { Indice, Indices } from "@/components/indice";
import { cn } from "@/lib/utils";

/**
 * Resumo do topo do Ilegal, com o mesmo desenho do gráfico "Movimento" da tela
 * inicial: rótulo pequeno, número na cor do que ele representa e uma linha
 * luminosa (brilho, área em degradê, ponto com anel, fio até a base e tiques).
 * A altura do pico é a parte daquele número no total. Clicar filtra a planilha.
 */
export type FiltroIlegal = "todas" | "assumidas" | "reservadas" | "livres" | "pendentes" | "comObs";

export interface NumeroIlegal {
  id: FiltroIlegal;
  rotulo: string;
  valor: number;
  /** Cor do que o número representa (linha, ponto e número). */
  cor: string;
}

// área de desenho da linha (mesmas proporções do Movimento, em miniatura)
const W = 200;
const H = 56;
const TOPO = 9;
const BASE = 50;
/** Em que ponto da largura fica o pico (0 a 8). */
const PICO = 5;
const TIQUES = 8 * 3 + 1;

/** Curva suave passando pelos pontos (igual à do Movimento). */
function suavizar(pts: { x: number; y: number }[]) {
  const primeiro = pts[0];
  if (!primeiro) return "";
  const limita = (y: number) => Math.min(BASE, Math.max(TOPO - 4, y));
  let d = `M${primeiro.x} ${primeiro.y}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)]!;
    const p1 = pts[k]!;
    const p2 = pts[k + 1]!;
    const p3 = pts[Math.min(pts.length - 1, k + 2)]!;
    const t = 0.18;
    d += ` C${(p1.x + (p2.x - p0.x) * t).toFixed(1)} ${limita(p1.y + (p2.y - p0.y) * t).toFixed(1)} ${(p2.x - (p3.x - p1.x) * t).toFixed(1)} ${limita(p2.y - (p3.y - p1.y) * t).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** A linha do cartão: reta na base e um pico da altura da parte no total. */
export function Linha({
  id,
  cor,
  parte,
  ativo,
}: {
  id: string;
  cor: string;
  parte: number;
  ativo: boolean;
}) {
  const serie = [0, 0, 0, 0, 0, parte, parte * 0.14, 0, 0];
  const pts = serie.map((v, k) => ({
    x: (k / (serie.length - 1)) * W,
    y: BASE - v * (BASE - TOPO),
  }));
  const linha = suavizar(pts);
  const ponto = pts[PICO]!;
  const pct = (ponto.x / W) * 100;
  const yPct = (ponto.y / H) * 100;
  return (
    <span className="relative mt-1.5 block">
      {/* clarão atrás do pico */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[-30%] h-[150%] w-[70%] -translate-x-1/2 rounded-full blur-xl transition-opacity duration-300"
        style={{
          left: `${pct}%`,
          opacity: ativo ? 1 : 0.7,
          background: `radial-gradient(closest-side, ${cor}40, transparent)`,
        }}
      />
      <span className="relative block h-[46px]">
        <span
          aria-hidden
          className="absolute inset-x-0 border-t border-dashed border-white/[0.09]"
          style={{ top: `${(BASE / H) * 100}%` }}
        />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="revela absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient
              id={`il-linha-${id}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={W}
              y2="0"
            >
              <stop offset="0" stopColor="#f4f4f5" stopOpacity="0.5" />
              <stop offset="0.55" stopColor={cor} stopOpacity="0.85" />
              <stop offset="1" stopColor={cor} />
            </linearGradient>
            <linearGradient id={`il-area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={cor} stopOpacity="0.2" />
              <stop offset="1" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${linha} L${W} ${H} L0 ${H} Z`} fill={`url(#il-area-${id})`} />
          <path
            d={linha}
            stroke={`url(#il-linha-${id})`}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.24"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "blur(3px)" }}
          />
          <path
            d={linha}
            stroke={`url(#il-linha-${id})`}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* pico em destaque: fio até a base e ponto com anel */}
        <span
          aria-hidden
          className="absolute w-px bg-gradient-to-b from-white/80 to-white/20"
          style={{ left: `${pct}%`, top: `${yPct}%`, bottom: `${100 - (BASE / H) * 100}%` }}
        />
        <span
          aria-hidden
          className="absolute size-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-[#120b0a]"
          style={{
            left: `${pct}%`,
            top: `${yPct}%`,
            borderColor: cor,
            boxShadow: `0 0 0 3px ${cor}24, 0 0 14px ${cor}`,
          }}
        />
      </span>
      {/* tiques, com o do pico aceso */}
      <span className="flex h-2 items-end justify-between" aria-hidden>
        {Array.from({ length: TIQUES }, (_, t) => (
          <i
            key={t}
            className={cn(
              "block w-px",
              t === PICO * 3
                ? "h-full bg-white"
                : t % 3 === 0
                  ? "h-full bg-white/25"
                  : "h-[60%] bg-white/[0.12]",
            )}
          />
        ))}
      </span>
    </span>
  );
}

/** Ícone de cada número do resumo. */
const ICONES: Record<FiltroIlegal, LucideIcon> = {
  todas: Skull,
  assumidas: ShieldCheck,
  reservadas: Bookmark,
  livres: CircleDashed,
  pendentes: PackageOpen,
  comObs: MessageSquareText,
};

/**
 * Resumo do topo do Ilegal, no padrão da tela inicial: os números em quadros (o ponto de cor
 * antes do nome é a cor do estado na planilha) e, ao lado, as categorias. Clicar num número
 * filtra a planilha; clicar de novo volta a mostrar todas.
 */
export function IlegalResumo({
  numeros,
  total,
  filtro,
  onFiltro,
  categorias,
  aba,
  onAba,
}: {
  numeros: NumeroIlegal[];
  total: number;
  filtro: FiltroIlegal;
  onFiltro: (f: FiltroIlegal) => void;
  categorias: IlegalCategoria[];
  aba: string;
  onAba: (id: string) => void;
}) {
  const todas = categorias.reduce((s, c) => s + c.orgs.length, 0);
  return (
    <section className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:gap-3.5">
      <Indices colunas={3}>
        {numeros.map((n) => {
          const ativo = filtro === n.id;
          return (
            <Indice
              key={n.id}
              valor={n.valor}
              titulo={n.rotulo}
              nota={n.id === "todas" ? "no total" : `de ${total}`}
              icone={ICONES[n.id]}
              cor={n.id === "todas" ? undefined : n.cor}
              ativo={ativo}
              onClick={() => onFiltro(ativo ? "todas" : n.id)}
              dica={n.id === "todas" ? "Mostrar todas" : `Ver só: ${n.rotulo}`}
            />
          );
        })}
      </Indices>

      {/* por categoria: barra nas cores de cada uma + legenda que filtra */}
      <div className="glass hc flex flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="hc-sobre">Por categoria</p>
            <p className="hc-titulo mt-1.5">{todas} organizações</p>
          </div>
          <button
            type="button"
            onClick={() => onAba("todas")}
            className={cn("pilula !h-8 !px-3 !text-[11.5px]", aba === "todas" && "pilula-ativa")}
          >
            Todas
          </button>
        </div>
        <div className="mt-4 flex h-[5px] gap-[3px]">
          {categorias
            .filter((c) => c.orgs.length > 0)
            .map((c) => {
              const cor = HEX_CATEGORIA[c.id] ?? "#71717a";
              return (
                <span
                  key={c.id}
                  title={`${c.nome}: ${c.orgs.length}`}
                  className={cn(
                    "block h-full rounded-full transition-opacity duration-300",
                    aba !== "todas" && aba !== c.id && "opacity-20",
                  )}
                  style={{
                    flexGrow: c.orgs.length,
                    flexBasis: 0,
                    background: cor,
                    boxShadow: `0 0 10px ${cor}aa`,
                  }}
                />
              );
            })}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-1 gap-y-1.5 pt-4">
          {categorias.map((c) => {
            const cor = HEX_CATEGORIA[c.id] ?? "#71717a";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onAba(aba === c.id ? "todas" : c.id)}
                aria-pressed={aba === c.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 text-[12px] leading-[24px] transition-colors",
                  aba === c.id
                    ? "border-white/25 bg-white/[0.09] text-foreground"
                    : "border-white/[0.06] bg-white/[0.02] text-foreground/70 hover:bg-white/[0.06] hover:text-foreground",
                )}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: cor, boxShadow: `0 0 7px ${cor}` }}
                />
                {c.nome}
                <span className="font-display font-medium tabular-nums" style={{ color: cor }}>
                  {c.orgs.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
