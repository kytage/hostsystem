/**
 * O corpo do HOKI (o modelo 3D original) e tudo o que precisa acompanhar o
 * corpo: o "esqueleto" que dobra braços, pernas, cabeça e tronco direto no
 * desenho, o material de vinil acetinado (com troca de cor, realce no contorno
 * e brilho nos olhos) e o material das roupas, que vestem por cima e dobram
 * exatamente junto com o corpo.
 */
import type * as TH from "three";
import type { Modelo } from "./modelo";

/** Ângulos de cada parte do corpo (em radianos). Quem anima só mexe nestes valores. */
export interface Esqueleto {
  /** x = quanto o braço sobe (negativo desce), y = quanto vai para a frente. */
  bracoE: { value: TH.Vector2 };
  bracoD: { value: TH.Vector2 };
  /** x = perna esquerda, y = perna direita (para a frente e para trás). */
  pernas: { value: TH.Vector2 };
  /** x = sim (baixar o queixo), y = não (virar), z = pender para o lado. */
  cabeca: { value: TH.Vector3 };
  /** x = inclinar para a frente, y = torcer a cintura, z = pender para o lado. */
  tronco: { value: TH.Vector3 };
}
export function criarEsqueleto(THREE: typeof TH): Esqueleto {
  return {
    bracoE: { value: new THREE.Vector2() },
    bracoD: { value: new THREE.Vector2() },
    pernas: { value: new THREE.Vector2() },
    cabeca: { value: new THREE.Vector3() },
    tronco: { value: new THREE.Vector3() },
  };
}

/** Relógio das coisas que balançam sozinhas (capas, bandeiras, auras). Quem anima o HOKI acerta a hora. */
export const TEMPO = { value: 0 };

/**
 * Medidas do corpo que o esqueleto dobra (nas unidades do modelo): onde ficam o
 * ombro, o pescoço, a cintura e o quadril, e em que faixa cada parte começa a
 * dobrar. O HOKI clássico e o ped exclusivo têm corpos diferentes, então cada
 * um tem as suas.
 */
export interface Medidas {
  /** Braço: a partir de que distância do meio (x) e entre que alturas (y). */
  bracoX: [number, number];
  bracoBaixo: [number, number];
  bracoCima: [number, number];
  ombro: [number, number];
  /** Somado ao ângulo de subir o braço (o ped já nasce de braços para baixo). */
  bracoRepouso: number;
  cabeca: [number, number];
  pescoco: number;
  tronco: [number, number];
  cintura: number;
  /** Altura em que a torção da cintura chega ao máximo. */
  torce: number;
  perna: [number, number];
  quadril: number;
}
export const MEDIDAS_HOKI: Medidas = {
  bracoX: [0.125, 0.19],
  bracoBaixo: [0.215, 0.25],
  bracoCima: [0.385, 0.42],
  ombro: [0.125, 0.33],
  bracoRepouso: 0,
  cabeca: [0.4, 0.46],
  pescoco: 0.43,
  tronco: [0.19, 0.3],
  cintura: 0.235,
  torce: 0.2,
  perna: [0.17, 0.235],
  quadril: 0.235,
};
/** Ped exclusivo (boneco em formato humano, de braços para baixo, com capa). */
export const MEDIDAS_PED: Medidas = {
  bracoX: [0.105, 0.15],
  bracoBaixo: [0.43, 0.47],
  bracoCima: [0.735, 0.775],
  ombro: [0.1, 0.725],
  bracoRepouso: 0.38,
  cabeca: [0.775, 0.815],
  pescoco: 0.795,
  tronco: [0.46, 0.57],
  cintura: 0.5,
  torce: 0.25,
  perna: [0.44, 0.52],
  quadril: 0.5,
};
const f = (n: number) => n.toFixed(4);

