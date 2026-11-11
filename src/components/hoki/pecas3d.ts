/**
 * As peças de roupa do HOKI em 3D: o que cada id do catálogo desenha por cima
 * do modelo. Panos (camiseta, moletom, calça, tênis...) são recortados da
 * própria pele do modelo; acessórios (chapéus, óculos, mochila) são formas
 * presas na cabeça ou no tronco. Medidas nas unidades do modelo (ele tem 0,98
 * de altura; o tronco vai de 0,24 a 0,36 e a cabeça começa em 0,42).
 */
import type * as TH from "three";
import { materialDeSombra, type Esqueleto } from "./corpo";
import {
  ANCORA,
  criarCasca,
  materialDeRoupa,
  noCorpo,
  prender,
  suave,
  type Casca,
  type OpcoesDePano,
  type V3,
} from "./roupas";
import { tom } from "./voxel";

/** Ferramentas que cada peça usa para se montar. */
export interface Kit {
  /** Recorta do corpo uma peça de pano. */
  pano(c: Casca): void;
  /** Põe uma forma (já no lugar, nas medidas do modelo) presa a um ponto do corpo. `balanca` diz, ponto a ponto, o quanto o pano fica solto (0 preso, 1 a ponta). */
  forma(
    geo: TH.BufferGeometry,
    cor: number,
    ancora: V3,
    o?: OpcoesDePano,
    balanca?: (p: V3) => number,
  ): void;
  /** Imagem desenhada na hora (listras de bandeira, estampa de capa). */
  pintura(
    largura: number,
    altura: number,
    desenha: (c: CanvasRenderingContext2D, l: number, a: number) => void,
  ): TH.Texture;
  /** Pano plano (largura x altura), dividido para poder balançar. */
  pano2(
    largura: number,
    altura: number,
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
  ): TH.BufferGeometry;
  bola(
    r: number,
    x: number,
    y: number,
    z: number,
    sx?: number,
    sy?: number,
    sz?: number,
  ): TH.BufferGeometry;
  tubo(
    rTopo: number,
    rBase: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
    lados?: number,
  ): TH.BufferGeometry;
  aro(
    raio: number,
    grossura: number,
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
    arco?: number,
  ): TH.BufferGeometry;
  /** Caixa de cantos arredondados (largura, altura, fundo, raio do canto). */
  bloco(
    l: number,
    a: number,
    f: number,
    canto: number,
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
  ): TH.BufferGeometry;
  /** Forma torneada: perfil [raio, altura] girado em volta do eixo vertical. */
  torno(
    perfil: readonly (readonly [number, number])[],
    x: number,
    y: number,
    z: number,
    rx?: number,
    rz?: number,
    lados?: number,
  ): TH.BufferGeometry;
  /** Chapa recortada (contorno em XY) com espessura. */
  chapa(
    pontos: readonly (readonly [number, number])[],
    espessura: number,
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
  ): TH.BufferGeometry;
}
export type Monta = (k: Kit) => void;

const CABECA = ANCORA.cabeca;
const TRONCO = ANCORA.tronco;
/** Fora do rabo: as peças de baixo deixam o rabinho passar. */
const semRabo = (p: V3) => (p[1] < 0.275 ? p[2] + 0.13 : 1);
const faixa = (p: V3, y0: number, passo: number, cores: readonly number[]) =>
  cores[Math.abs(Math.floor((p[1] - y0) / passo)) % cores.length] ?? cores[0]!;

// ---------------- parte de cima ----------------
export interface OpcoesDeCima {
  /** Cor dos punhos e da barra. */
  barra?: number;
  /** Cor das mangas (quando diferente do corpo da peça). */
  manga?: number;
  /** Listras na horizontal, de baixo para cima. */
  listras?: readonly number[];
  /** Desenho livre: devolve a cor do ponto, ou nada para usar a cor normal. */
  estampa?: (p: V3) => number | undefined;
}
const corDeCima = (cor: number, o: OpcoesDeCima, punho: number, barraY: number) => (p: V3) => {
  const ax = Math.abs(p[0]);
  const e = o.estampa?.(p);
  if (e !== undefined) return e;
  if (ax > punho || p[1] < barraY) return o.barra ?? tom(cor, 0.84);
  if (o.manga !== undefined && ax > 0.142) return o.manga;
  return o.listras ? faixa(p, 0.2, 0.024, o.listras) : cor;
};
export const camiseta =
  (cor: number, o: OpcoesDeCima = {}): Monta =>
  (k) =>
    k.pano({
      dentro: (p) => Math.min(p[1] - 0.24, noCorpo(p), 0.212 - Math.abs(p[0])),
      folga: (p, d) =>
        0.004 + 0.011 * suave(0, 0.014, d) + 0.007 * suave(0.165, 0.212, Math.abs(p[0])),
      cor: corDeCima(cor, o, 0.199, 0.25),
    });
export const moletom =
  (cor: number, o: OpcoesDeCima & { bolso?: boolean; cordoes?: number } = {}): Monta =>
  (k) => {
    k.pano({
      dentro: (p) => Math.min(p[1] - 0.228, noCorpo(p), 0.302 - Math.abs(p[0])),
      folga: (_p, d) => 0.005 + 0.015 * suave(0, 0.016, d),
      cor: corDeCima(cor, o, 0.277, 0.246),
    });
    if (o.bolso !== false)
      k.forma(k.bloco(0.15, 0.055, 0.018, 0.012, 0, 0.268, 0.131, -0.1), tom(cor, 0.9), TRONCO, {
        aspereza: 0.95,
      });
    for (const s of [-1, 1]) {
      k.forma(
        k.tubo(0.005, 0.005, 0.06, s * 0.028, 0.318, 0.132, 0.25, 0, s * 0.12),
        o.cordoes ?? 0xffffff,
        TRONCO,
      );
      k.forma(k.bola(0.008, s * 0.032, 0.288, 0.139), o.cordoes ?? 0xffffff, TRONCO);
    }
  };
export const jaqueta =
  (
    cor: number,
    o: OpcoesDeCima & { gola?: number; botoes?: number; aberta?: number } = {},
  ): Monta =>
  (k) => {
    const abre = o.aberta ?? 0.032;
    k.pano({
      dentro: (p) =>
        Math.min(
          p[1] - 0.226,
          noCorpo(p),
          0.302 - Math.abs(p[0]),
          p[2] > 0.03 ? Math.abs(p[0]) - abre : 1,
        ),
      folga: (_p, d) => 0.006 + 0.016 * suave(0, 0.016, d),
      cor: corDeCima(cor, o, 0.277, 0.244),
    });
    for (const s of [-1, 1]) {
      k.forma(
        k.bloco(0.062, 0.034, 0.012, 0.008, s * 0.062, 0.343, 0.123, -0.55, 0, s * 0.55),
        o.gola ?? tom(cor, 0.8),
        TRONCO,
      );
      if (o.botoes !== undefined)
        for (let i = 0; i < 3; i++)
          k.forma(
            k.bola(0.0075, s * (abre + 0.014), 0.262 + i * 0.03, 0.128 - i * 0.004),
            o.botoes,
            TRONCO,
            { aspereza: 0.4 },
          );
    }
  };
/** Casaco fofo de inverno: gomos na horizontal e gola e punhos de pelo. */
export const casaco =
  (cor: number, pelo = 0xffffff): Monta =>
  (k) => {
    k.pano({
      dentro: (p) => Math.min(p[1] - 0.2, noCorpo(p), 0.3 - Math.abs(p[0])),
      folga: (p, d) => 0.006 + (0.02 + 0.007 * Math.sin(p[1] * 150)) * suave(0, 0.016, d),
      cor: (p) => (Math.sin(p[1] * 150) < -0.75 ? tom(cor, 0.86) : cor),
    });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      k.forma(
        k.bola(0.03, Math.cos(a) * 0.118, 0.356, Math.sin(a) * 0.105 + 0.005, 1, 0.8, 1),
        pelo,
        TRONCO,
        { aspereza: 1 },
      );
    }
    for (const s of [-1, 1])
      k.forma(
        k.aro(0.046, 0.016, s * 0.29, 0.333, 0.02, 0, Math.PI / 2),
        pelo,
        s < 0 ? ANCORA.maoE : ANCORA.maoD,
        { aspereza: 1 },
      );
  };
