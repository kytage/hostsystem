/**
 * Ilha do Magnata HOST: o tabuleiro gigante em 3D, as miniaturas dos imóveis,
 * os dados, a maquete da cidade no centro e os mascotes dos jogadores (cada um
 * com o cone da sua cor na cabeça). A cena só desenha: quem decide a partida é
 * o estado que chega pela sala.
 */
import type * as TH from "three";
import { peca, type Visual } from "@/lib/hoki";
import {
  CASAS,
  CORES,
  DELEGACIA,
  dinheiro,
  GRUPOS,
  N_CASAS,
  PASSO_MS,
  type Estado,
  type Posse,
} from "@/lib/hoki-magnata";
import { criarMascote, type Reacao } from "./mascote";
import { modeloLeve, type Modelo } from "./modelo";
import { montarLuzes, prepararDesenho } from "./luz";
import { Blocos, ceu, criarNuvens, letrasDePedra, sorteador, tom } from "./voxel";

/** Medidas do tabuleiro: lado do canto, largura de uma casa comum e metade do lado inteiro. */
const CANTO = 3.2;
const LARG = 2;
const MEIO = (CANTO * 2 + 8 * LARG) / 2;
const TOPO = 0.2; // altura do piso das casas
const ESCALA = 0.5; // tamanho do mascote no tabuleiro

export interface LugarDaCasa {
  x: number;
  z: number;
  /** Giro em Y que vira o "para fora" da casa (o lado de quem olha de fora do tabuleiro). */
  rot: number;
  canto: boolean;
}
/** Centro de cada casa. As casas correm no sentido horário, visto de cima, a partir do canto da Partida. */
export function lugarDaCasa(i: number): LugarDaCasa {
  const lado = Math.floor((((i % N_CASAS) + N_CASAS) % N_CASAS) / 9);
  const k = (((i % N_CASAS) + N_CASAS) % N_CASAS) % 9;
  const borda = MEIO - CANTO / 2;
  const ao = k === 0 ? borda : MEIO - CANTO - (k - 0.5) * LARG;
  const canto = k === 0;
  if (lado === 0) return { x: ao, z: borda, rot: 0, canto };
  if (lado === 1) return { x: -borda, z: ao, rot: -Math.PI / 2, canto };
  if (lado === 2) return { x: -ao, z: -borda, rot: Math.PI, canto };
  return { x: borda, z: -ao, rot: Math.PI / 2, canto };
}
/** Ponto do mundo a partir de um ponto dentro da casa (lx para o lado, lz para fora). */
function naCasa(i: number, lx: number, lz: number) {
  const c = lugarDaCasa(i);
  const co = Math.cos(c.rot);
  const si = Math.sin(c.rot);
  return { x: c.x + lx * co + lz * si, z: c.z - lx * si + lz * co };
}
/** Qual casa fica embaixo deste ponto do chão? */
function casaEm(x: number, z: number) {
  for (let i = 0; i < N_CASAS; i++) {
    const c = lugarDaCasa(i);
    const dx = x - c.x;
    const dz = z - c.z;
    const co = Math.cos(c.rot);
    const si = Math.sin(c.rot);
    const lx = dx * co - dz * si;
    const lz = dx * si + dz * co;
    const meiaL = (c.canto ? CANTO : LARG) / 2;
    if (Math.abs(lx) <= meiaL && Math.abs(lz) <= CANTO / 2) return i;
  }
  return null;
}

/** Onde cada mascote fica dentro da casa, conforme quantos estão nela. */
const VAGAS: [number, number][] = [
  [-0.5, 0.55],
  [0.5, 0.55],
  [-0.5, 1.15],
  [0.5, 1.15],
  [0, 0.85],
  [0, 0.25],
];
const VAGAS_DO_CANTO: [number, number][] = [
  [-0.8, 0.75],
  [0, 0.75],
  [0.8, 0.75],
  [-0.8, 1.25],
  [0, 1.25],
  [0.8, 1.25],
];
const CELAS: [number, number][] = [
  [-0.75, -0.95],
  [0, -0.95],
  [0.75, -0.95],
  [-0.75, -0.35],
  [0, -0.35],
  [0.75, -0.35],
];

const hex = (cor: string) => parseInt(cor.slice(1), 16);
const FONTE = 'Manrope, Inter, "Segoe UI", Arial, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(" ")) {
    const tenta = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tenta).width > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Desenho do piso de cada casa: faixa do grupo (onde fica a miniatura), nome, preço e o ícone. */
function desenharCasa(i: number) {
  const casa = CASAS[i];
  const tela = document.createElement("canvas");
  const canto = i % 9 === 0;
  const L = canto ? 410 : 256;
  const A = 410;
  tela.width = L;
  tela.height = A;
  const c = tela.getContext("2d");
  if (!c || !casa) return tela;
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (canto) {
    const fundo = { partida: "#d8281f", delegacia: "#3b4c70", praca: "#2f9e58", blitz: "#ee8a22" }[
      casa.tipo as "partida"
    ];
    c.fillStyle = fundo ?? "#444";
    c.fillRect(0, 0, L, A);
    c.fillStyle = "rgba(255,255,255,0.1)";
    for (let k = -A; k < L; k += 56) {
      c.beginPath();
      c.moveTo(k, A);
      c.lineTo(k + 28, A);
      c.lineTo(k + 28 + A, 0);
      c.lineTo(k + A, 0);
      c.fill();
    }
    c.font = `150px ${EMOJI}`;
    c.fillText(casa.icone, L / 2, 168);
    c.fillStyle = "#fff";
    c.font = `800 42px ${FONTE}`;
    c.fillText(casa.nome.toUpperCase(), L / 2, 300);
    c.font = `600 25px ${FONTE}`;
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillText(
      {
        partida: `receba ${dinheiro(200)} ao passar`,
        delegacia: "só visitando",
        praca: "descanse: nada acontece",
        blitz: "vá para a Delegacia",
      }[casa.tipo as "partida"] ?? "",
      L / 2,
      350,
    );
  } else {
    const faixa =
      casa.tipo === "imovel"
        ? (GRUPOS[casa.grupo ?? 0]?.cor ?? "#888")
        : casa.tipo === "companhia"
          ? "#39404d"
          : casa.tipo === "noticia"
            ? "#7a4fe0"
            : "#8b929e";
    c.fillStyle = "#f6f1e4";
    c.fillRect(0, 0, L, A);
    c.fillStyle = faixa;
    c.fillRect(0, 0, L, casa.tipo === "noticia" ? A : 168);
    c.fillStyle = "rgba(0,0,0,0.14)";
    c.fillRect(0, 160, L, 8);
    const claro = casa.tipo === "noticia";
    c.fillStyle = claro ? "#fff" : "#1d1a17";
    c.font = `800 29px ${FONTE}`;
    const linhas = quebrar(c, casa.nome.toUpperCase(), L - 26).slice(0, 2);
    linhas.forEach((l, k) => c.fillText(l, L / 2, 205 + k * 32 - (linhas.length - 1) * 4));
    c.font = `800 33px ${FONTE}`;
    c.fillStyle = claro ? "#ffe9a8" : casa.tipo === "taxa" ? "#c0281f" : "#167a3c";
    c.fillText(
      casa.tipo === "taxa"
        ? `pague ${dinheiro(casa.valor ?? 0)}`
        : casa.tipo === "noticia"
          ? "tire uma carta"
          : dinheiro(casa.preco ?? 0),
      L / 2,
      linhas.length > 1 ? 278 : 262,
    );
    c.globalAlpha = casa.tipo === "noticia" ? 1 : 0.9;
    c.font = `${casa.tipo === "noticia" ? 110 : 84}px ${EMOJI}`;
    c.fillText(casa.icone, L / 2, casa.tipo === "noticia" ? 95 : 350);
    c.globalAlpha = 1;
  }
  c.strokeStyle = "#1d1a17";
  c.lineWidth = 6;
  c.strokeRect(3, 3, L - 6, A - 6);
  return tela;
}

