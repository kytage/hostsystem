import type * as TH from "three";

/**
 * Cosméticos novos do boneco, feitos só com formas simples (leves para a praça):
 * chapéus e orelhinhas na cabeça, ursinho e asinhas nas costas e coraçõezinhos
 * flutuando em volta.
 *
 * Tudo é montado em metros, no "chão" do boneco parado (pés em y = 0, rosto para +Z).
 * `topo` é a altura do alto da cabeça: 1,83 no masculino e 1,81 no feminino.
 * No feminino, o que desce atrás da cabeça fica mais alto, para não brigar com
 * o rabo de cavalo (que sai de y = 1,735, z = -0,1).
 */

export const BONE_HOST = "chapeu:bone-host";
export const CHAPEU_COWBOY = "chapeu:cowboy";
export const CHAPEU_PIRATA = "chapeu:pirata-capitao";
export const GORRO_INVERNO = "chapeu:gorro-inverno";
export const CAPACETE_VIKING = "chapeu:capacete-viking";
export const GORRO_NATAL = "chapeu:gorro-natal";
export const ORELHAS_GATO = "chapeu:orelhas-gato";
export const ORELHAS_URSO = "chapeu:orelhas-urso";
export const LACO_FOFO = "chapeu:laco-fofo";
export const AUREOLA_ANJO = "chapeu:aureola-anjo";
export const URSINHO_COSTAS = "costas:ursinho";
export const ASAS_ANJO = "costas:asas-anjo";
export const ASAS_FADA = "costas:asas-fada";
export const CORACOES_FLUTUANDO = "efeito:coracoes-flutuando";

/** Um enfeite pronto para pôr no suporte, com a animação de cada quadro (se tiver). */
export interface Enfeite {
  objeto: TH.Object3D;
  /** t em segundos; `mexendo` de 0 (parado) a 1 (correndo). */
  animar?: (t: number, mexendo: number) => void;
}

/* ---------------- materiais e moldes divididos entre todos os bonecos ---------------- */

const mats = new Map<string, TH.MeshStandardMaterial>();
function mat(
  THREE: typeof TH,
  cor: string,
  o: TH.MeshStandardMaterialParameters = {},
): TH.MeshStandardMaterial {
  const chave = `${cor}|${JSON.stringify(o)}`;
  let m = mats.get(chave);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, ...o });
    mats.set(chave, m);
  }
  return m;
}

function malha(THREE: typeof TH, g: TH.BufferGeometry, m: TH.Material, nome = "") {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  if (nome) x.name = nome;
  return x;
}

/** Os moldes ficam guardados; cada boneco recebe uma cópia (que divide formas e materiais). */
const moldes = new Map<string, TH.Object3D>();
function copia(chave: string, montar: () => TH.Object3D) {
  let m = moldes.get(chave);
  if (!m) {
    m = montar();
    moldes.set(chave, m);
  }
  return m.clone();
}

/** Calota que veste a cabeça (meia esfera achatada), com a borda em `baseY`. */
function calota(THREE: typeof TH, raio: number, altura: number) {
  const g = new THREE.SphereGeometry(raio, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, altura / raio, 1.06);
  return g;
}

/* ---------------- cabeça ---------------- */

function bone(THREE: typeof TH) {
  const g = new THREE.Group();
  const vermelho = mat(THREE, "#ce0e0e", { roughness: 0.8 });
  g.add(malha(THREE, calota(THREE, 0.1, 0.085), vermelho));
  // aba para a frente, um pouco inclinada para baixo
  const aba = new THREE.CylinderGeometry(0.088, 0.088, 0.008, 22, 1, false, -Math.PI / 2, Math.PI);
  aba.scale(1, 1, 1.35);
  const mAba = malha(THREE, aba, mat(THREE, "#161618", { roughness: 0.8 }));
  mAba.position.set(0, 0.004, 0.045);
  mAba.rotation.x = 0.14;
  g.add(mAba);
  // botãozinho no alto e a faixa clara na frente
  const botao = malha(THREE, new THREE.SphereGeometry(0.011, 8, 6), vermelho);
  botao.position.y = 0.085;
  g.add(botao);
  const faixa = malha(
    THREE,
    new THREE.BoxGeometry(0.07, 0.022, 0.006),
    mat(THREE, "#f4f4f2", { roughness: 0.8 }),
  );
  faixa.position.set(0, 0.04, 0.097);
  faixa.rotation.x = -0.45;
  g.add(faixa);
  return g;
}