/** Roupa inteiriça (macacão): tronco, braços e pernas numa peça só. */
export const macacao =
  (cor: number, o: OpcoesDeCima & { ate?: number } = {}): Monta =>
  (k) =>
    k.pano({
      dentro: (p) => Math.min(noCorpo(p), 0.3 - Math.abs(p[0]), p[1] - (o.ate ?? 0.07), semRabo(p)),
      folga: (_p, d) => 0.004 + 0.011 * suave(0, 0.014, d),
      cor: (p) =>
        o.estampa?.(p) ??
        (Math.abs(p[0]) > 0.278 || p[1] < (o.ate ?? 0.07) + 0.016
          ? (o.barra ?? tom(cor, 0.82))
          : o.manga !== undefined && Math.abs(p[0]) > 0.142
            ? o.manga
            : cor),
    });

// ---------------- parte de baixo ----------------
const saiaRodada = (k: Kit, cor: number, barra: number, y0 = 0.272, y1 = 0.132, r1 = 0.24) => {
  // um cone de pano preso na cintura, com a barra reforçada
  const perfil: [number, number][] = [];
  for (let i = 0; i <= 6; i++)
    perfil.push([0.127 + (r1 - 0.127) * Math.pow(i / 6, 0.8), y0 + (y1 - y0) * (i / 6)]);
  k.forma(k.torno(perfil, 0, 0, 0, 0, 0, 36), cor, [0, 0.3, 0], { aspereza: 0.9, duplo: true });
  k.forma(k.aro(r1 - 0.004, 0.011, 0, y1 + 0.002, 0, Math.PI / 2), barra, [0, 0.3, 0], {
    aspereza: 0.9,
  });
};
export const vestido =
  (cor: number, barra = tom(cor, 1.18)): Monta =>
  (k) => {
    camiseta(cor, { barra })(k);
    saiaRodada(k, cor, barra);
  };
export const saia =
  (cor: number, barra = tom(cor, 0.85)): Monta =>
  (k) => {
    k.pano({ dentro: (p) => Math.min(p[1] - 0.236, 0.272 - p[1]), folga: 0.014, cor: () => barra });
    saiaRodada(k, cor, barra, 0.262, 0.14, 0.225);
  };
export const calca =
  (cor: number, o: { ate?: number; barra?: number; cos?: number; cordao?: number } = {}): Monta =>
  (k) => {
    const ate = o.ate ?? 0.066;
    k.pano({
      dentro: (p) => Math.min(p[1] - ate, 0.266 - p[1], semRabo(p)),
      folga: (_p, d) => 0.004 + 0.009 * suave(0, 0.012, d),
      cor: (p) =>
        p[1] > 0.25
          ? (o.cos ?? tom(cor, 0.8))
          : p[1] < ate + 0.016
            ? (o.barra ?? tom(cor, 1.16))
            : cor,
    });
    if (o.cordao !== undefined)
      for (const s of [-1, 1])
        k.forma(
          k.tubo(0.004, 0.004, 0.04, s * 0.012, 0.238, 0.131, 0.15, 0, s * 0.35),
          o.cordao,
          [0, 0.3, 0],
        );
  };
export const shorts = (
  cor: number,
  o: { barra?: number; cos?: number; cordao?: number } = {},
): Monta => calca(cor, { ...o, ate: 0.112 });

// ---------------- pés e mãos ----------------
/** Calçado recortado do pé: cano até `cano`, sola mais grossa, bico e cadarço pintados. */
export const sapato =
  (
    cor: number,
    o: { cano?: number; sola?: number; bico?: number; cadarco?: number; boca?: number } = {},
  ): Monta =>
  (k) => {
    const cano = o.cano ?? 0.082;
    const sola = o.sola ?? 0xffffff;
    k.pano({
      dentro: (p) => cano - p[1],
      folga: (p, d) => 0.005 + 0.01 * suave(0, 0.012, d) + (p[1] < 0.022 ? 0.007 : 0),
      cor: (p) => {
        if (p[1] < 0.022) return sola;
        if (p[1] > cano - 0.013) return o.boca ?? tom(cor, 0.78);
        const meio = Math.abs(Math.abs(p[0]) - 0.06);
        // cadarço: tirinhas atravessadas no peito do pé
        if (
          o.cadarco !== undefined &&
          p[2] > 0.022 &&
          p[2] < 0.08 &&
          p[1] > 0.04 &&
          meio < 0.03 &&
          ((p[2] - 0.022) / 0.0145) % 1 < 0.45
        )
          return o.cadarco;
        if (o.bico !== undefined && p[2] > 0.066 && p[1] < 0.052) return o.bico;
        return cor;
      },
    });
  };
export const luvas =
  (cor: number, punho = tom(cor, 0.82)): Monta =>
  (k) =>
    k.pano({
      dentro: (p) => Math.min(Math.abs(p[0]) - 0.284, noCorpo(p)),
      folga: 0.009,
      cor: (p) => (Math.abs(p[0]) < 0.3 ? punho : cor),
    });

// ---------------- cabeça: toucas recortadas e chapéus de forma ----------------
/** Touca que abraça o topo da cabeça (com as orelhas). `ate` é onde ela termina; `aba` põe a pala do boné. */
export const touca =
  (
    cor: number,
    o: { ate?: number; barra?: number; aba?: number; pompom?: number; botao?: boolean } = {},
  ): Monta =>
  (k) => {
    const ate = o.ate ?? 0.762;
    k.pano({
      dentro: (p) => p[1] - ate - Math.max(0, -p[2]) * 0.18,
      folga: (_p, d) => 0.005 + 0.011 * suave(0, 0.016, d),
      cor: (p) =>
        o.barra !== undefined && p[1] < ate + 0.045
          ? Math.sin(p[0] * 190) > 0.2
            ? o.barra
            : tom(o.barra, 0.88)
          : cor,
    });
    if (o.aba !== undefined) {
      const meia: [number, number][] = [];
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI;
        meia.push([Math.cos(a) * 0.2, Math.sin(a) * 0.15]);
      }
      k.forma(k.chapa(meia, 0.014, 0, 0.775, 0.2, -Math.PI / 2 + 0.28), o.aba, CABECA, {
        aspereza: 0.8,
      });
    }
    if (o.botao) k.forma(k.bola(0.016, 0, 0.918, 0.03, 1, 0.6, 1), tom(cor, 0.85), CABECA);
    if (o.pompom !== undefined)
      k.forma(k.bola(0.058, 0, 0.955, 0.02), o.pompom, CABECA, { aspereza: 1 });
  };

