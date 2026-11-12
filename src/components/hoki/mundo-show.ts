import type * as TH from "three";
import type { Reacao } from "./mascote";
import {
  ajustar,
  alturaDoChao,
  AVIAO_PARADO,
  EMBARQUE,
  FONTE,
  planejar,
  type Ponto,
} from "./mundo-mapa";
import {
  BATATA_VOO_S,
  CONGELA_S,
  batataEm,
  duracaoDoShow,
  gerarBatata,
  sorteio,
  type Batata,
  type Show,
} from "@/lib/hoki-shows";
import { playSfx } from "@/lib/sfx";

/**
 * Eventos do Founder dentro do mundo 3D. Cada computador recebe só o tipo, a
 * lista de quem participa e a semente; daqui sai, a cada quadro, onde cada
 * HOKI fica (e em que pose), além do avião, do raio, da batata, do gelo, dos
 * fogos e do globo de luz. Enquanto alguém está num evento, o mundo usa a pose
 * daqui no lugar da caminhada normal; quando acaba, ele volta andando para onde
 * estava indo.
 */
export interface PoseShow {
  x: number;
  y: number;
  z: number;
  rumo: number;
  andando?: boolean;
  sentado?: boolean;
  reacao?: Reacao | null;
  p?: number;
  /** Congelado: o boneco para no lugar, sem animação nenhuma. */
  congelado?: boolean;
  /** Mostra a sombra no chão (só faz sentido com os pés no chão). */
  sombra?: boolean;
}

interface Ligacoes {
  /** Onde o HOKI de alguém está agora (ou null se não está acordado na praça deste computador). */
  posicao(id: string): { x: number; y: number; z: number } | null;
  nome(id: string): string;
  /** Recado curto para a praça mostrar (quem explodiu, quem venceu…). */
  aviso(texto: string): void;
  /** Faz alguém executar uma animação avulsa (no trovão todo mundo pula de susto). */
  truque(id: string, tipo: Reacao): void;
}

interface Rota {
  pts: Ponto[];
  /** Distância acumulada até cada ponto. */
  acum: number[];
  total: number;
}

const VEL_ANDAR = 3.6;
/**
 * Quanto tempo cada evento dá para todo mundo chegar no lugar (em segundos). Quem está longe
 * demais para chegar andando nesse tempo (do outro lado do mapa, no escritório, no Magnata)
 * "brota" direto no lugar do evento, com uma nuvenzinha, em vez de escorregar pelo caminho.
 */
const CHEGADA_S: Partial<Record<Show["tipo"], number>> = {
  aviao: 6.5,
  mergulho: 5,
  batata: 4,
  trenzinho: 4,
  baile: 4,
};
const suave = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const entre = (s: number, a: number, b: number) => Math.min(1, Math.max(0, (s - a) / (b - a)));
/** Rumo (giro do HOKI) para olhar de `de` para `para`. */
const olharPara = (de: Ponto, para: Ponto) => Math.atan2(para.x - de.x, para.z - de.z);