function telaDeTexto(texto: string, cor: string, fundo: string | null, largura = 256, altura = 64) {
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const c = tela.getContext("2d");
  if (!c) return tela;
  if (fundo) {
    c.fillStyle = fundo;
    c.beginPath();
    c.roundRect(2, 2, largura - 4, altura - 4, altura * 0.42);
    c.fill();
  }
  c.textAlign = "center";
  c.textBaseline = "middle";
  let px = altura * 0.56;
  c.font = `800 ${px}px ${FONTE}`;
  while (c.measureText(texto).width > largura - 26 && px > 12) c.font = `800 ${--px}px ${FONTE}`;
  if (!fundo) {
    c.lineWidth = 7;
    c.strokeStyle = "rgba(0,0,0,0.75)";
    c.strokeText(texto, largura / 2, altura / 2 + 1);
  }
  c.fillStyle = cor;
  c.fillText(texto, largura / 2, altura / 2 + 1);
  return tela;
}

function telaDoDado(n: number) {
  const tela = document.createElement("canvas");
  tela.width = tela.height = 128;
  const c = tela.getContext("2d");
  if (!c) return tela;
  c.fillStyle = "#fbf8f1";
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = "#d8d2c4";
  c.lineWidth = 6;
  c.strokeRect(3, 3, 122, 122);
  const P: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [
      [0, 0],
      [2, 2],
    ],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    4: [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ],
    5: [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ],
    6: [
      [0, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [2, 2],
    ],
  };
  c.fillStyle = n === 1 ? "#d8281f" : "#1d1a17";
  for (const [x, y] of P[n] ?? []) {
    c.beginPath();
    c.arc(30 + x * 34, 30 + y * 34, n === 1 ? 16 : 12, 0, Math.PI * 2);
    c.fill();
  }
  return tela;
}
/** Giro que deixa a face de valor `v` virada para cima (faces: +x 3, -x 4, +y 1, -y 6, +z 2, -z 5). */
const GIRO_DO_DADO: Record<number, [number, number]> = {
  1: [0, 0],
  6: [Math.PI, 0],
  3: [0, Math.PI / 2],
  4: [0, -Math.PI / 2],
  2: [-Math.PI / 2, 0],
  5: [Math.PI / 2, 0],
};

export type Foco =
  | { tipo: "vez" }
  | { tipo: "jogador"; id: string }
  | { tipo: "casa"; i: number }
  | { tipo: "geral" };

interface Peca {
  id: string;
  chave: string;
  grupo: TH.Group;
  mascote: ReturnType<typeof criarMascote>;
  cone: TH.Mesh;
  rotulo: TH.Sprite;
  x: number;
  z: number;
  y: number;
  ang: number;
  /** Caminho em andamento (de casa em casa, ou um voo direto). */
  caminho: {
    pontos: { x: number; z: number }[];
    inicio: number;
    passo: number;
    voo: boolean;
  } | null;
  reacao: { tipo: Reacao; inicio: number } | null;
  saldo: number | null;
  visivel: boolean;
}