const OURO = 0xf2c14e;
const brilhante: OpcoesDePano = { aspereza: 0.3, metal: 0.35 };
export const coroa =
  (cor = OURO, joia = 0xd9151b): Monta =>
  (k) => {
    k.forma(k.tubo(0.108, 0.1, 0.05, 0, 0.925, 0.02), cor, CABECA, brilhante);
    k.forma(k.bola(0.094, 0, 0.94, 0.02, 1, 0.55, 1), joia, CABECA, { aspereza: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.forma(
        k.tubo(0, 0.024, 0.06, Math.cos(a) * 0.098, 0.978, 0.02 + Math.sin(a) * 0.098, 0, 0, 0, 10),
        cor,
        CABECA,
        brilhante,
      );
      k.forma(
        k.bola(0.012, Math.cos(a) * 0.098, 1.01, 0.02 + Math.sin(a) * 0.098),
        i % 2 ? 0xffffff : joia,
        CABECA,
        { aspereza: 0.2 },
      );
      k.forma(
        k.bola(0.012, Math.cos(a + 0.52) * 0.108, 0.925, 0.02 + Math.sin(a + 0.52) * 0.108),
        i % 2 ? joia : 0x2f7de0,
        CABECA,
        { aspereza: 0.2 },
      );
    }
  };
export const cartola =
  (cor = 0x18181b, fita = 0xce0e0e): Monta =>
  (k) => {
    k.forma(k.tubo(0.2, 0.2, 0.014, 0, 0.9, 0.02), cor, CABECA, { aspereza: 0.6 });
    k.forma(k.tubo(0.118, 0.11, 0.17, 0, 0.99, 0.02), cor, CABECA, { aspereza: 0.6 });
    k.forma(k.tubo(0.113, 0.112, 0.03, 0, 0.925, 0.02), fita, CABECA);
  };
export const chapeuDeFesta =
  (cor = 0xce0e0e, bolinha = 0xffd84a): Monta =>
  (k) => {
    k.forma(k.tubo(0, 0.085, 0.2, 0.03, 0.99, 0.02, 0, 0, -0.14, 20), cor, CABECA, {
      aspereza: 0.7,
    });
    k.forma(k.bola(0.024, 0.045, 1.09, 0.02), bolinha, CABECA);
    for (let i = 0; i < 5; i++)
      k.forma(
        k.bola(
          0.011,
          0.03 + Math.cos(i * 1.26) * 0.062,
          0.93 + (i % 2) * 0.04,
          0.02 + Math.sin(i * 1.26) * 0.062,
        ),
        bolinha,
        CABECA,
      );
  };
export const chapeuDeMago =
  (cor = 0x6a3fc4, fita = OURO): Monta =>
  (k) => {
    k.forma(k.tubo(0.25, 0.25, 0.012, 0, 0.895, 0.02, 0.06), cor, CABECA, { aspereza: 0.85 });
    k.forma(k.tubo(0.1, 0.16, 0.12, 0, 0.955, 0.02), cor, CABECA, { aspereza: 0.85 });
    k.forma(k.tubo(0.05, 0.1, 0.12, 0.022, 1.06, 0.02, 0, 0, -0.32), cor, CABECA, {
      aspereza: 0.85,
    });
    k.forma(k.tubo(0, 0.05, 0.12, 0.085, 1.145, 0.02, 0, 0, -0.9, 12), cor, CABECA, {
      aspereza: 0.85,
    });
    k.forma(k.tubo(0.163, 0.163, 0.022, 0, 0.91, 0.02), fita, CABECA, brilhante);
    k.forma(k.bola(0.02, 0.16, 1.15, 0.02), fita, CABECA, { brilho: 0xffe28a, forcaDoBrilho: 1.2 });
    for (let i = 0; i < 9; i++)
      k.forma(
        k.bola(
          0.008,
          Math.cos(i * 2.4) * (0.13 - i * 0.008),
          0.93 + i * 0.022,
          0.02 + Math.sin(i * 2.4) * (0.13 - i * 0.008),
        ),
        0xfff3b0,
        CABECA,
        { brilho: 0xfff3b0, forcaDoBrilho: 1.6 },
      );
  };
export const chapeuPirata =
  (cor = 0x1b1f33, debrum = OURO, pena = 0xd9151b): Monta =>
  (k) => {
    k.forma(k.bola(0.17, 0, 0.9, 0.01, 1, 0.52, 0.95), cor, CABECA, { aspereza: 0.8 });
    // aba dobrada para cima na frente e dos lados (o tricórnio)
    k.forma(k.bloco(0.4, 0.13, 0.026, 0.02, 0, 0.94, 0.16, -0.38), cor, CABECA, { aspereza: 0.8 });
    for (const s of [-1, 1])
      k.forma(k.bloco(0.3, 0.11, 0.026, 0.02, s * 0.2, 0.93, -0.03, -0.3, s * 1.25), cor, CABECA, {
        aspereza: 0.8,
      });
    k.forma(k.bloco(0.36, 0.014, 0.03, 0.006, 0, 1.0, 0.185, -0.38), debrum, CABECA, brilhante);
    k.forma(k.bola(0.03, 0, 0.945, 0.178, 1, 1, 0.5), 0xffffff, CABECA);
    for (const s of [-1, 1])
      k.forma(k.tubo(0.006, 0.006, 0.075, 0, 0.925, 0.184, 0, 0, s * 0.8), 0xffffff, CABECA);
    k.forma(k.bola(0.05, 0.19, 1.02, 0.02, 0.5, 1.5, 0.4), pena, CABECA, { aspereza: 0.9 });
  };
export const chapeuDeExplorador =
  (cor = 0xd9c39a, fita = 0x7a5230): Monta =>
  (k) => {
    k.forma(k.tubo(0.3, 0.31, 0.014, 0, 0.87, 0.02, 0.05), cor, CABECA, { aspereza: 0.9 });
    k.forma(k.bola(0.19, 0, 0.88, 0.02, 1, 0.62, 0.95), cor, CABECA, { aspereza: 0.9 });
    k.forma(k.tubo(0.186, 0.19, 0.03, 0, 0.895, 0.02), fita, CABECA);
    for (const s of [-1, 1]) {
      k.forma(k.aro(0.04, 0.011, s * 0.052, 0.945, 0.165, -0.5), fita, CABECA);
      k.forma(
        k.tubo(0.036, 0.036, 0.01, s * 0.052, 0.945, 0.165, Math.PI / 2 - 0.5),
        0x2c3a44,
        CABECA,
        { aspereza: 0.15 },
      );
    }
  };
export const laco =
  (cor = 0xff8fc8, no = 0xf06aa8): Monta =>
  (k) => {
    for (const s of [-1, 1])
      k.forma(
        k.tubo(0.075, 0.016, 0.13, s * 0.075, 0.955, 0.06, 0, 0, s * (Math.PI / 2 - 0.2), 16),
        cor,
        CABECA,
        { aspereza: 0.6 },
      );
    k.forma(k.bola(0.034, 0, 0.95, 0.065, 1, 1.1, 0.9), no, CABECA, { aspereza: 0.6 });
    for (const s of [-1, 1])
      k.forma(
        k.bloco(0.04, 0.1, 0.012, 0.008, s * 0.03, 0.885, 0.085, 0.2, 0, s * 0.3),
        cor,
        CABECA,
        { aspereza: 0.6 },
      );
  };
const ESTRELA: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
  const raio = i % 2 ? 0.45 : 1;
  return [Math.cos(a) * raio, Math.sin(a) * raio] as [number, number];
});
const escala = (pontos: readonly (readonly [number, number])[], s: number) =>
  pontos.map(([x, y]) => [x * s, y * s] as const);
export const tiaraDeEstrela =
  (cor = OURO): Monta =>
  (k) => {
    k.forma(k.aro(0.3, 0.011, 0, 0.66, 0.05, -0.25, 0, 0, Math.PI), cor, CABECA, brilhante);
    k.forma(k.chapa(escala(ESTRELA, 0.07), 0.022, 0.17, 0.93, 0.11, -0.2, 0.3), cor, CABECA, {
      ...brilhante,
      brilho: 0xffd76a,
      forcaDoBrilho: 0.5,
    });
    k.forma(k.chapa(escala(ESTRELA, 0.034), 0.016, 0.26, 0.86, 0.1, -0.2, 0.5), 0xc9a7f0, CABECA, {
      aspereza: 0.4,
    });
  };
export const fones =
  (cor = 0x1c1c1f, luz = 0x3df58a): Monta =>
  (k) => {
    k.forma(k.aro(0.335, 0.016, 0, 0.62, 0, 0, 0, 0, Math.PI), cor, CABECA, { aspereza: 0.5 });
    for (const s of [-1, 1]) {
      k.forma(k.tubo(0.085, 0.085, 0.05, s * 0.325, 0.6, 0, 0, 0, Math.PI / 2), cor, CABECA, {
        aspereza: 0.5,
      });
      k.forma(k.tubo(0.07, 0.07, 0.02, s * 0.3, 0.6, 0, 0, 0, Math.PI / 2), 0x35353b, CABECA, {
        aspereza: 1,
      });
      k.forma(k.tubo(0.045, 0.045, 0.008, s * 0.353, 0.6, 0, 0, 0, Math.PI / 2), luz, CABECA, {
        brilho: luz,
        forcaDoBrilho: 1.6,
      });
    }
    // microfone: uma haste que sai do fone esquerdo e vem para a frente da boca
    k.forma(k.aro(0.285, 0.006, -0.1, 0.545, 0, Math.PI / 2, -2, 0, 1.14), cor, CABECA);
    k.forma(k.bola(0.018, -0.218, 0.545, 0.259), cor, CABECA, { aspereza: 0.9 });
  };
export const capacete =
  (aro = 0xdfe6ee): Monta =>
  (k) => {
    k.forma(k.bola(0.42, 0, 0.68, 0, 1, 0.98, 0.98), 0xbfe6ff, CABECA, {
      aspereza: 0.05,
      transparencia: 0.2,
    });
    k.forma(k.aro(0.2, 0.034, 0, 0.395, 0, Math.PI / 2), aro, TRONCO, {
      aspereza: 0.4,
      metal: 0.3,
    });
  };
export const oculosEscuros =
  (aro = 0x141416, lente = 0x0b0b0d): Monta =>
  (k) => {
    for (const s of [-1, 1]) {
      k.forma(k.aro(0.07, 0.01, s * 0.108, 0.566, 0.267, 0, s * 0.2), aro, CABECA, {
        aspereza: 0.4,
      });
      k.forma(
        k.tubo(0.066, 0.066, 0.008, s * 0.108, 0.566, 0.266, Math.PI / 2, 0, -s * 0.2),
        lente,
        CABECA,
        { aspereza: 0.08 },
      );
      k.forma(
        k.bloco(0.012, 0.014, 0.24, 0.005, s * 0.245, 0.575, 0.155, 0, s * 0.58),
        aro,
        CABECA,
        { aspereza: 0.4 },
      );
    }
    k.forma(k.bloco(0.085, 0.012, 0.012, 0.005, 0, 0.582, 0.276), aro, CABECA, { aspereza: 0.4 });
  };
