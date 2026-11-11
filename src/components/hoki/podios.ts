/**
 * Os pódios do HOKI. Todos têm a mesma estrutura (base redonda em dois níveis,
 * feita de blocos, com a flâmula do nível na frente) e mudam no material e nos
 * enfeites: Clássico, Madeira, Jardim, Gelo, Deserto, Vulcânico, Tecnológico,
 * Galáctico, Oceânico, Divino, Sombrio e Real.
 */
import type * as TH from "three";
import { Blocos, arbusto, letrasDePedra, sorteador, type Sorteio } from "./voxel";

type Lixo = { dispose: () => void }[];
export interface Obra {
  THREE: typeof TH;
  grupo: TH.Group;
  lixo: Lixo;
  r: Sorteio;
  /** O que se mexe a cada quadro (brasas, hologramas, bolhas...). */
  animar: ((t: number) => void)[];
  mat(cor: number, o?: TH.MeshStandardMaterialParameters): TH.MeshStandardMaterial;
  forma(geo: TH.BufferGeometry, m: TH.Material, x?: number, y?: number, z?: number): TH.Mesh;
  /** Fiada de blocos em arco (setores de anel de borda arredondada). */
  fiada(
    r0: number,
    r1: number,
    n: number,
    y: number,
    alto: number,
    fase: number,
    cores: readonly number[],
    m?: TH.Material,
    folga?: number,
  ): void;
}
export interface Estrutura {
  pedras: readonly number[];
  /** Cor que aparece nas juntas (e que pode brilhar, como a lava). */
  miolo: number;
  brilhoDoMiolo?: number;
  tampo: number;
  /** Material dos blocos (pedra fosca, gelo translúcido, metal...). */
  material?: TH.MeshStandardMaterialParameters;
  /** Quantos blocos por fiada: [base, corpo, aro]. */
  blocos?: [number, number, number];
}
export interface Flamula {
  pano: number;
  borda: number;
  numero?: number;
  louro?: number;
}

export function criarObra(THREE: typeof TH, semente: number) {
  const grupo = new THREE.Group();
  const lixo: Lixo = [];
  const animar: ((t: number) => void)[] = [];
  const aux = new THREE.Object3D();
  const cor = new THREE.Color();
  const r = sorteador(semente);
  const o: Obra = {
    THREE,
    grupo,
    lixo,
    r,
    animar,
    mat(c, p = {}) {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...p });
      lixo.push(m);
      return m;
    },
    forma(geo, m, x = 0, y = 0, z = 0) {
      lixo.push(geo);
      const malha = new THREE.Mesh(geo, m);
      malha.position.set(x, y, z);
      malha.castShadow = malha.receiveShadow = true;
      grupo.add(malha);
      return malha;
    },
    fiada(r0, r1, n, y, alto, fase, cores, m, folga = 0.035) {
      const chanfro = Math.min(0.022, alto * 0.22);
      const a = Math.PI / n - folga / 2;
      const f = new THREE.Shape();
      f.absarc(0, 0, r1, -a, a, false);
      f.absarc(0, 0, r0, a, -a, true);
      f.closePath();
      const g = new THREE.ExtrudeGeometry(f, {
        depth: alto - chanfro * 2,
        bevelEnabled: true,
        bevelThickness: chanfro,
        bevelSize: chanfro,
        bevelOffset: -chanfro,
        bevelSegments: 2,
        curveSegments: 5,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(0, chanfro, 0);
      const malha = new THREE.InstancedMesh(g, m ?? o.mat(0xffffff), n);
      for (let i = 0; i < n; i++) {
        aux.position.set(0, y, 0);
        aux.rotation.set(0, fase + (i / n) * Math.PI * 2, 0);
        aux.updateMatrix();
        malha.setMatrixAt(i, aux.matrix);
        malha.setColorAt(
          i,
          cor
            .setHex(cores[Math.floor(r() * cores.length)] ?? 0xffffff)
            .multiplyScalar(0.96 + r() * 0.08),
        );
      }
      malha.castShadow = malha.receiveShadow = true;
      grupo.add(malha);
      lixo.push(g);
    },
  };
  return o;
}

