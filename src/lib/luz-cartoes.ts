/**
 * "Magic Card" (Magic UI) feito à mão, sem biblioteca: ao passar o mouse num cartão, uma luz
 * suave segue o ponteiro por dentro e acende a borda em vermelho HOST perto dele.
 * Um ouvinte só para a página toda (não um por cartão); o visual fica em src/styles.css
 * ([data-luz]). Só em mouse de verdade (celular não tem "passar por cima") e sem "reduzir movimento".
 */
const SELETOR = ".page-main :is(.hc, .glass, .glass-elevated, .hc-indice), .login-cartao, .menu-perfil-corpo :is(.hc, .glass, .hc-indice)";

export function instalarLuzDosCartoes() {
  if (typeof window === "undefined") return () => {};
  const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
  let atual: HTMLElement | null = null;
  let quadro = 0;
  let ultimo: PointerEvent | null = null;

  const apagar = () => {
    atual?.style.setProperty("--luz-o", "0");
    atual = null;
  };

  const aplicar = () => {
    quadro = 0;
    const e = ultimo;
    if (!e) return;
    const alvo = e.target instanceof Element ? (e.target.closest(SELETOR) as HTMLElement | null) : null;
    if (alvo !== atual) {
      apagar();
      if (alvo) {
        if (!alvo.hasAttribute("data-luz")) {
          // a luz é desenhada por cima do cartão: ele precisa ser a referência de posição
          if (getComputedStyle(alvo).position === "static") alvo.style.position = "relative";
          alvo.setAttribute("data-luz", "");
        }
        alvo.style.setProperty("--luz-o", "1");
        atual = alvo;
      }
    }
    if (atual) {
      const r = atual.getBoundingClientRect();
      atual.style.setProperty("--luz-x", `${e.clientX - r.left}px`);
      atual.style.setProperty("--luz-y", `${e.clientY - r.top}px`);
    }
  };

  const mover = (e: PointerEvent) => {
    if (!mouse.matches || semMovimento.matches || e.pointerType !== "mouse") return;
    ultimo = e;
    if (!quadro) quadro = requestAnimationFrame(aplicar);
  };
  const sair = (e: PointerEvent) => {
    if (!e.relatedTarget) apagar();
  };

  window.addEventListener("pointermove", mover, { passive: true });
  window.addEventListener("pointerout", sair);
  window.addEventListener("blur", apagar);
  return () => {
    window.removeEventListener("pointermove", mover);
    window.removeEventListener("pointerout", sair);
    window.removeEventListener("blur", apagar);
    if (quadro) cancelAnimationFrame(quadro);
  };
}
