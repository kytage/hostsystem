import type * as TH from "three";
import type { Corpo } from "./boneco";
import { materialVip } from "./boneco-vip";

/**
 * Pele e roupa básica do boneco: camiseta preta com HOST em vermelho, bermuda
 * preta, tênis pretos e cabelo preto (o feminino ganha rabo de cavalo e óculos
 * escuros), como nas artes de referência.
 *
 * O boneco do pacote é um manequim liso, sem roupa de verdade. Então a roupa é
 * pintada no próprio corpo: o material olha onde cada ponto fica no boneco
 * parado (de braços abertos, em metros, com os pés em y = 0 e o rosto para +Z)
 * e escolhe a cor daquela região. Como a conta usa a posição de antes da
 * animação, a roupa acompanha o corpo em qualquer movimento.
 *
 * Futuro menu de peles e roupas: basta trocar os valores de `Visual` abaixo.
 */

export interface Aparencia {
  pele: string;
  camiseta: string;
  bermuda: string;
  tenis: string;
  cabelo: string;
  logo: string;
}

/** A pele e a roupa básicas (a única opção por enquanto). */
export const APARENCIA_BASICA: Aparencia = {
  pele: "#c48558",
  camiseta: "#18181b",
  bermuda: "#141416",
  tenis: "#0e0e10",
  cabelo: "#151312",
  logo: "#e01414",
};

/** Medidas da roupa em cada corpo (metros, no boneco parado). */
const MEDIDAS: Record<
  Corpo,
  {
    bainhaBermuda: number;
    manga: number;
    logo: [x0: number, x1: number, y0: number, y1: number];
    oculos: boolean;
  }
> = {
  padrao: { bainhaBermuda: 0.6, manga: 0.31, logo: [-0.115, 0.115, 1.3, 1.375], oculos: true },
  feminino: { bainhaBermuda: 0.79, manga: 0.235, logo: [-0.09, 0.09, 1.315, 1.37], oculos: true },
};

let texturaLogo: TH.CanvasTexture | null = null;
/** "HOST" em vermelho, em letras grossas e inclinadas (fundo transparente). */
function logo(THREE: typeof TH, cor: string) {
  if (texturaLogo) return texturaLogo;
  const tela = document.createElement("canvas");
  tela.width = 512;
  tela.height = 160;
  const c = tela.getContext("2d");
  if (c) {
    c.clearRect(0, 0, 512, 160);
    c.fillStyle = cor;
    c.font = "italic 900 132px 'Arial Black', Impact, 'Helvetica Neue', Arial, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.save();
    c.translate(256, 84);
    c.transform(1, 0, -0.12, 1, 0, 0);
    c.fillText("HOST", 0, 0, 500);
    c.restore();
    // o corte no "H", como na marca
    c.globalCompositeOperation = "destination-out";
    c.fillRect(70, 78, 70, 9);
  }
  texturaLogo = new THREE.CanvasTexture(tela);
  texturaLogo.colorSpace = THREE.SRGBColorSpace;
  texturaLogo.anisotropy = 4;
  return texturaLogo;
}

const materiais = new Map<string, TH.MeshStandardMaterial>();

