import type * as TH from "three";
import { sorteador } from "./voxel";

/**
 * Natureza do HOKI: árvores, arbustos, flores, capim e pedras em 3D.
 *
 * Os modelos vêm do pacote "Ultimate Stylized Nature" (Quaternius, licença CC0),
 * juntados num arquivo só e leve: public/hoki/natureza/natureza.glb (49 modelos,
 * ~2,6 MB, texturas reduzidas). Ver public/hoki/natureza/CREDITOS.txt.
 *
 * Uso: a cena vai anotando onde quer cada coisa (`arvore`, `arbusto`, `pedra`,
 * `flor`, `capim` ou `por`), e `construir` devolve um grupo que se enche sozinho
 * quando o arquivo termina de baixar. Cada modelo é desenhado de uma vez só
 * (instâncias), então dezenas de árvores custam pouco.
 */

export const ARQUIVO_NATUREZA = "/hoki/natureza/natureza.glb";

/** Todos os modelos do arquivo (a aba TESTE mostra a lista inteira). */
export const MODELOS_NATUREZA = [
  "MapleTree_1",
  "MapleTree_2",
  "MapleTree_4",
  "MapleTree_5",
  "BirchTree_1",
  "BirchTree_4",
  "BirchTree_5",
  "NormalTree_3",
  "NormalTree_4",
  "NormalTree_5",
  "PineTree_1",
  "PineTree_2",
  "PineTree_3",
  "PineTree_4",
  "PineTree_5",
  "PalmTree_1",
  "PalmTree_2",
  "PalmTree_3",
  "PalmTree_4",
  "PalmTree_5",
  "DeadTree_5",
  "DeadTree_9",
  "Bush",
  "Bush_Flowers",
  "Bush_Large",
  "Bush_Large_Flowers",
  "Bush_Small",
  "Bush_Small_Flowers",
  "Flower_1",
  "Flower_1_Clump",
  "Flower_2",
  "Flower_2_Clump",
  "Flower_3_Clump",
  "Flower_4_Clump",
  "Flower_5_Clump",
  "Grass_Large",
  "Grass_Small",
  "Plant_1",
  "Plant_2",
  "Plant_Flowers",
  "Petals_1",
  "Petals_2",
  "Petals_3",
  "Petals_4",
  "Rock_1",
  "Rock_2",
  "Rock_3",
  "Rock_4",
  "Rock_5",
] as const;
export type ModeloNatureza = (typeof MODELOS_NATUREZA)[number];

/** Cores das folhas (as folhas do arquivo são brancas; a cor entra aqui, por árvore). */
const FOLHA = {
  verde: [0x6fb734, 0x5ea62c, 0x80c43c, 0x4f9a2e],
  amarelo: [0xf2c230, 0xe9ad22, 0xf6d04a],
  laranja: [0xee7b2c, 0xdc5c24, 0xf29a3a],
  arbusto: [0x4f9e30, 0x5fae36, 0x458f2c],
} as const;
/** As folhas de bordo são cinza-claro no arquivo: levam um reforço para a cor sair viva. */
const REFORCO_BORDO = 1.3;

export interface OpcoesArvore {
  tipo?: "copa" | "copinha" | "pinheiro" | "palmeira";
  cor?: "verde" | "laranja" | "amarelo";
  /** Tamanho (0,8 = árvore normal da praça; menor encolhe a árvore inteira). */
  u?: number;
  /** Altura do chão onde ela nasce. */
  y?: number;
}

interface Item {
  modelo: ModeloNatureza;
  x: number;
  y: number;
  z: number;
  escala: number;
  giro: number;
  /** Cor das folhas (0xRRGGBB) e quanto clarear; sem isso fica a cor do arquivo. */
  cor?: number;
  forca?: number;
}

