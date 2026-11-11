/**
 * Modelo 3D do HOKI clássico: leitura do binário (gerado a partir do .obj),
 * da textura e de uma versão leve, com as cores gravadas nos vértices, para
 * quando há vários HOKIs na tela ao mesmo tempo (a praça).
 */
import type * as TH from "three";

export interface DadosModelo {
  pos: Float32Array;
  uv: Float32Array;
  nor: Float32Array;
  idx: Uint32Array;
}
/** Malha pronta para o mascote: com textura (pódio) ou só com cores nos vértices (versão leve). */
export interface Modelo {
  geo: TH.BufferGeometry;
  tex?: TH.Texture;
}

let dados: Promise<DadosModelo | null> | null = null;
/** Lê o binário do modelo uma vez só; as próximas chamadas reaproveitam. */
export function lerModelo() {
  dados ??= fetch("/hoki/hoki.bin")
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("modelo"))))
    .then((buf) => {
      const dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x48534f48) throw new Error("formato");
      const n = dv.getUint32(4, true);
      const ni = dv.getUint32(8, true);
      const mn = [0, 1, 2].map((i) => dv.getFloat32(12 + i * 4, true));
      const mx = [0, 1, 2].map((i) => dv.getFloat32(24 + i * 4, true));
      let o = 36;
      const qPos = new Uint16Array(buf, o, n * 3);
      o += n * 6;
      const qUv = new Uint16Array(buf.slice(o, o + n * 4));
      o += n * 4;
      const qNor = new Int8Array(buf, o, n * 3);
      o += n * 3;
      o += (4 - (o % 4)) % 4;
      const idx = new Uint32Array(buf, o, ni);
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++)
        pos[i] = mn[i % 3]! + (qPos[i]! / 65535) * (mx[i % 3]! - mn[i % 3]!);
      const uv = new Float32Array(n * 2);
      for (let i = 0; i < n * 2; i++) uv[i] = qUv[i]! / 65535;
      const nor = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) nor[i] = qNor[i]! / 127;
      return { pos, uv, nor, idx };
    })
    .catch(() => null);
  return dados;
}

let imagem: Promise<HTMLImageElement | null> | null = null;
function lerImagem() {
  imagem ??= new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = "/hoki/hoki.webp";
  });
  return imagem;
}

/** Malha completa com textura. Cada palco monta a sua; os dados brutos são os mesmos. */
export async function modeloCompleto(THREE: typeof TH): Promise<Modelo | undefined> {
  const [d, im] = await Promise.all([lerModelo(), lerImagem()]);
  if (!d || !im) return undefined;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(d.pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(d.nor, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(d.uv, 2));
  geo.setIndex(new THREE.BufferAttribute(d.idx, 1));
  const tex = new THREE.Texture(im);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { geo, tex };
}

interface Leve {
  pos: Float32Array;
  cor: Float32Array;
  idx: Uint32Array;
}
/**
 * Simplifica a malha juntando os vértices que caem na mesma "célula" de uma
 * grade e copia a cor da textura para cada vértice. Fica com uma fração dos
 * triângulos e sem textura: ideal para o HOKI visto de longe, na praça.
 */
function simplificar(d: DadosModelo, im: HTMLImageElement, celulas = 60): Leve {
  const n = d.pos.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 3; i++) {
    const v = d.pos[i]!;
    if (v < min[i % 3]!) min[i % 3] = v;
    if (v > max[i % 3]!) max[i % 3] = v;
  }
  const lado = Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!) / celulas;
  const T = 256;
  const tela = document.createElement("canvas");
  tela.width = tela.height = T;
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  ctx?.drawImage(im, 0, 0, T, T);
  const px = ctx?.getImageData(0, 0, T, T).data;

  const grupos = new Map<number, number>();
  const novo = new Uint32Array(n);
  const soma: number[] = []; // por grupo: x, y, z, r, g, b, quantos
  for (let i = 0; i < n; i++) {
    const x = d.pos[i * 3]!;
    const y = d.pos[i * 3 + 1]!;
    const z = d.pos[i * 3 + 2]!;
    const chave =
      Math.floor((x - min[0]!) / lado) +
      Math.floor((y - min[1]!) / lado) * 256 +
      Math.floor((z - min[2]!) / lado) * 65536;
    let k = grupos.get(chave);
    if (k === undefined) {
      k = soma.length / 7;
      grupos.set(chave, k);
      soma.push(0, 0, 0, 0, 0, 0, 0);
    }
    novo[i] = k;
    const u = Math.min(T - 1, Math.max(0, Math.floor(d.uv[i * 2]! * T)));
    const v = Math.min(T - 1, Math.max(0, Math.floor((1 - d.uv[i * 2 + 1]!) * T)));
    const p = (u + v * T) * 4;
    const o = k * 7;
    soma[o] = soma[o]! + x;
    soma[o + 1] = soma[o + 1]! + y;
    soma[o + 2] = soma[o + 2]! + z;
    soma[o + 3] = soma[o + 3]! + (px ? px[p]! : 255);
    soma[o + 4] = soma[o + 4]! + (px ? px[p + 1]! : 255);
    soma[o + 5] = soma[o + 5]! + (px ? px[p + 2]! : 255);
    soma[o + 6] = soma[o + 6]! + 1;
  }
  const m = soma.length / 7;
  const pos = new Float32Array(m * 3);
  const cor = new Float32Array(m * 3);
  // a textura está em sRGB; as cores de vértice precisam ir em linear
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  for (let k = 0; k < m; k++) {
    const q = soma[k * 7 + 6]!;
    for (let e = 0; e < 3; e++) {
      pos[k * 3 + e] = soma[k * 7 + e]! / q;
      cor[k * 3 + e] = linear(soma[k * 7 + 3 + e]! / q / 255);
    }
  }
  const vistos = new Set<string>();
  const idx: number[] = [];
  for (let t = 0; t < d.idx.length; t += 3) {
    const a = novo[d.idx[t]!]!;
    const b = novo[d.idx[t + 1]!]!;
    const c = novo[d.idx[t + 2]!]!;
    if (a === b || b === c || a === c) continue;
    const chave = [a, b, c].sort((p, q) => p - q).join("-");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    idx.push(a, b, c);
  }
  return { pos, cor, idx: new Uint32Array(idx) };
}

let leve: Promise<Leve | null> | null = null;
/** Versão leve do modelo, com cores nos vértices. Calculada uma vez e reaproveitada. */
export async function modeloLeve(THREE: typeof TH): Promise<Modelo | undefined> {
  leve ??= Promise.all([lerModelo(), lerImagem()]).then(([d, im]) =>
    d && im ? simplificar(d, im) : null,
  );
  const l = await leve;
  if (!l) return undefined;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(l.pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(l.cor, 3));
  geo.setIndex(new THREE.BufferAttribute(l.idx, 1));
  geo.computeVertexNormals();
  return { geo };
}