function cowboy(THREE: typeof TH) {
  const g = new THREE.Group();
  const couro = mat(THREE, "#9a6331", { roughness: 0.85 });
  // aba larga, levantada dos lados
  const aba = new THREE.CylinderGeometry(0.2, 0.2, 0.01, 32, 1);
  const pos = aba.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, pos.getY(i) + Math.pow(Math.abs(x) / 0.2, 2.2) * 0.055 - ((z * z) / 0.04) * 0.008);
  }
  aba.computeVertexNormals();
  aba.scale(1, 1, 0.92);
  g.add(malha(THREE, aba, couro));
  // copa com o vinco em cima
  const copa = new THREE.CylinderGeometry(0.078, 0.098, 0.12, 24, 3);
  const pc = copa.getAttribute("position");
  for (let i = 0; i < pc.count; i++)
    if (pc.getY(i) > 0.05) pc.setY(i, pc.getY(i) - Math.max(0, 0.03 - Math.abs(pc.getX(i)) * 0.5));
  copa.computeVertexNormals();
  copa.translate(0, 0.06, 0);
  g.add(malha(THREE, copa, couro));
  const fita = malha(
    THREE,
    new THREE.CylinderGeometry(0.096, 0.099, 0.022, 24, 1, true),
    mat(THREE, "#3a2416", { side: THREE.DoubleSide }),
  );
  fita.position.y = 0.017;
  g.add(fita);
  return g;
}

function pirata(THREE: typeof TH) {
  const g = new THREE.Group();
  const preto = mat(THREE, "#141416", { roughness: 0.75 });
  g.add(malha(THREE, calota(THREE, 0.1, 0.07), preto));
  // a meia-lua de ponta a ponta (bicorne)
  const lua = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 28, 1, false, Math.PI / 2, Math.PI);
  lua.rotateX(Math.PI / 2);
  lua.scale(1, 0.62, 1);
  g.add(malha(THREE, lua, preto));
  // borda dourada
  const borda = new THREE.TorusGeometry(0.18, 0.006, 6, 28, Math.PI);
  borda.scale(1, 0.62, 1);
  const ouro = mat(THREE, "#e0b53a", { metalness: 0.6, roughness: 0.35 });
  const b1 = malha(THREE, borda, ouro);
  b1.position.z = 0.026;
  g.add(b1);
  // caveira e ossinhos cruzados na frente
  const branco = mat(THREE, "#f4f2ea", { roughness: 0.6 });
  const caveira = malha(THREE, new THREE.SphereGeometry(0.02, 12, 8), branco);
  caveira.position.set(0, 0.06, 0.03);
  caveira.scale.set(1, 1, 0.5);
  g.add(caveira);
  for (const lado of [-1, 1]) {
    const osso = malha(THREE, new THREE.CapsuleGeometry(0.0045, 0.05, 2, 6), branco);
    osso.position.set(0, 0.06, 0.028);
    osso.rotation.z = lado * 0.8;
    g.add(osso);
  }
  return g;
}

function gorroInverno(THREE: typeof TH) {
  const g = new THREE.Group();
  const azul = mat(THREE, "#1f3a7a", { roughness: 0.95 });
  g.add(malha(THREE, calota(THREE, 0.102, 0.11), azul));
  // barra dobrada (fica da borda para cima: no feminino não encosta no rabo de cavalo)
  const barra = malha(
    THREE,
    new THREE.CylinderGeometry(0.106, 0.108, 0.034, 24, 1, true),
    mat(THREE, "#e9e6dc", { roughness: 1, side: THREE.DoubleSide }),
  );
  barra.position.y = 0.017;
  g.add(barra);
  const pompom = malha(
    THREE,
    new THREE.IcosahedronGeometry(0.03, 1),
    mat(THREE, "#f4f2ea", { roughness: 1, flatShading: true }),
  );
  pompom.position.y = 0.125;
  g.add(pompom);
  return g;
}