function montarRota(de: Ponto, para: Ponto): Rota {
  const caminho = planejar(de, para);
  const pts = [de, ...(caminho.length ? caminho : [para])];
  const acum = [0];
  for (let i = 1; i < pts.length; i++)
    acum.push(acum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  return { pts, acum, total: acum[acum.length - 1]! };
}
function naRota(r: Rota, d: number) {
  const dist = Math.min(r.total, Math.max(0, d));
  let i = 1;
  while (i < r.pts.length - 1 && r.acum[i]! < dist) i++;
  const a = r.pts[i - 1]!;
  const b = r.pts[i] ?? a;
  const trecho = r.acum[i]! - r.acum[i - 1]!;
  const k = trecho > 1e-6 ? (dist - r.acum[i - 1]!) / trecho : 1;
  return {
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
    rumo: olharPara(a, b),
    chegou: dist >= r.total - 1e-3,
  };
}

/** Pulo em arco de um ponto a outro (k de 0 a 1). */
function pulo(
  de: { x: number; y: number; z: number },
  para: { x: number; y: number; z: number },
  k: number,
  altura: number,
) {
  const e = Math.min(1, Math.max(0, k));
  return {
    x: de.x + (para.x - de.x) * e,
    y: de.y + (para.y - de.y) * e + altura * 4 * e * (1 - e),
    z: de.z + (para.z - de.z) * e,
  };
}

interface Ativo {
  show: Show;
  /** Quando começa (relógio do performance.now, em ms). */
  inicio: number;
  dura: number;
  preparado: boolean;
  /** Quem participa e está acordado nesta tela. */
  ids: string[];
  de: Map<string, { x: number; y: number; z: number }>;
  rotas: Map<string, Rota>;
  /** Lugar de cada um no evento (fila do avião, beira da fonte, roda da batata…). */
  lugar: Map<string, Ponto>;
  /** Ordem de cada um (para o trenzinho e a distribuição em volta da fonte). */
  ordem: Map<string, number>;
  /** Quem estava longe demais e aparece direto no lugar do evento. */
  brota: Set<string>;
  batata: Batata | null;
  feito: Set<string>;
  fogos: { lanca: number; x: number; z: number; altura: number; cor: number }[];
  raio: Ponto;
}

export function criarShows(THREE: typeof TH, cena: TH.Scene, el: HTMLElement, ligacoes: Ligacoes) {
  const lixo: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(o: T) => {
    lixo.push(o);
    return o;
  };
  const vetor = new THREE.Vector3();
  let atual: Ativo | null = null;
  /** Quem está congelado (batata quente): até quando e onde. */
  const congelados = new Map<
    string,
    { ate: number; x: number; z: number; rumo: number; gelo: TH.Mesh }
  >();

  /* ---------------- clarão (raio) ---------------- */
  const clarao = document.createElement("div");
  clarao.style.cssText =
    "position:absolute;inset:0;pointer-events:none;background:#eef4ff;opacity:0;mix-blend-mode:screen;z-index:2";
  el.appendChild(clarao);

  /* ---------------- partículas (respingos, explosões, fogos, fumaça, confete) ---------------- */
  const MAX = 1800;
  const pPos = new Float32Array(MAX * 3);
  const pCor = new Float32Array(MAX * 3);
  const pVel = new Float32Array(MAX * 3);
  const pBase = new Float32Array(MAX * 3);
  const pVida = new Float32Array(MAX);
  const pVidaMax = new Float32Array(MAX);
  const pGrav = new Float32Array(MAX);
  let pProx = 0;
  let pVivas = 0;
  for (let i = 0; i < MAX; i++) pPos[i * 3 + 1] = -999;
  const gPart = guardar(new THREE.BufferGeometry());
  const aPos = new THREE.BufferAttribute(pPos, 3);
  const aCor = new THREE.BufferAttribute(pCor, 3);
  gPart.setAttribute("position", aPos);
  gPart.setAttribute("color", aCor);
  const mPart = guardar(
    new THREE.PointsMaterial({
      size: 0.26,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  const particulas = new THREE.Points(gPart, mPart);
  particulas.frustumCulled = false;
  cena.add(particulas);
  const cor = new THREE.Color();
  function emitir(
    n: number,
    x: number,
    y: number,
    z: number,
    o: {
      cores: number[];
      vel: number;
      subida?: number;
      grav?: number;
      vida?: [number, number];
      espalho?: number;
    },
    r: () => number = Math.random,
  ) {
    for (let k = 0; k < n; k++) {
      const i = pProx;
      pProx = (pProx + 1) % MAX;
      // direção ao acaso numa esfera
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = o.vel * (0.55 + r() * 0.45);
      const e = o.espalho ?? 0;
      pPos[i * 3] = x + (r() - 0.5) * e;
      pPos[i * 3 + 1] = y + (r() - 0.5) * e;
      pPos[i * 3 + 2] = z + (r() - 0.5) * e;
      pVel[i * 3] = s * Math.cos(a) * v;
      pVel[i * 3 + 1] = u * v + (o.subida ?? 0);
      pVel[i * 3 + 2] = s * Math.sin(a) * v;
      cor.setHex(o.cores[Math.floor(r() * o.cores.length)] ?? 0xffffff);
      pBase[i * 3] = cor.r;
      pBase[i * 3 + 1] = cor.g;
      pBase[i * 3 + 2] = cor.b;
      const [v0, v1] = o.vida ?? [0.8, 1.4];
      pVida[i] = pVidaMax[i] = v0 + r() * (v1 - v0);
      pGrav[i] = o.grav ?? -6;
    }
    pVivas = MAX;
  }
  function moverParticulas(dt: number) {
    if (!pVivas) return;
    let vivas = 0;
    for (let i = 0; i < MAX; i++) {
      if (pVida[i]! <= 0) continue;
      pVida[i] = pVida[i]! - dt;
      if (pVida[i]! <= 0) {
        pPos[i * 3 + 1] = -999;
        pCor[i * 3] = pCor[i * 3 + 1] = pCor[i * 3 + 2] = 0;
        continue;
      }
      vivas++;
      pVel[i * 3 + 1] = pVel[i * 3 + 1]! + pGrav[i]! * dt;
      // um pouco de resistência do ar
      const ar = Math.exp(-dt * 0.9);
      pVel[i * 3] = pVel[i * 3]! * ar;
      pVel[i * 3 + 2] = pVel[i * 3 + 2]! * ar;
      pPos[i * 3] = pPos[i * 3]! + pVel[i * 3]! * dt;
      pPos[i * 3 + 1] = pPos[i * 3 + 1]! + pVel[i * 3 + 1]! * dt;
      pPos[i * 3 + 2] = pPos[i * 3 + 2]! + pVel[i * 3 + 2]! * dt;
      const f = Math.min(1, (pVida[i]! / pVidaMax[i]!) * 1.6);
      pCor[i * 3] = pBase[i * 3]! * f;
      pCor[i * 3 + 1] = pBase[i * 3 + 1]! * f;
      pCor[i * 3 + 2] = pBase[i * 3 + 2]! * f;
    }
    pVivas = vivas;
    aPos.needsUpdate = true;
    aCor.needsUpdate = true;
  }

  /* ---------------- peças ---------------- */
  const caixa = (
    pai: TH.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    corHex: number,
    o: TH.MeshStandardMaterialParameters = {},
  ) => {
    const m = new THREE.Mesh(
      guardar(new THREE.BoxGeometry(w, h, d)),
      guardar(new THREE.MeshStandardMaterial({ color: corHex, roughness: 0.62, ...o })),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    pai.add(m);
    return m;
  };

  // avião (montado na hora, com um assento para cada pessoa)
  let aviao: { g: TH.Group; helice: TH.Group; assentos: TH.Vector3[]; L: number } | null = null;
  function montarAviao(n: number) {
    if (aviao) {
      cena.remove(aviao.g);
      aviao = null;
    }
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const fileiras = Math.max(2, Math.ceil(n / 2));
    const L = Math.max(5.6, fileiras * 0.92 + 3.4);
    const BRANCO = 0xf4f4f2;
    const VERMELHO = 0xd8281f;
    caixa(g, L, 0.62, 1.15, 0, 0.42, 0, BRANCO);
    caixa(g, L + 0.02, 0.12, 1.17, 0, 0.5, 0, VERMELHO);
    caixa(g, 0.72, 0.56, 0.96, L / 2 + 0.32, 0.42, 0, VERMELHO);
    caixa(g, 0.2, 0.2, 0.2, L / 2 + 0.74, 0.42, 0, 0x2b2d32);
    const helice = new THREE.Group();
    helice.position.set(L / 2 + 0.8, 0.42, 0);
    caixa(helice, 0.05, 1.5, 0.14, 0, 0, 0, 0x2b2d32);
    caixa(helice, 0.05, 0.14, 1.5, 0, 0, 0, 0x2b2d32);
    g.add(helice);
    caixa(g, 1.3, 0.1, 4.4, L / 2 - 2.1, 0.3, 0, BRANCO);
    for (const lado of [-1, 1]) caixa(g, 1.3, 0.11, 0.34, L / 2 - 2.1, 0.31, lado * 2.05, VERMELHO);
    caixa(g, 0.9, 0.9, 0.1, -L / 2 + 0.42, 0.95, 0, VERMELHO);
    caixa(g, 0.8, 0.08, 1.8, -L / 2 + 0.42, 0.56, 0, BRANCO);
    // trem de pouso
    for (const lado of [-1, 1]) caixa(g, 0.18, 0.3, 0.18, L / 2 - 2.1, 0.02, lado * 0.9, 0x2b2d32);
    const assentos: TH.Vector3[] = [];
    for (let k = 0; k < n; k++) {
      const sx = L / 2 - 1.55 - Math.floor(k / 2) * 0.92;
      const sz = k % 2 ? 0.3 : -0.3;
      caixa(g, 0.48, 0.1, 0.42, sx, 0.78, sz, 0x7a1714);
      caixa(g, 0.08, 0.34, 0.42, sx - 0.24, 0.95, sz, 0x7a1714);
      assentos.push(new THREE.Vector3(sx, 0.84, sz));
    }
    g.visible = false;
    cena.add(g);
    aviao = { g, helice, assentos, L };
  }
  // onde o avião fica parado: do lado de fora da cerca, no píer de embarque do sudoeste
  // (longe da piscina e da calha do escorregador), de frente para +x
  const PARADO = new THREE.Vector3(AVIAO_PARADO.x, AVIAO_PARADO.y, AVIAO_PARADO.z);
  const CENTRO_VOO = { x: 3, z: -1 };
  const R_VOO = 31;
  const r0 = Math.hypot(PARADO.x - CENTRO_VOO.x, PARADO.z - CENTRO_VOO.z);
  const th0 = Math.atan2(PARADO.z - CENTRO_VOO.z, PARADO.x - CENTRO_VOO.x);
  const V_INI = 8.2;
  const V_FIM = 23.4;
  function pontoDoVoo(u: number) {
    const e = suave(u);
    const th = th0 - Math.PI * 2 * e;
    const r = r0 + (R_VOO - r0) * Math.sin(Math.PI * e);
    return {
      x: CENTRO_VOO.x + Math.cos(th) * r,
      y: PARADO.y + 12 * Math.pow(Math.sin(Math.PI * e), 0.85),
      z: CENTRO_VOO.z + Math.sin(th) * r,
    };
  }
  function posicionarAviao(s: number) {
    if (!aviao) return;
    const g = aviao.g;
    g.visible = s >= 0 && s <= 29;
    if (!g.visible) return;
    let p = { x: PARADO.x, y: PARADO.y, z: PARADO.z };
    let rumo = 0;
    let rolagem = 0;
    let arfagem = 0;
    if (s < 3.5) {
      // chega voando de longe e para ao lado da ilha
      const k = suave(s / 3.5);
      p = { x: PARADO.x - 46 * (1 - k), y: PARADO.y + 9 * (1 - k) * (1 - k), z: PARADO.z };
      arfagem = -0.18 * (1 - k);
    } else if (s >= V_INI && s <= V_FIM) {
      const u = (s - V_INI) / (V_FIM - V_INI);
      p = pontoDoVoo(u);
      const q = pontoDoVoo(Math.min(1, u + 0.004));
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      if (Math.hypot(dx, dz) > 1e-4) rumo = Math.atan2(-dz, dx);
      rolagem = 0.42 * Math.sin(Math.PI * u);
      arfagem = Math.atan2(q.y - p.y, Math.hypot(dx, dz) || 1) * 0.8;
    } else if (s > 25.2) {
      // vai embora depois do desembarque
      const k = (s - 25.2) / 3.8;
      p = { x: PARADO.x + 52 * k * k, y: PARADO.y + 14 * k * k, z: PARADO.z };
      arfagem = 0.2 * Math.min(1, k * 3);
    }
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(rolagem, rumo, arfagem);
    aviao.helice.rotation.x += s > 2.5 && s < 25.4 && s >= 7.6 ? 0.9 : 0.35;
    g.updateMatrixWorld(true);
  }
  function assentoNoMundo(k: number) {
    if (!aviao) return null;
    const a = aviao.assentos[k];
    if (!a) return null;
    vetor.copy(a).applyMatrix4(aviao.g.matrixWorld);
    // o HOKI olha para a frente do avião
    return { x: vetor.x, y: vetor.y, z: vetor.z, rumo: aviao.g.rotation.y + Math.PI / 2 };
  }

  // raio
  let raio: TH.Group | null = null;
  function montarRaio(alvo: Ponto, r: () => number) {
    if (raio) cena.remove(raio);
    const g = new THREE.Group();
    const mNucleo = guardar(new THREE.MeshBasicMaterial({ color: 0xf3f7ff }));
    const mBrilho = guardar(
      new THREE.MeshBasicMaterial({
        color: 0x9bbcff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const pts: TH.Vector3[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const solto = i === 0 || i === n ? 0 : (1 - k) * 2.6;
      pts.push(
        new THREE.Vector3(
          alvo.x + (r() - 0.5) * solto + (1 - k) * 3,
          44 * (1 - k) + 0.1,
          alvo.z + (r() - 0.5) * solto,
        ),
      );
    }
    for (let i = 0; i < n; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = a.distanceTo(b);
      for (const [m, grossura] of [
        [mNucleo, 0.14],
        [mBrilho, 0.7],
      ] as const) {
        const seg = new THREE.Mesh(guardar(new THREE.BoxGeometry(grossura, grossura, len)), m);
        seg.position.copy(a).add(b).multiplyScalar(0.5);
        seg.lookAt(b);
        g.add(seg);
      }
    }
    g.visible = false;
    cena.add(g);
    raio = g;
  }

  // batata
  const batata = new THREE.Mesh(
    guardar(new THREE.SphereGeometry(0.2, 14, 10)),
    guardar(
      new THREE.MeshStandardMaterial({
        color: 0xb07a3a,
        roughness: 0.8,
        emissive: 0xff2200,
        emissiveIntensity: 0,
      }),
    ),
  );
  batata.scale.set(1.25, 0.95, 0.95);
  batata.visible = false;
  cena.add(batata);
  const mBatata = batata.material as TH.MeshStandardMaterial;

  // gelo de quem explodiu
  const gGelo = guardar(new THREE.BoxGeometry(0.82, 1.08, 0.82));
  const mGelo = guardar(
    new THREE.MeshStandardMaterial({
      color: 0xc9efff,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
      emissive: 0x4fb6ff,
      emissiveIntensity: 0.25,
    }),
  );

  // globo de luz do baile, em cima da fonte
  let globo: { g: TH.Group; feixes: TH.Mesh[] } | null = null;
  function montarGlobo() {
    if (globo) return globo;
    const g = new THREE.Group();
    g.position.set(FONTE.x, 5.4, FONTE.z);
    const bola = new THREE.Mesh(
      guardar(new THREE.IcosahedronGeometry(0.62, 1)),
      guardar(
        new THREE.MeshStandardMaterial({
          color: 0xeef1f6,
          metalness: 0.25,
          roughness: 0.3,
          flatShading: true,
          emissive: 0x9aa3b5,
          emissiveIntensity: 0.75,
        }),
      ),
    );
    g.add(bola);
    caixa(g, 0.04, 2.6, 0.04, 0, 1.6, 0, 0x2b2d32);
    const feixes: TH.Mesh[] = [];
    const CORES = [0xff3b6b, 0x4fd1ff, 0xffe14f, 0x8b5cf6, 0x34d399, 0xff8a3d];
    CORES.forEach((c, i) => {
      const cone = new THREE.Mesh(
        guardar(new THREE.ConeGeometry(1.1, 6.2, 16, 1, true)),
        guardar(
          new THREE.MeshBasicMaterial({
            color: c,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
      // o cone aponta para baixo, saindo do globo
      cone.geometry.translate(0, -3.1, 0);
      cone.rotation.z = 0.62;
      const braco = new THREE.Group();
      braco.rotation.y = (i / CORES.length) * Math.PI * 2;
      braco.add(cone);
      g.add(braco);
      feixes.push(cone);
    });
    g.visible = false;
    cena.add(g);
    globo = { g, feixes };
    return globo;
  }

  /* ---------------- começo de cada evento ---------------- */
  function preparar(a: Ativo) {
    a.preparado = true;
    const r = sorteio(a.show.semente);
    a.ids = a.show.ids.filter((id) => ligacoes.posicao(id) && !congelados.has(id));
    a.ids.forEach((id, i) => {
      const p = ligacoes.posicao(id)!;
      a.de.set(id, p);
      a.ordem.set(id, i);
    });
    const n = a.ids.length;
    const emVolta = (raio: number, i: number, total: number, inicio = Math.PI / 2) => {
      const ang = inicio + (i / Math.max(1, total)) * Math.PI * 2;
      return { x: FONTE.x + Math.cos(ang) * raio, z: FONTE.z + Math.sin(ang) * raio };
    };
    const tempo = CHEGADA_S[a.show.tipo] ?? 0;
    const ir = (id: string, alvo: Ponto) => {
      const destino = ajustar(alvo) ?? alvo;
      a.lugar.set(id, destino);
      const de = a.de.get(id)!;
      const rota = montarRota({ x: de.x, z: de.z }, destino);
      a.rotas.set(id, rota);
      // longe demais para chegar andando a tempo: brota direto lá
      if (rota.total > VEL_ANDAR * tempo * 0.95) a.brota.add(id);
    };
    switch (a.show.tipo) {
      case "trovao":
        a.raio = { x: FONTE.x + (r() - 0.5) * 9, z: FONTE.z + 2 + (r() - 0.5) * 6 };
        montarRaio(a.raio, r);
        break;
      case "aviao": {
        montarAviao(n);
        // fila no gramado do embarque: a primeira na beira do píer, as outras para dentro da ilha
        const colunas = Math.min(Math.max(n, 1), 8);
        a.ids.forEach((id, i) =>
          ir(id, {
            x: EMBARQUE.x - ((colunas - 1) / 2) * 0.9 + (i % colunas) * 0.9,
            z: EMBARQUE.z - Math.floor(i / colunas) * 0.75,
          }),
        );
        break;
      }
      case "mergulho":
        a.ids.forEach((id, i) => ir(id, emVolta(5.05, i, n)));
        break;
      case "batata":
        a.batata = gerarBatata(a.show.ids, a.show.semente);
        a.show.ids.forEach((id, i) => {
          if (a.de.has(id)) ir(id, emVolta(6.1, i, a.show.ids.length));
        });
        break;
      case "trenzinho": {
        // quem mandou vai na frente
        const ordem = [...a.ids].sort((x, y) => (x === a.show.de ? -1 : y === a.show.de ? 1 : 0));
        ordem.forEach((id, k) => {
          a.ordem.set(id, k);
          const ang = Math.PI / 2 + k * (0.95 / 6.4);
          ir(id, { x: FONTE.x + Math.cos(ang) * 6.4, z: FONTE.z + Math.sin(ang) * 6.4 });
        });
        break;
      }
      case "baile": {
        const dentroDaRoda = Math.min(n, 12);
        a.ids.forEach((id, i) =>
          ir(
            id,
            i < 12
              ? emVolta(5.2, i, dentroDaRoda)
              : emVolta(6.9, i - 12, n - 12, Math.PI / 2 + 0.26),
          ),
        );
        montarGlobo();
        break;
      }
      case "fogos":
        for (let i = 0; i < 15; i++)
          a.fogos.push({
            lanca: 0.4 + i * 0.72 + r() * 0.4,
            x: FONTE.x + (r() - 0.5) * 18,
            z: FONTE.z - 2 + (r() - 0.5) * 14,
            altura: 9 + r() * 5,
            cor: [0xff4d6d, 0x4fd1ff, 0xffe14f, 0x9d7bff, 0x4ade80, 0xff9f43, 0xffffff][
              Math.floor(r() * 7)
            ]!,
          });
        break;
      case "gigantes":
        break;
    }
  }

  /** Dispara uma coisa só uma vez por evento (som, recado, explosão). */
  const umaVez = (a: Ativo, chave: string, f: () => void) => {
    if (a.feito.has(chave)) return;
    a.feito.add(chave);
    f();
  };

  /* ---------------- a cada quadro ---------------- */
  function quadro(agora: number, dt: number) {
    moverParticulas(dt);
    // gelo: acompanha quem está congelado e some quando acaba
    for (const [id, c] of congelados) {
      if (agora >= c.ate) {
        cena.remove(c.gelo);
        congelados.delete(id);
        emitir(26, c.x, 0.6, c.z, {
          cores: [0xc9efff, 0xffffff],
          vel: 2.6,
          subida: 1.5,
          vida: [0.4, 0.8],
        });
        continue;
      }
      c.gelo.position.set(c.x, 0.54, c.z);
      c.gelo.rotation.y = c.rumo;
    }

    const a = atual;
    if (!a) {
      clarao.style.opacity = "0";
      return;
    }
    const s = (agora - a.inicio) / 1000;
    if (s < 0) return;
    if (!a.preparado) preparar(a);
    // quem estava longe some numa nuvenzinha e brota no lugar do evento
    if (a.brota.size)
      umaVez(a, "brota", () => {
        for (const id of a.brota) {
          const de = a.de.get(id);
          const l = a.lugar.get(id);
          const nuvem = {
            cores: [0xffffff, 0xe6ebf2, 0xffe9a8],
            vel: 1.7,
            subida: 1.3,
            grav: -1.1,
          };
          if (de) emitir(26, de.x, de.y + 0.5, de.z, { ...nuvem, vida: [0.5, 1], espalho: 0.5 });
          if (l)
            emitir(34, l.x, alturaDoChao(l.x, l.z) + 0.5, l.z, {
              ...nuvem,
              vida: [0.6, 1.2],
              espalho: 0.6,
            });
        }
        playSfx("pop");
      });
    const fimDasPecas = a.show.tipo === "aviao" ? 29.5 : a.dura + 2.5;
    if (s > fimDasPecas) {
      encerrarPecas();
      atual = null;
      return;
    }
    const r = Math.random;

    switch (a.show.tipo) {
      case "trovao": {
        umaVez(a, "som", () => playSfx("trovao"));
        umaVez(a, "susto", () => a.ids.forEach((id) => ligacoes.truque(id, "pulinhos")));
        const piscadas: [number, number][] = [
          [0.4, 0.62],
          [0.78, 0.9],
          [1.05, 1.12],
        ];
        const aceso = piscadas.some(([x, y]) => s >= x && s < y);
        if (raio) raio.visible = aceso;
        const k =
          s < 0.4 ? 0 : s < 0.5 ? 0.88 : s < 0.62 ? 0.25 : s < 0.78 ? 0.05 : s < 0.86 ? 0.6 : 0;
        clarao.style.opacity = String(Math.max(0, k - Math.max(0, s - 1.2) * 0.4));
        umaVez(a, "faiscas", () =>
          emitir(90, a.raio.x, 0.3, a.raio.z, {
            cores: [0xffffff, 0xbfd6ff, 0xffe9a8],
            vel: 7,
            subida: 3,
            grav: -9,
            vida: [0.4, 1],
          }),
        );
        break;
      }
      case "aviao": {
        posicionarAviao(s);
        umaVez(a, "chega", () => playSfx("aviao"));
        if (s > V_INI - 0.4) umaVez(a, "decola", () => playSfx("aviao"));
        if (s > 25.2) umaVez(a, "parte", () => playSfx("aviao"));
        break;
      }
      case "mergulho": {
        if (s > 6.1) umaVez(a, "tchibum", () => playSfx("splash"));
        if (s > 9.4) umaVez(a, "sai", () => playSfx("splash"));
        for (const id of a.ids) {
          const l = a.lugar.get(id);
          if (!l) continue;
          const ang = Math.atan2(l.z - FONTE.z, l.x - FONTE.x);
          const ax = FONTE.x + Math.cos(ang) * 1.9;
          const az = FONTE.z + Math.sin(ang) * 1.9;
          if (s > 6.1)
            umaVez(a, `entra-${id}`, () =>
              emitir(34, ax, 0.55, az, {
                cores: [0xd8f3ff, 0xffffff, 0x8fd3ff],
                vel: 2.4,
                subida: 3.2,
                grav: -9,
                vida: [0.5, 0.9],
              }),
            );
          if (s > 9.4)
            umaVez(a, `sai-${id}`, () =>
              emitir(22, ax, 0.55, az, {
                cores: [0xd8f3ff, 0xffffff],
                vel: 2,
                subida: 2.6,
                grav: -9,
                vida: [0.4, 0.8],
              }),
            );
        }
        break;
      }
      case "batata":
        animarBatata(a, s, agora);
        break;
      case "trenzinho": {
        if (s > 4) umaVez(a, "apito", () => playSfx("apito"));
        if (s > 11) umaVez(a, "apito2", () => playSfx("apito"));
        const lider = [...a.ordem].find(([, k]) => k === 0)?.[0];
        const p = lider ? ligacoes.posicao(lider) : null;
        if (p && s > 4 && s < 17.5 && r() < dt * 5)
          emitir(3, p.x, p.y + 1.3, p.z, {
            cores: [0x8a8a8a, 0xbdbdbd],
            vel: 0.4,
            subida: 1.6,
            grav: 0.4,
            vida: [0.9, 1.5],
          });
        break;
      }
      case "baile": {
        if (s > 4) umaVez(a, "musica", () => playSfx("vitoria"));
        if (globo) {
          const k = suave(entre(s, 3, 4.2)) * (1 - suave(entre(s, a.dura - 0.6, a.dura + 0.4)));
          globo.g.visible = k > 0.01;
          globo.g.scale.setScalar(Math.max(0.01, k));
          globo.g.rotation.y += dt * 1.6;
          globo.feixes.forEach((f, i) => {
            (f.material as TH.MeshBasicMaterial).opacity =
              0.1 + 0.1 * Math.sin(agora / 180 + i * 1.7);
          });
          if (s > 4 && s < a.dura && r() < dt * 1.2)
            emitir(40, FONTE.x + (r() - 0.5) * 6, 5.5, FONTE.z + (r() - 0.5) * 6, {
              cores: [0xff3b6b, 0x4fd1ff, 0xffe14f, 0x8b5cf6, 0x34d399],
              vel: 1.4,
              subida: 0.5,
              grav: -1.4,
              vida: [1.6, 2.6],
              espalho: 2,
            });
        }
        break;
      }
      case "fogos":
        for (const [i, f] of a.fogos.entries()) {
          const subida = 0.62;
          if (s < f.lanca || s > f.lanca + subida + 2.5) continue;
          umaVez(a, `som-${i}`, () => playSfx("fogos"));
          if (s < f.lanca + subida) {
            // rastro do foguete subindo
            const k = (s - f.lanca) / subida;
            emitir(2, f.x, 0.5 + f.altura * k, f.z, {
              cores: [0xfff1c9],
              vel: 0.3,
              grav: -1,
              vida: [0.25, 0.45],
            });
          } else
            umaVez(a, `estoura-${i}`, () =>
              emitir(110, f.x, f.altura + 0.5, f.z, {
                cores: [f.cor, f.cor, 0xffffff],
                vel: 5.2,
                grav: -3.2,
                vida: [1.3, 2.1],
              }),
            );
        }
        break;
      case "gigantes":
        umaVez(a, "som", () => playSfx("explosao"));
        break;
    }
  }

  function animarBatata(a: Ativo, s: number, agora: number) {
    const b = a.batata;
    if (!b) return;
    const mao = (id: string) => {
      const l = a.lugar.get(id);
      return l ? { x: l.x, y: 0.95, z: l.z } : null;
    };
    const estado = batataEm(b, s);
    batata.visible = false;
    if (estado) {
      if ("voo" in estado && estado.voo) {
        const de = mao(estado.voo.de);
        const para = mao(estado.voo.para);
        if (de && para) {
          const p = pulo(de, para, estado.voo.k, 3.2);
          batata.position.set(p.x, p.y, p.z);
          batata.rotation.x += 0.4;
          batata.visible = true;
        }
      } else if ("com" in estado && estado.com) {
        const p = mao(estado.com);
        if (p) {
          batata.position.set(p.x, p.y + 0.3 + Math.abs(Math.sin(agora / 110)) * 0.12, p.z);
          batata.visible = true;
        }
      }
      // quanto menos falta para estourar, mais vermelha e mais rápido ela pisca
      const falta = Math.max(0, estado.rodada.explode - s);
      const ritmo = falta < 1.5 ? 70 : falta < 3 ? 140 : 260;
      mBatata.emissiveIntensity =
        (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(agora / ritmo))) * (falta < 3 ? 1.4 : 0.6);
    }
    // sons dos passes, explosões, congelamento e o vencedor
    b.rodadas.forEach((rod, ri) => {
      rod.passes.forEach((p, pi) => {
        if (s >= p.t && s < p.t + 0.5) umaVez(a, `tique-${ri}-${pi}`, () => playSfx("tique"));
      });
      if (s >= rod.explode) {
        umaVez(a, `explode-${ri}`, () => {
          const l = a.lugar.get(rod.eliminado);
          if (l) {
            emitir(120, l.x, 1, l.z, {
              cores: [0xff6a00, 0xffd23f, 0xff2d2d, 0x5a3a1a],
              vel: 5,
              subida: 2,
              grav: -7,
              vida: [0.5, 1.2],
            });
            congelar(rod.eliminado, l, a.inicio + rod.explode * 1000);
          }
          playSfx("explosao");
          setTimeout(() => playSfx("gelo"), 380);
          ligacoes.aviso(
            `💥 ${ligacoes.nome(rod.eliminado)} explodiu com a batata e congelou por ${CONGELA_S} s!`,
          );
        });
      }
    });
    const ultima = b.rodadas[b.rodadas.length - 1];
    if (b.vencedor && ultima && s > ultima.explode + 0.6)
      umaVez(a, "vencedor", () => {
        const l = a.lugar.get(b.vencedor!);
        if (l)
          emitir(140, l.x, 1.6, l.z, {
            cores: [0xffe14f, 0xff4d6d, 0x4fd1ff, 0x4ade80, 0xffffff],
            vel: 4,
            subida: 3,
            grav: -4,
            vida: [1.2, 2],
          });
        playSfx("vitoria");
        ligacoes.aviso(`🏆 ${ligacoes.nome(b.vencedor!)} venceu a batata quente!`);
      });
  }

  function congelar(id: string, l: Ponto, quando: number) {
    const velho = congelados.get(id);
    if (velho) cena.remove(velho.gelo);
    const gelo = new THREE.Mesh(gGelo, mGelo);
    gelo.castShadow = true;
    cena.add(gelo);
    congelados.set(id, {
      ate: quando + CONGELA_S * 1000,
      x: l.x,
      z: l.z,
      rumo: olharPara(l, FONTE),
      gelo,
    });
  }

  function encerrarPecas() {
    if (aviao) aviao.g.visible = false;
    if (raio) raio.visible = false;
    if (globo) globo.g.visible = false;
    batata.visible = false;
    clarao.style.opacity = "0";
  }

  /* ---------------- pose de cada HOKI ---------------- */
  function pose(id: string, agora: number): PoseShow | null {
    const c = congelados.get(id);
    if (c && agora < c.ate)
      return { x: c.x, y: 0, z: c.z, rumo: c.rumo, congelado: true, sombra: true };
    const a = atual;
    if (!a || !a.preparado) return null;
    const s = (agora - a.inicio) / 1000;
    if (s < 0 || s > a.dura || !a.de.has(id)) return null;
    const de = a.de.get(id)!;
    const rota = a.rotas.get(id);
    const lugar = a.lugar.get(id);
    const brotou = a.brota.has(id);
    /** Altura do chão num ponto (a escadaria e a ilha da HOST FAZENDAS ficam no alto). */
    const chaoEm = (p: Ponto) => alturaDoChao(p.x, p.z);
    const andar = (ate: number): PoseShow & { chegou: boolean } => {
      // quem estava longe já está no lugar do evento, olhando para o meio da praça
      if (brotou && lugar)
        return {
          x: lugar.x,
          y: chaoEm(lugar),
          z: lugar.z,
          rumo: olharPara(lugar, a.show.tipo === "aviao" ? PARADO : FONTE),
          chegou: true,
          sombra: true,
        };
      if (!rota) return { x: de.x, y: chaoEm(de), z: de.z, rumo: 0, chegou: true, sombra: true };
      const p = naRota(rota, s * VEL_ANDAR);
      const esticado = !p.chegou && s >= ate;
      return {
        x: p.x,
        y: chaoEm(p),
        z: p.z,
        rumo: p.rumo,
        andando: !p.chegou && !esticado,
        chegou: p.chegou,
        sombra: true,
      };
    };
    switch (a.show.tipo) {
      case "trovao":
      case "gigantes":
        return null;
      case "fogos":
        return {
          x: de.x,
          y: de.y,
          z: de.z,
          rumo: olharPara(de, FONTE),
          reacao: "festa",
          p: s % 1.6,
          sombra: de.y < 0.05,
        };
      case "aviao": {
        const k = a.ordem.get(id) ?? 0;
        if (s < 6.5) return andar(6.5);
        if (!lugar) return null;
        const chao = { x: lugar.x, y: chaoEm(lugar), z: lugar.z };
        if (s < 7.6) {
          const assento = assentoNoMundo(k);
          const ultimo = brotou ? lugar : rota ? naRota(rota, 6.5 * VEL_ANDAR) : de;
          const saida = { x: ultimo.x, y: chaoEm(ultimo), z: ultimo.z };
          if (!assento) return null;
          const p = pulo(saida, assento, entre(s, 6.5, 7.6), 1.6);
          return { ...p, rumo: assento.rumo };
        }
        if (s < 23.8) {
          const assento = assentoNoMundo(k);
          if (!assento) return null;
          return {
            ...assento,
            sentado: true,
            reacao: s > V_INI + 2 && s < V_FIM - 1.5 && k % 3 === 0 ? "acenar" : null,
            p: (s - V_INI) % 2,
          };
        }
        if (s < 24.9) {
          const assento = assentoNoMundo(k) ?? { ...chao, rumo: 0 };
          const p = pulo(assento, chao, entre(s, 23.8, 24.9), 1.4);
          return { ...p, rumo: olharPara(PARADO, chao) };
        }
        return { ...chao, rumo: Math.PI, reacao: "festa", p: (s - 24.9) % 1.6, sombra: true };
      }
      case "mergulho": {
        if (s < 5) return andar(5);
        if (!lugar) return null;
        const ang = Math.atan2(lugar.z - FONTE.z, lugar.x - FONTE.x);
        const borda = { x: lugar.x, y: chaoEm(lugar), z: lugar.z };
        const agua = {
          x: FONTE.x + Math.cos(ang) * 1.9,
          y: 0.12,
          z: FONTE.z + Math.sin(ang) * 1.9,
        };
        const paraDentro = olharPara(borda, FONTE);
        if (s < 6.1) return { ...pulo(borda, agua, entre(s, 5, 6.1), 2.4), rumo: paraDentro };
        if (s < 9.4)
          return {
            x: agua.x,
            y: 0.1 + Math.sin(s * 3 + ang) * 0.05,
            z: agua.z,
            rumo: paraDentro + Math.sin(s * 1.3) * 0.6,
          };
        if (s < 10.5)
          return { ...pulo(agua, borda, entre(s, 9.4, 10.5), 2), rumo: paraDentro + Math.PI };
        return {
          ...borda,
          rumo: paraDentro + Math.PI,
          reacao: "girar",
          p: (s - 10.5) % 1,
          sombra: true,
        };
      }
      case "batata": {
        if (s < 4) return andar(4);
        if (!lugar) return null;
        const est = a.batata ? batataEm(a.batata, s) : null;
        const comEle = !!est && "com" in est && est.com === id;
        const venceu =
          a.batata?.vencedor === id && s > (a.batata.rodadas.at(-1)?.explode ?? 0) + 0.6;
        return {
          x: lugar.x,
          y: chaoEm(lugar),
          z: lugar.z,
          rumo: olharPara(lugar, FONTE),
          reacao: comEle ? "pulinhos" : venceu ? "festa" : null,
          p: (s * 1.3) % 2.6,
          sombra: true,
        };
      }
      case "trenzinho": {
        if (s < 4) return andar(4);
        const k = a.ordem.get(id) ?? 0;
        const raioT = 6.4;
        const w = 2.5 / raioT;
        const ang = Math.PI / 2 + k * (0.95 / raioT) - w * Math.min(s - 4, 13.5);
        const x = FONTE.x + Math.cos(ang) * raioT;
        const z = FONTE.z + Math.sin(ang) * raioT;
        const rumo = Math.atan2(Math.sin(ang), -Math.cos(ang));
        if (s >= 17.5)
          return { x, y: 0, z, rumo, reacao: "festa", p: (s - 17.5) % 1.6, sombra: true };
        return {
          x,
          y: 0,
          z,
          rumo,
          andando: true,
          reacao: k === 0 ? "acenar" : null,
          p: (s - 4) % 2,
          sombra: true,
        };
      }
      case "baile": {
        if (s < 4) return andar(4);
        if (!lugar) return null;
        const k = a.ordem.get(id) ?? 0;
        const danca: Reacao = k % 3 === 0 ? "disco" : k % 3 === 1 ? "dancinha" : "rebolar";
        const dura = danca === "disco" ? 3.8 : danca === "dancinha" ? 4 : 3.6;
        return {
          x: lugar.x,
          y: chaoEm(lugar),
          z: lugar.z,
          rumo: olharPara(lugar, FONTE) + Math.sin(s * 0.8 + k) * 0.4,
          reacao: danca,
          p: (s - 4) % dura,
          sombra: true,
        };
      }
    }
  }

  /** Tamanho do HOKI (no "gigantes" todo mundo cresce). */
  function escala(id: string, agora: number) {
    const a = atual;
    if (!a || a.show.tipo !== "gigantes" || !a.de.has(id)) return 1;
    const s = (agora - a.inicio) / 1000;
    if (s < 0 || s > a.dura) return 1;
    return 1 + 1.6 * suave(entre(s, 0, 1.1)) * (1 - suave(entre(s, a.dura - 1.1, a.dura)));
  }

  /** Força do tremor da tela agora (raio, explosões da batata e o pisão dos gigantes). */
  function tremor(agora: number) {
    const a = atual;
    if (!a) return 0;
    const s = (agora - a.inicio) / 1000;
    if (a.show.tipo === "trovao" && s >= 0.4 && s < 5.4)
      return 0.42 * Math.pow(1 - (s - 0.4) / 5, 1.2);
    if (a.show.tipo === "gigantes" && s >= 0 && s < 1.2) return 0.18 * (1 - s / 1.2);
    if (a.show.tipo === "batata" && a.batata)
      for (const rod of a.batata.rodadas) {
        const d = s - rod.explode;
        if (d >= 0 && d < 0.45) return 0.2 * (1 - d / 0.45);
      }
    return 0;
  }

  return {
    /** Começa um evento daqui a `atrasoMs` (todos recebem e começam juntos). */
    iniciar(show: Show, atrasoMs: number) {
      if (atual) encerrarPecas();
      atual = {
        show,
        inicio: performance.now() + Math.max(0, atrasoMs),
        dura: duracaoDoShow(show),
        preparado: false,
        ids: [],
        de: new Map(),
        rotas: new Map(),
        lugar: new Map(),
        ordem: new Map(),
        brota: new Set(),
        batata: null,
        feito: new Set(),
        fogos: [],
        raio: { x: FONTE.x, z: FONTE.z },
      };
    },
    quadro,
    pose,
    escala,
    tremor,
    /** A pessoa está presa num evento (não dá para andar até acabar). */
    ocupado(id: string, agora: number) {
      const c = congelados.get(id);
      if (c && agora < c.ate)
        return `Você está congelado! Faltam ${Math.ceil((c.ate - agora) / 1000)} s.`;
      const a = atual;
      if (!a || !a.preparado || !a.de.has(id)) return "";
      const s = (agora - a.inicio) / 1000;
      if (s < 0 || s > a.dura || a.show.tipo === "trovao" || a.show.tipo === "gigantes") return "";
      return "Você está num evento da praça. Espere ele acabar.";
    },
    /** Há um evento rodando agora? */
    rodando(agora: number) {
      return !!atual && (agora - atual.inicio) / 1000 <= atual.dura;
    },
    descartar() {
      encerrarPecas();
      for (const c of congelados.values()) cena.remove(c.gelo);
      congelados.clear();
      if (aviao) cena.remove(aviao.g);
      if (raio) cena.remove(raio);
      if (globo) cena.remove(globo.g);
      cena.remove(batata, particulas);
      clarao.remove();
      lixo.forEach((o) => o.dispose());
    },
  };
}
