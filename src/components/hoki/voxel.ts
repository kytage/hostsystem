/**
 * Peças de construção dos cenários 3D do HOKI, no estilo voxel: blocos
 * coloridos reunidos em malhas instanciadas (milhares de cubos custam um
 * único comando de desenho), árvores, nuvens, o céu e as letras em blocos.
 */
import type * as TH from "three";
import { acabamento, type Acabamento } from "./luz";

export type Sorteio = () => number;
/** Sorteio com semente fixa: o cenário sai igual para todo mundo. */
export function sorteador(semente: number): Sorteio {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Clareia (f > 1) ou escurece (f < 1) uma cor 0xRRGGBB. */
export function tom(cor: number, f: number) {
  const canal = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (canal((cor >> 16) & 255) << 16) | (canal((cor >> 8) & 255) << 8) | canal(cor & 255);
}

interface Bloco {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  cor: number;
  rot: number;
}

/** Acumula caixas coloridas e, no fim, vira uma única malha instanciada. */
export class Blocos {
  private lista: Bloco[] = [];
  constructor(private r: Sorteio = sorteador(1)) {}

  get total() {
    return this.lista.length;
  }
  /** Caixa (sx, sy, sz) com centro em (x, y, z). `variar` muda um pouco o tom de cada bloco. */
  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    cor: number,
    variar = 0.05,
    rot = 0,
  ) {
    this.lista.push({
      x,
      y,
      z,
      sx,
      sy,
      sz,
      cor: variar ? tom(cor, 1 + (this.r() - 0.5) * 2 * variar) : cor,
      rot,
    });
    return this;
  }
  /** Caixa apoiada em y0 (em vez de centrada): boa para empilhar a partir do chão. */
  base(
    x: number,
    y0: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    cor: number,
    variar = 0.05,
    rot = 0,
  ) {
    return this.add(x, y0 + sy / 2, z, sx, sy, sz, cor, variar, rot);
  }
  /**
   * Vira a malha. `acabamento` ajusta a borda arredondada, a junta e o grão dos
   * blocos (cada tipo de coisa pede um: pedra, madeira, folha...).
   */
  construir(
    THREE: typeof TH,
    opcoes: {
      sombra?: boolean;
      recebe?: boolean;
      material?: TH.Material;
      acabamento?: Acabamento;
      aspereza?: number;
    } = {},
  ) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat =
      opcoes.material ??
      acabamento(
        new THREE.MeshStandardMaterial({ roughness: opcoes.aspereza ?? 0.9, metalness: 0 }),
        { chanfro: 0.045, junta: 0.16, pe: 0.2, grao: 0.05, ...opcoes.acabamento },
      );
    const malha = new THREE.InstancedMesh(geo, mat, this.lista.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    this.lista.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(0, b.rot, 0);
      o.scale.set(b.sx, b.sy, b.sz);
      o.updateMatrix();
      malha.setMatrixAt(i, o.matrix);
      malha.setColorAt(i, c.setHex(b.cor));
    });
    malha.instanceMatrix.needsUpdate = true;
    if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
    malha.castShadow = opcoes.sombra ?? true;
    malha.receiveShadow = opcoes.recebe ?? true;
    malha.frustumCulled = false;
    return { malha, descartar: () => (geo.dispose(), mat.dispose()) };
  }
}

const FOLHAS = {
  verde: [0x3f8f2f, 0x55a83a, 0x70c04a],
  amarelo: [0xd3961a, 0xecb62c, 0xf8d350],
  laranja: [0xc4571a, 0xe37725, 0xf49b40],
  pinho: [0x236b42, 0x2e8250, 0x3c985e],
} as const;
const TRONCO = 0x6e4a2b;

export interface OpcoesArvore {
  tipo?: "copa" | "copinha" | "pinheiro";
  cor?: "verde" | "laranja" | "amarelo";
  /** Tamanho de cada bloco da árvore. */
  u?: number;
  /** Altura do chão onde ela nasce. */
  y?: number;
}
/**
 * Árvore de blocos. A copa é um punhado de "bolhas" juntas (só a casca vira
 * bloco), mais clara em cima e mais escura embaixo; o pinheiro é em saias.
 * Cada árvore sai um pouco diferente, mas sempre igual no mesmo lugar.
 * `tronco` deixa pôr a madeira em outro conjunto de blocos (outro acabamento).
 */