/** Chifre curvo: sai para o lado e vira para cima. */
function chifre(THREE: typeof TH) {
  const h = 0.15;
  const alfa = 1.35;
  const R = h / alfa;
  const g = new THREE.ConeGeometry(0.024, h, 10, 8);
  g.translate(0, h / 2, 0);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const phi = (y / h) * alfa;
    // centro da curva começa apontando para +X e sobe
    const cx = R * Math.sin(phi);
    const cy = R * (1 - Math.cos(phi));
    pos.setXYZ(i, cx - Math.sin(phi) * x, cy + Math.cos(phi) * x, z);
  }
  g.computeVertexNormals();
  return g;
}

function viking(THREE: typeof TH) {
  const g = new THREE.Group();
  const aco = mat(THREE, "#9aa1a8", { metalness: 0.7, roughness: 0.35 });
  g.add(malha(THREE, calota(THREE, 0.104, 0.1), aco));
  const bronze = mat(THREE, "#b07a32", { metalness: 0.6, roughness: 0.4 });
  const aro = malha(THREE, new THREE.CylinderGeometry(0.108, 0.108, 0.026, 24, 1, true), bronze);
  aro.position.y = 0.013;
  g.add(aro);
  // tira do meio, de trás para a frente
  const tira = malha(THREE, new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI), bronze);
  tira.rotation.y = Math.PI / 2;
  g.add(tira);
  // protetor de nariz
  const nariz = malha(THREE, new THREE.BoxGeometry(0.018, 0.05, 0.008), aco);
  nariz.position.set(0, -0.012, 0.108);
  g.add(nariz);
  const marfim = mat(THREE, "#efe6cf", { roughness: 0.55 });
  const geo = chifre(THREE);
  for (const lado of [1, -1]) {
    const c = malha(THREE, geo, marfim);
    c.position.set(lado * 0.088, 0.04, 0);
    if (lado < 0) c.rotation.y = Math.PI;
    g.add(c);
  }
  return g;
}

function gorroNatal(THREE: typeof TH) {
  const g = new THREE.Group();
  const h = 0.24;
  const cone = new THREE.ConeGeometry(0.1, h, 20, 10, true);
  cone.translate(0, h / 2, 0);
  // a ponta cai para trás
  const pos = cone.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h;
    pos.setZ(i, pos.getZ(i) - t * t * 0.13);
    pos.setY(i, pos.getY(i) - t * t * 0.05);
  }
  cone.computeVertexNormals();
  g.add(malha(THREE, cone, mat(THREE, "#c8141c", { roughness: 0.9, side: THREE.DoubleSide })));
  const branco = mat(THREE, "#f6f4ee", { roughness: 1 });
  const pelo = malha(THREE, new THREE.TorusGeometry(0.1, 0.02, 8, 24), branco);
  pelo.rotation.x = Math.PI / 2;
  pelo.position.y = 0.014;
  g.add(pelo);
  const pompom = malha(THREE, new THREE.SphereGeometry(0.026, 12, 8), branco);
  pompom.position.set(0, h - 0.05, -0.13);
  g.add(pompom);
  return g;
}

/** Tiara fina por cima da cabeça, de orelha a orelha (no plano do meio da cabeça). */
function tiara(THREE: typeof TH, cor: string) {
  const t = malha(
    THREE,
    new THREE.TorusGeometry(0.09, 0.005, 6, 24, Math.PI),
    mat(THREE, cor, { roughness: 0.5 }),
  );
  t.position.y = -0.085;
  return t;
}

function orelhasGato(THREE: typeof TH) {
  const g = new THREE.Group();
  g.add(tiara(THREE, "#1a1a1d"));
  const fora = new THREE.ConeGeometry(0.04, 0.08, 4);
  fora.scale(1, 1, 0.45);
  const dentro = new THREE.ConeGeometry(0.026, 0.052, 4);
  dentro.scale(1, 1, 0.3);
  for (const lado of [-1, 1]) {
    const o = new THREE.Group();
    o.position.set(lado * 0.06, 0.012, 0.0);
    o.rotation.z = -lado * 0.5;
    o.add(malha(THREE, fora, mat(THREE, "#1a1a1d", { roughness: 0.6 })));
    const d = malha(THREE, dentro, mat(THREE, "#f7a8c8", { roughness: 0.6 }));
    d.position.set(0, -0.008, 0.011);
    o.add(d);
    g.add(o);
  }
  return g;
}

