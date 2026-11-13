/**
 * Rolagem macia da área das páginas (.page-main): cada clique da roda do mouse
 * vira um deslizar curto que freia sozinho. Touchpad, teclado, barra de
 * rolagem e telas de toque continuam do jeito normal do navegador (já são
 * macios), e áreas com rolagem própria dentro da página (tabelas, listas,
 * janelas) também.
 */

const SUAVIDADE = 11; // quanto maior, mais rápido chega no destino (1/s)

/** Parece uma roda de mouse (degraus grandes e redondos) e não um touchpad? */
const ehRoda = (e: WheelEvent) =>
  e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY) && e.deltaX === 0);

/** Algum elemento entre o alvo e a página rola sozinho nessa direção? */
function rolaPorDentro(alvo: Element | null, pagina: HTMLElement, dy: number) {
  for (let el = alvo; el && el !== pagina; el = el.parentElement) {
    if (el instanceof HTMLCanvasElement) return true;
    const s = getComputedStyle(el);
    if (!/(auto|scroll)/.test(s.overflowY)) continue;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 1) continue;
    if ((dy > 0 && el.scrollTop < max - 1) || (dy < 0 && el.scrollTop > 0)) return true;
  }
  return false;
}

export function instalarRolagemSuave() {
  if (typeof window === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  let pagina: HTMLElement | null = null;
  let alvo = 0;
  let quadro = 0;
  let ultimo = 0;

  const passo = (agora: number) => {
    if (!pagina || !pagina.isConnected) {
      quadro = 0;
      return;
    }
    const dt = Math.min(0.05, (agora - ultimo) / 1000 || 0.016);
    ultimo = agora;
    const atual = pagina.scrollTop;
    const falta = alvo - atual;
    if (Math.abs(falta) < 0.5) {
      pagina.scrollTop = alvo;
      quadro = 0;
      return;
    }
    pagina.scrollTop = atual + falta * (1 - Math.exp(-SUAVIDADE * dt));
    quadro = requestAnimationFrame(passo);
  };

  const aoRolar = (e: WheelEvent) => {
    if (e.defaultPrevented || e.ctrlKey || !ehRoda(e)) return;
    const el = (e.target as Element | null)?.closest?.(".page-main") as HTMLElement | null;
    if (!el || rolaPorDentro(e.target as Element, el, e.deltaY)) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    e.preventDefault();
    if (el !== pagina || !quadro) {
      pagina = el;
      alvo = el.scrollTop;
    }
    const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    alvo = Math.max(0, Math.min(max, alvo + delta * 1.1));
    if (!quadro) {
      ultimo = performance.now();
      quadro = requestAnimationFrame(passo);
    }
  };
  // arrastou a barra, usou o teclado ou o touchpad no meio do caminho: para e segue de onde está
  const aoMexer = () => {
    if (quadro) {
      cancelAnimationFrame(quadro);
      quadro = 0;
    }
  };

  window.addEventListener("wheel", aoRolar, { passive: false });
  window.addEventListener("keydown", aoMexer);
  window.addEventListener("pointerdown", aoMexer);
  window.addEventListener("touchstart", aoMexer, { passive: true });
  return () => {
    window.removeEventListener("wheel", aoRolar);
    window.removeEventListener("keydown", aoMexer);
    window.removeEventListener("pointerdown", aoMexer);
    window.removeEventListener("touchstart", aoMexer);
    if (quadro) cancelAnimationFrame(quadro);
  };
}