/** Modelos de cada tipo de árvore, com a escala que deixa cada um do tamanho certo. */
const COPAS: Record<"verde" | "amarelo" | "laranja", [ModeloNatureza, number][]> = {
  verde: [
    ["NormalTree_3", 1.0],
    ["MapleTree_1", 0.8],
    ["NormalTree_4", 1.02],
    ["MapleTree_5", 0.74],
    ["MapleTree_2", 0.78],
  ],
  amarelo: [
    ["BirchTree_5", 1.02],
    ["BirchTree_1", 1.0],
    ["MapleTree_1", 0.8],
  ],
  laranja: [
    ["MapleTree_2", 0.8],
    ["MapleTree_5", 0.76],
    ["MapleTree_1", 0.82],
  ],
};
const COPINHAS: Record<"verde" | "amarelo" | "laranja", [ModeloNatureza, number][]> = {
  verde: [
    ["NormalTree_5", 1.22],
    ["MapleTree_4", 1.02],
    ["BirchTree_4", 0.9],
  ],
  amarelo: [
    ["BirchTree_4", 0.92],
    ["MapleTree_4", 1.04],
  ],
  laranja: [
    ["MapleTree_4", 1.06],
    ["NormalTree_5", 1.2],
  ],
};
const PINHEIROS: [ModeloNatureza, number][] = [
  ["PineTree_1", 1.2],
  ["PineTree_2", 0.82],
  ["PineTree_5", 1.22],
  ["PineTree_1", 1.08],
];
const PALMEIRAS: [ModeloNatureza, number][] = [
  ["PalmTree_1", 1.0],
  ["PalmTree_2", 0.95],
  ["PalmTree_3", 1.05],
];
const PEDRAS: [ModeloNatureza, number][] = [
  ["Rock_1", 0.8],
  ["Rock_2", 0.72],
  ["Rock_3", 0.66],
  ["Rock_5", 0.56],
];
const FLORES: ModeloNatureza[] = [
  "Flower_2_Clump",
  "Flower_3_Clump",
  "Flower_4_Clump",
  "Flower_5_Clump",
  "Flower_1",
];

const escolher = <T>(lista: readonly T[], sorte: number) =>
  lista[Math.min(lista.length - 1, Math.floor(sorte * lista.length))]!;

/* ------------------------------------------------------------------ */
/* arquivo (baixado uma vez só)                                        */
/* ------------------------------------------------------------------ */

let arquivo: Promise<TH.Object3D | null> | null = null;
/** Baixa o arquivo da natureza (uma vez; quem chamar de novo recebe o mesmo). */
export function carregarNatureza() {
  if (!arquivo) {
    arquivo = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(ARQUIVO_NATUREZA))
      .then((g) => g.scene as TH.Object3D)
      .catch(() => {
        arquivo = null; // falhou (rede): a próxima cena tenta de novo
        return null;
      });
  }
  return arquivo;
}

type Papel = "tronco" | "folha" | "rasteiro";
const papelDe = (material: string): Papel =>
  material.endsWith("_Leaves")
    ? "folha"
    : material === "Flowers" || material === "Grass"
      ? "rasteiro"
      : "tronco";

export interface OpcoesNatureza {
  /** As árvores e pedras fazem sombra? (padrão: sim; o que é rasteiro nunca faz) */
  sombra?: boolean;
  /** Recebem sombra? (padrão: sim) */
  recebe?: boolean;
  /** Entram na névoa da cena? (padrão: sim) */
  nevoa?: boolean;
}

export class Natureza {
  private lista: Item[] = [];

  get total() {
    return this.lista.length;
  }

  /** Põe um modelo qualquer do arquivo. */
  por(
    modelo: ModeloNatureza,
    x: number,
    y: number,
    z: number,
    escala = 1,
    giro = 0,
    cor?: number,
    forca = 1,
  ) {
    this.lista.push({
      modelo,
      x,
      y,
      z,
      escala,
      giro,
      ...(cor !== undefined ? { cor, forca } : {}),
    });
  }

  /**
   * Árvore. Cada lugar sorteia o próprio modelo, giro e tom (sempre o mesmo no
   * mesmo lugar), então a praça fica variada sem ninguém escolher uma por uma.
   */
  arvore(x: number, z: number, o: OpcoesArvore = {}) {
    const y = o.y ?? 0;
    const k = (o.u ?? 0.8) / 0.8;
    const tipo = o.tipo ?? "copa";
    const r = sorteador(Math.round(x * 131 + z * 577 + y * 31) + 9000);
    const giro = r() * Math.PI * 2;
    // tamanhos bem variados: as copas grandes vão de "normal" a "árvore antiga"
    const tam =
      tipo === "copa" ? 1.2 + r() * 0.5 : tipo === "copinha" ? 1.1 + r() * 0.3 : 1.15 + r() * 0.4;
    if (tipo === "pinheiro" || tipo === "palmeira") {
      const [modelo, escala] = escolher(tipo === "pinheiro" ? PINHEIROS : PALMEIRAS, r());
      const claro = 0.9 + r() * 0.16;
      // o pinheiro do arquivo é amarelado: puxa para o verde
      this.por(
        modelo,
        x,
        y,
        z,
        escala * k * tam,
        giro,
        tipo === "pinheiro" ? 0x9fd67c : 0xffffff,
        claro,
      );
      return;
    }
    const cor = o.cor ?? "verde";
    const [modelo, escala] = escolher((tipo === "copa" ? COPAS : COPINHAS)[cor], r());
    const tinta = escolher(FOLHA[cor], r());
    const forca = (modelo.startsWith("Maple") ? REFORCO_BORDO : 1) * (0.94 + r() * 0.12);
    this.por(modelo, x, y, z, escala * k * tam, giro, tinta, forca);
  }