function orelhasUrso(THREE: typeof TH) {
  const g = new THREE.Group();
  g.add(tiara(THREE, "#6b4226"));
  const fora = new THREE.SphereGeometry(0.034, 14, 10);
  fora.scale(1, 1, 0.5);
  const dentro = new THREE.SphereGeometry(0.019, 12, 8);
  dentro.scale(1, 1, 0.4);
  for (const lado of [-1, 1]) {
    const o = new THREE.Group();
    o.position.set(lado * 0.064, -0.012, 0);
    o.add(malha(THREE, fora, mat(THREE, "#8a5a36", { roughness: 0.95 })));
    const d = malha(THREE, dentro, mat(THREE, "#e8c9a0", { roughness: 0.9 }));
    d.position.z = 0.012;
    o.add(d);
    g.add(o);
  }
  return g;
}

function laco(THREE: typeof TH) {
  const g = new THREE.Group();
  const rosa = mat(THREE, "#ff6fae", { roughness: 0.45 });
  const asa = new THREE.ConeGeometry(0.032, 0.06, 10);
  asa.scale(1, 1, 0.45);
  for (const lado of [-1, 1]) {
    const a = malha(THREE, asa, rosa);
    a.rotation.z = (lado * Math.PI) / 2;
    a.position.x = lado * 0.03;
    g.add(a);
  }
  g.add(malha(THREE, new THREE.SphereGeometry(0.016, 10, 8), mat(THREE, "#e84f93")));
  // de lado, no alto da cabeça
  g.scale.setScalar(1.5);
  g.position.set(0.05, -0.008, 0.0);
  g.rotation.set(0, 0.25, -0.5);
  const fora = new THREE.Group();
  fora.add(g);
  return fora;
}

function aureola(THREE: typeof TH): Enfeite {
  const anel = malha(
    THREE,
    copiaGeo("aureola", () => new THREE.TorusGeometry(0.07, 0.009, 8, 32)),
    mat(THREE, "#ffd75e", {
      emissive: "#ffb800",
      emissiveIntensity: 1.2,
      metalness: 0.4,
      roughness: 0.3,
    }),
  );
  anel.rotation.x = Math.PI / 2 - 0.15;
  anel.castShadow = false;
  const g = new THREE.Group();
  g.add(anel);
  return {
    objeto: g,
    animar: (t) => {
      anel.position.y = 0.075 + Math.sin(t * 2.2) * 0.008;
    },
  };
}

/* ---------------- costas ---------------- */

function ursinho(THREE: typeof TH) {
  const g = new THREE.Group();
  const pelo = mat(THREE, "#a0673a", { roughness: 1 });
  const claro = mat(THREE, "#e8c9a0", { roughness: 1 });
  const olho = mat(THREE, "#111111", { roughness: 0.3 });
  const corpo = malha(THREE, new THREE.SphereGeometry(0.075, 16, 12), pelo);
  corpo.scale.set(1, 1.15, 0.8);
  g.add(corpo);
  const barriga = malha(THREE, new THREE.SphereGeometry(0.045, 12, 8), claro);
  barriga.position.set(0, -0.01, -0.05);
  barriga.scale.set(1, 1.1, 0.5);
  g.add(barriga);
  const cabeca = new THREE.Group();
  cabeca.position.set(0, 0.115, -0.01);
  cabeca.add(malha(THREE, new THREE.SphereGeometry(0.058, 16, 12), pelo));
  const focinho = malha(THREE, new THREE.SphereGeometry(0.024, 10, 8), claro);
  focinho.position.set(0, -0.012, -0.05);
  focinho.scale.set(1.2, 0.9, 0.8);
  cabeca.add(focinho);
  const nariz = malha(THREE, new THREE.SphereGeometry(0.008, 8, 6), olho);
  nariz.position.set(0, -0.006, -0.07);
  cabeca.add(nariz);
  for (const lado of [-1, 1]) {
    const o = malha(THREE, new THREE.SphereGeometry(0.007, 8, 6), olho);
    o.position.set(lado * 0.022, 0.012, -0.052);
    cabeca.add(o);
    const orelha = malha(THREE, new THREE.SphereGeometry(0.02, 10, 8), pelo);
    orelha.position.set(lado * 0.044, 0.042, 0);
    orelha.scale.set(1, 1, 0.6);
    cabeca.add(orelha);
  }
  g.add(cabeca);
  // bracinhos abraçando por cima dos ombros e perninhas penduradas
  for (const lado of [-1, 1]) {
    const braco = malha(THREE, new THREE.CapsuleGeometry(0.02, 0.07, 4, 8), pelo);
    braco.position.set(lado * 0.07, 0.07, 0.03);
    braco.rotation.set(0.9, 0, lado * 0.9);
    g.add(braco);
    const perna = malha(THREE, new THREE.CapsuleGeometry(0.022, 0.05, 4, 8), pelo);
    perna.position.set(lado * 0.045, -0.095, 0.0);
    perna.rotation.z = lado * 0.25;
    g.add(perna);
  }
  // lacinho vermelho no pescoço
  const fita = mat(THREE, "#ce0e0e", { roughness: 0.5 });
  for (const lado of [-1, 1]) {
    const l = malha(THREE, new THREE.ConeGeometry(0.014, 0.026, 8), fita);
    l.rotation.z = (lado * Math.PI) / 2;
    l.position.set(lado * 0.014, 0.065, -0.05);
    g.add(l);
  }
  // nas costas, olhando para trás
  g.position.set(0, 1.27, -0.19);
  return g;
}

