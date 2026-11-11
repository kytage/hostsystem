import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Andamento do desenvolvimento: uma etapa em destaque por vez.
 * O cartão passa sozinho pelas etapas (para ao passar o mouse) e os
 * traços embaixo escolhem a etapa.
 * ------------------------------------------------------------------ */
export interface Etapa {
  id: string;
  label: string;
  n: number;
}

const FRASES: Record<string, (n: number) => string> = {
  backlog: (n) =>
    n === 0
      ? "Nada na fila: o que foi planejado já começou."
      : `${n} ${n > 1 ? "tarefas planejadas" : "tarefa planejada"}, ainda sem começar.`,
  doing: (n) =>
    n === 0
      ? "Ninguém desenvolvendo neste momento."
      : `${n} ${n > 1 ? "tarefas em desenvolvimento" : "tarefa em desenvolvimento"} agora.`,
  review: (n) =>
    n === 0
      ? "Nada esperando teste."
      : `${n} ${n > 1 ? "tarefas esperando" : "tarefa esperando"} teste.`,
  done: (n) =>
    n === 0
      ? "Nenhuma tarefa concluída no quadro ainda."
      : `${n} ${n > 1 ? "tarefas concluídas" : "tarefa concluída"} no quadro.`,
};

export function CartaoAndamento({
  etapas,
  onAbrir,
  className,
}: {
  etapas: Etapa[];
  onAbrir: () => void;
  className?: string;
}) {
  const [i, setI] = useState(1);
  const [parado, setParado] = useState(false);
  const quantas = etapas.length;
  useEffect(() => {
    if (parado || quantas < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % quantas), 4600);
    return () => clearInterval(id);
  }, [parado, quantas]);

  const atual = etapas[i % Math.max(1, quantas)];
  const total = etapas.reduce((s, e) => s + e.n, 0);
  const maior = Math.max(1, ...etapas.map((e) => e.n));
  // degraus: um patamar por etapa, mais alto quanto mais tarefas
  const passo = 300 / Math.max(1, quantas);
  const patamares = etapas.map((e, k) => ({
    x0: k * passo + 9,
    x1: (k + 1) * passo - 9,
    y: 90 - (e.n / maior) * 68,
  }));
  const linha = patamares.map((p, k) => `${k ? "L" : "M"}${p.x0} ${p.y} L${p.x1} ${p.y}`).join(" ");
  const p = patamares[i % Math.max(1, quantas)];
  if (!atual || !p) return null;
  const frase = (FRASES[atual.id] ?? ((n: number) => `${n} no quadro.`))(atual.n);

  return (
    <section
      className={cn(
        "glass brilho relative flex min-h-[300px] flex-col overflow-hidden rounded-[24px] p-4",
        className,
      )}
      onPointerEnter={() => setParado(true)}
      onPointerLeave={() => setParado(false)}
    >
      <span aria-hidden className="pontilhado opacity-60" />
      <div className="relative flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-medium text-foreground/90">Desenvolvimento</h2>
        <button
          type="button"
          onClick={onAbrir}
          className="pilula !h-7 !gap-1 !px-2.5 !text-[11.5px]"
        >
          Abrir <ArrowUpRight className="size-3" strokeWidth={1.8} />
        </button>
      </div>

      <div className="relative mt-4 text-center">
        <p key={`r${atual.id}`} className="surge text-[11.5px] text-foreground/60">
          {atual.label}
        </p>
        <p
          key={`n${atual.id}`}
          className="surge mt-0.5 font-display text-[56px] font-light leading-none tracking-[-0.05em] tabular-nums"
        >
          {atual.n}
          <span className="ml-1 align-top text-[12.5px] font-normal tracking-normal text-[#ff7461]">
            de {total}
          </span>
        </p>
      </div>

      {/* degraus: o patamar da etapa em destaque acende */}
      <div className="relative mt-3 min-h-[82px] flex-1">
        <svg
          viewBox="0 0 300 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="andamento-coluna" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff5a45" stopOpacity="0.34" />
              <stop offset="1" stopColor="#ff5a45" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`M${p.x0} ${p.y} L${p.x1} ${p.y} L${p.x1} 100 L${p.x0} 100 Z`}
            fill="url(#andamento-coluna)"
            style={{ transition: "d 560ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
          <path
            d={`M${p.x0} ${p.y} L${p.x0} 100 M${p.x1} ${p.y} L${p.x1} 100`}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1"
            fill="none"
            vectorEffect="non-scaling-stroke"
            style={{ transition: "d 560ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
          <path
            d={linha}
            stroke="#ff5a45"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            style={{ transition: "d 560ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
        </svg>
        <span
          aria-hidden
          className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff6a55] shadow-[0_0_0_4px_rgba(255,90,69,0.16),0_0_14px_rgba(255,90,69,0.9)] transition-[left,top] duration-500 ease-out"
          style={{ left: `${((p.x0 + p.x1) / 2 / 300) * 100}%`, top: `${p.y}%` }}
        />
      </div>

      <p
        key={`f${atual.id}`}
        className="surge relative mx-auto mt-2 max-w-[240px] text-center text-[12px] leading-snug text-foreground/60"
      >
        {frase}
      </p>
      <div className="relative mt-2.5 flex justify-center gap-1.5">
        {etapas.map((e, k) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Ver ${e.label}`}
            aria-pressed={k === i}
            data-sem-elastico
            className="group flex h-4 w-7 items-center"
          >
            <span
              className={cn(
                "block h-[3px] w-full rounded-full transition-colors duration-300",
                k === i ? "bg-white" : "bg-white/15 group-hover:bg-white/35",
              )}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Movimento: quantos pedidos chegaram (ou foram concluídos) por dia nos
 * últimos 14 dias. Recebe só as datas. O dia sob o ponteiro fica em
 * destaque; sem ponteiro, o destaque é hoje.
 * ------------------------------------------------------------------ */
const DIAS = 14;
const DIA_MS = 86_400_000;
const W = 560;
const H = 170;
const TOPO = 24;
const BASE = 152;

/** Caminho suave pelos pontos, sem passar do topo nem da base. */
function suavizar(pts: { x: number; y: number }[]) {
  const primeiro = pts[0];
  if (!primeiro) return "";
  const limita = (y: number) => Math.min(BASE, Math.max(TOPO - 8, y));
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

export function CartaoMovimento({
  novos,
  concluidos,
  legenda,
  className,
}: {
  /** datas em que cada pedido chegou */
  novos: string[];
  /** datas em que cada pedido foi concluído */
  concluidos: string[];
  /** linha pequena abaixo do título */
  legenda: string;
  className?: string;
}) {
  const [modo, setModo] = useState<"pedidos" | "concluidos">("pedidos");
  const [sobre, setSobre] = useState<number | null>(null);
  const [hoje, setHoje] = useState<number | null>(null);
  const area = useRef<HTMLDivElement>(null);

  // o dia de hoje só existe no navegador (evita diferença com o servidor)
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setHoje(d.getTime());
  }, []);

  const serie = useMemo(() => {
    const s = Array.from({ length: DIAS }, () => 0);
    if (hoje === null) return s;
    const inicio = hoje - (DIAS - 1) * DIA_MS;
    for (const quando of modo === "pedidos" ? novos : concluidos) {
      const d = new Date(quando);
      d.setHours(0, 0, 0, 0);
      const k = Math.round((d.getTime() - inicio) / DIA_MS);
      if (k >= 0 && k < DIAS) s[k] = (s[k] ?? 0) + 1;
    }
    return s;
  }, [novos, concluidos, modo, hoje]);

  const teto = Math.max(4, Math.ceil(Math.max(...serie) / 2) * 2);
  const pts = serie.map((v, k) => ({
    x: (k / (DIAS - 1)) * W,
    y: BASE - (v / teto) * (BASE - TOPO),
  }));
  const linha = suavizar(pts);
  const k = Math.min(DIAS - 1, Math.max(0, sobre ?? DIAS - 1));
  const ponto = pts[k] ?? { x: W, y: BASE };
  const pct = (ponto.x / W) * 100;
  const yPct = (ponto.y / H) * 100;
  const total = serie.reduce((s, v) => s + v, 0);
  const dia = hoje === null ? null : new Date(hoje - (DIAS - 1 - k) * DIA_MS);
  const nomeDoDia = !dia
    ? ""
    : k === DIAS - 1
      ? "Hoje"
      : k === DIAS - 2
        ? "Ontem"
        : dia.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }).replace(".", "");

  const apontar = (e: React.PointerEvent) => {
    const caixa = area.current?.getBoundingClientRect();
    if (!caixa || caixa.width < 1) return;
    const novo = Math.min(
      DIAS - 1,
      Math.max(0, Math.round(((e.clientX - caixa.left) / caixa.width) * (DIAS - 1))),
    );
    setSobre((v) => (v === novo ? v : novo));
  };

  return (
    <section
      className={cn(
        "glass relative flex min-h-[300px] flex-col overflow-hidden rounded-[24px] p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-medium text-foreground/90">
            Movimento{" "}
            <span className="font-normal text-muted-foreground">
              {total} em {DIAS} dias
            </span>
          </h2>
          <p className="truncate text-[11px] text-ink-3">{legenda}</p>
        </div>
        <div className="segmentos shrink-0" role="tablist" aria-label="O que mostrar">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "pedidos"}
            onClick={() => setModo("pedidos")}
            data-sem-elastico
          >
            Novos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "concluidos"}
            onClick={() => setModo("concluidos")}
            data-sem-elastico
          >
            Concluídos
          </button>
        </div>
      </div>

      <div className="glass-inset relative mt-3 flex min-h-[190px] flex-1 flex-col overflow-hidden rounded-[18px] border px-3 pb-2 pt-2.5">
        {/* clarão quente que acompanha o dia em destaque */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-[6%] h-[88%] w-[52%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(236,52,34,0.3),transparent)] blur-xl transition-[left] duration-500 ease-out"
          style={{ left: `calc(${pct}% * 0.86 + 7%)` }}
        />
        <div className="relative flex min-h-0 flex-1">
          {/* eixo: teto, metade e zero */}
          <div className="relative w-6 shrink-0 text-[9.5px] tabular-nums text-ink-3" aria-hidden>
            <span
              className="absolute left-0 -translate-y-1/2"
              style={{ top: `${(TOPO / H) * 100}%` }}
            >
              {teto}
            </span>
            <span
              className="absolute left-0 -translate-y-1/2"
              style={{ top: `${((TOPO + BASE) / 2 / H) * 100}%` }}
            >
              {teto / 2}
            </span>
            <span
              className="absolute left-0 -translate-y-1/2"
              style={{ top: `${(BASE / H) * 100}%` }}
            >
              0
            </span>
          </div>
          <div
            ref={area}
            className="relative min-w-0 flex-1 cursor-crosshair"
            onPointerMove={apontar}
            onPointerLeave={() => setSobre(null)}
          >
            {[TOPO, (TOPO + BASE) / 2, BASE].map((y) => (
              <span
                key={y}
                aria-hidden
                className="absolute inset-x-0 border-t border-dashed border-white/[0.09]"
                style={{ top: `${(y / H) * 100}%` }}
              />
            ))}
            <svg
              key={modo}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="revela absolute inset-0 size-full overflow-visible"
              aria-hidden
            >
              <defs>
                <linearGradient
                  id="mov-linha"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="0"
                  x2={W}
                  y2="0"
                >
                  <stop offset="0" stopColor="#f4f4f5" stopOpacity="0.55" />
                  <stop offset="0.55" stopColor="#ffb199" />
                  <stop offset="1" stopColor="#ff5a45" />
                </linearGradient>
                <linearGradient id="mov-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ff5a45" stopOpacity="0.16" />
                  <stop offset="1" stopColor="#ff5a45" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${linha} L${W} ${H} L0 ${H} Z`} fill="url(#mov-area)" />
              <path
                d={linha}
                stroke="url(#mov-linha)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                opacity="0.22"
                vectorEffect="non-scaling-stroke"
                style={{ filter: "blur(4px)" }}
              />
              <path
                d={linha}
                stroke="url(#mov-linha)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {/* dia em destaque: fio até a base, ponto e valor */}
            <span
              aria-hidden
              className="absolute w-px bg-gradient-to-b from-white/80 to-white/20 transition-[left,top] duration-300 ease-out"
              style={{ left: `${pct}%`, top: `${yPct}%`, bottom: 0 }}
            />
            <span
              aria-hidden
              className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ff6a55] bg-[#1a0d0b] shadow-[0_0_0_4px_rgba(255,90,69,0.14),0_0_16px_rgba(255,90,69,0.9)] transition-[left,top] duration-300 ease-out"
              style={{ left: `${pct}%`, top: `${yPct}%` }}
            />
            <div
              className="pointer-events-none absolute whitespace-nowrap leading-tight transition-[left,right,top] duration-300 ease-out"
              style={{
                top: `max(0px, calc(${yPct}% - 48px))`,
                ...(pct > 60
                  ? { right: `calc(${100 - pct}% + 12px)`, textAlign: "right" as const }
                  : { left: `calc(${pct}% + 12px)` }),
              }}
            >
              <p className="text-[10px] capitalize text-muted-foreground">{nomeDoDia}</p>
              <p className="font-display text-[19px] font-medium tabular-nums text-[#ff8a72]">
                {serie[k] ?? 0}
              </p>
            </div>
          </div>
        </div>
        {/* tiques e dias */}
        <div className="ml-6 mt-1.5 flex h-2.5 items-end justify-between" aria-hidden>
          {Array.from({ length: (DIAS - 1) * 4 + 1 }, (_, t) => (
            <i
              key={t}
              className={cn(
                "block w-px",
                t === k * 4
                  ? "h-full bg-white"
                  : t % 4 === 0
                    ? "h-full bg-white/25"
                    : "h-[65%] bg-white/[0.12]",
              )}
            />
          ))}
        </div>
        <div className="relative ml-6 mt-1 h-3.5 text-[9.5px] tabular-nums" aria-hidden>
          {hoje !== null &&
            Array.from({ length: DIAS }, (_, n) => (
              <span
                key={n}
                className={cn(
                  "absolute -translate-x-1/2 transition-colors duration-200",
                  n === k ? "font-semibold text-foreground" : "text-ink-3",
                  n % 2 === (DIAS - 1) % 2 ? "" : "hidden sm:inline",
                )}
                style={{ left: `${(n / (DIAS - 1)) * 100}%` }}
              >
                {String(new Date(hoje - (DIAS - 1 - n) * DIA_MS).getDate()).padStart(2, "0")}
              </span>
            ))}
        </div>
      </div>
    </section>
  );
}
