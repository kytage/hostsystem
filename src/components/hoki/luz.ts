/**
 * A "cara" dos cenários 3D do HOKI: de onde vem o sol, as luzes, e os retoques
 * de material que fazem os blocos pegarem luz (borda arredondada, junta mais
 * escura, grão da pedra) e sumirem na névoa embaixo da ilha. A praça e o
 * cartão do pódio usam este mesmo arquivo, para a luz bater do mesmo lado.
 */
import type * as TH from "three";

/** Direção do sol, visto do centro da cena: alto (45°), vindo da esquerda e um pouco da frente. */
export const SOL = { x: -0.66, y: 0.707, z: 0.25 };
/** Cor da névoa (e do horizonte do céu). */
export const COR_NEVOA = 0xdcecff;

export interface OpcoesLuz {
  /** Ponto para onde o sol aponta (centro do que precisa de sombra). */
  alvo?: { x: number; y: number; z: number };
  /** Metade da largura e da altura da área que recebe sombra, vista do sol. */
  area: [number, number];
  /** Distância do sol até o alvo. */
  distancia: number;
  /** Tamanho do mapa de sombras (lado, em pontos). */
  mapa?: number;
  /** Maciez da borda da sombra. */
  maciez?: number;
  sombras?: boolean;
}

/**
 * Luz principal quente e lateral (com sombra), preenchimento azulado que vem
 * do céu e um contraluz frio e fraco para as faces sombreadas não "morrerem".
 */
export function montarLuzes(THREE: typeof TH, cena: TH.Scene, o: OpcoesLuz) {
  const alvo = o.alvo ?? { x: 0, y: 0, z: 0 };
  const ceu = new THREE.HemisphereLight(0xcfe2ff, 0xb9a47e, 1.15);
  const sol = new THREE.DirectionalLight(0xffe2b4, 3.1);
  sol.position.set(
    alvo.x + SOL.x * o.distancia,
    alvo.y + SOL.y * o.distancia,
    alvo.z + SOL.z * o.distancia,
  );
  sol.target.position.set(alvo.x, alvo.y, alvo.z);
  if (o.sombras ?? true) {
    sol.castShadow = true;
    sol.shadow.mapSize.set(o.mapa ?? 2048, o.mapa ?? 2048);
    Object.assign(sol.shadow.camera, {
      left: -o.area[0],
      right: o.area[0],
      top: o.area[1],
      bottom: -o.area[1],
      near: 1,
      far: o.distancia * 2,
    });
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = ((o.area[0] * 2) / (o.mapa ?? 2048)) * 1.6;
    sol.shadow.radius = o.maciez ?? 2;
  }
  const contra = new THREE.DirectionalLight(0xb9d4ff, 0.5);
  contra.position.set(
    alvo.x + 0.7 * o.distancia,
    alvo.y + 0.4 * o.distancia,
    alvo.z - 0.6 * o.distancia,
  );
  contra.target.position.set(alvo.x, alvo.y, alvo.z);
  cena.add(ceu, sol, sol.target, contra, contra.target);
  return { ceu, sol, contra };
}

/**
 * Noite, de 0 (dia) a 1 (noite fechada), pelo relógio do mundo real: assim todo
 * mundo, e todas as telas do HOKI, veem a noite ao mesmo tempo. A cada 20
 * minutos, uns 14 são de dia e uns 4 de noite; o resto é entardecer e amanhecer.
 */
export function nivelDaNoite() {
  const CICLO = 20 * 60_000;
  const degrau = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  const f = (Date.now() % CICLO) / CICLO;
  return degrau(0.733, 0.78, f) - degrau(0.95, 1, f);
}
/** Cor da névoa à noite. */
export const COR_NEVOA_NOITE = 0x0a1024;
/** Leva as luzes do dia para o luar (v de 0 a 1): o sol vira luz azulada e fraca, e o céu escurece. */
export function anoitecerLuzes(luzes: ReturnType<typeof montarLuzes>, v: number) {
  luzes.sol.color.setHex(0xffe2b4).lerp(luzes.contra.color.clone().setHex(0x9fb6ff), v);
  luzes.sol.intensity = 3.1 - 2.35 * v;
  luzes.ceu.color.setHex(0xcfe2ff).lerp(luzes.contra.color.clone().setHex(0x4a62b8), v);
  luzes.ceu.groundColor.setHex(0xb9a47e).lerp(luzes.contra.color.clone().setHex(0x141c33), v);
  luzes.ceu.intensity = 1.15 - 0.62 * v;
  luzes.contra.intensity = 0.5 - 0.3 * v;
}

