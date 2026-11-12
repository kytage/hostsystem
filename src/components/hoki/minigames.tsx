import { useEffect, useRef, useState } from "react";
import { Bone, Timer, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { playSfx } from "@/lib/sfx";

export type Jogo = "petiscos" | "reflexo";
export interface Resultado {
  jogo: Jogo;
  /** petiscos: quantos pegou · reflexo: tempo médio em ms (menor é melhor) */
  valor: number;
}

export function HokiJogos({
  onFim,
  onClose,
}: {
  onFim: (r: Resultado) => void;
  onClose: () => void;
}) {
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const opcoes = [
    {
      id: "petiscos" as const,
      nome: "Chuva de petiscos",
      desc: "Mova o HOKI e pegue o máximo em 20 segundos.",
      icon: Bone,
    },
    {
      id: "reflexo" as const,
      nome: "Reflexo de estrela",
      desc: "Clique assim que a estrela acender. São 5 rodadas.",
      icon: Zap,
    },
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogTitle>
          {jogo ? opcoes.find((o) => o.id === jogo)?.nome : "Brincar com o HOKI"}
        </DialogTitle>
        {!jogo && (
          <div className="grid gap-2">
            {opcoes.map((o) => (
              <button
                key={o.id}
                onClick={() => setJogo(o.id)}
                className="glass surface-hover flex items-center gap-3 rounded-2xl p-4 text-left"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-red-200">
                  <o.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{o.nome}</span>
                  <span className="block text-xs text-muted-foreground">{o.desc}</span>
                </span>
              </button>
            ))}
            <p className="text-[11px] text-ink-3">
              Cada partida gasta um pouco de energia e rende carinho (e recordes).
            </p>
          </div>
        )}
        {jogo === "petiscos" && <Petiscos onFim={(valor) => onFim({ jogo: "petiscos", valor })} />}
        {jogo === "reflexo" && <Reflexo onFim={(valor) => onFim({ jogo: "reflexo", valor })} />}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Chuva de petiscos ---------------- */

interface Item {
  id: number;
  x: number;
  y: number;
  v: number;
  emoji: string;
}
const DURACAO = 20;
const EMOJIS = ["🦴", "🍖", "🥩", "🍪"];

function Petiscos({ onFim }: { onFim: (pontos: number) => void }) {
  const area = useRef<HTMLDivElement>(null);
  const dados = useRef({ itens: [] as Item[], cesto: 50, pontos: 0, proximo: 0, id: 0 });
  const [, redesenhar] = useState(0);
  const [resta, setResta] = useState(DURACAO);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    let raf = 0;
    const inicio = performance.now();
    let antes = inicio;
    const quadro = (agora: number) => {
      const d = dados.current;
      const dt = Math.min(0.05, (agora - antes) / 1000);
      antes = agora;
      const passou = (agora - inicio) / 1000;
      if (passou >= DURACAO) {
        setResta(0);
        setFim(true);
        playSfx("complete");
        return;
      }
      if (agora >= d.proximo) {
        d.proximo = agora + 620 - passou * 14;
        d.itens.push({
          id: d.id++,
          x: 6 + Math.random() * 88,
          y: -8,
          v: 34 + passou * 2.2 + Math.random() * 14,
          emoji: EMOJIS[d.id % EMOJIS.length] ?? "🦴",
        });
      }
      d.itens = d.itens.filter((it) => {
        it.y += it.v * dt;
        if (it.y > 80 && it.y < 94 && Math.abs(it.x - d.cesto) < 11) {
          d.pontos++;
          playSfx("check");
          return false;
        }
        return it.y < 104;
      });
      setResta(Math.ceil(DURACAO - passou));
      redesenhar((n) => n + 1);
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  const mover = (clientX: number) => {
    const r = area.current?.getBoundingClientRect();
    if (r) dados.current.cesto = Math.max(7, Math.min(93, ((clientX - r.left) / r.width) * 100));
  };
  const d = dados.current;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Timer className="size-3.5" /> {resta}s
        </span>
        <span className="font-display text-base font-semibold tabular-nums text-foreground">
          {d.pontos} petiscos
        </span>
      </div>
      <div
        ref={area}
        onPointerMove={(e) => mover(e.clientX)}
        onPointerDown={(e) => mover(e.clientX)}
        className="glass-inset relative h-[300px] touch-none select-none overflow-hidden rounded-2xl"
      >
        {d.itens.map((it) => (
          <span
            key={it.id}
            className="absolute -translate-x-1/2 text-2xl"
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
          >
            {it.emoji}
          </span>
        ))}
        <span
          className="absolute bottom-2 -translate-x-1/2 text-4xl transition-[left] duration-75"
          style={{ left: `${d.cesto}%` }}
        >
          🐶
        </span>
        {fim && (
          <div className="pf-fade absolute inset-0 grid place-items-center bg-black/70 text-center">
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums">{d.pontos}</p>
              <p className="text-sm text-muted-foreground">petiscos pegos</p>
              <button
                onClick={() => onFim(d.pontos)}
                className="mt-4 h-10 rounded-full bg-primary px-5 text-sm font-semibold text-white"
              >
                Pegar recompensa
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        Passe o mouse ou arraste o dedo para mover o HOKI.
      </p>
    </div>
  );
}

/* ---------------- Reflexo de estrela ---------------- */

const RODADAS = 5;

function Reflexo({ onFim }: { onFim: (mediaMs: number) => void }) {
  const [fase, setFase] = useState<"espera" | "agora" | "cedo">("espera");
  const [tempos, setTempos] = useState<number[]>([]);
  const acendeu = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acabou = tempos.length >= RODADAS;
  const media = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;

  useEffect(() => {
    if (acabou || fase !== "espera") return;
    timer.current = setTimeout(
      () => {
        acendeu.current = performance.now();
        setFase("agora");
      },
      900 + Math.random() * 2200,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fase, acabou, tempos.length]);

  const clicar = () => {
    if (acabou) return;
    if (fase === "agora") {
      playSfx("check");
      setTempos((t) => [...t, Math.round(performance.now() - acendeu.current)]);
      setFase("espera");
    } else if (fase === "espera") {
      if (timer.current) clearTimeout(timer.current);
      playSfx("uncheck");
      setFase("cedo");
      setTimeout(() => setFase("espera"), 900);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Rodada {Math.min(RODADAS, tempos.length + 1)} de {RODADAS}
        </span>
        <span className="tabular-nums">{tempos.length ? `média ${media} ms` : "—"}</span>
      </div>
      <button
        onPointerDown={clicar}
        disabled={acabou}
        className={cn(
          "grid h-[300px] w-full select-none place-items-center rounded-2xl border text-center transition-colors duration-100",
          fase === "agora"
            ? "border-primary bg-primary/25"
            : fase === "cedo"
              ? "border-amber-400/40 bg-amber-400/10"
              : "glass-inset border-white/[0.05]",
        )}
      >
        {acabou ? (
          <span>
            <span className="block font-display text-3xl font-semibold tabular-nums">
              {media} ms
            </span>
            <span className="block text-sm text-muted-foreground">tempo médio</span>
          </span>
        ) : (
          <span>
            <span
              className={cn(
                "block text-6xl transition-transform duration-100",
                fase === "agora" ? "scale-125" : "scale-90 opacity-30 grayscale",
              )}
            >
              ⭐
            </span>
            <span className="mt-3 block text-sm text-muted-foreground">
              {fase === "agora"
                ? "Agora!"
                : fase === "cedo"
                  ? "Cedo demais, espere a estrela."
                  : "Espere a estrela acender…"}
            </span>
          </span>
        )}
      </button>
      {acabou && (
        <button
          onClick={() => onFim(media)}
          className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white"
        >
          Pegar recompensa
        </button>
      )}
    </div>
  );
}