export function arvore(b: Blocos, x: number, z: number, o: OpcoesArvore = {}, tronco: Blocos = b) {
  const u = o.u ?? 0.8;
  const y0 = o.y ?? 0;
  const tipo = o.tipo ?? "copa";
  const r = sorteador(Math.round(x * 131 + z * 577 + y0 * 31) + 9000);
  if (tipo === "pinheiro") {
    const fuste = 1.3 + r() * 0.5;
    tronco.base(x, y0, z, u * 0.85, u * 0.4, u * 0.85, TRONCO, 0.06);
    tronco.base(x, y0 + u * 0.4, z, u * 0.55, fuste * u, u * 0.55, TRONCO, 0.06);
    [2.3, 1.4, 1.9, 1.0, 1.4, 0.6, 0].forEach((raio, k) => {
      const alcance = Math.ceil(raio);
      for (let i = -alcance; i <= alcance; i++)
        for (let j = -alcance; j <= alcance; j++)
          if (Math.hypot(i, j) <= raio + 0.01)
            b.base(
              x + i * u,
              y0 + (fuste + 0.2 + k * 0.72) * u,
              z + j * u,
              u,
              u * 0.72,
              u,
              FOLHAS.pinho[k < 2 ? 0 : k < 5 ? 1 : 2],
              0.07,
            );
    });
    return;
  }
  const paleta = FOLHAS[o.cor ?? "verde"];
  const grande = tipo === "copa";
  const fuste = (grande ? 2.1 : 1.5) + r() * 0.7;
  const R = grande ? 2.25 + r() * 0.3 : 1.55 + r() * 0.2;
  tronco.base(x, y0, z, u * 1.05, u * 0.45, u * 1.05, TRONCO, 0.06);
  tronco.base(x, y0 + u * 0.45, z, u * 0.72, (fuste + 0.6) * u, u * 0.72, TRONCO, 0.06);
  // bolhas da copa: uma grande no meio e algumas menores coladas em volta
  const bolhas = [{ x: 0, y: R * 0.8, z: 0, r: R }];
  for (let n = 0; n < (grande ? 4 : 2); n++) {
    const a = r() * Math.PI * 2;
    bolhas.push({
      x: Math.cos(a) * R * 0.72,
      y: R * (0.45 + r() * 0.75),
      z: Math.sin(a) * R * 0.72,
      r: R * (0.5 + r() * 0.22),
    });
  }
  const cheio = (i: number, j: number, k: number) =>
    bolhas.some(
      (s) =>
        ((i - s.x) ** 2 + (j - s.z) ** 2) / (s.r * s.r) + (k - s.y) ** 2 / (s.r * s.r * 0.72) <= 1,
    );
  const lim = Math.ceil(R * 1.8);
  const alto = Math.ceil(R * 2.2);
  for (let k = 0; k <= alto; k++)
    for (let i = -lim; i <= lim; i++)
      for (let j = -lim; j <= lim; j++) {
        if (!cheio(i, j, k)) continue;
        if (
          cheio(i + 1, j, k) &&
          cheio(i - 1, j, k) &&
          cheio(i, j + 1, k) &&
          cheio(i, j - 1, k) &&
          cheio(i, j, k + 1) &&
          cheio(i, j, k - 1)
        )
          continue;
        const nivel = k / (R * 1.7) + (r() - 0.5) * 0.5;
        b.base(
          x + i * u,
          y0 + (fuste + k) * u,
          z + j * u,
          u,
          u,
          u,
          paleta[nivel < 0.34 ? 0 : nivel < 0.72 ? 1 : 2],
          0.06,
        );
      }
}

/** Arbusto: um punhado de blocos de folha, opcionalmente com florzinhas em cima. */
export function arbusto(
  b: Blocos,
  x: number,
  z: number,
  s = 1,
  o: { y?: number; cor?: number; flor?: number } = {},
) {
  const r = sorteador(Math.round(x * 211 + z * 97) + 500);
  const y0 = o.y ?? 0;
  const cor = o.cor ?? FOLHAS.verde[1];
  b.base(x, y0, z, 0.8 * s, 0.55 * s, 0.8 * s, cor, 0.07, r() * 0.6);
  for (let n = 0; n < 3; n++) {
    const a = r() * Math.PI * 2;
    b.base(
      x + Math.cos(a) * 0.38 * s,
      y0,
      z + Math.sin(a) * 0.38 * s,
      0.5 * s,
      (0.3 + r() * 0.35) * s,
      0.5 * s,
      n === 0 ? FOLHAS.verde[2] : FOLHAS.verde[0],
      0.07,
      r(),
    );
  }
  b.base(x, y0 + 0.5 * s, z, 0.5 * s, 0.25 * s, 0.5 * s, FOLHAS.verde[2], 0.06, r());
  if (o.flor !== undefined)
    for (let n = 0; n < 3; n++)
      b.base(
        x + (r() - 0.5) * 0.6 * s,
        y0 + 0.6 * s,
        z + (r() - 0.5) * 0.6 * s,
        0.14 * s,
        0.14 * s,
        0.14 * s,
        o.flor,
        0,
      );
}

