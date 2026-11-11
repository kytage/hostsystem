/**
 * HOSHI: um bichinho redondo e fofo, feito do zero com formas simples.
 * O corpo é uma gota só (por isso é leve e não "quebra"); olhos grandes,
 * bracinhos e pezinhos se mexem, e roupas, cabelo, chapéu, bandeira e
 * efeitos são encaixados em cima seguindo o formato do corpo.
 */
import type * as TH from "three";
import { CORES_CABELO, OLHOS, PELOS, pecaDe, type Humor, type Visual } from "@/lib/hoshi";

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

// Formato do corpo: uma esfera de raio R, centrada em CY, esticada em Y e achatada em Z.
const R = 0.62;
const CY = 0.72;
const SY = 1.12;
const SZ = 0.92;
const TOPO = CY + R * SY;
/** Z da superfície da frente do corpo no ponto (x, y): serve para colar olhos, boca etc. */
function frente(x: number, y: number) {
  const ny = (y - CY) / (R * SY);
  const rh = R * Math.sqrt(Math.max(0, 1 - ny * ny));
  return SZ * Math.sqrt(Math.max(0, rh * rh - x * x));
}

export function criarMascote(THREE: typeof TH, visual: Visual) {
  const lixo: { dispose: () => void }[] = [];
  const mat = (cor: TH.ColorRepresentation, o: TH.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.8, ...o });
    lixo.push(m);
    return m;
  };
  const esfera = new THREE.SphereGeometry(1, 32, 24);
  lixo.push(esfera);
  const bola = (pai: TH.Object3D, m: TH.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(esfera, m);
    o.position.set(x, y, z);
    o.scale.set(r * sx, r * sy, r * sz);
    pai.add(o);
    return o;
  };
  const peca = (pai: TH.Object3D, g: TH.BufferGeometry, m: TH.Material, x: number, y: number, z: number) => {
    lixo.push(g);
    const o = new THREE.Mesh(g, m);
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
  /** Textura pintada na hora (listras e bandeiras). */
  const textura = (largura: number, altura: number, pintar: (c: CanvasRenderingContext2D) => void) => {
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext("2d");
    if (ctx) pintar(ctx);
    const t = new THREE.CanvasTexture(tela);
    t.colorSpace = THREE.SRGBColorSpace;
    lixo.push(t);
    return t;
  };
  const listrado = (cores: string[]) =>
    textura(8, cores.length * 8, (c) =>
      cores.forEach((cor, i) => {
        c.fillStyle = cor;
        c.fillRect(0, i * 8, 8, 8);
      }),
    );
  /** Material de uma peça da loja: cor lisa ou listras. */
  const tecido = (p: { cor: string; listras?: string[] } | undefined, extra: TH.MeshStandardMaterialParameters = {}) =>
    p?.listras ? mat("#ffffff", { map: listrado(p.listras), side: THREE.DoubleSide, ...extra }) : mat(p?.cor ?? "#ce0e0e", { side: THREE.DoubleSide, ...extra });

  const corPelo = new THREE.Color(PELOS.find((x) => x.id === visual.pelo)?.cor ?? "#fff6ec");
  const pelo = mat(corPelo);
  const claro = mat(corPelo.clone().lerp(new THREE.Color("#ffffff"), 0.62));
  const escuro = mat(corPelo.clone().multiplyScalar(0.8));
  const preto = mat("#140d0d", { roughness: 0.3 });
  const branco = mat("#ffffff", { roughness: 0.35 });
  const ouro = mat("#f2c14e", { roughness: 0.28, metalness: 0.8 });
  const vermelho = mat("#ce0e0e", { roughness: 0.6 });

  // raiz (anda e pula) → eixo (gira no meio do corpo) → corpo (amassa e estica a partir do chão)
  const raiz = new THREE.Group();
  const eixo = grupo(raiz, 0, CY, 0);
  const corpo = grupo(eixo, 0, -CY, 0);

  /** Faixa em volta do corpo, entre dois ângulos (0 = topo, 1 = base). É como camiseta, calça e boné vestem. */
  const faixa = (m: TH.Material, de: number, ate: number, escala: number, phi0 = 0, phiLen = Math.PI * 2) => {
    const o = peca(corpo, new THREE.SphereGeometry(R, 40, 12, phi0, phiLen, de * Math.PI, (ate - de) * Math.PI), m, 0, CY, 0);
    o.scale.set(escala, SY * escala, SZ * escala);
    return o;
  };

  // ---------------- corpo ----------------
  bola(corpo, pelo, R, 0, CY, 0, 1, SY, SZ);
  // barriga clara: um recorte que acompanha a curva do corpo (assim a roupa sempre cobre por cima)
  faixa(claro, 0.52, 0.9, 1.012, 0.27 * Math.PI, 0.46 * Math.PI);
  for (const lado of [-1, 1]) {
    bola(corpo, pelo, 0.15, lado * 0.36, 1.3, 0);
    bola(corpo, claro, 0.085, lado * 0.36, 1.3, 0.09);
    const bochecha = bola(corpo, mat("#ff8fa3", { transparent: true, opacity: 0.6 }), 0.075, lado * 0.38, 0.8, frente(0.38, 0.8) - 0.03, 1, 0.7, 0.3);
    bochecha.renderOrder = 1;
  }

  // olhos grandes: branco, íris colorida, pupila e brilho
  const iris = mat(OLHOS.find((x) => x.id === visual.olhos)?.cor ?? "#c98a1f", { roughness: 0.3 });
  const brilho = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lixo.push(brilho);
  const olhos = [-1, 1].map((lado) => {
    const g = grupo(corpo, lado * 0.22, 0.98, frente(0.22, 0.98) - 0.04);
    bola(g, branco, 0.175, 0, 0, 0, 1, 1, 0.55);
    const pupila = grupo(g, 0, 0, 0);
    bola(pupila, iris, 0.11, 0, 0, 0.055, 1, 1, 0.5);
    bola(pupila, preto, 0.06, 0, 0, 0.09, 1, 1, 0.5);
    bola(pupila, brilho, 0.03, 0.04, 0.05, 0.125);
    return { g, pupila };
  });
  bola(corpo, preto, 0.045, 0, 0.83, frente(0, 0.83) + 0.005, 1.25, 0.8, 0.8);
  const boca = bola(corpo, mat("#6e1a26", { roughness: 0.5 }), 0.085, 0, 0.72, frente(0, 0.72) - 0.02, 1.3, 0.7, 0.5);
  const lingua = bola(corpo, mat("#f06a7a"), 0.05, 0, 0.695, frente(0, 0.695) + 0.0, 1.2, 0.6, 0.5);

  // bracinhos e pezinhos
  const braco = (lado: number) => {
    const g = grupo(corpo, lado * 0.57, 0.72, 0.06);
    bola(g, pelo, 0.14, lado * 0.05, -0.09, 0, 0.85, 1.25, 0.85);
    return g;
  };
  const bracoE = braco(-1);
  const bracoD = braco(1);
  const pe = (lado: number) => {
    const g = grupo(corpo, lado * 0.24, 0.2, 0.05);
    bola(g, escuro, 0.16, 0, -0.1, 0.06, 1, 0.6, 1.3);
    return g;
  };
  const peE = pe(-1);
  const peD = pe(1);

  // ---------------- roupas ----------------
  const comCalca = visual.calca !== "nenhuma";
  // As faixas ficam um pouco por fora da barriga clara, para a roupa cobrir o corpo todo.
  if (visual.roupa !== "nenhuma") faixa(tecido(pecaDe("roupa", visual.roupa)), 0.55, comCalca ? 0.69 : 0.8, 1.05);
  if (comCalca) faixa(tecido(pecaDe("calca", visual.calca)), 0.69, 0.96, 1.055);

  // ---------------- cabelo e chapéu ----------------
  const chapeu = pecaDe("chapeu", visual.chapeu);
  const comChapeu = !!chapeu && visual.chapeu !== "nenhum";
  if (visual.cabelo !== "nenhum") {
    const fio = mat(CORES_CABELO.find((x) => x.id === visual.corCabelo)?.cor ?? "#1c1717", { side: THREE.DoubleSide, roughness: 0.65 });
    faixa(fio, 0, 0.24, 1.03);
    const c = visual.cabelo;
    if (c === "topete" && !comChapeu) {
      bola(corpo, fio, 0.19, 0, TOPO + 0.02, 0.26, 1.25, 0.8, 1);
      bola(corpo, fio, 0.12, 0.1, TOPO + 0.1, 0.34);
    } else if (c === "espetado" && !comChapeu) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const espinho = peca(corpo, new THREE.ConeGeometry(0.09, 0.3, 10), fio, Math.cos(a) * 0.2, TOPO + 0.06, Math.sin(a) * 0.18);
        espinho.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
      peca(corpo, new THREE.ConeGeometry(0.1, 0.34, 10), fio, 0, TOPO + 0.12, 0);
    } else if (c === "franja") {
      for (const x of [-0.24, -0.08, 0.08, 0.24]) bola(corpo, fio, 0.11, x, 1.2, frente(x, 1.2) + 0.02, 1, 0.75, 0.6);
    } else if (c === "longo") {
      for (const lado of [-1, 1]) peca(corpo, new THREE.CapsuleGeometry(0.12, 0.6, 6, 12), fio, lado * 0.56, 0.82, -0.06);
      bola(corpo, fio, 0.5, 0, 0.86, -0.36, 1.1, 1.15, 0.45);
    } else if (c === "chiquinhas") {
      for (const lado of [-1, 1]) {
        bola(corpo, fio, 0.17, lado * 0.68, 1.1, 0, 0.9, 1.25, 0.9);
        bola(corpo, vermelho, 0.06, lado * 0.56, 1.16, 0);
      }
    } else if (c === "coque" && !comChapeu) {
      bola(corpo, fio, 0.19, 0, TOPO + 0.1, -0.04);
      bola(corpo, vermelho, 0.05, 0, TOPO - 0.02, 0.12);
    }
  }
  if (comChapeu && chapeu) {
    const m = mat(chapeu.cor, { side: THREE.DoubleSide, roughness: 0.6 });
    if (chapeu.tipo === "bone") {
      faixa(m, 0, 0.27, 1.06);
      const aba = peca(corpo, new THREE.CylinderGeometry(0.32, 0.32, 0.035, 28), m, 0, 1.2, frente(0, 1.2) + 0.2);
      aba.scale.set(1, 1, 0.8);
      aba.rotation.x = 0.16;
      bola(corpo, branco, 0.04, 0, TOPO + 0.05, 0);
    } else if (chapeu.tipo === "festa") {
      peca(corpo, new THREE.ConeGeometry(0.2, 0.55, 20), m, 0, TOPO + 0.22, 0);
      bola(corpo, branco, 0.07, 0, TOPO + 0.52, 0);
    } else if (chapeu.tipo === "cartola") {
      peca(corpo, new THREE.CylinderGeometry(0.27, 0.27, 0.42, 26), m, 0, TOPO + 0.17, 0);
      peca(corpo, new THREE.CylinderGeometry(0.46, 0.46, 0.035, 30), m, 0, TOPO - 0.04, 0);
      peca(corpo, new THREE.CylinderGeometry(0.275, 0.275, 0.08, 26), vermelho, 0, TOPO + 0.02, 0);
    } else if (chapeu.tipo === "coroa") {
      const aro = peca(corpo, new THREE.CylinderGeometry(0.3, 0.26, 0.18, 26, 1, true), ouro, 0, TOPO + 0.03, 0);
      (aro.material as TH.MeshStandardMaterial).side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        peca(corpo, new THREE.ConeGeometry(0.055, 0.15, 8), ouro, Math.cos(a) * 0.285, TOPO + 0.19, Math.sin(a) * 0.285);
      }
      bola(corpo, vermelho, 0.045, 0, TOPO + 0.04, 0.29);
    }
  }

  // ---------------- óculos ----------------
  if (visual.oculos === "escuros") {
    for (const lado of [-1, 1]) bola(corpo, preto, 0.2, lado * 0.22, 0.98, frente(0.22, 0.98) + 0.02, 1, 0.9, 0.4);
    peca(corpo, new THREE.BoxGeometry(0.14, 0.03, 0.03), preto, 0, 1.0, frente(0, 1.0) + 0.05);
    olhos.forEach((o) => (o.g.visible = false));
  } else if (visual.oculos === "visor") {
    faixa(mat("#ff2a2a", { emissive: "#ff1a1a", emissiveIntensity: 1.5, roughness: 0.2, side: THREE.DoubleSide }), 0.31, 0.44, 1.045, 0.14 * Math.PI, 0.72 * Math.PI);
    olhos.forEach((o) => (o.g.visible = false));
  }

  // ---------------- capa ----------------
  let capa: TH.Mesh | null = null;
  let forro: TH.Mesh | null = null;
  if (visual.capa !== "nenhuma") {
    const pivo = grupo(corpo, 0, 1.02, -SZ * R * 0.86);
    const g = new THREE.PlaneGeometry(0.95, 0.9, 6, 8);
    g.translate(0, -0.45, 0);
    capa = peca(pivo, g, mat(visual.capa === "noite" ? "#0d0d0d" : "#ce0e0e", { side: THREE.DoubleSide, roughness: 0.7 }), 0, 0, 0);
    if (visual.capa === "noite") forro = peca(pivo, g.clone(), mat("#ce0e0e", { side: THREE.DoubleSide }), 0, 0, 0.012);
    bola(corpo, ouro, 0.05, 0, 0.66, frente(0, 0.66) + 0.02);
  }

  // ---------------- bandeira (na mão direita) ----------------
  const bandeira = pecaDe("bandeira", visual.bandeira);
  let pano: TH.Mesh | null = null;
  if (bandeira && visual.bandeira !== "nenhuma") {
    peca(corpo, new THREE.CylinderGeometry(0.018, 0.018, 1.05, 8), mat("#d8d8d8", { metalness: 0.6, roughness: 0.3 }), 0.8, 0.98, 0.1);
    bola(corpo, ouro, 0.035, 0.8, 1.52, 0.1);
    const mapa = bandeira.listras
      ? listrado(bandeira.listras)
      : textura(160, 100, (c) => {
          if (bandeira.tipo === "brasil") {
            c.fillStyle = "#009c3b";
            c.fillRect(0, 0, 160, 100);
            c.fillStyle = "#ffdf00";
            c.beginPath();
            c.moveTo(80, 10);
            c.lineTo(148, 50);
            c.lineTo(80, 90);
            c.lineTo(12, 50);
            c.closePath();
            c.fill();
            c.fillStyle = "#002776";
            c.beginPath();
            c.arc(80, 50, 23, 0, Math.PI * 2);
            c.fill();
          } else {
            c.fillStyle = "#ce0e0e";
            c.fillRect(0, 0, 160, 100);
            c.fillStyle = "#ffffff";
            c.font = "900 46px Arial, sans-serif";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText("HOST", 80, 54);
          }
        });
    const g = new THREE.PlaneGeometry(0.52, 0.33, 8, 1);
    g.translate(0.26, 0, 0);
    pano = peca(corpo, g, mat("#ffffff", { map: mapa, side: THREE.DoubleSide, roughness: 0.7 }), 0.815, 1.32, 0.1);
  }

  // ---------------- glitter, auras e auréola ----------------
  const efeito = pecaDe("efeito", visual.efeito);
  const brilhos: TH.Mesh[] = [];
  let aura: TH.Mesh | null = null;
  let aureola: TH.Mesh | null = null;
  const luz = new THREE.PointLight(efeito?.cor ?? "#ff3a2a", 0, 6);
  luz.position.set(0, 0.5, 0.9);
  raiz.add(luz);
  const arcoIris = efeito?.listras;
  if (efeito?.tipo === "glitter") {
    for (let i = 0; i < 16; i++) {
      const cor = arcoIris ? (arcoIris[i % arcoIris.length] ?? efeito.cor) : efeito.cor;
      brilhos.push(peca(raiz, new THREE.OctahedronGeometry(0.04), mat(cor, { emissive: cor, emissiveIntensity: 2 }), 0, 0, 0));
    }
  } else if (efeito?.tipo === "aura") {
    const m = new THREE.MeshBasicMaterial({ color: efeito.cor, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    lixo.push(m);
    aura = peca(raiz, new THREE.RingGeometry(0.6, 1.1, 48), m, 0, 0.02, 0);
    aura.rotation.x = -Math.PI / 2;
  } else if (efeito?.tipo === "aureola") {
    aureola = peca(corpo, new THREE.TorusGeometry(0.26, 0.028, 10, 40), mat(efeito.cor, { emissive: "#ffc94a", emissiveIntensity: 2 }), 0, TOPO + 0.3, 0);
    aureola.rotation.x = Math.PI / 2;
  }
  const corAura = new THREE.Color();

  // =================== animação ===================
  let giro = 0;
  let inclinaAtual = 0;
  const descansoD = pano ? 1.2 : 0.35;

  function atualizar(q: Quadro) {
    const { t, humor, reacao, p, mouse } = q;
    const dorme = humor === "dormindo";
    const feliz = humor === "feliz";
    const triste = humor === "triste";
    const ritmo = q.calmo ? 0 : dorme ? 0.4 : 1;

    let salto = 0;
    let giroExtra = 0;
    let rolar = feliz ? Math.sin(t * 1.7) * 0.05 * ritmo : 0;
    let mortal = 0;
    let andaX = 0;
    let estica = 1 + Math.sin(t * 2.2 * ritmo) * 0.022 - (dorme ? 0.08 : 0);
    let inclina = triste ? 0.14 : dorme ? 0.1 : 0;
    let olho = dorme || t % 3.9 < 0.13 ? 0.08 : triste ? 0.75 : 1;
    let abre = dorme ? 0.2 : triste ? 0.25 : 0.75;
    const bE = { x: 0, z: -0.35 };
    const bD = { x: 0, z: descansoD };
    let pE = 0;
    let pD = 0;

    // feliz: pulinhos e um aceno de vez em quando
    if (feliz && !reacao && ritmo) {
      salto = Math.abs(Math.sin(t * 3.1)) * 0.05;
      if (t % 9 < 1.6) bE.z = -2.3 - Math.sin(t * 13) * 0.3;
    }

    if (reacao) {
      const k = (dur: number) => (p < dur ? p / dur : -1);
      let x: number;
      if ((reacao === "comer" || reacao === "beber") && k(1.5) >= 0) {
        bE.x = bD.x = -1.4;
        bE.z = 0.5;
        bD.z = -0.5;
        abre = reacao === "comer" ? 0.3 + Math.abs(Math.sin(p * 14)) * 1.1 : 0.9;
        estica += Math.sin(p * 14) * 0.03;
      } else if (reacao === "carinho" && k(1.6) >= 0) {
        olho = 0.08;
        rolar = Math.sin(p * 9) * 0.2;
        estica += Math.abs(Math.sin(p * 8)) * 0.06;
        abre = 1.1;
      } else if (reacao === "dormir" && k(2.5) >= 0) {
        olho = 0.08;
        estica -= 0.08;
        abre = 0.2;
      } else if (reacao === "festa" && (x = k(1.6)) >= 0) {
        salto = Math.sin(x * Math.PI) * 0.6;
        giroExtra = x * Math.PI * 2;
        bE.z = -2.6;
        bD.z = 2.6;
        abre = 1.3;
      } else if (reacao === "acenar" && k(2) >= 0) {
        bE.z = -2.4 - Math.sin(p * 13) * 0.35;
        rolar = 0.1;
        abre = 1.1;
      } else if (reacao === "girar" && (x = k(1)) >= 0) {
        giroExtra = (1 - Math.pow(1 - x, 3)) * Math.PI * 2;
        bE.z = -1.3;
        bD.z = 1.3;
      } else if (reacao === "rolar" && (x = k(1.2)) >= 0) {
        rolar = x * Math.PI * 2;
        salto = Math.sin(x * Math.PI) * 0.35;
      } else if (reacao === "dancar" && k(3) >= 0) {
        const b = Math.sin(p * 8);
        bE.z = -1.3 + b * 1.1;
        bD.z = 1.3 + b * 1.1;
        pE = Math.max(0, b) * 0.6;
        pD = Math.max(0, -b) * 0.6;
        rolar = b * 0.16;
        giroExtra = Math.sin(p * 4) * 0.6;
        estica += Math.abs(b) * 0.06;
        salto = Math.abs(b) * 0.06;
        abre = 1.2;
      } else if (reacao === "correr" && (x = k(2.6)) >= 0) {
        const volta = x * Math.PI * 2;
        andaX = Math.sin(volta) * 0.6;
        giroExtra = Math.PI / 2 + volta;
        pE = Math.sin(p * 20) * 0.9;
        pD = -pE;
        bE.x = -pE;
        bD.x = pE;
        inclina = 0.2;
        salto = Math.abs(Math.sin(p * 20)) * 0.06;
      } else if (reacao === "mortal" && (x = k(1.1)) >= 0) {
        mortal = -x * Math.PI * 2;
        salto = Math.sin(x * Math.PI) * 0.8;
        estica -= 0.06;
      } else if (reacao === "cumprimentar" && (x = k(1.7)) >= 0) {
        inclina = Math.sin(x * Math.PI) * 0.55;
        if (x > 0.25 && x < 0.75) olho = 0.08;
      }
    }

    // no ar ele estica um pouco, como uma gotinha
    estica += Math.min(0.12, salto * 0.2);
    const largo = 1 / Math.sqrt(estica);

    giro += ((dorme ? 0 : mouse.x * 0.4) - giro) * 0.08;
    inclinaAtual += (inclina - inclinaAtual) * 0.12;
    raiz.position.set(andaX, salto, 0);
    raiz.rotation.y = giro + giroExtra;
    eixo.rotation.set(mortal + inclinaAtual, 0, rolar);
    corpo.scale.set(largo, estica, largo);

    olhos.forEach(({ g, pupila }) => {
      g.scale.y = olho;
      pupila.position.set(dorme ? 0 : mouse.x * 0.035, dorme ? 0 : -mouse.y * 0.03, 0);
    });
    boca.scale.y = 0.085 * 0.7 * Math.max(0.12, Math.min(1.5, abre));
    lingua.visible = abre > 0.6;
    bracoE.rotation.set(bE.x, 0, bE.z);
    bracoD.rotation.set(bD.x, 0, bD.z);
    peE.rotation.x = pE;
    peD.rotation.x = pD;

    // cosméticos em movimento
    if (capa) {
      const balanco = 0.22 + Math.sin(t * 2.2) * 0.07 * ritmo + Math.min(0.9, salto * 1.4 + Math.abs(andaX) * 0.5);
      capa.rotation.x = balanco;
      if (forro) forro.rotation.x = balanco;
    }
    if (pano) pano.rotation.y = Math.sin(t * 3.2) * 0.3 * (q.calmo ? 0 : 1);
    brilhos.forEach((b, i) => {
      const a = t * 0.8 + (i / brilhos.length) * Math.PI * 2;
      const r = 0.95 + Math.sin(t * 1.3 + i) * 0.15;
      b.position.set(Math.cos(a) * r, 0.2 + ((i * 0.37 + t * 0.22) % 1.7), Math.sin(a) * r);
      b.rotation.set(t * 2 + i, t * 3, 0);
      b.scale.setScalar(0.5 + Math.abs(Math.sin(t * 4 + i * 2)) * 0.9);
    });
    if (aura && efeito) {
      const pulso = 1 + Math.sin(t * 2.4) * 0.08;
      aura.scale.set(pulso, pulso, 1);
      aura.rotation.z = t * 0.4;
      const m = aura.material as TH.MeshBasicMaterial;
      m.opacity = 0.32 + Math.sin(t * 2.4) * 0.12;
      if (arcoIris) {
        corAura.setHSL((t * 0.12) % 1, 1, 0.55);
        m.color.copy(corAura);
        luz.color.copy(corAura);
      }
      luz.intensity = 6 + Math.sin(t * 2.4) * 2;
    }
    if (aureola) aureola.position.y = TOPO + 0.3 + Math.sin(t * 2) * 0.03;
    return salto;
  }

  return { raiz, atualizar, descartar: () => lixo.forEach((l) => l.dispose()) };
}
