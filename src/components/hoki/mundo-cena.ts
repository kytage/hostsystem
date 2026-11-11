/**
 * Cenário 3D da Praça HOST: a ilha flutuante em blocos, com o terreno em
 * camadas (grama, terra e rocha), a praça redonda de pedra clara com a fonte,
 * os caminhos, o rio com a ponte, o morro com a cachoeira, o coreto, as
 * pérgolas, as árvores e o letreiro HOST no céu. As posições vêm de
 * mundo-mapa.ts; aqui é só o desenho.
 */
import type * as TH from "three";
import { acabamento, criarManchas, texturaMancha, type Mancha } from "./luz";
import {
  ANEL,
  ARVORES,
  anguloDoBalanco,
  BALANCO,
  BANCOS,
  BERCO,
  CANTEIROS,
  CHUVEIRO,
  CORREIO,
  CORETO,
  DECK_DO_BERCO,
  ESCORREGADOR,
  ESCRITORIO,
  FAZENDA,
  FONTE,
  ILHA,
  MESAS,
  MORRO,
  PEDRAS,
  PERGOLAS,
  PARKOUR,
  PILARES,
  POCA,
  PONTE,
  PONTE_DA_FAZENDA,
  PISTA,
  PONTE_DA_PISTA,
  PONTE_DO_ESCRITORIO,
  POSTES,
  RIO,
  TERMOMETRO,
  VAGAS,
  dentroDaIlha,
  naAgua,
  noMorro,
  piso,
  postesDaPergola,
  xRio,
} from "./mundo-mapa";
import {
  Blocos,
  arbusto,
  arvore,
  criarNuvens,
  letrasDePedra,
  pedregulho,
  sorteador,
  texturaAgua,
  texturaQueda,
} from "./voxel";

/** Altura do assento dos bancos (onde o HOKI fica quando senta). */
export const ASSENTO = 0.47;
/** Névoa que fecha embaixo da ilha. */
const NEVOA = { inicio: 3.5, fim: 15, forca: 0.95 };

const GRAMA = [0x6cc046, 0x63b73f, 0x76c84e] as const;
const GRAMA_ESCURA = [0x4f9c35, 0x58a83b] as const;
const TERRA = [0x8e5b35, 0x82512e, 0x9a663c] as const;
const ROCHA = [0x8b8279, 0x7b736b, 0x999289] as const;
const PAVE = [0xded3bf, 0xd3c7b1, 0xe7ddcc, 0xcbbfa9] as const;
const PEDRA_CLARA = [0xe2d9c8, 0xd8cebb, 0xece4d5] as const;
const MEIO_FIO = 0xb3a791;
const REJUNTE = 0x91866e;
const MADEIRA = [0xa8743c, 0x9c6a36, 0xb47e44] as const;
const MADEIRA_ESCURA = 0x6b4526;
const FERRO = 0x2b2d32;
const TELHA = [0xb5533c, 0xa64632, 0xc46045] as const;
const FLORES = [0xffffff, 0xff5a5a, 0xffd84a, 0xff8fc8, 0xfff1a8] as const;