export const visor =
  (cor = 0xff2a2a): Monta =>
  (k) => {
    const arco = Math.PI * 0.86;
    k.forma(
      k.aro(0.268, 0.034, 0, 0.572, 0, Math.PI / 2, -(Math.PI / 2 - arco / 2), 0, arco),
      cor,
      CABECA,
      { aspereza: 0.15, brilho: cor, forcaDoBrilho: 1.3 },
    );
    k.forma(
      k.aro(
        0.268,
        0.042,
        0,
        0.572,
        0,
        Math.PI / 2,
        -(Math.PI / 2 - (arco + 0.16) / 2),
        0,
        arco + 0.16,
      ),
      0x18181b,
      CABECA,
      { aspereza: 0.4 },
    );
  };
/** Alças de mochila ou de bolsa: tiras de pano coladas no tronco. */
const alcas = (k: Kit, cor: number) =>
  k.pano({
    dentro: (p) => Math.min(0.02 - Math.abs(Math.abs(p[0]) - 0.085), noCorpo(p), p[1] - 0.246),
    folga: 0.021,
    cor: () => cor,
  });
export const mochila =
  (cor = 0xd9151b, detalhe = tom(cor, 0.78)): Monta =>
  (k) => {
    alcas(k, detalhe);
    k.forma(k.bloco(0.21, 0.2, 0.09, 0.035, 0, 0.318, -0.162), cor, TRONCO, { aspereza: 0.85 });
    k.forma(k.bloco(0.14, 0.078, 0.03, 0.016, 0, 0.276, -0.212), detalhe, TRONCO, {
      aspereza: 0.85,
    });
    k.forma(k.aro(0.03, 0.008, 0, 0.42, -0.16, 0, Math.PI / 2), detalhe, TRONCO);
    k.forma(k.bloco(0.05, 0.012, 0.012, 0.004, 0, 0.292, -0.229), 0xc9ccd1, TRONCO, brilhante);
  };
const CORACAO: [number, number][] = Array.from({ length: 24 }, (_, i) => {
  const t = (i / 24) * Math.PI * 2;
  return [
    Math.pow(Math.sin(t), 3),
    (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16,
  ] as [number, number];
});
/** Bolsinha a tiracolo: a tira atravessa o peito e a bolsa fica no quadril. */
export const bolsa =
  (
    cor = 0xff8fc8,
    forma: "coracao" | "estrela" | "caixa" = "coracao",
    tira = tom(cor, 0.82),
  ): Monta =>
  (k) => {
    k.pano({
      dentro: (p) =>
        Math.min(
          0.013 - Math.abs((p[0] + (p[1] - 0.305) * 1.15) * 0.66),
          noCorpo(p),
          p[1] - 0.238,
          0.14 - Math.abs(p[0]),
        ),
      folga: 0.022,
      cor: () => tira,
    });
    const lugar = [-0.118, 0.238, 0.085] as const;
    if (forma === "caixa")
      k.forma(k.bloco(0.1, 0.075, 0.035, 0.014, ...lugar, 0, -0.5), cor, [0, 0.3, 0], {
        aspereza: 0.8,
      });
    else
      k.forma(
        k.chapa(escala(forma === "estrela" ? ESTRELA : CORACAO, 0.05), 0.03, ...lugar, 0, -0.5),
        cor,
        [0, 0.3, 0],
        { aspereza: 0.7 },
      );
    k.forma(
      k.bola(0.008, lugar[0] + 0.01, lugar[1] + 0.005, lugar[2] + 0.03),
      0xffffff,
      [0, 0.3, 0],
      brilhante,
    );
  };
export const cachecol =
  (cor = 0x8ec5ff, franja = 0xffffff): Monta =>
  (k) => {
    k.forma(k.aro(0.125, 0.036, 0, 0.372, 0.005, Math.PI / 2), cor, TRONCO, { aspereza: 1 });
    k.forma(k.bloco(0.06, 0.13, 0.02, 0.01, 0.06, 0.3, 0.135, -0.12, 0, -0.12), cor, TRONCO, {
      aspereza: 1,
    });
    k.forma(
      k.bloco(0.062, 0.016, 0.022, 0.006, 0.068, 0.236, 0.143, -0.12, 0, -0.12),
      franja,
      TRONCO,
      { aspereza: 1 },
    );
  };
/** Capa presa nos ombros, abrindo para baixo. `gola` põe a gola de pelo; `estrelas`, pontinhos de luz. */
export const capa =
  (
    cor = 0xce0e0e,
    o: {
      fecho?: number;
      gola?: number;
      comprimento?: number;
      estrelas?: number;
      estampa?: (c: CanvasRenderingContext2D, l: number, a: number) => void;
      brilho?: number;
    } = {},
  ): Monta =>
  (k) => {
    const perfil: [number, number][] = [];
    const baixo = o.comprimento ?? 0.3;
    // meio cone aberto atrás: gira o perfil só por trás do corpo
    for (let i = 0; i <= 8; i++)
      perfil.push([0.132 + 0.13 * Math.pow(i / 8, 0.9), 0.372 - baixo * (i / 8)]);
    const pano = k.torno(perfil, 0, 0, 0.01, 0, 0, 28);
    // só a metade de trás (z negativo) e um pouco dos lados
    const idx = pano.getIndex();
    const pos = pano.getAttribute("position");
    if (idx) {
      const fica: number[] = [];
      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t);
        const b = idx.getX(t + 1);
        const c = idx.getX(t + 2);
        if (pos.getZ(a) < 0.06 && pos.getZ(b) < 0.06 && pos.getZ(c) < 0.06) fica.push(a, b, c);
      }
      pano.setIndex(fica);
    }
    // a ponta de baixo fica solta e balança
    k.forma(
      pano,
      o.estampa ? 0xffffff : cor,
      TRONCO,
      {
        aspereza: 0.85,
        duplo: true,
        ...(o.estampa ? { mapa: k.pintura(64, 128, o.estampa) } : {}),
        ...(o.brilho !== undefined ? { brilho: o.brilho, forcaDoBrilho: 0.5 } : {}),
      },
      (p) => (0.372 - p[1]) / baixo,
    );
    if (o.gola !== undefined)
      for (let i = 0; i < 14; i++)
        k.forma(
          k.bola(
            0.034,
            Math.cos((i / 14) * Math.PI * 2) * 0.128,
            0.366,
            Math.sin((i / 14) * Math.PI * 2) * 0.112 + 0.004,
            1,
            0.75,
            1,
          ),
          o.gola,
          TRONCO,
          { aspereza: 1 },
        );
    k.forma(k.bola(0.02, 0, 0.352, 0.132, 1, 1, 0.6), o.fecho ?? OURO, TRONCO, brilhante);
    if (o.estrelas !== undefined)
      for (let i = 0; i < 12; i++)
        k.forma(
          k.bola(
            0.008,
            Math.cos(2.2 + i * 0.21) * (0.17 + (i % 4) * 0.022),
            0.3 - (i % 5) * 0.045,
            0.01 - Math.abs(Math.sin(2.2 + i * 0.21)) * (0.17 + (i % 4) * 0.022),
          ),
          o.estrelas,
          TRONCO,
          { brilho: o.estrelas, forcaDoBrilho: 1.5 },
        );
  };

/** Bandeira num mastro preso nas costas, tremulando acima da cabeça. `desenha` pinta o pano. */
export const bandeira =
  (desenha: (c: CanvasRenderingContext2D, l: number, a: number) => void): Monta =>
  (k) => {
    k.forma(k.tubo(0.009, 0.009, 1.12, 0.17, 0.8, -0.3), 0xd8d8d8, TRONCO, {
      aspereza: 0.3,
      metal: 0.4,
    });
    k.forma(k.bola(0.02, 0.17, 1.375, -0.3), OURO, TRONCO, brilhante);
    k.forma(k.bloco(0.2, 0.05, 0.05, 0.012, 0.09, 0.3, -0.2, 0, -0.5), 0x8d8d8d, TRONCO, {
      aspereza: 0.4,
      metal: 0.3,
    });
    k.forma(
      k.pano2(0.4, 0.26, 0.38, 1.22, -0.3),
      0xffffff,
      TRONCO,
      { duplo: true, mapa: k.pintura(256, 166, desenha), aspereza: 0.8 },
      (p) => (p[0] - 0.18) / 0.4,
    );
  };