/** Ajustes do desenho: cores mais fiéis nas áreas claras e sombras com borda macia. */
export function prepararDesenho(THREE: typeof TH, renderer: TH.WebGLRenderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;
}

export interface Acabamento {
  /** Blocos (caixas unitárias instanciadas): largura do arredondado da borda, em unidades do mundo. */
  chanfro?: number;
  /** Blocos: quanto a beirada de cada face escurece, fazendo a junta (0 a 1). */
  junta?: number;
  /** Blocos: quanto o pé das faces laterais escurece, onde o bloco encosta no de baixo (0 a 1). */
  pe?: number;
  /** Blocos: grão da superfície, em variação de tom (0 a 0,1). */
  grao?: number;
  /** Névoa embaixo da ilha: começa `inicio` abaixo do chão e fecha em `fim`. Sem isso, só a névoa de distância. */
  nevoa?: { inicio: number; fim: number; forca: number };
}

const V_DECL = /* glsl */ `
varying vec3 vHkMundo;
#ifdef HK_BLOCO
varying vec3 vHkPos;
varying vec3 vHkEsc;
varying vec3 vHkEixoX;
varying vec3 vHkEixoY;
varying vec3 vHkEixoZ;
varying float vHkSemente;
#endif
`;
const V_BLOCO = /* glsl */ `
#ifdef HK_BLOCO
  vHkPos = position;
  #ifdef USE_INSTANCING
    mat3 hkIm = mat3( instanceMatrix );
    vHkSemente = fract( sin( dot( instanceMatrix[ 3 ].xyz, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
  #else
    mat3 hkIm = mat3( 1.0 );
    vHkSemente = 0.0;
  #endif
  vHkEsc = vec3( length( hkIm[ 0 ] ), length( hkIm[ 1 ] ), length( hkIm[ 2 ] ) );
  vHkEixoX = normalize( normalMatrix * ( hkIm[ 0 ] / vHkEsc.x ) );
  vHkEixoY = normalize( normalMatrix * ( hkIm[ 1 ] / vHkEsc.y ) );
  vHkEixoZ = normalize( normalMatrix * ( hkIm[ 2 ] / vHkEsc.z ) );
#endif
`;
const V_MUNDO = /* glsl */ `
  vec4 hkM = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    hkM = instanceMatrix * hkM;
  #endif
  vHkMundo = ( modelMatrix * hkM ).xyz;
`;
const F_DECL = /* glsl */ `
varying vec3 vHkMundo;
uniform vec4 uHkNevoa;
#ifdef HK_BLOCO
uniform vec4 uHkBloco;
varying vec3 vHkPos;
varying vec3 vHkEsc;
varying vec3 vHkEixoX;
varying vec3 vHkEixoY;
varying vec3 vHkEixoZ;
varying float vHkSemente;
#endif
`;
// borda arredondada: perto das arestas a face "vira" para o lado, e por isso pega a luz como um chanfro de verdade
const F_NORMAL = /* glsl */ `
#ifdef HK_BLOCO
{
  vec3 hkD = ( 0.5 - abs( vHkPos ) ) * vHkEsc;
  vec3 hkB = max( min( vec3( uHkBloco.x ), 0.5 * vHkEsc ), vec3( 0.0001 ) );
  vec3 hkL = sign( vHkPos ) * ( 1.0 - smoothstep( vec3( 0.0 ), hkB, hkD ) );
  normal = normalize( vHkEixoX * hkL.x + vHkEixoY * hkL.y + vHkEixoZ * hkL.z );
}
#endif
`;
// junta escura na beirada, pé das laterais mais escuro e grão em quadradinhos
const F_COR = /* glsl */ `
#ifdef HK_BLOCO
{
  vec3 hkD = ( 0.5 - abs( vHkPos ) ) * vHkEsc;
  vec3 hkFace = step( hkD, vec3( 0.0001 ) );
  vec3 hkDj = hkD + hkFace * 1000.0;
  float hkBorda = min( hkDj.x, min( hkDj.y, hkDj.z ) );
  float hkAo = mix( 1.0 - uHkBloco.y, 1.0, smoothstep( 0.0, uHkBloco.x * 1.5 + 0.015, hkBorda ) );
  float hkPe = ( vHkPos.y + 0.5 ) * vHkEsc.y;
  hkAo *= mix( 1.0 - uHkBloco.z * ( 1.0 - hkFace.y ), 1.0, smoothstep( 0.0, 0.24, hkPe ) );
  vec3 hkP = floor( ( vHkPos * vHkEsc * 0.998 + 40.0 ) * 10.0 );
  float hkG = fract( sin( dot( hkP + vHkSemente * 17.0, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 );
  diffuseColor.rgb *= hkAo * ( 1.0 + ( hkG - 0.5 ) * 2.0 * uHkBloco.w );
}
#endif
`;
// névoa: a de distância de sempre, mais uma que fecha embaixo da ilha
const F_NEVOA = /* glsl */ `
#ifdef USE_FOG
  float hkLonge = smoothstep( fogNear, fogFar, vFogDepth );
  float hkBaixo = smoothstep( uHkNevoa.x, uHkNevoa.y, - vHkMundo.y ) * uHkNevoa.z;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, 1.0 - ( 1.0 - hkLonge ) * ( 1.0 - hkBaixo ) );
#endif
`;

