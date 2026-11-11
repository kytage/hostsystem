import { useEffect, useRef, useState } from "react";
import { Flag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  classificar,
  COMPRIMENTO,
  distanciaDoRobo,
  KMH_MAX,
  MEIA_PISTA,
  ROBOS,
  SEG,
  tempoCurto,
  tempoDoRobo,
  TOTAL,
  TRECHOS,
  VEL_MAX,
  VOLTAS,
  type Piloto,
} from "@/lib/hoki-corrida";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/**
 * Corrida de kart da praça: a pista aparece em perspectiva, vista de trás do
 * kart. W acelera, S freia, A e D viram. São 3 voltas. Cada jogador corre no
 * próprio computador e manda a sua posição algumas vezes por segundo; os
 * outros karts aparecem na pista conforme essas posições (sem batida).
 */
const L = 960;
const A = 540;
const CAMERA_ALTURA = 1100;
const CAMERA_FUNDO = 0.84; // 1 / tan(campo de visão / 2)
const VISAO = 170; // quantos pedaços da pista são desenhados à frente
const N = TRECHOS.length;

interface Outro {
  nome: string;
  cor: string;
  d: number;
  v: number;
  x: number;
  /** Quando esta posição chegou (relógio local). */
  em: number;
  fim?: number;
}