const listras = (cores: readonly string[]) => (c: CanvasRenderingContext2D, l: number, a: number) =>
  cores.forEach((cor, i) => {
    c.fillStyle = cor;
    c.fillRect(0, Math.floor((i * a) / cores.length), l, Math.ceil(a / cores.length));
  });
const bandeiraHost = (c: CanvasRenderingContext2D, l: number, a: number) => {
  c.fillStyle = "#0b0b0d";
  c.fillRect(0, 0, l, a);
  c.fillStyle = "#ce0e0e";
  c.fillRect(0, a - 26, l, 26);
  c.fillStyle = "#ffffff";
  c.font = "800 84px Manrope, Arial, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("HOST", l / 2, a / 2 - 10);
};
const bandeiraBrasil = (c: CanvasRenderingContext2D, l: number, a: number) => {
  c.fillStyle = "#1f9a48";
  c.fillRect(0, 0, l, a);
  c.fillStyle = "#f8d12c";
  c.beginPath();
  c.moveTo(l / 2, 14);
  c.lineTo(l - 20, a / 2);
  c.lineTo(l / 2, a - 14);
  c.lineTo(20, a / 2);
  c.closePath();
  c.fill();
  c.fillStyle = "#1f3f9a";
  c.beginPath();
  c.arc(l / 2, a / 2, 38, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#ffffff";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(l / 2, a / 2 + 52, 70, Math.PI * 1.28, Math.PI * 1.72);
  c.stroke();
};
const degrade =
  (cores: readonly string[]) => (c: CanvasRenderingContext2D, l: number, a: number) => {
    const g = c.createLinearGradient(0, 0, 0, a);
    cores.forEach((cor, i) => g.addColorStop(i / (cores.length - 1), cor));
    c.fillStyle = g;
    c.fillRect(0, 0, l, a);
  };
const ASA: [number, number][] = [
  [0, 0],
  [0.16, 0.36],
  [0.44, 0.62],
  [0.8, 0.76],
  [1.18, 0.74],
  [0.94, 0.52],
  [1.08, 0.44],
  [0.8, 0.29],
  [0.9, 0.17],
  [0.56, 0.08],
  [0.6, -0.06],
  [0.25, -0.1],
];
/** Asas de pena nas costas, batendo de leve. */
export const asas =
  (cor = 0xffffff, ponta = 0xdfe8f5): Monta =>
  (k) => {
    for (const s of [-1, 1]) {
      k.forma(
        k.chapa(
          escala(ASA, 0.42).map(([x, y]) => [x * s, y] as const),
          0.02,
          s * 0.05,
          0.3,
          -0.14,
          0,
          s * 0.5,
        ),
        cor,
        TRONCO,
        { aspereza: 0.9, duplo: true },
        (p) => Math.abs(p[0]) / 0.5,
      );
      k.forma(
        k.chapa(
          escala(ASA, 0.3).map(([x, y]) => [x * s, y] as const),
          0.02,
          s * 0.06,
          0.27,
          -0.125,
          0,
          s * 0.5,
        ),
        ponta,
        TRONCO,
        { aspereza: 0.9, duplo: true },
        (p) => Math.abs(p[0]) / 0.5,
      );
    }
  };

/** Junta várias formas numa malha só (as asas de aço têm dezenas de penas). */
function juntar(formas: TH.BufferGeometry[]): TH.BufferGeometry {
  const base = formas[0]!.clone();
  for (const nome of ["position", "normal", "uv"] as const) {
    const primeiro = formas[0]!.getAttribute(nome);
    const total = formas.reduce((n, g) => n + g.getAttribute(nome).array.length, 0);
    const dados = new Float32Array(total);
    let o = 0;
    for (const g of formas) {
      dados.set(g.getAttribute(nome).array as Float32Array, o);
      o += g.getAttribute(nome).array.length;
    }
    const copia = primeiro.clone();
    copia.array = dados;
    (copia as { count: number }).count = total / primeiro.itemSize;
    base.setAttribute(nome, copia);
  }
  base.clearGroups();
  formas.forEach((g) => g.dispose());
  return base;
}
/** Contorno de uma pena (ponta fina, um pouco curva), saindo de (0,0) na direção `ang`. */
const PENA: [number, number][] = [
  [0, 0],
  [0.1, 0.4],
  [0.34, 0.5],
  [0.66, 0.42],
  [0.88, 0.22],
  [1, 0.02],
  [0.9, -0.14],
  [0.66, -0.34],
  [0.32, -0.46],
  [0.08, -0.32],
];
const pena = (x: number, y: number, ang: number, comp: number, larg: number, s: number) => {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  return PENA.map(([px, py]) => {
    const a = px * comp;
    const b = py * larg;
    return [(x + a * c - b * sn) * s, y + a * sn + b * c] as const;
  });
};
/** Onde ficam as pontas das penas grandes de cada asa (nas medidas do modelo): é dali que sai o fogo dourado. */
export const PONTAS_DAS_ASAS_DE_ACO: [number, number, number][] = [];
/**
 * Asas de aço (exclusivas): penas escuras em três camadas, cada uma com a borda
 * prateada aparecendo por trás, abrindo para cima como uma lua crescente.
 */
export const asasDeAco = (): Monta => (k) => {
  const GRAU = Math.PI / 180;
  // osso da asa: sai das costas, vai para fora e sobe
  const osso = (u: number): [number, number] => [
    0.04 + 0.5 * Math.pow(u, 0.9),
    0.3 * u + 0.16 * u * u,
  ];
  const camadas: {
    n: number;
    u0: number;
    u1: number;
    a0: number;
    a1: number;
    c0: number;
    c1: number;
    l: number;
    z: number;
  }[] = [
    // penas grandes da ponta (apontam para cima e para fora)
    { n: 10, u0: 0.42, u1: 1, a0: -8, a1: 80, c0: 0.3, c1: 0.46, l: 0.085, z: 0 },
    // penas de baixo (abrem para o lado e para baixo)
    { n: 9, u0: 0.08, u1: 0.62, a0: -82, a1: -18, c0: 0.2, c1: 0.3, l: 0.08, z: -0.006 },
    // penas médias, por cima das outras
    { n: 10, u0: 0.1, u1: 0.96, a0: -70, a1: 62, c0: 0.15, c1: 0.24, l: 0.07, z: -0.014 },
    // penas curtas, cobrindo o osso
    { n: 11, u0: 0.02, u1: 0.9, a0: -64, a1: 50, c0: 0.09, c1: 0.13, l: 0.055, z: -0.022 },
  ];
  PONTAS_DAS_ASAS_DE_ACO.length = 0;
  for (const s of [-1, 1]) {
    const escuras: TH.BufferGeometry[] = [];
    const prata: TH.BufferGeometry[] = [];
    for (const cam of camadas)
      for (let i = 0; i < cam.n; i++) {
        const f = cam.n > 1 ? i / (cam.n - 1) : 0;
        const [x, y] = osso(cam.u0 + (cam.u1 - cam.u0) * f);
        const ang = (cam.a0 + (cam.a1 - cam.a0) * f) * GRAU;
        const comp = cam.c0 + (cam.c1 - cam.c0) * f;
        // cada pena fica um fio à frente da vizinha, para as bordas prateadas aparecerem em escama
        const z = -0.145 + cam.z - i * 0.0012;
        // pena escura na frente e atrás, com a prateada (um pouco maior) no meio: a borda prata aparece dos dois lados
        const lugar = [0.008, s * 0.045, 0.31] as const;
        for (const dz of [0.0065, -0.0065])
          escuras.push(
            k.chapa(
              pena(x, y, ang, comp, cam.l, s),
              lugar[0],
              lugar[1],
              lugar[2],
              z + dz,
              0,
              s * 0.42,
            ),
          );
        prata.push(
          k.chapa(
            pena(
              x - 0.008 * Math.cos(ang),
              y - 0.008 * Math.sin(ang),
              ang,
              comp + 0.026,
              cam.l + 0.026,
              s,
            ),
            0.005,
            lugar[1],
            lugar[2],
            z,
            0,
            s * 0.42,
          ),
        );
        // pontas das penas grandes e de algumas médias: de onde sai o fogo
        if (cam.z === 0 || (cam.z === -0.006 && i % 2 === 0)) {
          const px = (x + Math.cos(ang) * comp) * s;
          const py = y + Math.sin(ang) * comp;
          const giro = s * 0.42;
          PONTAS_DAS_ASAS_DE_ACO.push([
            s * 0.045 + px * Math.cos(giro),
            0.31 + py,
            z - px * Math.sin(giro),
          ]);
        }
      }
    const balanca = (p: readonly [number, number, number]) => Math.abs(p[0]) / 0.55;
    k.forma(
      juntar(prata),
      0xdfe3ea,
      TRONCO,
      { aspereza: 0.24, metal: 0.55, duplo: true, brilho: 0x8f96a3, forcaDoBrilho: 0.35 },
      balanca,
    );
    k.forma(
      juntar(escuras),
      0x1b1c21,
      TRONCO,
      { aspereza: 0.34, metal: 0.6, duplo: true },
      balanca,
    );
  }
};

// ---------------- monta as peças vestidas por cima do modelo ----------------
/**
 * Cria as malhas de todas as peças em `montas` (pela ordem) em cima da pele do
 * modelo (`geo`). `chave` identifica o conjunto, para as peças de pano
 * recortadas ficarem guardadas e servirem a outros HOKIs iguais.
 */
export function vestirModelo(
  THREE: typeof TH,
  geo: TH.BufferGeometry,
  e: Esqueleto,
  pecas: readonly { id: string; montas: readonly Monta[] }[],
  leve: boolean,
) {
  const grupo = new THREE.Group();
  const lixo: { dispose: () => void }[] = [];
  const mPano = materialDeRoupa(THREE, e, { casca: true, leve });
  const mSombra = materialDeSombra(THREE, e, true);
  lixo.push(mPano, mSombra);
  const materiais = new Map<string, TH.Material>();
  const mover = <G extends TH.BufferGeometry>(
    g: G,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return g;
  };
  const contorno = (pontos: readonly (readonly [number, number])[]) => {
    const f = new THREE.Shape();
    pontos.forEach(([x, y], i) => (i ? f.lineTo(x, y) : f.moveTo(x, y)));
    f.closePath();
    return f;
  };
  let id = "";
  let n = 0;
  const kit: Kit = {
    pano(c) {
      const g = criarCasca(THREE, geo, `${id}#${n++}`, c);
      if (!g) return;
      const m = new THREE.Mesh(g, mPano);
      m.castShadow = true;
      m.customDepthMaterial = mSombra;
      grupo.add(m);
    },
    forma(g, cor, ancora, o = {}, balanca) {
      prender(THREE, g, ancora);
      if (balanca) {
        const pos = g.getAttribute("position");
        const solto = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++)
          solto[i] = Math.max(0, Math.min(1, balanca([pos.getX(i), pos.getY(i), pos.getZ(i)])));
        g.setAttribute("hkSolto", new THREE.BufferAttribute(solto, 1));
      }
      const k = [
        cor,
        o.aspereza,
        o.metal,
        o.brilho,
        o.forcaDoBrilho,
        o.transparencia,
        o.duplo,
        !!balanca,
        o.mapa?.uuid,
      ].join("|");
      let m = materiais.get(k);
      if (!m) {
        m = materialDeRoupa(THREE, e, { ...o, cor, leve, solto: !!balanca });
        materiais.set(k, m);
        lixo.push(m);
      }
      const malha = new THREE.Mesh(g, m);
      malha.castShadow = o.transparencia === undefined;
      malha.customDepthMaterial = mSombra;
      grupo.add(malha);
      lixo.push(g);
    },
    pintura(largura, altura, desenha) {
      const tela = document.createElement("canvas");
      tela.width = largura;
      tela.height = altura;
      const c = tela.getContext("2d");
      if (c) desenha(c, largura, altura);
      const t = new THREE.CanvasTexture(tela);
      t.colorSpace = THREE.SRGBColorSpace;
      lixo.push(t);
      return t;
    },
    pano2: (largura, altura, x, y, z, rx, ry, rz) =>
      mover(
        new THREE.PlaneGeometry(largura, altura, leve ? 6 : 14, leve ? 3 : 8),
        x,
        y,
        z,
        rx,
        ry,
        rz,
      ),
    bola(r, x, y, z, sx = 1, sy = 1, sz = 1) {
      const g = new THREE.SphereGeometry(r, leve ? 10 : 22, leve ? 8 : 16);
      g.scale(sx, sy, sz);
      return mover(g, x, y, z);
    },
    tubo: (rt, rb, h, x, y, z, rx, ry, rz, lados = 26) =>
      mover(
        new THREE.CylinderGeometry(rt, rb, h, leve ? Math.min(lados, 12) : lados),
        x,
        y,
        z,
        rx,
        ry,
        rz,
      ),
    aro: (raio, grossura, x, y, z, rx, ry, rz, arco = Math.PI * 2) =>
      mover(
        new THREE.TorusGeometry(raio, grossura, leve ? 6 : 10, leve ? 20 : 44, arco),
        x,
        y,
        z,
        rx,
        ry,
        rz,
      ),
    bloco(l, a, f, canto, x, y, z, rx, ry, rz) {
      const c = Math.min(canto, l / 2 - 0.0005, a / 2 - 0.0005);
      const s = new THREE.Shape();
      s.moveTo(-l / 2 + c, -a / 2);
      s.lineTo(l / 2 - c, -a / 2);
      s.absarc(l / 2 - c, -a / 2 + c, c, -Math.PI / 2, 0, false);
      s.lineTo(l / 2, a / 2 - c);
      s.absarc(l / 2 - c, a / 2 - c, c, 0, Math.PI / 2, false);
      s.lineTo(-l / 2 + c, a / 2);
      s.absarc(-l / 2 + c, a / 2 - c, c, Math.PI / 2, Math.PI, false);
      s.lineTo(-l / 2, -a / 2 + c);
      s.absarc(-l / 2 + c, -a / 2 + c, c, Math.PI, Math.PI * 1.5, false);
      const chanfro = Math.min(c, f / 2) * 0.6;
      const g = new THREE.ExtrudeGeometry(s, {
        depth: f - chanfro * 2,
        bevelEnabled: true,
        bevelThickness: chanfro,
        bevelSize: chanfro,
        bevelOffset: -chanfro,
        bevelSegments: leve ? 1 : 2,
        curveSegments: leve ? 3 : 6,
      });
      g.translate(0, 0, -(f - chanfro * 2) / 2);
      return mover(g, x, y, z, rx, ry, rz);
    },
    torno: (perfil, x, y, z, rx, rz, lados = 28) =>
      mover(
        new THREE.LatheGeometry(
          perfil.map(([r, yy]) => new THREE.Vector2(r, yy)),
          leve ? Math.min(lados, 14) : lados,
        ),
        x,
        y,
        z,
        rx,
        0,
        rz,
      ),
    chapa(pontos, espessura, x, y, z, rx, ry, rz) {
      const chanfro = espessura * 0.22;
      const g = new THREE.ExtrudeGeometry(contorno(pontos), {
        depth: espessura - chanfro * 2,
        bevelEnabled: true,
        bevelThickness: chanfro,
        bevelSize: chanfro,
        bevelOffset: -chanfro,
        bevelSegments: 1,
      });
      g.translate(0, 0, -(espessura - chanfro * 2) / 2);
      return mover(g, x, y, z, rx, ry, rz);
    },
  };
  for (const p of pecas) {
    id = p.id;
    n = 0;
    for (const monta of p.montas) monta(kit);
  }
  return { grupo, descartar: () => lixo.forEach((l) => l.dispose()) };
}