/**
 * Aplica o acabamento num material do three (Standard, Lambert ou Basic).
 * Com `chanfro`, `junta`, `pe` ou `grao`, o material precisa estar numa malha
 * instanciada de caixas unitárias (é o caso dos Blocos).
 */
export function acabamento<M extends TH.Material>(mat: M, a: Acabamento = {}): M {
  const bloco =
    a.chanfro !== undefined || a.junta !== undefined || a.pe !== undefined || a.grao !== undefined;
  const uBloco = { value: [a.chanfro ?? 0, a.junta ?? 0, a.pe ?? 0, a.grao ?? 0] };
  const uNevoa = {
    value: a.nevoa ? [a.nevoa.inicio, a.nevoa.fim, a.nevoa.forca, 0] : [0, 1, 0, 0],
  };
  if (bloco) mat.defines = { ...mat.defines, HK_BLOCO: "" };
  const chaveAntes = mat.customProgramCacheKey();
  const antes = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (sh, renderer) => {
    antes(sh, renderer);
    sh.uniforms["uHkBloco"] = uBloco;
    sh.uniforms["uHkNevoa"] = uNevoa;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>" + V_DECL)
      .replace("#include <begin_vertex>", "#include <begin_vertex>" + V_BLOCO)
      .replace("#include <project_vertex>", "#include <project_vertex>" + V_MUNDO);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>" + F_DECL)
      .replace("#include <color_fragment>", "#include <color_fragment>" + F_COR)
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>" + F_NORMAL)
      .replace("#include <fog_fragment>", F_NEVOA);
  };
  mat.customProgramCacheKey = () => chaveAntes + "|hk-acabamento";
  return mat;
}

/** Mancha redonda que some nas bordas: serve de sombra de contato e de brilho (luminárias, reflexos da água). */
export function texturaMancha(THREE: typeof TH, miolo = 0.25) {
  const tela = document.createElement("canvas");
  tela.width = tela.height = 96;
  const c = tela.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(miolo, "rgba(255,255,255,0.78)");
    g.addColorStop(0.62, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 96, 96);
  }
  const t = new THREE.CanvasTexture(tela);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Mancha {
  x: number;
  z: number;
  y?: number;
  /** Meia largura e meia profundidade. */
  rx: number;
  rz: number;
  giro?: number;
}
/**
 * Manchas deitadas no chão, todas num desenho só. Escuras, são as sombras de
 * contato (pé de árvore, banco, poste); claras e somadas, são a luz das luminárias no piso.
 */
export function criarManchas(
  THREE: typeof TH,
  tex: TH.Texture,
  itens: Mancha[],
  o: { cor: number; forca: number; soma?: boolean },
) {
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: o.cor,
    transparent: true,
    opacity: o.forca,
    depthWrite: false,
    fog: false,
    toneMapped: !o.soma,
    blending: o.soma ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const malha = new THREE.InstancedMesh(geo, mat, Math.max(1, itens.length));
  const aux = new THREE.Object3D();
  itens.forEach((m, i) => {
    aux.position.set(m.x, (m.y ?? 0) + 0.03, m.z);
    aux.rotation.set(0, m.giro ?? 0, 0);
    aux.scale.set(m.rx, 1, m.rz);
    aux.updateMatrix();
    malha.setMatrixAt(i, aux.matrix);
  });
  malha.count = itens.length;
  malha.instanceMatrix.needsUpdate = true;
  malha.frustumCulled = false;
  malha.renderOrder = 2;
  return { malha, descartar: () => (geo.dispose(), mat.dispose()) };
}