/** A base de sempre: degrau largo embaixo, corpo em duas fiadas, aro em cima e o tampo um pouco afundado. Altura 0,75. */
export function estrutura(o: Obra, e: Estrutura) {
  const { THREE } = o;
  const [nBase, nCorpo, nAro] = e.blocos ?? [12, 10, 14];
  const m = o.mat(0xffffff, { roughness: 0.84, ...e.material });
  const miolo = o.mat(
    e.miolo,
    e.brilhoDoMiolo !== undefined
      ? { emissive: e.brilhoDoMiolo, emissiveIntensity: 1.8, roughness: 0.6 }
      : { roughness: 1 },
  );
  o.forma(new THREE.CylinderGeometry(0.93, 0.93, 0.7, 40), miolo, 0, 0.35, 0).castShadow = false;
  o.forma(
    new THREE.CylinderGeometry(0.77, 0.77, 0.25, 40),
    o.mat(e.tampo, { roughness: 0.75 }),
    0,
    0.625,
    0,
  ).castShadow = false;
  o.fiada(0.84, 1.25, nBase, 0, 0.2, Math.PI / nBase, e.pedras, m);
  o.fiada(0.66, 0.985, nCorpo, 0.2, 0.25, 0, e.pedras, m);
  o.fiada(0.66, 0.985, nCorpo, 0.45, 0.25, Math.PI / nCorpo, e.pedras, m);
  o.fiada(0.74, 1.035, nAro, 0.7, 0.1, Math.PI / nAro, e.pedras, m, 0.03);
}

const ESTRELA: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
  return [Math.cos(a) * (i % 2 ? 0.45 : 1), Math.sin(a) * (i % 2 ? 0.45 : 1)] as [number, number];
});
/**
 * Flâmula do nível, caindo do aro até a base: pano com contorno, o número em
 * relevo, dois ramos de louro em volta e uma estrela embaixo.
 */
export function flamula(o: Obra, nivel: number, f: Flamula) {
  const { THREE } = o;
  const L = 0.66;
  const A = 0.66;
  const pano = new THREE.Shape();
  pano.moveTo(-L / 2, 0);
  pano.lineTo(L / 2, 0);
  pano.lineTo(L / 2, -A + 0.16);
  pano.lineTo(0, -A);
  pano.lineTo(-L / 2, -A + 0.16);
  pano.closePath();
  const gPano = new THREE.ExtrudeGeometry(pano, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  const mOuro = new THREE.MeshPhysicalMaterial({
    color: f.borda,
    roughness: 0.34,
    metalness: 0.25,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });
  const mPano = o.mat(f.pano, { roughness: 0.62 });
  const mLouro = new THREE.MeshPhysicalMaterial({
    color: f.louro ?? f.borda,
    roughness: 0.36,
    metalness: 0.25,
    clearcoat: 0.4,
  });
  o.lixo.push(gPano, mOuro, mLouro);
  const g = new THREE.Group();
  const borda = new THREE.Mesh(gPano, mOuro);
  const miolo = new THREE.Mesh(gPano, mPano);
  miolo.scale.set(0.87, 0.88, 1);
  miolo.position.set(0, -0.028, 0.014);
  // número do nível
  const digitos = new Blocos(sorteador(nivel + 3));
  const U = 0.27 / 14;
  const medida = letrasDePedra(digitos, String(nivel), U, 0.03, {
    linhas: 14,
    relevo: 0,
    maior: [8, 8],
    cores: [f.numero ?? 0xffffff],
    z: 0.03,
  });
  const numero = digitos.construir(THREE, {
    recebe: false,
    acabamento: { chanfro: 0.006, junta: 0, pe: 0, grao: 0 },
    aspereza: 0.5,
  });
  const cabe = Math.min(1, 0.34 / medida.largura);
  numero.malha.scale.set(cabe, cabe, 1);
  numero.malha.position.set(0, -0.2 - (medida.altura * cabe) / 2, 0.02);
  o.lixo.push({ dispose: numero.descartar });
  // louro: folhinhas em dois arcos, um de cada lado do número
  const gFolha = new THREE.SphereGeometry(1, 8, 6);
  const folhas = new THREE.InstancedMesh(gFolha, mLouro, 16);
  const aux = new THREE.Object3D();
  for (let i = 0; i < 16; i++) {
    const lado = i < 8 ? -1 : 1;
    const k = (i % 8) / 7;
    const a = -0.75 + k * 1.75;
    aux.position.set(lado * (0.05 + Math.cos(a) * 0.19), -0.325 + Math.sin(a) * 0.17, 0.034);
    aux.rotation.set(0, 0, lado * (a + 0.9));
    aux.scale.set(0.034, 0.014, 0.008);
    aux.updateMatrix();
    folhas.setMatrixAt(i, aux.matrix);
  }
  const fe = new THREE.Shape();
  ESTRELA.forEach(([x, y], i) =>
    i ? fe.lineTo(x * 0.05, y * 0.05) : fe.moveTo(x * 0.05, y * 0.05),
  );
  fe.closePath();
  const gEstrela = new THREE.ExtrudeGeometry(fe, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
  });
  const estrela = new THREE.Mesh(gEstrela, mLouro);
  estrela.position.set(0, -0.535, 0.03);
  o.lixo.push(gFolha, gEstrela);
  g.add(borda, miolo, numero.malha, folhas, estrela);
  g.position.set(0, 0.745, 1.05);
  g.rotation.x = -0.33;
  g.traverse((x) => (x.castShadow = true));
  o.grupo.add(g);
}