/** Pedras soltas: dois ou três blocos cinza de tamanhos diferentes. */
export function pedregulho(b: Blocos, x: number, z: number, s = 1, y0 = 0) {
  const r = sorteador(Math.round(x * 71 + z * 311) + 77);
  b.base(x, y0, z, 0.9 * s, 0.55 * s, 0.7 * s, 0x9c9a94, 0.07, r());
  b.base(x + 0.42 * s, y0, z + 0.2 * s, 0.5 * s, 0.34 * s, 0.5 * s, 0x8a8882, 0.07, r());
  if (r() < 0.6)
    b.base(x - 0.3 * s, y0, z - 0.34 * s, 0.4 * s, 0.26 * s, 0.36 * s, 0xa9a7a0, 0.07, r());
}

/** Céu em degradê (azul mais fundo em cima, claro no horizonte), usado como fundo da cena. */
export function ceu(THREE: typeof TH) {
  const tela = document.createElement("canvas");
  tela.width = 8;
  tela.height = 256;
  const c = tela.getContext("2d");
  if (c) {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#2a78e0");
    g.addColorStop(0.4, "#559ff0");
    g.addColorStop(0.72, "#9fd0fb");
    g.addColorStop(1, "#dcecff");
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 256);
  }
  const t = new THREE.CanvasTexture(tela);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Textura de água: azul vivo com ondinhas claras e alguns riscos brancos.
 * Deslizando o `offset`, a água "corre". Emenda sem costura nos quatro lados.
 */
export function texturaAgua(THREE: typeof TH, semente = 3) {
  const r = sorteador(semente);
  const L = 128;
  const tela = document.createElement("canvas");
  tela.width = tela.height = L;
  const c = tela.getContext("2d");
  if (c) {
    c.fillStyle = "#2f8fe2";
    c.fillRect(0, 0, L, L);
    // desenha cada risco 9 vezes (em volta), para a emenda não aparecer
    const risco = (x: number, y: number, w: number, h: number, cor: string) => {
      c.fillStyle = cor;
      for (const dx of [-L, 0, L]) for (const dy of [-L, 0, L]) c.fillRect(x + dx, y + dy, w, h);
    };
    for (let i = 0; i < 26; i++)
      risco(
        Math.floor(r() * L),
        Math.floor(r() * L),
        14 + Math.floor(r() * 26),
        3 + Math.floor(r() * 3),
        "rgba(36,118,206,0.55)",
      );
    for (let i = 0; i < 30; i++)
      risco(
        Math.floor(r() * L),
        Math.floor(r() * L),
        8 + Math.floor(r() * 22),
        2,
        "rgba(120,196,250,0.75)",
      );
    for (let i = 0; i < 12; i++)
      risco(
        Math.floor(r() * L),
        Math.floor(r() * L),
        5 + Math.floor(r() * 9),
        2,
        "rgba(255,255,255,0.9)",
      );
  }
  const t = new THREE.CanvasTexture(tela);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Textura de queda d'água: fios claros na vertical sobre azul, com espuma branca. */
export function texturaQueda(THREE: typeof TH, semente = 9) {
  const r = sorteador(semente);
  const L = 64;
  const A = 128;
  const tela = document.createElement("canvas");
  tela.width = L;
  tela.height = A;
  const c = tela.getContext("2d");
  if (c) {
    c.fillStyle = "#4ea6ee";
    c.fillRect(0, 0, L, A);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(r() * L);
      const y = Math.floor(r() * A);
      const h = 18 + Math.floor(r() * 50);
      c.fillStyle =
        i % 3 === 0
          ? "rgba(255,255,255,0.92)"
          : i % 3 === 1
            ? "rgba(178,224,255,0.85)"
            : "rgba(47,132,220,0.6)";
      for (const dy of [-A, 0, A]) c.fillRect(x, y + dy, 2 + Math.floor(r() * 3), h);
    }
  }
  const t = new THREE.CanvasTexture(tela);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Nuvens volumosas: cada uma é um punhado de bolas brancas juntas, com a base
 * mais reta. O sol aquece o topo e a parte de baixo fica azulada.
 * `lista` traz [x, y, z, tamanho] de cada nuvem.
 */
export function criarNuvens(
  THREE: typeof TH,
  lista: readonly (readonly [number, number, number, number])[],
  semente = 11,
  nevoa?: Acabamento["nevoa"],
) {
  const r = sorteador(semente);
  const geo = new THREE.SphereGeometry(1, 18, 12);
  const mat = acabamento(
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9fb8e0, emissiveIntensity: 0.62 }),
    nevoa ? { nevoa } : {},
  );
  const aux = new THREE.Object3D();
  const nuvens = lista.map(([x, y, z, s]) => {
    const bolas: [number, number, number, number][] = [];
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const px = ((i + 0.5) / n - 0.5) * 5.2 * s + (r() - 0.5) * 0.5 * s;
      const raio = (0.95 + r() * 0.55) * s * (1 - Math.abs((i + 0.5) / n - 0.5) * 0.7);
      bolas.push([px, raio * 0.55, (r() - 0.5) * 0.9 * s, raio]);
    }
    for (let i = 0; i < 3; i++)
      bolas.push([
        (r() - 0.5) * 2.6 * s,
        (0.95 + r() * 0.5) * s,
        (r() - 0.5) * 0.7 * s,
        (0.8 + r() * 0.5) * s,
      ]);
    const malha = new THREE.InstancedMesh(geo, mat, bolas.length);
    bolas.forEach((b, i) => {
      aux.position.set(b[0], b[1], b[2]);
      aux.scale.set(b[3], b[3] * 0.78, b[3]);
      aux.updateMatrix();
      malha.setMatrixAt(i, aux.matrix);
    });
    malha.instanceMatrix.needsUpdate = true;
    malha.position.set(x, y, z);
    malha.frustumCulled = false;
    return { malha, x0: x };
  });
  return { nuvens, descartar: () => (geo.dispose(), mat.dispose()) };
}

