/**
 * HOST FAZENDAS — a ilha 3D de cada jogador.
 *
 * Terreno de cultivo no meio (8 × 8 até 20 × 20), com a casa da fazenda, a
 * carroça, a mesa, a fogueira e as laranjeiras do pacote de fazenda em volta
 * (modelos de CristiniDias, CC-BY-4.0; ver public/hoki/fazenda/CREDITOS.txt),
 * o portal de chegada e a caixa de correio. Os canteiros, árvores, animais e
 * decorações vêm do estado da ilha; a cena só desenha e avisa os cliques.
 */
import type * as TH from "three";
import { peca, type Visual } from "@/lib/hoki";
import { cultura, item, PROJETOS } from "@/lib/fazenda/catalogo";
import { chave, estadoDoCanteiro, type Ilha } from "@/lib/fazenda/regras";
import { criarMascote } from "../mascote";
import { modeloLeve, type Modelo } from "../modelo";
import { montarLuzes, prepararDesenho, acabamento } from "../luz";
import { Blocos, ceu, criarNuvens, sorteador } from "../voxel";
import { Natureza } from "../natureza";

const ESCALA_HOKI = 0.62;
const LADO_ILHA = 36;
const MEIA = LADO_ILHA / 2;
export const PORTAL_DA_ILHA = { x: 0, z: MEIA - 3.2 };
export const CORREIO_DA_ILHA = { x: 3.4, z: MEIA - 4.4 };
export const CHEGADA_DA_ILHA = { x: 0, z: MEIA - 5.6 };

/** Lado maior da casa da fazenda (em metros) quando ela cabe inteira. */
const CASA_LADO = 10.5;
/**
 * Onde fica a casa (atrás do terreno, no meio): no lugar de sempre enquanto couber; com o
 * terreno maior ela recua até a beira da ilha e, se ainda assim faltar espaço, diminui.
 * A frente fica sempre a 0,7 m da cerca. `fundo` = fundo da casa ÷ lado maior do modelo.
 */
export function lugarDaCasa(tamanho: number, fundo = 1) {
  const cerca = tamanho / 2 + 0.35;
  const frente = -(cerca + 0.7);
  const beira = -MEIA + 0.6;
  const prof = CASA_LADO * fundo;
  const z0 = -MEIA + 6.6;
  if (z0 + prof / 2 <= frente) return { lado: CASA_LADO, z: z0 };
  const cabe = frente - beira;
  if (cabe >= prof) return { lado: CASA_LADO, z: frente - prof / 2 };
  return { lado: cabe / fundo, z: (frente + beira) / 2 };
}

/** Centro do quadrado (x, z) do terreno no mundo. */
export const centroDoQuadrado = (tamanho: number, x: number, z: number) => ({
  x: x + 0.5 - tamanho / 2,
  z: z + 0.5 - tamanho / 2,
});

export interface Pessoa {
  id: string;
  nome: string;
  visual: Visual;
  x: number;
  z: number;
  selo?: { nivel: number; fundo: string; texto: string } | null | undefined;
  tag?: string | undefined;
  souEu?: boolean;
}
export interface Fantasma {
  modelo: string;
  w: number;
  h: number;
  valido: (x: number, z: number) => boolean;
}
export interface EventosDaCena {
  onQuadrado(x: number, z: number): void;
  onObjeto(id: string): void;
  onChao(x: number, z: number): void;
  onPortal(): void;
  onCorreio(): void;
}

type Pecas = Map<string, TH.BufferGeometry>;
let pacote: Promise<Pecas> | null = null;
function carregarPacote(THREE: typeof TH): Promise<Pecas> {
  pacote ??= import("three/examples/jsm/loaders/GLTFLoader.js")
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync("/hoki/fazenda/pacote.glb"))
    .then((g) => {
      const m: Pecas = new Map();
      g.scene.traverse((o) => {
        const malha = o as TH.Mesh;
        if (malha.isMesh) m.set(malha.name || o.parent?.name || "", malha.geometry);
      });
      return m;
    })
    .catch(() => new Map());
  void THREE;
  return pacote;
}

/** Tamanho de cada modelo no mundo (lado maior, em quadrados). */
const TAMANHO: Record<string, number> = {
  laranjeira: 1.7,
  macieira: 1.5,
  mangueira: 1.8,
  galinha: 0.55,
  feno: 0.85,
  trigo: 0.8,
  caixote: 0.95,
  canteiro_cenoura: 0.95,
  canteiro_trigo: 0.95,
  carroca: 1.3,
  mesa: 1.1,
  fogueira: 0.9,
  toco: 0.55,
  flor_rosa: 0.75,
  flor_branca: 0.75,
  flor_azul: 0.75,
  galinheiro: 1.9,
};