type Estilo = (o: Obra, nivel: number) => void;
const VERMELHA: Flamula = { pano: 0xd9151b, borda: 0xf3c044 };
const OURO = 0xf3c044;
/** Um punhado de bloquinhos (folhas, flores, neve) com o acabamento dos blocos. */
const blocos = (o: Obra, monta: (b: Blocos) => void) => {
  const b = new Blocos(o.r);
  monta(b);
  const c = b.construir(o.THREE, { acabamento: { chanfro: 0.03, junta: 0.1, pe: 0.25, grao: 0 } });
  o.grupo.add(c.malha);
  o.lixo.push({ dispose: c.descartar });
};
/** Ponto em volta do pódio, no ângulo `a` (0 = frente) e à distância `d`. */
const emVolta = (a: number, d: number): [number, number] => [Math.sin(a) * d, Math.cos(a) * d];
/** Ângulos espalhados por trás e pelos lados (a frente fica livre para a flâmula). */
const porTras = (o: Obra, n: number) =>
  Array.from({ length: n }, (_, i) => 0.75 + ((i + o.r() * 0.6) / n) * (Math.PI * 2 - 1.5));
const tufos = (b: Blocos, o: Obra, n: number, cores: readonly number[]) => {
  for (const a of porTras(o, n)) {
    const [x, z] = emVolta(a, 1.3 + o.r() * 0.14);
    for (let k = 0; k < 3; k++)
      b.base(
        x + (o.r() - 0.5) * 0.12,
        0,
        z + (o.r() - 0.5) * 0.12,
        0.05,
        0.1 + o.r() * 0.16,
        0.05,
        cores[k % cores.length]!,
        0.05,
        o.r(),
      );
  }
};
/** Aro fino em volta do pódio (cinta de ferro, friso dourado, néon). */
const friso = (o: Obra, raio: number, y: number, grossura: number, m: TH.Material) => {
  const a = o.forma(new o.THREE.TorusGeometry(raio, grossura, 8, 64), m, 0, y, 0);
  a.rotation.x = Math.PI / 2;
  return a;
};
const dourado = (o: Obra) => {
  const m = new o.THREE.MeshPhysicalMaterial({
    color: OURO,
    roughness: 0.32,
    metalness: 0.3,
    clearcoat: 0.5,
  });
  o.lixo.push(m);
  return m;
};

