/**
 * Efeitos do HOKI: auras que contornam o corpo (e acompanham os movimentos),
 * glitter, estrelas e corações em volta, e fogo. Medidas nas unidades do modelo.
 */
import type * as TH from "three";
import { GLSL_ESQUELETO, TEMPO, type Esqueleto } from "./corpo";
import { texturaMancha } from "./luz";

export interface Efeito {
  grupo: TH.Group;
  atualizar(t: number): void;
  descartar(): void;
}
interface Receita {
  /** Aura: cor de baixo, cor de cima e força. `iris` faz o arco-íris correr. */
  aura?: { baixo: number; cima: number; forca: number; iris?: boolean };
  /** Pontinhos de luz piscando em volta. */
  glitter?: { cores: number[]; quantos: number; sobe?: boolean };
  /** Formas dando a volta (estrelas) ou subindo (corações). */
  formas?: {
    tipo: "estrela" | "coracao";
    cor: number;
    brilho: number;
    quantos: number;
    sobe?: boolean;
  };
}
const RECEITAS: Record<string, Receita> = {
  "efeito:aura-vermelha": { aura: { baixo: 0xff2a2a, cima: 0xff7a5a, forca: 1.5 } },
  "efeito:aura-ouro": { aura: { baixo: 0xffb020, cima: 0xfff0a0, forca: 1.5 } },
  "efeito:aura-gelo": {
    aura: { baixo: 0x3f9fff, cima: 0xd0f4ff, forca: 1.5 },
    glitter: { cores: [0xffffff, 0xbfe8ff], quantos: 14 },
  },
  // exclusiva: toda prateada, com um brilho fino de prata em volta
  "efeito:aura-prata": {
    aura: { baixo: 0xaeb4bd, cima: 0xffffff, forca: 1.9 },
    glitter: { cores: [0xffffff, 0xdfe3e8, 0xaab0b9], quantos: 30 },
  },
  "efeito:aura-iris": { aura: { baixo: 0xffffff, cima: 0xffffff, forca: 1.5, iris: true } },
  "efeito:fogo": {
    aura: { baixo: 0xff3a0a, cima: 0xffd84a, forca: 1.9 },
    glitter: { cores: [0xffb84a, 0xff6a1a], quantos: 26, sobe: true },
  },
  "efeito:glitter": { glitter: { cores: [0xffe28a, 0xfff6c8], quantos: 36 } },
  "efeito:glitter-rosa": { glitter: { cores: [0xff8fc8, 0xffd3e8], quantos: 36 } },
  "efeito:glitter-iris": {
    glitter: { cores: [0xff5a5a, 0xffd84a, 0x5aff8a, 0x5ac8ff, 0xc98aff], quantos: 44 },
  },
  "efeito:estrelas": { formas: { tipo: "estrela", cor: 0xffe28a, brilho: 0xffc84a, quantos: 5 } },
  "efeito:coracoes": {
    formas: { tipo: "coracao", cor: 0xff6a9a, brilho: 0xff3a7a, quantos: 6, sobe: true },
  },
};

const V_AURA = `
${GLSL_ESQUELETO}
uniform float uInfla;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 p = position + normal * uInfla;
  vec3 n = normal;
  hkDobrar( p, n, position );
  vHkObj = position;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  vN = normalize( normalMatrix * n );
  vV = normalize( - mv.xyz );
  gl_Position = projectionMatrix * mv;
}`;
const F_AURA = `
uniform vec3 uBaixo;
uniform vec3 uCima;
uniform float uForca;
uniform float uIris;
uniform float uHkTempo;
varying vec3 vN;
varying vec3 vV;
varying vec3 vHkObj;
void main() {
  // o rosto fica limpo: a aura contorna o corpo, não os olhos
  if ( vHkObj.z > 0.17 && vHkObj.y > 0.44 && vHkObj.y < 0.7 && abs( vHkObj.x ) < 0.22 ) discard;
  float borda = pow( 1.0 - abs( dot( normalize( vN ), normalize( vV ) ) ), 1.5 );
  float sobe = clamp( vHkObj.y * 1.1 + sin( uHkTempo * 2.0 + vHkObj.y * 9.0 ) * 0.14, 0.0, 1.0 );
  vec3 cor = mix( uBaixo, uCima, sobe );
  if ( uIris > 0.5 ) cor = 0.5 + 0.5 * cos( 6.2832 * ( vHkObj.y * 0.9 - uHkTempo * 0.22 + vec3( 0.0, 0.33, 0.67 ) ) );
  gl_FragColor = vec4( cor * borda * uForca * ( 0.8 + 0.2 * sin( uHkTempo * 3.0 ) ), 1.0 );
}`;

const pontas = (n: number, dentro: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    return [Math.cos(a) * (i % 2 ? dentro : 1), Math.sin(a) * (i % 2 ? dentro : 1)] as const;
  });