  /** Arbusto (com `flor`, a versão florida). `s` = tamanho. */
  arbusto(x: number, z: number, s = 1, o: { y?: number; flor?: unknown } = {}) {
    const r = sorteador(Math.round(x * 211 + z * 97) + 500);
    const y = o.y ?? 0;
    const florido = o.flor !== undefined && o.flor !== false;
    const qual = r();
    const modelo: ModeloNatureza =
      qual < 0.6
        ? florido
          ? "Bush_Flowers"
          : "Bush"
        : qual < 0.82
          ? florido
            ? "Bush_Small_Flowers"
            : "Bush_Small"
          : florido
            ? "Bush_Large_Flowers"
            : "Bush_Large";
    const escala =
      (modelo.startsWith("Bush_Large") ? 0.72 : modelo.startsWith("Bush_Small") ? 0.82 : 1.12) * s;
    this.por(
      modelo,
      x,
      y + 0.04 * s,
      z,
      escala,
      r() * Math.PI * 2,
      escolher(FOLHA.arbusto, r()),
      0.95 + r() * 0.12,
    );
  }

  /** Pedras soltas: uma maior e, quase sempre, uma menor encostada. */
  pedra(x: number, z: number, s = 1, y = 0) {
    const r = sorteador(Math.round(x * 71 + z * 311) + 77);
    const [modelo, escala] = escolher(PEDRAS, r());
    this.por(modelo, x, y, z, escala * s, r() * Math.PI * 2);
    if (r() < 0.75) {
      const a = r() * Math.PI * 2;
      const [outra, esc2] = escolher(PEDRAS, r());
      this.por(
        outra,
        x + Math.cos(a) * 0.5 * s,
        y,
        z + Math.sin(a) * 0.5 * s,
        esc2 * s * 0.5,
        r() * 6.28,
      );
    }
  }

  /** Um punhado de flores no chão. */
  flor(x: number, y: number, z: number, s = 1) {
    const r = sorteador(Math.round(x * 53 + z * 419 + y * 7) + 33);
    this.por(escolher(FLORES, r()), x, y, z, (0.85 + r() * 0.5) * s, r() * Math.PI * 2);
  }

  /** Um tufo de capim. */
  capim(x: number, y: number, z: number, s = 1) {
    const r = sorteador(Math.round(x * 87 + z * 173 + y * 11) + 61);
    this.por(
      r() < 0.6 ? "Grass_Large" : "Grass_Small",
      x,
      y,
      z,
      (0.8 + r() * 0.5) * s,
      r() * Math.PI * 2,
    );
  }

