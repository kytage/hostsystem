/**
 * HOSHI de capuz: cabeça grande, corpo pequeno, macacão com orelhas.
 * Cada parte fica em seu próprio "osso" (cabeça, braços, pernas, orelhas),
 * e trajes, roupas e acessórios são montados seguindo as mesmas medidas,
 * então acompanham os movimentos sem flutuar nem atravessar o corpo.
 */
import type * as TH from "three";
import { coresDe, peca as pecaPorId, trajeDe, type Humor, type Visual } from "@/lib/hoshi";

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

// medidas do boneco (o chão é y = 0)
const TORSO = { y: 0.52, r: 0.27, s: [1, 1.2, 0.9] as const };
const PESCOCO = 0.86;
const CAPUZ = { y: 0.36, r: 0.5, s: [1.05, 0.97, 0.98] as const };
const ROSTO = { y: 0.34, z: 0.13, r: 0.42, s: [1, 0.95, 0.9] as const };
const TOPO_CAPUZ = CAPUZ.y + CAPUZ.r * CAPUZ.s[1];
/** Z da frente do rosto no ponto (x, y), em coordenadas da cabeça. */
const rostoZ = (x: number, y: number) => ROSTO.z + ROSTO.s[2] * Math.sqrt(Math.max(0, ROSTO.r * ROSTO.r - x * x - ((y - ROSTO.y) / ROSTO.s[1]) ** 2));

/** Modelo 3D do HOSHI clássico (malha com textura), já carregado pelo palco. */
export interface Modelo {
  geo: TH.BufferGeometry;
  tex: TH.Texture;
}
// Medidas do modelo, nas unidades do arquivo: altura total e a cabeça (centro, meia largura, meia altura, meia profundidade).
const MODELO = { altura: 0.979, cabeca: { y: 0.7, rx: 0.33, ry: 0.28, rz: 0.25 } };

