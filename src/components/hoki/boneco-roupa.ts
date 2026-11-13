import type * as TH from "three";
import type { Corpo } from "./boneco";
import { materialVip, VIP_BLACK } from "./boneco-vip";

/**
 * Pele e roupa do boneco: camiseta preta com HOST em vermelho, bermuda
 * preta, tênis pretos e cabelo preto (o feminino ganha rabo de cavalo e óculos
 * escuros), como nas artes de referência.
 *
 * O boneco do pacote é um manequim liso, sem roupa de verdade. Então a roupa é
 * pintada no próprio corpo: o material olha onde cada ponto fica no boneco
 * parado (de braços abertos, em metros, com os pés em y = 0 e o rosto para +Z)
 * e escolhe a cor daquela região. Como a conta usa a posição de antes da
 * animação, a roupa acompanha o corpo em qualquer movimento.
 *
 * Os LOOKS (grupo "traje" da loja) e as roupas de evento dos times só trocam
 * estes valores: cores, estampas, comprimento da bermuda/calça e o desenho do peito.
 */

/** Desenho de pano: listras deitadas, xadrez ou camuflado (usa a cor `detalhe`). */
export type Estampa = "listras" | "xadrez" | "camuflado";
/** O que vai no peito: a marca HOST, uma estrela ou um raio. */
export type Emblema = "host" | "estrela" | "raio";

export interface Aparencia {
  pele: string;
  camiseta: string;
  bermuda: string;
  tenis: string;
  cabelo: string;
  logo: string;
  /** Segunda cor das estampas e das faixas. */
  detalhe?: string;
  estampaCamiseta?: Estampa;
  estampaBermuda?: Estampa;
  /** Mangas de outra cor (estilo raglan). */
  mangas?: string;
  /** Cor da sola do tênis (sem ela, um tom mais claro do próprio tênis). */
  sola?: string;
  /** Altura da barra da bermuda em metros (0,12 = calça comprida até o tênis). */
  bainha?: number;
  /** Até onde vai a manga (metros a partir do meio do corpo; 0,15 = regata). */
  manga?: number;
  oculos?: boolean;
  emblema?: Emblema;
  /** O emblema maior, no peito e também nas costas (para ver de longe). */
  emblemaGrande?: boolean;
  /** Uniforme: gola, barra das mangas, cintura, barra e listra do lado da bermuda na cor `detalhe`. */
  uniforme?: boolean;
}

/** A pele e a roupa básicas. */
export const APARENCIA_BASICA: Aparencia = {
  pele: "#c48558",
  camiseta: "#18181b",
  bermuda: "#141416",
  tenis: "#0e0e10",
  cabelo: "#151312",
  logo: "#e01414",
};

const CALCA = 0.12;