const FONTE_LETRAS = 'Manrope, Inter, "Segoe UI", Arial, sans-serif';
/**
 * Transforma um texto em "tijolos": desenha as letras bem grossas numa grade de
 * `linhas` de altura e junta os quadradinhos acesos em retângulos de tamanhos
 * variados (como blocos de pedra assentados). Funciona com qualquer letra.
 * Devolve os tijolos em unidades da grade: [x0, x1, y0, y1], com y crescendo para baixo.
 */
export function tijolosDoTexto(
  texto: string,
  linhas = 12,
  semente = 5,
  o: { engorda?: number; maior?: [number, number] } = {},
) {
  const S = 8; // pontos do desenho por quadradinho da grade
  const px = Math.round(linhas * S * 1.38);
  const tela = document.createElement("canvas");
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { colunas: 1, linhas, tijolos: [] as number[][], folga: 0 };
  const fonte = `800 ${px}px ${FONTE_LETRAS}`;
  ctx.font = fonte;
  const letras = Array.from(texto);
  const vao = S * 1.1;
  const larguras = letras.map((l) => ctx.measureText(l).width);
  const medida = ctx.measureText(texto || "H");
  const sobe = Math.ceil(medida.actualBoundingBoxAscent || px * 0.72);
  const desce = Math.ceil(medida.actualBoundingBoxDescent || 0);
  // a altura das letras ocupa exatamente as `linhas` da grade
  const escala = (linhas * S) / (sobe + desce);
  tela.width =
    Math.ceil((larguras.reduce((a, b) => a + b, 0) * escala + vao * (letras.length + 1)) / S) * S;
  tela.height = linhas * S;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.font = fonte;
  ctx.fillStyle = ctx.strokeStyle = "#fff";
  ctx.lineJoin = "miter";
  ctx.lineWidth = px * 0.045;
  let x = vao / escala;
  letras.forEach((l, i) => {
    ctx.strokeText(l, x, sobe);
    ctx.fillText(l, x, sobe);
    x += larguras[i]! + vao / escala;
  });
  // `engorda` cresce as letras para todos os lados (serve para fazer um contorno por trás);
  // a grade ganha essa mesma folga em volta, e é devolvida em `folga`
  const e = Math.max(0, Math.round(o.engorda ?? 0));
  const larguraGrade = tela.width / S;
  const colunas = larguraGrade + e * 2;
  const alturaGrade = linhas;
  linhas += e * 2;
  const dados = ctx.getImageData(0, 0, tela.width, tela.height).data;
  const aceso = new Uint8Array(colunas * linhas);
  for (let j = 0; j < alturaGrade; j++)
    for (let i = 0; i < larguraGrade; i++) {
      let soma = 0;
      for (let v = 0; v < S; v++)
        for (let h = 0; h < S; h++) soma += dados[((j * S + v) * tela.width + i * S + h) * 4 + 3]!;
      if (soma / (S * S) <= 118) continue;
      for (let dj = -e; dj <= e; dj++)
        for (let di = -e; di <= e; di++) aceso[i + e + di + (j + e + dj) * colunas] = 1;
    }
  // junta os quadradinhos em tijolos de até 4 x 3, sorteando o tamanho de cada um
  const r = sorteador(semente + texto.length * 13);
  const tijolos: number[][] = [];
  for (let j = 0; j < linhas; j++)
    for (let i = 0; i < colunas; i++) {
      if (!aceso[i + j * colunas]) continue;
      const maxL = 2 + Math.floor(r() * ((o.maior?.[0] ?? 4) - 1));
      const maxA = 1 + Math.floor(r() * (o.maior?.[1] ?? 3));
      let l = 1;
      while (l < maxL && i + l < colunas && aceso[i + l + j * colunas]) l++;
      let a = 1;
      const linhaCheia = (jj: number) => {
        for (let k = 0; k < l; k++) if (!aceso[i + k + jj * colunas]) return false;
        return true;
      };
      while (a < maxA && j + a < linhas && linhaCheia(j + a)) a++;
      for (let v = 0; v < a; v++) for (let h = 0; h < l; h++) aceso[i + h + (j + v) * colunas] = 0;
      tijolos.push([i, i + l, j, j + a]);
    }
  return { colunas, linhas, tijolos, folga: e };
}