  /**
   * Monta tudo. O grupo volta na hora (vazio) e se enche quando o arquivo chega;
   * `atualizar(t)` balança as folhas com o vento e `descartar` solta a memória.
   */
  construir(THREE: typeof TH, o: OpcoesNatureza = {}) {
    const grupo = new THREE.Group();
    grupo.name = "natureza";
    const lixo: { dispose: () => void }[] = [];
    const vento = { value: 0 };
    let vivo = true;
    const itens = this.lista;

    const materiais = new Map<string, TH.Material>();
    const materialDe = (original: TH.MeshStandardMaterial) => {
      const pronto = materiais.get(original.name);
      if (pronto) return pronto;
      const papel = papelDe(original.name);
      const mapa = original.map ? original.map.clone() : null;
      if (mapa) {
        mapa.needsUpdate = true;
        lixo.push(mapa);
      }
      const mat = new THREE.MeshLambertMaterial({
        map: mapa,
        alphaTest: original.alphaTest > 0 ? 0.42 : 0,
        side: original.side,
        fog: o.nevoa ?? true,
      });
      mat.name = original.name;
      if (papel !== "tronco") {
        // folhas: a luz não vira do avesso nas costas da folha (a copa fica macia, sem
        // retalhos escuros) e o vento balança de leve, mais forte quanto mais alto
        const balanco = papel === "folha" ? 0.035 : 0.06;
        mat.onBeforeCompile = (shader) => {
          shader.uniforms["uVento"] = vento;
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nuniform float uVento;")
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              #ifdef USE_INSTANCING
                float faseVento = instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.45;
              #else
                float faseVento = 0.0;
              #endif
              float altoVento = max(0.0, position.y);
              transformed.x += sin(uVento * 1.25 + faseVento + position.y * 0.9) * ${balanco.toFixed(3)} * altoVento;
              transformed.z += cos(uVento * 0.95 + faseVento * 1.3 + position.x * 0.8) * ${(balanco * 0.7).toFixed(3)} * altoVento;`,
            );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_begin>",
            THREE.ShaderChunk.normal_fragment_begin.replace("gl_FrontFacing ? 1.0 : - 1.0", "1.0"),
          );
        };
        mat.customProgramCacheKey = () => `natureza-${papel}`;
      }
      materiais.set(original.name, mat);
      lixo.push(mat);
      return mat;
    };

    /** Geometria própria desta cena, com as normais ajeitadas para a luz ficar bonita. */
    const geometriaDe = (malha: TH.Mesh, papel: Papel) => {
      const geo = malha.geometry.clone();
      lixo.push(geo);
      if (papel === "tronco") return geo;
      const pos = geo.getAttribute("position");
      const normais = new Float32Array(pos.count * 3);
      if (papel === "rasteiro") {
        // flores e capim: iluminados como o chão (normal para cima)
        for (let i = 0; i < pos.count; i++) normais[i * 3 + 1] = 1;
      } else {
        // copa: normais "de bola", saindo do miolo da copa
        geo.computeBoundingBox();
        const cx = (geo.boundingBox!.min.x + geo.boundingBox!.max.x) / 2;
        const cz = (geo.boundingBox!.min.z + geo.boundingBox!.max.z) / 2;
        const cy = geo.boundingBox!.min.y + (geo.boundingBox!.max.y - geo.boundingBox!.min.y) * 0.3;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) - cx;
          const y = pos.getY(i) - cy + 0.4;
          const z = pos.getZ(i) - cz;
          const d = Math.hypot(x, y, z) || 1;
          normais[i * 3] = x / d;
          normais[i * 3 + 1] = y / d;
          normais[i * 3 + 2] = z / d;
        }
      }
      geo.setAttribute("normal", new THREE.BufferAttribute(normais, 3));
      return geo;
    };

    void carregarNatureza().then((cena) => {
      if (!vivo || !cena) return;
      const porModelo = new Map<ModeloNatureza, Item[]>();
      for (const it of itens) {
        const l = porModelo.get(it.modelo);
        if (l) l.push(it);
        else porModelo.set(it.modelo, [it]);
      }
      const o3 = new THREE.Object3D();
      const cor = new THREE.Color();
      for (const [modelo, lista] of porModelo) {
        const no = cena.getObjectByName(modelo);
        if (!no) continue;
        no.traverse((filho) => {
          const malha = filho as TH.Mesh;
          if (!malha.isMesh) return;
          const original = malha.material as TH.MeshStandardMaterial;
          const papel = papelDe(original.name);
          const inst = new THREE.InstancedMesh(
            geometriaDe(malha, papel),
            materialDe(original),
            lista.length,
          );
          inst.name = `${modelo}:${original.name}`;
          lista.forEach((it, i) => {
            o3.position.set(it.x, it.y, it.z);
            o3.rotation.set(0, it.giro, 0);
            o3.scale.setScalar(it.escala);
            o3.updateMatrix();
            inst.setMatrixAt(i, o3.matrix);
            if (papel === "folha" && it.cor !== undefined)
              inst.setColorAt(i, cor.setHex(it.cor).multiplyScalar(it.forca ?? 1));
            else inst.setColorAt(i, cor.setHex(0xffffff));
          });
          inst.instanceMatrix.needsUpdate = true;
          if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
          inst.castShadow = papel !== "rasteiro" && (o.sombra ?? true);
          inst.receiveShadow = o.recebe ?? true;
          inst.computeBoundingSphere();
          grupo.add(inst);
          lixo.push(inst);
        });
      }
    });

    return {
      grupo,
      /** Vento nas folhas (t em segundos). */
      atualizar(t: number) {
        vento.value = t;
      },
      descartar() {
        vivo = false;
        for (const l of lixo) l.dispose();
        grupo.clear();
      },
    };
  }
}