// ---------------- o que cada peça do catálogo desenha ----------------
const K = {
  vermelho: 0xd9151b,
  branco: 0xf4f4f2,
  preto: 0x1c1c1f,
  rosa: 0xf79ac0,
  cinza: 0x9a9aa3,
  jeans: 0x3d6fb4,
  caqui: 0xc9b08a,
  lilas: 0xb692e8,
  bege: 0xe0cfae,
  caramelo: 0xc98a45,
  creme: 0xefe6d2,
  menta: 0x8fe3b4,
  marinho: 0x1f2a52,
  gelo: 0xa9cdf5,
};
const IRIS = [0x8e5bd9, 0x3f7fe8, 0x3fb86a, 0xffd84a, 0xff9a3c, 0xe8413c];
const IRIS_PASTEL = [0xc9a7f0, 0xa9d4f5, 0xa8e6c1, 0xfff1a8, 0xffcfa0, 0xf7a8c8];
const bone = (cor: number): Monta => touca(cor, { ate: 0.778, aba: tom(cor, 0.9), botao: true });
/** Óculos de neve: armação escura em volta da cabeça e uma lente larga, espelhada em prata. */
const oculosDeNeve: Monta = (k) => {
  const arco = Math.PI * 0.84;
  const lente = arco * 0.9;
  k.forma(
    k.aro(0.266, 0.05, 0, 0.572, 0, Math.PI / 2, -(Math.PI / 2 - arco / 2), 0, arco),
    0x0d0d0f,
    CABECA,
    { aspereza: 0.55 },
  );
  k.forma(
    k.aro(0.275, 0.04, 0, 0.572, 0, Math.PI / 2, -(Math.PI / 2 - lente / 2), 0, lente),
    0xe6e9ee,
    CABECA,
    { aspereza: 0.12, metal: 0.15, brilho: 0xdfe4ea, forcaDoBrilho: 0.9 },
  );
  // tira elástica por trás
  k.forma(k.aro(0.262, 0.016, 0, 0.572, 0, Math.PI / 2, 0, 0, Math.PI * 2), 0x141416, CABECA, {
    aspereza: 0.7,
  });
};
/** Bolso da calça cargo: um retângulo do lado de fora de cada coxa, com a tampa em cima. */
const noBolsoCargo = (p: V3) =>
  Math.abs(p[0]) > 0.082 && p[1] > 0.122 && p[1] < 0.198 && Math.abs(p[2]) < 0.062;