export interface OpcoesLetras {
  linhas?: number;
  cores?: readonly number[];
  /** Quanto alguns blocos saem para a frente ou afundam (0 = tudo liso, 1 = bastante). */
  relevo?: number;
  /** Maior tijolo, em quadradinhos: [largura, altura]. */
  maior?: [number, number];
  /** Cresce as letras para os lados (em quadradinhos), para servir de contorno por trás de outra camada. */
  engorda?: number;
  /** Onde fica a frente dos blocos, no eixo Z. */
  z?: number;
}
/**
 * Escreve um texto em blocos de pedra, centrado na origem do conjunto, com a
 * base em y = 0 e a frente virada para +Z. Alguns blocos saem um pouco para a
 * frente, para dar relevo. Devolve a largura e a altura ocupadas pelas letras.
 */
export function letrasDePedra(
  b: Blocos,
  texto: string,
  u: number,
  fundo: number,
  o: OpcoesLetras = {},
) {
  const linhas = o.linhas ?? 12;
  const cores = o.cores ?? [0xf7f3ea, 0xefe9dc, 0xfbf8f1, 0xe9e2d3];
  const { colunas, tijolos, folga } = tijolosDoTexto(texto, linhas, 5, {
    engorda: o.engorda ?? 0,
    maior: o.maior ?? [4, 3],
  });
  const r = sorteador(texto.length * 7 + 3);
  const relevo = o.relevo ?? 1;
  for (const [x0, x1, y0, y1] of tijolos as [number, number, number, number][]) {
    const salto = (r() < 0.3 ? u * 0.28 : r() < 0.25 ? -u * 0.2 : 0) * relevo;
    b.add(
      ((x0 + x1) / 2 - colunas / 2) * u,
      (linhas + folga - (y0 + y1) / 2) * u,
      (o.z ?? fundo / 2) - (fundo - salto) / 2,
      (x1 - x0) * u,
      (y1 - y0) * u,
      fundo + salto,
      cores[Math.floor(r() * cores.length)] ?? 0xf1ecdf,
      0.02,
    );
  }
  return { largura: (colunas - folga * 2) * u, altura: linhas * u };
}

/** Anel vermelho da marca: uma argola larga e baixa, de vinil brilhante. Fica deitada no plano XY. */
export function anelDaMarca(THREE: typeof TH, raio: number, largura: number) {
  const geo = new THREE.TorusGeometry(raio, largura, 14, 96);
  geo.scale(1, 1, 0.5);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe0161b,
    roughness: 0.32,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.castShadow = true;
  return { malha, descartar: () => (geo.dispose(), mat.dispose()) };
}