export function criarCenaMagnata(
  THREE: typeof TH,
  el: HTMLDivElement,
  eventos: { onCasa: (i: number | null) => void },
) {
  const lixo: { dispose: () => void }[] = [];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  prepararDesenho(THREE, renderer);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";

  const cena = new THREE.Scene();
  const texCeu = ceu(THREE);
  cena.background = texCeu;
  cena.fog = new THREE.Fog(0xdcecff, 60, 170);
  lixo.push(texCeu);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 260);
  const luzes = montarLuzes(THREE, cena, {
    alvo: { x: 0, y: 0, z: 0 },
    area: [19, 19],
    distancia: 46,
    mapa: 2048,
    maciez: 2.2,
  });
  luzes.ceu.intensity = 1.3;

  // ---------------- ilha: gramado, encosta e o miolo calçado ----------------
  const r = sorteador(77);
  const escolhe = (l: readonly number[]) => l[Math.floor(r() * l.length)] ?? l[0] ?? 0;
  const GRAMA = [0x5fb548, 0x6cc254, 0x58aa42];
  const TERRA = [0x8a5a3a, 0x7a4e32, 0x94633f];
  const ROCHA = [0x6f6f78, 0x5d5d66, 0x7b7b84];
  const PAVE = [0xcfc6b4, 0xd9d1c0, 0xc4baa6];
  const chao = new Blocos(r);
  const encosta = new Blocos(r);
  const pedra = new Blocos(r);
  const predios = new Blocos(r);
  const folhas = new Blocos(r);
  const aceso = new Blocos(r);
  const BORDA = MEIO + 1.4;
  for (let x = -BORDA + 0.7; x < BORDA; x += 1.4)
    for (let z = -BORDA + 0.7; z < BORDA; z += 1.4)
      if (Math.max(Math.abs(x), Math.abs(z)) > MEIO - 0.3)
        chao.base(x, -0.5, z, 1.4, 0.5, 1.4, escolhe(GRAMA), 0.05);
  for (let k = 1; k <= 6; k++) {
    const f = 1 - k * 0.135;
    encosta.base(
      0,
      -0.5 - k * 1.25,
      0,
      BORDA * 2 * f,
      1.25,
      BORDA * 2 * f,
      escolhe(k < 3 ? TERRA : ROCHA),
    );
    if (k < 5)
      for (let n = 0; n < 5; n++)
        encosta.base(
          (r() - 0.5) * BORDA * 2 * f,
          -0.6 - k * 1.25 - r(),
          (r() < 0.5 ? -1 : 1) * BORDA * f,
          1.6 + r() * 2,
          1 + r(),
          1.2,
          escolhe(ROCHA),
        );
  }
  // base das casas e miolo
  const MIOLO = MEIO - CANTO;
  chao.base(0, -0.5, 0, MEIO * 2, 0.5, MEIO * 2, 0x2b2622, 0);
  for (let x = -MIOLO + 1; x < MIOLO; x += 2)
    for (let z = -MIOLO + 1; z < MIOLO; z += 2)
      chao.base(
        x,
        0,
        z,
        2,
        0.1,
        2,
        Math.abs(x) < 1.1 || Math.abs(z + 1) < 1.1 ? 0x4a4f58 : escolhe(GRAMA),
        0.04,
      );

  // ---------------- casas: laje, meio-fio da cor do grupo e o desenho do piso ----------------
  const pisos = new THREE.Group();
  cena.add(pisos);
  const gCasa = new THREE.PlaneGeometry(LARG - 0.06, CANTO - 0.06);
  const gCanto = new THREE.PlaneGeometry(CANTO - 0.06, CANTO - 0.06);
  lixo.push(gCasa, gCanto);
  const anis = renderer.capabilities.getMaxAnisotropy();
  for (let i = 0; i < N_CASAS; i++) {
    const c = lugarDaCasa(i);
    const casa = CASAS[i];
    const larg = c.canto ? CANTO : LARG;
    const giro = Math.abs(Math.sin(c.rot)) > 0.5;
    pedra.base(
      c.x,
      0,
      c.z,
      (giro ? CANTO : larg) - 0.04,
      TOPO - 0.01,
      (giro ? larg : CANTO) - 0.04,
      0xe9e2d3,
      0.02,
    );
    // meio-fio de fora, na cor do grupo: dá para ler o grupo de longe
    if (casa?.tipo === "imovel") {
      const p = naCasa(i, 0, CANTO / 2 + 0.16);
      pedra.base(
        p.x,
        -0.02,
        p.z,
        giro ? 0.3 : larg - 0.1,
        0.3,
        giro ? larg - 0.1 : 0.3,
        hex(GRUPOS[casa.grupo ?? 0]?.cor ?? "#888888"),
        0.02,
      );
    }
    const tex = new THREE.CanvasTexture(desenharCasa(i));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anis;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const piso = new THREE.Mesh(c.canto ? gCanto : gCasa, mat);
    piso.rotation.set(-Math.PI / 2, 0, c.rot);
    piso.position.set(c.x, TOPO + 0.004, c.z);
    piso.receiveShadow = true;
    pisos.add(piso);
    lixo.push(tex, mat);
  }

  // ---------------- enfeites dos cantos ----------------
  {
    // Delegacia: grade da cela no fundo do canto
    for (let k = 0; k < 9; k++) {
      const a = naCasa(DELEGACIA, -1.4 + k * 0.35, 0.05);
      pedra.base(a.x, TOPO, a.z, 0.07, 1.25, 0.07, 0x2b2d32, 0);
    }
    for (let k = 0; k < 5; k++) {
      const a = naCasa(DELEGACIA, 1.42, -1.4 + k * 0.36);
      pedra.base(a.x, TOPO, a.z, 0.07, 1.25, 0.07, 0x2b2d32, 0);
    }
    const t = naCasa(DELEGACIA, 0, 0.05);
    pedra.base(t.x, TOPO + 1.25, t.z, 0.12, 0.1, 2.95, 0x2b2d32, 0);
    // Partida: arco com bandeirinhas
    for (const l of [-1.35, 1.35]) {
      const a = naCasa(0, l, -1.3);
      pedra.base(a.x, TOPO, a.z, 0.22, 2, 0.22, 0x1b1b1f, 0.02);
    }
    const arco = naCasa(0, 0, -1.3);
    pedra.base(arco.x, TOPO + 2, arco.z, 3, 0.3, 0.26, 0xd8281f, 0.02);
    for (let k = 0; k < 8; k++) {
      const a = naCasa(0, -1.2 + k * 0.34, -1.3);
      aceso.base(a.x, TOPO + 1.72, a.z, 0.2, 0.26, 0.05, k % 2 ? 0xffffff : 0xffd23f, 0);
    }
    // Folga na Praça: fontezinha e canteiros
    const f = naCasa(18, 0, -0.75);
    pedra.base(f.x, TOPO, f.z, 1.2, 0.2, 1.2, 0xd9d1c0, 0.03);
    aceso.base(f.x, TOPO + 0.2, f.z, 0.9, 0.06, 0.9, 0x4fb3f0, 0);
    pedra.base(f.x, TOPO + 0.2, f.z, 0.24, 0.6, 0.24, 0xe9e2d3, 0.02);
    for (const l of [-1.15, 1.15]) {
      const a = naCasa(18, l, -1.1);
      folhas.base(a.x, TOPO, a.z, 0.5, 0.55, 0.5, 0x3f8f2f, 0.08);
      folhas.base(a.x, TOPO + 0.55, a.z, 0.34, 0.3, 0.34, 0x55a83a, 0.08);
    }
    // Blitz: viatura de bloquinhos com a sirene acesa
    const v = naCasa(27, 0, -0.85);
    predios.base(v.x, TOPO + 0.12, v.z, 1.5, 0.36, 0.8, 0xf4f1ea, 0.02);
    predios.base(v.x, TOPO + 0.48, v.z, 0.8, 0.3, 0.74, 0x2b2d32, 0.02);
    aceso.base(v.x - 0.16, TOPO + 0.78, v.z, 0.2, 0.12, 0.2, 0xff3b30, 0);
    aceso.base(v.x + 0.16, TOPO + 0.78, v.z, 0.2, 0.12, 0.2, 0x3d8bff, 0);
    for (const dx of [-0.5, 0.5])
      for (const dz of [-0.38, 0.38])
        predios.base(v.x + dx, TOPO, v.z + dz, 0.3, 0.3, 0.1, 0x18181b, 0);
  }

  // ---------------- centro: maquete da cidade HOST ----------------
  {
    const PAREDES = [0xf2e9d8, 0xe3d4c0, 0xd9e4ee, 0xf0d9c8, 0xdfe8d6, 0xe8dff0, 0xcfd6de];
    const TETOS = [0xd8281f, 0x39404d, 0x8a5a3a, 0x3b4c70, 0x2f9e58];
    for (let gx = -2; gx <= 2; gx++)
      for (let gz = -2; gz <= 1; gz++) {
        if (gx === 0 || gz === 0) continue; // as avenidas em cruz
        const cx = gx * 2.6 + (gx > 0 ? -0.2 : 0.2);
        const cz = gz * 2.5 - 1 + (gz > 0 ? 0.2 : -0.2);
        const perto = 1 - Math.min(1, Math.hypot(cx, cz + 1) / 8);
        const n = 1 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const w = n === 1 ? 1.7 : 0.85;
          const x = cx + (n === 1 ? 0 : (k - 0.5) * 0.95);
          const h = 0.9 + r() * 1.3 + perto * 2.6;
          const parede = escolhe(PAREDES);
          predios.base(x, 0.1, cz, w, h, 1.6, parede, 0.03);
          predios.base(x, 0.1 + h, cz, w + 0.1, 0.14, 1.7, escolhe(TETOS), 0.03);
          // janelas acesas na frente e do lado
          for (let a = 0.5; a < h - 0.25; a += 0.5)
            for (let j = 0; j < (n === 1 ? 3 : 2); j++) {
              const jx = x + (j - (n === 1 ? 1 : 0.5)) * (n === 1 ? 0.5 : 0.38);
              // janelas nas quatro faces (a câmera gira em volta do tabuleiro)
              for (const lado of [-1, 1]) {
                if (r() > 0.25)
                  aceso.add(
                    jx,
                    0.1 + a,
                    cz + lado * 0.81,
                    0.2,
                    0.22,
                    0.03,
                    r() < 0.7 ? 0xffe9a8 : 0x9fd8ff,
                    0,
                  );
                if (j < 2 && r() > 0.25)
                  aceso.add(
                    x + lado * (w / 2 + 0.01),
                    0.1 + a,
                    cz + (j - 0.5) * 0.7,
                    0.03,
                    0.22,
                    0.2,
                    r() < 0.7 ? 0xffe9a8 : 0x9fd8ff,
                    0,
                  );
              }
            }
        }
      }
    // arvorezinhas nas esquinas e faixas das avenidas
    for (const [x, z] of [
      [-1.5, 0.3],
      [1.5, 0.3],
      [-1.5, -2.3],
      [1.5, -2.3],
      [-6.6, 3.6],
      [6.6, 3.6],
      [-6.6, -6.4],
      [6.6, -6.4],
    ] as const) {
      folhas.base(x, 0.1, z, 0.14, 0.4, 0.14, 0x6e4a2b, 0);
      folhas.base(x, 0.5, z, 0.6, 0.5, 0.6, 0x3f8f2f, 0.08);
      folhas.base(x, 1.0, z, 0.38, 0.32, 0.38, 0x55a83a, 0.08);
    }
    for (let k = -3; k <= 3; k++) {
      aceso.base(k * 1.8, 0.1, -1, 0.7, 0.012, 0.09, 0xf4f1ea, 0);
      aceso.base(0, 0.1, k * 1.8 - 1, 0.09, 0.012, 0.7, 0xf4f1ea, 0);
    }
    // praça da frente: onde os dados caem, o baralho do Plantão e o pedestal do letreiro
    chao.base(0, 0.1, 5.6, 11, 0.06, 3.6, 0xd9d1c0, 0.03);
    pedra.base(0, 0.16, 3.6, 6.6, 0.5, 0.7, 0x2b2622, 0.02);
    for (let k = 0; k < 6; k++)
      pedra.base(-4.3, 0.16 + k * 0.05, 5.9, 1.05, 0.05, 1.5, k % 2 ? 0x7a4fe0 : 0x6a40cf, 0);
    aceso.base(-4.3, 0.46, 5.9, 0.7, 0.01, 1.1, 0xf6f1e4, 0);
  }
  const letras = new Blocos(r);
  letrasDePedra(letras, "HOST", 0.13, 0.42, {
    linhas: 12,
    relevo: 0.6,
    cores: [0xd8281f, 0xc4241c, 0xe23b30, 0xcf2a22],
  });

  const conjuntos = [
    chao.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.035, junta: 0.08, pe: 0, grao: 0.05 },
    }),
    encosta.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.07, junta: 0.2, pe: 0.3, grao: 0.075 },
    }),
    pedra.construir(THREE, { acabamento: { chanfro: 0.03, junta: 0.16, pe: 0.12, grao: 0.04 } }),
    predios.construir(THREE, { acabamento: { chanfro: 0.03, junta: 0.1, pe: 0.2, grao: 0.04 } }),
    folhas.construir(THREE, { acabamento: { chanfro: 0.07, junta: 0.12, pe: 0.3, grao: 0.07 } }),
    aceso.construir(THREE, {
      sombra: false,
      recebe: false,
      material: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
  ];
  for (const c of conjuntos) {
    cena.add(c.malha);
    lixo.push({ dispose: c.descartar });
  }
  const mLetras = letras.construir(THREE, {
    recebe: false,
    acabamento: { chanfro: 0.03, junta: 0.2, pe: 0, grao: 0.04 },
  });
  mLetras.malha.position.set(0, 0.66, 3.6);
  cena.add(mLetras.malha);
  lixo.push({ dispose: mLetras.descartar });

  // nuvens em volta e abaixo da ilha
  const nuvens = criarNuvens(
    THREE,
    [
      [-34, -9, -22, 3.4],
      [30, -12, -30, 4],
      [38, -6, 14, 3],
      [-40, -10, 20, 3.6],
      [4, -16, 40, 4.4],
      [-12, -14, -44, 3.8],
      [52, 4, -8, 2.6],
      [-54, 6, -4, 2.8],
    ],
    23,
  );
  for (const n of nuvens.nuvens) cena.add(n.malha);
  lixo.push({ dispose: nuvens.descartar });

  // ---------------- miniaturas dos imóveis (mudam com dono, casas, hotel e hipoteca) ----------------
  const gCaixa = new THREE.BoxGeometry(1, 1, 1);
  lixo.push(gCaixa);
  const materiais = new Map<string, TH.MeshStandardMaterial>();
  const material = (cor: number, brilho = false) => {
    const chave = `${cor}:${brilho}`;
    let m = materiais.get(chave);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: cor,
        roughness: 0.8,
        ...(brilho ? { emissive: cor, emissiveIntensity: 0.9 } : {}),
      });
      materiais.set(chave, m);
      lixo.push(m);
    }
    return m;
  };
  const texturasDePlaca = new Map<string, TH.CanvasTexture>();
  const gPlaca = new THREE.PlaneGeometry(0.78, 0.24);
  lixo.push(gPlaca);
  const minis = new Map<number, { grupo: TH.Group; chave: string }>();
  const CINZA = 0x8b8f98;
  function montarMini(i: number, posse: Posse | undefined, e: Estado) {
    const casa = CASAS[i];
    if (!casa || (casa.tipo !== "imovel" && casa.tipo !== "companhia")) return;
    const dono = posse ? e.jogadores.find((j) => j.id === posse.dono) : undefined;
    const chave = posse ? `${posse.dono}:${posse.casas}:${posse.hip}:${dono?.nome}` : "-";
    let mini = minis.get(i);
    if (mini?.chave === chave) return;
    if (!mini) {
      const c = lugarDaCasa(i);
      const grupo = new THREE.Group();
      grupo.position.set(c.x, TOPO, c.z);
      grupo.rotation.y = c.rot;
      cena.add(grupo);
      mini = { grupo, chave: "" };
      minis.set(i, mini);
    }
    mini.chave = chave;
    mini.grupo.clear();
    const g = mini.grupo;
    const hip = !!posse?.hip;
    const pinta = (cor: number) => (hip ? CINZA : cor);
    const caixa = (
      x: number,
      y0: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      cor: number,
      brilho = false,
    ) => {
      const m = new THREE.Mesh(
        gCaixa,
        material(brilho && hip ? CINZA : pinta(cor), brilho && !hip),
      );
      m.position.set(x, y0 + sy / 2, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = !brilho;
      m.receiveShadow = true;
      g.add(m);
    };
    const Z = -0.95;
    const corGrupo =
      casa.tipo === "imovel" ? hex(GRUPOS[casa.grupo ?? 0]?.cor ?? "#888888") : 0xffd23f;
    const parede =
      casa.tipo === "companhia" ? 0x39404d : ([0xfbf5e8, 0xf0e2cf, 0xe6eef4][i % 3] ?? 0xfbf5e8);
    const nivel = posse?.casas ?? 0;
    if (nivel === 5) {
      // hotel: torre alta com janelas acesas e letreiro vermelho
      caixa(0, 0, Z, 1.15, 1.75, 0.9, 0xfbf5e8);
      caixa(0, 1.75, Z, 1.25, 0.16, 1.0, 0xe23b3b);
      caixa(0, 1.91, Z, 0.5, 0.26, 0.12, 0xff5a4a, true);
      for (let a = 0; a < 4; a++)
        for (let j = 0; j < 3; j++)
          caixa((j - 1) * 0.34, 0.3 + a * 0.36, Z + 0.455, 0.18, 0.2, 0.02, 0xffe9a8, true);
      caixa(0, 0, Z + 0.47, 0.3, 0.26, 0.04, 0x2b2622);
    } else if (casa.tipo === "companhia") {
      caixa(0, 0, Z, 1.2, 0.6, 0.85, parede);
      caixa(0, 0.6, Z, 1.28, 0.1, 0.93, 0xffd23f);
      caixa(0.35, 0.7, Z, 0.07, 0.85, 0.07, 0x2b2d32);
      caixa(0.35, 1.55, Z, 0.14, 0.14, 0.14, 0xff3b30, true);
      caixa(-0.2, 0.2, Z + 0.43, 0.5, 0.24, 0.02, 0x9fd8ff, true);
    } else {
      const tipo = i % 3;
      if (tipo === 0) {
        caixa(0, 0, Z, 1.2, 0.6, 0.85, parede);
        caixa(0, 0.6, Z, 1.3, 0.13, 0.95, corGrupo);
        caixa(0, 0.36, Z + 0.52, 1.0, 0.06, 0.26, 0xfbfbf6);
      } else if (tipo === 1) {
        caixa(0, 0, Z, 1.0, 0.72, 0.85, parede);
        caixa(0, 0.72, Z, 1.1, 0.14, 0.95, corGrupo);
        caixa(0, 0.86, Z, 0.76, 0.14, 0.66, corGrupo);
        caixa(0, 1.0, Z, 0.42, 0.12, 0.36, corGrupo);
      } else {
        caixa(-0.3, 0, Z, 0.62, 0.95, 0.8, parede);
        caixa(-0.3, 0.95, Z, 0.7, 0.12, 0.88, corGrupo);
        caixa(0.33, 0, Z, 0.6, 0.52, 0.8, tom(parede, 0.94));
        caixa(0.33, 0.52, Z, 0.68, 0.1, 0.88, corGrupo);
      }
      caixa(tipo === 2 ? 0.33 : 0, 0, Z + 0.43, 0.22, 0.3, 0.03, 0x4a3324);
      caixa(tipo === 2 ? -0.3 : -0.36, 0.3, Z + 0.43, 0.2, 0.18, 0.02, 0xffe9a8, true);
      if (tipo !== 2) caixa(0.36, 0.3, Z + 0.43, 0.2, 0.18, 0.02, 0xffe9a8, true);
      // casinhas construídas na frente
      for (let k = 0; k < nivel; k++) {
        const x = -0.6 + k * 0.4;
        caixa(x, 0, Z + 0.86, 0.28, 0.2, 0.26, 0xfbfbf6);
        caixa(x, 0.2, Z + 0.86, 0.34, 0.1, 0.32, 0x2fae5a);
        caixa(x, 0.3, Z + 0.86, 0.18, 0.07, 0.32, 0x2fae5a);
      }
    }
    if (dono) {
      // placa com o nome do dono, na cor dele
      const cor = CORES[dono.cor]?.hex ?? "#ffffff";
      const chaveTex = `${dono.nome}:${cor}`;
      let tex = texturasDePlaca.get(chaveTex);
      if (!tex) {
        tex = new THREE.CanvasTexture(telaDeTexto(dono.nome, "#111", cor, 208, 64));
        tex.colorSpace = THREE.SRGBColorSpace;
        texturasDePlaca.set(chaveTex, tex);
        lixo.push(tex);
      }
      caixa(0, 0, Z + 1.22, 0.05, 0.5, 0.05, 0x2b2d32);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const placa = new THREE.Mesh(gPlaca, mat);
      placa.position.set(0, 0.52, Z + 1.24);
      placa.userData["solto"] = mat;
      g.add(placa);
      if (hip) {
        const aviso = new THREE.Mesh(
          gPlaca,
          new THREE.MeshBasicMaterial({ color: 0xd8281f, toneMapped: false }),
        );
        aviso.scale.set(0.5, 0.5, 1);
        aviso.position.set(0, 0.76, Z + 1.24);
        aviso.userData["solto"] = aviso.material;
        g.add(aviso);
      }
    }
  }

  // ---------------- dados ----------------
  const dados = [0, 1].map((k) => {
    const mats = [3, 4, 1, 6, 2, 5].map((n) => {
      const t = new THREE.CanvasTexture(telaDoDado(n));
      t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
      lixo.push(t, m);
      return m;
    });
    const d = new THREE.Mesh(gCaixa, mats);
    d.scale.setScalar(0.62);
    d.castShadow = true;
    d.position.set(k ? 0.6 : -0.6, 0.16 + 0.31, 5.6);
    cena.add(d);
    return { malha: d, valor: 1, giro: [r() * 9, r() * 9, r() * 9] as [number, number, number] };
  });
  let rolagem: { inicio: number } | null = null;

  // ---------------- destaques: casa selecionada, marca de quem joga e pódio ----------------
  const moldura = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  moldura.rotation.x = -Math.PI / 2;
  moldura.visible = false;
  cena.add(moldura);
  const marca = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.56, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  marca.rotation.x = -Math.PI / 2;
  marca.visible = false;
  cena.add(marca);
  lixo.push(
    moldura.geometry,
    moldura.material as TH.Material,
    marca.geometry,
    marca.material as TH.Material,
  );
  const podio = new THREE.Group();
  podio.visible = false;
  const DEGRAUS: [number, number, number][] = [
    [0, 1.05, 0xffd23f],
    [-1.35, 0.72, 0xcfd6de],
    [1.35, 0.46, 0xd08a4a],
  ];
  for (const [x, h, cor] of DEGRAUS) {
    const m = new THREE.Mesh(gCaixa, material(cor));
    m.scale.set(1.25, h, 1.25);
    m.position.set(x, 0.16 + h / 2, 6.3);
    m.castShadow = m.receiveShadow = true;
    podio.add(m);
  }
  cena.add(podio);

  // ---------------- mascotes ----------------
  const pecas = new Map<string, Peca>();
  let modelo: Modelo | undefined;
  let ped: Modelo | undefined;
  let pedindoPed = false;
  let estado: Estado | null = null;
  let morto = false;
  const gCone = new THREE.ConeGeometry(0.2, 0.5, 24);
  lixo.push(gCone);
  void modeloLeve(THREE).then((m) => {
    if (morto || !m) return;
    modelo = m;
    for (const p of pecas.values()) p.chave = "";
    if (estado) sincronizar(estado);
  });
  function montarPeca(id: string, visual: Visual, nome: string, cor: number, antes?: Peca): Peca {
    if (peca(visual.traje)?.ped && !ped && !pedindoPed) {
      pedindoPed = true;
      void modeloLeve(THREE, "bonne").then((m) => {
        if (morto || !m) return;
        ped = m;
        for (const p of pecas.values()) p.chave = "";
        if (estado) sincronizar(estado);
      });
    }
    const hexCor = CORES[cor]?.hex ?? "#ffffff";
    const grupo = new THREE.Group();
    grupo.scale.setScalar(ESCALA);
    const mascote = criarMascote(THREE, visual, { modelo, ped, mundo: true });
    mascote.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.material as TH.Material).transparent) o.castShadow = true;
    });
    grupo.add(mascote.raiz);
    // o cone do jogador, no topo da cabeça
    const mCone = new THREE.MeshStandardMaterial({
      color: hex(hexCor),
      roughness: 0.45,
      emissive: hex(hexCor),
      emissiveIntensity: 0.25,
    });
    const cone = new THREE.Mesh(gCone, mCone);
    cone.position.y = mascote.topo + 0.2;
    cone.castShadow = true;
    grupo.add(cone);
    const tex = new THREE.CanvasTexture(telaDeTexto(nome, "#fff", "rgba(10,10,12,0.72)", 256, 60));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mRot = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    });
    const rotulo = new THREE.Sprite(mRot);
    rotulo.scale.set(1.5, 0.35, 1);
    rotulo.renderOrder = 5;
    cena.add(grupo, rotulo);
    lixo.push(mCone, tex, mRot);
    return {
      id,
      chave: "",
      grupo,
      mascote,
      cone,
      rotulo,
      x: antes?.x ?? naCasa(0, 0, 0.85).x,
      z: antes?.z ?? naCasa(0, 0, 0.85).z,
      y: 0,
      ang: antes?.ang ?? 0,
      caminho: antes?.caminho ?? null,
      reacao: null,
      saldo: antes?.saldo ?? null,
      visivel: true,
    };
  }
  function desmontar(p: Peca) {
    cena.remove(p.grupo, p.rotulo);
    p.mascote.descartar();
  }

  /** Vaga de cada jogador (ponto do mundo e para onde olha), pelo estado atual. */
  function vagas(e: Estado) {
    const porCasa = new Map<string, string[]>();
    for (const j of e.jogadores) {
      if (j.falido) continue;
      const k = `${j.pos}:${j.preso ? 1 : 0}`;
      porCasa.set(k, [...(porCasa.get(k) ?? []), j.id]);
    }
    const saida = new Map<string, { x: number; z: number; ang: number }>();
    for (const j of e.jogadores) {
      if (j.falido) continue;
      const lista = porCasa.get(`${j.pos}:${j.preso ? 1 : 0}`) ?? [];
      const n = lista.indexOf(j.id);
      const c = lugarDaCasa(j.pos);
      const tabela = j.preso ? CELAS : c.canto ? VAGAS_DO_CANTO : VAGAS;
      const [lx, lz] =
        lista.length === 1 && !j.preso ? [0, 0.85] : (tabela[n % tabela.length] ?? [0, 0.85]);
      saida.set(j.id, { ...naCasa(j.pos, lx, lz), ang: c.rot });
    }
    return saida;
  }

  // textos que sobem quando o saldo muda (+H$ 200, −H$ 50)
  const avisos: { sprite: TH.Sprite; inicio: number; x: number; y: number; z: number }[] = [];
  function avisar(p: Peca, texto: string, cor: string) {
    const tex = new THREE.CanvasTexture(telaDeTexto(texto, cor, null, 256, 72));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.1, 0.6, 1);
    sprite.renderOrder = 6;
    cena.add(sprite);
    avisos.push({ sprite, inicio: tempo, x: p.x, y: 1.9, z: p.z });
  }

  let ultimoMov = -1;
  let etapaAntes = "";
  let faseAntes = "";
  let intro = -1;
  let tempo = 0;
  function sincronizar(e: Estado) {
    const primeiro = !estado;
    estado = e;
    // peças: cria, refaz quando o visual muda, tira quem saiu
    const ids = new Set(e.jogadores.map((j) => j.id));
    for (const [id, p] of pecas)
      if (!ids.has(id)) {
        desmontar(p);
        pecas.delete(id);
      }
    for (const j of e.jogadores) {
      const chave = `${JSON.stringify(j.visual)}:${j.nome}:${j.cor}:${!!modelo}:${!!ped}`;
      const antes = pecas.get(j.id);
      if (antes?.chave === chave) continue;
      if (antes) desmontar(antes);
      const nova = montarPeca(j.id, j.visual, j.nome, j.cor, antes);
      nova.chave = chave;
      if (!antes) {
        const v = vagas(e).get(j.id);
        if (v) {
          nova.x = v.x;
          nova.z = v.z;
          nova.ang = v.ang;
        }
      }
      pecas.set(j.id, nova);
    }
    for (const j of e.jogadores) {
      const p = pecas.get(j.id);
      if (!p) continue;
      p.visivel = !j.falido;
      if (p.saldo !== null && j.saldo !== p.saldo && e.fase === "jogo" && !j.falido) {
        const d = j.saldo - p.saldo;
        avisar(p, `${d > 0 ? "+" : "−"}${dinheiro(Math.abs(d))}`, d > 0 ? "#6dff9c" : "#ff7b6b");
      }
      p.saldo = j.saldo;
    }
    // movimento novo: o mascote anda de casa em casa (ou voa direto, para a Delegacia)
    if (e.mov && e.mov.seq !== ultimoMov) {
      const p = pecas.get(e.mov.id);
      if (p && !primeiro && ultimoMov !== -1) {
        const { de, n, direto } = e.mov;
        const pontos = [{ x: p.x, z: p.z }];
        if (!direto) {
          const s = Math.sign(n);
          for (let k = 1; k < Math.abs(n); k++) pontos.push(naCasa(de + s * k, 0, 0.85));
        }
        const fim = vagas(e).get(p.id);
        if (fim) pontos.push({ x: fim.x, z: fim.z });
        p.caminho = { pontos, inicio: tempo, passo: direto ? 1 : PASSO_MS / 1000, voo: !!direto };
      }
      ultimoMov = e.mov.seq;
    } else if (!e.mov && ultimoMov === -1) ultimoMov = 0;
    if (ultimoMov === -1) ultimoMov = e.mov?.seq ?? 0;
    // dados: rolam quando a etapa vira "rolando"
    if (e.dados) {
      dados.forEach((d, k) => (d.valor = e.dados?.[k] ?? 1));
      if (e.etapa === "rolando" && etapaAntes !== "rolando" && !primeiro)
        rolagem = { inicio: tempo };
    }
    etapaAntes = e.etapa;
    if (e.fase === "jogo" && faseAntes === "sala") intro = tempo + 3.6;
    faseAntes = e.fase;
    for (let i = 0; i < N_CASAS; i++) montarMini(i, e.posses[i], e);
    podio.visible = e.fase === "fim";
    for (const d of dados) d.malha.visible = e.fase !== "fim";
  }

  // ---------------- câmera ----------------
  let foco: Foco = { tipo: "vez" };
  let manual = false;
  let az = 0.5;
  let elev = 0.8;
  let dist = 38;
  const alvo = new THREE.Vector3(0, 0, 0);
  const alvoDesejado = new THREE.Vector3();
  let selecionada: number | null = null;
  const medir = () => {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(medir);
  observador.observe(el);
  medir();

  let arrasto: { x: number; y: number; andou: boolean } | null = null;
  const aoBaixar = (ev: PointerEvent) => {
    arrasto = { x: ev.clientX, y: ev.clientY, andou: false };
    try {
      renderer.domElement.setPointerCapture(ev.pointerId);
    } catch {
      /* ponteiro que não dá para capturar: o arrasto ainda funciona dentro da tela */
    }
  };
  const aoMover = (ev: PointerEvent) => {
    if (!arrasto) return;
    const dx = ev.clientX - arrasto.x;
    const dy = ev.clientY - arrasto.y;
    if (!arrasto.andou && Math.hypot(dx, dy) < 5) return;
    arrasto = { x: ev.clientX, y: ev.clientY, andou: true };
    manual = true;
    az -= dx * 0.006;
    elev = Math.min(1.45, Math.max(0.18, elev + dy * 0.005));
  };
  const raio = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOPO);
  const ponto = new THREE.Vector3();
  const aoSoltar = (ev: PointerEvent) => {
    const a = arrasto;
    arrasto = null;
    if (!a || a.andou) return;
    const caixa = renderer.domElement.getBoundingClientRect();
    raio.setFromCamera(
      new THREE.Vector2(
        ((ev.clientX - caixa.left) / caixa.width) * 2 - 1,
        -((ev.clientY - caixa.top) / caixa.height) * 2 + 1,
      ),
      camera,
    );
    const bateu = raio.ray.intersectPlane(plano, ponto);
    eventos.onCasa(bateu ? casaEm(ponto.x, ponto.z) : null);
  };
  const aoRolar = (ev: WheelEvent) => {
    ev.preventDefault();
    manual = true;
    dist = Math.min(52, Math.max(5, dist * Math.exp(ev.deltaY * 0.0011)));
  };
  const tela = renderer.domElement;
  tela.addEventListener("pointerdown", aoBaixar);
  tela.addEventListener("pointermove", aoMover);
  tela.addEventListener("pointerup", aoSoltar);
  tela.addEventListener("pointercancel", () => (arrasto = null));
  tela.addEventListener("wheel", aoRolar, { passive: false });

  const voltaCurta = (de: number, para: number) => {
    let d = (para - de) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  let raf = 0;
  let antes = performance.now();
  const quadro = (agora: number) => {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora;
    tempo += dt;
    const t = tempo;
    const e = estado;
    const lugares = e ? vagas(e) : null;
    const ordem = e?.ranking?.map((l) => l.id) ?? [];

    for (const p of pecas.values()) {
      const noPodio = e?.fase === "fim" ? ordem.indexOf(p.id) : -1;
      let andando = false;
      p.y = 0;
      if (e?.fase === "fim") {
        // fim: os três primeiros sobem no pódio, os outros ficam ao lado
        const d = DEGRAUS[noPodio];
        const x = d ? d[0] : -3.4 + (noPodio - 3) * 1.1 + (noPodio > 4 ? 4.6 : 0);
        p.x += (x - p.x) * Math.min(1, dt * 5);
        p.z += (6.3 + (d ? 0 : 1.2) - p.z) * Math.min(1, dt * 5);
        p.y = d ? d[1] + 0.16 - TOPO : 0.16 - TOPO;
        p.ang += voltaCurta(p.ang, 0) * Math.min(1, dt * 6);
        p.caminho = null;
        p.visivel = true;
      } else if (p.caminho) {
        const c = p.caminho;
        const total = (c.pontos.length - 1) * c.passo;
        const passou = t - c.inicio;
        if (passou >= total || c.pontos.length < 2) {
          const fim = c.pontos[c.pontos.length - 1];
          if (fim) {
            p.x = fim.x;
            p.z = fim.z;
          }
          p.caminho = null;
        } else {
          const k = Math.floor(passou / c.passo);
          const f = passou / c.passo - k;
          const a = c.pontos[k];
          const b = c.pontos[k + 1];
          if (a && b) {
            p.x = a.x + (b.x - a.x) * f;
            p.z = a.z + (b.z - a.z) * f;
            p.y = Math.sin(f * Math.PI) * (c.voo ? 4.2 : 0.42);
            if (Math.hypot(b.x - a.x, b.z - a.z) > 0.05)
              p.ang += voltaCurta(p.ang, Math.atan2(b.x - a.x, b.z - a.z)) * Math.min(1, dt * 14);
            andando = !c.voo;
          }
        }
      } else {
        const v = lugares?.get(p.id);
        if (v) {
          const longe = Math.hypot(v.x - p.x, v.z - p.z);
          andando = longe > 0.08;
          p.x += (v.x - p.x) * Math.min(1, dt * 6);
          p.z += (v.z - p.z) * Math.min(1, dt * 6);
          p.ang += voltaCurta(p.ang, v.ang) * Math.min(1, dt * 6);
        }
      }
      if (p.reacao && t - p.reacao.inicio > 2.8) p.reacao = null;
      const festa = e?.fase === "fim" && noPodio === 0;
      p.mascote.atualizar({
        t,
        humor: "normal",
        reacao: p.reacao?.tipo ?? (festa ? "pulinhos" : null),
        p: p.reacao ? t - p.reacao.inicio : festa ? t % 2.4 : 0,
        mouse: { x: 0, y: 0 },
        calmo: false,
        andando,
      });
      p.grupo.visible = p.rotulo.visible = p.visivel;
      p.grupo.position.set(p.x, TOPO + p.y, p.z);
      p.grupo.rotation.y = p.ang;
      p.rotulo.position.set(p.x, TOPO + p.y + (p.mascote.topo + 0.95) * ESCALA, p.z);
    }

    // dados rolando: caem girando, quicam e param com o valor para cima
    dados.forEach((d, k) => {
      const [gx, gz] = GIRO_DO_DADO[d.valor] ?? [0, 0];
      const lado = k ? 0.6 : -0.6;
      if (rolagem) {
        const f = Math.min(1, (t - rolagem.inicio) / 1.25);
        const s = (1 - f) * (1 - f);
        d.malha.rotation.set(
          gx + s * (9 + d.giro[0]),
          s * (7 + d.giro[1]),
          gz + s * (8 + d.giro[2]),
        );
        d.malha.position.set(
          lado + s * (k ? 2.4 : -2.4),
          0.47 + s * 3 + Math.abs(Math.sin(f * Math.PI * 3)) * 0.9 * (1 - f),
          5.6 + s * 1.2,
        );
        if (f >= 1 && k === 1) rolagem = null;
      } else {
        d.malha.rotation.set(gx, 0, gz);
        d.malha.position.set(lado, 0.47, 5.6);
      }
    });

    for (let i = avisos.length - 1; i >= 0; i--) {
      const a = avisos[i];
      if (!a) continue;
      const f = (t - a.inicio) / 1.9;
      if (f >= 1) {
        cena.remove(a.sprite);
        a.sprite.material.map?.dispose();
        a.sprite.material.dispose();
        avisos.splice(i, 1);
        continue;
      }
      a.sprite.position.set(a.x, a.y + f * 1.5, a.z);
      a.sprite.material.opacity = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
    }

    // marca de quem joga e moldura da casa selecionada
    const daVez = e?.fase === "jogo" ? e.jogadores[e.vez] : undefined;
    const pVez = daVez ? pecas.get(daVez.id) : undefined;
    marca.visible = !!pVez;
    if (pVez && daVez) {
      marca.position.set(pVez.x, TOPO + 0.02, pVez.z);
      (marca.material as TH.MeshBasicMaterial).color.set(CORES[daVez.cor]?.hex ?? "#ffffff");
      const s = 1 + Math.sin(t * 4) * 0.08;
      marca.scale.set(s, s, 1);
    }
    moldura.visible = selecionada !== null;
    if (selecionada !== null) {
      const c = lugarDaCasa(selecionada);
      moldura.position.set(c.x, TOPO + 0.012, c.z);
      moldura.rotation.z = c.rot;
      moldura.scale.set(c.canto ? CANTO : LARG, CANTO, 1);
      (moldura.material as TH.MeshBasicMaterial).opacity = 0.26 + Math.sin(t * 5) * 0.1;
    }

    // câmera: abertura mostrando tudo, depois acompanha quem joga (ou o que foi escolhido)
    const naIntro = t < intro;
    let dAz = az;
    let dElev = elev;
    let dDist = dist;
    if (!e || e.fase === "sala" || naIntro) {
      alvoDesejado.set(0, 0, 0);
      if (!manual || naIntro) {
        az += dt * (naIntro ? 0.5 : 0.07);
        dAz = az;
        dElev = 0.82;
        dDist = naIntro ? 36 : 40;
      }
    } else if (e.fase === "fim") {
      alvoDesejado.set(0, 1.3, 6.3);
      if (!manual) {
        dAz = 0;
        dElev = 0.3;
        dDist = 11;
      }
    } else {
      const seguido =
        foco.tipo === "jogador" ? pecas.get(foco.id) : foco.tipo === "vez" ? pVez : undefined;
      if (foco.tipo === "casa") {
        const c = lugarDaCasa(foco.i);
        alvoDesejado.set(c.x, 0.4, c.z);
        if (!manual) {
          dAz = Math.atan2(c.x, c.z);
          dElev = 0.75;
          dDist = 13;
        }
      } else if (seguido) {
        alvoDesejado.set(seguido.x, 0.6, seguido.z);
        if (!manual) {
          dAz = Math.atan2(seguido.x, seguido.z);
          dElev = 0.6;
          dDist = 12.5;
        }
      } else {
        alvoDesejado.set(0, 0, 0);
        if (!manual) {
          dElev = 0.85;
          dDist = 38;
        }
      }
    }
    const k = Math.min(1, dt * 3);
    alvo.lerp(alvoDesejado, Math.min(1, dt * 4));
    az += voltaCurta(az, dAz) * k;
    elev += (dElev - elev) * k;
    dist += (dDist - dist) * k;
    camera.position.set(
      alvo.x + Math.sin(az) * Math.cos(elev) * dist,
      alvo.y + Math.sin(elev) * dist,
      alvo.z + Math.cos(az) * Math.cos(elev) * dist,
    );
    camera.lookAt(alvo);
    for (const n of nuvens.nuvens) n.malha.position.x = n.x0 + Math.sin(t * 0.03 + n.x0) * 3;
    renderer.render(cena, camera);
  };
  raf = requestAnimationFrame(quadro);

  return {
    sincronizar,
    /** Um mascote faz uma animação (emote). */
    reagir(id: string, reacao: string) {
      const p = pecas.get(id);
      if (p) p.reacao = { tipo: reacao as Reacao, inicio: tempo };
    },
    /** Para onde a câmera olha. Escolher um foco devolve o enquadramento automático. */
    focar(novo: Foco) {
      foco = novo;
      manual = false;
    },
    selecionar(i: number | null) {
      selecionada = i;
    },
    descartar() {
      morto = true;
      cancelAnimationFrame(raf);
      observador.disconnect();
      for (const p of pecas.values()) desmontar(p);
      for (const m of minis.values())
        m.grupo.traverse((o) => (o.userData["solto"] as TH.Material | undefined)?.dispose());
      for (const a of avisos) {
        a.sprite.material.map?.dispose();
        a.sprite.material.dispose();
      }
      lixo.forEach((l) => l.dispose());
      modelo?.geo.dispose();
      ped?.geo.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
export type CenaMagnata = ReturnType<typeof criarCenaMagnata>;