export function criarMascote(THREE: typeof TH, visual: Visual, modelo?: Modelo) {
  const lixo: { dispose: () => void }[] = [];
  const mat = (cor: TH.ColorRepresentation, o: TH.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.88, ...o });
    lixo.push(m);
    return m;
  };
  const esfera = new THREE.SphereGeometry(1, 36, 26);
  lixo.push(esfera);
  const bola = (pai: TH.Object3D, m: TH.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(esfera, m);
    o.position.set(x, y, z);
    o.scale.set(r * sx, r * sy, r * sz);
    pai.add(o);
    return o;
  };
  const forma = (pai: TH.Object3D, g: TH.BufferGeometry, m: TH.Material, x: number, y: number, z: number) => {
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
  /** Recorte de uma esfera (entre dois ângulos, 0 = topo e 1 = base): é como roupa, boné e visor "vestem" o corpo. */
  const casca = (pai: TH.Object3D, base: { y: number; r: number; s: readonly [number, number, number]; z?: number }, m: TH.Material, de: number, ate: number, folga: number, phi0 = 0, phiLen = Math.PI * 2) => {
    const o = forma(pai, new THREE.SphereGeometry(base.r, 40, 14, phi0, phiLen, de * Math.PI, (ate - de) * Math.PI), m, 0, base.y, base.z ?? 0);
    o.scale.set(base.s[0] * folga, base.s[1] * folga, base.s[2] * folga);
    return o;
  };
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

  const traje = trajeDe(visual);
  const cores = coresDe(visual);
  const tipo = traje.tipo ?? "redonda";
  const roupa = pecaPorId(visual.roupa);
  const calca = pecaPorId(visual.calca);
  const chapeu = pecaPorId(visual.chapeu);
  const luvas = pecaPorId(visual.luvas);
  const calcado = pecaPorId(visual.calcado);
  const costas = pecaPorId(visual.costas);
  const efeito = pecaPorId(visual.efeito);

  const principal = mat(cores.principal);
  const detalhe = mat(cores.detalhe);
  const capuz = mat(cores.capuz);
  const pele = mat("#fff4e6", { roughness: 0.75 });
  const preto = mat("#141010", { roughness: 0.18 });
  const branco = mat("#ffffff", { roughness: 0.4 });
  const ouro = mat("#f2c14e", { roughness: 0.3, metalness: 0.75 });
  const vermelho = mat("#ce0e0e", { roughness: 0.6 });
  const matRoupa = roupa ? (roupa.listras ? mat("#ffffff", { map: listrado(roupa.listras), side: THREE.DoubleSide }) : mat(roupa.cor, { side: THREE.DoubleSide })) : null;
  const manga = roupa ? mat(roupa.listras?.[0] ?? roupa.cor) : principal;
  const matCalca = calca ? mat(calca.cor, { side: THREE.DoubleSide }) : null;
  const matLuva = luvas?.tipo === "ouro" ? ouro : mat(cores.luvas);
  const matPe = calcado?.tipo === "tenis" ? branco : mat(cores.pes);

  // raiz (anda e pula) → eixo (gira no meio do corpo) → corpo
  const raiz = new THREE.Group();
  const eixo = grupo(raiz, 0, 0.6, 0);
  const corpo = grupo(eixo, 0, -0.6, 0);
  let topo = PESCOCO + TOPO_CAPUZ + 0.02;
  let largura = 1.5;

  // ---------------- tronco ----------------
  bola(corpo, principal, TORSO.r, 0, TORSO.y, 0, ...TORSO.s);
  casca(corpo, TORSO, detalhe, 0.38, 0.86, 1.015, 0.3 * Math.PI, 0.4 * Math.PI); // barriga
  if (matRoupa) casca(corpo, TORSO, matRoupa, 0.2, matCalca ? 0.62 : 0.74, 1.07);
  if (matCalca) casca(corpo, TORSO, matCalca, 0.62, 1, 1.075);
  if (!roupa && (tipo === "redonda" || tipo === "original" || tipo === "veterano")) {
    const estrela = forma(corpo, new THREE.OctahedronGeometry(0.055), tipo === "original" ? vermelho : ouro, 0, 0.62, TORSO.r * TORSO.s[2] + 0.005);
    estrela.scale.set(1, 1, 0.35);
    estrela.name = "estrela";
  }

  // ---------------- pernas e pés ----------------
  const perna = (lado: number) => {
    const g = grupo(corpo, lado * 0.115, 0.3, 0);
    forma(g, new THREE.CapsuleGeometry(0.085, 0.1, 6, 14), matCalca ? mat(calca!.cor) : principal, 0, -0.1, 0);
    const r = calcado?.tipo === "botas" ? 0.13 : 0.105;
    bola(g, matPe, r, 0, -0.3 + r * 0.72, 0.035, 1, 0.72, 1.3);
    if (calcado?.tipo === "botas") forma(g, new THREE.TorusGeometry(0.092, 0.03, 8, 20), branco, 0, -0.17, 0).rotation.x = Math.PI / 2;
    if (calcado?.tipo === "tenis") bola(g, mat("#2a2a2a"), 0.108, 0, -0.275, 0.035, 1, 0.3, 1.32);
    return g;
  };
  const pernaE = perna(-1);
  const pernaD = perna(1);

  // ---------------- braços e mãos ----------------
  const braco = (lado: number) => {
    const g = grupo(corpo, lado * 0.235, 0.7, 0);
    const manguinha = forma(g, new THREE.CapsuleGeometry(0.07, 0.17, 6, 14), manga, lado * 0.035, -0.13, 0);
    manguinha.rotation.z = lado * 0.2;
    bola(g, matLuva, luvas?.tipo === "fofas" ? 0.115 : 0.085, lado * 0.07, -0.29, 0.01);
    return g;
  };
  const bracoE = braco(-1);
  const bracoD = braco(1);

  // ---------------- rabinho ----------------
  if (tipo === "raposa") {
    bola(corpo, principal, 0.11, 0, 0.42, -0.36, 0.9, 0.9, 1.9);
    bola(corpo, detalhe, 0.085, 0, 0.44, -0.55);
  } else if (tipo === "gato") {
    const rabo = forma(corpo, new THREE.CapsuleGeometry(0.035, 0.3, 6, 10), principal, 0, 0.5, -0.32);
    rabo.rotation.x = -0.7;
  } else bola(corpo, tipo === "coelho" ? principal : detalhe, tipo === "coelho" ? 0.085 : 0.06, 0, 0.38, -0.25);

  // ---------------- cabeça: capuz + rosto ----------------
  const cabeca = grupo(corpo, 0, PESCOCO, 0);
  bola(cabeca, capuz, CAPUZ.r, 0, CAPUZ.y, 0, ...CAPUZ.s);
  bola(cabeca, pele, ROSTO.r, 0, ROSTO.y, ROSTO.z, ...ROSTO.s);
  const brilho = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lixo.push(brilho);
  const olhos = [-1, 1].map((lado) => {
    const g = grupo(cabeca, lado * 0.15, 0.36, rostoZ(0.15, 0.36) - 0.012);
    if (tipo === "panda") bola(g, mat("#1c1c1c"), 0.105, lado * 0.01, -0.01, -0.03, 0.9, 1.2, 0.3);
    bola(g, preto, 0.062, 0, 0, 0, 0.85, 1.25, 0.5);
    bola(g, brilho, 0.019, 0.018, 0.035, 0.03);
    return g;
  });
  for (const lado of [-1, 1]) bola(cabeca, mat("#ff9aa8", { transparent: true, opacity: 0.55 }), 0.055, lado * 0.26, 0.24, rostoZ(0.26, 0.24) - 0.02, 1, 0.65, 0.3);
  const boca = bola(cabeca, mat("#b0475a", { roughness: 0.5 }), 0.03, 0, 0.22, rostoZ(0, 0.22) - 0.008, 1.4, 0.6, 0.5);

  // orelhas do capuz, conforme o traje
  const orelhas: TH.Object3D[] = [];
  const corOrelha = tipo === "panda" ? detalhe : capuz;
  const dentro = tipo === "panda" ? detalhe : tipo === "coelho" ? mat("#ffffff") : detalhe;
  for (const lado of [-1, 1]) {
    if (tipo === "coelho") {
      const g = grupo(cabeca, lado * 0.2, TOPO_CAPUZ - 0.1, 0);
      forma(g, new THREE.CapsuleGeometry(0.09, 0.46, 8, 16), corOrelha, 0, 0.28, 0);
      const miolo = forma(g, new THREE.CapsuleGeometry(0.05, 0.36, 6, 12), dentro, 0, 0.28, 0.055);
      miolo.scale.z = 0.5;
      g.rotation.z = -lado * 0.16;
      orelhas.push(g);
    } else if (tipo === "gato" || tipo === "raposa") {
      const alto = tipo === "raposa" ? 0.34 : 0.26;
      const g = grupo(cabeca, lado * 0.3, TOPO_CAPUZ - 0.13, 0);
      forma(g, new THREE.ConeGeometry(0.15, alto, 18), corOrelha, 0, alto / 2, 0);
      const miolo = forma(g, new THREE.ConeGeometry(0.085, alto * 0.7, 14), dentro, 0, alto * 0.42, 0.06);
      miolo.scale.z = 0.5;
      if (tipo === "raposa") forma(g, new THREE.ConeGeometry(0.06, alto * 0.4, 12), mat(cores.luvas), 0, alto * 0.81, 0);
      g.rotation.z = -lado * 0.3;
      orelhas.push(g);
    } else {
      const r = tipo === "redonda" || tipo === "original" ? 0.15 : 0.13;
      const g = grupo(cabeca, lado * 0.35, TOPO_CAPUZ - 0.1, 0);
      bola(g, corOrelha, r, 0, 0, 0, 1, 1, 0.6);
      bola(g, dentro, r * 0.58, 0, 0, r * 0.38, 1, 1, 0.5);
      orelhas.push(g);
    }
  }
  topo = PESCOCO + TOPO_CAPUZ + ({ coelho: 0.56, raposa: 0.24, gato: 0.16 }[tipo] ?? 0.08);
  if (tipo === "coelho") {
    // presilha de estrela junto de uma das orelhas (a cor segue "detalhes")
    const presilha = forma(cabeca, new THREE.OctahedronGeometry(0.085), detalhe, 0.34, TOPO_CAPUZ - 0.1, 0.16);
    presilha.scale.set(1, 1, 0.45);
    presilha.rotation.z = 0.4;
  }
  if (tipo === "veterano") {
    const aro = forma(cabeca, new THREE.TorusGeometry(0.44, 0.022, 8, 40), mat("#f2c14e", { emissive: "#f2c14e", emissiveIntensity: 0.9 }), 0, CAPUZ.y + 0.06, 0.02);
    aro.rotation.x = Math.PI / 2 - 0.5;
  }

  // ---------------- modelo 3D do HOSHI clássico ----------------
  // Com o modelo, o corpo montado por formas sai e entra a malha com textura; a "cabeça" do
  // boneco continua existindo (vazia) só para segurar chapéus e óculos no lugar certo.
  const usaModelo = !!modelo && tipo === "redonda";
  if (usaModelo && modelo) {
    const formas: TH.Object3D[] = [];
    corpo.traverse((o) => {
      if (o instanceof THREE.Mesh) formas.push(o);
    });
    formas.forEach((o) => o.parent?.remove(o));

    const s = (PESCOCO + TOPO_CAPUZ + 0.14) / MODELO.altura;
    const matModelo = new THREE.MeshStandardMaterial({ map: modelo.tex, roughness: 0.85 });
    lixo.push(matModelo);
    // troca de cor: o vermelho da textura vira a cor principal e o branco vira a cor de detalhe
    const corPrincipal = { value: new THREE.Color(cores.principal) };
    const corDetalhe = { value: new THREE.Color(cores.detalhe) };
    matModelo.onBeforeCompile = (sh) => {
      sh.uniforms["uPrincipal"] = corPrincipal;
      sh.uniforms["uDetalhe"] = corDetalhe;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uPrincipal;\nuniform vec3 uDetalhe;")
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          float verm = smoothstep(0.12, 0.4, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));
          diffuseColor.rgb = mix(diffuseColor.rgb, uPrincipal * clamp(diffuseColor.r / 0.8, 0.0, 1.25), verm);
          float claro = smoothstep(0.62, 0.85, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)));
          diffuseColor.rgb = mix(diffuseColor.rgb, uDetalhe * clamp(diffuseColor.g / 0.92, 0.0, 1.1), claro);`,
        );
    };
    const malha = new THREE.Mesh(modelo.geo, matModelo);
    malha.scale.setScalar(s);
    corpo.add(malha);

    // alinha a "cabeça" invisível com a cabeça do modelo
    const c = MODELO.cabeca;
    cabeca.scale.set((s * c.rx) / (CAPUZ.r * CAPUZ.s[0]), (s * c.ry) / (CAPUZ.r * CAPUZ.s[1]), (s * c.rz) / (CAPUZ.r * CAPUZ.s[2]));
    cabeca.position.set(0, s * c.y - cabeca.scale.y * CAPUZ.y, 0);
    largura = Math.max(largura, s * 0.75 + 0.1);
  }

  // ---------------- chapéus ----------------
  if (chapeu) {
    const m = mat(chapeu.tipo === "festa" ? cores.acessorio : chapeu.cor, { side: THREE.DoubleSide, roughness: 0.6 });
    if (chapeu.tipo === "bone") {
      casca(cabeca, CAPUZ, m, 0, 0.3, 1.05);
      const aba = forma(cabeca, new THREE.CylinderGeometry(0.3, 0.3, 0.035, 28), m, 0, CAPUZ.y + CAPUZ.r * 0.6, 0.47);
      aba.scale.set(1, 1, 0.75);
      aba.rotation.x = 0.18;
      bola(cabeca, branco, 0.04, 0, TOPO_CAPUZ + 0.045, 0);
    } else if (chapeu.tipo === "festa") {
      forma(cabeca, new THREE.ConeGeometry(0.19, 0.5, 20), m, 0, TOPO_CAPUZ + 0.2, 0);
      bola(cabeca, branco, 0.065, 0, TOPO_CAPUZ + 0.47, 0);
      topo = Math.max(topo, PESCOCO + TOPO_CAPUZ + 0.56);
    } else if (chapeu.tipo === "cartola") {
      forma(cabeca, new THREE.CylinderGeometry(0.24, 0.24, 0.38, 26), m, 0, TOPO_CAPUZ + 0.15, 0);
      forma(cabeca, new THREE.CylinderGeometry(0.42, 0.42, 0.035, 30), m, 0, TOPO_CAPUZ - 0.03, 0);
      forma(cabeca, new THREE.CylinderGeometry(0.245, 0.245, 0.075, 26), vermelho, 0, TOPO_CAPUZ + 0.03, 0);
      topo = Math.max(topo, PESCOCO + TOPO_CAPUZ + 0.38);
    } else if (chapeu.tipo === "coroa") {
      const aro = forma(cabeca, new THREE.CylinderGeometry(0.27, 0.23, 0.17, 26, 1, true), ouro, 0, TOPO_CAPUZ + 0.03, 0);
      (aro.material as TH.MeshStandardMaterial).side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        forma(cabeca, new THREE.ConeGeometry(0.05, 0.14, 8), ouro, Math.cos(a) * 0.255, TOPO_CAPUZ + 0.18, Math.sin(a) * 0.255);
      }
      bola(cabeca, vermelho, 0.04, 0, TOPO_CAPUZ + 0.04, 0.26);
      topo = Math.max(topo, PESCOCO + TOPO_CAPUZ + 0.28);
    } else if (chapeu.tipo === "tiara") {
      const aro = forma(cabeca, new THREE.TorusGeometry(0.47, 0.02, 8, 40, Math.PI), ouro, 0, CAPUZ.y + 0.1, 0.02);
      aro.scale.set(CAPUZ.s[0], 1, 1);
      const estrela = forma(cabeca, new THREE.OctahedronGeometry(0.09), mat("#f2c14e", { emissive: "#f2c14e", emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }), 0, TOPO_CAPUZ + 0.08, 0.02);
      estrela.scale.set(1, 1, 0.4);
      topo = Math.max(topo, PESCOCO + TOPO_CAPUZ + 0.2);
    }
  }

  // ---------------- óculos ----------------
  // no modelo 3D os olhos ficam mais baixos que no boneco montado
  const yOlho = usaModelo ? 0.24 : 0.36;
  if (visual.oculos === "oculos:escuros") {
    for (const lado of [-1, 1]) bola(cabeca, preto, 0.105, lado * 0.15, yOlho, rostoZ(0.15, yOlho) + 0.025, 1, 0.85, 0.35);
    forma(cabeca, new THREE.BoxGeometry(0.1, 0.025, 0.025), preto, 0, yOlho + 0.02, rostoZ(0, yOlho + 0.02) + 0.03);
    olhos.forEach((o) => (o.visible = false));
  } else if (visual.oculos === "oculos:visor") {
    casca(cabeca, ROSTO, mat("#ff2a2a", { emissive: "#ff1a1a", emissiveIntensity: 1.5, roughness: 0.2, side: THREE.DoubleSide }), usaModelo ? 0.52 : 0.4, usaModelo ? 0.68 : 0.56, 1.05, 0.2 * Math.PI, 0.6 * Math.PI);
    olhos.forEach((o) => (o.visible = false));
  }

  // ---------------- costas ----------------
  let capa: TH.Mesh | null = null;
  let forro: TH.Mesh | null = null;
  let pano: TH.Mesh | null = null;
  const asas: TH.Object3D[] = [];
  if (costas?.tipo === "capa") {
    const pivo = grupo(corpo, 0, 0.8, -0.21);
    const g = new THREE.PlaneGeometry(0.7, 0.62, 6, 8);
    g.translate(0, -0.31, 0);
    capa = forma(pivo, g, mat(costas.cor, { side: THREE.DoubleSide, roughness: 0.7 }), 0, 0, 0);
    if (costas.id === "capa:noite") forro = forma(pivo, g.clone(), mat("#ce0e0e", { side: THREE.DoubleSide }), 0, 0, 0.01);
  } else if (costas?.tipo === "mochila") {
    const m = mat(cores.acessorio, { roughness: 0.7 });
    bola(corpo, m, 0.17, 0, 0.54, -0.29, 1.1, 1.2, 0.7);
    bola(corpo, mat(new THREE.Color(cores.acessorio).multiplyScalar(0.75)), 0.1, 0, 0.48, -0.4, 1.1, 0.8, 0.5);
  } else if (costas?.tipo?.startsWith("bandeira")) {
    forma(corpo, new THREE.CylinderGeometry(0.016, 0.016, 1.5, 8), mat("#d8d8d8", { metalness: 0.6, roughness: 0.3 }), 0.17, 1.15, -0.3);
    bola(corpo, ouro, 0.03, 0.17, 1.92, -0.3);
    const mapa = costas.listras
      ? listrado(costas.listras)
      : textura(160, 100, (c) => {
          if (costas.tipo === "bandeira-brasil") {
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
    const g = new THREE.PlaneGeometry(0.5, 0.32, 8, 1);
    g.translate(0.25, 0, 0);
    pano = forma(corpo, g, mat("#ffffff", { map: mapa, side: THREE.DoubleSide, roughness: 0.7 }), 0.185, 1.72, -0.3);
    topo = Math.max(topo, 1.98);
    largura = 2;
  } else if (costas?.tipo === "asas") {
    for (const lado of [-1, 1]) {
      const g = grupo(corpo, lado * 0.08, 0.62, -0.24);
      bola(g, branco, 0.2, lado * 0.2, 0.1, 0, 0.6, 1.05, 0.14).rotation.z = -lado * 0.6;
      bola(g, branco, 0.14, lado * 0.17, -0.07, 0, 0.6, 0.9, 0.14).rotation.z = -lado * 1.0;
      asas.push(g);
    }
    largura = 1.9;
  }

  // ---------------- efeitos ----------------
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
      brilhos.push(forma(raiz, new THREE.OctahedronGeometry(0.035), mat(cor, { emissive: cor, emissiveIntensity: 2 }), 0, 0, 0));
    }
    largura = Math.max(largura, 1.9);
  } else if (efeito?.tipo === "aura") {
    const m = new THREE.MeshBasicMaterial({ color: efeito.cor, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    lixo.push(m);
    aura = forma(raiz, new THREE.RingGeometry(0.4, 0.85, 48), m, 0, 0.02, 0);
    aura.rotation.x = -Math.PI / 2;
    largura = Math.max(largura, 1.9);
  } else if (efeito?.tipo === "aureola") {
    aureola = forma(corpo, new THREE.TorusGeometry(0.24, 0.026, 10, 40), mat(efeito.cor, { emissive: "#ffc94a", emissiveIntensity: 2 }), 0, topo + 0.14, 0);
    aureola.rotation.x = Math.PI / 2;
    topo += 0.22;
  }
  const corAura = new THREE.Color();
  const estrela = corpo.getObjectByName("estrela");
  if (usaModelo) {
    const caixa = new THREE.Box3().setFromObject(raiz);
    topo = Math.max(caixa.max.y, 0.5);
    largura = Math.max(largura, (Math.max(Math.abs(caixa.min.x), Math.abs(caixa.max.x)) + 0.06) * 2);
  }
  const alturaAureola = topo - 0.08;

  // =================== animação ===================
  let giro = 0;
  let inclinaAtual = 0;
  let sentado = 0;
  let olharX = 0;
  let olharY = 0;

  function atualizar(q: Quadro) {
    const { t, humor, reacao, p, mouse } = q;
    const dorme = humor === "dormindo";
    const feliz = humor === "feliz";
    const triste = humor === "triste";
    const ritmo = q.calmo ? 0 : dorme ? 0.4 : 1;

    let salto = 0;
    let giroExtra = 0;
    let rolar = 0;
    let mortal = 0;
    let andaX = 0;
    let inclina = triste ? 0.1 : 0;
    let cabX = dorme ? 0.35 : triste ? 0.2 + mouse.y * 0.08 : mouse.y * 0.2;
    let cabY = dorme ? 0 : mouse.x * 0.45;
    let cabZ = feliz ? Math.sin(t * 1.6) * 0.06 * ritmo : Math.sin(t * 0.8) * 0.02 * ritmo;
    let olho = dorme || t % 3.8 < 0.13 ? 0.1 : 1;
    let abre = dorme ? 0.5 : triste ? 0.6 : 1;
    const bE = { x: 0, z: -0.1 };
    const bD = { x: 0, z: 0.1 };
    let pE = 0;
    let pD = 0;
    let orelha = triste || dorme ? 0.35 : Math.max(0, Math.sin(t * 0.9) - 0.93) * 3;
    let alvoSentado = dorme ? 1 : 0;

    // descanso: balanço leve dos braços; feliz dá pulinhos e acena de vez em quando
    if (!reacao && ritmo) {
      bE.z -= Math.sin(t * 1.4) * 0.05;
      bD.z += Math.sin(t * 1.4) * 0.05;
      if (feliz) {
        salto = Math.abs(Math.sin(t * 3.1)) * 0.04;
        if (t % 9 < 1.6) bD.z = 2.4 + Math.sin(t * 13) * 0.3;
      }
      if (!dorme && t % 13 > 11) cabY += Math.sin((t % 13) * 4) * 0.45;
    }

    if (reacao) {
      const k = (dur: number) => (p < dur ? p / dur : -1);
      let x: number;
      if ((reacao === "comer" || reacao === "beber") && k(1.5) >= 0) {
        bE.x = bD.x = -1.5;
        bE.z = 0.45;
        bD.z = -0.45;
        cabX = 0.22 + Math.sin(p * 20) * 0.07;
        abre = reacao === "comer" ? 0.8 + Math.abs(Math.sin(p * 14)) * 2.4 : 2;
      } else if (reacao === "carinho" && k(1.6) >= 0) {
        olho = 0.1;
        cabZ = Math.sin(p * 9) * 0.22;
        salto = Math.abs(Math.sin(p * 8)) * 0.04;
        orelha = Math.sin(p * 12) * 0.2;
        abre = 2;
      } else if (reacao === "dormir" && k(2.5) >= 0) {
        alvoSentado = 1;
        olho = 0.1;
        cabX = 0.35;
      } else if (reacao === "festa" && (x = k(1.6)) >= 0) {
        salto = Math.sin(x * Math.PI) * 0.55;
        giroExtra = x * Math.PI * 2;
        bE.z = -2.7;
        bD.z = 2.7;
        abre = 2.4;
      } else if (reacao === "acenar" && k(2) >= 0) {
        bD.z = 2.45 + Math.sin(p * 13) * 0.35;
        cabZ = 0.12;
        abre = 2;
      } else if (reacao === "girar" && (x = k(1)) >= 0) {
        giroExtra = (1 - Math.pow(1 - x, 3)) * Math.PI * 2;
        bE.z = -1.2;
        bD.z = 1.2;
      } else if (reacao === "rolar" && (x = k(1.2)) >= 0) {
        rolar = x * Math.PI * 2;
        salto = Math.sin(x * Math.PI) * 0.35;
        bE.z = -2.6;
        bD.z = 2.6;
      } else if (reacao === "dancar" && k(3) >= 0) {
        const b = Math.sin(p * 8);
        bE.z = -1.3 - b * 1.1;
        bD.z = 1.3 - b * 1.1;
        pE = Math.max(0, b) * 0.5;
        pD = Math.max(0, -b) * 0.5;
        rolar = b * 0.12;
        giroExtra = Math.sin(p * 4) * 0.6;
        salto = Math.abs(b) * 0.07;
        cabZ = -b * 0.16;
        abre = 2.2;
      } else if (reacao === "correr" && (x = k(2.6)) >= 0) {
        const volta = x * Math.PI * 2;
        andaX = Math.sin(volta) * 0.5;
        giroExtra = Math.PI / 2 + volta;
        pE = Math.sin(p * 20) * 0.9;
        pD = -pE;
        bE.x = -pE * 0.9;
        bD.x = pE * 0.9;
        inclina = 0.18;
        salto = Math.abs(Math.sin(p * 20)) * 0.05;
      } else if (reacao === "mortal" && (x = k(1.1)) >= 0) {
        mortal = -x * Math.PI * 2;
        salto = Math.sin(x * Math.PI) * 0.75;
        pE = pD = -0.9;
        bE.x = bD.x = -1.1;
      } else if (reacao === "cumprimentar" && (x = k(1.7)) >= 0) {
        inclina = Math.sin(x * Math.PI) * 0.6;
        bD.x = -Math.sin(x * Math.PI);
        bD.z = -0.5;
        if (x > 0.25 && x < 0.75) olho = 0.1;
      }
    }

    // sentar para dormir: as pernas vão para a frente e o corpo desce
    sentado += (alvoSentado - sentado) * 0.06;
    if (sentado > 0.02) {
      pE = pE * (1 - sentado) - 1.45 * sentado;
      pD = pD * (1 - sentado) - 1.45 * sentado;
    }

    giro += ((dorme ? 0 : mouse.x * 0.22) - giro) * 0.08;
    inclinaAtual += (inclina - inclinaAtual) * 0.12;
    raiz.position.set(andaX, salto - sentado * (usaModelo ? 0.06 : 0.2), 0);
    raiz.rotation.y = giro + giroExtra;
    eixo.rotation.set(mortal + inclinaAtual, 0, rolar);
    const respira = 1 + Math.sin(t * 2.1 * ritmo) * (usaModelo ? 0.018 : 0.012);
    // no modelo, a alegria aparece como um "amassa e estica" ao pular
    const estica = usaModelo ? 1 + Math.min(0.08, salto * 0.18) - sentado * 0.06 : 1;
    corpo.scale.set(1 / Math.sqrt(estica), respira * estica, 1 / Math.sqrt(estica));
    if (usaModelo) {
      olharX += (cabX * 0.35 - olharX) * 0.12;
      olharY += (cabY * 0.6 - olharY) * 0.1;
      corpo.rotation.set(olharX, olharY, cabZ * 0.8);
    } else {
      cabeca.rotation.x += (cabX - cabeca.rotation.x) * 0.15;
      cabeca.rotation.y += (cabY - cabeca.rotation.y) * 0.1;
      cabeca.rotation.z = cabZ;
    }
    olhos.forEach((o) => (o.scale.y = olho));
    boca.scale.y = 0.03 * 0.6 * Math.max(0.5, Math.min(3, abre));
    bracoE.rotation.set(bE.x, 0, bE.z);
    bracoD.rotation.set(bD.x, 0, bD.z);
    pernaE.rotation.x = pE;
    pernaD.rotation.x = pD;
    orelhas.forEach((o, i) => {
      const lado = i ? 1 : -1;
      const base = tipo === "coelho" ? 0.16 : tipo === "gato" || tipo === "raposa" ? 0.3 : 0;
      o.rotation.z = -lado * (base + orelha);
    });

    // acessórios em movimento
    if (capa) {
      const balanco = 0.25 + Math.sin(t * 2.2) * 0.07 * ritmo + Math.min(0.9, salto * 1.4 + Math.abs(andaX) * 0.5);
      capa.rotation.x = balanco;
      if (forro) forro.rotation.x = balanco;
    }
    if (pano) pano.rotation.y = Math.sin(t * 3.2) * 0.3 * (q.calmo ? 0 : 1);
    asas.forEach((a, i) => (a.rotation.y = (i ? 1 : -1) * (0.25 + Math.sin(t * 5) * 0.3 * (q.calmo ? 0 : 1))));
    if (estrela) estrela.rotation.z = Math.sin(t * 1.5) * 0.2 * ritmo;
    brilhos.forEach((b, i) => {
      const a = t * 0.8 + (i / brilhos.length) * Math.PI * 2;
      const r = 0.7 + Math.sin(t * 1.3 + i) * 0.12;
      b.position.set(Math.cos(a) * r, 0.15 + ((i * 0.37 + t * 0.22) % 1.75), Math.sin(a) * r);
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
      luz.intensity = 5 + Math.sin(t * 2.4) * 2;
    }
    if (aureola) aureola.position.y = alturaAureola + Math.sin(t * 2) * 0.03;
    return salto;
  }

  return { raiz, atualizar, topo, largura, descartar: () => lixo.forEach((l) => l.dispose()) };
}
