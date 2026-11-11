/**
 * Miniaturas 3D das peças da loja e do guarda-roupa: cada item é fotografado
 * de verdade, vestido no HOKI (ou, nos pódios, o próprio pódio), num estúdio
 * escondido. As fotos ficam guardadas, então cada peça só é desenhada uma vez.
 */
import type * as TH from "three";
import { vestirPeca, VISUAL_PADRAO, type Grupo, type Peca } from "@/lib/hoki";
import { criarPodio } from "./podios";
import { montarLuzes, prepararDesenho } from "./luz";
import { criarMascote } from "./mascote";
import { modeloCompleto, type Modelo } from "./modelo";

interface Estudio {
  THREE: typeof TH;
  renderer: TH.WebGLRenderer;
  cena: TH.Scene;
  camera: TH.PerspectiveCamera;
  modelo: Modelo | undefined;
}
const LADO = 256;
let estudio: Promise<Estudio> | null = null;
function abrirEstudio() {
  estudio ??= import("three").then(async (THREE) => {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(LADO, LADO, false);
    prepararDesenho(THREE, renderer);
    renderer.shadowMap.enabled = false;
    const cena = new THREE.Scene();
    montarLuzes(THREE, cena, { area: [2, 2], distancia: 10, sombras: false });
    const realce = new THREE.DirectionalLight(0xfff0dc, 0.9);
    realce.position.set(3.5, 5, -7);
    cena.add(realce);
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
    const modelo = await modeloCompleto(THREE).catch(() => undefined);
    return { THREE, renderer, cena, camera, modelo };
  });
  return estudio;
}

/** Como enquadrar cada tipo de peça: centro e altura mostrada (em frações da altura do HOKI) e de que lado a câmera fica. */
const QUADRO: Record<Grupo, { centro: number; altura: number; giro: number; sobe?: number }> = {
  traje: { centro: 0.5, altura: 1.12, giro: 0.32 },
  roupa: { centro: 0.34, altura: 0.5, giro: 0.4 },
  calca: { centro: 0.19, altura: 0.42, giro: 0.4 },
  chapeu: { centro: 0.8, altura: 0.78, giro: 0.4 },
  oculos: { centro: 0.6, altura: 0.6, giro: 0.25 },
  luvas: { centro: 0.34, altura: 0.5, giro: 0.5 },
  calcado: { centro: 0.07, altura: 0.3, giro: 0.5, sobe: 0.5 },
  costas: { centro: 0.36, altura: 0.56, giro: Math.PI - 0.6 },
  efeito: { centro: 0.5, altura: 1.2, giro: 0.32 },
  podio: { centro: 0.5, altura: 1, giro: 0.3 },
};

async function fotografar(p: Peca): Promise<string> {
  const { THREE, renderer, cena, camera, modelo } = await abrirEstudio();
  // bandeiras e asas passam da altura do tronco: pedem um quadro maior
  const q = p.id.startsWith("bandeira:")
    ? { centro: 0.66, altura: 1.5, giro: 0.45 }
    : p.id === "costas:asas"
      ? { centro: 0.4, altura: 1.0, giro: Math.PI - 0.5 }
      : QUADRO[p.grupo];
  const meio = Math.tan((26 * Math.PI) / 360);
  let raiz: TH.Object3D;
  let descartar: () => void;
  let alto: number;
  if (p.grupo === "podio") {
    const podio = criarPodio(THREE, p.tipo ?? "pedra", 15);
    raiz = podio.grupo;
    descartar = podio.descartar;
    alto = 2.1;
    camera.position.set(Math.sin(q.giro) * 6.2, 2.3, Math.cos(q.giro) * 6.2);
    camera.lookAt(0, 0.42, 0);
  } else {
    const visual = vestirPeca(VISUAL_PADRAO, p).visual;
    const mascote = criarMascote(THREE, visual, { modelo });
    mascote.atualizar({
      t: 0,
      humor: "normal",
      reacao: null,
      p: 0,
      mouse: { x: 0, y: 0 },
      calmo: true,
    });
    raiz = mascote.raiz;
    descartar = mascote.descartar;
    alto = mascote.topo;
    const dist = (alto * q.altura) / 2 / meio;
    const y = alto * q.centro;
    camera.position.set(
      Math.sin(q.giro) * dist,
      y + dist * (q.sobe ?? 0.14),
      Math.cos(q.giro) * dist,
    );
    camera.lookAt(0, y, 0);
  }
  cena.add(raiz);
  renderer.render(cena, camera);
  const foto = renderer.domElement.toDataURL("image/webp", 0.92);
  cena.remove(raiz);
  descartar();
  return foto;
}

const prontas = new Map<string, Promise<string>>();
let fila: Promise<unknown> = Promise.resolve();
/** Foto da peça (um endereço de imagem pronto para usar em <img>). Uma por vez, para não travar a tela. */
export function miniatura(p: Peca): Promise<string> {
  let foto = prontas.get(p.id);
  if (!foto) {
    foto = fila.then(() => new Promise<void>((ok) => setTimeout(ok, 0))).then(() => fotografar(p));
    fila = foto.catch(() => undefined);
    prontas.set(p.id, foto);
  }
  return foto;
}
