import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Footprints, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { coresDe, rankingParkour, salvarPet, XP_MAX_JOGO, type HokiPet } from "@/lib/hoki";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const W = 760;
const H = 300;
const CHAO = 236;
const RAIO = 16;
const XJ = 130; // onde o HOKI fica na tela (o mundo é que corre)

interface Plataforma {
  x0: number;
  x1: number;
  y: number;
  /** caixas em cima dela (posição x do canto esquerdo e tamanho) */
  caixas: { x: number; t: number }[];
}

/** Pista sem fim: plataformas de grama com vãos entre elas e caixas para pular. Fica mais difícil com a distância. */
function novaPlataforma(anterior: Plataforma | null, dificuldade: number): Plataforma {
  if (!anterior) return { x0: -40, x1: 620, y: CHAO, caixas: [] };
  const vao = 62 + Math.random() * (46 + dificuldade * 58);
  const comprimento = 190 + Math.random() * 260;
  const y = Math.max(
    168,
    Math.min(CHAO, anterior.y + (Math.random() < 0.45 ? (Math.random() < 0.5 ? -36 : 36) : 0)),
  );
  const x0 = anterior.x1 + vao;
  const caixas: Plataforma["caixas"] = [];
  if (comprimento > 230 && Math.random() < 0.35 + dificuldade * 0.4) {
    const t = 24 + Math.random() * 12;
    caixas.push({ x: x0 + 90 + Math.random() * (comprimento - 180), t });
  }
  return { x0, x1: x0 + comprimento, y, caixas };
}

