import type * as TH from "three";
import type { Corpo } from "./boneco";

/**
 * Traje VIP BLACK (cosmético, 2.500 Staff Coins):
 * - o corpo inteiro preto brilhante, como látex (verniz com reflexo e contorno claro);
 * - uma viseira laranja neon na altura dos olhos, dando a volta na cabeça;
 * - os pés pretos também; o neon laranja é só o rastro: andando, um pouco atrás
 *   dos pés, fica uma trilha de faíscas laranja que vai sumindo.
 *
 * As medidas são do boneco parado (metros, pés em y = 0, rosto para +Z).
 */

export const VIP_BLACK = "traje:vip-black";
const LARANJA = "#ff6a00";

/** Relógio do brilho (um só para todos). */
export const tempoVip = { value: 0 };

const materiais = new Map<Corpo, TH.MeshPhysicalMaterial>();

/** Corpo de látex preto com os pés de glitter laranja. */
export function materialVip(THREE: typeof TH, corpo: Corpo) {
  const pronto = materiais.get(corpo);
  if (pronto) return pronto;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x060607,
    roughness: 0.22,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    specularIntensity: 1,
  });
  mat.name = `vip-black-${corpo}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms["uTempoVip"] = tempoVip;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOrigVip;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOrigVip = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vOrigVip;
        uniform float uTempoVip;
        float hashVip(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          // contorno claro (como o reflexo do látex nas bordas)
          float borda = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
          totalEmissiveRadiance += vec3(0.38, 0.4, 0.46) * borda * 0.55;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `vip-black-${corpo}`;
  materiais.set(corpo, mat);
  return mat;
}

let geoViseira: TH.BufferGeometry | null = null;
let matViseira: TH.MeshBasicMaterial | null = null;
let matBrilho: TH.MeshBasicMaterial | null = null;

/** Viseira laranja neon: uma faixa curva na frente e nos lados da cabeça. */
export function viseira(THREE: typeof TH, alturaOlhos: number) {
  if (!geoViseira) {
    // cilindro aberto, só 230 graus (a parte de trás fica sem)
    geoViseira = new THREE.CylinderGeometry(
      0.094,
      0.091,
      0.05,
      40,
      1,
      true,
      -Math.PI * 0.64,
      Math.PI * 1.28,
    );
    matViseira = new THREE.MeshBasicMaterial({
      color: LARANJA,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    matBrilho = new THREE.MeshBasicMaterial({
      color: LARANJA,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }
  const grupo = new THREE.Group();
  grupo.name = "viseira-vip";
  const faixa = new THREE.Mesh(geoViseira, matViseira!);
  const halo = new THREE.Mesh(geoViseira, matBrilho!);
  halo.scale.set(1.12, 1.6, 1.12);
  grupo.add(faixa, halo);
  // a cabeça é mais funda na frente do que larga: a faixa vira uma elipse que passa por fora do rosto
  grupo.scale.set(1.08, 1.15, 1.42);
  grupo.position.set(0, alturaOlhos, 0.012);
  return grupo;
}

let texFaisca: TH.CanvasTexture | null = null;
function faisca(THREE: typeof TH) {
  if (texFaisca) return texFaisca;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,190,90,0.95)");
    r.addColorStop(0.6, "rgba(255,106,0,0.35)");
    r.addColorStop(1, "rgba(255,106,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  texFaisca = new THREE.CanvasTexture(c);
  return texFaisca;
}

const QUANTAS = 90;
const VIDA = 0.9;

/**
 * Rastro de faíscas laranja dos pés. As faíscas ficam no mundo (não andam junto
 * com o boneco): vão para a cena mais de fora assim que o boneco estiver nela.
 */
export function criarRastro(THREE: typeof TH, figura: TH.Object3D) {
  const pos = new Float32Array(QUANTAS * 3);
  const cor = new Float32Array(QUANTAS * 3);
  const vel = new Float32Array(QUANTAS * 3);
  const vida = new Float32Array(QUANTAS);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(cor, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.09,
    map: faisca(THREE),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  pontos.name = "rastro-vip";
  const pes = ["foot_l", "foot_r", "ball_l", "ball_r"]
    .map((n) => figura.getObjectByName(n))
    .filter((o): o is TH.Object3D => !!o);
  const p = new THREE.Vector3();
  const antes = new THREE.Vector3();
  const passo = new THREE.Vector3();
  let temAntes = false;
  let proxima = 0;
  let acumulado = 0;
  let semente = 1;
  const sorte = () => (semente = (semente * 16807) % 2147483647) / 2147483647;

  return {
    atualizar(dt: number, mexendo: number) {
      // a nuvem de faíscas mora na cena (o topo da árvore de objetos)
      if (!pontos.parent) {
        let topo: TH.Object3D = figura;
        while (topo.parent) topo = topo.parent;
        if (topo === figura) return;
        topo.add(pontos);
      }
      const escala = figura.getWorldScale(p).y;
      // para onde o boneco está indo (pela posição da figura entre um quadro e outro)
      figura.getWorldPosition(p);
      if (temAntes && dt > 0) passo.subVectors(p, antes).setY(0);
      antes.copy(p);
      temAntes = true;
      const andou = passo.length();
      if (andou > 1e-5) passo.divideScalar(andou);
      // solta faíscas andando (mais correndo)
      if (mexendo > 0.2 && pes.length) {
        acumulado += dt * (40 + mexendo * 70);
        while (acumulado >= 1) {
          acumulado -= 1;
          const pe = pes[Math.floor(sorte() * pes.length)]!;
          pe.getWorldPosition(p);
          const i = proxima;
          proxima = (proxima + 1) % QUANTAS;
          const s = escala * 1.83;
          // um pouco atrás do pé, rente ao chão
          const atras = (0.12 + sorte() * 0.18) * s;
          pos[i * 3] = p.x - passo.x * atras + (sorte() - 0.5) * 0.06 * s;
          pos[i * 3 + 1] = p.y + sorte() * 0.025 * s;
          pos[i * 3 + 2] = p.z - passo.z * atras + (sorte() - 0.5) * 0.06 * s;
          vel[i * 3] = (sorte() - 0.5) * 0.12 * s;
          vel[i * 3 + 1] = (0.06 + sorte() * 0.16) * s;
          vel[i * 3 + 2] = (sorte() - 0.5) * 0.12 * s;
          vida[i] = VIDA * (0.6 + sorte() * 0.4);
        }
      }
      for (let i = 0; i < QUANTAS; i++) {
        if (vida[i]! <= 0) {
          cor[i * 3] = cor[i * 3 + 1] = cor[i * 3 + 2] = 0;
          continue;
        }
        vida[i] = Math.max(0, vida[i]! - dt);
        const k = vida[i]! / VIDA;
        pos[i * 3] = pos[i * 3]! + vel[i * 3]! * dt;
        pos[i * 3 + 1] = pos[i * 3 + 1]! + vel[i * 3 + 1]! * dt;
        pos[i * 3 + 2] = pos[i * 3 + 2]! + vel[i * 3 + 2]! * dt;
        vel[i * 3 + 1] = vel[i * 3 + 1]! * 0.96;
        cor[i * 3] = 1 * k;
        cor[i * 3 + 1] = 0.45 * k;
        cor[i * 3 + 2] = 0.05 * k;
      }
      mat.size = 0.09 * escala * 1.83;
      geo.attributes["position"]!.needsUpdate = true;
      geo.attributes["color"]!.needsUpdate = true;
    },
    descartar() {
      pontos.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
