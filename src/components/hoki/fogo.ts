import type * as TH from "three";

/**
 * Fogo de partículas: de cada ponto dado sobem faíscas que tremem, clareiam e
 * somem, como uma chama. Serve para o fogo dourado nas pontas das asas de aço
 * e para o fogo branco nos olhos do ped exclusivo.
 *
 * Não guarda estado: a posição de cada faísca sai direto do relógio, então é
 * barato e fica igual em qualquer tela.
 */
export interface OpcoesDeFogo {
  /** Cores da chama, da base (mais quente) para a ponta. */
  cores: [number, number, number];
  /** Quantas faíscas por ponto. */
  porPonto: number;
  /** Altura que a chama alcança e o quanto ela abre para os lados. */
  altura: number;
  abre: number;
  /** Tamanho de cada faísca. */
  tamanho: number;
  /** Para onde a chama sobe (x, y, z); o padrão é para cima. */
  rumo?: [number, number, number];
}

let mancha: TH.Texture | null = null;
/** Bolinha macia (clara no meio, sumindo nas bordas), compartilhada por todos os fogos. */
function texturaMacia(THREE: typeof TH) {
  if (mancha) return mancha;
  const tela = document.createElement("canvas");
  tela.width = tela.height = 64;
  const c = tela.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  mancha = new THREE.CanvasTexture(tela);
  return mancha;
}

/** Número "ao acaso" que é sempre o mesmo para o mesmo índice. */
const acaso = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function criarFogo(
  THREE: typeof TH,
  pontos: readonly (readonly [number, number, number])[],
  o: OpcoesDeFogo,
) {
  const n = pontos.length * o.porPonto;
  const pos = new Float32Array(n * 3);
  const cor = new Float32Array(n * 3);
  const alfa = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3);
  const aCor = new THREE.BufferAttribute(cor, 3);
  geo.setAttribute("position", aPos);
  geo.setAttribute("color", aCor);
  const aAlfa = new THREE.BufferAttribute(alfa, 1);
  geo.setAttribute("alfa", aAlfa);
  const mat = new THREE.PointsMaterial({
    size: o.tamanho,
    map: texturaMacia(THREE),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  // cada faísca tem a sua transparência (some aos poucos sem perder a cor, mesmo contra o céu claro)
  mat.onBeforeCompile = (sh) => {
    const NL = String.fromCharCode(10);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        ["#include <common>", "attribute float alfa;", "varying float vAlfa;"].join(NL),
      )
      .replace("#include <begin_vertex>", ["#include <begin_vertex>", "vAlfa = alfa;"].join(NL));
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", ["#include <common>", "varying float vAlfa;"].join(NL))
      .replace(
        "#include <color_fragment>",
        ["#include <color_fragment>", "diffuseColor.a *= vAlfa;"].join(NL),
      );
  };
  mat.customProgramCacheKey = () => "hk-fogo";
  const malha = new THREE.Points(geo, mat);
  malha.frustumCulled = false;
  const [c0, c1, c2] = o.cores.map((c) => new THREE.Color(c)) as [TH.Color, TH.Color, TH.Color];
  const rumo = o.rumo ?? [0, 1, 0];

  function atualizar(t: number) {
    for (let i = 0; i < n; i++) {
      const p = pontos[Math.floor(i / o.porPonto)]!;
      // cada faísca tem o seu ritmo e a sua fase: vida vai de 0 (nasce) a 1 (some)
      const ritmo = 0.75 + acaso(i) * 0.7;
      const vida = (t * ritmo + acaso(i + 0.5) * 7) % 1;
      const sobe = vida * o.altura * (0.6 + acaso(i + 0.25) * 0.6);
      // tremor de chama: balança para os lados, mais aberto no meio da subida
      const fase = t * (3 + acaso(i + 0.7) * 4) + i;
      const abre = o.abre * Math.sin(vida * Math.PI) * (0.4 + acaso(i + 0.9));
      pos[i * 3] = p[0] + rumo[0] * sobe + Math.sin(fase) * abre;
      pos[i * 3 + 1] = p[1] + rumo[1] * sobe + Math.cos(fase * 1.3) * abre * 0.3;
      pos[i * 3 + 2] = p[2] + rumo[2] * sobe + Math.cos(fase) * abre;
      // cor: quente na base, passando pela cor do meio, e apagando na ponta
      const forca = Math.pow(1 - vida, 1.4) * Math.min(1, vida * 9);
      const a = vida < 0.4 ? c0 : c1;
      const b = vida < 0.4 ? c1 : c2;
      const k = vida < 0.4 ? vida / 0.4 : (vida - 0.4) / 0.6;
      cor[i * 3] = a.r + (b.r - a.r) * k;
      cor[i * 3 + 1] = a.g + (b.g - a.g) * k;
      cor[i * 3 + 2] = a.b + (b.b - a.b) * k;
      alfa[i] = forca;
    }
    aPos.needsUpdate = true;
    aCor.needsUpdate = true;
    aAlfa.needsUpdate = true;
  }
  atualizar(0);

  return {
    malha,
    atualizar,
    descartar() {
      geo.dispose();
      mat.dispose();
    },
  };
}