/** Looks da loja (grupo "traje"): cada um é de um corpo só. */
export const LOOKS: Record<string, { corpo: Corpo; a: Aparencia }> = {
  // ---- masculinos ----
  "traje:look-m-clean": {
    corpo: "padrao",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#efefec",
      logo: "#18181b",
      bermuda: "#3b5b8a",
      tenis: "#e9e9e6",
      sola: "#c9c9c4",
    },
  },
  "traje:look-m-street": {
    corpo: "padrao",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#ce0e0e",
      logo: "#ffffff",
      bermuda: "#161618",
      bainha: CALCA,
      tenis: "#f2f2ef",
      sola: "#ce0e0e",
    },
  },
  "traje:look-m-surfista": {
    corpo: "padrao",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#f4f4f2",
      detalhe: "#1f5fbf",
      estampaCamiseta: "listras",
      logo: "#1f5fbf",
      bermuda: "#f08a24",
      tenis: "#f6d046",
      cabelo: "#d8b25a",
      manga: 0.15,
    },
  },
  "traje:look-m-lenhador": {
    corpo: "padrao",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#b3141b",
      detalhe: "#141416",
      estampaCamiseta: "xadrez",
      logo: "#f4f4f2",
      bermuda: "#34507d",
      bainha: CALCA,
      tenis: "#5a3a22",
      sola: "#2a1a10",
      cabelo: "#4a2c1a",
    },
  },
  "traje:look-m-camuflado": {
    corpo: "padrao",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#4b5a2f",
      logo: "#d9d2b0",
      bermuda: "#5d6b3a",
      detalhe: "#8a7a4a",
      estampaBermuda: "camuflado",
      bainha: CALCA,
      tenis: "#2a2a24",
    },
  },
  "traje:look-m-neon": {
    corpo: "padrao",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#0d0d10",
      mangas: "#39ff6a",
      logo: "#39ff6a",
      bermuda: "#0d0d10",
      bainha: CALCA,
      tenis: "#39ff6a",
      sola: "#0d0d10",
      cabelo: "#e6e6e6",
    },
  },
  // ---- femininos ----
  "traje:look-f-fofa": {
    corpo: "feminino",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#f4f4f2",
      logo: "#f06aa0",
      bermuda: "#f7a8c8",
      bainha: 0.64,
      tenis: "#f4f4f2",
      sola: "#f7a8c8",
      cabelo: "#3b2416",
    },
  },
  "traje:look-f-jeans": {
    corpo: "feminino",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#ce0e0e",
      logo: "#ffffff",
      bermuda: "#3d5f92",
      bainha: CALCA,
      tenis: "#f2f2ef",
      sola: "#d0d0cc",
    },
  },
  "traje:look-f-marinheira": {
    corpo: "feminino",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#f4f4f2",
      detalhe: "#1f2a52",
      estampaCamiseta: "listras",
      logo: "#ce0e0e",
      bermuda: "#1f2a52",
      bainha: 0.62,
      tenis: "#ce0e0e",
      sola: "#f4f4f2",
      cabelo: "#d8b25a",
    },
  },
  "traje:look-f-colegial": {
    corpo: "feminino",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#f4f4f2",
      logo: "#1f2a52",
      bermuda: "#a8141c",
      detalhe: "#141416",
      estampaBermuda: "xadrez",
      bainha: 0.62,
      tenis: "#141416",
      cabelo: "#151312",
    },
  },
  "traje:look-f-pastel": {
    corpo: "feminino",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#c9b3f2",
      mangas: "#a8e6c1",
      logo: "#7a4fc4",
      bermuda: "#a8e6c1",
      tenis: "#c9b3f2",
      sola: "#f4f4f2",
      cabelo: "#f29cc0",
      oculos: false,
    },
  },
  "traje:look-f-neon": {
    corpo: "feminino",
    a: {
      ...APARENCIA_BASICA,
      camiseta: "#0d0d10",
      mangas: "#ff3fb4",
      logo: "#ff3fb4",
      bermuda: "#0d0d10",
      bainha: CALCA,
      tenis: "#ff3fb4",
      sola: "#0d0d10",
      cabelo: "#e6e6e6",
    },
  },
};

/** Roupas de evento dos times do HOST SIEGE (não são vendidas: o mini-game veste durante a partida). */
export const TRAJE_TIME_VERMELHO = "evento:time-vermelho";
export const TRAJE_TIME_AZUL = "evento:time-azul";

const uniformeDoTime = (cor: string, emblema: Emblema): Aparencia => ({
  ...APARENCIA_BASICA,
  camiseta: cor,
  bermuda: cor,
  tenis: cor,
  sola: "#f4f4f4",
  detalhe: "#f4f4f4",
  logo: "#f4f4f4",
  emblema,
  emblemaGrande: true,
  uniforme: true,
  bainha: 0.62,
});
const TIMES: Record<string, Aparencia> = {
  [TRAJE_TIME_VERMELHO]: uniformeDoTime("#ce0e0e", "estrela"),
  [TRAJE_TIME_AZUL]: uniformeDoTime("#1565ff", "raio"),
};

/** O look serve para este corpo? (os de homem só no masculino, os de mulher só no feminino) */
export const lookServe = (id: string, corpo: Corpo) => LOOKS[id]?.corpo === corpo;

/** A aparência que o traje veste neste corpo (traje desconhecido ou de outro corpo = básica). */
export function aparenciaDoTraje(traje: string | undefined, corpo: Corpo): Aparencia {
  if (!traje) return APARENCIA_BASICA;
  const time = TIMES[traje];
  if (time) return time;
  const look = LOOKS[traje];
  return look && look.corpo === corpo ? look.a : APARENCIA_BASICA;
}

/** Medidas da roupa em cada corpo (metros, no boneco parado). */
const MEDIDAS: Record<
  Corpo,
  {
    bainhaBermuda: number;
    manga: number;
    logo: [x0: number, x1: number, y0: number, y1: number];
    emblema: [x0: number, x1: number, y0: number, y1: number];
    oculos: boolean;
  }
