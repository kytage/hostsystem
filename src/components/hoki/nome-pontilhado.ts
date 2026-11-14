/**
 * O nome do jogo escrito em pontinhos (como um letreiro de lâmpadas), que fica ATRÁS da ilha
 * flutuando na tela do HOKI.
 *
 * - Passar o mouse: os pontinhos perto do ponteiro acendem em vermelho, crescem e se afastam.
 * - De tempos em tempos uma faixa de luz passa na diagonal.
 * - Rolar a página: os pontinhos caem e somem, cada um no seu tempo.
 * - Fora da vista (ou com a aba escondida) nada roda.
 */

/** Letras 5×7; cada ponto vira 2×2 pontinhos (traço grosso). */
const LETRAS: Record<string, string[]> = {
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
};
const LINHAS = 14;

const ruido = (i: number, k: number, n = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7 + n * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

interface Ponto {
  /** Posição na grade de pontinhos (coluna, linha). */
  c: number;
  l: number;
  fase: number;
  /** Para onde ele cai quando a página rola (direção e distância sorteadas). */
  dx: number;
  dy: number;
}

function pontosDoNome(nome: string) {
  const pontos: Ponto[] = [];
  let coluna = 0;
  for (const letra of nome.toUpperCase()) {
    const g = LETRAS[letra];
    if (g)
      g.forEach((linha, l) =>
        [...linha].forEach((ch, c) => {
          if (ch !== "#") return;
          for (const a of [0, 1])
            for (const b of [0, 1]) {
              const cc = (coluna + c) * 2 + a;
              const ll = l * 2 + b;
              pontos.push({
                c: cc,
                l: ll,
                fase: ruido(cc, ll),
                dx: (ruido(cc, ll, 3) - 0.5) * 2,
                dy: 0.4 + ruido(cc, ll, 7),
              });
            }
        }),
      );
    coluna += 6;
  }
  return { pontos, colunas: Math.max(1, coluna - 1) * 2 };
}

export interface NomePontilhado {
  /** Quanto a página rolou (0 = no topo, 1 = a parte de cima já saiu). */
  rolagem(p: number): void;
  descartar(): void;
}

/**
 * Desenha o nome dentro de `caixa` (que precisa ter tamanho e `position: relative`).
 * `area` é quem recebe o ponteiro (a parte de cima inteira); sem ela, a própria caixa.
 * `altura` é a fração da altura da caixa que o nome pode ocupar.
 */
export function criarNomePontilhado(
  caixa: HTMLElement,
  o: { nome?: string; area?: HTMLElement; altura?: number } = {},
): NomePontilhado {
  const area = o.area ?? caixa;
  const fracao = o.altura ?? 0.5;
  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tela = document.createElement("canvas");
  Object.assign(tela.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  tela.setAttribute("aria-hidden", "true");
  caixa.appendChild(tela);
  const ctx = tela.getContext("2d");
  const { pontos, colunas } = pontosDoNome(o.nome ?? "HOKI");

  let L = 1;
  let A = 1;
  let passo = 8;
  let x0 = 0;
  let y0 = 0;
  let rol = 0;
  let mx = -9999;
  let my = -9999;
  let nasceu = performance.now();
  let visivel = true;
  let quadro = 0;

  const medir = () => {
    L = Math.max(1, caixa.clientWidth);
    A = Math.max(1, caixa.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    tela.width = Math.round(L * dpr);
    tela.height = Math.round(A * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    passo = Math.min((L * 0.94) / colunas, (A * fracao) / LINHAS);
    x0 = (L - colunas * passo) / 2;
    y0 = Math.max(2, A * 0.01);
  };

  function desenhar(agora: number) {
    quadro = 0;
    if (!ctx) return;
    const t = agora / 1000;
    ctx.clearRect(0, 0, L, A);
    const lado = passo * 0.66;
    const idade = (agora - nasceu) / 1000;
    // faixa de luz que passa na diagonal
    const varredura = semMovimento ? -99 : ((t * 0.2) % 1) * (colunas + LINHAS + 26) - 13;
    let animando = idade < 1.6;
    for (const p of pontos) {
      // entrada: da esquerda para a direita
      const chegou = Math.min(1, Math.max(0, (idade - p.c * 0.012 - p.fase * 0.12) / 0.35));
      if (chegou <= 0) continue;
      let x = x0 + (p.c + 0.5) * passo;
      let y = y0 + (p.l + 0.5) * passo;
      // rolagem: os pontinhos caem e somem, cada um no seu tempo
      const cai = Math.min(1, Math.max(0, (rol * 1.5 - p.fase * 0.45) / 0.55));
      x += p.dx * cai * passo * 2.2;
      y += p.dy * cai * cai * passo * 7;
      // ponteiro: quem está perto acende em vermelho, cresce e se afasta um pouco
      const dx = x - mx;
      const dy = y - my;
      const d = Math.hypot(dx, dy);
      const alcance = passo * 7;
      const k = d < alcance ? (1 - d / alcance) ** 2 : 0;
      if (k > 0 && d > 0.01) {
        x += (dx / d) * k * passo * 0.9;
        y += (dy / d) * k * passo * 0.9;
      }
      const brilho = Math.max(0, 1 - Math.abs(p.c + p.l - varredura) / 5);
      const tam = lado * (0.55 + 0.45 * chegou) * (1 + k * 0.7 + brilho * 0.12) * (1 - cai * 0.5);
      const alfa = (0.5 + p.fase * 0.28 + brilho * 0.3 + k * 0.4) * chegou * (1 - cai);
      if (alfa <= 0.01) continue;
      ctx.fillStyle = `rgba(${Math.round(232 + k * 23)},${Math.round(232 - k * 192)},${Math.round(236 - k * 200)},${Math.min(1, alfa)})`;
      ctx.fillRect(x - tam / 2, y - tam / 2, tam, tam);
    }
    if (!semMovimento) animando = true;
    if (animando) agendar();
  }
  function agendar() {
    if (quadro || !visivel || document.hidden) return;
    quadro = requestAnimationFrame(desenhar);
  }

  const aoMover = (e: PointerEvent) => {
    const r = tela.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
    agendar();
  };
  const aoSair = () => {
    mx = my = -9999;
    agendar();
  };
  area.addEventListener("pointermove", aoMover);
  area.addEventListener("pointerleave", aoSair);

  const observador = new ResizeObserver(() => {
    medir();
    agendar();
  });
  observador.observe(caixa);
  const olheiro = new IntersectionObserver((e) => {
    visivel = e[0]?.isIntersecting ?? true;
    if (visivel) agendar();
  });
  olheiro.observe(caixa);
  const aoVoltar = () => {
    if (!document.hidden) agendar();
  };
  document.addEventListener("visibilitychange", aoVoltar);
  medir();
  nasceu = performance.now();
  agendar();

  return {
    rolagem(p) {
      const v = Math.max(0, Math.min(1, p));
      if (Math.abs(v - rol) < 0.001) return;
      rol = v;
      agendar();
    },
    descartar() {
      if (quadro) cancelAnimationFrame(quadro);
      observador.disconnect();
      olheiro.disconnect();
      document.removeEventListener("visibilitychange", aoVoltar);
      area.removeEventListener("pointermove", aoMover);
      area.removeEventListener("pointerleave", aoSair);
      tela.remove();
    },
  };
}