// `hkBase` é o ponto do corpo que decide como dobrar: no corpo é o próprio ponto;
// na roupa é o ponto do corpo de onde aquele pedaço de pano saiu.
export const glslEsqueleto = (m: Medidas) => /* glsl */ `
uniform vec2 uHkBracoE;
uniform vec2 uHkBracoD;
uniform vec2 uHkPernas;
uniform vec3 uHkCabeca;
uniform vec3 uHkTronco;
#ifdef HK_ROUPA
attribute vec3 hkBase;
#else
#define hkBase position
#endif
#ifdef HK_SOLTO
// pano solto: hkSolto vai de 0 (onde está preso) a 1 (a ponta, que balança mais)
uniform float uHkTempo;
attribute float hkSolto;
#endif
varying vec3 vHkObj;
vec2 hkGira( vec2 v, float a ) { float c = cos( a ); float s = sin( a ); return vec2( v.x * c - v.y * s, v.x * s + v.y * c ); }
void hkDobrar( inout vec3 p, inout vec3 n, vec3 base ) {
  float lado = base.x < 0.0 ? -1.0 : 1.0;
  // braços: giram no ombro
  float wB = smoothstep( ${f(m.bracoX[0])}, ${f(m.bracoX[1])}, abs( base.x ) ) * smoothstep( ${f(m.bracoBaixo[0])}, ${f(m.bracoBaixo[1])}, base.y ) * ( 1.0 - smoothstep( ${f(m.bracoCima[0])}, ${f(m.bracoCima[1])}, base.y ) );
  if ( wB > 0.0 ) {
    vec2 br = lado < 0.0 ? uHkBracoE : uHkBracoD;
    br.x += ${f(m.bracoRepouso)};
    vec3 o = vec3( lado * ${f(m.ombro[0])}, ${f(m.ombro[1])}, 0.0 );
    vec3 d = p - o;
    vec3 q = n;
    d.xy = hkGira( d.xy, lado * br.x ); q.xy = hkGira( q.xy, lado * br.x );
    d.yz = hkGira( d.yz, br.y ); q.yz = hkGira( q.yz, br.y );
    p = mix( p, o + d, wB ); n = mix( n, q, wB );
  }
  // cabeça: gira no pescoço
  float wC = smoothstep( ${f(m.cabeca[0])}, ${f(m.cabeca[1])}, base.y );
  if ( wC > 0.0 ) {
    vec3 o = vec3( 0.0, ${f(m.pescoco)}, 0.0 );
    vec3 d = p - o;
    vec3 q = n;
    d.yz = hkGira( d.yz, uHkCabeca.x ); q.yz = hkGira( q.yz, uHkCabeca.x );
    d.zx = hkGira( d.zx, uHkCabeca.y ); q.zx = hkGira( q.zx, uHkCabeca.y );
    d.xy = hkGira( d.xy, uHkCabeca.z ); q.xy = hkGira( q.xy, uHkCabeca.z );
    p = mix( p, o + d, wC ); n = mix( n, q, wC );
  }
  // tronco: da cintura para cima inclina, torce e pende
  float wT = smoothstep( ${f(m.tronco[0])}, ${f(m.tronco[1])}, base.y );
  if ( wT > 0.0 ) {
    vec3 o = vec3( 0.0, ${f(m.cintura)}, 0.0 );
    vec3 d = p - o;
    vec3 q = n;
    float torce = uHkTronco.y * clamp( ( base.y - ${f(m.cintura)} ) / ${f(m.torce)}, 0.0, 1.0 );
    d.zx = hkGira( d.zx, torce ); q.zx = hkGira( q.zx, torce );
    d.yz = hkGira( d.yz, uHkTronco.x ); q.yz = hkGira( q.yz, uHkTronco.x );
    d.xy = hkGira( d.xy, uHkTronco.z ); q.xy = hkGira( q.xy, uHkTronco.z );
    p = mix( p, o + d, wT ); n = mix( n, q, wT );
  }
  // pernas: giram no quadril
  float wP = 1.0 - smoothstep( ${f(m.perna[0])}, ${f(m.perna[1])}, base.y );
  if ( wP > 0.0 ) {
    vec3 o = vec3( 0.0, ${f(m.quadril)}, 0.0 );
    vec3 d = p - o;
    vec3 q = n;
    float a = lado < 0.0 ? uHkPernas.x : uHkPernas.y;
    d.yz = hkGira( d.yz, a ); q.yz = hkGira( q.yz, a );
    p = mix( p, o + d, wP ); n = mix( n, q, wP );
  }
}
`;
export const GLSL_ESQUELETO = glslEsqueleto(MEDIDAS_HOKI);
const V_SEM_NORMAL =
  "#include <begin_vertex>\n  vec3 hkN = vec3( 0.0, 1.0, 0.0 );\n  hkDobrar( transformed, hkN, hkBase );\n  vHkObj = hkBase;";