const coracao = Array.from({ length: 24 }, (_, i) => {
  const t = (i / 24) * Math.PI * 2;
  return [
    Math.pow(Math.sin(t), 3),
    (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16,
  ] as const;
});

/** Monta o efeito do catálogo em cima da pele do modelo. Devolve null se o id não for um efeito. */
export function criarEfeito(
  THREE: typeof TH,
  id: string,
  geo: TH.BufferGeometry,
  e: Esqueleto,
  leve: boolean,
): Efeito | null {
  const r = RECEITAS[id];
  if (!r) return null;
  const grupo = new THREE.Group();
  const lixo: { dispose: () => void }[] = [];
  const animar: ((t: number) => void)[] = [];
  if (r.aura) {
    // duas cascas da própria pele, uma mais perto e outra mais longe: juntas viram um brilho que vai sumindo
    const cascas: [number, number][] = leve
      ? [[0.05, 1]]
      : [
          [0.035, 1],
          [0.085, 0.55],
        ];
    for (const [infla, forca] of cascas) {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uHkBracoE: e.bracoE,
          uHkBracoD: e.bracoD,
          uHkPernas: e.pernas,
          uHkCabeca: e.cabeca,
          uHkTronco: e.tronco,
          uHkTempo: TEMPO,
          uInfla: { value: infla },
          uBaixo: { value: new THREE.Color(r.aura.baixo) },
          uCima: { value: new THREE.Color(r.aura.cima) },
          uForca: { value: r.aura.forca * forca },
          uIris: { value: r.aura.iris ? 1 : 0 },
        },
        vertexShader: V_AURA,
        fragmentShader: F_AURA,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      grupo.add(new THREE.Mesh(geo, m));
      lixo.push(m);
    }
  }
  if (r.glitter) {
    const g = r.glitter;
    const tex = texturaMancha(THREE, 0.08);
    const pos = new Float32Array(g.quantos * 3);
    const cores = new Float32Array(g.quantos * 3);
    const sem = Array.from({ length: g.quantos }, (_, i) => ({
      a: i * 2.399,
      d: 0.3 + ((i * 37) % 17) / 60,
      y: ((i * 53) % 29) / 29,
      f: 1.1 + (i % 5) * 0.31,
    }));
    const geoP = new THREE.BufferGeometry();
    geoP.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geoP.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    const m = new THREE.PointsMaterial({
      map: tex,
      size: leve ? 0.16 : 0.13,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    const p = new THREE.Points(geoP, m);
    p.frustumCulled = false;
    grupo.add(p);
    lixo.push(tex, geoP, m);
    const base = g.cores.map((c) => new THREE.Color(c));
    animar.push((t) => {
      sem.forEach((s, i) => {
        const y = g.sobe ? (s.y + t * 0.22) % 1 : s.y;
        const a = s.a + t * (g.sobe ? 0.5 : 0.25);
        const d = s.d * (g.sobe ? 1 - y * 0.5 : 1);
        pos[i * 3] = Math.cos(a) * d;
        pos[i * 3 + 1] = 0.05 + y;
        pos[i * 3 + 2] = Math.sin(a) * d;
        const brilho = g.sobe
          ? (1 - y) * 1.2
          : Math.pow(Math.max(0, Math.sin(t * s.f * 2 + s.a)), 6) * 1.5;
        const c = base[i % base.length]!;
        cores[i * 3] = c.r * brilho;
        cores[i * 3 + 1] = c.g * brilho;
        cores[i * 3 + 2] = c.b * brilho;
      });
      (geoP.getAttribute("position") as TH.BufferAttribute).needsUpdate = true;
      (geoP.getAttribute("color") as TH.BufferAttribute).needsUpdate = true;
    });
  }
  if (r.formas) {
    const f = r.formas;
    const contorno = new THREE.Shape();
    (f.tipo === "estrela" ? pontas(5, 0.45) : coracao).forEach(([x, y], i) =>
      i ? contorno.lineTo(x * 0.05, y * 0.05) : contorno.moveTo(x * 0.05, y * 0.05),
    );
    contorno.closePath();
    const g = new THREE.ExtrudeGeometry(contorno, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 1,
    });
    const m = new THREE.MeshStandardMaterial({
      color: f.cor,
      emissive: f.brilho,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    });
    lixo.push(g, m);
    const pecas = Array.from({ length: f.quantos }, () => new THREE.Mesh(g, m));
    pecas.forEach((p) => grupo.add(p));
    animar.push((t) =>
      pecas.forEach((p, i) => {
        const k = (t * 0.28 + i / f.quantos) % 1;
        const a = (i / f.quantos) * Math.PI * 2 + t * (f.sobe ? 0.4 : 1.2);
        const d = f.sobe ? 0.3 + Math.sin(i * 1.7) * 0.08 : 0.42;
        p.position.set(
          Math.cos(a) * d,
          f.sobe ? 0.35 + k * 0.85 : 0.55 + Math.sin(t * 2 + i * 1.3) * 0.12,
          Math.sin(a) * d,
        );
        p.rotation.set(0, -a + Math.PI / 2, Math.sin(t * 3 + i) * 0.3);
        p.scale.setScalar(f.sobe ? Math.sin(k * Math.PI) * 1.1 : 1);
      }),
    );
  }
  return {
    grupo,
    atualizar: (t) => animar.forEach((f) => f(t)),
    descartar: () => lixo.forEach((l) => l.dispose()),
  };
}