/** Calça cargo: a mesma calça, com os bolsos laterais em relevo. */
const calcaCargo =
  (cor: number, bolso: number): Monta =>
  (k) =>
    k.pano({
      dentro: (p) => Math.min(p[1] - 0.066, 0.266 - p[1], semRabo(p)),
      folga: (p, d) => 0.004 + 0.009 * suave(0, 0.012, d) + (noBolsoCargo(p) ? 0.009 : 0),
      cor: (p) =>
        p[1] > 0.25 || p[1] < 0.086
          ? tom(cor, 0.78)
          : noBolsoCargo(p)
            ? p[1] > 0.176
              ? tom(bolso, 1.35)
              : bolso
            : cor,
    });
/** Zíper prateado no meio da jaqueta, com o puxador, e os dois zíperes dos bolsos do peito. */
const zipers: Monta = (k) => {
  const PRATA = 0xc9ced6;
  const metal = { aspereza: 0.25, metal: 0.2, brilho: 0xaab0b9, forcaDoBrilho: 0.55 };
  k.forma(k.bloco(0.007, 0.108, 0.005, 0.002, 0, 0.292, 0.1275, -0.13, 0, 0), PRATA, TRONCO, metal);
  k.forma(k.bloco(0.012, 0.018, 0.006, 0.003, 0, 0.334, 0.124, -0.13, 0, 0), PRATA, TRONCO, metal);
  for (const s of [-1, 1])
    k.forma(
      k.bloco(0.004, 0.03, 0.004, 0.0015, s * 0.078, 0.272, 0.1245, -0.13, 0, s * 0.42),
      PRATA,
      TRONCO,
      metal,
    );
};
/** Recortes em cinza-escuro nos ombros e nas laterais da jaqueta. */
const recortes = (p: V3) =>
  Math.abs(p[0]) > 0.082 && Math.abs(p[0]) < 0.2 && (p[1] > 0.305 || p[1] < 0.268)
    ? 0x2b2b30
    : undefined;
const bucket =
  (cor: number): Monta =>
  (k) => {
    touca(cor, { ate: 0.775 })(k);
    k.forma(
      k.torno(
        [
          [0.2, 0.8],
          [0.25, 0.775],
          [0.33, 0.735],
        ],
        0,
        0,
        0.01,
      ),
      tom(cor, 0.94),
      CABECA,
      { aspereza: 0.9, duplo: true },
    );
  };
const xadrez = (p: V3) =>
  (Math.floor(p[1] / 0.022) + Math.floor((p[2] + 1) / 0.022)) % 2 ? 0xffffff : 0x18181b;
const neon = (p: V3) =>
  Math.abs(Math.abs(p[0]) - 0.072) < 0.006 ||
  Math.abs(p[1] - 0.205) < 0.006 ||
  Math.abs(Math.abs(p[0]) - 0.206) < 0.007 ||
  Math.abs(p[1] - 0.1) < 0.006
    ? 0x23e0ff
    : undefined;
const painel = (p: V3) =>
  p[2] > 0.07 && Math.abs(p[0]) < 0.05 && Math.abs(p[1] - 0.305) < 0.03
    ? 0x39b6d8
    : Math.abs(Math.abs(p[0]) - 0.2) < 0.009 || Math.abs(p[1] - 0.25) < 0.008
      ? 0x39b6d8
      : undefined;
const corrida = (p: V3) =>
  Math.abs(p[1] - 0.255) < 0.01
    ? 0x18181b
    : Math.abs(p[0]) > 0.085 && Math.abs(p[0]) < 0.125 && p[1] < 0.35
      ? xadrez(p)
      : Math.abs(Math.abs(p[0]) - 0.19) < 0.022
        ? xadrez(p)
        : undefined;
const peito =
  (cor: number, brilho?: number): Monta =>
  (k) =>
    k.forma(
      k.tubo(0.03, 0.03, 0.012, 0, 0.305, 0.128, Math.PI / 2, 0, 0, 6),
      cor,
      TRONCO,
      brilho !== undefined ? { brilho, forcaDoBrilho: 1.8 } : brilhante,
    );
const letraH: [number, number][] = [
  [-1, 1],
  [-0.42, 1],
  [-0.42, 0.3],
  [0.42, 0.3],
  [0.42, 1],
  [1, 1],
  [1, -1],
  [0.42, -1],
  [0.42, -0.3],
  [-0.42, -0.3],
  [-0.42, -1],
  [-1, -1],
];
const emblemaH: Monta = (k) =>
  k.forma(
    k.chapa(escala(letraH, 0.022), 0.008, -0.07, 0.315, 0.134, -0.1, -0.35),
    0xffffff,
    TRONCO,
  );
const pretoEm =
  (dentro: Casca["dentro"]): Monta =>
  (k) =>
    k.pano({ dentro, folga: 0.006, cor: () => K.preto });

