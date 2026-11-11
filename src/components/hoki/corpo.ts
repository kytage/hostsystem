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

// `hkBase` é o ponto do corpo que decide como dobrar: no corpo é o próprio ponto;
// na roupa é o ponto do corpo de onde aquele pedaço de pano saiu.
export const GLSL_ESQUELETO = /* glsl */ `
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
  float wB = smoothstep( 0.125, 0.19, abs( base.x ) ) * smoothstep( 0.215, 0.25, base.y ) * ( 1.0 - smoothstep( 0.385, 0.42, base.y ) );
  if ( wB > 0.0 ) {
    vec2 br = lado < 0.0 ? uHkBracoE : uHkBracoD;
    vec3 o = vec3( lado * 0.125, 0.33, 0.0 );
    vec3 d = p - o;
    vec3 m = n;
    d.xy = hkGira( d.xy, lado * br.x ); m.xy = hkGira( m.xy, lado * br.x );
    d.yz = hkGira( d.yz, br.y ); m.yz = hkGira( m.yz, br.y );
    p = mix( p, o + d, wB ); n = mix( n, m, wB );
  }
  // cabeça: gira no pescoço
  float wC = smoothstep( 0.4, 0.46, base.y );
  if ( wC > 0.0 ) {
    vec3 o = vec3( 0.0, 0.43, 0.0 );
    vec3 d = p - o;
    vec3 m = n;
    d.yz = hkGira( d.yz, uHkCabeca.x ); m.yz = hkGira( m.yz, uHkCabeca.x );
    d.zx = hkGira( d.zx, uHkCabeca.y ); m.zx = hkGira( m.zx, uHkCabeca.y );
    d.xy = hkGira( d.xy, uHkCabeca.z ); m.xy = hkGira( m.xy, uHkCabeca.z );
    p = mix( p, o + d, wC ); n = mix( n, m, wC );
  }
  // tronco: da cintura para cima inclina, torce e pende
  float wT = smoothstep( 0.19, 0.3, base.y );
  if ( wT > 0.0 ) {
    vec3 o = vec3( 0.0, 0.235, 0.0 );
    vec3 d = p - o;
    vec3 m = n;
    float torce = uHkTronco.y * clamp( ( base.y - 0.235 ) / 0.2, 0.0, 1.0 );
    d.zx = hkGira( d.zx, torce ); m.zx = hkGira( m.zx, torce );
    d.yz = hkGira( d.yz, uHkTronco.x ); m.yz = hkGira( m.yz, uHkTronco.x );
    d.xy = hkGira( d.xy, uHkTronco.z ); m.xy = hkGira( m.xy, uHkTronco.z );
    p = mix( p, o + d, wT ); n = mix( n, m, wT );
  }
  // pernas: giram no quadril
  float wP = 1.0 - smoothstep( 0.17, 0.235, base.y );
  if ( wP > 0.0 ) {
    vec3 o = vec3( 0.0, 0.235, 0.0 );
    vec3 d = p - o;
    vec3 m = n;
    float a = lado < 0.0 ? uHkPernas.x : uHkPernas.y;
    d.yz = hkGira( d.yz, a ); m.yz = hkGira( m.yz, a );
    p = mix( p, o + d, wP ); n = mix( n, m, wP );
  }
}
`;
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
) {
  sh.uniforms["uHkBracoE"] = e.bracoE;
  sh.uniforms["uHkBracoD"] = e.bracoD;
  sh.uniforms["uHkPernas"] = e.pernas;
  sh.uniforms["uHkCabeca"] = e.cabeca;
  sh.uniforms["uHkTronco"] = e.tronco;
  sh.uniforms["uHkTempo"] = TEMPO;
  sh.vertexShader = sh.vertexShader.replace(
    "#include <common>",
    "#include <common>" + GLSL_ESQUELETO,
  );
  if (semNormal) sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", V_SEM_NORMAL);
  else
    sh.vertexShader = sh.vertexShader
      .replace("#include <beginnormal_vertex>", V_NORMAL)
      .replace("#include <begin_vertex>", V_POSICAO);
}

/** Material só para a sombra: faz a sombra acompanhar os braços e as pernas dobrados. */
export function materialDeSombra(THREE: typeof TH, e: Esqueleto, roupa = false) {
  const m = new THREE.MeshDepthMaterial();
  if (roupa) m.defines = { HK_ROUPA: "" };
  m.onBeforeCompile = (sh) => comEsqueleto(sh, e, true);
  m.customProgramCacheKey = () => "hk-sombra" + (roupa ? "|roupa" : "");
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