export function criarCenaDaFazenda(THREE: typeof TH, el: HTMLDivElement, eventos: EventosDaCena) {
  const lixo: { dispose: () => void }[] = [];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  prepararDesenho(THREE, renderer);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
  const camada = document.createElement("div");
  camada.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  el.appendChild(camada);

  const cena = new THREE.Scene();
  const texCeu = ceu(THREE);
  cena.background = texCeu;
  cena.fog = new THREE.Fog(0xdcecff, 70, 160);
  lixo.push(texCeu);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 300);
  montarLuzes(THREE, cena, {
    alvo: { x: 0, y: 0, z: 0 },
    area: [22, 22],
    distancia: 50,
    mapa: 2048,
    maciez: 2.2,
  });

  // ---------------- ilha: gramado, beirada de terra e rocha, caminho do portal ----------------
  const r = sorteador(808);
  const escolhe = (l: readonly number[]) => l[Math.floor(r() * l.length)] ?? l[0]!;
  const GRAMA = [0x78cd48, 0x6ec342, 0x84d650, 0x72c845];
  const TERRA = [0x9a6235, 0x8c5730, 0xa66d3c];
  const ROCHA = [0x8f8a85, 0x7e7974, 0x9b958f];
  const base = new Blocos(r);
  const encosta = new Blocos(r);
  const enfeite = new Blocos(r);
  const mato = new Natureza(); // árvores em volta da fazenda (modelos 3D)
  for (let x = -MEIA + 0.5; x < MEIA; x++)
    for (let z = -MEIA + 0.5; z < MEIA; z++) {
      const borda = Math.min(x + MEIA, MEIA - x, z + MEIA, MEIA - z);
      // cantos arredondados
      if (
        Math.hypot(Math.max(0, Math.abs(x) - (MEIA - 4)), Math.max(0, Math.abs(z) - (MEIA - 4))) > 4
      )
        continue;
      const caminho = Math.abs(x) < 1.2 && z > 10.5 && z < MEIA - 3.5;
      base.base(
        x,
        -0.4,
        z,
        1,
        0.4,
        1,
        caminho ? escolhe([0xe2d6bd, 0xd6c9ad]) : escolhe(GRAMA),
        0.04,
      );
      const fundo = Math.min(14, 1.4 + borda * 0.9 + r() * 1.1);
      encosta.base(x, -1.8, z, 1, 1.4, 1, escolhe(TERRA), 0.06);
      encosta.base(x, -1.8 - (fundo - 1.4), z, 1, fundo - 1.4, 1, escolhe(ROCHA), 0.07);
      if (borda < 1 && r() < 0.5) encosta.base(x, -0.8, z, 1.04, 0.45, 1.04, 0x4f9c35, 0.06);
      if (!caminho && Math.abs(x) > 11 && r() < 0.12)
        enfeite.base(
          x + (r() - 0.5) * 0.6,
          0,
          z + (r() - 0.5) * 0.6,
          0.13,
          0.16,
          0.13,
          escolhe([0xffffff, 0xff5a5a, 0xffd84a, 0xff8fc8]),
          0.02,
        );
    }
  // árvores de blocos nos cantos e arbustos (enfeite fixo)
  for (const [x, z, tipo] of [
    [-15.5, -15.5, "pinheiro"],
    [15.5, -15.5, "copa"],
    [-15.5, 13.5, "copa"],
    [15.5, 13.5, "pinheiro"],
    [-16.2, 2, "copinha"],
    [16.2, -2, "copinha"],
  ] as const)
    mato.arvore(x, z, { tipo, ...(tipo === "copa" ? { cor: "amarelo" as const } : {}) });
  const mBase = base.construir(THREE, {
    sombra: false,
    acabamento: { chanfro: 0.035, junta: 0.07, pe: 0, grao: 0.05 },
  });
  const mEncosta = encosta.construir(THREE, {
    sombra: false,
    acabamento: { chanfro: 0.07, junta: 0.2, pe: 0.3, grao: 0.075 },
  });
  const mEnfeite = enfeite.construir(THREE, {
    acabamento: { chanfro: 0.06, junta: 0.12, pe: 0.3, grao: 0.07 },
  });
  for (const m of [mBase, mEncosta, mEnfeite]) {
    cena.add(m.malha);
    lixo.push({ dispose: m.descartar });
  }
  const natureza = mato.construir(THREE);
  cena.add(natureza.grupo);
  lixo.push({ dispose: natureza.descartar });
  const nuvens = criarNuvens(
    THREE,
    [
      [-34, -9, -22, 4],
      [30, -12, -30, 4.4],
      [38, -6, 14, 3.4],
      [-40, -10, 20, 3.8],
      [4, -16, 38, 4.6],
      [-12, 14, -60, 3],
      [40, 18, -50, 2.6],
    ],
    17,
  );
  for (const n of nuvens.nuvens) cena.add(n.malha);
  lixo.push({ dispose: nuvens.descartar });

  // ---------------- portal de chegada (redemoinho azul) e caixa de correio ----------------
  const uPortal = { uT: { value: 0 } };
  const mPortal = new THREE.ShaderMaterial({
    uniforms: uPortal,
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uT;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(1.0, 1.25); float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float b = sin(a * 3.0 + r * 9.0 - uT * 2.4);
        vec3 c = mix(vec3(0.02,0.08,0.32), vec3(0.1,0.45,1.0), clamp(1.0 - r * 0.8, 0.0, 1.0));
        c += vec3(0.35,0.8,1.0) * smoothstep(0.0,1.0,b) * (1.1 - r * 0.5);
        c += vec3(1.0) * pow(max(0.0, 1.0 - r * 1.6), 3.0);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const portal = new THREE.Group();
  {
    const moldura = new Blocos(r);
    for (const l of [-1, 1]) {
      moldura.base(l * 1.35, 0, 0, 0.5, 3.0, 0.6, 0x6b4a2c, 0.04);
      moldura.base(l * 1.35, 3.0, 0, 0.7, 0.2, 0.8, 0x8a5a3a, 0.03);
    }
    moldura.base(0, 3.0, 0, 3.3, 0.45, 0.7, 0x8a5a3a, 0.04);
    moldura.base(0, 3.45, 0, 2.2, 0.3, 0.6, 0x6b4a2c, 0.04);
    const mm = moldura.construir(THREE, {
      acabamento: { chanfro: 0.03, junta: 0.16, pe: 0.16, grao: 0.07 },
    });
    portal.add(mm.malha);
    lixo.push({ dispose: mm.descartar });
    const g = new THREE.PlaneGeometry(2.2, 2.9);
    const disco = new THREE.Mesh(g, mPortal);
    disco.position.set(0, 1.5, 0);
    disco.userData["portal"] = true;
    portal.add(disco);
    lixo.push(g, mPortal);
  }
  portal.position.set(PORTAL_DA_ILHA.x, 0, PORTAL_DA_ILHA.z);
  cena.add(portal);
  const correio = new THREE.Group();
  {
    const b = new Blocos(r);
    b.base(0, 0, 0, 0.14, 0.95, 0.14, 0x2b2d32, 0);
    b.base(0, 0.95, 0, 0.62, 0.46, 0.46, 0xe02a20, 0.02);
    b.base(0, 1.41, 0, 0.52, 0.12, 0.4, 0xc8231c, 0.02);
    b.base(0, 1.1, 0.24, 0.34, 0.2, 0.02, 0xf6f1e4, 0);
    b.base(0.34, 1.0, 0, 0.04, 0.42, 0.04, 0x2b2d32, 0);
    b.base(0.42, 1.32, 0, 0.16, 0.11, 0.03, 0xffd84a, 0);
    const mm = b.construir(THREE, {
      acabamento: { chanfro: 0.03, junta: 0.16, pe: 0.16, grao: 0.05 },
    });
    mm.malha.userData["correio"] = true;
    correio.add(mm.malha);
    lixo.push({ dispose: mm.descartar });
  }
  correio.position.set(CORREIO_DA_ILHA.x, 0, CORREIO_DA_ILHA.z);
  cena.add(correio);

  // ---------------- modelos do pacote (casa, carroça, mesa, fogueira, laranjeiras, galinhas...) ----------------
  const matCor = acabamento(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
    }),
  );
  lixo.push(matCor);
  let pecas: Pecas = new Map();
  const tingidas = new Map<string, TH.BufferGeometry>();
  /** Troca a cor das frutas (laranja) da laranjeira para fazer a macieira e a mangueira. */
  function geometria(modelo: string): TH.BufferGeometry | null {
    const fonte = modelo === "macieira" || modelo === "mangueira" ? "laranjeira" : modelo;
    const g = pecas.get(fonte);
    if (!g) return null;
    if (fonte === modelo) return g;
    let t = tingidas.get(modelo);
    if (!t) {
      t = g.clone();
      const cor = t.getAttribute("color") as TH.BufferAttribute;
      const alvo = new THREE.Color(
        modelo === "macieira" ? 0xd62828 : 0xf2c12e,
      ).convertSRGBToLinear();
      for (let k = 0; k < cor.count; k++) {
        const rr = cor.getX(k);
        const gg = cor.getY(k);
        const bb = cor.getZ(k);
        if (rr > 0.45 && gg > 0.06 && gg < 0.45 && bb < 0.12) cor.setXYZ(k, alvo.r, alvo.g, alvo.b);
      }
      cor.needsUpdate = true;
      tingidas.set(modelo, t);
      lixo.push(t);
    }
    return t;
  }
  function modeloDoPacote(modelo: string, lado?: number): TH.Object3D | null {
    const g = geometria(modelo);
    if (!g) return null;
    const m = new THREE.Mesh(g, matCor);
    m.castShadow = true;
    m.receiveShadow = true;
    g.computeBoundingBox();
    const caixa = g.boundingBox!;
    const maior = Math.max(caixa.max.x - caixa.min.x, caixa.max.z - caixa.min.z);
    const alvo = lado ?? TAMANHO[modelo] ?? 1;
    m.scale.setScalar(alvo / Math.max(0.001, maior));
    return m;
  }
  const cenario = new THREE.Group();
  cena.add(cenario);
  // a casa acompanha o tamanho do terreno: recua e, se precisar, diminui para ficar atrás da cerca
  let casa: TH.Object3D | null = null;
  let maiorDaCasa = 1;
  let fundoDaCasa = 1;
  function posicionarCasa() {
    if (!casa) return;
    const { lado, z } = lugarDaCasa(ilha?.tamanho ?? 8, fundoDaCasa);
    casa.scale.setScalar(lado / maiorDaCasa);
    casa.position.set(0, 0, z);
  }
  function montarCenario() {
    cenario.clear();
    const por = (modelo: string, x: number, z: number, giro: number, lado: number) => {
      const m = modeloDoPacote(modelo, lado);
      if (!m) return;
      m.position.set(x, 0, z);
      m.rotation.y = giro;
      cenario.add(m);
    };
    casa = modeloDoPacote("casa", CASA_LADO);
    if (casa) {
      const b = (casa as TH.Mesh).geometry.boundingBox!;
      maiorDaCasa = Math.max(0.001, b.max.x - b.min.x, b.max.z - b.min.z);
      fundoDaCasa = (b.max.z - b.min.z) / maiorDaCasa;
      cenario.add(casa);
      posicionarCasa();
    }
    por("carroca", 13.6, -6, -0.6, 3.2);
    por("mesa", -13.4, -7, 0.4, 3.6);
    por("fogueira", -13.2, 7.5, 0, 2.2);
    for (const [x, z] of [
      [-11.5, 7.5],
      [-14.9, 7.5],
      [-13.2, 5.8],
      [-13.2, 9.2],
    ] as const)
      por("toco", x, z, 0, 0.7);
    por("laranjeira", -13.5, -13.5, 0.3, 3.8);
    por("laranjeira", 13.5, 8.5, 1.4, 3.6);
    por("feno", 12.8, -9.2, 0.2, 1.1);
    por("feno", 14.2, -9.6, -0.4, 1.1);
    por("trigo", -15.6, -10.5, 0, 1.2);
    por("trigo", 15.6, 3.5, 0.6, 1.2);
    for (const [x, z, m] of [
      [-2.6, 12.6, "flor_rosa"],
      [2.6, 12.6, "flor_branca"],
      [-2.6, 15, "flor_azul"],
      [5.2, 14.8, "flor_rosa"],
    ] as const)
      por(m, x, z, 0, 1.1);
  }

  // ---------------- terreno de cultivo: quadrados, cerca e o que cresce ----------------
  const terreno = new THREE.Group();
  cena.add(terreno);
  const objetos = new THREE.Group();
  cena.add(objetos);
  const prontos: TH.Vector3[] = [];
  let ilha: Ilha | null = null;
  let agoraServidor = Date.now();
  let diferencaRelogio = 0;
  const agora = () => Date.now() + diferencaRelogio;
  let terrenoMalhas: { malha: TH.InstancedMesh; descartar: () => void }[] = [];
  let ultimaChaveDoTerreno = "";

  /** Planta de blocos de cada cultura, conforme o estágio (0 = broto, 1 = crescendo, 2 = madura). */
  function planta(b: Blocos, cx: number, cz: number, culturaId: string, estagio: number) {
    const c = cultura(culturaId);
    const folha = new THREE.Color(c?.folha ?? "#4f9c35").getHex();
    const fruto = new THREE.Color(c?.fruto ?? "#e5342b").getHex();
    const s = [0.35, 0.65, 1][estagio] ?? 1;
    const tufo = (dx: number, dz: number, h: number) => {
      b.base(
        cx + dx,
        0.06,
        cz + dz,
        0.14 * (0.6 + s * 0.4),
        h * s,
        0.14 * (0.6 + s * 0.4),
        folha,
        0.08,
      );
      b.base(cx + dx, 0.06 + h * s * 0.6, cz + dz, 0.26 * s, 0.12 * s, 0.26 * s, folha, 0.08);
    };
    const id = c?.id ?? "";
    if (id === "milho" || id === "girassol" || id === "cafe" || id === "cacau") {
      for (const [dx, dz] of [
        [-0.18, -0.18],
        [0.18, 0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
      ] as const) {
        b.base(cx + dx, 0.06, cz + dz, 0.08, 0.95 * s, 0.08, folha, 0.06);
        b.base(cx + dx, 0.06 + 0.45 * s, cz + dz, 0.3 * s, 0.07, 0.1, folha, 0.06);
        if (estagio === 2) {
          if (id === "girassol") {
            b.base(cx + dx, 1.0, cz + dz, 0.3, 0.3, 0.06, fruto, 0.04);
            b.base(cx + dx, 1.0, cz + dz + 0.03, 0.12, 0.12, 0.04, 0x6b3a1a, 0);
          } else b.base(cx + dx + 0.06, 0.55, cz + dz, 0.12, 0.26, 0.12, fruto, 0.04);
        }
      }
      return;
    }
    if (id === "melancia" || id === "abobora") {
      tufo(0, 0, 0.25);
      tufo(0.22, 0.2, 0.2);
      if (estagio >= 1) {
        const t = estagio === 2 ? 0.46 : 0.22;
        b.base(
          cx - 0.1,
          0.06,
          cz + 0.05,
          t * (id === "melancia" ? 1.25 : 1),
          t * 0.8,
          t,
          fruto,
          0.05,
        );
        if (id === "melancia" && estagio === 2)
          b.base(cx - 0.1, 0.06 + t * 0.8, cz + 0.05, t * 1.0, 0.02, t * 0.2, 0x9fd05a, 0);
      }
      return;
    }
    if (id === "uva" || id === "tomate" || id === "pitaya") {
      b.base(cx, 0.06, cz, 0.06, 0.9 * s, 0.06, 0x8a5a3a, 0.04);
      for (const [dx, dz, h] of [
        [-0.18, 0, 0.5],
        [0.18, 0.05, 0.62],
        [0, -0.16, 0.75],
      ] as const) {
        b.base(cx + dx, h * s, cz + dz, 0.24 * s, 0.22 * s, 0.24 * s, folha, 0.08);
        if (estagio === 2)
          b.base(cx + dx + 0.05, h * s - 0.08, cz + dz + 0.08, 0.13, 0.13, 0.13, fruto, 0.04);
      }
      return;
    }
    // morango, alface, cenoura: tufos baixos
    for (const [dx, dz] of [
      [-0.2, -0.2],
      [0.2, -0.15],
      [-0.15, 0.2],
      [0.2, 0.2],
    ] as const) {
      if (id === "alface")
        b.base(cx + dx * 0.9, 0.06, cz + dz * 0.9, 0.3 * s, 0.24 * s, 0.3 * s, folha, 0.1);
      else tufo(dx, dz, 0.3);
      if (estagio === 2) {
        if (id === "cenoura") b.base(cx + dx, 0.06, cz + dz + 0.1, 0.1, 0.08, 0.1, fruto, 0.04);
        else if (id !== "alface")
          b.base(cx + dx + 0.06, 0.12, cz + dz + 0.06, 0.1, 0.1, 0.1, fruto, 0.04);
      }
    }
  }
  function montarTerreno() {
    if (!ilha) return;
    const T = ilha.tamanho;
    const t = agora();
    const estagios = Object.entries(ilha.canteiros).map(([k, c]) => {
      const est = estadoDoCanteiro(c, t);
      const prog =
        c.plantadoEm && c.maduroEm
          ? (t - c.plantadoEm) / Math.max(1, c.maduroEm - c.plantadoEm)
          : 0;
      return `${k}:${est}:${c.cultura ?? ""}:${est === "crescendo" ? (prog < 0.5 ? 0 : 1) : ""}:${c.adubo ? 1 : 0}`;
    });
    const k = `${T}|${estagios.join(";")}`;
    if (k === ultimaChaveDoTerreno) return;
    ultimaChaveDoTerreno = k;
    for (const m of terrenoMalhas) {
      terreno.remove(m.malha);
      m.descartar();
    }
    terrenoMalhas = [];
    const solo = new Blocos(r);
    const plantas = new Blocos(r);
    for (let x = 0; x < T; x++)
      for (let z = 0; z < T; z++) {
        const c = centroDoQuadrado(T, x, z);
        const can = ilha.canteiros[chave(x, z)];
        if (!can) {
          solo.base(c.x, 0, c.z, 0.98, 0.04, 0.98, (x + z) % 2 ? 0x8fd456 : 0x86cc4e, 0.03);
          continue;
        }
        const est = estadoDoCanteiro(can, t);
        solo.base(c.x, 0, c.z, 0.96, 0.08, 0.96, est === "arado" ? 0x7a4a2a : 0x6a3f22, 0.05);
        for (const d of [-0.28, 0, 0.28])
          solo.base(c.x + d, 0.08, c.z, 0.12, 0.04, 0.86, 0x5a341c, 0.04);
        if (can.cultura && est !== "arado") {
          const prog =
            can.plantadoEm && can.maduroEm
              ? (t - can.plantadoEm) / Math.max(1, can.maduroEm - can.plantadoEm)
              : 1;
          planta(plantas, c.x, c.z, can.cultura, est === "maduro" ? 2 : prog < 0.5 ? 0 : 1);
          if (can.adubo) plantas.base(c.x + 0.38, 0.1, c.z - 0.38, 0.12, 0.12, 0.12, 0x9b6bff, 0);
        }
      }
    // cerca em volta do terreno, aberta no meio do lado do portal
    const cerca = new Blocos(r);
    const L = T / 2 + 0.35;
    for (let p = -L; p <= L + 0.01; p += 1) {
      for (const [x, z] of [
        [p, -L],
        [p, L],
        [-L, p],
        [L, p],
      ] as const) {
        if (z === L && Math.abs(x) < 1.2) continue;
        cerca.base(x, 0, z, 0.14, 0.7, 0.14, 0x8a5a3a, 0.05);
      }
    }
    for (const y of [0.28, 0.56]) {
      for (const l of [-1, 1]) cerca.base(0, y, l * L * -1, T + 0.8, 0.08, 0.07, 0x9c6a36, 0.04);
      for (const l of [-1, 1]) cerca.base(l * L, y, 0, 0.07, 0.08, T + 0.8, 0x9c6a36, 0.04);
    }
    // abre a passagem da frente (tira as ripas do meio)
    for (const y of [0.28, 0.56]) cerca.base(0, y, L, 2.3, 0.09, 0.09, 0x86cc4e, 0);
    const mSolo = solo.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.03, junta: 0.2, pe: 0.1, grao: 0.06 },
    });
    const mPlantas = plantas.construir(THREE, {
      acabamento: { chanfro: 0.04, junta: 0.1, pe: 0.2, grao: 0.06 },
    });
    const mCerca = cerca.construir(THREE, {
      acabamento: { chanfro: 0.03, junta: 0.14, pe: 0.12, grao: 0.07 },
    });
    for (const m of [mSolo, mPlantas, mCerca]) {
      terreno.add(m.malha);
      terrenoMalhas.push(m);
    }
  }

  // objetos (árvores, animais, decorações e projetos): um grupo por objeto
  const malhasDeObjeto = new Map<string, { o: TH.Object3D; chave: string }>();
  function desenhoProprio(modelo: string): TH.Object3D {
    const b = new Blocos(sorteador(modelo.length * 31));
    const corpo = (cor: number, branco = 0xffffff) => {
      b.base(0, 0.3, 0, 0.75, 0.42, 0.42, cor, 0.04);
      for (const [dx, dz] of [
        [-0.25, -0.13],
        [0.25, -0.13],
        [-0.25, 0.13],
        [0.25, 0.13],
      ] as const)
        b.base(dx, 0, dz, 0.1, 0.3, 0.1, 0x3a2a1a, 0);
      b.base(0.42, 0.52, 0, 0.26, 0.26, 0.28, cor, 0.04);
      b.base(0.56, 0.58, 0.08, 0.04, 0.05, 0.05, 0x1d1a17, 0);
      b.base(0.56, 0.58, -0.08, 0.04, 0.05, 0.05, 0x1d1a17, 0);
      void branco;
    };
    switch (modelo) {
      case "vaca":
        corpo(0xf6f1e4);
        b.base(-0.1, 0.5, 0.21, 0.24, 0.18, 0.02, 0x1d1a17, 0);
        b.base(0.15, 0.4, -0.21, 0.2, 0.16, 0.02, 0x1d1a17, 0);
        b.base(0.56, 0.46, 0, 0.06, 0.1, 0.2, 0xf2a3b4, 0);
        break;
      case "ovelha":
        corpo(0xfbfbf6);
        b.base(0, 0.36, 0, 0.84, 0.48, 0.5, 0xffffff, 0.03);
        b.base(0.46, 0.52, 0, 0.2, 0.22, 0.22, 0x2b2622, 0);
        break;
      case "cabra":
        corpo(0xd8c8b0);
        b.base(0.48, 0.74, 0.07, 0.04, 0.16, 0.04, 0x6b5a4a, 0);
        b.base(0.48, 0.74, -0.07, 0.04, 0.16, 0.04, 0x6b5a4a, 0);
        b.base(0.56, 0.36, 0, 0.06, 0.12, 0.06, 0xd8c8b0, 0);
        break;
      case "pato":
        b.base(0, 0.08, 0, 0.42, 0.26, 0.3, 0xfbfbf6, 0.03);
        b.base(0.18, 0.3, 0, 0.18, 0.2, 0.18, 0x3f8f4a, 0.03);
        b.base(0.32, 0.32, 0, 0.12, 0.05, 0.08, 0xf2a21e, 0);
        b.base(-0.04, 0, 0, 0.08, 0.08, 0.2, 0xf2a21e, 0);
        break;
      case "bananeira":
      case "coqueiro": {
        const alto = modelo === "coqueiro" ? 2.2 : 1.5;
        for (let k = 0; k < 6; k++)
          b.base(Math.sin(k * 0.3) * 0.06, k * (alto / 6), 0, 0.16, alto / 6, 0.16, 0x8a5a3a, 0.05);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          b.base(Math.cos(a) * 0.38, alto, Math.sin(a) * 0.38, 0.62, 0.06, 0.2, 0x3f9a34, 0.06, -a);
        }
        const fruto = modelo === "coqueiro" ? 0x6b4a2c : 0xf2d33a;
        for (const [dx, dz] of [
          [0.1, 0.08],
          [-0.08, 0.1],
          [0, -0.1],
        ] as const)
          b.base(dx, alto - 0.18, dz, 0.13, 0.16, 0.13, fruto, 0.04);
        break;
      }
      case "moinho":
        b.base(0, 0, 0, 0.7, 1.6, 0.7, 0xf2e9d8, 0.03);
        b.base(0, 1.6, 0, 0.8, 0.3, 0.8, 0xd8281f, 0.03);
        b.base(0, 1.3, 0.38, 1.2, 0.12, 0.04, 0x8a5a3a, 0, Math.PI / 4);
        b.base(0, 1.3, 0.38, 1.2, 0.12, 0.04, 0x8a5a3a, 0, -Math.PI / 4);
        break;
      case "estatua":
        b.base(0, 0, 0, 0.7, 0.3, 0.7, 0xd8d2c4, 0.03);
        b.base(0, 0.3, 0, 0.42, 0.5, 0.36, 0xd8281f, 0.03);
        b.base(0, 0.8, 0, 0.55, 0.45, 0.5, 0xf6f1e4, 0.03);
        b.base(0.1, 0.95, 0.26, 0.08, 0.08, 0.02, 0x1d1a17, 0);
        b.base(-0.1, 0.95, 0.26, 0.08, 0.08, 0.02, 0x1d1a17, 0);
        break;
      case "espantalho":
        b.base(0, 0, 0, 0.08, 1.3, 0.08, 0x8a5a3a, 0);
        b.base(0, 0.85, 0, 0.9, 0.08, 0.08, 0x8a5a3a, 0);
        b.base(0, 0.65, 0, 0.36, 0.42, 0.2, 0xd8281f, 0.03);
        b.base(0, 1.12, 0, 0.26, 0.26, 0.24, 0xf2d8a8, 0.02);
        b.base(0, 1.38, 0, 0.42, 0.06, 0.42, 0xe8c25a, 0.02);
        b.base(0, 1.44, 0, 0.22, 0.14, 0.22, 0xe8c25a, 0.02);
        break;
      case "fonte":
        b.base(0, 0, 0, 0.9, 0.3, 0.9, 0xd8d2c4, 0.03);
        b.base(0, 0.3, 0, 0.7, 0.05, 0.7, 0x5fc8ff, 0);
        b.base(0, 0.3, 0, 0.16, 0.6, 0.16, 0xe8e2d4, 0.02);
        b.base(0, 0.9, 0, 0.3, 0.1, 0.3, 0xf2c12e, 0.02);
        break;
      case "placa":
        b.base(0, 0, 0, 0.08, 0.7, 0.08, 0x8a5a3a, 0);
        b.base(0, 0.55, 0.05, 0.62, 0.36, 0.06, 0xd9a83a, 0.02);
        break;
      case "capivara":
        b.base(0, 0.12, 0, 0.62, 0.34, 0.36, 0x9a6b42, 0.04);
        b.base(0.36, 0.22, 0, 0.24, 0.24, 0.28, 0x8a5e3a, 0.04);
        for (const [dx, dz] of [
          [-0.2, -0.12],
          [0.2, -0.12],
          [-0.2, 0.12],
          [0.2, 0.12],
        ] as const)
          b.base(dx, 0, dz, 0.08, 0.12, 0.08, 0x6b4a2c, 0);
        break;
      case "arara":
        b.base(0, 0, 0, 0.06, 0.9, 0.06, 0x8a5a3a, 0);
        b.base(0, 0.9, 0, 0.5, 0.06, 0.06, 0x8a5a3a, 0);
        b.base(0.1, 0.96, 0, 0.16, 0.28, 0.16, 0xd8281f, 0.03);
        b.base(0.1, 0.9, 0, 0.12, 0.1, 0.4, 0x2f6bff, 0.03);
        b.base(0.18, 1.18, 0, 0.06, 0.06, 0.06, 0xf2c12e, 0);
        break;
      case "trofeu":
        b.base(0, 0, 0, 0.5, 0.2, 0.5, 0x3a2a1a, 0.02);
        b.base(0, 0.2, 0, 0.12, 0.3, 0.12, 0xf2c12e, 0.02);
        b.base(0, 0.5, 0, 0.42, 0.36, 0.42, 0xf2c12e, 0.02);
        break;
      case "garagem":
        b.base(0, 0, 0, 1.9, 1.4, 1.9, 0xd8d2c4, 0.03);
        b.base(0, 1.4, 0, 2.1, 0.25, 2.1, 0x4a4f58, 0.03);
        b.base(0, 0, 0.96, 1.1, 1.0, 0.04, 0x8a8f98, 0);
        break;
      case "aprisco":
        b.base(0, 0, 0, 1.9, 1.1, 1.9, 0xf2e9d8, 0.03);
        b.base(0, 1.1, 0, 2.1, 0.35, 2.1, 0x8a5a3a, 0.03);
        b.base(0, 0, 0.96, 0.6, 0.8, 0.04, 0x6b4a2c, 0);
        break;
      case "pomar":
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          b.base(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85, 0.1, 0.6, 0.1, 0x8a5a3a, 0);
        }
        b.base(0, 0, 0, 0.5, 0.06, 0.5, 0x6a3f22, 0);
        b.base(0, 0.06, 0, 0.12, 0.6, 0.12, 0x8a5a3a, 0);
        b.base(0, 0.66, 0, 0.6, 0.5, 0.6, 0x3f9a34, 0.06);
        break;
      case "reserva":
        b.base(0, 0, 0, 1.9, 0.05, 1.9, 0x5ab84a, 0.04);
        b.base(-0.4, 0.05, 0.2, 0.8, 0.02, 0.7, 0x5fc8ff, 0);
        for (let k = -2; k <= 2; k++) {
          b.base(k * 0.45, 0, -0.95, 0.08, 0.6, 0.08, 0x8a5a3a, 0);
          b.base(k * 0.45, 0, 0.95, 0.08, 0.6, 0.08, 0x8a5a3a, 0);
        }
        break;
      default:
        b.base(0, 0, 0, 0.5, 0.5, 0.5, 0xd8d2c4, 0.03);
    }
    const mm = b.construir(THREE, {
      acabamento: { chanfro: 0.03, junta: 0.12, pe: 0.12, grao: 0.06 },
    });
    const g = new THREE.Group();
    g.add(mm.malha);
    g.userData["descartar"] = mm.descartar;
    return g;
  }
  function montarObjeto(modelo: string): TH.Object3D {
    const g = new THREE.Group();
    const m = modeloDoPacote(modelo) ?? desenhoProprio(modelo);
    g.add(m);
    return g;
  }
  function montarObjetos() {
    if (!ilha) return;
    const T = ilha.tamanho;
    const vivos = new Set<string>();
    const lista = [
      ...ilha.objetos.map((o) => ({
        id: o.id,
        modelo: item(o.item)?.modelo ?? "caixa",
        x: o.x,
        z: o.z,
        rot: o.rot,
        w: 1,
        h: 1,
      })),
      ...ilha.projetos.map((p) => ({
        id: `projeto:${p.id}`,
        modelo: PROJETOS.find((x) => x.id === p.id)?.modelo ?? "garagem",
        x: p.x,
        z: p.z,
        rot: 0,
        w: 2,
        h: 2,
      })),
    ];
    for (const o of lista) {
      vivos.add(o.id);
      const k = `${o.modelo}:${o.x}:${o.z}:${o.rot}:${T}:${pecas.size}`;
      const atual = malhasDeObjeto.get(o.id);
      if (atual?.chave === k) continue;
      if (atual) objetos.remove(atual.o);
      const g = montarObjeto(o.modelo);
      const c = centroDoQuadrado(T, o.x + (o.w - 1) / 2, o.z + (o.h - 1) / 2);
      g.position.set(c.x, 0, c.z);
      g.rotation.y = (o.rot * Math.PI) / 2;
      g.userData["objeto"] = o.id;
      g.traverse((ch) => (ch.userData["objeto"] = o.id));
      objetos.add(g);
      malhasDeObjeto.set(o.id, { o: g, chave: k });
    }
    for (const [id, v] of malhasDeObjeto)
      if (!vivos.has(id)) {
        objetos.remove(v.o);
        (v.o.children[0]?.userData["descartar"] as (() => void) | undefined)?.();
        malhasDeObjeto.delete(id);
      }
  }
  function marcarProntos() {
    prontos.length = 0;
    if (!ilha) return;
    const T = ilha.tamanho;
    const t = agora();
    for (const [k, c] of Object.entries(ilha.canteiros)) {
      if (estadoDoCanteiro(c, t) !== "maduro") continue;
      const [x, z] = k.split(",").map(Number) as [number, number];
      const p = centroDoQuadrado(T, x, z);
      prontos.push(new THREE.Vector3(p.x, 0.95, p.z));
    }
    for (const o of ilha.objetos)
      if (o.prontoEm !== null && t >= o.prontoEm) {
        const p = centroDoQuadrado(T, o.x, o.z);
        prontos.push(new THREE.Vector3(p.x, item(o.item)?.tipo === "arvore" ? 2.1 : 1.1, p.z));
      }
  }
  // moedinhas douradas pulando em cima do que está pronto
  const gMoeda = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 18);
  gMoeda.rotateX(Math.PI / 2);
  const mMoeda = new THREE.MeshStandardMaterial({
    color: 0xffc531,
    emissive: 0xb07a00,
    emissiveIntensity: 0.6,
    metalness: 0.4,
    roughness: 0.3,
  });
  const moedas = new THREE.InstancedMesh(gMoeda, mMoeda, 420);
  moedas.count = 0;
  moedas.frustumCulled = false;
  cena.add(moedas);
  lixo.push(gMoeda, mMoeda);

  // ---------------- seleção: quadrado sob o mouse, área do trator e fantasma do que vai ser colocado ----------------
  const gSel = new THREE.PlaneGeometry(1, 1);
  gSel.rotateX(-Math.PI / 2);
  const mSel = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    toneMapped: false,
  });
  const selecao = new THREE.InstancedMesh(gSel, mSel, 16);
  selecao.count = 0;
  selecao.renderOrder = 3;
  cena.add(selecao);
  lixo.push(gSel, mSel);
  let fantasma: Fantasma | null = null;
  let malhaFantasma: TH.Object3D | null = null;
  let area: [number, number] | null = null;
  let quadradoSob: [number, number] | null = null;
  let ferramentaAtiva = false;

  // ---------------- pessoas: o meu HOKI e os visitantes ----------------
  let modeloHoki: Modelo | undefined;
  void modeloLeve(THREE).then((m) => {
    modeloHoki = m;
    for (const a of avatares.values()) a.chave = "";
    if (ultimasPessoas) setPessoas(ultimasPessoas);
  });
  interface Avatar {
    id: string;
    chave: string;
    grupo: TH.Group;
    mascote: ReturnType<typeof criarMascote>;
    pos: { x: number; z: number };
    alvo: { x: number; z: number };
    rumo: number;
    rotulo: HTMLDivElement;
    souEu: boolean;
  }
  const avatares = new Map<string, Avatar>();
  let ultimasPessoas: Pessoa[] | null = null;
  let aoChegar: (() => void) | null = null;
  function setPessoas(lista: Pessoa[]) {
    ultimasPessoas = lista;
    const vivos = new Set(lista.map((p) => p.id));
    for (const [id, a] of avatares)
      if (!vivos.has(id)) {
        cena.remove(a.grupo);
        a.mascote.descartar();
        a.rotulo.remove();
        avatares.delete(id);
      }
    for (const p of lista) {
      const ch = JSON.stringify(p.visual) + (modeloHoki ? "1" : "0");
      let a = avatares.get(p.id);
      if (!a || a.chave !== ch) {
        if (a) {
          cena.remove(a.grupo);
          a.mascote.descartar();
        }
        const grupo = new THREE.Group();
        grupo.scale.setScalar(ESCALA_HOKI);
        const mascote = criarMascote(THREE, p.visual, { modelo: modeloHoki, mundo: true });
        mascote.raiz.traverse((o) => {
          if ((o as TH.Mesh).isMesh) o.castShadow = true;
        });
        void peca;
        grupo.add(mascote.raiz);
        cena.add(grupo);
        const rotulo = a?.rotulo ?? document.createElement("div");
        if (!a) {
          rotulo.style.cssText = "position:absolute;left:0;top:0;will-change:transform";
          camada.appendChild(rotulo);
        }
        a = {
          id: p.id,
          chave: ch,
          grupo,
          mascote,
          pos: a?.pos ?? { x: p.x, z: p.z },
          alvo: a?.alvo ?? { x: p.x, z: p.z },
          rumo: a?.rumo ?? Math.PI,
          rotulo,
          souEu: !!p.souEu,
        };
        avatares.set(p.id, a);
      }
      if (!p.souEu) a.alvo = { x: p.x, z: p.z };
      // plaquinha: [nível] nick [cargo]
      const selo = p.selo
        ? `<span style="background:${p.selo.fundo};color:${p.selo.texto}" class="mr-1 rounded-full px-1.5 text-[9.5px] font-extrabold leading-[15px]">${p.selo.nivel}</span>`
        : "";
      const tag = p.tag
        ? `<span class="ml-1 rounded-full bg-[#ce0e0e] px-1 text-[8.5px] font-bold leading-[13px] text-white">${p.tag}</span>`
        : "";
      a.rotulo.innerHTML = `<div class="-translate-x-1/2 -translate-y-full flex items-center whitespace-nowrap rounded-full bg-black/60 py-px pl-0.5 pr-1.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">${selo}${escapar(p.nome)}${tag}</div>`;
    }
  }
  const escapar = (s: string) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
    );
  const eu = () => [...avatares.values()].find((a) => a.souEu);
  function irAte(x: number, z: number, depois?: () => void) {
    const a = eu();
    if (!a) return;
    a.alvo = {
      x: Math.max(-MEIA + 1.2, Math.min(MEIA - 1.2, x)),
      z: Math.max(-MEIA + 1.2, Math.min(MEIA - 1.2, z)),
    };
    aoChegar = depois ?? null;
  }

  // ---------------- câmera: segue o meu HOKI; arrastar gira, roda aproxima ----------------
  let giro = 0;
  let subida = 0.95;
  let distancia = 25;
  const olhar = new THREE.Vector3(0, 0, 6);
  const medir = () => {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(medir);
  observador.observe(el);
  medir();

  const raio = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ponto = new THREE.Vector3();
  const noChao = (px: number, py: number) => {
    const caixa = renderer.domElement.getBoundingClientRect();
    ndc.set(((px - caixa.left) / caixa.width) * 2 - 1, -((py - caixa.top) / caixa.height) * 2 + 1);
    raio.setFromCamera(ndc, camera);
    return raio.ray.intersectPlane(plano, ponto) ? { x: ponto.x, z: ponto.z } : null;
  };
  const quadradoEm = (p: { x: number; z: number } | null): [number, number] | null => {
    if (!p || !ilha) return null;
    const T = ilha.tamanho;
    const x = Math.floor(p.x + T / 2);
    const z = Math.floor(p.z + T / 2);
    return x >= 0 && z >= 0 && x < T && z < T ? [x, z] : null;
  };
  let arrasto: { x: number; y: number; andou: boolean } | null = null;
  const aoBaixar = (e: PointerEvent) => {
    arrasto = { x: e.clientX, y: e.clientY, andou: false };
  };
  const aoMover = (e: PointerEvent) => {
    quadradoSob = quadradoEm(noChao(e.clientX, e.clientY));
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x;
    const dy = e.clientY - arrasto.y;
    if (!arrasto.andou && Math.hypot(dx, dy) < 6) return;
    arrasto = { x: e.clientX, y: e.clientY, andou: true };
    giro -= dx * 0.006;
    subida = Math.max(0.35, Math.min(1.35, subida + dy * 0.004));
  };
  const aoSoltar = (e: PointerEvent) => {
    const a = arrasto;
    arrasto = null;
    if (!a || a.andou) return;
    const caixa = renderer.domElement.getBoundingClientRect();
    ndc.set(
      ((e.clientX - caixa.left) / caixa.width) * 2 - 1,
      -((e.clientY - caixa.top) / caixa.height) * 2 + 1,
    );
    raio.setFromCamera(ndc, camera);
    const toques = raio.intersectObjects([portal, correio, objetos], true);
    for (const t of toques) {
      let o: TH.Object3D | null = t.object;
      while (o) {
        if (o.userData["portal"]) return eventos.onPortal();
        if (o.userData["correio"]) return eventos.onCorreio();
        if (o.userData["objeto"] && !ferramentaAtiva)
          return eventos.onObjeto(String(o.userData["objeto"]));
        o = o.parent;
      }
    }
    const p = noChao(e.clientX, e.clientY);
    const q = quadradoEm(p);
    if (q) return eventos.onQuadrado(q[0], q[1]);
    if (p) eventos.onChao(p.x, p.z);
  };
  const aoRolar = (e: WheelEvent) => {
    e.preventDefault();
    distancia = Math.max(7, Math.min(44, distancia * Math.exp(e.deltaY * 0.0012)));
  };
  const tela = renderer.domElement;
  tela.addEventListener("pointerdown", aoBaixar);
  tela.addEventListener("pointermove", aoMover);
  tela.addEventListener("pointerup", aoSoltar);
  tela.addEventListener("wheel", aoRolar, { passive: false });

  // ---------------- teclado: W A S D ou as setas andam com o meu HOKI (para onde a câmera olha) ----------------
  /** [lado, frente] de cada tecla: D/→ = direita, W/↑ = para longe da câmera. */
  const DIRECAO: Record<string, [number, number]> = {
    KeyW: [0, 1],
    ArrowUp: [0, 1],
    KeyS: [0, -1],
    ArrowDown: [0, -1],
    KeyA: [-1, 0],
    ArrowLeft: [-1, 0],
    KeyD: [1, 0],
    ArrowRight: [1, 0],
  };
  const POR_LETRA: Record<string, string> = { w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD" };
  const teclaDe = (e: KeyboardEvent) =>
    DIRECAO[e.code] ? e.code : (POR_LETRA[e.key?.toLowerCase() ?? ""] ?? "");
  const apertadas = new Set<string>();
  let tecladoLigado = true;
  let andandoPorTecla = false;
  const aoApertar = (e: KeyboardEvent) => {
    const k = teclaDe(e);
    if (!k || !tecladoLigado || e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = e.target as HTMLElement | null;
    if (alvo?.closest?.("input, textarea, select, [contenteditable='true']")) return;
    e.preventDefault();
    apertadas.add(k);
  };
  const aoLargar = (e: KeyboardEvent) => void apertadas.delete(teclaDe(e));
  const largarTudo = () => apertadas.clear();
  window.addEventListener("keydown", aoApertar);
  window.addEventListener("keyup", aoLargar);
  window.addEventListener("blur", largarTudo);

  // ---------------- quadro a quadro ----------------
  const aux = new THREE.Object3D();
  const vetor = new THREE.Vector3();
  let raf = 0;
  let antes = performance.now();
  let tempo = 0;
  let proximaRevisao = 0;
  const quadro = (agoraMs: number) => {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agoraMs - antes) / 1000);
    antes = agoraMs;
    tempo += dt;
    uPortal.uT.value = tempo;
    // a cada meio segundo revê o que cresceu e o que ficou pronto
    if (tempo > proximaRevisao) {
      proximaRevisao = tempo + 0.5;
      montarTerreno();
      marcarProntos();
    }
    moedas.count = Math.min(prontos.length, 420);
    for (let k = 0; k < moedas.count; k++) {
      const p = prontos[k]!;
      aux.position.set(p.x, p.y + Math.sin(tempo * 3 + k) * 0.08, p.z);
      aux.rotation.set(0, tempo * 2.4 + k, 0);
      aux.updateMatrix();
      moedas.setMatrixAt(k, aux.matrix);
    }
    moedas.instanceMatrix.needsUpdate = true;
    // seleção (quadrado ou área do trator), com o fantasma do objeto
    selecao.count = 0;
    if (ilha && quadradoSob && ferramentaAtiva) {
      const T = ilha.tamanho;
      const [w, h] = fantasma ? [fantasma.w, fantasma.h] : (area ?? [1, 1]);
      const valido = fantasma ? fantasma.valido(quadradoSob[0], quadradoSob[1]) : true;
      mSel.color.set(valido ? 0x8dff7a : 0xff5a5a);
      for (let dx = 0; dx < w; dx++)
        for (let dz = 0; dz < h; dz++) {
          const x = quadradoSob[0] + dx;
          const z = quadradoSob[1] + dz;
          if (x >= T || z >= T || selecao.count >= 16) continue;
          const c = centroDoQuadrado(T, x, z);
          aux.position.set(c.x, 0.12, c.z);
          aux.rotation.set(0, 0, 0);
          aux.scale.set(0.96, 1, 0.96);
          aux.updateMatrix();
          selecao.setMatrixAt(selecao.count++, aux.matrix);
        }
      selecao.instanceMatrix.needsUpdate = true;
      if (malhaFantasma) {
        const c = centroDoQuadrado(T, quadradoSob[0] + (w - 1) / 2, quadradoSob[1] + (h - 1) / 2);
        malhaFantasma.position.set(c.x, 0, c.z);
        malhaFantasma.visible = true;
      }
    } else if (malhaFantasma) malhaFantasma.visible = false;
    // W A S D: o alvo vai sempre um pouco à frente (anda e anima); ao soltar, para onde está
    const euAqui = eu();
    if (euAqui) {
      let lado = 0;
      let frente = 0;
      for (const k of apertadas) {
        lado += DIRECAO[k]?.[0] ?? 0;
        frente += DIRECAO[k]?.[1] ?? 0;
      }
      const n = Math.hypot(lado, frente);
      if (n > 0) {
        // frente = (−sen giro, −cos giro) e direita = (cos giro, −sen giro), no chão
        const mx = (lado * Math.cos(giro) - frente * Math.sin(giro)) / n;
        const mz = (-lado * Math.sin(giro) - frente * Math.cos(giro)) / n;
        const lim = MEIA - 1.2;
        euAqui.alvo = {
          x: Math.max(-lim, Math.min(lim, euAqui.pos.x + mx * 0.6)),
          z: Math.max(-lim, Math.min(lim, euAqui.pos.z + mz * 0.6)),
        };
        aoChegar = null;
        andandoPorTecla = true;
      } else if (andandoPorTecla) {
        andandoPorTecla = false;
        euAqui.alvo = { ...euAqui.pos };
      }
    }
    // pessoas andando
    for (const a of avatares.values()) {
      const dx = a.alvo.x - a.pos.x;
      const dz = a.alvo.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      const andando = d > 0.05;
      if (andando) {
        const passo = Math.min(d, 3.4 * dt);
        a.pos.x += (dx / d) * passo;
        a.pos.z += (dz / d) * passo;
        a.rumo = Math.atan2(dx, dz);
      } else if (a.souEu && aoChegar) {
        const f = aoChegar;
        aoChegar = null;
        f();
      }
      const giroAtual = a.grupo.rotation.y;
      a.grupo.rotation.y =
        giroAtual +
        Math.atan2(Math.sin(a.rumo - giroAtual), Math.cos(a.rumo - giroAtual)) *
          Math.min(1, dt * 10);
      a.grupo.position.set(a.pos.x, 0, a.pos.z);
      a.mascote.atualizar({
        t: tempo,
        humor: "normal",
        reacao: null,
        p: 0,
        mouse: { x: 0, y: 0 },
        calmo: false,
        andando,
      });
      vetor.set(a.pos.x, (a.mascote.topo + 0.35) * ESCALA_HOKI, a.pos.z).project(camera);
      const w = el.clientWidth;
      const h = el.clientHeight;
      const visivel = vetor.z < 1 && Math.abs(vetor.x) < 1.1 && Math.abs(vetor.y) < 1.1;
      a.rotulo.style.display = visivel ? "" : "none";
      if (visivel)
        a.rotulo.style.transform = `translate3d(${((vetor.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-vetor.y * 0.5 + 0.5) * h).toFixed(1)}px, 0)`;
    }
    // câmera atrás do meu HOKI, puxada um pouco para o meio da plantação (dá para ver os canteiros)
    const meu = eu();
    if (meu) olhar.lerp(vetor.set(meu.pos.x * 0.6, 0.6, meu.pos.z * 0.6), Math.min(1, dt * 4));
    camera.position.set(
      olhar.x + Math.sin(giro) * Math.cos(subida) * distancia,
      olhar.y + Math.sin(subida) * distancia,
      olhar.z + Math.cos(giro) * Math.cos(subida) * distancia,
    );
    camera.lookAt(olhar);
    for (const n of nuvens.nuvens) n.malha.position.x = n.x0 + Math.sin(tempo * 0.04 + n.x0) * 3;
    renderer.render(cena, camera);
  };
  raf = requestAnimationFrame(quadro);

  void carregarPacote(THREE).then((p) => {
    pecas = p;
    montarCenario();
    for (const v of malhasDeObjeto.values()) v.chave = "";
    montarObjetos();
  });

  return {
    /** Novo estado da ilha (e a hora do servidor, para os relógios baterem). */
    setIlha(nova: Ilha, horaDoServidor: number) {
      ilha = nova;
      agoraServidor = horaDoServidor;
      diferencaRelogio = agoraServidor - Date.now();
      ultimaChaveDoTerreno = "";
      montarTerreno();
      montarObjetos();
      marcarProntos();
      posicionarCasa();
    },
    setPessoas,
    /** Com uma ferramenta na mão, o quadrado sob o mouse fica marcado (e a área do trator, se houver). */
    setFerramenta(ativa: boolean, novaArea: [number, number] | null = null) {
      ferramentaAtiva = ativa;
      area = novaArea;
    },
    setFantasma(f: Fantasma | null) {
      fantasma = f;
      if (malhaFantasma) {
        cena.remove(malhaFantasma);
        malhaFantasma = null;
      }
      if (f) {
        malhaFantasma = montarObjeto(f.modelo);
        malhaFantasma.traverse((o) => {
          const m = o as TH.Mesh;
          if (m.isMesh) {
            m.material = (m.material as TH.Material).clone();
            (m.material as TH.Material).transparent = true;
            (m.material as TH.Material).opacity = 0.55;
          }
        });
        cena.add(malhaFantasma);
        ferramentaAtiva = true;
      }
    },
    irAte,
    /** W A S D e setas só valem sem janela aberta por cima da ilha. */
    setTeclado(ligado: boolean) {
      tecladoLigado = ligado;
      if (!ligado) apertadas.clear();
    },
    meuPos() {
      const a = eu();
      return a ? { ...a.pos } : { ...CHEGADA_DA_ILHA };
    },
    colocarNaChegada() {
      const a = eu();
      if (a) {
        a.pos = { ...CHEGADA_DA_ILHA };
        a.alvo = { ...CHEGADA_DA_ILHA };
      }
    },
    descartar() {
      cancelAnimationFrame(raf);
      observador.disconnect();
      tela.removeEventListener("pointerdown", aoBaixar);
      tela.removeEventListener("pointermove", aoMover);
      tela.removeEventListener("pointerup", aoSoltar);
      tela.removeEventListener("wheel", aoRolar);
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoLargar);
      window.removeEventListener("blur", largarTudo);
      for (const a of avatares.values()) {
        a.mascote.descartar();
        a.rotulo.remove();
      }
      for (const m of terrenoMalhas) m.descartar();
      lixo.forEach((l) => l.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      camada.remove();
    },
  };
}
export type CenaDaFazenda = ReturnType<typeof criarCenaDaFazenda>;