const V_NORMAL =
  "#include <beginnormal_vertex>\n  vec3 hkP = position;\n#ifdef HK_SOLTO\n  hkP += objectNormal * sin( uHkTempo * 3.2 + hkSolto * 5.0 + position.x * 7.0 ) * 0.03 * hkSolto;\n#endif\n  hkDobrar( hkP, objectNormal, hkBase );";
const V_POSICAO = "#include <begin_vertex>\n  transformed = hkP;\n  vHkObj = hkBase;";

/** Liga o esqueleto num material (do corpo, de roupa ou o de sombra, que não tem normais). */
export function comEsqueleto(
  sh: { uniforms: Record<string, unknown>; vertexShader: string },
  e: Esqueleto,
  semNormal = false,
  medidas: Medidas = MEDIDAS_HOKI,
) {
  sh.uniforms["uHkBracoE"] = e.bracoE;
  sh.uniforms["uHkBracoD"] = e.bracoD;
  sh.uniforms["uHkPernas"] = e.pernas;
  sh.uniforms["uHkCabeca"] = e.cabeca;
  sh.uniforms["uHkTronco"] = e.tronco;
  sh.uniforms["uHkTempo"] = TEMPO;
  sh.vertexShader = sh.vertexShader.replace(
    "#include <common>",
    "#include <common>" + (medidas === MEDIDAS_HOKI ? GLSL_ESQUELETO : glslEsqueleto(medidas)),
  );
  if (semNormal) sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", V_SEM_NORMAL);
  else
    sh.vertexShader = sh.vertexShader
      .replace("#include <beginnormal_vertex>", V_NORMAL)
      .replace("#include <begin_vertex>", V_POSICAO);
}

/** Material só para a sombra: faz a sombra acompanhar os braços e as pernas dobrados. */
export function materialDeSombra(
  THREE: typeof TH,
  e: Esqueleto,
  roupa = false,
  medidas: Medidas = MEDIDAS_HOKI,
) {
  const m = new THREE.MeshDepthMaterial();
  if (roupa) m.defines = { HK_ROUPA: "" };
  m.onBeforeCompile = (sh) => comEsqueleto(sh, e, true, medidas);
  m.customProgramCacheKey = () =>
    "hk-sombra" + (roupa ? "|roupa" : "") + (medidas === MEDIDAS_PED ? "|ped" : "");
  return m;
}

// realce no contorno (mais forte nas orelhas) e dois brilhinhos em cada olho
const F_ACABAMENTO = /* glsl */ `
  float hkContorno = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
  outgoingLight += uHkRealce.rgb * hkContorno * uHkRealce.w * mix( 0.4, 1.0, smoothstep( 0.6, 0.86, vHkObj.y ) );
  if ( vHkObj.z > 0.2 ) {
    float hkX = vHkObj.x < 0.0 ? vHkObj.x + 0.128 : vHkObj.x - 0.093;
    float hkB = 1.0 - smoothstep( 0.0095, 0.0135, length( vec2( hkX, vHkObj.y - 0.592 ) ) );
    float hkX2 = vHkObj.x < 0.0 ? vHkObj.x + 0.097 : vHkObj.x - 0.124;
    hkB = max( hkB, ( 1.0 - smoothstep( 0.004, 0.0065, length( vec2( hkX2, vHkObj.y - 0.532 ) ) ) ) * 0.75 );
    outgoingLight = mix( outgoingLight, vec3( 1.0 ), hkB );
  }
`;
// troca de cor: o vermelho do modelo vira a cor principal e o branco vira a cor de detalhe
const F_CORES = /* glsl */ `
  float hkVerm = smoothstep( 0.12, 0.4, diffuseColor.r - max( diffuseColor.g, diffuseColor.b ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uPrincipal * clamp( diffuseColor.r / 0.8, 0.0, 1.25 ), hkVerm );
  float hkClaro = smoothstep( 0.62, 0.85, min( diffuseColor.r, min( diffuseColor.g, diffuseColor.b ) ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uDetalhe * clamp( diffuseColor.g / 0.92, 0.0, 1.1 ), hkClaro );
`;
const F_DECL =
  "#include <common>\nuniform vec3 uPrincipal;\nuniform vec3 uDetalhe;\nuniform vec4 uHkRealce;\nvarying vec3 vHkObj;";