> = {
  padrao: {
    bainhaBermuda: 0.6,
    manga: 0.31,
    logo: [-0.115, 0.115, 1.3, 1.375],
    emblema: [-0.1, 0.1, 1.22, 1.4],
    oculos: true,
  },
  feminino: {
    bainhaBermuda: 0.79,
    manga: 0.235,
    logo: [-0.09, 0.09, 1.315, 1.37],
    emblema: [-0.085, 0.085, 1.22, 1.375],
    oculos: true,
  },
};

const texturas = new Map<string, TH.CanvasTexture>();
/** O desenho do peito em fundo transparente: "HOST" inclinado, uma estrela ou um raio. */
function desenhoDoPeito(THREE: typeof TH, cor: string, emblema: Emblema) {
  const chave = `${emblema}|${cor}`;
  const pronta = texturas.get(chave);
  if (pronta) return pronta;
  const tela = document.createElement("canvas");
  const c = tela.getContext("2d");
  if (emblema === "host") {
    tela.width = 512;
    tela.height = 160;
    if (c) {
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
  } else {
    tela.width = 256;
    tela.height = 230;
    if (c) {
      c.fillStyle = cor;
      c.strokeStyle = cor;
      c.lineJoin = "round";
      // aro em volta, como um escudo de time
      c.lineWidth = 14;
      c.beginPath();
      c.arc(128, 115, 100, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      if (emblema === "estrela") {
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 32 : 78;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const x = 128 + Math.cos(a) * r;
          const y = 120 + Math.sin(a) * r;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
      } else {
        // raio
        const pts = [
          [150, 22],
          [72, 128],
          [122, 128],
          [100, 208],
          [184, 96],
          [134, 96],
        ] as const;
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      }
      c.closePath();
      c.fill();
    }
  }
  const t = new THREE.CanvasTexture(tela);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texturas.set(chave, t);
  return t;
}

/** Trecho de shader que pinta a estampa por cima da cor `base` (sem estampa, a própria base). */
function pintar(estampa: Estampa | undefined, base: string) {
  if (estampa === "listras") return `mix(${base}, uDetalhe, step(0.5, fract(p.y * 15.0)))`;
  if (estampa === "xadrez")
    return `mix(${base}, uDetalhe, 0.5 * (step(0.62, fract((p.x + p.z) * 11.0)) + step(0.62, fract(p.y * 11.0))))`;
  if (estampa === "camuflado")
    return `(ruidoRoupa(p.xy * 13.0 + p.zz * 7.0) < 0.42 ? ${base} : (ruidoRoupa(p.yx * 9.0 + 3.1) < 0.5 ? uDetalhe : ${base} * 0.55))`;
  return base;
}

const materiais = new Map<string, TH.MeshStandardMaterial>();

/** O material do corpo (um por corpo e aparência; todos os bonecos iguais dividem o mesmo). */
export function materialDoBoneco(
  THREE: typeof TH,
  corpo: Corpo,
  a: Aparencia = APARENCIA_BASICA,
): TH.MeshStandardMaterial {
  const chave = `${corpo}|${JSON.stringify(a)}`;
  const pronto = materiais.get(chave);
  if (pronto) return pronto;
  const m = MEDIDAS[corpo];
  const bainha = a.bainha ?? m.bainhaBermuda;
  const manga = a.manga ?? m.manga;
  const oculos = a.oculos ?? m.oculos;
  const emblema = a.emblema ?? "host";
  const r = a.emblemaGrande ? m.emblema : m.logo;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  mat.name = `boneco-${corpo}`;
  const cor = (h: string) => new THREE.Color(h);
  const uniformes = {
    uPele: { value: cor(a.pele) },
    uCamiseta: { value: cor(a.camiseta) },
    uBermuda: { value: cor(a.bermuda) },
    uTenis: { value: cor(a.tenis) },
    uSola: { value: a.sola ? cor(a.sola) : cor(a.tenis).multiplyScalar(2.4) },
    uCabelo: { value: cor(a.cabelo) },
    uDetalhe: { value: cor(a.detalhe ?? a.camiseta) },
    uMangas: { value: cor(a.mangas ?? a.camiseta) },
    uLogo: { value: desenhoDoPeito(THREE, a.logo, emblema) },
  };
  const f = (n: number) => n.toFixed(4);
  const peito = `p.x > ${f(r[0])} && p.x < ${f(r[1])} && p.y > ${f(r[2])} && p.y < ${f(r[3])}`;
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
        uniform vec3 uPele, uCamiseta, uBermuda, uTenis, uSola, uCabelo, uDetalhe, uMangas;
        uniform sampler2D uLogo;
        float lustro = 0.0;
        float hashRoupa(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
        float ruidoRoupa(vec2 q) {
          vec2 i = floor(q);
          vec2 u = fract(q);
          u = u * u * (3.0 - 2.0 * u);
          return mix(mix(hashRoupa(i), hashRoupa(i + vec2(1.0, 0.0)), u.x),
                     mix(hashRoupa(i + vec2(0.0, 1.0)), hashRoupa(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        vec3 corDaRoupa() {
          vec3 p = vOrig;
          float ax = abs(p.x);
          // tênis (com a sola de outra cor)
          if (p.y < 0.118) {
            if (p.y < 0.022) return uSola;
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
              oculos
                ? `if (p.z > 0.055 && p.y > 1.688 && p.y < 1.728 && ax < 0.082) { lustro = 1.0; return vec3(0.02); }`
                : `if (p.z > 0.06 && ax > 0.022 && ax < 0.05 && p.y > 1.69 && p.y < 1.712) return vec3(0.04);`
            }
            // sobrancelhas
            if (p.z > 0.06 && ax > 0.016 && ax < 0.06 && p.y > 1.733 && p.y < 1.744) return uCabelo;
            return uPele;
          }
          // camiseta: tronco e mangas
          bool gola = ax < 0.075 && p.y > 1.475 && p.z > -0.03;
          bool tronco = ax < 0.205 && p.y > 1.05 && p.y < 1.535 && !gola;
          bool manga = ax >= 0.15 && ax < ${f(manga)} && p.y > 1.33;
          ${
            a.uniforme
              ? `// gola do uniforme
          if (ax < 0.09 && p.y > 1.46 && p.y < 1.535 && !gola) return uDetalhe;`
              : ""
          }
          if (tronco || manga) {
            // desenho no peito
            if (p.z > 0.035 && ${peito}) {
              vec2 uv = vec2((p.x - ${f(r[0])}) / ${f(r[1] - r[0])}, (p.y - ${f(r[2])}) / ${f(r[3] - r[2])});
              vec4 l = texture2D(uLogo, uv);
              return mix(${pintar(a.estampaCamiseta, "uCamiseta")}, l.rgb, l.a);
            }
            ${
              a.emblemaGrande
                ? `// e nas costas também (sem espelhar)
            if (p.z < -0.035 && ${peito}) {
              vec2 uv = vec2((${f(r[1])} - p.x) / ${f(r[1] - r[0])}, (p.y - ${f(r[2])}) / ${f(r[3] - r[2])});
              vec4 l = texture2D(uLogo, uv);
              return mix(uCamiseta, l.rgb, l.a);
            }`
                : ""
            }
            // a barra da manga um pouco mais escura (no uniforme, faixa clara)
            if (manga && ax > ${f(manga - (a.uniforme ? 0.022 : 0.012))}) return ${
              a.uniforme ? "uDetalhe" : "uCamiseta * 0.7"
            };
            ${a.mangas ? "if (manga) return uMangas;" : ""}
            return ${pintar(a.estampaCamiseta, "uCamiseta")};
          }
          // bermuda (ou saia, ou calça comprida)
          if (ax < 0.27 && p.y > ${f(bainha)} && p.y <= 1.05) {
            ${
              a.uniforme
                ? `if (p.y > 1.015 || p.y < ${f(bainha + 0.022)}) return uDetalhe;
            if (ax > 0.11 && abs(p.z) < 0.016) return uDetalhe;`
                : `if (p.y < ${f(bainha + 0.012)}) return uBermuda * 0.7;`
            }
            return ${pintar(a.estampaBermuda, "uBermuda")};
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

/**
 * Veste o boneco (troca o material laranja e roxo do manequim) e põe o rabo de cavalo no feminino.
 * `traje`: o id do traje vestido (look da loja, roupa de time do evento ou VIP BLACK) ou uma aparência pronta.
 */
export function vestirBoneco(
  THREE: typeof TH,
  figura: TH.Object3D,
  corpo: Corpo,
  traje: string | Aparencia | undefined = undefined,
  vip = false,
) {
  const ehVip = vip || traje === VIP_BLACK;
  const a = typeof traje === "object" ? traje : aparenciaDoTraje(traje, corpo);
  const mat = ehVip ? materialVip(THREE, corpo) : materialDoBoneco(THREE, corpo, a);
  figura.traverse((o) => {
    const m = o as TH.Mesh;
    if (m.isMesh) m.material = mat;
  });
  if (corpo !== "feminino" || ehVip) {
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