const classico: Estilo = (o, nivel) => {
  estrutura(o, {
    pedras: [0xdfd0ba, 0xd4c4ac, 0xe8dbc7, 0xcfbea6],
    miolo: 0x6f5f4d,
    tampo: 0xd9544d,
  });
  flamula(o, nivel, VERMELHA);
  blocos(o, (b) => {
    tufos(b, o, 14, [0x58a83b, 0x76c84e]);
    arbusto(b, -1.42, 0.5, 0.42);
    arbusto(b, 1.44, 0.42, 0.36);
  });
};
const madeira: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0x9a6a3c, 0x8a5c32, 0xa87646, 0x7c5230],
    miolo: 0x3d2a18,
    tampo: 0xb98a58,
    blocos: [16, 18, 20],
    material: { roughness: 0.92 },
  });
  const ferro = o.mat(0x2b2d32, { roughness: 0.5, metalness: 0.3 });
  friso(o, 0.995, 0.3, 0.016, ferro);
  friso(o, 0.995, 0.6, 0.016, ferro);
  // duas lanternas acesas nos fundos
  const luz = o.mat(0xffd98a, { emissive: 0xffb84a, emissiveIntensity: 2.2 });
  for (const s of [-1, 1]) {
    o.forma(new THREE.BoxGeometry(0.08, 0.62, 0.08), o.mat(0x5a3a1c), s * 0.92, 0.51, -0.62);
    o.forma(new THREE.BoxGeometry(0.17, 0.2, 0.17), luz, s * 0.92, 0.92, -0.62).castShadow = false;
    o.forma(new THREE.BoxGeometry(0.24, 0.05, 0.24), ferro, s * 0.92, 1.04, -0.62);
    o.forma(new THREE.BoxGeometry(0.12, 0.06, 0.12), ferro, s * 0.92, 1.09, -0.62);
  }
  flamula(o, nivel, VERMELHA);
  blocos(o, (b) => {
    tufos(b, o, 8, [0x58a83b, 0x76c84e]);
    for (let i = 0; i < 9; i++)
      b.add(
        -1.0 - o.r() * 0.2,
        0.15 + i * 0.07,
        0.2 + o.r() * 0.3,
        0.13,
        0.11,
        0.13,
        i % 2 ? 0x4f9c35 : 0x63b73f,
        0.06,
        o.r(),
      );
    arbusto(b, 1.42, 0.3, 0.4);
  });
};
const jardim: Estilo = (o, nivel) => {
  estrutura(o, { pedras: [0xd9d3c6, 0xcfc8ba, 0xe4dfd3], miolo: 0x6c7a52, tampo: 0xe9dcc4 });
  flamula(o, nivel, VERMELHA);
  blocos(o, (b) => {
    // musgo e trepadeira caindo do aro, e margaridas
    for (const a of porTras(o, 22)) {
      const [x, z] = emVolta(a, 1.0);
      b.add(x, 0.8, z, 0.2, 0.09, 0.2, o.r() < 0.5 ? 0x63b73f : 0x4f9c35, 0.06, o.r());
      const cai = Math.floor(o.r() * 4);
      for (let k = 0; k < cai; k++)
        b.add(
          x * 1.035,
          0.7 - k * 0.1,
          z * 1.035,
          0.12,
          0.1,
          0.12,
          k % 2 ? 0x58a83b : 0x76c84e,
          0.06,
          o.r(),
        );
    }
    for (const a of [1.0, 1.9, 2.7, 3.6, 4.5, 5.3]) {
      const [x, z] = emVolta(a, 1.02 + o.r() * 0.06);
      const y = 0.84;
      b.add(x, y, z, 0.17, 0.05, 0.17, 0xffffff, 0);
      b.add(x, y + 0.04, z, 0.07, 0.05, 0.07, 0xffd84a, 0);
    }
    tufos(b, o, 12, [0x58a83b, 0x76c84e]);
    arbusto(b, -1.4, 0.4, 0.5, { flor: 0xffffff });
    arbusto(b, 1.42, 0.3, 0.42, { flor: 0xffffff });
  });
};
const gelo: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0xa9dcff, 0x8fd0fb, 0xc4e8ff],
    miolo: 0x4f9fd8,
    tampo: 0xdff3ff,
    material: {
      roughness: 0.15,
      transparent: true,
      opacity: 0.9,
      emissive: 0x2f7fb8,
      emissiveIntensity: 0.22,
    },
  });
  const neve = o.mat(0xffffff, { roughness: 1, emissive: 0xcfe6ff, emissiveIntensity: 0.15 });
  const gBola = new THREE.SphereGeometry(1, 14, 10);
  for (const a of porTras(o, 12)) {
    const [x, z] = emVolta(a, 1.02);
    o.forma(gBola, neve, x, 0.8, z).scale.set(0.16 + o.r() * 0.08, 0.07, 0.14);
  }
  const cristal = o.mat(0xbdeaff, {
    roughness: 0.08,
    transparent: true,
    opacity: 0.86,
    emissive: 0x3fa8e0,
    emissiveIntensity: 0.35,
    flatShading: true,
  });
  for (const a of porTras(o, 9)) {
    const [x, z] = emVolta(a, 1.32 + o.r() * 0.1);
    const h = 0.35 + o.r() * 0.5;
    const c = o.forma(
      new THREE.ConeGeometry(0.07 + o.r() * 0.06, h, 5),
      cristal,
      x,
      h / 2 - 0.02,
      z,
    );
    c.rotation.set(z * 0.18, 0, -x * 0.18);
  }
  flamula(o, nivel, { pano: 0x2f6fd0, borda: 0xcfeaff, louro: 0xe8f6ff });
};
const deserto: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, { pedras: [0xe3c98a, 0xd8bb78, 0xecd59c], miolo: 0xa98a52, tampo: 0xf0dcae });
  const verde = o.mat(0x5fae4a, { roughness: 0.8 });
  const cacto = (x: number, z: number, s: number) => {
    o.forma(new THREE.CapsuleGeometry(0.09 * s, 0.5 * s, 4, 10), verde, x, 0.34 * s, z);
    for (const lado of [-1, 1]) {
      o.forma(
        new THREE.CapsuleGeometry(0.05 * s, 0.14 * s, 4, 8),
        verde,
        x + lado * 0.15 * s,
        0.34 * s,
        z,
      ).rotation.z = Math.PI / 2;
      o.forma(
        new THREE.CapsuleGeometry(0.05 * s, 0.16 * s, 4, 8),
        verde,
        x + lado * 0.2 * s,
        0.46 * s + lado * 0.03,
        z,
      );
    }
  };
  cacto(-1.32, -0.25, 1.15);
  cacto(1.4, 0.15, 0.8);
  const pedra = o.mat(0xb9a98c, { roughness: 1, flatShading: true });
  for (const [x, z, s] of [
    [-1.3, 0.5, 0.16],
    [1.25, -0.5, 0.2],
    [1.5, -0.2, 0.12],
    [-1.05, 0.85, 0.1],
  ] as const)
    o.forma(new THREE.DodecahedronGeometry(s), pedra, x, s * 0.7, z);
  flamula(o, nivel, VERMELHA);
};
/** Coisinhas que sobem e somem (brasas, bolhas, faíscas), em volta do pódio. */
const subindo = (
  o: Obra,
  n: number,
  m: TH.Material,
  geo: TH.BufferGeometry,
  raio = 1.15,
  alto = 1.5,
) => {
  const pecas = Array.from({ length: n }, () => o.forma(geo, m));
  pecas.forEach((p) => (p.castShadow = false));
  o.animar.push((t) =>
    pecas.forEach((p, i) => {
      const k = (t * 0.33 + i * 0.137) % 1;
      const a = i * 2.4 + t * 0.25;
      p.position.set(
        Math.cos(a) * (raio + Math.sin(i) * 0.15),
        0.1 + k * alto,
        Math.sin(a) * (raio + Math.cos(i) * 0.15),
      );
      p.scale.setScalar(1 - k);
    }),
  );
};
const vulcanico: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0x3a3231, 0x2f2928, 0x453b39],
    miolo: 0xff5a1a,
    brilhoDoMiolo: 0xff3a00,
    tampo: 0x4a3f3c,
    material: { roughness: 0.95 },
  });
  const rocha = o.mat(0x2b2523, { roughness: 1, flatShading: true });
  for (const a of porTras(o, 9)) {
    const [x, z] = emVolta(a, 1.32 + o.r() * 0.12);
    const h = 0.5 + o.r() * 0.6;
    o.forma(
      new THREE.ConeGeometry(0.16 + o.r() * 0.08, h, 5),
      rocha,
      x,
      h / 2 - 0.03,
      z,
    ).rotation.set(z * 0.2, o.r() * 3, -x * 0.2);
  }
  subindo(
    o,
    10,
    o.mat(0xff7a2a, { emissive: 0xff3a00, emissiveIntensity: 2 }),
    new THREE.BoxGeometry(0.05, 0.05, 0.05),
  );
  flamula(o, nivel, VERMELHA);
};
const tecnologico: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0x2b3340, 0x343d4c, 0x242b36],
    miolo: 0x23e0ff,
    brilhoDoMiolo: 0x23e0ff,
    tampo: 0x1c222b,
    blocos: [8, 8, 8],
    material: { roughness: 0.4, metalness: 0.3 },
  });
  const neon = o.mat(0x9af4ff, { emissive: 0x23e0ff, emissiveIntensity: 2.2 });
  friso(o, 1.262, 0.2, 0.014, neon).castShadow = false;
  friso(o, 1.045, 0.8, 0.012, neon).castShadow = false;
  // dois painéis de holograma flutuando atrás
  const holo = o.mat(0x7feaff, {
    emissive: 0x23e0ff,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const paineis = [-1, 1].map((s) => {
    const p = o.forma(new THREE.BoxGeometry(0.42, 0.16, 0.02), holo, s * 0.95, 1.15, -0.55);
    p.castShadow = false;
    p.rotation.set(-0.2, s * -0.5, s * 0.25);
    return p;
  });
  o.animar.push((t) =>
    paineis.forEach((p, i) => (p.position.y = 1.15 + Math.sin(t * 1.5 + i * 2) * 0.06)),
  );
  const aleta = o.mat(0x2b3340, { roughness: 0.4, metalness: 0.3 });
  for (const s of [-1, 1])
    o.forma(new THREE.BoxGeometry(0.14, 0.5, 0.34), aleta, s * 1.22, 0.3, 0).rotation.z = s * -0.18;
  flamula(o, nivel, { pano: 0x12303a, borda: 0x23e0ff, louro: 0x9af4ff });
};
const galactico: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0x4b2a9a, 0x5a34b0, 0x3f2386],
    miolo: 0x1b0f3a,
    tampo: 0x6a3fc4,
    material: { roughness: 0.5 },
  });
  const ouro = dourado(o);
  friso(o, 1.26, 0.2, 0.02, ouro);
  friso(o, 1.045, 0.8, 0.018, ouro);
  const estrela = o.mat(0xfff3b0, { emissive: 0xffe28a, emissiveIntensity: 2 });
  const gE = new THREE.SphereGeometry(0.018, 8, 6);
  for (let i = 0; i < 22; i++) {
    const [x, z] = emVolta(o.r() * Math.PI * 2, 1.0);
    o.forma(gE, estrela, x, 0.26 + o.r() * 0.4, z).castShadow = false;
  }
  // um anel de órbita atrás e um planetinha com anel dando a volta
  const orbita = o.forma(new THREE.TorusGeometry(0.62, 0.02, 8, 60), ouro, -0.75, 1.02, -0.5);
  orbita.rotation.set(1.1, 0.3, 0.4);
  const planeta = new THREE.Group();
  const bola = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 20, 14),
    o.mat(0x8a5cf0, { roughness: 0.5, emissive: 0x3a1a8a, emissiveIntensity: 0.4 }),
  );
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 40), ouro);
  anel.rotation.x = 1.25;
  planeta.add(bola, anel);
  o.lixo.push(bola.geometry, anel.geometry);
  o.grupo.add(planeta);
  o.animar.push((t) =>
    planeta.position.set(
      0.95 + Math.cos(t * 0.6) * 0.12,
      1.1 + Math.sin(t * 1.1) * 0.05,
      -0.55 + Math.sin(t * 0.6) * 0.12,
    ),
  );
  flamula(o, nivel, { pano: 0x2a1766, borda: OURO });
};
const oceanico: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0x4fd0e8, 0x3fc0dc, 0x6fe0f2],
    miolo: 0x1f8fb0,
    tampo: 0x9feaf6,
    material: {
      roughness: 0.12,
      transparent: true,
      opacity: 0.88,
      emissive: 0x1f9fc0,
      emissiveIntensity: 0.2,
    },
  });
  const coral = (x: number, z: number, cor: number, s: number) => {
    const m = o.mat(cor, { roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const h = (0.28 + o.r() * 0.3) * s;
      const g = o.forma(
        new THREE.CapsuleGeometry(0.035 * s, h, 4, 8),
        m,
        x + (i - 2) * 0.07 * s,
        h / 2 + 0.03,
        z + (o.r() - 0.5) * 0.1,
      );
      g.rotation.z = (i - 2) * -0.28;
    }
  };
  coral(-1.36, 0.1, 0xff7a8a, 1.1);
  coral(1.38, -0.1, 0xb07af0, 1);
  coral(-1.1, -0.75, 0xffa24a, 0.8);
  const fe = new THREE.Shape();
  ESTRELA.forEach(([x, y], i) =>
    i ? fe.lineTo(x * 0.13, y * 0.13) : fe.moveTo(x * 0.13, y * 0.13),
  );
  const estrela = o.forma(
    new THREE.ExtrudeGeometry(fe, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
    o.mat(0xffa33a, { roughness: 0.6 }),
    -0.95,
    0.24,
    0.92,
  );
  estrela.rotation.set(-1.2, 0, 0.4);
  // ondas atrás e bolhas subindo
  const agua = o.mat(0x7fe3f5, {
    roughness: 0.1,
    transparent: true,
    opacity: 0.75,
    emissive: 0x2fb0d0,
    emissiveIntensity: 0.3,
  });
  for (const s of [-1, 1])
    o.forma(
      new THREE.TorusGeometry(0.2, 0.06, 10, 24, Math.PI * 1.5),
      agua,
      s * 0.82,
      0.95,
      -0.62,
    ).rotation.set(0, s * 0.5, s > 0 ? 0.4 : 2.2);
  subindo(
    o,
    10,
    o.mat(0xdff8ff, { transparent: true, opacity: 0.7, roughness: 0.05 }),
    new THREE.SphereGeometry(0.04, 10, 8),
    1.2,
    1.7,
  );
  flamula(o, nivel, { pano: 0x0f5f8a, borda: OURO });
};
const divino: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0xf4f1ea, 0xebe6dc, 0xfaf8f3],
    miolo: 0xd9c79a,
    tampo: 0xfffaf0,
    material: { roughness: 0.55 },
  });
  const ouro = dourado(o);
  const marmore = o.mat(0xf7f4ee, { roughness: 0.5 });
  friso(o, 1.26, 0.2, 0.02, ouro);
  friso(o, 1.045, 0.8, 0.018, ouro);
  for (const s of [-1, 1]) {
    // coluna de cada lado
    o.forma(new THREE.CylinderGeometry(0.09, 0.1, 0.5, 12), marmore, s * 1.18, 0.45, 0.25);
    o.forma(new THREE.BoxGeometry(0.26, 0.07, 0.26), ouro, s * 1.18, 0.735, 0.25);
    o.forma(new THREE.BoxGeometry(0.26, 0.07, 0.26), ouro, s * 1.18, 0.21, 0.25);
    // asa aberta atrás
    const asa = new THREE.Shape();
    asa.moveTo(0, 0);
    asa.bezierCurveTo(0.25, 0.5, 0.75, 0.78, 1.18, 0.74);
    asa.lineTo(0.94, 0.52);
    asa.lineTo(1.08, 0.44);
    asa.lineTo(0.8, 0.29);
    asa.lineTo(0.9, 0.17);
    asa.lineTo(0.56, 0.08);
    asa.lineTo(0.6, -0.06);
    asa.quadraticCurveTo(0.25, -0.12, 0, 0);
    const a = o.forma(
      new THREE.ExtrudeGeometry(asa, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
      }),
      marmore,
      s * 0.7,
      0.62,
      -0.45,
    );
    a.scale.set(s * 0.85, 0.85, 1);
    a.rotation.y = s * -0.3;
  }
  const aureola = o.forma(
    new THREE.TorusGeometry(0.3, 0.03, 10, 40),
    o.mat(0xffe28a, { emissive: 0xffc84a, emissiveIntensity: 1.6 }),
    0,
    1.25,
    -0.85,
  );
  aureola.rotation.x = 1.25;
  aureola.castShadow = false;
  o.animar.push((t) => (aureola.position.y = 1.25 + Math.sin(t * 1.3) * 0.05));
  flamula(o, nivel, { pano: 0xf4f1ea, borda: OURO, numero: 0xd9a52e, louro: OURO });
};
const sombrio: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0x2a2533, 0x231f2b, 0x322c3d],
    miolo: 0x8a3fd8,
    brilhoDoMiolo: 0x7a2fd0,
    tampo: 0x3a3346,
    material: { roughness: 0.9 },
  });
  const pedra = o.mat(0x231f2b, { roughness: 1, flatShading: true });
  for (const a of [2.2, 2.75, 3.14, 3.55, 4.1]) {
    const [x, z] = emVolta(a, 1.05);
    const h = 0.4 + Math.abs(Math.sin(a * 3)) * 0.45;
    o.forma(new THREE.ConeGeometry(0.14, h, 4), pedra, x, 0.75 + h / 2, z).rotation.y = a;
  }
  // tochas de fogo roxo
  const fogo = o.mat(0xc98aff, {
    emissive: 0x9a3fff,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.9,
  });
  const chamas = [1.15, 2.0, 4.3, 5.15].map((a) => {
    const [x, z] = emVolta(a, 1.22);
    o.forma(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 6), pedra, x, 0.41, z);
    const c = o.forma(new THREE.ConeGeometry(0.09, 0.26, 8), fogo, x, 0.76, z);
    c.castShadow = false;
    return c;
  });
  o.animar.push((t) =>
    chamas.forEach((c, i) =>
      c.scale.set(
        1 + Math.sin(t * 9 + i) * 0.12,
        1 + Math.sin(t * 12 + i * 2) * 0.22,
        1 + Math.cos(t * 9 + i) * 0.12,
      ),
    ),
  );
  // correntes dos dois lados da flâmula
  const ferro = o.mat(0x6b6772, { roughness: 0.4, metalness: 0.4 });
  const gElo = new THREE.TorusGeometry(0.045, 0.012, 6, 14);
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const a = s * (0.42 + i * 0.11);
      const [x, z] = emVolta(a, 1.02);
      o.forma(gElo, ferro, x, 0.56 - Math.sin((i / 5) * Math.PI) * 0.09, z).rotation.set(
        i % 2 ? 0 : Math.PI / 2,
        a,
        0,
      );
    }
  flamula(o, nivel, { pano: 0x3a1a5c, borda: OURO });
};
const real: Estilo = (o, nivel) => {
  const { THREE } = o;
  estrutura(o, {
    pedras: [0xb3121b, 0xa50f17, 0xc21722],
    miolo: 0x5a070b,
    tampo: 0xd9544d,
    material: { roughness: 0.7 },
  });
  const ouro = dourado(o);
  friso(o, 1.26, 0.2, 0.024, ouro);
  friso(o, 0.99, 0.45, 0.016, ouro);
  friso(o, 1.045, 0.8, 0.022, ouro);
  // coroa atrás, sobre uma almofada
  o.forma(
    new THREE.SphereGeometry(0.3, 20, 12),
    o.mat(0xb3121b, { roughness: 0.8 }),
    0,
    0.86,
    -0.82,
  ).scale.set(1, 0.4, 0.8);
  o.forma(new THREE.CylinderGeometry(0.24, 0.21, 0.13, 20), ouro, 0, 1.02, -0.82);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    o.forma(
      new THREE.ConeGeometry(0.05, 0.14, 8),
      ouro,
      Math.cos(a) * 0.215,
      1.15,
      -0.82 + Math.sin(a) * 0.215,
    );
    o.forma(
      new THREE.SphereGeometry(0.028, 10, 8),
      o.mat(i % 2 ? 0x2f7de0 : 0x3fb86a, { roughness: 0.2 }),
      Math.cos(a + 0.52) * 0.24,
      1.02,
      -0.82 + Math.sin(a + 0.52) * 0.24,
    );
  }
  // um leão dourado de cada lado (cabeça, juba e corpo, bem simples)
  for (const s of [-1, 1]) {
    const x = s * 1.24;
    o.forma(new THREE.BoxGeometry(0.3, 0.12, 0.34), ouro, x, 0.06, 0.2);
    o.forma(new THREE.CapsuleGeometry(0.11, 0.16, 4, 10), ouro, x, 0.3, 0.14);
    o.forma(new THREE.SphereGeometry(0.15, 14, 10), ouro, x, 0.5, 0.2).scale.set(1, 1, 0.9);
    o.forma(new THREE.SphereGeometry(0.11, 14, 10), ouro, x, 0.5, 0.3);
    for (const p of [-1, 1])
      o.forma(new THREE.CapsuleGeometry(0.035, 0.14, 4, 8), ouro, x + p * 0.07, 0.2, 0.3);
  }
  flamula(o, nivel, VERMELHA);
};

