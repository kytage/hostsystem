import type * as TH from "three";
import { registrarTerreno } from "./mundo-mapa";
import { texturaAgua } from "./voxel";

/**
 * Mapa "Breeze Island 2" (Minecraft), por cubical.xyz — CC-BY-4.0
 * (https://sketchfab.com/3d-models/breeze-island-2-minecraft-0e3df03e900640788b3c2657d8bcddcb).
 *
 * Fica longe da ilha da praça (fora da vista dela) e, por enquanto, só se chega
 * digitando /sg no chat. 1 bloco do Minecraft = 1 bloco da praça.
 *
 * O arquivo original tinha 281 MB; aqui ele vem enxuto (scripts no histórico da
 * sessão): o oceano virou uma superfície só, o fundo do mar escondido saiu, e o
 * resto foi cortado em pedaços de 64 x 64 blocos que só baixam quando você chega
 * perto. Um mapa de alturas (meio bloco de precisão) diz onde dá para pisar.
 */

const PASTA = "/hoki/mapas/breeze";
/** Onde fica o canto (0, 0) do mapa no mundo da praça. */
export const ORIGEM_BREEZE = { x: 267, z: -254 };
const LARGURA = 468;
const PROFUNDIDADE = 508;
const AGUA = 9.875;
/** Centro do mapa (onde o /sg leva): um pedaço de terra perto do meio. */
export const CENTRO_BREEZE = { x: ORIGEM_BREEZE.x + 237.5, z: ORIGEM_BREEZE.z + 222.5 };
/** Crédito obrigatório da licença (aparece na tela quando você está no mapa). */
export const CREDITO_BREEZE = "Breeze Island 2 — cubical.xyz (CC-BY 4.0)";

/** Está dentro da área do mapa? (com uma margem de mar em volta) */
export const noMapaBreeze = (x: number, z: number, margem = 0) =>
  x >= ORIGEM_BREEZE.x - margem &&
  x < ORIGEM_BREEZE.x + LARGURA + margem &&
  z >= ORIGEM_BREEZE.z - margem &&
  z < ORIGEM_BREEZE.z + PROFUNDIDADE + margem;

/* ------------------------------------------------------------------ */
/* chão pisável                                                        */
/* ------------------------------------------------------------------ */

let alturas: Uint8Array | null = null;
let pedindoAlturas: Promise<void> | null = null;
/** Altura dos pés do corpo que está andando agora (para saber o que é degrau e o que é parede). */
export const corpoNoMapa = { y: 0 };

function carregarAlturas() {
  if (!pedindoAlturas)
    pedindoAlturas = fetch(`${PASTA}/alturas.bin`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("sem alturas"))))
      .then((b) => {
        alturas = new Uint8Array(b);
      })
      .catch(() => {
        pedindoAlturas = null;
      });
  return pedindoAlturas;
}

/** Altura do chão na coluna de bloco (null = sem chão: mar ou fora). */
function colunaNoMapa(x: number, z: number) {
  if (!alturas) return null;
  const cx = Math.floor(x - ORIGEM_BREEZE.x);
  const cz = Math.floor(z - ORIGEM_BREEZE.z);
  if (cx < 0 || cz < 0 || cx >= LARGURA || cz >= PROFUNDIDADE) return null;
  const v = alturas[cx * PROFUNDIDADE + cz]!;
  return v ? (v - 1) / 2 : null;
}

/** Sobe andando até meio bloco (escada, laje); um bloco inteiro só pulando (como no Minecraft). */
const DEGRAU = 0.6;
const LADOS = [
  [0.2, 0.2],
  [-0.2, 0.2],
  [0.2, -0.2],
  [-0.2, -0.2],
] as const;

registrarTerreno({
  contem: (x, z) => noMapaBreeze(x, z),
  chao: (x, z) => colunaNoMapa(x, z) ?? AGUA,
  livre: (x, z) => {
    if (!alturas) return false;
    for (const [dx, dz] of LADOS) {
      const h = colunaNoMapa(x + dx, z + dz);
      if (h === null || h > corpoNoMapa.y + DEGRAU) return false;
    }
    return true;
  },
});

/* ------------------------------------------------------------------ */
/* desenho (pedaços carregados por perto)                              */
/* ------------------------------------------------------------------ */

interface Pedaco {
  x: number;
  z: number;
  arquivo: string;
}
const RAIO_CARREGA = 150;
const RAIO_SOLTA = 220;

