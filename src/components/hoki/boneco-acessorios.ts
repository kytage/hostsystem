import type * as TH from "three";
import { criarRastro, tempoVip, viseira, VIP_BLACK } from "./boneco-vip";
import { criarEnfeite, type Enfeite } from "./boneco-enfeites";

/**
 * Cosméticos do boneco (presos aos ossos, então acompanham as animações):
 * - "chapeu:coroa-glitter": coroa dourada com pedrinhas e glitter que cintila;
 * - "costas:capa-glitter": capa preta com glitter preto (pontinhos prateados
 *   que piscam), balançando parada e voando para trás quando o boneco corre;
 * - os chapéus, orelhinhas, ursinho, asinhas e coraçõezinhos de boneco-enfeites.ts.
 *
 * As medidas são do boneco parado (metros, pés em y = 0, rosto para +Z).
 */

export const COROA_GLITTER = "chapeu:coroa-glitter";
export const CAPA_GLITTER = "costas:capa-glitter";

/** Relógio do glitter (um só para todos os bonecos). */
const tempo = { value: 0 };
export { VIP_BLACK };

/** Material com glitter: pontinhos que acendem e apagam em tempos diferentes. */
function comGlitter(
  mat: TH.MeshStandardMaterial,
  o: { densidade: number; cor: string; forca: number; raros: number },
  extra?: (shader: TH.WebGLProgramParametersWithUniforms) => void,
) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms["uTempoGlitter"] = tempo;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosGlitter;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPosGlitter = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vPosGlitter;
        uniform float uTempoGlitter;
        float hashGlitter(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 celula = floor(vPosGlitter * ${o.densidade.toFixed(1)});
          float h = hashGlitter(celula);
          float pisca = pow(max(0.0, sin(uTempoGlitter * (2.0 + h * 5.0) + h * 40.0)), 18.0);
          float aceso = step(${(1 - o.raros).toFixed(3)}, hashGlitter(celula + 7.3)) * pisca;
          totalEmissiveRadiance += vec3(${hexVec(o.cor)}) * aceso * ${o.forca.toFixed(2)};
        }`,
      );
    extra?.(shader);
  };
  mat.customProgramCacheKey = () => `glitter-${o.cor}-${o.densidade}-${extra ? "x" : ""}`;
  return mat;
}
const hexVec = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(", ");
};

/** Um suporte preso ao osso, cujo "chão" é o do boneco parado (para montar em metros). */
function suporte(THREE: typeof TH, figura: TH.Object3D, osso: string) {
  const o = figura.getObjectByName(osso);
  if (!o) return null;
  figura.updateMatrixWorld(true);
  // o suporte fica com o mesmo "chão" do boneco (inclusive a escala): dá para montar em metros
  const pai = new THREE.Group();
  pai.name = "suporte-acessorio";
  const local = new THREE.Matrix4().copy(o.matrixWorld).invert().multiply(figura.matrixWorld);
  local.decompose(pai.position, pai.quaternion, pai.scale);
  o.add(pai);
  return pai;
}

let geoCoroa: TH.BufferGeometry[] | null = null;
let matCoroa: TH.MeshStandardMaterial | null = null;
let matPedra: TH.MeshStandardMaterial | null = null;

function coroa(THREE: typeof TH, alturaCabeca: number) {
  if (!geoCoroa) {
    const aro = new THREE.CylinderGeometry(0.074, 0.07, 0.04, 28, 1, true);
    const pontas: TH.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const ponta = new THREE.ConeGeometry(0.016, i % 2 ? 0.045 : 0.06, 4);
      ponta.translate(Math.sin(a) * 0.071, 0.02 + (i % 2 ? 0.022 : 0.03), Math.cos(a) * 0.071);
      pontas.push(ponta);
      const bolinha = new THREE.SphereGeometry(0.008, 8, 6);
      bolinha.translate(Math.sin(a) * 0.071, 0.02 + (i % 2 ? 0.046 : 0.062), Math.cos(a) * 0.071);
      pontas.push(bolinha);
    }
    const pedras: TH.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const p = new THREE.OctahedronGeometry(0.011);
      p.translate(Math.sin(a) * 0.076, 0, Math.cos(a) * 0.076);
      pedras.push(p);
    }
    geoCoroa = [aro, ...pontas, ...pedras];
    matCoroa = comGlitter(
      new THREE.MeshStandardMaterial({
        color: 0xf2c230,
        metalness: 0.75,
        roughness: 0.28,
        emissive: 0x3a2500,
        side: THREE.DoubleSide,
      }),
      { densidade: 260, cor: "#fff3c4", forca: 2.6, raros: 0.35 },
    );
    matPedra = comGlitter(
      new THREE.MeshStandardMaterial({
        color: 0xd4142a,
        metalness: 0.2,
        roughness: 0.15,
        emissive: 0x40030a,
      }),
      { densidade: 400, cor: "#ffd0d6", forca: 1.8, raros: 0.5 },
    );
  }
  const grupo = new THREE.Group();
  geoCoroa.forEach((g, i) => {
    const m = new THREE.Mesh(g, i >= geoCoroa!.length - 4 ? matPedra! : matCoroa!);
    m.castShadow = true;
    grupo.add(m);
  });
  grupo.position.set(0, alturaCabeca - 0.012, 0.004);
  grupo.rotation.x = -0.08;
  grupo.name = "coroa-glitter";
  return grupo;
}

let geoCapa: TH.BufferGeometry | null = null;
function capa(THREE: typeof TH) {
  if (!geoCapa) {
    // capa presa nos ombros: em cima estreita e curva nas costas, embaixo mais larga
    const g = new THREE.PlaneGeometry(1, 1, 10, 18);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i); // -0,5..0,5
      const v = 0.5 - pos.getY(i); // 0 em cima, 1 embaixo
      const largura = 0.3 + v * 0.16;
      const x = u * largura;
      const y = -v * 0.86;
      const z = -0.02 - v * 0.06 - u * u * -0.18 * (1 - v * 0.5);
      pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    geoCapa = g;
  }
  const voo = { value: 0 };
  const mat = comGlitter(
    new THREE.MeshStandardMaterial({
      color: 0x0c0c0e,
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
    { densidade: 120, cor: "#9a9aa8", forca: 1.4, raros: 0.4 },
    (shader) => {
      // balanço: cresce para baixo; correndo, a ponta levanta e ondula mais
      shader.uniforms["uVoo"] = voo;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uVoo;\nuniform float uTempoGlitter;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float baixo = clamp(-position.y / 0.86, 0.0, 1.0);
          float onda = sin(uTempoGlitter * (2.2 + uVoo * 6.0) - baixo * 5.0 + position.x * 6.0);
          transformed.z += (onda * (0.012 + uVoo * 0.035) - uVoo * 0.32 * baixo * baixo) * baixo;
          transformed.y += uVoo * 0.12 * baixo * baixo;`,
        );
    },
  );
  const m = new THREE.Mesh(geoCapa, mat);
  m.castShadow = true;
  m.name = "capa-glitter";
  // presa atrás dos ombros
  m.position.set(0, 1.505, -0.135);
  return { malha: m, voo, mat };
}