export function criarMundo(THREE: typeof TH) {
  const lixo: { dispose: () => void }[] = [];
  const grupo = new THREE.Group();
  const r = sorteador(7);
  const escolhe = (l: readonly number[]) => l[Math.floor(r() * l.length)] ?? l[0]!;
  // cada tipo de coisa vai num conjunto de blocos, com o seu acabamento
  const chao = new Blocos(r); // gramado e base dos caminhos (só recebe sombra)
  const piso3d = new Blocos(r); // pedras do calçamento e meios-fios
  const encosta = new Blocos(r); // lateral da ilha: grama pendurada, terra e rocha
  const pedra = new Blocos(r); // fonte, coreto, ponte, muretas, rochas
  const madeira = new Blocos(r); // bancos, cercas, pérgolas, troncos, telhado, ferro dos postes
  const folhas = new Blocos(r); // copas, arbustos, flores e tufos
  const aceso = new Blocos(r); // miolo das luminárias
  const sombras: Mancha[] = []; // sombras de contato (pé de árvore, banco, poste...)
  const clarao: Mancha[] = []; // luz das luminárias no piso
  const lampadas: [number, number, number][] = [];

  const ruido = (x: number, z: number) => {
    const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  // quantos blocos a ilha tem de fundura em cada casa: rasa na borda, funda no meio
  const fundura = (x: number, z: number) => {
    if (!dentroDaIlha(x, z)) return 0;
    const f = 1 - Math.pow(Math.abs(x) / ILHA.a, ILHA.n) - Math.pow(Math.abs(z) / ILHA.b, ILHA.n);
    return Math.max(
      2,
      Math.round(2 + 7.5 * Math.pow(Math.min(1, f / 0.62), 0.75) + (ruido(x, z) - 0.5) * 1.6),
    );
  };
  // morro: sobe para o fundo e para a direita; a cachoeira desce por um canal em degraus
  const CANAL = [POCA.x - 0.5, POCA.x + 0.5].map(Math.round) as [number, number];
  const noCanal = (x: number) => x >= CANAL[0] && x <= CANAL[1];
  const degrauDoCanal = (z: number) =>
    Math.max(1, Math.min(4, Math.round(0.5 + (MORRO.z1 - z) * 1.0)));
  const alturaMorro = (x: number, z: number) => {
    if (!noMorro(x, z) || !dentroDaIlha(x, z)) return 0;
    if (noCanal(x)) return degrauDoCanal(z);
    const h = Math.max(
      1,
      Math.min(
        6,
        Math.round(
          1.5 + (x - MORRO.x0) * 0.45 + (MORRO.z1 - z) * 0.85 + (ruido(x * 3, z * 7) - 0.5),
        ),
      ),
    );
    return x === CANAL[0] - 1 || x === CANAL[1] + 1 ? Math.max(h, degrauDoCanal(z) + 1) : h;
  };
  const VIZINHOS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const calcado = (x: number, z: number) =>
    dentroDaIlha(x, z) && !noMorro(x, z) && !naAgua(x, z) && piso(x, z) === "caminho";

  // ---------------- terreno: tampa de grama, calçamento e a encosta em camadas ----------------
  const molhados: number[] = [];
  for (let x = -24; x <= 24; x++) {
    for (let z = -16; z <= 16; z++) {
      if (!dentroDaIlha(x, z)) {
        // degraus soltos do lado de fora: deixam a borda irregular
        if (
          VIZINHOS.some(([dx, dz]) => dentroDaIlha(x + dx, z + dz)) &&
          !naAgua(x, z - 1) &&
          r() < 0.34
        ) {
          const topo = -0.5 - Math.floor(r() * 3) * 0.5;
          const lado = r() < 0.35 ? 0.6 : 1;
          encosta.base(
            x,
            topo - 1.4 - r(),
            z,
            lado,
            1.4 + r(),
            lado,
            escolhe(r() < 0.5 ? TERRA : ROCHA),
            0.07,
          );
          if (r() < 0.65)
            encosta.base(x, topo, z, lado + 0.06, 0.24, lado + 0.06, escolhe(GRAMA), 0.05);
        }
        continue;
      }
      const morro = noMorro(x, z);
      const molhado = naAgua(x, z) && !morro;
      const D = fundura(x, z);
      if (molhado) {
        encosta.base(x, -1.45, z, 1, 0.65, 1, r() < 0.2 ? 0x8f8a80 : 0xa8946a, 0.06);
        molhados.push(x, z);
      } else if (morro) {
        const h = alturaMorro(x, z);
        const canal = noCanal(x);
        encosta.base(x, -0.35, z, 1, 0.35, 1, escolhe(ROCHA), 0.06);
        for (let l = 0; l < h; l++) {
          if (!VIZINHOS.some(([dx, dz]) => alturaMorro(x + dx, z + dz) < l + 1) && l < h - 1)
            continue;
          const topo = l === h - 1 && !canal ? l + 0.68 : l + 1;
          pedra.base(
            x,
            l,
            z,
            1 + (r() < 0.2 ? 0.14 : 0),
            topo - l,
            1 + (r() < 0.2 ? 0.14 : 0),
            escolhe(ROCHA),
            0.07,
          );
        }
        if (!canal) chao.base(x, h - 0.32, z, 1.04, 0.32, 1.04, escolhe(GRAMA), 0.04);
      } else if (piso(x, z) === "caminho") chao.base(x, -0.35, z, 1, 0.35, 1, REJUNTE, 0.03);
      else chao.base(x, -0.35, z, 1, 0.35, 1, escolhe(GRAMA), 0.035);

      // barranco na beira do rio
      if (
        !molhado &&
        VIZINHOS.some(([dx, dz]) => naAgua(x + dx, z + dz) && !noMorro(x + dx, z + dz))
      )
        encosta.base(x, -1.35, z, 1, 1, 1, escolhe(TERRA), 0.06);
      // casca da encosta: só os blocos que aparecem de fora
      for (let k = 0; k < D; k++) {
        if (!VIZINHOS.some(([dx, dz]) => fundura(x + dx, z + dz) <= k)) continue;
        const rocha = k >= 2 + (ruido(x * 5, z * 3) > 0.6 ? 1 : 0);
        const gordo = r() < 0.24 ? 0.16 + r() * 0.22 : 0;
        encosta.base(
          x,
          -1.35 - k,
          z,
          1 + gordo,
          1,
          1 + gordo,
          escolhe(rocha ? ROCHA : TERRA),
          0.07,
        );
        if (r() < 0.12) {
          const [dx, dz] = VIZINHOS[Math.floor(r() * 4)]!;
          if (fundura(x + dx, z + dz) <= k)
            encosta.add(
              x + dx * 0.66,
              -0.6 - k - r() * 0.4,
              z + dz * 0.66,
              0.5,
              0.5,
              0.5,
              escolhe(rocha ? ROCHA : TERRA),
              0.07,
            );
        }
      }
      // pontas de rocha penduradas embaixo da borda
      if (D <= 4 && r() < 0.16)
        encosta.base(
          x + (r() - 0.5) * 0.4,
          -0.35 - D - 0.6 - r() * 1.8,
          z + (r() - 0.5) * 0.4,
          0.62,
          0.6 + r() * 1.8,
          0.62,
          ROCHA[1],
          0.07,
        );
      // grama pendurada na beirada, em dentes de alturas diferentes
      for (const [dx, dz] of VIZINHOS) {
        if (dentroDaIlha(x + dx, z + dz) || molhado) continue;
        const h = 0.28 + Math.floor(r() * 3) * 0.16;
        encosta.add(
          x + dx * 0.53,
          -0.02 - h / 2,
          z + dz * 0.53,
          dx ? 0.14 : 1.02,
          h,
          dz ? 0.14 : 1.02,
          escolhe(GRAMA_ESCURA),
          0.05,
        );
        if (r() < 0.5)
          encosta.add(
            x + dx * 0.55 + (dz ? (r() - 0.5) * 0.5 : 0),
            -0.02 - (h + 0.3) / 2,
            z + dz * 0.55 + (dx ? (r() - 0.5) * 0.5 : 0),
            dx ? 0.14 : 0.42,
            h + 0.3,
            dz ? 0.14 : 0.42,
            escolhe(GRAMA_ESCURA),
            0.05,
          );
      }
    }
  }

  // ---------------- praça redonda: pedras em anéis, rejunte por baixo e meio-fio nas beiradas ----------------
  /** Fileira de blocos em roda, em volta de um centro: cada um virado para fora. */
  const roda = (
    b: Blocos,
    cx: number,
    cz: number,
    raio: number,
    n: number,
    y0: number,
    fundo: number,
    alto: number,
    cores: readonly number[],
    fase = 0,
    folga = 0.035,
    pula?: (a: number) => boolean,
  ) => {
    for (let i = 0; i < n; i++) {
      const a = fase + (i / n) * Math.PI * 2;
      if (pula?.(a)) continue;
      b.base(
        cx + Math.cos(a) * raio,
        y0,
        cz + Math.sin(a) * raio,
        fundo,
        alto,
        (Math.PI * 2 * raio) / n - folga,
        escolhe(cores),
        0.035,
        -a,
      );
    }
  };
  const gRejunte = new THREE.RingGeometry(ANEL.dentro - 0.3, ANEL.fora + 0.35, 72);
  gRejunte.rotateX(-Math.PI / 2);
  const mRejunte = new THREE.MeshStandardMaterial({ color: REJUNTE, roughness: 1 });
  const rejunte = new THREE.Mesh(gRejunte, mRejunte);
  rejunte.position.set(FONTE.x, 0.012, FONTE.z);
  rejunte.receiveShadow = true;
  grupo.add(rejunte);
  lixo.push(gRejunte, mRejunte);
  const FAIXA = (ANEL.fora - ANEL.dentro) / 5;
  for (let k = 0; k < 5; k++) {
    const raio = ANEL.dentro + FAIXA * (k + 0.5);
    roda(
      piso3d,
      FONTE.x,
      FONTE.z,
      raio,
      Math.round((Math.PI * 2 * raio) / 0.98),
      0.012,
      FAIXA - 0.04,
      0.045,
      PAVE,
      k * 0.37,
    );
  }
  // meio-fio de fora (aberto onde os 4 caminhos chegam) e de dentro, em volta do canteiro
  const naEntrada = (a: number) =>
    Math.min(Math.abs(Math.sin(a)), Math.abs(Math.cos(a))) * (ANEL.fora + 0.2) < 1.7;
  roda(
    piso3d,
    FONTE.x,
    FONTE.z,
    ANEL.fora + 0.2,
    56,
    0,
    0.36,
    0.13,
    [MEIO_FIO, 0xa99d87],
    0,
    0.04,
    naEntrada,
  );
  roda(piso3d, FONTE.x, FONTE.z, ANEL.dentro - 0.14, 36, 0, 0.26, 0.2, [MEIO_FIO, 0xbdb19c]);

  // ---------------- caminhos: tijolos de pedra em fiadas desencontradas, com meio-fio ----------------
  for (let x = -24; x <= 24; x++) {
    for (let z = -16; z <= 16; z++) {
      if (!calcado(x, z)) continue;
      for (let h = 0; h < 2; h++) {
        const zc = z - 0.25 + h * 0.5;
        const tijolo = (cx: number, largo: number) =>
          piso3d.base(cx, 0, zc, largo - 0.04, 0.045, 0.46, escolhe(PAVE), 0.035);
        if (((z * 2 + h) & 1) === 0) tijolo(x, 1);
        else {
          if (calcado(x + 1, z)) tijolo(x + 0.5, 1);
          else tijolo(x + 0.25, 0.5);
          if (!calcado(x - 1, z)) tijolo(x - 0.25, 0.5);
        }
      }
      for (const [dx, dz] of VIZINHOS) {
        const nx = x + dx;
        const nz = z + dz;
        if (!dentroDaIlha(nx, nz) || naAgua(nx, nz) || noMorro(nx, nz) || piso(nx, nz) !== "grama")
          continue;
        piso3d.base(
          x + dx * 0.56,
          0,
          z + dz * 0.56,
          dx ? 0.16 : 1,
          0.11,
          dz ? 0.16 : 1,
          r() < 0.5 ? MEIO_FIO : 0xa99d87,
          0.03,
        );
      }
    }
  }

  // ---------------- fonte em três níveis ----------------
  const FX = FONTE.x;
  const FZ = FONTE.z;
  /** Bloco "oitavado": duas caixas iguais, uma girada 45°. */
  const oitavado = (y0: number, lado: number, alto: number, cor: number) => {
    pedra.base(FX, y0, FZ, lado, alto, lado, cor, 0.03);
    pedra.base(FX, y0, FZ, lado, alto, lado, cor, 0.03, Math.PI / 4);
  };
  roda(pedra, FX, FZ, 3.2, 24, 0, 0.5, 0.2, [0xc9bea9, 0xbfb49e]);
  roda(pedra, FX, FZ, 2.78, 20, 0.02, 0.5, 0.6, PEDRA_CLARA, 0.15);
  roda(pedra, FX, FZ, 2.78, 20, 0.62, 0.64, 0.13, [0xf0e9db, 0xe6dece], 0);
  oitavado(0.05, 1.15, 0.62, PEDRA_CLARA[1]);
  oitavado(0.67, 0.62, 0.86, PEDRA_CLARA[0]);
  oitavado(1.5, 1.86, 0.12, PEDRA_CLARA[1]);
  roda(pedra, FX, FZ, 0.98, 10, 1.6, 0.34, 0.26, PEDRA_CLARA, 0.2, 0.02);
  oitavado(1.6, 0.44, 0.78, PEDRA_CLARA[0]);
  oitavado(2.36, 1.02, 0.1, PEDRA_CLARA[1]);
  roda(pedra, FX, FZ, 0.52, 8, 2.44, 0.22, 0.2, PEDRA_CLARA, 0, 0.02);
  oitavado(2.44, 0.24, 0.5, PEDRA_CLARA[2]);
  sombras.push({ x: FX, z: FZ, rx: 4.1, rz: 4.1 });

  // canteiros em arco em volta da fonte: terra, cerca viva e flores (abertos nos 4 eixos)
  for (let g = 0; g < 360; g += 9) {
    if (g % 90 < 16 || g % 90 > 74) continue;
    const a = (g * Math.PI) / 180;
    const x = FX + Math.cos(a) * 3.82;
    const z = FZ + Math.sin(a) * 3.82;
    encosta.base(x, 0, z, 0.66, 0.12, 0.62, 0x5d3f27, 0.05, -a);
    folhas.base(x, 0.1, z, 0.56, 0.36 + ((g / 9) % 2) * 0.12, 0.6, escolhe(GRAMA_ESCURA), 0.06, -a);
    for (let n = 0; n < 2; n++)
      folhas.base(
        x + (r() - 0.5) * 0.4,
        0.5 + ((g / 9) % 2) * 0.1,
        z + (r() - 0.5) * 0.4,
        0.15,
        0.14,
        0.15,
        escolhe(FLORES),
        0,
      );
  }

  // ---------------- bancos de madeira com pés de ferro ----------------
  for (const bc of BANCOS) {
    // o balanço do letreiro tem o seu próprio banco (lá embaixo, junto do letreiro)
    if (bc.balanco) continue;
    const peca = (
      b: Blocos,
      lx: number,
      y: number,
      lz: number,
      sx: number,
      sy: number,
      sz: number,
      cor: number,
    ) =>
      b.add(
        bc.x + lx * Math.cos(bc.ang) + lz * Math.sin(bc.ang),
        y,
        bc.z - lx * Math.sin(bc.ang) + lz * Math.cos(bc.ang),
        sx,
        sy,
        sz,
        cor,
        0.05,
        bc.ang,
      );
    for (let i = -1; i <= 1; i++)
      peca(madeira, 0, ASSENTO - 0.04, i * 0.17 + 0.02, 1.36, 0.07, 0.15, escolhe(MADEIRA));
    peca(madeira, 0, 0.67, -0.27, 1.36, 0.13, 0.07, escolhe(MADEIRA));
    peca(madeira, 0, 0.87, -0.29, 1.36, 0.13, 0.07, escolhe(MADEIRA));
    for (const lado of [-1, 1]) {
      peca(madeira, lado * 0.6, 0.2, 0.2, 0.08, 0.4, 0.08, FERRO);
      peca(madeira, lado * 0.6, 0.48, -0.28, 0.08, 0.96, 0.08, FERRO);
      peca(madeira, lado * 0.6, 0.62, -0.03, 0.08, 0.06, 0.52, FERRO);
    }
    sombras.push({ x: bc.x, z: bc.z, rx: 1.05, rz: 0.62, giro: bc.ang });
  }

  // ---------------- luminárias: base de pedra, haste de ferro e lanterna acesa ----------------
  for (const p of POSTES) {
    pedra.base(p.x, 0, p.z, 0.42, 0.16, 0.42, 0x9a917f, 0.04);
    madeira.base(p.x, 0.16, p.z, 0.22, 0.3, 0.22, FERRO, 0.03);
    madeira.base(p.x, 0.46, p.z, 0.12, 2.1, 0.12, FERRO, 0.03);
    madeira.base(p.x, 2.56, p.z, 0.34, 0.08, 0.34, FERRO, 0.03);
    aceso.base(p.x, 2.64, p.z, 0.3, 0.42, 0.3, 0xffd98a, 0);
    for (const i of [-1, 1])
      for (const j of [-1, 1])
        madeira.base(p.x + i * 0.18, 2.64, p.z + j * 0.18, 0.05, 0.42, 0.05, FERRO, 0);
    madeira.base(p.x, 3.06, p.z, 0.52, 0.08, 0.52, FERRO, 0.03);
    madeira.base(p.x, 3.14, p.z, 0.3, 0.1, 0.3, FERRO, 0.03);
    madeira.base(p.x, 3.24, p.z, 0.1, 0.14, 0.1, FERRO, 0.03);
    sombras.push({ x: p.x, z: p.z, rx: 0.5, rz: 0.5 });
    clarao.push({ x: p.x, z: p.z, rx: 2.7, rz: 2.7 });
    lampadas.push([p.x, 2.86, p.z]);
  }

  // ---------------- coreto: colunas de pedra, degrau em volta e telhado de telhas terracota ----------------
  for (const p of PILARES) {
    pedra.base(p.x, 0, p.z, 0.82, 0.28, 0.82, PEDRA_CLARA[1], 0.03);
    pedra.base(p.x, 0.28, p.z, 0.5, 1.3, 0.5, PEDRA_CLARA[0], 0.03);
    pedra.base(p.x, 1.58, p.z, 0.5, 1.22, 0.5, PEDRA_CLARA[2], 0.03);
    pedra.base(p.x, 2.8, p.z, 0.76, 0.24, 0.76, PEDRA_CLARA[1], 0.03);
    sombras.push({ x: p.x, z: p.z, rx: 0.8, rz: 0.8 });
  }
  for (const lado of [-1, 1]) {
    // degrau de pedra em volta do piso e vigas de madeira em cima das colunas
    for (let i = -3; i <= 3; i++) {
      pedra.base(
        CORETO.x + i,
        0,
        CORETO.z + lado * 3.3,
        0.96,
        0.1,
        0.5,
        escolhe(PEDRA_CLARA),
        0.03,
      );
      pedra.base(
        CORETO.x + lado * 3.3,
        0,
        CORETO.z + i,
        0.5,
        0.1,
        0.96,
        escolhe(PEDRA_CLARA),
        0.03,
      );
    }
    madeira.base(CORETO.x, 3.04, CORETO.z + lado * 2.4, 5.7, 0.26, 0.34, MADEIRA_ESCURA, 0.04);
    madeira.base(CORETO.x + lado * 2.4, 3.04, CORETO.z, 0.34, 0.26, 5.7, MADEIRA_ESCURA, 0.04);
  }
  [6.9, 5.9, 4.9, 3.9, 2.9, 1.9, 0.9].forEach((lado, k) => {
    const y = 3.3 + k * 0.32;
    if (lado < 1.2) {
      madeira.base(CORETO.x, y, CORETO.z, lado, 0.32, lado, TELHA[0], 0.04);
      return;
    }
    madeira.base(CORETO.x, y, CORETO.z, lado - 1.1, 0.32, lado - 1.1, TELHA[1], 0.03);
    // a beirada de cada camada é feita de telhas separadas (os cantos ficam com as fileiras da frente e de trás)
    const n = Math.max(1, Math.round(lado / 0.86));
    for (let i = 0; i < n; i++)
      for (const s of [-1, 1])
        madeira.base(
          CORETO.x + ((i + 0.5) / n - 0.5) * lado,
          y,
          CORETO.z + s * (lado / 2 - 0.26),
          lado / n - 0.03,
          0.32,
          0.52,
          escolhe(TELHA),
          0.04,
        );
    const resto = lado - 1.04;
    const n2 = Math.max(1, Math.round(resto / 0.86));
    for (let i = 0; i < n2; i++)
      for (const s of [-1, 1])
        madeira.base(
          CORETO.x + s * (lado / 2 - 0.26),
          y,
          CORETO.z + ((i + 0.5) / n2 - 0.5) * resto,
          0.52,
          0.32,
          resto / n2 - 0.03,
          escolhe(TELHA),
          0.04,
        );
  });
  madeira.base(CORETO.x, 5.54, CORETO.z, 0.34, 0.5, 0.34, 0xd9b27a, 0.02);
  madeira.base(CORETO.x, 6.04, CORETO.z, 0.16, 0.22, 0.16, 0xe8c98f, 0.02);
  sombras.push({ x: CORETO.x, z: CORETO.z, rx: 4.6, rz: 4.6 });

  // ---------------- pérgolas com trepadeira, sobre os bancos das áreas de descanso ----------------
  for (const pg of PERGOLAS) {
    for (const p of postesDaPergola(pg)) {
      madeira.base(p.x, 0, p.z, 0.3, 0.14, 0.3, MADEIRA_ESCURA, 0.04);
      madeira.base(p.x, 0.14, p.z, 0.18, 2.3, 0.18, escolhe(MADEIRA), 0.05);
      sombras.push({ x: p.x, z: p.z, rx: 0.42, rz: 0.42 });
      // trepadeira subindo pelo poste
      for (let n = 0; n < 4; n++)
        folhas.add(
          p.x + (r() - 0.5) * 0.2,
          0.5 + n * 0.5 + r() * 0.2,
          p.z + (r() - 0.5) * 0.2,
          0.3,
          0.26,
          0.3,
          escolhe(GRAMA_ESCURA),
          0.07,
          r(),
        );
    }
    const cz = (pg.z0 + pg.z1) / 2;
    const cx = (pg.x0 + pg.x1) / 2;
    for (const x of [pg.x0, pg.x1])
      madeira.base(x, 2.44, cz, 0.2, 0.2, pg.z1 - pg.z0 + 0.7, MADEIRA_ESCURA, 0.04);
    const ripas = Math.round((pg.z1 - pg.z0 + 0.5) / 0.48);
    for (let i = 0; i <= ripas; i++) {
      const z = pg.z0 - 0.25 + (i / ripas) * (pg.z1 - pg.z0 + 0.5);
      madeira.base(cx, 2.64, z, pg.x1 - pg.x0 + 0.7, 0.1, 0.12, escolhe(MADEIRA), 0.05);
      for (let n = 0; n < 3; n++) {
        if (r() < 0.45) continue;
        const x = pg.x0 + r() * (pg.x1 - pg.x0);
        folhas.base(
          x,
          2.72,
          z,
          0.5,
          0.2,
          0.44,
          escolhe(r() < 0.75 ? GRAMA_ESCURA : GRAMA),
          0.07,
          r(),
        );
        if (r() < 0.4)
          folhas.base(
            x + (r() - 0.5) * 0.3,
            2.9,
            z,
            0.14,
            0.12,
            0.14,
            r() < 0.5 ? 0xff8fc8 : 0xffffff,
            0,
          );
        if (r() < 0.25)
          folhas.add(x, 2.5 - r() * 0.3, z, 0.12, 0.4 + r() * 0.4, 0.12, GRAMA_ESCURA[0], 0.05);
      }
    }
  }

  // ---------------- ponte de pedra em arco (o tabuleiro fica no nível do chão, para dar para andar) ----------------
  const xPonte = molhados
    .filter((_, i) => i % 2 === 0 && molhados[i + 1] === PONTE.z)
    .sort((a, b) => a - b);
  const x0P = (xPonte[0] ?? 15) - 1;
  const x1P = (xPonte[xPonte.length - 1] ?? 18) + 1;
  for (let x = x0P; x <= x1P; x++) {
    const meio = 1 - Math.abs((x - (x0P + x1P) / 2) / ((x1P - x0P) / 2)); // 0 nas pontas, 1 no meio
    const molhado = x > x0P && x < x1P;
    for (let z = -1; z <= 1; z++)
      if (naAgua(x, PONTE.z + z))
        for (const dz of [-0.25, 0.25])
          pedra.base(x, -0.3, PONTE.z + z + dz, 0.97, 0.345, 0.47, escolhe(PAVE), 0.035);
    for (const s of [-1, 1]) {
      const z = PONTE.z + s * 1.62;
      // mureta que sobe no meio, com capa clara, e as pedras do arco por baixo
      const alto = 0.42 + Math.round(meio * 3) * 0.12;
      pedra.base(x, 0, z, 0.98, alto, 0.3, escolhe(PEDRA_CLARA), 0.035);
      pedra.base(x, alto, z, 1.03, 0.1, 0.4, 0xf0e9db, 0.03);
      if (molhado)
        pedra.base(
          x,
          -0.36 - (1 - meio) * 0.6,
          z,
          0.98,
          0.36 + (1 - meio) * 0.6,
          0.3,
          escolhe(PEDRA_CLARA),
          0.035,
        );
      if (x === x0P || x === x1P) {
        pedra.base(x + (x === x0P ? -0.3 : 0.3), 0, z, 0.46, 0.92, 0.46, PEDRA_CLARA[1], 0.03);
        pedra.base(x + (x === x0P ? -0.3 : 0.3), 0.92, z, 0.56, 0.12, 0.56, 0xf0e9db, 0.03);
      }
    }
  }

  // ---------------- água: rio, quedas, poça do morro, riacho e os espelhos da fonte ----------------
  const tAgua = texturaAgua(THREE);
  const tParada = texturaAgua(THREE, 5);
  const tQueda = texturaQueda(THREE);
  const mAgua = acabamento(
    new THREE.MeshStandardMaterial({
      map: tAgua,
      roughness: 0.16,
      transparent: true,
      opacity: 0.88,
    }),
    { nevoa: NEVOA },
  );
  const mParada = new THREE.MeshStandardMaterial({
    map: tParada,
    roughness: 0.12,
    transparent: true,
    opacity: 0.9,
  });
  const mQueda = acabamento(
    new THREE.MeshStandardMaterial({
      map: tQueda,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
    { nevoa: NEVOA },
  );
  lixo.push(tAgua, tParada, tQueda, mAgua, mParada, mQueda);
  /** Junta retângulos (4 cantos em ordem + trecho da textura) numa malha só. */
  const lamina = (m: TH.Material) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    return {
      quadro(c: number[][], u0: number, v0: number, u1: number, v1: number) {
        const n = pos.length / 3;
        for (const p of c) pos.push(p[0]!, p[1]!, p[2]!);
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      },
      montar() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const malha = new THREE.Mesh(g, m);
        malha.receiveShadow = true;
        grupo.add(malha);
        lixo.push(g);
      },
    };
  };
  const rio = lamina(mAgua);
  const quedas = lamina(mQueda);
  const parada = lamina(mParada);
  /** Lâmina deitada entre (x0, z0) e (x1, z1), na altura y. */
  const deitada = (
    l: ReturnType<typeof lamina>,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    k = 0.25,
  ) =>
    l.quadro(
      [
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
        [x0, y, z0],
      ],
      x0 * k,
      -z1 * k,
      x1 * k,
      -z0 * k,
    );
  /** Queda em pé de y0 até y1, de (xa, za) a (xb, zb). */
  const empe = (xa: number, za: number, xb: number, zb: number, y0: number, y1: number) =>
    quedas.quadro(
      [
        [xa, y0, za],
        [xb, y0, zb],
        [xb, y1, zb],
        [xa, y1, za],
      ],
      xa * 0.5 + za * 0.3,
      y0 * 0.25,
      xa * 0.5 + za * 0.3 + Math.hypot(xb - xa, zb - za) * 0.5,
      y1 * 0.25,
    );
  const NIVEL = -0.3;
  for (let i = 0; i < molhados.length; i += 2) {
    const x = molhados[i]!;
    const z = molhados[i + 1]!;
    deitada(rio, x - 0.5, z - 0.5, x + 0.5, z + 0.5, NIVEL);
    // o rio despenca da borda da frente da ilha
    if (!dentroDaIlha(x, z + 1)) empe(x - 0.5, z + 0.52, x + 0.5, z + 0.52, -16, NIVEL);
  }
  // cachoeira do morro: desce o canal em degraus e cai na poça
  const [c0, c1] = CANAL;
  for (let z = Math.ceil(MORRO.z1 - 6); z < MORRO.z1; z++) {
    if (!dentroDaIlha(c0, z) || !noMorro(c0, z)) continue;
    const h = degrauDoCanal(z);
    const frente = alturaMorro(c0, z + 1);
    deitada(rio, c0 - 0.5, z - 0.5, c1 + 0.5, z + 0.5, h + 0.03);
    if (frente < h)
      empe(c0 - 0.5, z + 0.52, c1 + 0.5, z + 0.52, frente > 0 ? frente + 0.03 : 0.06, h + 0.03);
  }
  deitada(rio, POCA.x - 1.35, MORRO.z1, POCA.x + 1.6, POCA.z + 1.15, 0.06);
  // riacho que leva a água da poça até o rio, com uma laje de pedra para atravessar
  const xBeira = xRio(Math.round(POCA.z)) + RIO.meia;
  deitada(rio, Math.floor(xBeira + 0.5) - 0.5, POCA.z - 0.45, POCA.x - 1.3, POCA.z + 0.45, 0.05);
  pedra.base((xBeira + POCA.x - 1.3) / 2 + 0.1, 0, POCA.z, 1.1, 0.1, 1.7, PEDRA_CLARA[1], 0.03);
  for (let g = 20; g < 340; g += 32) {
    const a = (g * Math.PI) / 180 + Math.PI / 2;
    if (Math.sin(a) < -0.5) continue; // atrás fica a parede do morro
    pedra.base(
      POCA.x + Math.cos(a) * 1.5,
      0,
      POCA.z + Math.sin(a) * 1.25,
      0.5 + r() * 0.3,
      0.18 + r() * 0.2,
      0.5 + r() * 0.2,
      escolhe(ROCHA),
      0.06,
      r() * 3,
    );
  }
  // espelhos d'água da fonte e os fios que escorrem de uma taça para a outra
  const disco = (raio: number, y: number) => {
    const g = new THREE.CircleGeometry(raio, 28);
    g.rotateX(-Math.PI / 2);
    const o = new THREE.Mesh(g, mParada);
    o.position.set(FX, y, FZ);
    o.receiveShadow = true;
    grupo.add(o);
    lixo.push(g);
  };
  disco(2.56, 0.5);
  disco(0.86, 1.8);
  disco(0.44, 2.58);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const t = [Math.cos(a + Math.PI / 2) * 0.13, Math.sin(a + Math.PI / 2) * 0.13] as const;
    const fio = (raio: number, y0: number, y1: number) =>
      empe(
        FX + Math.cos(a) * raio - t[0],
        FZ + Math.sin(a) * raio - t[1],
        FX + Math.cos(a) * raio + t[0],
        FZ + Math.sin(a) * raio + t[1],
        y0,
        y1,
      );
    fio(1.18, 0.5, 1.84);
    if (i % 2 === 0) fio(0.66, 1.8, 2.62);
  }
  rio.montar();
  quedas.montar();
  parada.montar();

  // ---------------- vegetação: árvores de três cores, arbustos, flores, tufos e pedras ----------------
  for (const a of ARVORES) {
    arvore(
      folhas,
      a.x,
      a.z,
      {
        tipo: a.tipo,
        cor: a.cor ?? "verde",
        u: a.tipo === "copinha" ? 0.66 + ruido(a.x, a.z) * 0.1 : 0.74 + ruido(a.x, a.z) * 0.14,
      },
      madeira,
    );
    sombras.push({ x: a.x, z: a.z, rx: 1.15, rz: 1.15 });
    // um arbusto ou uma pedra ao pé de algumas árvores
    const ang = ruido(a.z, a.x) * Math.PI * 2;
    const px = a.x + Math.cos(ang) * 0.95;
    const pz = a.z + Math.sin(ang) * 0.95;
    if (
      dentroDaIlha(px, pz, 1) &&
      !naAgua(px, pz, 0.5) &&
      piso(Math.round(px), Math.round(pz)) === "grama"
    ) {
      if (ruido(a.x * 2, a.z) < 0.6)
        arbusto(folhas, px, pz, 0.75, ruido(a.x, a.z * 2) < 0.5 ? { flor: escolhe(FLORES) } : {});
      else pedregulho(pedra, px, pz, 0.7);
    }
  }
  for (const p of PEDRAS) {
    pedregulho(pedra, p.x, p.z, 1);
    sombras.push({ x: p.x + 0.1, z: p.z, rx: 1, rz: 0.85 });
  }
  // em cima do morro
  const topoMorro = (x: number, z: number) => alturaMorro(Math.round(x), Math.round(z));
  arvore(folhas, 21, -10.6, { tipo: "copinha", u: 0.62, y: topoMorro(21, -10.6) }, madeira);
  arvore(folhas, 20.2, -12, { tipo: "pinheiro", u: 0.6, y: topoMorro(20.2, -12) }, madeira);
  arvore(
    folhas,
    17,
    -11.8,
    { tipo: "copinha", cor: "amarelo", u: 0.52, y: topoMorro(17, -11.8) },
    madeira,
  );
  arbusto(folhas, 21.6, -9.2, 0.7, { y: topoMorro(21.6, -9.2) });
  arbusto(folhas, 20, -9, 0.6, { y: topoMorro(20, -9), flor: 0xffffff });

  const flor = (x: number, z: number, y = 0) => {
    folhas.base(x, y, z, 0.06, 0.24, 0.06, GRAMA_ESCURA[0], 0);
    folhas.base(x, y + 0.24, z, 0.2, 0.15, 0.2, escolhe(FLORES), 0);
  };
  const tufo = (x: number, z: number, y = 0) => {
    for (let n = 0; n < 3; n++)
      folhas.base(
        x + (r() - 0.5) * 0.22,
        y,
        z + (r() - 0.5) * 0.22,
        0.07,
        0.14 + r() * 0.16,
        0.07,
        escolhe(r() < 0.5 ? GRAMA_ESCURA : GRAMA),
        0.05,
        r(),
      );
  };
  const gramado = (x: number, z: number) =>
    dentroDaIlha(x, z, 1.1) &&
    !naAgua(x, z, 0.75) &&
    !noMorro(x, z) &&
    piso(Math.round(x), Math.round(z)) === "grama" &&
    Math.hypot(x - FX, z - FZ) > ANEL.fora + 0.7 &&
    Math.hypot(x - POCA.x, z - POCA.z) > 2.2;
  for (let n = 0; n < 520; n++) {
    const x = (r() - 0.5) * 46;
    const z = (r() - 0.5) * 30;
    if (!gramado(x, z)) continue;
    if (n % 3 === 0) flor(x, z);
    else tufo(x, z);
  }
  // faixa da beirada da ilha (onde ninguém pisa): arbustos, pedras e flores
  const naBorda = (g: number, folga: number): [number, number] => {
    const a = (g * Math.PI) / 180;
    const e = 2 / ILHA.n;
    return [
      Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), e) * (ILHA.a - folga),
      Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e) * (ILHA.b - folga),
    ];
  };
  const livreNaBorda = (x: number, z: number) =>
    !naAgua(x, z, 1) &&
    !noMorro(x + 0.6, z - 0.6) &&
    piso(Math.round(x), Math.round(z)) === "grama";
  for (let g = 0; g < 360; g += 3.2) {
    const [x, z] = naBorda(g + r() * 2, 0.55 + r() * 0.35);
    if (!livreNaBorda(x, z)) continue;
    const sorte = r();
    if (sorte < 0.2)
      arbusto(folhas, x, z, 0.6 + r() * 0.35, r() < 0.4 ? { flor: escolhe(FLORES) } : {});
    else if (sorte < 0.32) pedregulho(pedra, x, z, 0.55 + r() * 0.35);
    else if (sorte < 0.6) tufo(x, z);
    else if (sorte < 0.75) flor(x, z);
  }

  // ---------------- cercas baixas de madeira acompanhando a beirada ----------------
  for (const [g0, g1] of [
    [97, 172],
    [188, 252],
    [10, 46],
  ] as const) {
    let antes: [number, number] | null = null;
    for (let g = g0; g <= g1; g += 3.4) {
      const p = naBorda(g, 0.5);
      if (!livreNaBorda(p[0], p[1])) {
        antes = null;
        continue;
      }
      madeira.base(p[0], 0, p[1], 0.16, 0.78, 0.16, MADEIRA_ESCURA, 0.05);
      madeira.base(p[0], 0.78, p[1], 0.22, 0.06, 0.22, MADEIRA[0], 0.05);
      if (antes) {
        const dx = p[0] - antes[0];
        const dz = p[1] - antes[1];
        for (const y of [0.3, 0.58])
          madeira.add(
            (p[0] + antes[0]) / 2,
            y,
            (p[1] + antes[1]) / 2,
            Math.hypot(dx, dz),
            0.09,
            0.07,
            escolhe(MADEIRA),
            0.05,
            -Math.atan2(dz, dx),
          );
      }
      antes = p;
    }
  }

  // ---------------- beira do rio: juncos, pedras na água e vitórias-régias ----------------
  const brilhos: [number, number, number][] = [];
  for (let i = 0; i < molhados.length; i += 2) {
    const x = molhados[i]!;
    const z = molhados[i + 1]!;
    if (Math.abs(z - PONTE.z) <= 2) continue;
    const beira = VIZINHOS.find(
      ([dx, dz]) => dentroDaIlha(x + dx, z + dz) && !naAgua(x + dx, z + dz),
    );
    if (beira && r() < 0.3)
      for (let n = 0; n < 3; n++)
        folhas.base(
          x + beira[0] * 0.36 + (r() - 0.5) * 0.3,
          -0.5,
          z + beira[1] * 0.36 + (r() - 0.5) * 0.3,
          0.07,
          0.75 + r() * 0.5,
          0.07,
          GRAMA_ESCURA[n % 2]!,
          0.05,
          r(),
        );
    else if (beira && r() < 0.22)
      pedra.base(
        x + beira[0] * 0.3,
        -0.62,
        z + beira[1] * 0.3,
        0.5,
        0.42 + r() * 0.2,
        0.45,
        escolhe(ROCHA),
        0.06,
        r() * 3,
      );
    else if (!beira && r() < 0.16) {
      const px = x + (r() - 0.5) * 0.4;
      const pz = z + (r() - 0.5) * 0.4;
      folhas.base(px, NIVEL, pz, 0.5, 0.035, 0.5, 0x4fa63a, 0.05, Math.PI / 4 + r());
      if (r() < 0.5)
        folhas.base(
          px + 0.08,
          NIVEL + 0.035,
          pz,
          0.14,
          0.1,
          0.14,
          r() < 0.5 ? 0xff9fd0 : 0xffffff,
          0,
        );
    }
    if (r() < 0.42) brilhos.push([x + (r() - 0.5) * 0.8, NIVEL + 0.04, z + (r() - 0.5) * 0.8]);
  }
  for (let n = 0; n < 12; n++) {
    const a = r() * Math.PI * 2;
    brilhos.push([
      FX + Math.cos(a) * (0.9 + r() * 1.5),
      0.54,
      FZ + Math.sin(a) * (0.9 + r() * 1.5),
    ]);
  }
  for (let n = 0; n < 5; n++)
    brilhos.push([POCA.x + (r() - 0.5) * 2, 0.1, POCA.z + (r() - 0.3) * 1.2]);

  // ---------------- gotas da fonte ----------------
  const GOTAS = 48;
  const gGota = new THREE.SphereGeometry(0.06, 6, 5);
  const mGota = new THREE.MeshBasicMaterial({ color: 0xe6f6ff });
  const gotas = new THREE.InstancedMesh(gGota, mGota, GOTAS);
  gotas.frustumCulled = false;
  grupo.add(gotas);
  lixo.push(gGota, mGota);
  const aux = new THREE.Object3D();

  // ---------------- berçário: ilhota flutuante com o berço e o escorregador até o gramado ----------------
  {
    const { x: bx, y: by, z: bz } = BERCO;
    const { meiaX, meiaZ } = DECK_DO_BERCO;
    const BRANCO = 0xf4efe6;
    const VERMELHO = 0xd8281f;
    // ilhota: tampa de grama logo abaixo do deck e camadas de terra e rocha afinando para baixo
    for (let k = 0; k <= 5; k++) {
      const rx = meiaX + 0.9 - k * 0.75;
      const rz = meiaZ + 0.9 - k * 0.6;
      if (rx < 0.6 || rz < 0.6) break;
      const topo = k === 0 ? by - 0.3 : by - 0.7 - (k - 1);
      const alt = k === 0 ? 0.4 : 1;
      for (let i = Math.floor(-rx); i <= Math.ceil(rx); i++)
        for (let j = Math.floor(-rz); j <= Math.ceil(rz); j++) {
          if (Math.pow(Math.abs(i) / rx, 2.6) + Math.pow(Math.abs(j) / rz, 2.6) > 1) continue;
          encosta.base(
            bx + i,
            topo - alt,
            bz + j,
            1,
            alt,
            1,
            escolhe(k === 0 ? GRAMA : k < 3 ? TERRA : ROCHA),
            0.06,
          );
        }
    }
    // deck de tábuas
    for (let i = 0; i < Math.round(meiaX * 4); i++)
      madeira.base(
        bx - meiaX + 0.25 + i * 0.5,
        by - 0.22,
        bz,
        0.5,
        0.22,
        meiaZ * 2,
        MADEIRA[i % 3] ?? MADEIRA[0],
        0.05,
      );

    // berço: estrado branco, colchão azul-claro e um travesseiro em cada vaga
    const cz = bz + 0.05;
    const mx = 2.75;
    const mz = 2.05;
    pedra.base(bx, by, cz, mx * 2, 0.14, mz * 2, BRANCO, 0.02);
    pedra.base(bx, by + 0.14, cz, mx * 2 - 0.3, 0.22, mz * 2 - 0.3, 0xcfe1f5, 0.02);
    for (const v of VAGAS) pedra.base(v.x, v.y, v.z - 0.3, 0.62, 0.1, 0.3, 0xffffff, 0.015);
    // grades: ripas brancas com um corrimão em cima (mais baixas na frente, para ver quem dorme; abertas no fundo, para o escorregador)
    const ripa = (x: number, z: number, h: number) =>
      pedra.base(x, by + 0.14, z, 0.08, h, 0.08, BRANCO, 0.02);
    for (let x = -mx; x <= mx + 0.01; x += 0.5) {
      ripa(bx + x, cz + mz, 0.42);
      if (Math.abs(x) > 0.8) ripa(bx + x, cz - mz, 0.72);
    }
    for (let z = -mz + 0.5; z <= mz - 0.49; z += 0.5)
      for (const l of [-1, 1]) ripa(bx + l * mx, cz + z, 0.72);
    pedra.base(bx, by + 0.56, cz + mz, mx * 2 + 0.1, 0.08, 0.12, BRANCO, 0.02);
    for (const l of [-1, 1]) {
      pedra.base(bx + l * mx, by + 0.86, cz, 0.12, 0.08, mz * 2 + 0.1, BRANCO, 0.02);
      pedra.base(
        bx + l * (mx + 0.8) * 0.5 + l * 0.48,
        by + 0.86,
        cz - mz,
        mx - 0.85,
        0.08,
        0.12,
        BRANCO,
        0.02,
      );
      // pés dos cantos, com um pomo vermelho
      for (const f of [-1, 1]) {
        pedra.base(bx + l * mx, by, cz + f * mz, 0.2, f > 0 ? 0.78 : 1.1, 0.2, BRANCO, 0.02);
        pedra.base(
          bx + l * mx,
          by + (f > 0 ? 0.78 : 1.1),
          cz + f * mz,
          0.28,
          0.24,
          0.28,
          VERMELHO,
          0.02,
        );
      }
      // arco do móbile: um poste de cada lado
      madeira.base(bx + l * (mx + 0.22), by, cz - 0.4, 0.14, 2.5, 0.14, MADEIRA_ESCURA, 0.03);
    }
    // móbile: a travessa e as estrelas penduradas
    madeira.base(bx, by + 2.5, cz - 0.4, mx * 2 + 0.6, 0.14, 0.14, MADEIRA_ESCURA, 0.03);
    [-2, -1, 0, 1, 2].forEach((c, n) => {
      const fio = 0.45 + (n % 2) * 0.3;
      madeira.base(bx + c * 1.0, by + 2.5 - fio, cz - 0.4, 0.03, fio, 0.03, 0x3a3a3a, 0);
      aceso.add(
        bx + c * 1.0,
        by + 2.5 - fio - 0.12,
        cz - 0.4,
        0.24,
        0.24,
        0.24,
        n % 2 ? 0xffd84a : 0xfff1a8,
        0,
        Math.PI / 4,
      );
    });
    // lanterna de cabeceira num canto do deck
    madeira.base(bx - meiaX + 0.3, by, bz + meiaZ - 0.3, 0.14, 1.3, 0.14, FERRO, 0);
    aceso.base(bx - meiaX + 0.3, by + 1.3, bz + meiaZ - 0.3, 0.3, 0.3, 0.3, 0xffe2a8, 0);

    // escorregador: calha vermelha de bordas brancas, em degraus curtos, com dois pares de pés
    const { topo: t0, pe: t1 } = ESCORREGADOR;
    const N = 24;
    const comp = Math.abs(t1.z - t0.z) / N + 0.03;
    for (let k = 0; k < N; k++) {
      const f = (k + 0.5) / N;
      const y = t0.y + (t1.y - t0.y) * f - 0.16;
      const z = t0.z + (t1.z - t0.z) * f;
      pedra.base(t0.x, y, z, 1.0, 0.14, comp, VERMELHO, 0.03);
      for (const l of [-1, 1]) pedra.base(t0.x + l * 0.56, y, z, 0.12, 0.42, comp, BRANCO, 0.02);
    }
    pedra.base(t1.x, t1.y - 0.2, t1.z - 0.35, 1.0, 0.14, 0.7, VERMELHO, 0.03);
    for (const z of [12.4, 14]) {
      const f = (t0.z - z) / (t0.z - t1.z);
      const h = t0.y + (t1.y - t0.y) * f - 0.16;
      for (const l of [-1, 1]) madeira.base(t0.x + l * 0.5, 0, z, 0.16, h, 0.16, FERRO, 0);
      madeira.base(t0.x, h * 0.55, z, 1.0, 0.1, 0.1, FERRO, 0);
    }
  }

  // ---------------- parkour: portal na beirada da frente e blocos flutuando para fora da ilha ----------------
  {
    const { x: px, z: pz } = PARKOUR;
    for (const l of [-1, 1]) {
      pedra.base(px + l * 0.95, 0, pz, 0.34, 2.6, 0.34, 0x1b1b1f, 0.03);
      pedra.base(px + l * 0.95, 2.6, pz, 0.44, 0.2, 0.44, 0xd8281f, 0.02);
    }
    pedra.base(px, 2.2, pz, 2.3, 0.34, 0.3, 0xd8281f, 0.03);
    // faixa quadriculada de largada e os blocos do percurso, subindo para fora da ilha
    for (let i = 0; i < 6; i++)
      piso3d.base(px - 0.75 + i * 0.3, 0, pz - 0.5, 0.3, 0.03, 0.3, i % 2 ? 0xf4f1ea : 0x18181b, 0);
    const blocos: [number, number, number, number][] = [
      [0, 0.25, 1.7, 0xd8281f],
      [0.9, 0.8, 3.1, 0xf4f1ea],
      [-0.6, 1.4, 4.5, 0xd8281f],
      [0.5, 2.0, 5.9, 0xf4f1ea],
      [-0.2, 2.7, 7.3, 0xd8281f],
    ];
    for (const [dx, y, dz, cor] of blocos)
      pedra.base(px + dx, y, pz + dz, 1.1, 0.4, 1.1, cor, 0.03);
    // bandeira de chegada no último bloco
    madeira.base(px - 0.2, 3.1, pz + 7.3, 0.08, 1.3, 0.08, FERRO, 0);
    aceso.base(px + 0.12, 3.9, pz + 7.3, 0.6, 0.4, 0.04, 0xffd84a, 0);
  }

  // ---------------- correio: caixa vermelha num poste, com a abertura das cartas e a bandeirinha ----------------
  {
    const { x, z } = CORREIO;
    madeira.base(x, 0, z, 0.14, 0.95, 0.14, FERRO, 0);
    pedra.base(x, 0.95, z, 0.62, 0.5, 0.46, 0xd8281f, 0.02);
    pedra.base(x, 1.45, z, 0.62, 0.1, 0.46, 0xb8221a, 0.02);
    pedra.base(x, 1.2, z + 0.235, 0.36, 0.05, 0.02, 0x2b2d32, 0);
    madeira.base(x + 0.34, 1.05, z, 0.04, 0.42, 0.04, FERRO, 0);
    pedra.base(x + 0.42, 1.36, z, 0.16, 0.11, 0.03, 0xffd84a, 0);
  }

  // ---------------- chuveirão: deque de madeira, poste com a ducha, balde e toalha ----------------
  {
    const { x, z } = CHUVEIRO;
    for (let i = 0; i < 4; i++)
      madeira.base(x - 0.6 + i * 0.4, 0, z, 0.38, 0.08, 1.6, MADEIRA[i % 3] ?? MADEIRA[0], 0.04);
    madeira.base(x - 0.62, 0, z - 0.62, 0.12, 2.5, 0.12, FERRO, 0);
    madeira.base(x - 0.31, 2.44, z - 0.31, 0.7, 0.07, 0.07, FERRO, 0, Math.PI / 4);
    pedra.base(x, 2.26, z, 0.34, 0.12, 0.34, 0xc9ced6, 0.02);
    // registro vermelho no poste, balde e a toalha pendurada
    pedra.base(x - 0.55, 1.1, z - 0.62, 0.1, 0.1, 0.1, 0xd8281f, 0);
    madeira.base(x + 0.75, 0, z + 0.55, 0.3, 0.3, 0.3, 0x5aa8d8, 0.03);
    madeira.base(x - 0.62, 1.55, z - 0.5, 0.06, 0.5, 0.26, 0xfbfbf6, 0.02);
  }

  // ---------------- termômetro (queridômetro): totem com o tubo, o bulbo e um coração em cima ----------------
  {
    const { x: tx, z: tz } = TERMOMETRO;
    const BRANCO = 0xf6f3ee;
    const VERMELHO = 0xd8281f;
    pedra.base(tx, 0, tz, 1.0, 0.22, 1.0, PEDRA_CLARA[0], 0.04);
    pedra.base(tx, 0.22, tz, 0.72, 0.14, 0.72, PEDRA_CLARA[1], 0.04);
    pedra.base(tx, 0.36, tz, 0.62, 0.62, 0.62, VERMELHO, 0.02);
    pedra.base(tx, 0.98, tz, 0.4, 2.0, 0.4, BRANCO, 0.02);
    pedra.base(tx, 0.98, tz + 0.04, 0.2, 1.15, 0.36, VERMELHO, 0);
    for (let m = 0; m < 5; m++)
      pedra.base(tx + 0.14, 1.3 + m * 0.34, tz + 0.21, 0.1, 0.04, 0.03, FERRO, 0);
    pedra.base(tx, 2.98, tz, 0.46, 0.16, 0.46, BRANCO, 0.02);
    // coração de bloquinhos, aceso
    const CORACAO = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
    CORACAO.forEach((linha, j) =>
      [...linha].forEach((c, i) => {
        if (c === "X")
          aceso.add(tx + (i - 3) * 0.13, 4.15 - j * 0.13, tz, 0.13, 0.13, 0.16, 0xff3b30, 0);
      }),
    );
  }

  // ---------------- ilha da pista de corrida: ao norte, ligada pela ponte que sai ao lado do morro ----------------
  {
    const A = PISTA;
    const P = PONTE_DA_PISTA;
    const cx = (A.x0 + A.x1) / 2;
    const cz = (A.z0 + A.z1) / 2;
    const largura = A.x1 - A.x0;
    const fundura = A.z1 - A.z0;
    for (let k = 1; k <= 4; k++) {
      const f = 1 - k * 0.19;
      encosta.base(
        cx,
        -0.4 - k,
        cz,
        largura * f,
        1,
        fundura * f,
        escolhe(k < 3 ? TERRA : ROCHA),
        0.05,
      );
    }
    // piso: grama, com um circuito oval de asfalto, zebras vermelhas e brancas e a faixa xadrez da largada
    const RA = 7.4;
    const RB = 4.4;
    for (let x = A.x0 + 0.5; x < A.x1; x += 1)
      for (let z = A.z0 + 0.5; z < A.z1; z += 1) {
        const d = Math.hypot((x - cx) / RA, (z - cz) / RB);
        const naPista = d > 0.72 && d < 1.28;
        const zebra = (d > 0.6 && d <= 0.72) || (d >= 1.28 && d < 1.4);
        const largada = naPista && Math.abs(x - cx) < 0.6 && z > cz;
        const cor = largada
          ? Math.round(z * 2) % 2
            ? 0xf2f2f2
            : 0x1b1b1e
          : naPista
            ? 0x3b3e45
            : zebra
              ? Math.round(x + z) % 2
                ? 0xd8281f
                : 0xf2f2f2
              : escolhe([0x63b34c, 0x5aa845, 0x6bbd52]);
        piso3d.base(x, -0.4, z, 1, 0.4, 1, cor, naPista ? 0.02 : 0.04);
      }
    // ponte de pedra (vai no sentido norte-sul), com muretas e lanternas
    const lajes = Math.round(P.z1 - P.z0);
    const passo = (P.z1 - P.z0) / lajes;
    for (let i = 0; i < lajes; i++) {
      const z = P.z0 + (i + 0.5) * passo;
      piso3d.base(P.x, -0.4, z, P.meia * 2, 0.4, passo, escolhe(PAVE), 0.04);
      for (const l of [-1, 1])
        pedra.base(P.x + l * P.meia, 0, z, 0.2, 0.45, passo, escolhe(PEDRA_CLARA), 0.04);
      if (i % 3 === 1)
        for (const l of [-1, 1]) {
          pedra.base(P.x + l * P.meia, 0.45, z, 0.3, 0.5, 0.3, escolhe(PEDRA_CLARA), 0.03);
          aceso.base(P.x + l * P.meia, 0.95, z, 0.22, 0.22, 0.22, 0xffe2a8, 0);
        }
    }
    // arco da largada na chegada da ponte: dois postes e a faixa xadrez em cima
    for (const l of [-1, 1]) pedra.base(P.x + l * 1.9, 0, A.z1 - 0.9, 0.3, 3, 0.3, 0x2b2d32, 0.02);
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 2; j++)
        pedra.base(
          P.x - 1.75 + i * 0.32 + 0.0,
          2.4 + j * 0.32,
          A.z1 - 0.9,
          0.32,
          0.32,
          0.14,
          (i + j) % 2 ? 0xf2f2f2 : 0x1b1b1e,
          0,
        );
    // pilhas de pneus nos cantos, arquibancada no fundo e bandeirinhas
    for (const [px, pz] of [
      [A.x0 + 1.2, A.z0 + 1.2],
      [A.x1 - 1.2, A.z0 + 1.2],
      [A.x0 + 1.2, A.z1 - 1.2],
      [A.x1 - 1.2, A.z1 - 1.2],
    ] as const)
      for (let k = 0; k < 3; k++)
        pedra.base(px, k * 0.3, pz, 0.7 - k * 0.08, 0.28, 0.7 - k * 0.08, 0x202024, 0.02);
    for (let degrau = 0; degrau < 3; degrau++)
      madeira.base(
        cx,
        degrau * 0.4,
        A.z0 + 0.6 + degrau * 0.5 - 0.5,
        8,
        0.4,
        0.5,
        degrau % 2 ? 0xd8281f : 0xf2f2f2,
        0.03,
      );
    for (let i = 0; i < 6; i++) {
      const fx = cx - 5 + i * 2;
      madeira.base(fx, 1.2, A.z0 + 0.2, 0.08, 1.6, 0.08, 0x2b2d32, 0);
      aceso.base(
        fx + 0.28,
        2.5,
        A.z0 + 0.2,
        0.5,
        0.3,
        0.04,
        [0xd8281f, 0xffd84a, 0x4fd1ff][i % 3]!,
        0,
      );
    }
  }

  // ---------------- Escritório HOST: anexo vermelho a leste, ligado à ilha pela ponte no fim do caminho ----------------
  {
    const E = ESCRITORIO;
    const P = PONTE_DO_ESCRITORIO;
    const VERMELHO = 0xc8281f;
    const BRANCO = 0xf4f1ea;
    const cx = (E.x0 + E.x1) / 2;
    const largura = E.x1 - E.x0;
    const fundura = E.z1 - E.z0;
    // base flutuante (terra e rocha, afinando para baixo) e o piso xadrez escuro
    for (let k = 1; k <= 4; k++) {
      const f = 1 - k * 0.19;
      encosta.base(
        cx,
        -0.4 - k,
        0,
        largura * f,
        1,
        fundura * f,
        escolhe(k < 3 ? TERRA : ROCHA),
        0.05,
      );
    }
    for (let x = E.x0 + 0.5; x < E.x1; x += 1)
      for (let z = E.z0 + 0.5; z < E.z1; z += 1)
        piso3d.base(x, -0.4, z, 1, 0.4, 1, Math.round(x + z) % 2 ? 0x2a2a2e : 0x35353a, 0.03);
    // ponte: tabuleiro de pedra com muretas dos dois lados
    // (as lajes dividem o vão em partes iguais, do fim do caminho até a porta, sem sobra nem falha)
    const lajes = Math.round(P.x1 - P.x0);
    const passo = (P.x1 - P.x0) / lajes;
    for (let i = 0; i < lajes; i++) {
      const x = P.x0 + (i + 0.5) * passo;
      piso3d.base(x, -0.4, 0, passo, 0.4, P.meia * 2, escolhe(PAVE), 0.04);
      for (const l of [-1, 1])
        pedra.base(x, 0, l * P.meia, passo, 0.45, 0.2, escolhe(PEDRA_CLARA), 0.04);
      // um pilar com lanterna a cada três lajes
      if (i % 3 === 1)
        for (const l of [-1, 1]) {
          pedra.base(x, 0.45, l * P.meia, 0.3, 0.5, 0.3, escolhe(PEDRA_CLARA), 0.03);
          aceso.base(x, 0.95, l * P.meia, 0.22, 0.22, 0.22, 0xffe2a8, 0);
        }
    }
    // parede do fundo: alta, vermelha, com janelas acesas
    for (let i = 0; i < largura; i++) {
      const x = E.x0 + 0.5 + i;
      const z = E.z0 + 0.15;
      if (i % 3 === 1) {
        pedra.base(x, 0, z, 1, 1.1, 0.3, VERMELHO, 0.03);
        aceso.base(x, 1.1, z, 0.9, 1.3, 0.12, 0xa8dcff, 0);
        pedra.base(x, 2.4, z, 1, 0.8, 0.3, VERMELHO, 0.03);
      } else pedra.base(x, 0, z, 1, 3.2, 0.3, VERMELHO, 0.03);
    }
    pedra.base(cx, 3.2, E.z0 + 0.15, largura + 0.4, 0.2, 0.5, BRANCO, 0.02);
    // laterais descendo do fundo para a frente (a de oeste tem a porta, na chegada da ponte)
    for (let j = 0; j < fundura; j++) {
      const z = E.z0 + 0.5 + j;
      const h = Math.max(0.9, 3.2 - (j / (fundura - 1)) * 2.3);
      pedra.base(E.x1 - 0.15, 0, z, 0.3, h, 1, VERMELHO, 0.03);
      if (Math.abs(z) > P.meia + 0.2) pedra.base(E.x0 + 0.15, 0, z, 0.3, h, 1, VERMELHO, 0.03);
    }
    // frente baixa, para dar para ver quem está trabalhando lá dentro
    pedra.base(cx, 0, E.z1 - 0.15, largura, 0.8, 0.3, VERMELHO, 0.03);
    pedra.base(cx, 0.8, E.z1 - 0.15, largura + 0.2, 0.1, 0.4, BRANCO, 0.02);
    // mesas com monitor, teclado e caneca; a cadeira vermelha fica atrás (de costas para a câmera)
    for (const m of MESAS) {
      madeira.base(m.x, 0.58, m.z, 1.5, 0.08, 0.72, 0xe9e2d0, 0.03);
      for (const [dx, dz] of [
        [-0.65, -0.28],
        [0.65, -0.28],
        [-0.65, 0.28],
        [0.65, 0.28],
      ] as const)
        madeira.base(m.x + dx, 0, m.z + dz, 0.07, 0.58, 0.07, FERRO, 0);
      madeira.base(m.x, 0.66, m.z - 0.16, 0.1, 0.14, 0.1, FERRO, 0);
      madeira.base(m.x, 0.78, m.z - 0.16, 0.76, 0.48, 0.06, 0x18181b, 0);
      aceso.base(m.x, 0.82, m.z - 0.12, 0.66, 0.4, 0.02, 0x7fd0ff, 0);
      madeira.base(m.x - 0.05, 0.66, m.z + 0.14, 0.5, 0.03, 0.16, 0x232326, 0);
      madeira.base(m.x + 0.55, 0.66, m.z + 0.1, 0.1, 0.12, 0.1, VERMELHO, 0);
      const cz = m.z + 1.0;
      madeira.base(m.x, 0, cz, 0.1, 0.36, 0.1, FERRO, 0);
      madeira.base(m.x, 0.36, cz, 0.52, 0.08, 0.52, VERMELHO, 0.03);
      madeira.base(m.x, 0.44, cz + 0.25, 0.52, 0.5, 0.08, VERMELHO, 0.03);
    }
    // vasos nos cantos e o tapete da entrada
    for (const z of [E.z0 + 0.9, E.z1 - 0.9]) {
      pedra.base(E.x1 - 0.9, 0, z, 0.5, 0.4, 0.5, BRANCO, 0.03);
      folhas.base(E.x1 - 0.9, 0.4, z, 0.6, 0.7, 0.6, GRAMA_ESCURA[0], 0.08);
    }
    piso3d.base(E.x0 + 1.3, 0, 0, 1.6, 0.03, 1.8, VERMELHO, 0.03);
  }
  // ---------------- fazenda: anexo grande a oeste, no fim de uma ponte comprida com anéis dourados ----------------
  {
    const F = FAZENDA;
    const P = PONTE_DA_FAZENDA;
    const cx = (F.x0 + F.x1) / 2;
    const larg = F.x1 - F.x0;
    const fund = F.z1 - F.z0;
    for (let k = 1; k <= 4; k++) {
      const f = 1 - k * 0.19;
      encosta.base(cx, -0.4 - k, 0, larg * f, 1, fund * f, escolhe(k < 3 ? TERRA : ROCHA), 0.05);
    }
    for (let x = F.x0 + 0.5; x < F.x1; x += 1)
      for (let z = F.z0 + 0.5; z < F.z1; z += 1)
        chao.base(x, -0.4, z, 1, 0.4, 1, escolhe(GRAMA), 0.05);
    // ponte: lajes compridas, muretas baixas e um anel dourado a cada três lajes (o HOKI passa por dentro, em disparada)
    const lajes = Math.round((P.x1 - P.x0) / 2);
    const passo = (P.x1 - P.x0) / lajes;
    for (let i = 0; i < lajes; i++) {
      const x = P.x0 + (i + 0.5) * passo;
      piso3d.base(x, -0.4, 0, passo, 0.4, P.meia * 2, escolhe(PAVE), 0.04);
      for (const l of [-1, 1])
        pedra.base(x, 0, l * P.meia, passo, 0.36, 0.2, escolhe(PEDRA_CLARA), 0.04);
      if (i % 3 === 1)
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          aceso.add(
            x,
            1.25 + Math.sin(ang) * 0.95,
            Math.cos(ang) * 0.95,
            0.14,
            0.24,
            0.24,
            0xffd23f,
            0,
          );
        }
    }
    // faixas de arrancada nas duas pontas (vermelho e branco)
    for (const [x, sentido] of [
      [P.x1 - 1.4, -1],
      [P.x0 + 1.4, 1],
    ] as const)
      for (let k = 0; k < 4; k++)
        piso3d.base(
          x + sentido * k * 0.45,
          0,
          0,
          0.28,
          0.03,
          1.7 - k * 0.35,
          k % 2 ? 0xf4f1ea : 0xd8281f,
          0,
        );
    // cerca de madeira em volta, aberta na chegada da ponte
    const mourao = (x: number, z: number) =>
      madeira.base(x, 0, z, 0.14, 0.7, 0.14, MADEIRA_ESCURA, 0.04);
    for (let x = F.x0 + 0.3; x <= F.x1 - 0.2; x += 1.2)
      for (const z of [F.z0 + 0.3, F.z1 - 0.3]) {
        mourao(x, z);
        madeira.base(x + 0.6, 0.42, z, 1.2, 0.1, 0.08, MADEIRA[0], 0.04);
      }
    for (let z = F.z0 + 0.3; z <= F.z1 - 0.2; z += 1.2) {
      mourao(F.x0 + 0.3, z);
      madeira.base(F.x0 + 0.3, 0.42, z + 0.6, 0.08, 0.1, 1.2, MADEIRA[0], 0.04);
      if (Math.abs(z + 0.6) > 2) {
        mourao(F.x1 - 0.3, z);
        madeira.base(F.x1 - 0.3, 0.42, z + 0.6, 0.08, 0.1, 1.2, MADEIRA[0], 0.04);
      }
    }
    for (const c of CANTEIROS) {
      const { x, z } = c;
      if (c.cultura === "maca" || c.cultura === "laranja")
        arvore(folhas, x, z, { tipo: "copinha" }, madeira);
      else if (c.cultura === "banana" || c.cultura === "coco") {
        // palmeira: tronco fino e folhas em cruz
        madeira.base(x, 0, z, 0.24, 2.3, 0.24, MADEIRA[1], 0.05);
        folhas.base(x, 2.3, z, 2, 0.14, 0.44, GRAMA_ESCURA[0], 0.06);
        folhas.base(x, 2.3, z, 0.44, 0.14, 2, GRAMA_ESCURA[1], 0.06);
      } else if (c.cultura === "cafe")
        folhas.base(x, 0, z, 0.74, 0.72, 0.74, GRAMA_ESCURA[1], 0.07);
      else if (c.cultura === "ovo") {
        // galinheiro com telhado vermelho e duas galinhas
        madeira.base(x, 0, z, 1.1, 0.8, 0.9, MADEIRA[1], 0.04);
        pedra.base(x, 0.8, z, 1.3, 0.24, 1.1, TELHA[0], 0.04);
        for (const [dx, dz] of [
          [0.95, 0.35],
          [0.7, 0.85],
        ] as const) {
          pedra.base(x + dx, 0, z + dz, 0.26, 0.26, 0.34, 0xfbfbf6, 0.02);
          pedra.base(x + dx, 0.26, z + dz + 0.12, 0.16, 0.16, 0.16, 0xfbfbf6, 0.02);
          pedra.base(x + dx, 0.38, z + dz + 0.12, 0.06, 0.08, 0.1, 0xd8281f, 0);
        }
      } else if (c.cultura === "leite") {
        // vaca malhada
        for (const [dx, dz] of [
          [-0.4, -0.2],
          [0.4, -0.2],
          [-0.4, 0.2],
          [0.4, 0.2],
        ] as const)
          pedra.base(x + dx, 0, z + dz, 0.16, 0.36, 0.16, 0xfbfbf6, 0.02);
        pedra.base(x, 0.36, z, 1.2, 0.6, 0.62, 0xfbfbf6, 0.02);
        pedra.base(x - 0.25, 0.6, z, 0.4, 0.37, 0.64, 0x1c1c1e, 0);
        pedra.base(x + 0.3, 0.42, z + 0.14, 0.3, 0.3, 0.36, 0x1c1c1e, 0);
        pedra.base(x + 0.78, 0.62, z, 0.42, 0.46, 0.46, 0xfbfbf6, 0.02);
        pedra.base(x + 1.0, 0.62, z, 0.14, 0.2, 0.3, 0xf2b8b0, 0);
      } else if (c.cultura === "agua") {
        // mina de água: pedras em roda, o olho d'água no meio e um balde ao lado
        for (let a = 0; a < 7; a++) {
          const ang = (a / 7) * Math.PI * 2;
          pedra.base(
            x + Math.cos(ang) * 0.62,
            0,
            z + Math.sin(ang) * 0.62,
            0.42,
            0.3 + (a % 3) * 0.14,
            0.42,
            escolhe(ROCHA),
            0.05,
          );
        }
        aceso.base(x, 0, z, 0.82, 0.14, 0.82, 0x5fb8ff, 0);
        madeira.base(x + 0.95, 0, z + 0.5, 0.3, 0.32, 0.3, MADEIRA[0], 0.04);
      } else if (c.cultura === "rosa" || c.cultura === "girassol" || c.cultura === "tulipa") {
        // floricultura: vaso de barro no gramado
        pedra.base(x, 0, z, 0.62, 0.36, 0.62, 0xb5533c, 0.04);
        pedra.base(x, 0.36, z, 0.7, 0.08, 0.7, 0xc46045, 0.03);
        piso3d.base(x, 0.36, z, 0.5, 0.05, 0.5, 0x5a3a22, 0.05);
      } else if (c.cultura === "chocolate" || c.cultura === "bala") {
        // carrinho da doceria: caixa listrada com rodas e um toldo vermelho
        madeira.base(x, 0.18, z, 0.9, 0.62, 0.62, 0xf4f1ea, 0.03);
        for (let k = 0; k < 3; k++)
          madeira.base(x - 0.3 + k * 0.3, 0.2, z + 0.32, 0.12, 0.58, 0.02, 0xd8281f, 0);
        for (const l of [-1, 1]) pedra.base(x + l * 0.35, 0, z + 0.3, 0.2, 0.2, 0.08, 0x2b2d32, 0);
        for (const l of [-1, 1])
          madeira.base(x + l * 0.4, 0.8, z - 0.25, 0.06, 0.7, 0.06, MADEIRA_ESCURA, 0);
        pedra.base(x, 1.5, z, 1.05, 0.1, 0.8, 0xd8281f, 0.03);
      } else if (c.cultura === "ursinho") {
        // prateleira de brindes do escritório
        madeira.base(x, 0, z, 0.9, 0.9, 0.5, 0xe9e2d0, 0.03);
        madeira.base(x, 0.9, z, 0.96, 0.06, 0.56, 0xc8281f, 0.02);
      } else {
        // canteiro da horta: terra revolvida embaixo da planta (a uva tem a estaca)
        piso3d.base(x, 0, z, 1.25, 0.06, 1.1, 0x5a3a22, 0.06);
        if (c.cultura === "uva") madeira.base(x, 0, z, 0.08, 0.95, 0.08, MADEIRA_ESCURA, 0.04);
      }
    }
    // espantalho no meio da horta do norte
    madeira.base(-67.5, 0, -6.4, 0.12, 1.5, 0.12, MADEIRA_ESCURA, 0.04);
    madeira.base(-67.5, 1.0, -6.4, 1.1, 0.1, 0.1, MADEIRA_ESCURA, 0.04);
    pedra.base(-67.5, 1.5, -6.4, 0.36, 0.36, 0.36, 0xf2d9a0, 0.03);
    pedra.base(-67.5, 1.86, -6.4, 0.6, 0.08, 0.6, 0x8e5b35, 0.03);
  }

  // ---------------- monta os conjuntos de blocos ----------------
  const conjuntos = [
    chao.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.035, junta: 0.07, pe: 0, grao: 0.055, nevoa: NEVOA },
    }),
    piso3d.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.035, junta: 0.3, pe: 0.1, grao: 0.06 },
    }),
    encosta.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.07, junta: 0.2, pe: 0.3, grao: 0.075, nevoa: NEVOA },
    }),
    pedra.construir(THREE, { acabamento: { chanfro: 0.05, junta: 0.24, pe: 0.24, grao: 0.06 } }),
    madeira.construir(THREE, { acabamento: { chanfro: 0.03, junta: 0.16, pe: 0.16, grao: 0.07 } }),
    folhas.construir(THREE, { acabamento: { chanfro: 0.075, junta: 0.12, pe: 0.3, grao: 0.07 } }),
    aceso.construir(THREE, {
      sombra: false,
      recebe: false,
      material: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
  ];
  for (const c of conjuntos) {
    grupo.add(c.malha);
    lixo.push({ dispose: c.descartar });
  }

  // ---------------- sombras de contato, luz das luminárias no piso e brilhos ----------------
  const tMancha = texturaMancha(THREE);
  const tBrilho = texturaMancha(THREE, 0.08);
  const contato = criarManchas(THREE, tMancha, sombras, { cor: 0x1d150c, forca: 0.4 });
  const luzPiso = criarManchas(THREE, tMancha, clarao, { cor: 0xffc77a, forca: 0.13, soma: true });
  grupo.add(contato.malha, luzPiso.malha);
  lixo.push(tMancha, tBrilho, { dispose: contato.descartar }, { dispose: luzPiso.descartar });
  /** Pontos de luz somados à imagem (o "bloom" fica só onde eles estão). */
  const pontos = (lista: [number, number, number][], tamanho: number, cor: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(lista.flat(), 3));
    const cores = new Float32Array(lista.length * 3);
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    const m = new THREE.PointsMaterial({
      map: tBrilho,
      size: tamanho,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    grupo.add(o);
    lixo.push(g, m);
    const base = new THREE.Color(cor);
    return (forca: (i: number) => number) => {
      for (let i = 0; i < lista.length; i++) {
        const f = forca(i);
        cores[i * 3] = base.r * f;
        cores[i * 3 + 1] = base.g * f;
        cores[i * 3 + 2] = base.b * f;
      }
      (g.getAttribute("color") as TH.BufferAttribute).needsUpdate = true;
    };
  };
  const acenderLampadas = pontos(lampadas, 3.4, 0xffc670);
  const acenderBrilhos = pontos(brilhos, 0.55, 0xffffff);

  // letreiro "ESCRITÓRIO HOST" em cima da parede do fundo
  const placaEscritorio = new THREE.Group();
  placaEscritorio.position.set((ESCRITORIO.x0 + ESCRITORIO.x1) / 2, 3.55, ESCRITORIO.z0 + 0.4);
  const letrasEscritorio = new Blocos(r);
  letrasDePedra(letrasEscritorio, "ESCRITÓRIO HOST", 0.085, 0.3, { linhas: 10, relevo: 0.5 });
  const mEscritorio = letrasEscritorio.construir(THREE, {
    recebe: false,
    acabamento: { chanfro: 0.02, junta: 0.2, pe: 0, grao: 0.04 },
  });
  placaEscritorio.add(mEscritorio.malha);
  grupo.add(placaEscritorio);
  lixo.push({ dispose: mEscritorio.descartar });

  // ---------------- letreiro HOST no céu: letras de pedra clara em relevo ----------------
  const placa = new THREE.Group();
  placa.position.set(0, 9.4, -19);
  const letras = new Blocos(r);
  const medidaDasLetras = letrasDePedra(letras, "HOST", 0.42, 1.5, { linhas: 12, relevo: 0.8 });
  const mLetras = letras.construir(THREE, {
    recebe: false,
    acabamento: { chanfro: 0.08, junta: 0.22, pe: 0, grao: 0.04 },
  });
  placa.add(mLetras.malha);
  grupo.add(placa);
  lixo.push({ dispose: mLetras.descartar });

  // ---------------- ao longe: ilhas flutuando; no céu e embaixo da ilha, nuvens ----------------
  const longe = new Blocos(r);
  const ilhota = (cx: number, cy: number, cz: number, raio: number) => {
    for (let k = 0; k <= 5; k++) {
      const rk = raio - k * 0.8 + (k ? r() * 0.4 : 0);
      const alcance = Math.ceil(rk);
      const topo = k === 0 ? cy : cy - 0.4 - (k - 1);
      const alt = k === 0 ? 0.4 : 1;
      for (let i = -alcance; i <= alcance; i++)
        for (let j = -alcance; j <= alcance; j++) {
          if (Math.hypot(i, j) > rk) continue;
          if (k > 0 && Math.hypot(i, j) < rk - 1.5) continue;
          longe.base(
            cx + i,
            topo - alt,
            cz + j,
            1,
            alt,
            1,
            escolhe(k === 0 ? GRAMA : k < 3 ? TERRA : ROCHA),
            0.06,
          );
        }
    }
    arvore(longe, cx - 1, cz, {
      tipo: "copinha",
      u: 0.68,
      y: cy,
      cor: r() < 0.5 ? "verde" : "amarelo",
    });
    arvore(longe, cx + 1.7, cz - 1, { tipo: "pinheiro", u: 0.62, y: cy });
  };
  ilhota(-37, 3, -31, 4.5);
  ilhota(39, 6, -37, 5);
  ilhota(-31, -4, 7, 3.2);
  ilhota(34, -2, 12, 2.6);
  const mLonge = longe.construir(THREE, {
    sombra: false,
    recebe: false,
    acabamento: { nevoa: NEVOA },
  });
  grupo.add(mLonge.malha);
  lixo.push({ dispose: mLonge.descartar });

  const ceu = criarNuvens(
    THREE,
    [
      [-30, 15, -40, 2.4],
      [16, 22, -50, 3],
      [44, 12, -34, 2.1],
      [-52, 9, -30, 2.3],
      [0, 27, -62, 3.6],
      [30, 24, -44, 1.9],
      [-14, 30, -56, 2.6],
    ],
    11,
  );
  const mar = criarNuvens(
    THREE,
    [
      [-22, -15, 14, 5],
      [4, -16.5, 18, 6],
      [27, -15, 12, 5],
      [-34, -14, -6, 5],
      [38, -15, -10, 5.5],
      [0, -17, -4, 7],
      [-12, -15.5, -22, 5.5],
      [18, -16, -24, 6],
      [-44, -16, 16, 6],
      [48, -16, 22, 6],
    ],
    23,
  );
  for (const n of [...ceu.nuvens, ...mar.nuvens]) grupo.add(n.malha);
  lixo.push({ dispose: ceu.descartar }, { dispose: mar.descartar });

  // ---------------- balanço do letreiro: um banco comprido, para 10, pendurado por cordas ----------------
  // fica num grupo que gira no eixo (embaixo do letreiro); os "lugares" são pontos do banco que o
  // mundo consulta a cada quadro para sentar os HOKIs no lugar certo enquanto ele balança
  const eixoDoBalanco = new THREE.Group();
  eixoDoBalanco.position.set(BALANCO.eixo.x, BALANCO.eixo.y, BALANCO.eixo.z);
  grupo.add(eixoDoBalanco);
  const larguraDoBalanco = BALANCO.lugares * BALANCO.passo + 0.5;
  const pecaDoBalanco = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    cor: number,
    pai: TH.Object3D = eixoDoBalanco,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.8 });
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    pai.add(o);
    lixo.push(g, m);
    return o;
  };
  const MADEIRA_DO_BALANCO = 0x9a6a3c;
  const CORDA_DO_BALANCO = 0xd9c9a3;
  const L = BALANCO.corda;
  // só as cordas das pontas, presas direto nas letras: a da esquerda no pé do H e a da direita no pé do T
  const meiaLetra = medidaDasLetras.largura / 2;
  const presas = [
    { lado: -1, topo: -meiaLetra + 0.42 },
    { lado: 1, topo: meiaLetra - 0.42 * 2.5 },
  ];
  for (const { lado, topo } of presas)
    for (const dz of [-0.24, 0.24]) {
      const base = lado * (larguraDoBalanco / 2);
      // a corda vai do pé da letra até a ponta do banco (um pouco inclinada)
      const comprimento = Math.hypot(base - topo, L, dz);
      const corda = pecaDoBalanco(
        0.09,
        comprimento,
        0.09,
        (base + topo) / 2,
        -L / 2,
        dz / 2,
        CORDA_DO_BALANCO,
      );
      corda.rotation.z = Math.atan2(base - topo, L);
      corda.rotation.x = -Math.atan2(dz, L);
      corda.castShadow = false;
    }
  // assento (três tábuas), encosto e os braços nas pontas
  for (const dz of [-0.2, 0, 0.2])
    pecaDoBalanco(larguraDoBalanco, 0.08, 0.17, 0, -L, dz, MADEIRA_DO_BALANCO);
  for (const dy of [0.3, 0.52])
    pecaDoBalanco(larguraDoBalanco, 0.14, 0.07, 0, -L + dy, -0.3, MADEIRA_DO_BALANCO);
  for (const lado of [-1, 1]) {
    pecaDoBalanco(0.1, 0.62, 0.1, lado * (larguraDoBalanco / 2), -L + 0.3, -0.3, 0x6f4a28);
    pecaDoBalanco(0.1, 0.1, 0.62, lado * (larguraDoBalanco / 2), -L + 0.34, 0, 0x6f4a28);
  }
  const lugaresDoBalanco = Array.from({ length: BALANCO.lugares }, (_, i) => {
    const o = new THREE.Object3D();
    // o HOKI senta com a base um pouco abaixo do tampo, como nos bancos da praça
    o.position.set((i - (BALANCO.lugares - 1) / 2) * BALANCO.passo, -L + 0.01, 0.02);
    eixoDoBalanco.add(o);
    return o;
  });
  const pontoDoBalanco = new THREE.Vector3();
  let anguloAtual = 0;

  let nivelNoite = 0;
  return {
    grupo,
    /** Onde está agora o lugar `i` do balanço (0 a 9) e o quanto o banco está inclinado. */
    lugarDoBalanco(i: number) {
      const o = lugaresDoBalanco[i];
      if (!o) return null;
      o.getWorldPosition(pontoDoBalanco);
      return {
        x: pontoDoBalanco.x,
        y: pontoDoBalanco.y,
        z: pontoDoBalanco.z,
        inclina: -anguloAtual,
      };
    },
    atualizar(t: number) {
      // o balanço segue o relógio do mundo real (igual para todos) e sobe e desce junto com o letreiro
      anguloAtual = anguloDoBalanco();
      eixoDoBalanco.rotation.x = -anguloAtual;
      eixoDoBalanco.position.y = BALANCO.eixo.y + Math.sin(t * 0.6) * 0.25;
      eixoDoBalanco.updateMatrixWorld(true);
      tAgua.offset.y = t * 0.42;
      tQueda.offset.y = t * 0.9;
      tParada.offset.set(Math.sin(t * 0.25) * 0.06, Math.cos(t * 0.2) * 0.06);
      placa.position.y = 9.4 + Math.sin(t * 0.6) * 0.25;
      ceu.nuvens.forEach(
        (n, i) => (n.malha.position.x = ((n.x0 + 70 + t * (0.22 + i * 0.04)) % 140) - 70),
      );
      mar.nuvens.forEach((n, i) => (n.malha.position.x = n.x0 + Math.sin(t * 0.05 + i) * 2.5));
      acenderLampadas(() => 0.5 + nivelNoite * 1.2 + Math.sin(t * 2.1) * 0.03);
      acenderBrilhos(
        (i) => Math.pow(Math.max(0, Math.sin(t * (1.1 + (i % 5) * 0.23) + i * 1.7)), 10) * 1.4,
      );
      for (let i = 0; i < GOTAS; i++) {
        const p = (t * 0.7 + i / GOTAS) % 1;
        const ang = i * 2.399;
        // um terço sobe do bico e cai na taça de cima; o resto pinga das duas taças
        const tipo = i % 3;
        const dist = tipo === 0 ? p * 0.4 : tipo === 1 ? 0.62 + p * 0.25 : 1.16 + p * 0.3;
        const y =
          tipo === 0
            ? 2.98 + Math.sin(p * Math.PI) * 0.45 - p * 0.36
            : tipo === 1
              ? 2.6 - p * p * 0.8
              : 1.82 - p * p * 1.3;
        aux.position.set(FX + Math.cos(ang) * dist, y, FZ + Math.sin(ang) * dist);
        aux.scale.setScalar(tipo === 0 ? 1 : 0.8);
        aux.updateMatrix();
        gotas.setMatrixAt(i, aux.matrix);
      }
      gotas.instanceMatrix.needsUpdate = true;
    },
    /** Noite (0 = dia, 1 = noite fechada): as nuvens escurecem e as luminárias aparecem mais. */
    noite(v: number) {
      nivelNoite = v;
      for (const n of [ceu.nuvens[0], mar.nuvens[0]])
        if (n) (n.malha.material as TH.MeshLambertMaterial).emissiveIntensity = 0.62 - 0.52 * v;
    },
    descartar: () => lixo.forEach((l) => l.dispose()),
  };
}
