/**
 * Movimento do painel: os marcadores que viajam.
 *
 * - Abas (`.segmentos`): a pílula da aba escolhida desliza da aba antiga para a nova.
 * - Menu lateral: o traço vermelho da página atual desliza do item antigo para o novo.
 *
 * Os dois são desenhados no `::before` do item atual (src/styles.css, "Movimento do site") e
 * viajam só por `transform`: o marcador já nasce no lugar novo, parte "vestido" do lugar antigo
 * e assenta. Nada é medido de novo a cada quadro e nenhum tamanho é animado.
 *
 * As medidas seguem as regras de movimento da skill design-taste-frontend (tasteskill 2.5):
 * um marcador viaja em 240 ms, sai e chega devagar e nunca passa do ponto. O resto do movimento
 * do painel (botões, cartões, entrada das páginas) é só CSS.
 */

const VIAGEM = 240;
const CURVA = "cubic-bezier(0.65, 0, 0.35, 1)";
/** Os jeitos que o painel usa para marcar "este é o atual". */
const ATRIBUTOS = ["data-ativo", "aria-pressed", "aria-selected", "data-state"];

function eAtual(el: Element) {
  const a = el.getAttribute("data-ativo");
  return (
    (a !== null && a !== "false") ||
    el.getAttribute("aria-pressed") === "true" ||
    el.getAttribute("aria-selected") === "true" ||
    el.getAttribute("data-state") === "active"
  );
}

/** Antes desta mudança, o atributo que mudou dizia "sou o atual"? */
function eraAtual(r: MutationRecord) {
  const v = r.oldValue;
  if (r.attributeName === "data-ativo") return v !== null && v !== "false";
  if (r.attributeName === "data-state") return v === "active";
  return v === "true";
}

/** O grupo em que o marcador viaja: a fileira de abas ou o menu lateral. */
function grupoDe(el: Element): Element | null {
  if (el.classList.contains("menu-item")) return el.closest(".menu-lateral");
  const pai = el.parentElement;
  return pai?.classList.contains("segmentos") ? pai : null;
}

function viajar(velho: Element, novo: Element) {
  const de = velho.getBoundingClientRect();
  const para = novo.getBoundingClientRect();
  if (!de.width || !de.height || !para.width || !para.height) return;
  const dx = de.left - para.left;
  const dy = de.top - para.top;
  // o traço do menu tem sempre o mesmo tamanho; a pílula das abas veste o tamanho da aba antiga
  const parte = novo.classList.contains("menu-item")
    ? `translate(${dx}px, ${dy}px)`
    : `translate(${dx}px, ${dy}px) scale(${de.width / para.width}, ${de.height / para.height})`;
  try {
    novo.animate([{ transform: parte }, { transform: "none" }], {
      duration: VIAGEM,
      easing: CURVA,
      pseudoElement: "::before",
    });
  } catch {
    // navegador sem animação em pseudo-elemento: o marcador só troca de lugar
  }
}

export function instalarMovimento() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return () => {};
  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

  const observador = new MutationObserver((lista) => {
    if (semMovimento.matches) return;
    let saiu: Map<Element, Element> | null = null;
    let entrou: Map<Element, Element> | null = null;
    for (const r of lista) {
      const el = r.target as Element;
      const grupo = grupoDe(el);
      if (!grupo) continue;
      const agora = eAtual(el);
      if (eraAtual(r) === agora) continue;
      if (agora) (entrou ??= new Map()).set(grupo, el);
      else (saiu ??= new Map()).set(grupo, el);
    }
    if (!saiu || !entrou) return;
    for (const [grupo, novo] of entrou) {
      const velho = saiu.get(grupo);
      if (velho && velho !== novo && velho.isConnected) viajar(velho, novo);
    }
  });
  observador.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ATRIBUTOS,
    attributeOldValue: true,
  });
  return () => observador.disconnect();
}
