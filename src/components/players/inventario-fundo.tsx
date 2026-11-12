import { useEffect, useRef, type RefObject } from "react";

/** Profundidade da malha: a borda de longe fica 1,9 vez menor que a de perto. */
const LONGE = 1.9;

/**
 * Malha de holograma: uma rede de linhas finas vista de cima, ondulando devagar, que se
 * levanta onde está o mouse. Desenhada num canvas 2D (sem biblioteca). Parada com
 * "reduzir movimento"; no toque só ondula; com o mouse quieto desenha a 30 quadros.
 */
function useMalha(ref: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const comMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let nx = 46;
    let nz = 24;
    let px = new Float32Array(0);
    let py = new Float32Array(0);
    const medir = () => {
      const r = cv.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      const pequeno = w < 768;
      nx = pequeno ? 26 : 46;
      nz = pequeno ? 15 : 24;
      px = new Float32Array(nx * nz);
      py = new Float32Array(nx * nz);
    };

    // borda de perto a 74% da altura, borda de longe a 16%; meia largura de 46% da tela
    const geometria = () => {
      const perto = h * 0.74;
      const K = (perto - h * 0.16) / (1 - 1 / LONGE);
      return { cx: w / 2, topo: perto - K, K, meia: w * 0.46, alt: h * 0.11 };
    };

    let alvoU = 0;
    let alvoV = 0.5;
    let u = 0;
    let v = 0.5;
    let alvoForca = 0;
    let forca = 0;
    let gx = 0;
    let gy = 0;
    let alvoGx = 0;
    let alvoGy = 0;
    let ultimoMovimento = 0;
    let ultimoQuadro = 0;
    let raf = 0;
    const inicio = performance.now();

    // altura de cada ponto: ondas lentas + bordas levantadas + o morro que segue o mouse
    const altura = (uu: number, vv: number, t: number) => {
      const onda =
        0.16 * Math.sin(uu * 3 + t * 0.5) * Math.cos(vv * 4 - t * 0.33) +
        0.07 * Math.sin((uu * 1.3 + vv) * 6 - t * 0.7);
      const bordas = 0.5 * Math.abs(uu) ** 3;
      const du = uu - u;
      const dv = (vv - v) * 1.5;
      return onda + bordas + forca * 1.05 * Math.exp(-(du * du + dv * dv) / 0.06);
    };

    const desenhar = (agora: number) => {
      const t = parado ? 0 : (agora - inicio) / 1000;
      const { cx, topo, K, meia, alt } = geometria();
      for (let j = 0; j < nz; j++) {
        const vv = j / (nz - 1);
        const z = 1 + (LONGE - 1) * vv;
        for (let i = 0; i < nx; i++) {
          const uu = (i / (nx - 1)) * 2 - 1;
          const k = j * nx + i;
          px[k] = cx + (meia * uu) / z;
          py[k] = topo + (K - alt * altura(uu, vv, t)) / z;
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const brilho = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.34);
      brilho.addColorStop(0, `rgba(255, 86, 74, ${(0.18 + 0.52 * forca).toFixed(3)})`);
      brilho.addColorStop(0.45, "rgba(255, 255, 255, 0.15)");
      brilho.addColorStop(1, "rgba(255, 255, 255, 0.07)");
      ctx.strokeStyle = brilho;
      ctx.lineWidth = 0.8;
      // linhas de lado a lado, mais fracas no fundo
      for (let j = 0; j < nz; j++) {
        ctx.globalAlpha = 1 - (j / (nz - 1)) * 0.75;
        ctx.beginPath();
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (i === 0) ctx.moveTo(px[k] ?? 0, py[k] ?? 0);
          else ctx.lineTo(px[k] ?? 0, py[k] ?? 0);
        }
        ctx.stroke();
      }
      // linhas da frente para o fundo, mais fracas nas pontas
      for (let i = 0; i < nx; i++) {
        const uu = Math.abs((i / (nx - 1)) * 2 - 1);
        ctx.globalAlpha = 1 - uu * uu * 0.8;
        ctx.beginPath();
        for (let j = 0; j < nz; j++) {
          const k = j * nx + i;
          if (j === 0) ctx.moveTo(px[k] ?? 0, py[k] ?? 0);
          else ctx.lineTo(px[k] ?? 0, py[k] ?? 0);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro);
      const quieto = agora - ultimoMovimento > 700;
      if (quieto && agora - ultimoQuadro < 33) return;
      ultimoQuadro = agora;
      u += (alvoU - u) * 0.1;
      v += (alvoV - v) * 0.1;
      forca += (alvoForca - forca) * 0.07;
      gx += (alvoGx - gx) * 0.14;
      gy += (alvoGy - gy) * 0.14;
      desenhar(agora);
    };

    const mover = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      ultimoMovimento = performance.now();
      alvoGx = mx;
      alvoGy = my;
      const { cx, topo, K, meia } = geometria();
      if (my - topo <= 0) {
        alvoForca = 0;
        return;
      }
      // ponto da malha que fica embaixo do mouse
      const z = K / (my - topo);
      const vv = (z - 1) / (LONGE - 1);
      const uu = ((mx - cx) * z) / meia;
      alvoU = Math.max(-1.3, Math.min(1.3, uu));
      alvoV = Math.max(-0.3, Math.min(1.3, vv));
      const fora = Math.max(0, Math.abs(uu) - 1, -vv, vv - 1);
      alvoForca = Math.max(0, 1 - fora * 2.5);
    };
    const sair = () => {
      alvoForca = 0;
    };

    medir();
    gx = alvoGx = w / 2;
    gy = alvoGy = h * 0.45;
    const obs = new ResizeObserver(() => {
      medir();
      if (parado) desenhar(0);
    });
    obs.observe(cv);
    if (parado) {
      desenhar(0);
      return () => obs.disconnect();
    }
    if (comMouse) {
      window.addEventListener("pointermove", mover, { passive: true });
      document.documentElement.addEventListener("pointerleave", sair);
    }
    raf = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("pointermove", mover);
      document.documentElement.removeEventListener("pointerleave", sair);
    };
  }, [ref]);
}

/** Fundo do inventário: preto, um gradiente vermelho bem fraco no topo e a malha de holograma. */
export function InventarioFundo() {
  const malhaRef = useRef<HTMLCanvasElement>(null);
  useMalha(malhaRef);
  return (
    <div className="inv-fundo" aria-hidden>
      <div className="inv-fundo-base" />
      <canvas ref={malhaRef} className="inv-malha" />
      <div className="inv-cantos" />
    </div>
  );
}