/** O jogo em si: desenha num canvas e avisa quando acaba, com a distância em metros. */
function Pista({ cor, onFim }: { cor: string; onFim: (metros: number) => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const fim = useRef(onFim);
  fim.current = onFim;
  const [fase, setFase] = useState<"pronto" | "jogando" | "fim">("pronto");
  const pular = useRef<() => void>(() => undefined);

  useEffect(() => {
    const c = tela.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    let estado: "pronto" | "jogando" | "fim" = "pronto";
    let pista: Plataforma[] = [novaPlataforma(null, 0)];
    let rolou = 0; // quanto o mundo já andou, em pixels
    let y = CHAO - RAIO;
    let vy = 0;
    let pulos = 0;
    let noChao = true;
    let antes = performance.now();
    let raf = 0;
    const metros = () => Math.floor(rolou / 20);

    const comecar = () => {
      pista = [novaPlataforma(null, 0)];
      rolou = 0;
      y = CHAO - RAIO;
      vy = 0;
      pulos = 0;
      estado = "jogando";
      setFase("jogando");
    };
    pular.current = () => {
      if (estado !== "jogando") {
        comecar();
        return;
      }
      if (pulos >= 2) return;
      vy = pulos === 0 ? -9.8 : -8.4;
      pulos++;
      noChao = false;
      playSfx("tap");
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        pular.current();
      }
    };
    window.addEventListener("keydown", tecla);

    const acabar = () => {
      estado = "fim";
      setFase("fim");
      playSfx("error");
      fim.current(metros());
    };

    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro);
      const dt = Math.min(2.2, (agora - antes) / 16.67);
      antes = agora;
      const dificuldade = Math.min(1, rolou / 9000);
      if (estado === "jogando") {
        const vel = (4.3 + dificuldade * 4.4) * dt;
        rolou += vel;
        vy += 0.52 * dt;
        y += vy * dt;
        // a pista continua sempre à frente e some atrás
        while ((pista[pista.length - 1]?.x1 ?? 0) - rolou < W + 300)
          pista.push(novaPlataforma(pista[pista.length - 1] ?? null, dificuldade));
        while (pista.length > 2 && (pista[0]?.x1 ?? 0) - rolou < -200) pista.shift();
        const xMundo = rolou + XJ;
        noChao = false;
        for (const p of pista) {
          // pousa em cima da plataforma (só vindo de cima)
          if (
            xMundo > p.x0 - 6 &&
            xMundo < p.x1 + 6 &&
            vy >= 0 &&
            y + RAIO >= p.y &&
            y + RAIO <= p.y + 20 + vy * dt
          ) {
            y = p.y - RAIO;
            vy = 0;
            pulos = 0;
            noChao = true;
          }
          for (const k of p.caixas)
            if (
              xMundo + RAIO - 4 > k.x &&
              xMundo - RAIO + 4 < k.x + k.t &&
              y + RAIO - 3 > p.y - k.t
            )
              acabar();
        }
        if (y > H + 60) acabar();
      }

      // ---- desenho ----
      g.fillStyle = "#08080a";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 26; i++) {
        const sx = ((((i * 97 - rolou * 0.25) % (W + 40)) + W + 40) % (W + 40)) - 20;
        g.fillRect(sx, 30 + ((i * 53) % 120), 2, 2);
      }
      for (const p of pista) {
        const x0 = p.x0 - rolou;
        const larg = p.x1 - p.x0;
        g.fillStyle = "#3b2a1c";
        g.fillRect(x0, p.y + 8, larg, H - p.y);
        g.fillStyle = "#5fb548";
        g.fillRect(x0, p.y, larg, 10);
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.fillRect(x0, p.y, larg, 2);
        for (const k of p.caixas) {
          g.fillStyle = "#e5231b";
          g.fillRect(k.x - rolou, p.y - k.t, k.t, k.t);
          g.fillStyle = "rgba(255,255,255,0.25)";
          g.fillRect(k.x - rolou, p.y - k.t, k.t, 3);
        }
      }
      // HOKI: capuz com orelhas na cor do pet, rosto claro e olhos
      const balanco = noChao && estado === "jogando" ? Math.sin(agora / 60) * 1.5 : 0;
      g.fillStyle = cor;
      g.beginPath();
      g.arc(XJ - 9, y - 13 + balanco, 6, 0, Math.PI * 2);
      g.arc(XJ + 9, y - 13 + balanco, 6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(XJ, y + balanco, RAIO, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f6e9d8";
      g.beginPath();
      g.arc(XJ + 2, y + 2 + balanco, 10.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111";
      g.fillRect(XJ + 1, y - 1 + balanco, 3, 4);
      g.fillRect(XJ + 7, y - 1 + balanco, 3, 4);
      // placar
      g.fillStyle = "#f4f4f5";
      g.font = "600 22px Manrope, sans-serif";
      g.textAlign = "right";
      g.fillText(`${metros()} m`, W - 18, 34);
    };
    raf = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", tecla);
    };
  }, [cor]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]">
      <canvas
        ref={tela}
        onPointerDown={() => pular.current()}
        className="block w-full cursor-pointer touch-none"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      {fase !== "jogando" && (
        <button
          type="button"
          onClick={() => pular.current()}
          data-sem-elastico
          className="absolute inset-0 grid place-items-center bg-black/55 text-center"
        >
          <span>
            <span className="block font-display text-xl font-semibold">
              {fase === "fim" ? "Fim da corrida" : "Parkour da praça"}
            </span>
            <span className="mt-1 block text-xs text-white/70">
              Espaço, seta para cima ou clique para pular (dá para pular duas vezes no ar)
            </span>
            <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black">
              {fase === "fim" ? "Correr de novo" : "Começar"}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * Parkour da praça: uma corrida de pular vãos e caixas, e o ranking de quem
 * foi mais longe. Abre pelo portal na beirada do mapa (ou pelas teclas E e R
 * quando o HOKI está perto dele).
 */
export function Parkour({
  pet,
  aba: inicial,
  onClose,
}: {
  pet: HokiPet;
  aba: "jogar" | "ranking";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [aba, setAba] = useState(inicial);
  const [ultima, setUltima] = useState<number | null>(null);
  const { data: ranking = [] } = useQuery({
    queryKey: ["hoki-parkour"],
    queryFn: rankingParkour,
    staleTime: 30_000,
  });
  const recorde = pet.recorde_parkour;

  const gravar = useMutation({
    mutationFn: (metros: number) => {
      const ganho = Math.min(XP_MAX_JOGO, Math.floor(metros / 25));
      return salvarPet(pet, {
        recorde_parkour: Math.max(pet.recorde_parkour, metros),
        xp: pet.xp + ganho,
      }).then((novo) => ({ novo, ganho, metros }));
    },
    onSuccess: ({ novo, ganho, metros }) => {
      qc.setQueryData(["hoki-meu"], novo);
      void qc.invalidateQueries({ queryKey: ["hoki-parkour"] });
      void qc.invalidateQueries({ queryKey: ["hoki-ranking"] });
      if (metros > recorde) {
        playSfx("complete");
        toast.success(`Novo recorde no parkour: ${metros} m!${ganho ? ` +${ganho} XP.` : ""}`);
      } else if (ganho) toast.success(`${metros} m no parkour. +${ganho} XP.`);
    },
    onError: () => toast.error("Não foi possível gravar a corrida."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex w-[calc(100vw-1.5rem)] max-w-[820px] flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.07] px-5 py-3.5 pr-14">
          <span className="icone-quadro size-10">
            <Footprints className="size-[18px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">
              Parkour
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Seu recorde: <b className="font-semibold text-foreground">{recorde} m</b>
              {ultima !== null ? ` · última corrida: ${ultima} m` : ""}
            </p>
          </div>
          <div className="segmentos" role="tablist" aria-label="O que mostrar">
            <button
              type="button"
              role="tab"
              aria-selected={aba === "jogar"}
              onClick={() => setAba("jogar")}
              data-sem-elastico
            >
              Jogar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === "ranking"}
              onClick={() => setAba("ranking")}
              data-sem-elastico
            >
              Ranking
            </button>
          </div>
        </div>

        <div className="p-4">
          {aba === "jogar" ? (
            <Pista
              cor={coresDe(pet.visual).principal}
              onFim={(m) => {
                setUltima(m);
                if (m > 0) gravar.mutate(m);
              }}
            />
          ) : ranking.length === 0 ? (
            <p className="glass-inset rounded-2xl border px-4 py-10 text-center text-sm text-muted-foreground">
              Ninguém correu ainda. Seja o primeiro do ranking!
            </p>
          ) : (
            <ol className="space-y-1.5">
              {ranking.map((r, i) => (
                <li
                  key={r.user_id}
                  className={cn(
                    "glass-inset flex items-center gap-3 rounded-2xl border px-3 py-2",
                    r.user_id === pet.user_id && "!border-white/35",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums",
                      i === 0 ? "bg-white text-black" : "bg-white/[0.08] text-foreground/80",
                    )}
                  >
                    {i === 0 ? <Trophy className="size-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-medium">{r.nome}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.username || "staff"}
                    </span>
                  </span>
                  <span className="font-display text-[15px] font-semibold tabular-nums">
                    {r.recorde_parkour} m
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