/** Põe os cosméticos escolhidos no boneco. Devolve o que precisa andar a cada quadro. */
export function vestirAcessorios(
  THREE: typeof TH,
  figura: TH.Object3D,
  o: {
    chapeu?: string | undefined;
    costas?: string | undefined;
    traje?: string | undefined;
    efeito?: string | undefined;
    alturaCabeca: number;
  },
) {
  // (a mesma figura pode ser vestida de novo, como na aba TESTE: tira o que já tinha)
  const velhos: TH.Object3D[] = [];
  figura.traverse((x) => x.name === "suporte-acessorio" && velhos.push(x));
  for (const v of velhos) v.removeFromParent();
  let voo: { value: number } | null = null;
  const lixo: { dispose: () => void }[] = [];
  if (o.chapeu === COROA_GLITTER) {
    const s = suporte(THREE, figura, "Head");
    s?.add(coroa(THREE, o.alturaCabeca));
  }
  if (o.costas === CAPA_GLITTER) {
    const s = suporte(THREE, figura, "spine_03");
    if (s) {
      const c = capa(THREE);
      s.add(c.malha);
      voo = c.voo;
      lixo.push(c.mat);
    }
  }
  // os enfeites novos (chapéus, costas e efeitos)
  const animados: Enfeite[] = [];
  for (const id of [o.chapeu, o.costas, o.efeito]) {
    if (!id) continue;
    const e = criarEnfeite(THREE, id, o.alturaCabeca);
    if (!e) continue;
    let s: TH.Object3D | null;
    if (e.osso) s = suporte(THREE, figura, e.osso);
    else {
      // solto em volta do corpo: no mesmo "chão" do boneco
      s = new THREE.Group();
      s.name = "suporte-acessorio";
      figura.add(s);
    }
    if (!s) continue;
    s.add(e.enfeite.objeto);
    if (e.enfeite.animar) animados.push(e.enfeite);
  }
  let rastro: ReturnType<typeof criarRastro> | null = null;
  if (o.traje === VIP_BLACK) {
    const s = suporte(THREE, figura, "Head");
    s?.add(viseira(THREE, o.alturaCabeca - 0.122));
    rastro = criarRastro(THREE, figura);
    lixo.push({ dispose: () => rastro?.descartar() });
  }
  let vooSuave = 0;
  return {
    /** t em segundos; `mexendo` de 0 (parado) a 1 (correndo). */
    atualizar(t: number, mexendo: number, dt: number) {
      tempo.value = t;
      tempoVip.value = t;
      rastro?.atualizar(dt, mexendo);
      vooSuave += (mexendo - vooSuave) * Math.min(1, dt * 4);
      if (voo) voo.value = vooSuave;
      for (const a of animados) a.animar?.(t, vooSuave);
    },
    descartar() {
      for (const l of lixo) l.dispose();
    },
  };
}
