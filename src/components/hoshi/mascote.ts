/**
 * HOSHI feito do zero: um filhote de spitz em pé, montado com formas simples e
 * com cada parte do corpo em seu próprio "osso" (cabeça, orelhas, braços,
 * pernas, rabo). Por isso ele consegue andar, acenar, comer, dançar e vestir
 * roupas e acessórios que acompanham o movimento.
 */
import type * as TH from "three";
import type { Humor, Visual } from "@/lib/hoshi";

export type Reacao =
  | "comer" | "beber" | "carinho" | "dormir" | "festa"
  | "acenar" | "girar" | "rolar" | "dancar" | "correr" | "mortal" | "cumprimentar";

export interface Quadro {
  t: number;
  humor: Humor;
  reacao: Reacao | null;
  /** segundos desde que a reação começou */
  p: number;
  mouse: { x: number; y: number };
  calmo: boolean;
}

const ROUPA: Record<string, { cor: number; brilho?: number }> = {
  host: { cor: 0xce0e0e },
  preto: { cor: 0x161616 },
  grafite: { cor: 0x4a4a4a },
  neve: { cor: 0xf2f2f2 },
  ouro: { cor: 0xe0ad3a },
  lenda: { cor: 0x1a0505, brilho: 0xff2a1a },
};

export function criarMascote(THREE: typeof TH, visual: Visual) {
  const lixo: { dispose: () => void }[] = [];
  const mat = (cor: number, o: TH.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, ...o });
    lixo.push(m);
    return m;
  };
  const esfera = new THREE.SphereGeometry(1, 28, 20);
  lixo.push(esfera);
  const geo = <G extends TH.BufferGeometry>(g: G) => {
    lixo.push(g);
    return g;
  };
  const bola = (pai: TH.Object3D, m: TH.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(esfera, m);
    o.position.set(x, y, z);
    o.scale.set(r * sx, r * sy, r * sz);
    pai.add(o);
    return o;
  };
  const peca = (pai: TH.Object3D, g: TH.BufferGeometry, m: TH.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(geo(g), m);
    o.position.set(x, y, z);
    pai.add(o);
    return o;
  };
  const grupo = (pai: TH.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    pai.add(g);
    return g;
  };

  const pelo = mat(0xfff8f0);
  const peloSombra = mat(0xf1e4d6);
  const preto = mat(0x120b0b, { roughness: 0.3 });
  const rosa = mat(0xf2a3a8);
  const lingua = mat(0xe5484d, { roughness: 0.6 });
  const ouro = mat(0xf2c14e, { roughness: 0.28, metalness: 0.8 });
  const vermelho = mat(0xce0e0e, { roughness: 0.6 });
  const branco = mat(0xf4f4f4);
  const estilo = ROUPA[visual.roupa] ?? { cor: 0xce0e0e };
  const tecido = mat(estilo.cor, estilo.brilho ? { emissive: estilo.brilho, emissiveIntensity: 0.25, roughness: 0.5 } : { roughness: 0.75 });

  const raiz = new THREE.Group();
  const corpo = grupo(raiz, 0, 0.08, 0);

  // ---- tronco e roupa ----
  const tronco = bola(corpo, pelo, 0.46, 0, 0.78, 0, 1, 1.05, 0.9);
  bola(corpo, tecido, 0.478, 0, 0.77, 0, 1.02, 0.9, 0.93);
  bola(corpo, pelo, 0.2, 0, 1.03, 0.29, 1.15, 0.85, 0.8);
  if (estilo.brilho) {
    const faixa = peca(corpo, new THREE.TorusGeometry(0.47, 0.022, 8, 40), mat(estilo.brilho, { emissive: estilo.brilho, emissiveIntensity: 1.6 }), 0, 0.62, 0);
    faixa.rotation.x = Math.PI / 2;
    faixa.scale.set(1.02, 0.93, 1);
  }

  // ---- pernas ----
  const perna = (lado: number) => {
    const g = grupo(corpo, lado * 0.2, 0.42, 0);
    peca(g, new THREE.CapsuleGeometry(0.13, 0.2, 6, 12), pelo, 0, -0.2, 0);
    bola(g, pelo, 0.16, 0, -0.38, 0.06, 1, 0.7, 1.3);
    return g;
  };
  const pernaE = perna(-1);
  const pernaD = perna(1);

  // ---- braços (manga da roupa + pata) ----
  const braco = (lado: number) => {
    const g = grupo(corpo, lado * 0.43, 0.98, 0.02);
    peca(g, new THREE.CapsuleGeometry(0.115, 0.14, 6, 12), tecido, 0, -0.13, 0);
    bola(g, pelo, 0.135, 0, -0.32, 0);
    return g;
  };
  const bracoE = braco(-1);
  const bracoD = braco(1);

  // ---- rabo ----
  const rabo = grupo(corpo, 0, 0.6, -0.4);
  [0.23, 0.21, 0.18, 0.14].forEach((r, i) => bola(rabo, i % 2 ? peloSombra : pelo, r, 0, i * 0.19, -0.06 - Math.sin(i * 0.8) * 0.1));

  // ---- cabeça ----
  const cabeca = grupo(corpo, 0, 1.2, 0.02);
  bola(cabeca, pelo, 0.46, 0, 0.36, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    bola(cabeca, pelo, 0.27, Math.cos(a) * 0.31, 0.34 + Math.sin(a) * 0.3, -0.15);
  }
  bola(cabeca, peloSombra, 0.46, 0, 0.33, -0.2);
  bola(cabeca, pelo, 0.22, -0.24, 0.22, 0.26);
  bola(cabeca, pelo, 0.22, 0.24, 0.22, 0.26);
  bola(cabeca, pelo, 0.17, 0, 0.26, 0.4, 1.1, 0.85, 1);
  bola(cabeca, preto, 0.055, 0, 0.32, 0.56, 1.2, 0.85, 0.8);
  const boca = bola(cabeca, lingua, 0.08, 0, 0.17, 0.48, 1, 0.7, 0.9);
  const brilhoOlho = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lixo.push(brilhoOlho);
  const olhos = [-0.16, 0.16].map((x) => {
    const o = bola(cabeca, preto, 0.062, x, 0.44, 0.4);
    bola(o, brilhoOlho, 0.3, 0.3, 0.35, 0.8);
    return o;
  });
  const orelhas = [-1, 1].map((lado) => {
    const g = grupo(cabeca, lado * 0.27, 0.7, 0.02);
    peca(g, new THREE.ConeGeometry(0.16, 0.32, 16), pelo, 0, 0.1, 0);
    peca(g, new THREE.ConeGeometry(0.085, 0.2, 16), rosa, 0, 0.08, 0.07);
    return g;
  });

  // =================== cosméticos ===================
  // chapéu (acompanha a cabeça)
  if (visual.chapeu === "bone") {
    peca(cabeca, new THREE.SphereGeometry(0.47, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), vermelho, 0, 0.42, 0.0);
    const aba = peca(cabeca, new THREE.CylinderGeometry(0.34, 0.34, 0.035, 24), vermelho, 0, 0.47, 0.42);
    aba.scale.set(1, 1, 0.75);
    bola(cabeca, branco, 0.045, 0, 0.9, 0);
  } else if (visual.chapeu === "festa") {
    peca(cabeca, new THREE.ConeGeometry(0.2, 0.55, 20), vermelho, 0, 1.02, 0);
    bola(cabeca, branco, 0.07, 0, 1.32, 0);
    peca(cabeca, new THREE.TorusGeometry(0.19, 0.03, 8, 24), branco, 0, 0.77, 0).rotation.x = Math.PI / 2;
  } else if (visual.chapeu === "cartola") {
    peca(cabeca, new THREE.CylinderGeometry(0.25, 0.25, 0.42, 24), preto, 0, 1.0, 0);
    peca(cabeca, new THREE.CylinderGeometry(0.42, 0.42, 0.035, 28), preto, 0, 0.79, 0);
    peca(cabeca, new THREE.CylinderGeometry(0.256, 0.256, 0.08, 24), vermelho, 0, 0.85, 0);
  } else if (visual.chapeu === "coroa") {
    const aro = peca(cabeca, new THREE.CylinderGeometry(0.29, 0.25, 0.18, 24, 1, true), ouro, 0, 0.86, 0);
    (aro.material as TH.MeshStandardMaterial).side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      peca(cabeca, new THREE.ConeGeometry(0.055, 0.15, 8), ouro, Math.cos(a) * 0.275, 1.02, Math.sin(a) * 0.275);
    }
    bola(cabeca, vermelho, 0.045, 0, 0.87, 0.28);
  }
  // com chapéu as orelhas ficam mais abertas, para os lados
  const orelhaBase = visual.chapeu === "nenhum" ? 0.28 : 0.85;

  // óculos
  if (visual.oculos !== "nenhum") {
    const visor = visual.oculos === "visor";
    const lente = visor ? mat(0xff2a2a, { emissive: 0xff1a1a, emissiveIntensity: 1.4, roughness: 0.2 }) : preto;
    if (visor) {
      const faixa = bola(cabeca, lente, 0.3, 0, 0.44, 0.42, 1, 0.3, 0.32);
      faixa.name = "visor";
    } else {
      for (const lado of [-1, 1]) bola(cabeca, lente, 0.115, lado * 0.16, 0.44, 0.43, 1, 0.8, 0.35);
      peca(cabeca, new THREE.BoxGeometry(0.12, 0.025, 0.025), preto, 0, 0.46, 0.46);
    }
    olhos.forEach((o) => (o.visible = false));
  }

  // pescoço
  if (visual.pescoco === "colar") {
    const colar = peca(corpo, new THREE.TorusGeometry(0.31, 0.03, 10, 40), ouro, 0, 1.19, 0.03);
    colar.rotation.x = Math.PI / 2 - 0.22;
    peca(corpo, new THREE.OctahedronGeometry(0.075), ouro, 0, 1.08, 0.36).name = "estrela";
  } else if (visual.pescoco === "cachecol") {
    peca(corpo, new THREE.TorusGeometry(0.31, 0.1, 12, 30), vermelho, 0, 1.2, 0.02).rotation.x = Math.PI / 2;
    peca(corpo, new THREE.BoxGeometry(0.15, 0.4, 0.06), vermelho, 0.16, 0.98, 0.38).rotation.z = -0.12;
  } else if (visual.pescoco === "gravata") {
    for (const lado of [-1, 1]) {
      const asa = peca(corpo, new THREE.ConeGeometry(0.1, 0.19, 12), vermelho, lado * 0.105, 1.12, 0.4);
      asa.rotation.z = lado * (Math.PI / 2);
      asa.scale.z = 0.5;
    }
    bola(corpo, preto, 0.05, 0, 1.12, 0.41);
  }

  // capa (presa nos ombros, balança)
  let capa: TH.Mesh | null = null;
  if (visual.capa !== "nenhuma") {
    const fora = mat(visual.capa === "noite" ? 0x0d0d0d : 0xce0e0e, { side: THREE.DoubleSide, roughness: 0.7 });
    const pivo = grupo(corpo, 0, 1.16, -0.3);
    const g = new THREE.PlaneGeometry(0.95, 1.05, 6, 8);
    g.translate(0, -0.52, 0);
    capa = peca(pivo, g, fora, 0, 0, 0);
    capa.rotation.x = 0.22;
    if (visual.capa === "noite") {
      const forro = peca(pivo, g.clone(), mat(0xce0e0e, { side: THREE.DoubleSide }), 0, 0, 0.012);
      forro.rotation.x = 0.22;
      (capa.userData as { forro?: TH.Mesh }).forro = forro;
    }
    bola(corpo, ouro, 0.05, 0, 1.17, 0.33);
  }

  // efeitos
  const efeitos = grupo(raiz, 0, 0, 0);
  const brilhos: TH.Mesh[] = [];
  let aura: TH.Mesh | null = null;
  let aureola: TH.Mesh | null = null;
  const luzEfeito = new THREE.PointLight(0xff3a2a, 0, 6);
  luzEfeito.position.set(0, 0.5, 0.8);
  raiz.add(luzEfeito);
  if (visual.efeito === "brilhos" || visual.efeito === "lenda") {
    const m = mat(visual.efeito === "lenda" ? 0xff7a4a : 0xffe08a, { emissive: visual.efeito === "lenda" ? 0xff3a1a : 0xffc94a, emissiveIntensity: 1.8 });
    for (let i = 0; i < 10; i++) brilhos.push(peca(efeitos, new THREE.OctahedronGeometry(0.045), m, 0, 0, 0));
  }
  if (visual.efeito === "aura" || visual.efeito === "lenda") {
    const m = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    lixo.push(m);
    aura = peca(efeitos, new THREE.RingGeometry(0.55, 1.05, 48), m, 0, 0.02, 0);
    aura.rotation.x = -Math.PI / 2;
    luzEfeito.intensity = 7;
  }
  if (visual.efeito === "aureola") {
    aureola = peca(cabeca, new THREE.TorusGeometry(0.26, 0.028, 10, 40), mat(0xffe08a, { emissive: 0xffc94a, emissiveIntensity: 2 }), 0, 1.28, 0);
    aureola.rotation.x = Math.PI / 2;
  }
  const estrela = corpo.getObjectByName("estrela");

  // =================== animação ===================
  let giro = 0;
  let inclina = 0;
  let sentado = 0;

  function atualizar(q: Quadro) {
    const { t, humor, reacao, p, mouse } = q;
    const dorme = humor === "dormindo";
    const feliz = humor === "feliz";
    const triste = humor === "triste";
    const ritmo = q.calmo ? 0 : dorme ? 0.4 : 1;

    // pose de descanso
    let salto = 0;
    let giroExtra = 0;
    let rolar = 0;
    let mortal = 0;
    let andaX = 0;
    let curva = triste ? 0.2 : 0;
    let cabX = dorme ? 0.5 : triste ? 0.25 + mouse.y * 0.1 : mouse.y * 0.25;
    let cabY = dorme ? 0 : mouse.x * 0.5;
    let cabZ = feliz ? Math.sin(t * 1.6) * 0.07 * ritmo : 0;
    let olhoFechado = dorme || t % 3.7 < 0.13;
    let bocaAberta = !dorme && !triste ? 1 : 0;
    let abanar = dorme ? 0 : Math.sin(t * (feliz ? 11 : triste ? 2 : 5)) * (feliz ? 0.45 : 0.18) * ritmo;
    let rabX = triste || dorme ? -0.6 : 0.1;
    let bE = { x: 0, z: -0.22 };
    let bD = { x: 0, z: 0.22 };
    let pE = 0;
    let pD = 0;
    let orelha = triste || dorme ? orelhaBase + 0.5 : orelhaBase + Math.max(0, Math.sin(t * 0.9) - 0.94) * 4;
    let alvoSentado = dorme ? 1 : 0;
    const andar = (fase: number, amp: number) => {
      pE = Math.sin(fase) * amp;
      pD = -Math.sin(fase) * amp;
      bE.x = -Math.sin(fase) * amp * 0.9;
      bD.x = Math.sin(fase) * amp * 0.9;
    };

    // feliz: pulinhos e um aceno de vez em quando
    if (feliz && !reacao) {
      salto = Math.abs(Math.sin(t * 3.1)) * 0.05 * ritmo;
      if (t % 9 < 1.6 && ritmo) bD = { x: 0, z: 2.5 + Math.sin(t * 13) * 0.3 };
    }
    // de tempos em tempos olha para os lados
    if (!dorme && !reacao && ritmo && t % 13 > 11) cabY += Math.sin((t % 13) * 4) * 0.5;

    if (reacao) {
      const k = (dur: number) => (p < dur ? p / dur : -1);
      let x: number;
      if ((reacao === "comer" || reacao === "beber") && (x = k(1.5)) >= 0) {
        bE = { x: -1.5, z: 0.35 };
        bD = { x: -1.5, z: -0.35 };
        cabX = 0.32 + Math.sin(p * 20) * 0.1;
        bocaAberta = reacao === "comer" ? 0.4 + Math.abs(Math.sin(p * 14)) : 0.6;
        abanar = Math.sin(t * 16) * 0.5;
        void x;
      } else if (reacao === "carinho" && k(1.6) >= 0) {
        olhoFechado = true;
        cabZ = Math.sin(p * 9) * 0.25;
        abanar = Math.sin(t * 18) * 0.6;
        salto = Math.abs(Math.sin(p * 8)) * 0.05;
      } else if (reacao === "dormir" && k(2.5) >= 0) {
        alvoSentado = 1;
        olhoFechado = true;
        cabX = 0.5;
      } else if (reacao === "festa" && (x = k(1.6)) >= 0) {
        salto = Math.sin(x * Math.PI) * 0.6;
        giroExtra = x * Math.PI * 2;
        bE = { x: 0, z: -2.7 };
        bD = { x: 0, z: 2.7 };
        abanar = Math.sin(t * 18) * 0.6;
      } else if (reacao === "acenar" && k(2) >= 0) {
        bD = { x: 0, z: 2.5 + Math.sin(p * 13) * 0.35 };
        cabZ = 0.12;
        abanar = Math.sin(t * 12) * 0.4;
      } else if (reacao === "girar" && (x = k(1)) >= 0) {
        giroExtra = (1 - Math.pow(1 - x, 3)) * Math.PI * 2;
        bE.z = -1.2;
        bD.z = 1.2;
      } else if (reacao === "rolar" && (x = k(1.2)) >= 0) {
        rolar = x * Math.PI * 2;
        salto = Math.sin(x * Math.PI) * 0.35;
      } else if (reacao === "dancar" && k(3) >= 0) {
        const b = Math.sin(p * 8);
        bE = { x: 0, z: -1.3 - b * 1.1 };
        bD = { x: 0, z: 1.3 - b * 1.1 };
        pE = Math.max(0, b) * 0.5;
        pD = Math.max(0, -b) * 0.5;
        curva = 0;
        rolar = b * 0.14;
        giroExtra = Math.sin(p * 4) * 0.6;
        salto = Math.abs(b) * 0.08;
        cabZ = -b * 0.18;
        abanar = Math.sin(t * 16) * 0.5;
      } else if (reacao === "correr" && (x = k(2.6)) >= 0) {
        const volta = x * Math.PI * 2;
        andaX = Math.sin(volta) * 0.6;
        giroExtra = Math.PI / 2 + volta;
        andar(p * 20, 1.0);
        curva = 0.22;
        salto = Math.abs(Math.sin(p * 20)) * 0.06;
      } else if (reacao === "mortal" && (x = k(1.1)) >= 0) {
        mortal = -x * Math.PI * 2;
        salto = Math.sin(x * Math.PI) * 0.8;
        pE = pD = -0.9;
        bE.x = bD.x = -1.2;
      } else if (reacao === "cumprimentar" && (x = k(1.7)) >= 0) {
        curva = Math.sin(x * Math.PI) * 0.6;
        bD = { x: -1.0 * Math.sin(x * Math.PI), z: -0.5 };
        olhoFechado = x > 0.25 && x < 0.75;
      }
    }

    // sentar para dormir
    sentado += (alvoSentado - sentado) * 0.06;
    if (sentado > 0.02) {
      pE = pE * (1 - sentado) - 1.45 * sentado;
      pD = pD * (1 - sentado) - 1.45 * sentado;
    }

    // aplica
    giro += ((dorme ? 0 : mouse.x * 0.25) - giro) * 0.08;
    inclina += (curva - inclina) * 0.12;
    raiz.position.set(andaX, salto - sentado * 0.3, 0);
    raiz.rotation.set(mortal, giro + giroExtra, rolar);
    corpo.rotation.x = inclina;
    tronco.scale.y = 0.46 * 1.05 * (1 + Math.sin(t * 2.1 * ritmo) * 0.02);
    cabeca.rotation.x += (cabX - cabeca.rotation.x) * 0.15;
    cabeca.rotation.y += (cabY - cabeca.rotation.y) * 0.1;
    cabeca.rotation.z = cabZ;
    olhos.forEach((o) => (o.scale.y = 0.062 * (olhoFechado ? 0.12 : 1)));
    boca.scale.y = 0.08 * 0.7 * Math.max(0.05, Math.min(1.6, bocaAberta));
    boca.visible = bocaAberta > 0.02;
    orelhas.forEach((o, i) => (o.rotation.z = (i ? -1 : 1) * orelha));
    rabo.rotation.set(rabX, 0, abanar);
    bracoE.rotation.set(bE.x, 0, bE.z);
    bracoD.rotation.set(bD.x, 0, bD.z);
    pernaE.rotation.x = pE;
    pernaD.rotation.x = pD;

    // cosméticos em movimento
    if (capa) {
      const balanco = 0.22 + Math.sin(t * 2.2) * 0.07 * ritmo + Math.min(0.9, salto * 1.4 + Math.abs(andaX) * 0.5);
      capa.rotation.x = balanco;
      const forro = (capa.userData as { forro?: TH.Mesh }).forro;
      if (forro) forro.rotation.x = balanco;
    }
    if (estrela) estrela.rotation.y = t * 1.5 * ritmo;
    brilhos.forEach((b, i) => {
      const a = t * 0.9 + (i / brilhos.length) * Math.PI * 2;
      const r = 0.85 + Math.sin(t * 1.3 + i) * 0.12;
      b.position.set(Math.cos(a) * r, 0.35 + ((i * 0.37 + t * 0.25) % 1.9), Math.sin(a) * r);
      b.rotation.set(t * 2 + i, t * 3, 0);
      b.scale.setScalar(0.6 + Math.sin(t * 5 + i * 2) * 0.4);
    });
    if (aura) {
      const pulso = 1 + Math.sin(t * 2.4) * 0.08;
      aura.scale.set(pulso, pulso, 1);
      (aura.material as TH.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 2.4) * 0.12;
      aura.rotation.z = t * 0.4;
      luzEfeito.intensity = 6 + Math.sin(t * 2.4) * 2;
    }
    if (aureola) aureola.position.y = 1.28 + Math.sin(t * 2) * 0.03;
    return salto;
  }

  return { raiz, atualizar, descartar: () => lixo.forEach((l) => l.dispose()) };
}