/**
 * Material do corpo: vinil acetinado, com reflexo suave, realce no contorno e
 * brilho nos olhos. `leve` é a versão da praça (muitos HOKIs pequenos na tela).
 */
export function materialDoCorpo(
  THREE: typeof TH,
  modelo: Modelo,
  e: Esqueleto,
  cores: { principal: string; detalhe: string },
  leve: boolean,
) {
  const material = modelo.tex
    ? leve
      ? new THREE.MeshStandardMaterial({ map: modelo.tex, roughness: 0.52 })
      : new THREE.MeshPhysicalMaterial({
          map: modelo.tex,
          roughness: 0.5,
          clearcoat: 0.5,
          clearcoatRoughness: 0.36,
        })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const ponto = modelo.tex ? "#include <map_fragment>" : "#include <color_fragment>";
  const principal = { value: new THREE.Color(cores.principal) };
  const detalhe = { value: new THREE.Color(cores.detalhe) };
  const realce = { value: new THREE.Vector4(1, 0.93, 0.86, leve ? 0.2 : 0.4) };
  material.onBeforeCompile = (sh) => {
    comEsqueleto(sh, e);
    sh.uniforms["uPrincipal"] = principal;
    sh.uniforms["uDetalhe"] = detalhe;
    sh.uniforms["uHkRealce"] = realce;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", F_DECL)
      .replace(ponto, ponto + F_CORES)
      .replace("#include <opaque_fragment>", F_ACABAMENTO + "#include <opaque_fragment>");
  };
  material.customProgramCacheKey = () =>
    `hk-corpo|${modelo.tex ? "tex" : "cor"}|${leve ? "leve" : "cheio"}`;
  return {
    material,
    definirCores(c: { principal: string; detalhe: string }) {
      principal.value.set(c.principal);
      detalhe.value.set(c.detalhe);
    },
  };
}

// olhos do ped: o branco da textura da cabeça acende sozinho (brilho frio, pulsando de leve)
const F_OLHOS_PED = /* glsl */ `
  // só na região dos olhos (na textura eles são cinza-claro): viram branco aceso
  if ( vHkObj.y > 0.835 && vHkObj.y < 0.955 && vHkObj.z > 0.035 && abs( vHkObj.x ) < 0.118 ) {
    float hkBranco = smoothstep( 0.16, 0.3, min( diffuseColor.r, min( diffuseColor.g, diffuseColor.b ) ) );
    outgoingLight = mix( outgoingLight, vec3( 1.0 ) * ( 1.5 + 0.3 * sin( uHkTempo * 5.0 ) ), hkBranco );
  }
  float hkContorno = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
  outgoingLight += vec3( 0.75, 0.8, 0.9 ) * hkContorno * uHkRealce.w;
`;
/**
 * Material do ped exclusivo: a textura dele como veio (sem troca de cor), com o
 * esqueleto nas medidas do ped, um realce frio no contorno e os olhos brancos acesos.
 */
export function materialDoPed(THREE: typeof TH, modelo: Modelo, e: Esqueleto, leve: boolean) {
  const material = modelo.tex
    ? new THREE.MeshStandardMaterial({ map: modelo.tex, roughness: 0.62, metalness: 0.12 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.1 });
  const realce = { value: new THREE.Vector4(1, 1, 1, leve ? 0.18 : 0.3) };
  material.onBeforeCompile = (sh) => {
    comEsqueleto(sh, e, false, MEDIDAS_PED);
    sh.uniforms["uHkRealce"] = realce;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", F_DECL_PED)
      .replace("#include <opaque_fragment>", F_OLHOS_PED + "#include <opaque_fragment>");
  };
  material.customProgramCacheKey = () => `hk-ped|${modelo.tex ? "tex" : "cor"}`;
  return material;
}
const F_DECL_PED =
  "#include <common>\nuniform vec4 uHkRealce;\nuniform float uHkTempo;\nvarying vec3 vHkObj;";