/** Forma de uma asa (no plano XY, saindo para +X a partir do ombro). */
function formaAsaAnjo(THREE: typeof TH) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.08, 0.12, 0.22, 0.16, 0.34, 0.12);
  // pontas das penas embaixo
  const penas = 5;
  for (let i = 0; i < penas; i++) {
    const x0 = 0.34 - (i * 0.3) / penas;
    const x1 = 0.34 - ((i + 1) * 0.3) / penas;
    s.quadraticCurveTo((x0 + x1) / 2 + 0.01, -0.16 + i * 0.03, x1, -0.02 + i * 0.012);
  }
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 2,
    curveSegments: 10,
  });
  g.translate(0, 0, -0.006);
  return g;
}

function formaAsaFada(THREE: typeof TH) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.05, 0.22, 0.3, 0.3, 0.26, 0.12);
  s.bezierCurveTo(0.24, 0.04, 0.1, 0.02, 0.02, -0.01);
  s.bezierCurveTo(0.14, -0.04, 0.2, -0.16, 0.12, -0.19);
  s.bezierCurveTo(0.06, -0.21, 0.02, -0.1, 0, 0);
  return new THREE.ShapeGeometry(s, 16);
}

function asas(THREE: typeof TH, tipo: "anjo" | "fada"): Enfeite {
  const molde = copia(`asas-${tipo}`, () => {
    const g = new THREE.Group();
    const geo = tipo === "anjo" ? formaAsaAnjo(THREE) : formaAsaFada(THREE);
    const m =
      tipo === "anjo"
        ? mat(THREE, "#fbfaf6", { roughness: 0.9, side: THREE.DoubleSide })
        : mat(THREE, "#e7b8ff", {
            roughness: 0.25,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.62,
            emissive: "#b06cff",
            emissiveIntensity: 0.45,
            depthWrite: false,
          });
    for (const lado of [1, -1]) {
      const pivo = new THREE.Group();
      pivo.name = lado > 0 ? "asa-d" : "asa-e";
      pivo.position.set(lado * 0.035, tipo === "anjo" ? 1.38 : 1.36, -0.135);
      const w = malha(THREE, geo, m);
      w.castShadow = tipo === "anjo";
      if (lado < 0) w.scale.x = -1;
      // as pontas sobem um pouco, para fora dos braços
      w.rotation.z = lado * (tipo === "anjo" ? 0.5 : 0.25);
      if (tipo === "anjo") w.scale.multiplyScalar(1.25);
      pivo.add(w);
      g.add(pivo);
    }
    return g;
  });
  const d = molde.getObjectByName("asa-d");
  const e = molde.getObjectByName("asa-e");
  const aberta = tipo === "anjo" ? 0.85 : 0.6;
  return {
    objeto: molde,
    animar: (t, mexendo) => {
      const vel = tipo === "anjo" ? 2.2 + mexendo * 4 : 9 + mexendo * 6;
      const amp = tipo === "anjo" ? 0.12 + mexendo * 0.1 : 0.22;
      const a = aberta + Math.sin(t * vel) * amp;
      if (d) d.rotation.y = a;
      if (e) e.rotation.y = -a;
    },
  };
}

/* ---------------- efeitos ---------------- */