const ESTILOS: Record<string, { monta: Estilo; largura: number }> = {
  pedra: { monta: classico, largura: 2.7 },
  madeira: { monta: madeira, largura: 2.7 },
  grama: { monta: jardim, largura: 2.7 },
  cristal: { monta: gelo, largura: 2.9 },
  deserto: { monta: deserto, largura: 3.1 },
  lava: { monta: vulcanico, largura: 2.9 },
  tecnologico: { monta: tecnologico, largura: 2.9 },
  galactico: { monta: galactico, largura: 3.0 },
  oceanico: { monta: oceanico, largura: 3.0 },
  nuvem: { monta: divino, largura: 3.3 },
  sombrio: { monta: sombrio, largura: 2.8 },
  campeao: { monta: real, largura: 3.0 },
};
/**
 * Pódio onde o HOKI fica em exposição. `tipo` é o do catálogo; os pódios de
 * antes continuam valendo com o estilo novo equivalente (grama = Jardim,
 * cristal = Gelo, lava = Vulcânico, nuvem = Divino, campeão = Real).
 */
export function criarPodio(THREE: typeof TH, tipo: string, nivel: number) {
  const estilo = ESTILOS[tipo] ?? ESTILOS["pedra"]!;
  const o = criarObra(THREE, 41);
  estilo.monta(o, nivel);
  return {
    grupo: o.grupo,
    altura: 0.75,
    largura: estilo.largura,
    atualizar: (t: number) => o.animar.forEach((f) => f(t)),
    descartar: () => o.lixo.forEach((l) => l.dispose()),
  };
}
