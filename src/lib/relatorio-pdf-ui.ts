/**
 * Utilidades visuais compartilhadas pelos relatórios em PDF.
 * Estética minimalista (inspirada em design Apple): cartões com bordas
 * arredondadas, tipografia leve, cinzas suaves e um único acento vermelho.
 */
import hostLogo from "@/assets/host-extenso.png.asset.json";

export type RGB = [number, number, number];

export const PDF_THEME = {
  accent: [206, 14, 14] as RGB,
  ink: [24, 24, 27] as RGB,
  inkSoft: [113, 113, 122] as RGB,
  line: [228, 228, 231] as RGB,
  card: [250, 250, 251] as RGB,
  white: [255, 255, 255] as RGB,
};

/**
 * Converte qualquer imagem (png/webp/jpeg) em data URL PNG usando canvas,
 * garantindo compatibilidade com o jsPDF. Retorna null em caso de falha.
 */
export async function carregarImagemPng(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (typeof window === "undefined") return null;
  if (src.startsWith("data:image/png")) {
    const dim = await medirImagem(src);
    return dim ? { dataUrl: src, ...dim } : null;
  }
  try {
    const img = await carregarElemento(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

/** Logo oficial da HOST pronta para o jsPDF. */
export async function carregarLogoHost() {
  return carregarImagemPng(hostLogo.url);
}

function carregarElemento(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("falha ao carregar imagem"));
    img.src = src;
  });
}

async function medirImagem(src: string) {
  try {
    const img = await carregarElemento(src);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

/** Tipagem mínima do jsPDF usada aqui (evita depender do tipo no SSR). */
export interface PdfDoc {
  setFillColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setLineWidth: (w: number) => void;
  setFont: (f: string, s?: string) => void;
  setFontSize: (s: number) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (t: string | string[], x: number, y: number, opts?: Record<string, unknown>) => void;
  addImage: (...args: unknown[]) => void;
}

/** Cartão base arredondado com contorno suave. */
export function cartao(doc: PdfDoc, x: number, y: number, w: number, h: number, fill: RGB = PDF_THEME.card) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, h, 10, 10, "FD");
}

/** Título de seção discreto, em caixa alta. */
export function tituloSecao(doc: PdfDoc, texto: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.inkSoft);
  doc.text(texto.toUpperCase(), x, y);
}

/** KPI dentro de um cartão arredondado. */
export function kpi(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  label: string,
  valor: string,
  sub?: string
) {
  const h = sub ? 62 : 52;
  cartao(doc, x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.inkSoft);
  doc.text(label.toUpperCase(), x + 12, y + 17);
  doc.setFontSize(17);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text(valor, x + 12, y + 39);
  if (sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.inkSoft);
    doc.text(sub, x + 12, y + 53);
  }
  return h;
}

export interface BarraDado {
  label: string;
  valor: number;
}

/** Gráfico de barras minimalista dentro de um cartão. */
export function graficoBarras(
  doc: PdfDoc,
  opts: { x: number; y: number; w: number; h: number; titulo: string; dados: BarraDado[]; cor?: RGB }
): number {
  const { x, y, w, h, titulo, dados } = opts;
  const cor = opts.cor ?? PDF_THEME.accent;
  cartao(doc, x, y, w, h, PDF_THEME.white);
  tituloSecao(doc, titulo, x + 14, y + 18);

  const plotX = x + 14;
  const plotY = y + 30;
  const plotW = w - 28;
  const plotH = h - 56;
  const max = Math.max(1, ...dados.map((d) => d.valor));

  // Linhas de grade horizontais
  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.5);
  for (let i = 0; i <= 2; i += 1) {
    const gy = plotY + (plotH * i) / 2;
    doc.line(plotX, gy, plotX + plotW, gy);
  }

  if (dados.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.inkSoft);
    doc.text("Sem dados no período", plotX, plotY + plotH / 2);
    return h;
  }

  const slot = plotW / dados.length;
  const barW = Math.min(22, slot * 0.55);
  dados.forEach((d, i) => {
    const bh = Math.max(1.5, (d.valor / max) * plotH);
    const bx = plotX + slot * i + (slot - barW) / 2;
    const by = plotY + plotH - bh;
    doc.setFillColor(...cor);
    doc.roundedRect(bx, by, barW, bh, Math.min(3, barW / 2), Math.min(3, barW / 2), "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_THEME.ink);
    doc.text(String(d.valor), bx + barW / 2, by - 3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.inkSoft);
    doc.text(d.label, bx + barW / 2, plotY + plotH + 12, { align: "center" });
  });
  return h;
}

export interface PontoDado {
  label: string;
  valor: number;
}

/** Gráfico de linha suave com área preenchida. */
export function graficoLinha(
  doc: PdfDoc,
  opts: { x: number; y: number; w: number; h: number; titulo: string; dados: PontoDado[]; cor?: RGB }
): number {
  const { x, y, w, h, titulo, dados } = opts;
  const cor = opts.cor ?? PDF_THEME.accent;
  cartao(doc, x, y, w, h, PDF_THEME.white);
  tituloSecao(doc, titulo, x + 14, y + 18);

  const plotX = x + 14;
  const plotY = y + 30;
  const plotW = w - 28;
  const plotH = h - 56;

  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.5);
  for (let i = 0; i <= 2; i += 1) {
    const gy = plotY + (plotH * i) / 2;
    doc.line(plotX, gy, plotX + plotW, gy);
  }

  if (dados.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.inkSoft);
    doc.text("Sem dados no período", plotX, plotY + plotH / 2);
    return h;
  }

  const max = Math.max(1, ...dados.map((d) => d.valor));
  const pontos = dados.map((d, i) => {
    const px = dados.length === 1 ? plotX + plotW / 2 : plotX + (plotW * i) / (dados.length - 1);
    const py = plotY + plotH - (d.valor / max) * plotH;
    return { px, py, ...d };
  });

  doc.setDrawColor(...cor);
  doc.setLineWidth(1.4);
  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]!;
    const b = pontos[i]!;
    doc.line(a.px, a.py, b.px, b.py);
  }
  doc.setFillColor(...cor);
  pontos.forEach((p) => doc.rect(p.px - 1.2, p.py - 1.2, 2.4, 2.4, "F"));

  // Rótulos: primeiro, meio e último (evita poluição visual)
  const idxs = [...new Set([0, Math.floor(pontos.length / 2), pontos.length - 1])];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF_THEME.inkSoft);
  idxs.forEach((i) => {
    const p = pontos[i];
    if (p) doc.text(p.label, p.px, plotY + plotH + 12, { align: "center" });
  });
  return h;
}