export function criarMapaBreeze(THREE: typeof TH) {
  const grupo = new THREE.Group();
  grupo.name = "mapa-breeze";
  let vivo = true;
  let pedacos: Pedaco[] = [];
  const carregados = new Map<string, TH.Object3D | "carregando">();
  const lixo: { dispose: () => void }[] = [];

  // texturas de bloco (pixel nítido) e os dois materiais
  const leitorTex = new THREE.TextureLoader();
  const textura = (url: string) => {
    const t = leitorTex.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    // o glTF usa a imagem sem virar (o padrão do navegador vira de cabeça para baixo)
    t.flipY = false;
    // pixel nítido, sem misturar os blocos vizinhos do atlas
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    lixo.push(t);
    return t;
  };
  const matOpaco = new THREE.MeshLambertMaterial({
    map: textura(`${PASTA}/opaco.png`),
    vertexColors: true,
    flatShading: true,
  });
  const matRecorte = new THREE.MeshLambertMaterial({
    map: textura(`${PASTA}/recorte.png`),
    vertexColors: true,
    flatShading: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  lixo.push(matOpaco, matRecorte);

  // o oceano: uma superfície só, com a água da praça
  const tAgua = texturaAgua(THREE, 11);
  tAgua.wrapS = tAgua.wrapT = THREE.RepeatWrapping;
  tAgua.repeat.set(90, 90);
  const gMar = new THREE.PlaneGeometry(LARGURA + 400, PROFUNDIDADE + 400);
  gMar.rotateX(-Math.PI / 2);
  const mMar = new THREE.MeshLambertMaterial({ map: tAgua, transparent: true, opacity: 0.88 });
  const mar = new THREE.Mesh(gMar, mMar);
  mar.position.set(ORIGEM_BREEZE.x + LARGURA / 2, AGUA - 0.08, ORIGEM_BREEZE.z + PROFUNDIDADE / 2);
  mar.receiveShadow = true;
  mar.visible = false;
  grupo.add(mar);
  lixo.push(gMar, mMar, tAgua);

  let leitor: Promise<
    InstanceType<typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader>
  > | null = null;
  const pegarLeitor = () => {
    if (!leitor)
      leitor = import("three/examples/jsm/loaders/GLTFLoader.js").then(
        ({ GLTFLoader }) => new GLTFLoader(),
      );
    return leitor;
  };
  let pedindoLista = false;
  const carregarLista = () => {
    if (pedindoLista || pedacos.length) return;
    pedindoLista = true;
    void fetch(`${PASTA}/mapa.json`)
      .then((r) => r.json() as Promise<{ pedacos: Pedaco[] }>)
      .then((j) => {
        pedacos = j.pedacos;
      })
      .catch(() => {
        pedindoLista = false;
      });
  };

  const carregar = (p: Pedaco) => {
    carregados.set(p.arquivo, "carregando");
    void pegarLeitor()
      .then((l) => l.loadAsync(`${PASTA}/${p.arquivo}`))
      .then((g) => {
        if (!vivo || carregados.get(p.arquivo) !== "carregando") return;
        const cena = g.scene;
        cena.position.set(ORIGEM_BREEZE.x + p.x * 64, 0, ORIGEM_BREEZE.z + p.z * 64);
        cena.traverse((o) => {
          const m = o as TH.Mesh;
          if (!m.isMesh) return;
          const recorte = m.name.includes("recorte") || m.parent?.name.includes("recorte");
          m.material = recorte ? matRecorte : matOpaco;
          m.castShadow = false; // a sombra já vem pintada nos blocos (cor de cada canto)
          m.receiveShadow = true;
        });
        grupo.add(cena);
        carregados.set(p.arquivo, cena);
      })
      .catch(() => carregados.delete(p.arquivo));
  };
  const soltar = (arquivo: string) => {
    const o = carregados.get(arquivo);
    carregados.delete(arquivo);
    if (!o || o === "carregando") return;
    grupo.remove(o);
    o.traverse((x) => (x as TH.Mesh).geometry?.dispose());
  };

  return {
    grupo,
    /** Carrega e solta pedaços conforme o foco (a vista do jogador) chega perto. */
    atualizar(foco: { x: number; z: number }, t: number) {
      const perto = noMapaBreeze(foco.x, foco.z, RAIO_CARREGA);
      mar.visible = perto;
      if (!perto) {
        for (const k of [...carregados.keys()]) soltar(k);
        return;
      }
      void carregarAlturas();
      carregarLista();
      tAgua.offset.set(t * 0.01, -t * 0.03);
      for (const p of pedacos) {
        const cx = ORIGEM_BREEZE.x + p.x * 64 + 32;
        const cz = ORIGEM_BREEZE.z + p.z * 64 + 32;
        const d = Math.hypot(cx - foco.x, cz - foco.z) - 45;
        const tem = carregados.has(p.arquivo);
        if (!tem && d < RAIO_CARREGA) carregar(p);
        else if (tem && d > RAIO_SOLTA) soltar(p.arquivo);
      }
    },
    /** Já dá para pisar no mapa? (o mapa de alturas chegou) */
    pronto: () => !!alturas,
    preparar: () => carregarAlturas(),
    descartar() {
      vivo = false;
      for (const k of [...carregados.keys()]) soltar(k);
      for (const l of lixo) l.dispose();
    },
  };
}