/** O material do corpo (um por corpo e aparência; todos os bonecos iguais dividem o mesmo). */
export function materialDoBoneco(
  THREE: typeof TH,
  corpo: Corpo,
  a: Aparencia = APARENCIA_BASICA,
): TH.MeshStandardMaterial {
  const chave = `${corpo}|${Object.values(a).join(",")}`;
  const pronto = materiais.get(chave);
  if (pronto) return pronto;
  const m = MEDIDAS[corpo];
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  mat.name = `boneco-${corpo}`;
  const cor = (h: string) => new THREE.Color(h);
  const uniformes = {
    uPele: { value: cor(a.pele) },
    uCamiseta: { value: cor(a.camiseta) },
    uBermuda: { value: cor(a.bermuda) },
    uTenis: { value: cor(a.tenis) },
    uCabelo: { value: cor(a.cabelo) },
    uLogo: { value: logo(THREE, a.logo) },
  };
  const f = (n: number) => n.toFixed(4);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOrig;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOrig = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vOrig;
        uniform vec3 uPele, uCamiseta, uBermuda, uTenis, uCabelo;
        uniform sampler2D uLogo;
        float lustro = 0.0;
        vec3 corDaRoupa() {
          vec3 p = vOrig;
          float ax = abs(p.x);
          // tênis (com uma sola um pouco mais clara)
          if (p.y < 0.118) {
            if (p.y < 0.022) return uTenis * 2.4;
            return uTenis;
          }
          // cabeça: cabelo, rosto e detalhes
          if (p.y > 1.55 && ax < 0.13) {
            ${
              corpo === "feminino"
                ? `bool cabelo = p.y > 1.745 || (p.z < 0.005 && p.y > 1.585) || (ax > 0.066 && p.y > 1.665 && p.z < 0.07);`
                : `bool cabelo = p.y > 1.768 || (p.z < -0.015 && p.y > 1.62) || (ax > 0.072 && p.y > 1.7 && p.z < 0.06);`
            }
            if (cabelo) return uCabelo;
            ${
              m.oculos
                ? `if (p.z > 0.055 && p.y > 1.688 && p.y < 1.728 && ax < 0.082) { lustro = 1.0; return vec3(0.02); }`
                : `if (p.z > 0.06 && ax > 0.022 && ax < 0.05 && p.y > 1.69 && p.y < 1.712) return vec3(0.04);`
            }
            // sobrancelhas
            if (p.z > 0.06 && ax > 0.016 && ax < 0.06 && p.y > 1.733 && p.y < 1.744) return uCabelo;
            return uPele;
          }
          // camiseta: tronco e mangas curtas
          bool gola = ax < 0.075 && p.y > 1.475 && p.z > -0.03;
          bool tronco = ax < 0.205 && p.y > 1.05 && p.y < 1.535 && !gola;
          bool manga = ax >= 0.15 && ax < ${f(m.manga)} && p.y > 1.33;
          if (tronco || manga) {
            // HOST no peito
            if (p.z > 0.035 && p.x > ${f(m.logo[0])} && p.x < ${f(m.logo[1])} && p.y > ${f(m.logo[2])} && p.y < ${f(m.logo[3])}) {
              vec2 uv = vec2((p.x - ${f(m.logo[0])}) / ${f(m.logo[1] - m.logo[0])}, (p.y - ${f(m.logo[2])}) / ${f(m.logo[3] - m.logo[2])});
              vec4 l = texture2D(uLogo, uv);
              return mix(uCamiseta, l.rgb, l.a);
            }
            // a barra da manga um pouco mais escura
            if (manga && ax > ${f(m.manga - 0.012)}) return uCamiseta * 0.7;
            return uCamiseta;
          }
          // bermuda
          if (ax < 0.27 && p.y > ${f(m.bainhaBermuda)} && p.y <= 1.05) {
            if (p.y < ${f(m.bainhaBermuda + 0.012)}) return uBermuda * 0.7;
            return uBermuda;
          }
          return uPele;
        }`,
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb = corDaRoupa();",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.18, lustro);",
      );
  };
  mat.customProgramCacheKey = () => chave;
  materiais.set(chave, mat);
  return mat;
}

/** Veste o boneco (troca o material laranja e roxo do manequim) e põe o rabo de cavalo no feminino. */
export function vestirBoneco(
  THREE: typeof TH,
  figura: TH.Object3D,
  corpo: Corpo,
  a: Aparencia = APARENCIA_BASICA,
  vip = false,
) {
  const mat = vip ? materialVip(THREE, corpo) : materialDoBoneco(THREE, corpo, a);
  figura.traverse((o) => {
    const m = o as TH.Mesh;
    if (m.isMesh) m.material = mat;
  });
  if (corpo !== "feminino" || vip) {
    figura.getObjectByName("rabo-de-cavalo")?.removeFromParent();
    return;
  }
  // rabo de cavalo: preso ao osso da cabeça, para balançar junto
  const cabeca = figura.getObjectByName("Head");
  cabeca?.getObjectByName("rabo-de-cavalo")?.removeFromParent();
  if (!cabeca) return;
  figura.updateMatrixWorld(true);
  const s = figura.getWorldScale(new THREE.Vector3()).y;
  const matCabelo =
    rabos.get(a.cabelo) ?? new THREE.MeshStandardMaterial({ color: a.cabelo, roughness: 0.6 });
  rabos.set(a.cabelo, matCabelo);
  if (!geoRabo) {
    // gota alongada: grossa em cima (no prendedor) e fina na ponta
    const pts: TH.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(
        new THREE.Vector2(
          Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.042 * (1 - t * 0.45) + 0.004,
          -t * 0.25,
        ),
      );
    }
    geoRabo = new THREE.LatheGeometry(pts, 14);
  }
  const rabo = new THREE.Mesh(geoRabo, matCabelo);
  rabo.castShadow = true;
  // onde fica no boneco parado (metros): atrás da cabeça, um pouco abaixo do topo
  const desejado = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 1.735, -0.1).multiplyScalar(s),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, 0)),
    new THREE.Vector3(s, s, s),
  );
  const local = new THREE.Matrix4().copy(cabeca.matrixWorld).invert().multiply(desejado);
  local.decompose(rabo.position, rabo.quaternion, rabo.scale);
  rabo.name = "rabo-de-cavalo";
  cabeca.add(rabo);
}
const rabos = new Map<string, TH.MeshStandardMaterial>();
let geoRabo: TH.LatheGeometry | null = null;
