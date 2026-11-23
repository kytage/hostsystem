/**
 * Fundo do painel: preto, com um feixe de luz vermelha na diagonal (a cor da
 * HOST) que nasce do escuro e some no escuro, desenhado em pontinhos de pixel
 * ("pontilhado", como as telas antigas). A imagem é feita uma vez só, pequena,
 * e esticada sem suavizar (cada pixel vira um quadradinho). Vira a variável
 * CSS --fundo-pontilhado, usada em src/styles.css.
 *
 * O vermelho fica só aqui, no fundo: os cartões por cima são de vidro escuro.
 */

const L = 520;
const A = 325;

/** Matriz de Bayer 4×4 (o padrão de pontinhos). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function desenhar(): string | null {
  const tela = document.createElement("canvas");
  tela.width = L;
  tela.height = A;
  const c = tela.getContext("2d");
  if (!c) return null;
  const img = c.createImageData(L, A);
  let s = 20261114;
  const sorte = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  // o feixe: uma reta que entra pela esquerda (um pouco abaixo do meio) e desce até o canto direito
  const x0 = -0.1 * L;
  const y0 = 0.42 * A;
  const x1 = 1.1 * L;
  const y1 = 0.98 * A;
  const comp = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / comp;
  const uy = (y1 - y0) / comp;
  const passo = 42; // degraus de cor (quanto maior, mais "pixelado")
  for (let y = 0; y < A; y++)
    for (let x = 0; x < L; x++) {
      const ao = ((x - x0) * ux + (y - y0) * uy) / comp; // 0 → 1 ao longo do feixe
      const d = ((x - x0) * -uy + (y - y0) * ux) / A; // distância da reta (negativo = acima)
      // nasce do preto à esquerda e ganha força para a direita
      const forca = Math.min(1, Math.max(0, (ao - 0.08) * 1.5)) * (0.7 + 0.3 * ao);
      const nucleo = Math.exp(-((d + 0.005) ** 2) / (2 * 0.03 ** 2)) * forca; // o fio de luz
      const brasa = Math.exp(-((d + 0.055) ** 2) / (2 * 0.14 ** 2)) * forca * 0.6; // névoa por cima
      const vinho = Math.exp(-((d - 0.05) ** 2) / (2 * 0.035 ** 2)) * forca; // borda escura por baixo
      // base preta com um fundo de vermelho bem fraco (o grão sai vermelho-escuro, não colorido)
      const r = 9 + brasa * 92 + nucleo * 214 + vinho * 118;
      const g = 3 + brasa * 6 + nucleo * 42 + vinho * 4;
      const b = 4 + brasa * 9 + nucleo * 34 + vinho * 10;
      // o mesmo pontilhado nos três canais: o grão varia o tom, sem pontinhos de outras cores
      const t = (BAYER[(y % 4) * 4 + (x % 4)]! - 0.5) * 0.9 + (sorte() - 0.5) * 0.55;
      const q = (v: number) => Math.max(0, Math.min(255, Math.round(v / passo + t) * passo));
      const i = (y * L + x) * 4;
      img.data[i] = q(r);
      img.data[i + 1] = q(g);
      img.data[i + 2] = q(b);
      img.data[i + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  return tela.toDataURL("image/png");
}

export function instalarFundoPontilhado() {
  if (typeof document === "undefined") return;
  const url = desenhar();
  if (url) document.documentElement.style.setProperty("--fundo-pontilhado", `url("${url}")`);
}