export const PECAS_3D: Record<string, readonly Monta[]> = {
  // parte de cima
  "roupa:vermelha": [camiseta(K.vermelho)],
  "roupa:branca": [camiseta(K.branco)],
  "roupa:preta": [camiseta(K.preto)],
  "roupa:listrada": [camiseta(K.vermelho, { listras: [K.vermelho, K.preto], barra: K.preto })],
  "roupa:orgulho": [camiseta(0xffffff, { listras: IRIS, barra: 0xffffff })],
  "roupa:moletom-preto": [moletom(K.preto)],
  "roupa:moletom-rosa": [moletom(K.rosa)],
  "roupa:ouro": [moletom(0xe0ad3a, { barra: K.preto, cordoes: K.preto })],
  "roupa:jeans": [jaqueta(K.jeans, { botoes: 0xc9ccd1 })],
  "roupa:college": [
    jaqueta(K.preto, { manga: K.creme, barra: K.creme, gola: K.creme, botoes: 0xffffff }),
  ],
  "roupa:vestido": [vestido(K.lilas)],
  // parte de baixo
  "calca:jeans": [shorts(K.jeans, { barra: tom(K.jeans, 1.35) })],
  "calca:caqui": [shorts(K.caqui)],
  "calca:preta": [shorts(K.preto, { barra: 0xffffff, cordao: 0xffffff })],
  "calca:cinza": [calca(K.cinza, { cordao: 0xffffff })],
  "calca:vermelha": [calca(K.vermelho)],
  "calca:saia": [saia(K.rosa)],
  // calçados e luvas
  "calcado:tenis": [sapato(0xfafafa, { cadarco: 0xd8d8d8, sola: 0xeeeeee })],
  "calcado:tenis-vermelho": [sapato(K.vermelho, { bico: K.preto, cadarco: K.preto })],
  "calcado:tenis-rosa": [sapato(K.rosa, { cadarco: 0xffffff, sola: 0xfde3ee })],
  "calcado:botas": [sapato(K.caramelo, { cano: 0.122, sola: 0x6b4526, cadarco: 0xf2c14e })],
  "luvas:fofas": [luvas(0xffffff)],
  "luvas:ouro": [luvas(OURO, 0xd9a52e)],
  // cabeça e rosto
  "chapeu:bone-vermelho": [bone(K.vermelho)],
  "chapeu:bone-preto": [bone(K.preto)],
  "chapeu:bone-branco": [bone(K.branco)],
  "chapeu:bucket": [bucket(K.bege)],
  "chapeu:gorro": [touca(K.lilas, { ate: 0.735, barra: tom(K.lilas, 0.9) })],
  "chapeu:festa": [chapeuDeFesta()],
  "chapeu:cartola": [cartola()],
  "chapeu:coroa": [coroa()],
  "chapeu:estrela": [tiaraDeEstrela()],
  "chapeu:laco": [laco()],
  "chapeu:fones": [fones()],
  "chapeu:mago": [chapeuDeMago()],
  "chapeu:pirata": [chapeuPirata()],
  "chapeu:explorador": [chapeuDeExplorador()],
  "oculos:escuros": [oculosEscuros()],
  "oculos:visor": [visor()],
  // costas
  "costas:mochila": [mochila()],
  "costas:bolsa": [bolsa(K.bege, "caixa", 0xb89c74)],
  "capa:vermelha": [capa(K.vermelho)],
  "capa:noite": [capa(0x1b1f33, { estrelas: 0xfff3b0, fecho: 0xc9ccd1 })],
  "capa:host": [
    capa(0x0f0f11, {
      estampa: degrade(["#0f0f11", "#0f0f11", "#7a0a0a", "#ce0e0e"]),
      fecho: 0xce0e0e,
    }),
  ],
  "capa:gelo": [
    capa(0xa9cdf5, {
      gola: 0xffffff,
      fecho: 0xdff3ff,
      estampa: degrade(["#eaf6ff", "#a9cdf5", "#6fa8e8"]),
    }),
  ],
  "capa:arcoiris": [
    capa(0xffffff, {
      estampa: listras(["#e8413c", "#ff9a3c", "#ffd84a", "#3fb86a", "#3f7fe8", "#8e5bd9"]),
    }),
  ],
  "capa:fogo": [
    capa(0xff7a2a, {
      estampa: degrade(["#7a1505", "#d9360e", "#ff8a1f", "#ffd84a"]),
      brilho: 0xff5a1a,
      fecho: 0xffd84a,
    }),
  ],
  "capa:real": [capa(0xb3121b, { gola: 0xffffff, fecho: OURO })],
  "bandeira:host": [bandeira(bandeiraHost)],
  "bandeira:orgulho": [
    bandeira(listras(["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"])),
  ],
  "bandeira:trans": [bandeira(listras(["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"]))],
  "bandeira:brasil": [bandeira(bandeiraBrasil)],
  "costas:asas": [asas()],
  "costas:asas-aco": [asasDeAco()],
  // efeitos presos ao corpo (os que flutuam em volta ficam em efeitos.ts)
  "efeito:aureola": [
    (k) =>
      k.forma(k.aro(0.2, 0.022, 0, 1.07, 0.01, Math.PI / 2 - 0.14), 0xffe28a, CABECA, {
        brilho: 0xffc84a,
        forcaDoBrilho: 1.8,
      }),
  ],
  // fantasias completas (o traje é o modelo de sempre, com a roupa por cima)
  "traje:street": [
    camiseta(K.vermelho),
    jaqueta(0x18181b, { gola: 0x0f0f11, botoes: 0xc9ccd1 }),
    calca(0x1f1f23, { barra: 0x2c2c31 }),
    sapato(K.vermelho, { bico: 0xffffff, cadarco: 0xffffff }),
  ],
  "traje:coelho": [
    vestido(K.rosa, 0xfff0f6),
    laco(),
    sapato(K.rosa, { cadarco: 0xffffff, sola: 0xfde3ee }),
    bolsa(0xff8fc8, "coracao"),
  ],
  "traje:mago": [
    vestido(0x6a3fc4, OURO),
    capa(0x4b2aa0, { estrelas: 0xfff3b0, fecho: 0x8a5cf0 }),
    chapeuDeMago(),
    sapato(0x6a3fc4, { sola: 0x4b2aa0 }),
  ],
  "traje:astronauta": [
    macacao(0xf4f6f8, { barra: 0x39b6d8, estampa: painel }),
    luvas(0xf4f6f8, 0x39b6d8),
    sapato(0xf4f6f8, { cano: 0.11, sola: 0x39b6d8 }),
    capacete(),
    peito(0x8fe9ff, 0x39d0f0),
  ],
  "traje:sombra": [
    camiseta(0x0e0e10),
    jaqueta(0x121214, { barra: 0x1d1d21, gola: 0x121214, aberta: 0.0025, estampa: recortes }),
    zipers,
    calcaCargo(0x0f0f11, 0x19191c),
    luvas(0x0c0c0e, 0x1a1a1d),
    sapato(0x0b0b0d, { cano: 0.108, sola: 0x202024, bico: 0x141417, cadarco: 0x2c2c31 }),
    bone(0x131315),
    oculosDeNeve,
  ],
  "traje:cyber": [
    macacao(0x131317, { barra: 0x23e0ff, estampa: neon }),
    luvas(0x131317, 0x23e0ff),
    sapato(0x131317, { sola: 0x23e0ff }),
    peito(0x9af4ff, 0x23e0ff),
  ],
  "traje:explorador": [
    camiseta(0xd8c59a, { barra: 0xb89c74 }),
    shorts(0xc9b08a),
    chapeuDeExplorador(),
    mochila(0x9a6a3a),
    sapato(0x7a5230, { cano: 0.115, sola: 0x4a3018, cadarco: 0xd8c59a }),
  ],
  "traje:gamer": [
    camiseta(K.menta),
    jaqueta(0x18181b, { manga: 0xf4f4f2, barra: 0xf4f4f2, gola: 0xf4f4f2, botoes: 0xffffff }),
    shorts(0x3a8f5c),
    fones(),
    sapato(0xfafafa, { bico: 0x3a8f5c, cadarco: 0x18181b }),
  ],
  "traje:veterano": [
    camiseta(0xfafafa, { barra: OURO }),
    capa(0xb3121b, { gola: 0xffffff }),
    coroa(),
    sapato(0x18181b, { cano: 0.1, sola: OURO, cadarco: OURO }),
  ],
  "traje:arcoiris": [
    moletom(0xffffff, { listras: IRIS_PASTEL, barra: 0xf7a8c8, bolso: false }),
    bolsa(0xffd84a, "estrela", 0xf7a8c8),
    sapato(0xc9a7f0, { cadarco: 0xffffff }),
    tiaraDeEstrela(),
  ],
  "traje:pirata": [
    camiseta(0xf4f4f2),
    jaqueta(K.marinho, { gola: OURO, botoes: OURO, barra: OURO }),
    calca(0x1b1b1f),
    chapeuPirata(),
    sapato(0x5a3a1c, { cano: 0.12, sola: 0x2c1c0c }),
  ],
  "traje:piloto": [
    macacao(K.vermelho, { barra: 0x18181b, estampa: corrida }),
    luvas(0x18181b),
    sapato(K.vermelho, { bico: 0xffffff, cadarco: 0xffffff }),
  ],
  "traje:inverno": [
    calca(K.gelo),
    casaco(K.gelo),
    cachecol(0x8ec5ff),
    touca(0x8ec5ff, { ate: 0.74, barra: 0xffffff, pompom: 0xffffff }),
    sapato(0xcfe3fb, { cano: 0.12, sola: 0xffffff }),
  ],
  "traje:panda": [
    pretoEm((p) => Math.min(Math.abs(p[0]) - 0.142, noCorpo(p))),
    pretoEm((p) => 0.2 - p[1]),
    pretoEm((p) => Math.min(p[1] - 0.835, Math.abs(p[0]) - 0.1)),
  ],
  "traje:original": [
    camiseta(0x18181b),
    jaqueta(0xce0e0e, { manga: 0x18181b, barra: 0x18181b, gola: 0x18181b, botoes: 0xffffff }),
    emblemaH,
    calca(0x18181b),
    sapato(0xce0e0e, { bico: 0x18181b, cadarco: 0xffffff }),
  ],
};
/** Peças 3D que um visual veste, na ordem em que entram (o traje primeiro). */
export const pecasVestidas = (v: Record<string, unknown>) =>
  ["traje", "calca", "roupa", "calcado", "luvas", "costas", "chapeu", "oculos", "efeito"].flatMap(
    (g) => {
      const id = v[g];
      const montas = typeof id === "string" ? PECAS_3D[id] : undefined;
      return typeof id === "string" && montas ? [{ id, montas }] : [];
    },
  );