function coracoes(THREE: typeof TH, topo: number): Enfeite {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.6, -0.1, -0.5, 0.25);
  s.bezierCurveTo(-0.42, 0.55, -0.05, 0.55, 0, 0.25);
  s.bezierCurveTo(0.05, 0.55, 0.42, 0.55, 0.5, 0.25);
  s.bezierCurveTo(0.6, -0.1, 0.15, -0.35, 0, -0.5);
  const geo = copiaGeo("coracao", () => {
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.08,
      bevelThickness: 0.08,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.center();
    g.scale(0.045, 0.045, 0.045);
    return g;
  });
  const m = mat(THREE, "#ff4d7d", { emissive: "#ff2d6a", emissiveIntensity: 0.6, roughness: 0.4 });
  const g = new THREE.Group();
  const n = 5;
  const lista: TH.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(geo, m);
    lista.push(c);
    g.add(c);
  }
  return {
    objeto: g,
    animar: (t) => {
      lista.forEach((c, i) => {
        const fase = (t * 0.35 + i / n) % 1;
        const ang = t * 0.8 + (i / n) * Math.PI * 2;
        c.position.set(Math.sin(ang) * 0.3, topo - 0.35 + fase * 0.55, Math.cos(ang) * 0.3);
        c.rotation.y = ang;
        c.scale.setScalar(Math.sin(fase * Math.PI) * 1.1);
      });
    },
  };
}
const geos = new Map<string, TH.BufferGeometry>();
function copiaGeo(chave: string, montar: () => TH.BufferGeometry) {
  let g = geos.get(chave);
  if (!g) {
    g = montar();
    geos.set(chave, g);
  }
  return g;
}

/* ---------------- quem é quem ---------------- */

/** Onde cada enfeite vai: o osso e a altura do encaixe. */
export function criarEnfeite(
  THREE: typeof TH,
  id: string,
  topo: number,
): { osso: "Head" | "spine_03" | null; enfeite: Enfeite } | null {
  const fem = topo < 1.825;
  // borda dos chapéus que vestem a cabeça (no feminino um pouco acima do rabo de cavalo)
  const borda = topo - (fem ? 0.068 : 0.078);
  const naCabeca = (chave: string, montar: () => TH.Object3D, y: number, z = -0.006) => {
    const o = copia(chave, montar);
    o.position.set(0, y, z);
    return { osso: "Head" as const, enfeite: { objeto: o } };
  };
  switch (id) {
    case BONE_HOST:
      return naCabeca("bone", () => bone(THREE), borda);
    case CHAPEU_COWBOY:
      return naCabeca("cowboy", () => cowboy(THREE), topo - (fem ? 0.05 : 0.058));
    case CHAPEU_PIRATA:
      return naCabeca("pirata", () => pirata(THREE), borda + 0.006);
    case GORRO_INVERNO:
      return naCabeca("gorro", () => gorroInverno(THREE), borda);
    case CAPACETE_VIKING:
      return naCabeca("viking", () => viking(THREE), borda);
    case GORRO_NATAL:
      return naCabeca("natal", () => gorroNatal(THREE), topo - (fem ? 0.048 : 0.058));
    case ORELHAS_GATO:
      return naCabeca("gato", () => orelhasGato(THREE), topo, 0);
    case ORELHAS_URSO:
      return naCabeca("urso", () => orelhasUrso(THREE), topo, 0);
    case LACO_FOFO:
      return naCabeca("laco", () => laco(THREE), topo, 0);
    case AUREOLA_ANJO: {
      const e = aureola(THREE);
      e.objeto.position.set(0, topo - 0.01, -0.01);
      return { osso: "Head", enfeite: e };
    }
    case URSINHO_COSTAS: {
      const o = copia("ursinho", () => ursinho(THREE));
      if (fem) o.position.y = 1.25;
      return { osso: "spine_03", enfeite: { objeto: o } };
    }
    case ASAS_ANJO:
      return { osso: "spine_03", enfeite: asas(THREE, "anjo") };
    case ASAS_FADA:
      return { osso: "spine_03", enfeite: asas(THREE, "fada") };
    case CORACOES_FLUTUANDO:
      // soltos em volta do corpo (não balançam com a cabeça)
      return { osso: null, enfeite: coracoes(THREE, topo) };
    default:
      return null;
  }
}
