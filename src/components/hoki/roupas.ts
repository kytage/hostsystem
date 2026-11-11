/**
 * Roupas do HOKI, feitas para o modelo 3D original. Cada peça de pano é uma
 * "casca": um pedaço da própria pele do modelo, afastado um pouquinho para
 * fora — por isso veste certinho e dobra junto com o corpo em qualquer pose.
 * Acessórios duros (chapéus, óculos, mochila) são formas presas a um ponto do
 * corpo, e acompanham quando esse ponto se mexe.
 */
import type * as TH from "three";
import { comEsqueleto, materialDeSombra, type Esqueleto } from "./corpo";

export type V3 = readonly [number, number, number];
const limita = (v: number) => Math.max(0, Math.min(1, v));
/** Passagem suave de 0 a 1 entre `a` e `b`. */
export const suave = (a: number, b: number, x: number) => {
  const t = limita((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Altura em que o corpo (tronco, braço, mão) termina e começa a parte de baixo da cabeça, a cada distância do centro. */
export const tetoDoCorpo = (ax: number) =>
  0.362 + suave(0.12, 0.15, ax) * 0.014 + Math.max(0, ax - 0.15) * 0.62;
/** Quanto o ponto está dentro do corpo (abaixo da cabeça): positivo dentro. */
export const noCorpo = (p: V3) => tetoDoCorpo(Math.abs(p[0])) - p[1] - 0.012;
/** Pontos do corpo onde os acessórios se prendem. */
export const ANCORA = {
  cabeca: [0, 0.7, 0],
  tronco: [0, 0.34, 0],
  quadril: [0, 0.2, 0],
  maoE: [-0.33, 0.33, 0.02],
  maoD: [0.33, 0.33, 0.02],
} as const satisfies Record<string, V3>;

export interface Casca {
  /** Quanto o ponto está dentro da peça, em unidades do modelo: positivo dentro, zero na barra. */
  dentro: (p: V3) => number;
  /** Folga do pano em relação ao corpo naquele ponto. */
  folga: number | ((p: V3, dentro: number) => number);
  /** Cor do pano naquele ponto (0xRRGGBB). */
  cor: (p: V3) => number;
}

const guardadas = new Map<string, TH.BufferGeometry | null>();
/**
 * Recorta da pele do modelo a parte que a peça cobre e afasta para fora.
 * A barra fica exatamente onde `dentro` vale zero (o resto é descartado no
 * desenho), então a borda sai lisa mesmo com a malha grossa. Fica guardada:
 * vários HOKIs com a mesma peça dividem a mesma malha.
 */
export function criarCasca(THREE: typeof TH, geo: TH.BufferGeometry, chave: string, c: Casca) {
  const id = geo.uuid + "|" + chave;
  const pronta = guardadas.get(id);
  if (pronta !== undefined) return pronta;
  const pos = geo.getAttribute("position") as TH.BufferAttribute;
  const nor = geo.getAttribute("normal") as TH.BufferAttribute;
  const idx = geo.getIndex();
  const n = pos.count;
  const dentro = new Float32Array(n);
  let algum = false;
  for (let i = 0; i < n; i++) {
    const d = c.dentro([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    dentro[i] = d;
    if (d > 0) algum = true;
  }
  if (!algum || !idx) {
    guardadas.set(id, null);
    return null;
  }
  const mapa = new Int32Array(n).fill(-1);
  const P: number[] = [];
  const N: number[] = [];
  const C: number[] = [];
  const B: number[] = [];
  const D: number[] = [];
  const I: number[] = [];
  const cor = new THREE.Color();
  const usar = (i: number) => {
    const ja = mapa[i]!;
    if (ja >= 0) return ja;
    const p: V3 = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const d = dentro[i]!;
    const f =
      typeof c.folga === "number"
        ? c.folga * (0.3 + 0.7 * suave(0, 0.014, d))
        : c.folga(p, Math.max(0, d));
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    P.push(p[0] + nx * f, p[1] + ny * f, p[2] + nz * f);
    N.push(nx, ny, nz);
    cor.setHex(c.cor(p));
    C.push(cor.r, cor.g, cor.b);
    B.push(p[0], p[1], p[2]);
    D.push(d);
    return (mapa[i] = P.length / 3 - 1);
  };
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t);
    const b = idx.getX(t + 1);
    const d = idx.getX(t + 2);
    if (dentro[a]! <= 0 && dentro[b]! <= 0 && dentro[d]! <= 0) continue;
    I.push(usar(a), usar(b), usar(d));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute("hkBase", new THREE.Float32BufferAttribute(B, 3));
  g.setAttribute("hkDentro", new THREE.Float32BufferAttribute(D, 1));
  g.setIndex(I);
  guardadas.set(id, g);
  return g;
}

/** Marca numa forma o ponto do corpo que ela acompanha (cabeça, tronco, mão...). */
export function prender<G extends TH.BufferGeometry>(THREE: typeof TH, geo: G, ancora: V3): G {
  const n = geo.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(ancora, i * 3);
  geo.setAttribute("hkBase", new THREE.BufferAttribute(a, 3));
  return geo;
}

export interface OpcoesDePano {
  /** Peça recortada do corpo (com barra descartada no desenho e avesso mais escuro). */
  casca?: boolean;
  /** Versão leve, para a praça. */
  leve?: boolean;
  /** Desenha os dois lados (panos soltos, como saia e capa). */
  duplo?: boolean;
  /** Pano que balança sozinho (a malha precisa do atributo `hkSolto`). */
  solto?: boolean;
  /** Imagem pintada no pano (bandeiras, capas estampadas). */
  mapa?: TH.Texture;
  cor?: number;
  aspereza?: number;
  metal?: number;
  /** Cor que a peça emite (luzes, neon). */
  brilho?: number;
  forcaDoBrilho?: number;
  transparencia?: number;
}
/** Material de pano (feltro macio) ou de acessório, já ligado ao esqueleto. */
export function materialDeRoupa(THREE: typeof TH, e: Esqueleto, o: OpcoesDePano = {}) {
  const base = {
    color: o.casca ? 0xffffff : (o.cor ?? 0xffffff),
    vertexColors: !!o.casca,
    roughness: o.aspereza ?? 0.88,
    metalness: o.metal ?? 0,
    side: o.casca || o.duplo ? THREE.DoubleSide : THREE.FrontSide,
    emissive: o.brilho ?? 0x000000,
    emissiveIntensity: o.brilho !== undefined ? (o.forcaDoBrilho ?? 1.4) : 0,
    transparent: o.transparencia !== undefined,
    opacity: o.transparencia ?? 1,
    map: o.mapa ?? null,
    polygonOffset: !!o.casca,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  };
  // feltro: um brilho rasante bem suave, como tecido de pelúcia (só na versão completa)
  const m =
    o.leve || !o.casca
      ? new THREE.MeshStandardMaterial(base)
      : new THREE.MeshPhysicalMaterial({
          ...base,
          sheen: 0.7,
          sheenRoughness: 0.55,
          sheenColor: 0xffffff,
        });
  m.defines = { ...m.defines, HK_ROUPA: "" };
  if (o.casca) m.defines["HK_CASCA"] = "";
  if (o.solto) m.defines["HK_SOLTO"] = "";
  m.onBeforeCompile = (sh) => {
    comEsqueleto(sh, e);
    if (!o.casca) return;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float hkDentro;\nvarying float vHkDentro;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHkDentro = hkDentro;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vHkDentro;")
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\n  if ( vHkDentro < 0.0 ) discard;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n  if ( ! gl_FrontFacing ) diffuseColor.rgb *= 0.5;",
      );
  };
  m.customProgramCacheKey = () =>
    `hk-roupa|${o.casca ? "casca" : "forma"}|${o.leve ? "leve" : "cheia"}|${o.solto ? "solto" : "preso"}`;
  return m;
}
export { materialDeSombra };