export function Corrida({
  id,
  largada,
  eu,
  onClose,
}: {
  /** Identificação da corrida (o canal dela). */
  id: string;
  /** Hora da largada (relógio local, em ms): antes dela roda a contagem 3-2-1. */
  largada: number;
  eu: { id: string; nome: string; cor: string };
  onClose: () => void;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [resultado, setResultado] = useState<Piloto[] | null>(null);
  const [meuTempo, setMeuTempo] = useState<number | null>(null);

  useEffect(() => {
    const cv = tela.current;
    const c = cv?.getContext("2d");
    if (!cv || !c) return;
    let vivo = true;

    // ---- estado do meu kart ----
    let d = 0; // distância total andada
    let x = 0; // posição de lado (-1 a 1 é dentro do asfalto)
    let v = 0;
    let terminei: number | null = null;
    const teclas = new Set<string>();
    const outros = new Map<string, Outro>();
    const temposDosRobos = ROBOS.map((_, i) => tempoDoRobo(i) * 1000);
    let contagemTocada = 4;

    // ---- rede: um canal só desta corrida, com a posição de cada um ----
    const canal = supabase.channel(`hoki-corrida-${id}`, {
      config: { broadcast: { self: false } },
    });
    canal.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as Partial<Outro> & { id?: unknown };
      if (typeof p.id !== "string" || p.id === eu.id || typeof p.d !== "number") return;
      outros.set(p.id, {
        nome: String(p.nome ?? "piloto").slice(0, 24),
        cor: typeof p.cor === "string" && /^#[0-9a-f]{6}$/i.test(p.cor) ? p.cor : "#e5231b",
        d: Math.max(0, Math.min(TOTAL, p.d)),
        v: typeof p.v === "number" ? Math.max(0, Math.min(VEL_MAX, p.v)) : 0,
        x: typeof p.x === "number" ? Math.max(-2, Math.min(2, p.x)) : 0,
        em: performance.now(),
        ...(typeof p.fim === "number" ? { fim: p.fim } : {}),
      });
    });
    let ligado = false;
    canal.subscribe((s) => (ligado = s === "SUBSCRIBED"));
    const enviar = () => {
      if (!ligado) return;
      void canal.send({
        type: "broadcast",
        event: "pos",
        payload: {
          id: eu.id,
          nome: eu.nome,
          cor: eu.cor,
          d,
          v,
          x,
          ...(terminei !== null ? { fim: terminei } : {}),
        },
      });
    };
    const batida = window.setInterval(enviar, 400);

    // ---- teclado ----
    const tecla = (e: KeyboardEvent, baixo: boolean) => {
      const k = e.key.toLowerCase();
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
        return;
      e.preventDefault();
      if (baixo) teclas.add(k);
      else teclas.delete(k);
    };
    const aoBaixar = (e: KeyboardEvent) => tecla(e, true);
    const aoSoltar = (e: KeyboardEvent) => tecla(e, false);
    window.addEventListener("keydown", aoBaixar);
    window.addEventListener("keyup", aoSoltar);

    /** Onde cada outro piloto está agora (estica a última posição recebida pela velocidade dele). */
    const distanciaDe = (o: Outro) =>
      o.fim !== undefined
        ? TOTAL
        : Math.min(TOTAL, o.d + (o.v * (performance.now() - o.em)) / 1000);

    const pilotos = (s: number): Piloto[] => [
      {
        id: eu.id,
        nome: eu.nome,
        cor: eu.cor,
        d,
        eu: true,
        ...(terminei !== null ? { fim: terminei } : {}),
      },
      ...[...outros.entries()].map(([oid, o]) => ({
        id: oid,
        nome: o.nome,
        cor: o.cor,
        d: distanciaDe(o),
        ...(o.fim !== undefined ? { fim: o.fim } : {}),
      })),
      ...ROBOS.map((r, i) => ({
        id: r.id,
        nome: r.nome,
        cor: r.cor,
        d: Math.min(TOTAL, distanciaDoRobo(i, s)),
        robo: true,
        ...(s * 1000 >= temposDosRobos[i]! ? { fim: temposDosRobos[i]! } : {}),
      })),
    ];

    // ---- desenho ----
    const projeta = (mx: number, my: number, mz: number, camX: number, camY: number) => {
      const escala = CAMERA_FUNDO / mz;
      return {
        x: Math.round(L / 2 + escala * (mx - camX) * (L / 2)),
        y: Math.round(A / 2 - escala * (my - camY) * (A / 2)),
        w: Math.round(escala * MEIA_PISTA * (L / 2)),
        escala,
      };
    };
    const quadrilatero = (
      x1: number,
      y1: number,
      w1: number,
      x2: number,
      y2: number,
      w2: number,
      cor: string,
    ) => {
      c.fillStyle = cor;
      c.beginPath();
      c.moveTo(x1 - w1, y1);
      c.lineTo(x2 - w2, y2);
      c.lineTo(x2 + w2, y2);
      c.lineTo(x1 + w1, y1);
      c.closePath();
      c.fill();
    };
    /** Kart visto de trás: rodas, corpo na cor do piloto e a cabeça do HOKI com as orelhas. */
    const kart = (cx: number, base: number, larg: number, cor: string, vira = 0, nome = "") => {
      const u = larg / 100;
      c.save();
      c.translate(cx, base);
      c.rotate(vira * 0.06);
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath();
      c.ellipse(0, -2 * u, 52 * u, 9 * u, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#17171a";
      for (const lado of [-1, 1]) c.fillRect(lado * 46 * u - 9 * u, -26 * u, 18 * u, 24 * u);
      c.fillStyle = cor;
      c.beginPath();
      c.roundRect(-38 * u, -40 * u, 76 * u, 30 * u, 8 * u);
      c.fill();
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(-38 * u, -18 * u, 76 * u, 8 * u);
      // lanternas
      c.fillStyle = "#ffd27a";
      for (const lado of [-1, 1]) c.fillRect(lado * 26 * u - 5 * u, -34 * u, 10 * u, 6 * u);
      // HOKI ao volante: cabeça redonda com duas orelhas
      c.fillStyle = cor;
      for (const lado of [-1, 1]) {
        c.beginPath();
        c.arc(lado * 15 * u, -74 * u, 8 * u, 0, Math.PI * 2);
        c.fill();
      }
      c.beginPath();
      c.arc(0, -58 * u, 20 * u, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.22)";
      c.beginPath();
      c.arc(-6 * u, -64 * u, 7 * u, 0, Math.PI * 2);
      c.fill();
      c.restore();
      if (nome && larg > 26) {
        c.font = `600 ${Math.max(9, Math.min(13, larg * 0.16))}px Inter, sans-serif`;
        c.textAlign = "center";
        c.fillStyle = "rgba(0,0,0,0.6)";
        const w = c.measureText(nome).width + 10;
        c.fillRect(cx - w / 2, base - larg * 0.98 - 14, w, 15);
        c.fillStyle = "#fff";
        c.fillText(nome, cx, base - larg * 0.98 - 3);
      }
    };
    /** Árvore de beira de pista, em blocos (copa verde e tronco). */
    const arvore = (cx: number, base: number, alt: number, tom: number) => {
      c.fillStyle = "#7a4a26";
      c.fillRect(cx - alt * 0.06, base - alt * 0.4, alt * 0.12, alt * 0.4);
      c.fillStyle = tom ? "#3f9e45" : "#57b84c";
      c.fillRect(cx - alt * 0.3, base - alt, alt * 0.6, alt * 0.62);
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(cx - alt * 0.3, base - alt, alt * 0.6, alt * 0.14);
    };

    let antes = performance.now();
    let raf = 0;
    const quadro = (agora: number) => {
      if (!vivo) return;
      raf = requestAnimationFrame(quadro);
      const dt = Math.min(0.05, (agora - antes) / 1000);
      antes = agora;
      const s = (Date.now() - largada) / 1000; // segundos desde a largada (negativo = contagem)
      const correndo = s >= 0 && terminei === null;

      // contagem: um bipe por segundo e o apito na largada
      const falta = Math.ceil(-s);
      if (falta < contagemTocada && falta >= 0 && falta <= 3) {
        contagemTocada = falta;
        playSfx(falta === 0 ? "apito" : "tique");
      }

      // ---- física ----
      const vira =
        (teclas.has("a") || teclas.has("arrowleft") ? -1 : 0) +
        (teclas.has("d") || teclas.has("arrowright") ? 1 : 0);
      const trecho = TRECHOS[Math.floor(d / SEG) % N]!;
      const ritmo = v / VEL_MAX;
      if (correndo) {
        const acelera = teclas.has("w") || teclas.has("arrowup");
        const freia = teclas.has("s") || teclas.has("arrowdown");
        v += (acelera ? VEL_MAX / 3.2 : freia ? -VEL_MAX / 1.2 : -VEL_MAX / 6) * dt;
        x += vira * dt * 2.1 * ritmo;
        // a curva empurra o kart para fora
        x -= dt * 2.1 * ritmo * ritmo * trecho.curva * 0.22;
        // fora do asfalto perde velocidade
        if (Math.abs(x) > 1 && v > VEL_MAX / 3.2) v -= (VEL_MAX / 1.1) * dt;
        x = Math.max(-2.2, Math.min(2.2, x));
        v = Math.max(0, Math.min(VEL_MAX, v));
        d += v * dt;
        if (d >= TOTAL) {
          d = TOTAL;
          terminei = Math.round(s * 1000);
          playSfx("vitoria");
          enviar();
          setMeuTempo(terminei);
          setResultado(classificar(pilotos(s)));
        }
      } else if (terminei !== null) {
        v = Math.max(0, v - (VEL_MAX / 2) * dt);
      }
      // todo mundo terminou (ou eu terminei há um tempo): mostra o resultado
      if (terminei !== null && Math.floor(agora / 500) !== Math.floor((agora - dt * 1000) / 500))
        setResultado(classificar(pilotos(s)));

      // ---- cenário ----
      const pos = d % COMPRIMENTO;
      const baseI = Math.floor(pos / SEG);
      const resto = (pos % SEG) / SEG;
      const base = TRECHOS[baseI % N]!;
      const alturaDoKart = base.y1 + (base.y2 - base.y1) * resto;
      // céu, sol e morros ao fundo (os morros deslizam um pouco com as curvas)
      const ceu = c.createLinearGradient(0, 0, 0, A * 0.6);
      ceu.addColorStop(0, "#2b6fd6");
      ceu.addColorStop(0.6, "#7fc4ff");
      ceu.addColorStop(1, "#d9f1ff");
      c.fillStyle = ceu;
      c.fillRect(0, 0, L, A);
      c.fillStyle = "#fff6c9";
      c.beginPath();
      c.arc(L * 0.78, A * 0.2, 34, 0, Math.PI * 2);
      c.fill();
      const desliza = ((d / 900) % L) * (base.curva >= 0 ? 1 : 1);
      for (const [cor, alt, passo, fator] of [
        ["#8fb7e8", 110, 260, 0.25],
        ["#5f9bd6", 80, 180, 0.5],
      ] as const) {
        c.fillStyle = cor;
        for (let k = -1; k < L / passo + 2; k++) {
          const mx = k * passo - ((desliza * fator) % passo);
          c.beginPath();
          c.moveTo(mx, A * 0.56);
          c.lineTo(mx + passo * 0.5, A * 0.56 - alt * (0.6 + 0.4 * Math.abs(Math.sin(k * 1.7))));
          c.lineTo(mx + passo, A * 0.56);
          c.fill();
        }
      }
      c.fillStyle = "#58b34b";
      c.fillRect(0, A * 0.56, L, A * 0.44);

      // ---- pista: do pedaço mais perto ao mais longe, guardando onde cada um ficou na tela ----
      let acumX = 0;
      let dx = -(base.curva * resto);
      let teto = A;
      const camX = x * MEIA_PISTA;
      const camY = alturaDoKart + CAMERA_ALTURA;
      const linhas: { x: number; y: number; w: number; escala: number; corte: number }[] = [];
      for (let n = 0; n < VISAO; n++) {
        const t = TRECHOS[(baseI + n) % N]!;
        const z1 = (n - resto) * SEG;
        const z2 = (n + 1 - resto) * SEG;
        const p1 = projeta(-acumX, t.y1, Math.max(z1, 1), camX, camY);
        const p2 = projeta(-acumX - dx, t.y2, Math.max(z2, 1), camX, camY);
        acumX += dx;
        dx += t.curva;
        linhas.push({ x: p1.x, y: p1.y, w: p1.w, escala: p1.escala, corte: teto });
        if (z1 <= 1 || p2.y >= teto || p2.y >= p1.y) continue;
        const faixa = Math.floor((baseI + n) / 3) % 2;
        // grama, zebra, asfalto e a linha do meio
        c.fillStyle = faixa ? "#58b34b" : "#4fa643";
        c.fillRect(0, p2.y, L, p1.y - p2.y + 1);
        quadrilatero(
          p1.x,
          p1.y,
          p1.w * 1.14,
          p2.x,
          p2.y,
          p2.w * 1.14,
          faixa ? "#f2f2f2" : "#d8281f",
        );
        quadrilatero(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, faixa ? "#41444b" : "#3b3e45");
        if (faixa) quadrilatero(p1.x, p1.y, p1.w * 0.025, p2.x, p2.y, p2.w * 0.025, "#f2f2f2");
        // faixa xadrez da largada, no começo da volta
        if ((baseI + n) % N < 2)
          for (let q = 0; q < 10; q++) {
            const a1 = -1 + (q / 10) * 2;
            const a2 = -1 + ((q + 1) / 10) * 2;
            c.fillStyle = (q + ((baseI + n) % N)) % 2 ? "#f2f2f2" : "#17171a";
            c.beginPath();
            c.moveTo(p1.x + p1.w * a1, p1.y);
            c.lineTo(p2.x + p2.w * a1, p2.y);
            c.lineTo(p2.x + p2.w * a2, p2.y);
            c.lineTo(p1.x + p1.w * a2, p1.y);
            c.fill();
          }
        teto = p2.y;
      }

      // ---- árvores e os outros karts, do mais longe para o mais perto ----
      const naPista: { n: number; resto: number; lado: number; cor: string; nome: string }[] = [];
      const colocar = (dist: number, lado: number, cor: string, nome: string) => {
        // quanto o outro está à frente de mim nesta volta (considerando a volta da pista)
        let frente = ((dist % COMPRIMENTO) - pos + COMPRIMENTO) % COMPRIMENTO;
        if (frente > COMPRIMENTO / 2) frente -= COMPRIMENTO;
        if (frente <= SEG * 0.6 || frente > (VISAO - 2) * SEG) return;
        const n = Math.floor(frente / SEG + resto);
        naPista.push({ n, resto: (frente / SEG + resto) % 1, lado, cor, nome });
      };
      for (const [, o] of outros) colocar(distanciaDe(o), o.x, o.cor, o.nome);
      ROBOS.forEach((r, i) => colocar(distanciaDoRobo(i, s), r.faixa, r.cor, r.nome));
      for (let n = VISAO - 1; n > 0; n--) {
        const l = linhas[n];
        if (!l) continue;
        const indice = (baseI + n) % N;
        if (indice % 9 === 0 && l.y < l.corte + 60) {
          const alt = Math.min(300, l.escala * 1500 * (A / 2));
          for (const lado of [-1, 1]) {
            const ax = l.x + lado * l.w * (1.7 + ((indice * 7) % 5) * 0.12);
            if (l.y <= l.corte + 2) arvore(ax, l.y, alt, (indice / 9) % 2);
          }
        }
        for (const k of naPista) {
          if (k.n !== n) continue;
          const prox = linhas[n + 1] ?? l;
          const kx = l.x + (prox.x - l.x) * k.resto + (l.w + (prox.w - l.w) * k.resto) * k.lado;
          const ky = l.y + (prox.y - l.y) * k.resto;
          const larg = (l.w + (prox.w - l.w) * k.resto) * 0.36;
          if (ky <= l.corte + 4 && larg > 3) kart(kx, ky, larg, k.cor, 0, k.nome);
        }
      }

      // ---- o meu kart (treme um pouco com a velocidade e inclina ao virar) ----
      const treme = Math.sin(agora / 40) * ritmo * 1.5;
      kart(L / 2, A - 26 + treme, 170, eu.cor, correndo ? vira : 0);

      // ---- painel: posição, volta, tempo e velocidade ----
      const ordem = classificar(pilotos(s));
      const lugar = ordem.findIndex((p) => p.eu) + 1;
      const volta = Math.min(VOLTAS, Math.floor(d / COMPRIMENTO) + 1);
      const caixa = (px: number, py: number, w: number, h: number) => {
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.beginPath();
        c.roundRect(px, py, w, h, 14);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,0.14)";
        c.lineWidth = 1;
        c.stroke();
      };
      c.textAlign = "left";
      caixa(18, 16, 150, 86);
      c.fillStyle = "#fff";
      c.font = "700 44px Manrope, Inter, sans-serif";
      c.fillText(`${lugar}º`, 32, 62);
      c.font = "500 13px Inter, sans-serif";
      c.fillStyle = "rgba(255,255,255,0.65)";
      c.fillText(`de ${ordem.length}`, 96, 60);
      c.fillStyle = "#ff8a72";
      c.font = "600 14px Inter, sans-serif";
      c.fillText(`Volta ${volta}/${VOLTAS}`, 32, 88);
      caixa(L - 178, 16, 160, 86);
      c.textAlign = "right";
      c.fillStyle = "#fff";
      c.font = "700 40px Manrope, Inter, sans-serif";
      c.fillText(String(Math.round(ritmo * KMH_MAX)), L - 66, 60);
      c.font = "500 12px Inter, sans-serif";
      c.fillStyle = "rgba(255,255,255,0.65)";
      c.fillText("km/h", L - 30, 60);
      c.fillStyle = "#ffffff";
      c.font = "600 14px Inter, sans-serif";
      c.fillText(tempoCurto(terminei ?? Math.max(0, s * 1000)), L - 30, 88);
      // barrinha da corrida inteira, com um ponto para cada piloto
      caixa(L / 2 - 180, 18, 360, 20);
      for (const p of ordem) {
        c.fillStyle = p.cor;
        c.beginPath();
        c.arc(L / 2 - 170 + (Math.min(TOTAL, p.d) / TOTAL) * 340, 28, p.eu ? 6 : 4, 0, Math.PI * 2);
        c.fill();
        if (p.eu) {
          c.strokeStyle = "#fff";
          c.lineWidth = 2;
          c.stroke();
        }
      }
      // contagem da largada
      if (s < 0.9) {
        c.textAlign = "center";
        c.font = "800 120px Manrope, Inter, sans-serif";
        c.fillStyle = "rgba(0,0,0,0.35)";
        const texto = s < 0 ? (falta > 3 ? "Preparar…" : String(falta)) : "VAI!";
        if (texto.length > 4) c.font = "800 56px Manrope, Inter, sans-serif";
        c.fillText(texto, L / 2 + 3, A / 2 + 3);
        c.fillStyle = s < 0 ? "#ffffff" : "#7dff9b";
        c.fillText(texto, L / 2, A / 2);
      }
    };
    raf = requestAnimationFrame(quadro);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      window.clearInterval(batida);
      window.removeEventListener("keydown", aoBaixar);
      window.removeEventListener("keyup", aoSoltar);
      void supabase.removeChannel(canal);
    };
  }, [id, largada, eu.id, eu.nome, eu.cor]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Corrida de kart"
      className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-3 backdrop-blur-md"
    >
      <div className="relative w-full max-w-[1280px] overflow-hidden rounded-[22px] border border-white/15 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <canvas ref={tela} width={L} height={A} className="block aspect-video w-full" />
        <button
          onClick={onClose}
          aria-label="Sair da corrida"
          title="Sair da corrida"
          className="absolute right-3 top-[112px] grid size-9 place-items-center rounded-xl border border-white/15 bg-black/70 text-white/80 backdrop-blur-md hover:text-white"
        >
          <X className="size-4" />
        </button>
        {meuTempo === null && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11.5px] text-white/80 backdrop-blur-md">
            <b>W</b> acelera · <b>S</b> freia · <b>A</b> e <b>D</b> viram
          </p>
        )}
        {meuTempo !== null && resultado && (
          <div className="pf-pop absolute left-1/2 top-1/2 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0d0d0d]/95 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <Flag className="size-4 text-[#ff6a57]" /> Chegada
              <span className="ml-auto font-display tabular-nums text-white/70">
                {tempoCurto(meuTempo)}
              </span>
            </p>
            <ol className="mt-3 space-y-1">
              {resultado.map((p, i) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px]",
                    p.eu ? "bg-white/[0.1]" : "bg-white/[0.03]",
                  )}
                >
                  <span className="w-6 font-display font-semibold tabular-nums">{i + 1}º</span>
                  <span className="size-2.5 rounded-full" style={{ background: p.cor }} />
                  <span className="min-w-0 flex-1 truncate">
                    {p.nome}
                    {p.robo && <span className="ml-1 text-white/40">robô</span>}
                  </span>
                  <span className="tabular-nums text-white/65">
                    {p.fim !== undefined ? tempoCurto(p.fim) : "correndo…"}
                  </span>
                </li>
              ))}
            </ol>
            <button
              onClick={onClose}
              className="mt-3 h-9 w-full rounded-full bg-white text-[12.5px] font-semibold text-black"
            >
              Voltar para a praça
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
