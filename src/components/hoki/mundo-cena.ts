/**
 * Cenário do lobby do HOKI em 3D, refeito do zero a partir da arte do lobby:
 * ilha central simétrica com a praça da fonte, canteiros floridos, bancos e
 * postes; coreto e laguinho com cachoeira à esquerda, rio com cachoeira à
 * direita; Magnata (oeste) e Escritório (leste) em ilhas ligadas por pontes;
 * HOST FAZENDAS (noroeste) e EM BREVE (nordeste) no alto, com escadarias; o
 * terraço do TOP 3 com o letreiro HOST e o anel vermelho; e, ao sul, o
 * escorregador turquesa que desce da nuvem onde os HOKIs dormem.
 * As posições vêm de mundo-mapa.ts.
 */
import type * as TH from "three";
import { acabamento, criarManchas, texturaMancha, type Mancha } from "./luz";
import { COLUNAS_ARCO, criarArcoDoRanking } from "./ranking-arco";
import {
  ANEL,
  ARCO_DE_FLORES,
  ARVORES,
  ARVORES_EM_BREVE,
  ARVORES_FAZENDAS,
  BANCOS,
  BERCO,
  beiradaEmZ,
  CANTEIROS_EM_BREVE,
  CELEIRO,
  CENTRO_DO_COMERCIO,
  CHUVEIRO,
  COMERCIO,
  CORETO,
  CORREIO,
  DADOS_DO_MAGNATA,
  DECK_DO_BERCO,
  dentroDaIlha,
  distLinha,
  EMBARQUE,
  ESCRITORIO,
  FARDOS,
  FONTE,
  GALPAO,
  ILHA,
  ILHA_EM_BREVE,
  ILHA_ESCRITORIO,
  ILHA_FAZENDAS,
  ILHA_MAGNATA,
  LAGO,
  LETREIRO,
  MEIA_RIACHO,
  MEIA_RIO,
  MESAS,
  MOINHO,
  NASCENTE,
  naAgua,
  naEscadaria,
  PEAO_DO_MAGNATA,
  PIER_DO_AVIAO,
  PLACA_EMBARQUE,
  PILARES_DA_ESCADARIA,
  pilaresDaEscadaria,
  piso,
  PLACA_CORREIO,
  PLACA_QUERIDOMETRO,
  PLATAFORMA,
  PONTE,
  PONTE_EM_BREVE,
  PONTE_FAZENDAS,
  PONTE_LESTE,
  PONTE_OESTE,
  PONTOS_DO_ESCORREGADOR,
  PORTAO_EM_BREVE,
  POSTES,
  POSTES_EM_BREVE,
  POSTES_FAZENDAS,
  PREDIO_MAGNATA,
  RAIO_DO_CORETO,
  RIACHO,
  RIO,
  TERMOMETRO,
  TERRACO_TOP3,
  TOP3,
  TRIGAIS,
  VAGAS,
  type Escadaria,
  type Ponto,
} from "./mundo-mapa";
import {
  arbusto,
  arvore,
  Blocos,
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
const NEVOA = { inicio: 3.5, fim: 18, forca: 0.95 };

// paleta viva, como na arte do lobby
const GRAMA = [0x78cd48, 0x6ec342, 0x84d650, 0x72c845] as const;
const GRAMA_ESCURA = [0x4f9c35, 0x58a83b, 0x469030] as const;
const TERRA = [0x9a6235, 0x8c5730, 0xa66d3c] as const;
const ROCHA = [0x8f8a85, 0x7e7974, 0x9b958f, 0x6f6a66] as const;
const PAVE = [0xe6dcc6, 0xdacfb6, 0xefe6d2, 0xd2c6ac] as const;
const PEDRA_CLARA = [0xe2d9c8, 0xd8cebb, 0xece4d5] as const;
const PEDRA = [0x9a9aa2, 0x8a8a93, 0xa7a7ae, 0x7f7f88] as const;
const MADEIRA = [0xa8743c, 0x9c6a36, 0xb47e44] as const;
const FERRO = 0x2b2d32;
const VERMELHO = 0xd8281f;
const BRANCO = 0xf6f1e4;
const TELHA = [0xc4502f, 0xb24529, 0xd45d38] as const;
const FLORES = [0xffffff, 0xff5a5a, 0xffd84a, 0xff8fc8, 0xfff1a8, 0xb98cff] as const;
const FONTE_PLACA = 'Manrope, Inter, "Segoe UI", Arial, sans-serif';

/** Placa arredondada com texto (desenhada num canvas). */
function texturaDePlaca(
  THREE: typeof TH,
  linhas: string[],
  o: { fundo: string; borda: string; cor: string; largura?: number; altura?: number },
) {
  const L = o.largura ?? 512;
  const A = o.altura ?? 128;
  const tela = document.createElement("canvas");
  tela.width = L;
  tela.height = A;
  const c = tela.getContext("2d");
  if (c) {
    c.fillStyle = o.borda;
    c.beginPath();
    c.roundRect(0, 0, L, A, A * 0.3);
    c.fill();
    c.fillStyle = o.fundo;
    c.beginPath();
    c.roundRect(9, 9, L - 18, A - 18, A * 0.24);
    c.fill();
    const g = c.createLinearGradient(0, 0, 0, A);
    g.addColorStop(0, "rgba(255,255,255,0.3)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(9, 9, L - 18, A - 18, A * 0.24);
    c.fill();
    c.textAlign = "center";
    c.textBaseline = "middle";
    let px = (A * 0.6) / linhas.length;
    c.font = `900 ${px}px ${FONTE_PLACA}`;
    while (linhas.some((l) => c.measureText(l).width > L - 56) && px > 10)
      c.font = `900 ${--px}px ${FONTE_PLACA}`;
    linhas.forEach((l, k) => {
      const y = A / 2 + (k - (linhas.length - 1) / 2) * px * 1.06 + 2;
      c.lineWidth = px * 0.18;
      c.strokeStyle = "rgba(0,0,0,0.38)";
      c.strokeText(l, L / 2, y + 3);
      c.fillStyle = o.cor;
      c.fillText(l, L / 2, y);
    });
  }
  const t = new THREE.CanvasTexture(tela);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Faixa de água ao longo de uma linha (o rio e o riacho), com a textura correndo no sentido da linha. */
function faixaDeAgua(THREE: typeof TH, linha: readonly Ponto[], meia: number, y: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let v = 0;
  linha.forEach((p, i) => {
    const a = linha[Math.max(0, i - 1)]!;
    const b = linha[Math.min(linha.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const n = Math.hypot(dx, dz) || 1;
    const nx = -dz / n;
    const nz = dx / n;
    if (i > 0) v += Math.hypot(p.x - linha[i - 1]!.x, p.z - linha[i - 1]!.z) / (meia * 2);
    pos.push(p.x + nx * meia, y, p.z + nz * meia, p.x - nx * meia, y, p.z - nz * meia);
    uv.push(0, v, 1, v);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function criarMundo(THREE: typeof TH) {
  const grupo = new THREE.Group();
  const lixo: { dispose: () => void }[] = [];
  const r = sorteador(2026);
  const escolhe = (l: readonly number[]) => l[Math.floor(r() * l.length)] ?? l[0]!;

  const chao = new Blocos(r); // gramado e base do calçamento (só recebe sombra)
  const piso3d = new Blocos(r); // pedras do calçamento, meios-fios e degraus
  const encosta = new Blocos(r); // lateral das ilhas: terra e rocha
  const pedra = new Blocos(r); // fonte, coreto, pontes, muretas, prédios
  const madeira = new Blocos(r); // bancos, cercas, telhados, ferro dos postes
  const folhas = new Blocos(r); // copas, arbustos, flores e trigo
  const aceso = new Blocos(r); // lâmpadas e luzes (sem sombra, sempre acesas)
  const nuvem = new Blocos(r); // a nuvem do berço
  const sombras: Mancha[] = [];
  const clarao: Mancha[] = [];
  const lampadas: [number, number, number][] = [];
  const brilhos: [number, number, number][] = [];

  /** Lanterna: caixinha acesa com tampa (e o ponto de luz que brilha à noite). */
  const lanterna = (x: number, y: number, z: number, cor = 0xffc670) => {
    aceso.base(x, y, z, 0.32, 0.38, 0.32, cor, 0);
    madeira.base(x, y + 0.38, z, 0.46, 0.1, 0.46, FERRO, 0);
    lampadas.push([x, y + 0.22, z]);
  };
  /** Poste de luz de ferro com a lanterna em cima. */
  const poste = (x: number, z: number, y0 = 0, alt = 2.5) => {
    madeira.base(x, y0, z, 0.36, 0.22, 0.36, FERRO, 0);
    madeira.base(x, y0, z, 0.14, alt, 0.14, FERRO, 0);
    madeira.base(x, y0 + alt - 0.1, z, 0.3, 0.1, 0.3, FERRO, 0);
    lanterna(x, y0 + alt, z);
    sombras.push({ x, z, y: y0 + 0.03, rx: 0.45, rz: 0.45 });
    clarao.push({ x, z, y: y0 + 0.03, rx: 2.8, rz: 2.8 });
  };
  /** Banco de praça: assento de ripas, encosto e pés de ferro, girado para onde quem senta olha. */
  const banco = (x: number, z: number, ang: number) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const p = (lx: number, lz: number) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
    for (const lx of [-0.62, 0.62])
      for (const lz of [-0.14, 0.14]) {
        const q = p(lx, lz);
        madeira.base(q.x, 0, q.z, 0.08, 0.4, 0.08, FERRO, 0, ang);
      }
    for (const lz of [-0.12, 0.04, 0.2]) {
      const q = p(0, lz);
      madeira.base(q.x, 0.4, q.z, 1.5, 0.07, 0.14, escolhe(MADEIRA), 0.03, ang);
    }
    for (const y of [0.62, 0.84]) {
      const q = p(0, -0.24);
      madeira.base(q.x, y, q.z, 1.5, 0.14, 0.06, escolhe(MADEIRA), 0.03, ang);
    }
    for (const lx of [-0.62, 0.62]) {
      const q = p(lx, -0.26);
      madeira.base(q.x, 0.4, q.z, 0.08, 0.58, 0.06, FERRO, 0, ang);
    }
    sombras.push({ x, z, rx: 0.95, rz: 0.45, giro: ang });
  };
  /** Ilha flutuante retangular: gramado em cima, terra e rocha afinando para baixo, com grama pendurada. */
  const ilhaRetangular = (
    I: { x0: number; x1: number; z0: number; z1: number },
    y: number,
    fundo = 6,
  ) => {
    for (let x = I.x0 + 0.5; x < I.x1; x++)
      for (let z = I.z0 + 0.5; z < I.z1; z++) {
        chao.base(x, y - 0.4, z, 1, 0.4, 1, escolhe(GRAMA), 0.05);
        const borda = Math.min(x - I.x0, I.x1 - x, z - I.z0, I.z1 - z);
        const d = Math.min(fundo, 1.4 + borda * 1.1 + r() * 0.9);
        encosta.base(x, y - 0.4 - 1.2, z, 1, 1.2, 1, escolhe(TERRA), 0.06);
        if (d > 1.6) encosta.base(x, y - 0.4 - d, z, 1, d - 1.2, 1, escolhe(ROCHA), 0.06);
        if (borda < 1 && r() < 0.45)
          encosta.base(x, y - 0.75, z, 1.02, 0.4, 1.02, escolhe(GRAMA_ESCURA), 0.06);
      }
  };

  // =====================================================================
  // ILHA CENTRAL: gramado, calçamento, beirada de terra e rocha
  // =====================================================================
  {
    for (let x = -ILHA.a + 0.5; x < ILHA.a; x++)
      for (let z = -ILHA.b + 0.5; z < ILHA.b; z++) {
        if (!dentroDaIlha(x, z, 0.1)) continue;
        // quanto falta para a beirada (0 na beirada, 1 no centro)
        const v = Math.pow(Math.abs(x) / ILHA.a, ILHA.n) + Math.pow(Math.abs(z) / ILHA.b, ILHA.n);
        const dentro = 1 - Math.pow(v, 1 / ILHA.n);
        const agua = naAgua(x, z, 0.2);
        const tipo = piso(x, z);
        if (agua) chao.base(x, -1.0, z, 1, 0.4, 1, 0x3b6e8c, 0.04);
        else if (tipo === "grama") {
          const listra = (Math.floor(x) + Math.floor(z)) % 2 === 0;
          chao.base(
            x,
            -0.4,
            z,
            1,
            0.4,
            1,
            listra ? escolhe(GRAMA) : escolhe([0x80d24e, 0x76ca47]),
            0.04,
          );
        } else chao.base(x, -0.4, z, 1, 0.4, 1, 0xcabd9f, 0.02);
        // terra e rocha embaixo: a ilha afina para baixo, como uma montanha de ponta-cabeça
        const fundo = 1.6 + 12 * Math.pow(dentro, 0.65) + r() * 1.2;
        encosta.base(x, -1.8, z, 1, 1.4, 1, escolhe(TERRA), 0.06);
        encosta.base(x, -1.8 - (fundo - 1.4), z, 1, fundo - 1.4, 1, escolhe(ROCHA), 0.07);
        if (dentro < 0.05 && r() < 0.5)
          encosta.base(x, -0.85, z, 1.04, 0.5, 1.04, escolhe(GRAMA_ESCURA), 0.06);
        // florzinhas e tufos soltos no gramado
        if (tipo === "grama" && !agua && r() < 0.16) {
          const fx = x + (r() - 0.5) * 0.7;
          const fz = z + (r() - 0.5) * 0.7;
          if (r() < 0.55) folhas.base(fx, 0, fz, 0.13, 0.16, 0.13, escolhe(FLORES), 0.02);
          else folhas.base(fx, 0, fz, 0.22, 0.18, 0.22, escolhe(GRAMA_ESCURA), 0.06);
        }
      }
    // calçamento dos caminhos: pedrinhas de meio bloco
    for (let x = -ILHA.a + 0.25; x < ILHA.a; x += 0.5)
      for (let z = -ILHA.b + 0.25; z < ILHA.b; z += 0.5) {
        if (!dentroDaIlha(x, z, 0.4) || piso(x, z) !== "caminho" || naAgua(x, z, 0.1)) continue;
        piso3d.base(x, 0, z, 0.5, 0.06, 0.5, escolhe(PAVE), 0.04);
      }
    // praça: anéis de pedra em volta da fonte, com uma faixa mais escura a cada três anéis e o meio-fio
    for (let raio = ANEL.dentro + 0.45; raio < ANEL.fora; raio += 0.9) {
      const n = Math.round((Math.PI * 2 * raio) / 0.9);
      const anel = Math.round((raio - ANEL.dentro) / 0.9);
      for (let k = 0; k < n; k++) {
        const a = ((k + (anel % 2) * 0.5) / n) * Math.PI * 2;
        const cor = anel % 3 === 1 ? escolhe([0xc9b99a, 0xbfae8f]) : escolhe(PAVE);
        piso3d.base(
          Math.cos(a) * raio,
          0,
          Math.sin(a) * raio,
          0.86,
          0.06,
          (Math.PI * 2 * raio) / n - 0.02,
          cor,
          0.03,
          -a,
        );
      }
    }
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      const x = Math.cos(a) * (ANEL.fora + 0.15);
      const z = Math.sin(a) * (ANEL.fora + 0.15);
      if (piso(x * 1.06, z * 1.06) === "caminho") continue;
      piso3d.base(x, 0, z, 0.3, 0.14, 0.78, 0xb3a791, 0.03, -a);
    }
  }

  // ---------------- cerca de madeira na beirada (aberta nos caminhos, pontes, escadarias e quedas d'água) ----------------
  {
    const A = ILHA.a - 0.75;
    const B = ILHA.b - 0.75;
    const pts: Ponto[] = [];
    for (let i = 0; i < 900; i++) {
      const t = (i / 900) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      pts.push({
        x: A * Math.sign(c) * Math.pow(Math.abs(c), 2 / ILHA.n),
        z: B * Math.sign(s) * Math.pow(Math.abs(s), 2 / ILHA.n),
      });
    }
    const aberto = (p: Ponto) =>
      (Math.abs(p.z) < 2.6 && Math.abs(p.x) > 20) ||
      (Math.abs(p.x) < 3.6 && p.z > 0) ||
      (Math.abs(p.x) < 7 && p.z < 0) ||
      [PONTE_FAZENDAS, PONTE_EM_BREVE].some(
        (e) => distLinha(p.x, p.z, [e.pe, e.topo]) < e.meia + 1.6,
      ) ||
      distLinha(p.x, p.z, RIO) < MEIA_RIO + 1 ||
      distLinha(p.x, p.z, RIACHO) < MEIA_RIACHO + 1.2;
    let andou = 0;
    let ult: Ponto | null = null;
    let postes = 0;
    for (const p of pts) {
      if (!ult) {
        ult = p;
        continue;
      }
      andou += Math.hypot(p.x - ult.x, p.z - ult.z);
      if (andou < 0.8) continue;
      andou = 0;
      const m = { x: (p.x + ult.x) / 2, z: (p.z + ult.z) / 2 };
      const comp = Math.hypot(p.x - ult.x, p.z - ult.z);
      const giro = Math.atan2(p.x - ult.x, p.z - ult.z);
      if (!aberto(m)) {
        // no píer do avião a cerca abre; os sorteios de cor continuam os mesmos, para o resto
        // do cenário (que vem depois desta cerca) não mudar nada
        const pier = m.z > PIER_DO_AVIAO.z0 - 1 && m.x > PIER_DO_AVIAO.x0 && m.x < PIER_DO_AVIAO.x1;
        for (const y of [0.32, 0.64]) {
          const cor = escolhe(MADEIRA);
          if (pier) r();
          else madeira.add(m.x, y, m.z, 0.08, 0.09, comp + 0.02, cor, 0.04, giro);
        }
        if (postes++ % 2 === 0) {
          const cor = escolhe(MADEIRA);
          if (pier) r();
          else madeira.base(p.x, 0, p.z, 0.16, 0.85, 0.16, cor, 0.04);
        }
      }
      ult = p;
    }
  }

  // =====================================================================
  // PRAÇA: fonte em três andares, canteiro florido, bancos e postes
  // =====================================================================
  {
    const { x: fx, z: fz } = FONTE;
    // canteiro de flores em volta da fonte (aberto nos quatro caminhos)
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      if (Math.abs(Math.sin(a * 2)) < 0.22) continue;
      for (const raio of [4.85, 5.55]) {
        const x = fx + Math.cos(a) * raio;
        const z = fz + Math.sin(a) * raio;
        folhas.base(x, 0, z, 0.62, 0.42 + r() * 0.12, 0.62, escolhe(GRAMA_ESCURA), 0.06, -a);
        if (r() < 0.75)
          folhas.base(
            x + (r() - 0.5) * 0.3,
            0.46,
            z + (r() - 0.5) * 0.3,
            0.16,
            0.14,
            0.16,
            escolhe(FLORES),
            0.02,
          );
      }
      pedra.base(
        fx + Math.cos(a) * 6.0,
        0,
        fz + Math.sin(a) * 6.0,
        0.24,
        0.22,
        0.62,
        0xd4c8b0,
        0.03,
        -a,
      );
    }
    // bacia: borda de pedra em dois degraus, espelho d'água, coluna central e duas taças
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      pedra.base(
        fx + Math.cos(a) * 4.15,
        0,
        fz + Math.sin(a) * 4.15,
        0.62,
        0.68,
        0.7,
        escolhe(PEDRA_CLARA),
        0.03,
        -a,
      );
      pedra.base(
        fx + Math.cos(a) * 4.15,
        0.68,
        fz + Math.sin(a) * 4.15,
        0.78,
        0.12,
        0.74,
        0xf0e9db,
        0.02,
        -a,
      );
      pedra.base(
        fx + Math.cos(a) * 4.62,
        0,
        fz + Math.sin(a) * 4.62,
        0.4,
        0.3,
        0.66,
        escolhe(PEDRA_CLARA),
        0.03,
        -a,
      );
    }
    pedra.base(fx, 0, fz, 1.5, 1.4, 1.5, escolhe(PEDRA_CLARA), 0.03);
    pedra.base(fx, 1.4, fz, 0.8, 1.1, 0.8, 0xece4d5, 0.02);
    for (const [y, raio] of [
      [1.55, 1.75],
      [2.62, 1.0],
    ] as const)
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        pedra.base(
          fx + Math.cos(a) * raio,
          y,
          fz + Math.sin(a) * raio,
          0.46,
          0.34,
          (Math.PI * 2 * raio) / 18 + 0.04,
          0xf3ecdf,
          0.02,
          -a,
        );
      }
    pedra.base(fx, 2.5, fz, 0.45, 0.85, 0.45, 0xece4d5, 0.02);
    pedra.base(fx, 3.35, fz, 0.3, 0.22, 0.3, 0xf3ecdf, 0.02);
    sombras.push({ x: fx, z: fz, rx: 5.2, rz: 5.2 });
    for (const b of BANCOS)
      if (!b.trabalho && Math.hypot(b.x - CORETO.x, b.z - CORETO.z) > 2) banco(b.x, b.z, b.ang);
    for (const p of POSTES) poste(p.x, p.z);
    // vasos com flores nas entradas da praça
    for (const [x, z] of [
      [-2.7, -11.9],
      [2.7, -11.9],
      [-2.7, 11.9],
      [2.7, 11.9],
      [-11.9, -2.7],
      [-11.9, 2.7],
      [11.9, -2.7],
      [11.9, 2.7],
    ] as const) {
      pedra.base(x, 0, z, 0.62, 0.5, 0.62, escolhe(PEDRA_CLARA), 0.03);
      folhas.base(x, 0.5, z, 0.72, 0.42, 0.72, escolhe(GRAMA_ESCURA), 0.06);
      for (let k = 0; k < 4; k++)
        folhas.base(
          x + (r() - 0.5) * 0.5,
          0.88,
          z + (r() - 0.5) * 0.5,
          0.17,
          0.15,
          0.17,
          escolhe(FLORES),
          0,
        );
    }
  }

  // ---------------- árvores, arbustos e pedras ----------------
  for (const a of ARVORES) {
    arvore(folhas, a.x, a.z, { tipo: a.tipo, ...(a.cor ? { cor: a.cor } : {}) }, madeira);
    const raio = a.tipo === "copinha" ? 1.0 : 1.35;
    sombras.push({ x: a.x, z: a.z, rx: raio, rz: raio });
  }
  {
    // canteiros floridos espelhados ao longo dos caminhos e da beirada
    const metade: [number, number, number][] = [
      [-5.8, 14.4, 0xff5a5a],
      [-5.4, 17.2, 0xffffff],
      [-9.6, 18.4, 0xffd84a],
      [-14.8, 2.8, 0xff8fc8],
      [-24.6, 3.0, 0xffffff],
      [-24.8, -3.2, 0xff5a5a],
      [-14.6, -2.8, 0xffd84a],
      [-4.6, -14.0, 0xff8fc8],
      [-10.4, -19.4, 0xffffff],
      [-26.6, -10.8, 0xffd84a],
      [-20.8, 18.8, 0xff5a5a],
    ];
    for (const [x, z, flor] of metade)
      for (const l of [-1, 1]) {
        const px = x * l;
        if (naAgua(px, z, 0.8) || piso(px, z) !== "grama") continue;
        arbusto(folhas, px, z, 1, { flor });
        arbusto(folhas, px + 0.7, z + 0.4, 0.75, { flor });
      }
    for (const [x, z] of [
      [-28.2, 1.2],
      [-9.2, -21.0],
      [-25.6, 14.6],
      [-3.8, 21.2],
    ] as const)
      for (const l of [-1, 1]) if (!naAgua(x * l, z, 1)) pedregulho(pedra, x * l, z, 0.9);
  }

  // =====================================================================
  // ÁGUA: rio da direita, nascente, laguinho da esquerda, riacho e as cachoeiras
  // =====================================================================
  const tAgua = texturaAgua(THREE);
  const tParada = texturaAgua(THREE, 5);
  const tQueda = texturaQueda(THREE);
  for (const t of [tAgua, tParada, tQueda]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const mAgua = acabamento(
    new THREE.MeshStandardMaterial({
      map: tAgua,
      color: 0x8fe0ff,
      roughness: 0.12,
      transparent: true,
      opacity: 0.9,
      emissive: 0x0c4f86,
      emissiveIntensity: 0.25,
    }),
    { nevoa: NEVOA },
  );
  const mParada = new THREE.MeshStandardMaterial({
    map: tParada,
    color: 0x9fe6ff,
    roughness: 0.1,
    transparent: true,
    opacity: 0.92,
    emissive: 0x0c4f86,
    emissiveIntensity: 0.22,
  });
  const mQueda = acabamento(
    new THREE.MeshStandardMaterial({
      map: tQueda,
      color: 0xd8f4ff,
      roughness: 0.3,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      emissive: 0x2a7cc0,
      emissiveIntensity: 0.25,
    }),
    { nevoa: NEVOA },
  );
  lixo.push(tAgua, tParada, tQueda, mAgua, mParada, mQueda);
  {
    for (const g of [
      faixaDeAgua(THREE, RIO, MEIA_RIO + 0.15, -0.2),
      faixaDeAgua(THREE, RIACHO, MEIA_RIACHO + 0.15, -0.2),
    ]) {
      const m = new THREE.Mesh(g, mAgua);
      m.receiveShadow = true;
      grupo.add(m);
      lixo.push(g);
    }
    // espelhos d'água: nascente, laguinho e a bacia da fonte
    for (const [x, z, raio, y] of [
      [NASCENTE.x, NASCENTE.z, NASCENTE.r + 0.2, -0.2],
      [LAGO.x, LAGO.z, LAGO.r + 0.2, -0.2],
      [FONTE.x, FONTE.z, 3.85, 0.5],
    ] as const) {
      const g = new THREE.CircleGeometry(raio, 40);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mParada);
      m.position.set(x, y, z);
      grupo.add(m);
      lixo.push(g);
    }
    // pedras das margens do rio e do riacho
    const margem = (linha: readonly Ponto[], meia: number) => {
      for (let i = 1; i < linha.length; i++) {
        const a = linha[i - 1]!;
        const b = linha[i]!;
        const comp = Math.hypot(b.x - a.x, b.z - a.z);
        const nx = -(b.z - a.z) / comp;
        const nz = (b.x - a.x) / comp;
        for (let t = 0; t < comp; t += 0.75)
          for (const l of [-1, 1]) {
            const x = a.x + ((b.x - a.x) * t) / comp + nx * l * (meia + 0.25);
            const z = a.z + ((b.z - a.z) * t) / comp + nz * l * (meia + 0.25);
            if (!dentroDaIlha(x, z, 0.6) || piso(x, z) === "caminho") continue;
            pedra.base(x, -0.1, z, 0.66, 0.3 + r() * 0.12, 0.66, escolhe(ROCHA), 0.06, r());
          }
      }
    };
    margem(RIO, MEIA_RIO);
    margem(RIACHO, MEIA_RIACHO);
    for (const [x, z, raio] of [
      [NASCENTE.x, NASCENTE.z, NASCENTE.r],
      [LAGO.x, LAGO.z, LAGO.r],
    ] as const)
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        pedra.base(
          x + Math.cos(a) * (raio + 0.25),
          -0.1,
          z + Math.sin(a) * (raio + 0.25),
          0.7,
          0.36,
          0.6,
          escolhe(ROCHA),
          0.06,
          -a,
        );
      }
    // vitórias-régias e flores na água
    for (const [x, z] of [
      [LAGO.x - 1.0, LAGO.z + 0.6],
      [LAGO.x + 0.9, LAGO.z - 0.8],
      [LAGO.x + 0.2, LAGO.z + 1.4],
      [20.2, 4.6],
      [22.1, 10.4],
      [17.9, -4.4],
    ] as const) {
      folhas.base(x, -0.19, z, 0.5, 0.03, 0.5, 0x3fa34a, 0.04);
      if (r() < 0.6) folhas.base(x + 0.1, -0.16, z, 0.12, 0.1, 0.12, 0xff8fc8, 0);
    }
    // cachoeiras: a água cai da beirada e some nas nuvens lá embaixo
    const queda = (
      x: number,
      z: number,
      y: number,
      largura: number,
      altura: number,
      giro: number,
    ) => {
      const g = new THREE.PlaneGeometry(largura, altura);
      const m = new THREE.Mesh(g, mQueda);
      m.position.set(x, y - altura / 2, z);
      m.rotation.y = giro;
      grupo.add(m);
      lixo.push(g);
      for (let k = 0; k < 10; k++)
        brilhos.push([x + (r() - 0.5) * largura, y - r() * 3, z + (r() - 0.5) * 0.6]);
    };
    const fimRio = RIO[RIO.length - 1]!;
    const fimRiacho = RIACHO[RIACHO.length - 1]!;
    queda(fimRio.x, fimRio.z + 0.2, -0.15, MEIA_RIO * 2.1, 16, -0.3);
    queda(fimRiacho.x, fimRiacho.z + 0.2, -0.15, MEIA_RIACHO * 2.3, 14, 0.25);
    // as ilhas do Magnata e do Escritório também têm uma quedinha na ponta de fora
    for (const ix of [ILHA_MAGNATA.x0 + 2.2, ILHA_ESCRITORIO.x1 - 2.2]) {
      queda(ix, ILHA_MAGNATA.z1 + 0.05, -0.1, 1.4, 10, 0);
      const gz = faixaDeAgua(
        THREE,
        [
          { x: ix, z: 3.4 },
          { x: ix, z: ILHA_MAGNATA.z1 + 0.05 },
        ],
        0.7,
        0.04,
      );
      grupo.add(new THREE.Mesh(gz, mAgua));
      lixo.push(gz);
    }
    // pontezinha de madeira do caminho do leste, por cima do rio
    const alturaDaPonte = (k: number) => 0.14 + Math.cos((k / 6) * (Math.PI / 2)) * 0.38;
    for (let k = -6; k <= 6; k++)
      madeira.base(
        PONTE.x + k * 0.36,
        alturaDaPonte(k) - 0.12,
        PONTE.z,
        0.34,
        0.16,
        PONTE.meia * 2 + 0.2,
        escolhe(MADEIRA),
        0.04,
      );
    for (const l of [-1, 1]) {
      for (let k = -6; k <= 6; k += 3)
        madeira.base(
          PONTE.x + k * 0.36,
          alturaDaPonte(k),
          PONTE.z + l * (PONTE.meia + 0.05),
          0.14,
          0.8,
          0.14,
          0x7a4f2c,
          0.03,
        );
      for (let k = -6; k < 6; k++)
        madeira.base(
          PONTE.x + (k + 0.5) * 0.36,
          alturaDaPonte(k + 0.5) + 0.66,
          PONTE.z + l * (PONTE.meia + 0.05),
          0.4,
          0.09,
          0.1,
          escolhe(MADEIRA),
          0.03,
        );
    }
  }

  // =====================================================================
  // PONTOS DA PRAÇA: queridômetro, caixa postal, coreto, arco de flores, ducha
  // =====================================================================
  const placas: {
    tex: TH.Texture;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    giro?: number;
  }[] = [];
  const placaDePostes = (
    p: Ponto,
    linhas: string[],
    fundo: string,
    borda: string,
    cor = "#ffffff",
  ) => {
    for (const l of [-1, 1]) madeira.base(p.x + l * 0.78, 0, p.z, 0.12, 1.9, 0.12, 0x6e4a2b, 0.03);
    const alta = linhas.length > 1;
    placas.push({
      tex: texturaDePlaca(THREE, linhas, {
        fundo,
        borda,
        cor,
        largura: 512,
        altura: alta ? 210 : 124,
      }),
      x: p.x,
      y: alta ? 1.95 : 2.0,
      z: p.z + 0.08,
      w: 1.95,
      h: alta ? 0.8 : 0.48,
    });
  };
  // queridômetro: totem branco com o tubo vermelho e um coração aceso em cima
  {
    const { x: tx, z: tz } = TERMOMETRO;
    pedra.base(tx, 0, tz, 1.1, 0.22, 1.1, PEDRA_CLARA[0], 0.04);
    pedra.base(tx, 0.22, tz, 0.8, 0.16, 0.8, PEDRA_CLARA[1], 0.04);
    pedra.base(tx, 0.38, tz, 0.66, 0.66, 0.66, VERMELHO, 0.02);
    pedra.base(tx, 1.04, tz, 0.42, 2.0, 0.42, 0xfbf7ee, 0.02);
    pedra.base(tx, 1.04, tz + 0.05, 0.2, 1.2, 0.38, VERMELHO, 0);
    for (let m = 0; m < 5; m++)
      pedra.base(tx + 0.15, 1.36 + m * 0.34, tz + 0.22, 0.1, 0.04, 0.03, FERRO, 0);
    pedra.base(tx, 3.04, tz, 0.48, 0.16, 0.48, 0xfbf7ee, 0.02);
    const CORACAO = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
    CORACAO.forEach((linha, j) =>
      [...linha].forEach((c, i) => {
        if (c === "X")
          aceso.add(tx + (i - 3) * 0.13, 4.2 - j * 0.13, tz, 0.13, 0.13, 0.16, 0xff3b30, 0);
      }),
    );
    sombras.push({ x: tx, z: tz, rx: 0.8, rz: 0.8 });
    placaDePostes(PLACA_QUERIDOMETRO, ["QUERIDÔMETRO"], "#c8231c", "#7a120e");
  }
  // caixa postal: caixa vermelha num pedestal, com o envelope e a bandeirinha
  {
    const { x, z } = CORREIO;
    pedra.base(x, 0, z, 1.1, 0.22, 1.1, PEDRA_CLARA[0], 0.04);
    madeira.base(x, 0.22, z, 0.16, 0.9, 0.16, FERRO, 0);
    pedra.base(x, 1.1, z, 0.72, 0.6, 0.56, 0xe02a20, 0.02);
    pedra.base(x, 1.7, z, 0.62, 0.14, 0.5, 0xc8231c, 0.02);
    pedra.base(x, 1.82, z, 0.42, 0.1, 0.4, 0xc8231c, 0.02);
    pedra.base(x, 1.26, z + 0.29, 0.42, 0.28, 0.02, 0xf6f1e4, 0);
    pedra.base(x, 1.38, z + 0.3, 0.42, 0.04, 0.02, 0xd9d2c4, 0);
    madeira.base(x + 0.4, 1.3, z, 0.04, 0.5, 0.04, FERRO, 0);
    pedra.base(x + 0.5, 1.68, z, 0.2, 0.13, 0.03, 0xffd84a, 0);
    sombras.push({ x, z, rx: 0.8, rz: 0.8 });
    placaDePostes(PLACA_CORREIO, ["CAIXA", "POSTAL"], "#c8231c", "#7a120e");
  }
  // Comércio HOST: barraca de feira com toldo listrado, balcão e caixotes de frutas e verduras.
  // Cores fixas e sem variação de tom (variar = 0): não mexe nos sorteios do resto do cenário.
  {
    const { x0, x1, z0, z1 } = COMERCIO;
    const cx = CENTRO_DO_COMERCIO.x;
    const larg = x1 - x0;
    const MAD = 0xa8743c;
    const MAD_ESCURA = 0x7a4f2c;
    const MAD_CLARA = 0xc89a5e;
    // estrado no chão, painel do fundo com duas prateleiras e os quatro pilares
    madeira.base(cx, 0, (z0 + z1) / 2, larg + 0.3, 0.08, z1 - z0 + 0.5, MAD_ESCURA, 0);
    madeira.base(cx, 0.08, z0 + 0.08, larg, 2.3, 0.14, MAD, 0);
    for (const y of [0.95, 1.6])
      madeira.base(cx, y, z0 + 0.34, larg - 0.3, 0.07, 0.4, MAD_CLARA, 0);
    for (const x of [x0 + 0.1, x1 - 0.1])
      for (const z of [z0 + 0.1, z1 - 0.12])
        madeira.base(x, 0.08, z, 0.16, 2.62, 0.16, MAD_ESCURA, 0);
    // balcão: corpo vermelho com um friso branco e o tampo de madeira clara
    pedra.base(cx, 0.08, z1 - 0.34, larg - 0.42, 0.86, 0.5, VERMELHO, 0);
    pedra.base(cx, 0.62, z1 - 0.085, larg - 0.42, 0.09, 0.02, BRANCO, 0);
    madeira.base(cx, 0.94, z1 - 0.32, larg - 0.24, 0.08, 0.64, MAD_CLARA, 0);
    // caixotes com a colheita (morango, laranja, alface, milho, uva e pitaya)
    const FRUTAS = [0xe8333a, 0xf28a1e, 0x7ccf4a, 0xf6cf3a, 0x7b3fbf, 0xff4fa0];
    const caixote = (x: number, y: number, z: number, cor: number) => {
      madeira.base(x, y, z, 0.66, 0.22, 0.44, MAD, 0);
      for (let i = 0; i < 3; i++)
        for (let k = 0; k < 2; k++)
          folhas.base(x - 0.2 + i * 0.2, y + 0.2, z - 0.1 + k * 0.2, 0.15, 0.13, 0.15, cor, 0);
    };
    [-1.3, -0.44, 0.44, 1.3].forEach((dx, i) =>
      caixote(cx + dx, 1.02, z1 - 0.32, FRUTAS[i % FRUTAS.length]!),
    );
    [0.95, 1.6].forEach((y, j) =>
      [-1.2, -0.4, 0.4, 1.2].forEach((dx, i) =>
        caixote(cx + dx, y + 0.07, z0 + 0.36, FRUTAS[(i + j * 2 + 2) % FRUTAS.length]!),
      ),
    );
    // toldo listrado (vermelho e branco) descendo em degraus do fundo para a frente
    const faixas = 8;
    const w = (larg + 0.6) / faixas;
    const fundoZ = z0 - 0.05;
    const frenteZ = z1 + 0.7;
    const degraus = 5;
    const passo = (frenteZ - fundoZ) / degraus;
    for (let s = 0; s < faixas; s++) {
      const x = x0 - 0.3 + w * (s + 0.5);
      const cor = s % 2 ? BRANCO : VERMELHO;
      for (let k = 0; k < degraus; k++)
        pedra.add(
          x,
          2.86 - k * 0.11,
          fundoZ + passo * (k + 0.5),
          w + 0.01,
          0.07,
          passo + 0.03,
          cor,
          0,
        );
      // babado na beira do toldo
      pedra.add(x, 2.3, frenteZ + 0.01, w - 0.04, 0.2, 0.04, cor, 0);
    }
    // placa "COMÉRCIO" em cima do toldo
    for (const l of [-1, 1])
      madeira.base(cx + l * 0.95, 2.62, z0 + 0.2, 0.08, 0.62, 0.08, MAD_ESCURA, 0);
    placas.push({
      tex: texturaDePlaca(THREE, ["COMÉRCIO"], {
        fundo: "#c8231c",
        borda: "#7a120e",
        cor: "#ffffff",
        largura: 512,
        altura: 124,
      }),
      x: cx,
      y: 3.42,
      z: z0 + 0.26,
      w: 2.5,
      h: 0.6,
    });
    sombras.push({ x: cx, z: (z0 + z1) / 2 + 0.2, rx: 2.5, rz: 1.5 });
  }
  // píer de embarque do avião (evento do Founder): tábuas que passam um pouco da beirada,
  // com dois postes de luz na ponta; a cerca fica aberta aqui
  {
    const { x0, x1, z0, z1 } = PIER_DO_AVIAO;
    let n = 0;
    for (let z = z0 + 0.16; z < z1; z += 0.32)
      madeira.base((x0 + x1) / 2, -0.03, z, x1 - x0, 0.1, 0.28, n++ % 2 ? 0x9c6a36 : 0xa8743c, 0);
    for (const x of [x0 + 0.22, x1 - 0.22]) {
      madeira.base(x, -1.2, z1 - 0.2, 0.18, 1.18, 0.18, 0x7a4f2c, 0);
      madeira.base(x, 0.07, z1 - 0.2, 0.14, 0.95, 0.14, 0x7a4f2c, 0);
      aceso.add(x, 1.08, z1 - 0.2, 0.2, 0.14, 0.2, 0xffd84a, 0);
    }
    placas.push({
      tex: texturaDePlaca(THREE, ["EMBARQUE"], {
        fundo: "#c8231c",
        borda: "#7a120e",
        cor: "#ffffff",
        largura: 512,
        altura: 124,
      }),
      x: PLACA_EMBARQUE.x,
      y: 1.55,
      z: PLACA_EMBARQUE.z + 0.06,
      w: 1.7,
      h: 0.42,
    });
    for (const l of [-1, 1])
      madeira.base(PLACA_EMBARQUE.x + l * 0.7, 0, PLACA_EMBARQUE.z, 0.1, 1.55, 0.1, 0x6e4a2b, 0);
  }
  // coreto: base de pedra em dois degraus, oito colunas brancas com flores e o telhado de telhas em degraus
  {
    const { x: cx, z: cz } = CORETO;
    const R = RAIO_DO_CORETO;
    for (const [y, raio, cor] of [
      [0, R + 0.7, PEDRA_CLARA[1]],
      [0.2, R + 0.25, PEDRA_CLARA[0]],
    ] as const)
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        for (let rr = 0.5; rr <= raio; rr += 0.9)
          pedra.base(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, 0.95, 0.2, 0.95, cor, 0.03);
      }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      pedra.base(x, 0.4, z, 0.36, 2.5, 0.36, 0xfbf7ee, 0.02);
      pedra.base(x, 2.9, z, 0.5, 0.16, 0.5, PEDRA_CLARA[0], 0.02);
      folhas.base(x, 1.2 + r(), z, 0.44, 0.5, 0.44, escolhe(GRAMA_ESCURA), 0.06);
      folhas.base(x + 0.1, 1.5 + r(), z, 0.14, 0.14, 0.14, escolhe(FLORES), 0);
    }
    (
      [
        [R + 1.0, 0.36],
        [R + 0.4, 0.36],
        [R - 0.3, 0.36],
        [R - 1.0, 0.36],
        [R - 1.8, 0.36],
        [0.5, 0.4],
      ] as const
    ).reduce((y, [raio, h]) => {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        for (let rr = 0.4; rr <= raio; rr += 0.85)
          madeira.base(
            cx + Math.cos(a) * rr,
            y,
            cz + Math.sin(a) * rr,
            0.9,
            h,
            0.9,
            escolhe(TELHA),
            0.04,
          );
      }
      return y + h;
    }, 3.06);
    lanterna(cx, 2.4, cz);
    for (const b of BANCOS) if (Math.hypot(b.x - cx, b.z - cz) < 2) banco(b.x, b.z, b.ang);
    sombras.push({ x: cx, z: cz, rx: R + 0.9, rz: R + 0.9 });
  }
  // arco de flores sobre a trilha do coreto
  {
    const { x, z } = ARCO_DE_FLORES;
    for (const l of [-1, 1]) {
      const px = x + l * 1.05;
      const pz = z + l * 0.42;
      madeira.base(px, 0, pz, 0.2, 2.4, 0.2, BRANCO, 0.02);
      for (let y = 0.3; y < 2.3; y += 0.45) {
        folhas.base(px, y, pz, 0.42, 0.4, 0.42, escolhe(GRAMA_ESCURA), 0.06);
        folhas.base(
          px + (r() - 0.5) * 0.3,
          y + 0.2,
          pz + (r() - 0.5) * 0.3,
          0.15,
          0.15,
          0.15,
          escolhe([0xff5a7a, 0xff8fc8, 0xffffff]),
          0,
        );
      }
    }
    for (let k = 0; k <= 8; k++) {
      const ang = (k / 8) * Math.PI;
      const px = x + Math.cos(ang) * 1.05;
      const pz = z + Math.cos(ang) * 0.42;
      const py = 2.3 + Math.sin(ang) * 0.6;
      folhas.base(px, py, pz, 0.5, 0.42, 0.5, escolhe(GRAMA_ESCURA), 0.06);
      folhas.base(
        px,
        py + 0.36,
        pz,
        0.16,
        0.15,
        0.16,
        escolhe([0xff5a7a, 0xff8fc8, 0xffffff, 0xffd84a]),
        0,
      );
    }
  }
  // chuveirão: deque de madeira, poste com a ducha e o balde
  {
    const { x, z } = CHUVEIRO;
    for (let i = 0; i < 4; i++)
      madeira.base(x - 0.6 + i * 0.4, 0, z, 0.38, 0.08, 1.6, escolhe(MADEIRA), 0.04);
    madeira.base(x - 0.62, 0, z - 0.62, 0.12, 2.5, 0.12, FERRO, 0);
    madeira.base(x - 0.31, 2.44, z - 0.31, 0.7, 0.07, 0.07, FERRO, 0, Math.PI / 4);
    pedra.base(x, 2.26, z, 0.34, 0.12, 0.34, 0xc9ced6, 0.02);
    pedra.base(x - 0.55, 1.1, z - 0.62, 0.1, 0.1, 0.1, VERMELHO, 0);
    madeira.base(x + 0.75, 0, z + 0.55, 0.3, 0.3, 0.3, 0x5aa8d8, 0.03);
  }

  // =====================================================================
  // TERRAÇO DO RANKING (norte): morrinho verde atrás e o arco do RANKING (no lugar do antigo pódio)
  // =====================================================================
  {
    const T = TERRACO_TOP3;
    const { x, z } = TOP3;
    for (let px = T.x0 + 0.5; px < T.x1; px++)
      for (let pz = T.z0 + 0.5; pz < T.z1; pz++)
        piso3d.base(px, 0, pz, 1, 0.12, 1, escolhe(PEDRA_CLARA), 0.03);
    // morrinho atrás: camadas de grama subindo, com arbustos e árvores em cima
    for (let k = 0; k < 4; k++) {
      const w = T.x1 - T.x0 + 3 - k * 2.4;
      const zz = T.z0 - 1.0 - k * 0.6;
      for (let px = -w / 2 + 0.5; px < w / 2; px++)
        chao.base(px, 0, zz, 1, 0.6 + k * 0.55, 1.4, escolhe(GRAMA), 0.05);
    }
    for (const l of [-1, 1]) {
      arbusto(folhas, l * 4.6, T.z0 - 0.6, 1.2, { flor: 0xffd84a });
      arbusto(folhas, l * 2.6, T.z0 - 1.4, 1.1, { flor: 0xffffff, y: 1.0 });
      arvore(
        folhas,
        l * 6.8,
        T.z0 - 1.2,
        { tipo: "copinha", cor: l < 0 ? "amarelo" : "verde", y: 0.6 },
        madeira,
      );
    }
    // o arco do RANKING (modelo 3D) com os textos flutuando no vão; as colunas fazem sombra
    for (const l of [-1, 1]) sombras.push({ x: x + l * COLUNAS_ARCO.x, z, rx: 0.9, rz: 0.55 });
  }

  const arcoDoRanking = criarArcoDoRanking(THREE, grupo, TOP3);
  lixo.push({ dispose: () => arcoDoRanking.descartar() });

  // =====================================================================
  // PONTES DO OESTE E DO LESTE: lajes, balaustrada com pilares e lanternas, apoios por baixo
  // =====================================================================
  for (const P of [PONTE_OESTE, PONTE_LESTE]) {
    const comp = P.x1 - P.x0;
    const n = Math.round(comp);
    for (let i = 0; i < n; i++) {
      const x = P.x0 + (i + 0.5) * (comp / n);
      for (const dz of [-1.1, 0, 1.1])
        piso3d.base(x, -0.4, dz, comp / n, 0.4, 1.12, escolhe(PAVE), 0.04);
      for (const l of [-1, 1]) {
        pedra.base(x, 0, l * (P.meia + 0.05), comp / n, 0.55, 0.32, escolhe(PEDRA_CLARA), 0.04);
        if (i % 3 === 1) {
          pedra.base(x, 0, l * (P.meia + 0.05), 0.55, 1.15, 0.55, escolhe(PEDRA_CLARA), 0.03);
          lanterna(x, 1.15, l * (P.meia + 0.05));
        }
      }
      encosta.base(x, -1.0, 0, comp / n, 0.6, P.meia * 2 + 0.4, escolhe(ROCHA), 0.05);
      if (i % 4 === 2) encosta.base(x, -6, 0, 1.6, 5, 2.4, escolhe(ROCHA), 0.05);
    }
  }

  // =====================================================================
  // ILHA DO MAGNATA (oeste): casas coloridas de tabuleiro no chão, dados, peão e o prédio do portal
  // =====================================================================
  {
    ilhaRetangular(ILHA_MAGNATA, 0, 9);
    const CORES = [0xff5b4f, 0x3d8bff, 0xffc933, 0x35c46a, 0xa56bff, 0xff8a3d, 0x5cc8f0, 0xe86bb8];
    const B = { x0: -49.4, x1: -41.2, z0: -6.8, z1: 6.8 };
    let k = 0;
    for (let x = B.x0 + 0.5; x < B.x1; x++)
      for (let z = B.z0 + 0.5; z < B.z1; z++) {
        const borda = x < B.x0 + 1 || x > B.x1 - 1 || z < B.z0 + 1 || z > B.z1 - 1;
        if (Math.abs(z) < 1.6 && x > B.x1 - 1) continue; // passagem da ponte
        if (borda) {
          piso3d.base(x, 0, z, 0.98, 0.05, 0.98, 0xfbf7ee, 0);
          piso3d.base(x, 0.05, z, 0.72, 0.02, 0.72, CORES[k++ % CORES.length] ?? 0xffffff, 0);
        } else if (Math.abs(z) < 1.6) piso3d.base(x, 0, z, 1, 0.05, 1, escolhe(PAVE), 0.03);
      }
    for (const [n, d] of DADOS_DO_MAGNATA.entries()) {
      const giro = n ? -0.5 : 0.35;
      pedra.base(d.x, 0, d.z, 0.95, 0.95, 0.95, 0xfbf8f1, 0.01, giro);
      const pontos: [number, number][] = n
        ? [
            [-0.24, -0.24],
            [0.24, 0.24],
            [0, 0],
          ]
        : [
            [-0.24, -0.24],
            [0.24, 0.24],
            [-0.24, 0.24],
            [0.24, -0.24],
          ];
      for (const [a, b] of pontos)
        pedra.add(
          d.x + a * Math.cos(giro) + b * Math.sin(giro),
          0.965,
          d.z - a * Math.sin(giro) + b * Math.cos(giro),
          0.15,
          0.03,
          0.15,
          n ? 0x1d1a17 : VERMELHO,
          0,
          giro,
        );
      sombras.push({ x: d.x, z: d.z, rx: 0.8, rz: 0.8 });
    }
    {
      const { x: px, z: pz } = PEAO_DO_MAGNATA;
      (
        [
          [0.66, 0.12],
          [0.5, 0.42],
          [0.32, 0.38],
          [0.44, 0.14],
          [0.46, 0.38],
        ] as const
      ).reduce((y, [l, h]) => {
        pedra.base(px, y, pz, l, h, l, 0xe2342a, 0.02);
        return y + h;
      }, 0);
    }
    // prédio de pedra com colunas e telhado azul, de frente para a ponte; a porta é o portal
    const Pm = PREDIO_MAGNATA;
    const mx = (Pm.x0 + Pm.x1) / 2;
    for (let z = Pm.z0 + 0.3; z < Pm.z1; z += 0.6)
      for (let y = 0; y < 3.6; y += 0.6) {
        const naPorta = Math.abs(z) < Pm.porta + 0.1 && y < 2.9;
        if (!naPorta) pedra.base(Pm.x1 - 0.3, y, z, 0.6, 0.6, 0.6, escolhe(PEDRA_CLARA), 0.04);
        pedra.base(Pm.x0 + 0.3, y, z, 0.6, 0.6, 0.6, escolhe(PEDRA_CLARA), 0.04);
      }
    for (let x = Pm.x0 + 0.9; x < Pm.x1 - 0.5; x += 0.6)
      for (let y = 0; y < 3.6; y += 0.6)
        for (const zz of [Pm.z0 + 0.3, Pm.z1 - 0.3])
          pedra.base(x, y, zz, 0.6, 0.6, 0.6, escolhe(PEDRA_CLARA), 0.04);
    pedra.base(mx, 0, 0, Pm.x1 - Pm.x0 - 1.2, 2.9, Pm.porta * 2, 0x0a1230, 0);
    for (const l of [-1, 1]) {
      pedra.base(Pm.x1 + 0.35, 0, l * (Pm.porta + 0.35), 0.5, 3.2, 0.5, 0xfbf7ee, 0.02);
      pedra.base(Pm.x1 + 0.35, 3.2, l * (Pm.porta + 0.35), 0.66, 0.18, 0.66, PEDRA_CLARA[0], 0.02);
      lanterna(Pm.x1 + 0.9, 2.2, l * (Pm.porta + 1.2));
      clarao.push({ x: Pm.x1 + 1.6, z: l * 1.4, rx: 2.2, rz: 2.2 });
    }
    (
      [
        [Pm.x1 - Pm.x0 + 0.8, Pm.z1 - Pm.z0 + 0.8, 0x3d5a9e],
        [Pm.x1 - Pm.x0 - 0.2, Pm.z1 - Pm.z0 - 0.6, 0x35508f],
        [Pm.x1 - Pm.x0 - 1.4, Pm.z1 - Pm.z0 - 2.2, 0x2e477f],
      ] as const
    ).reduce((y, [w, d, cor]) => {
      madeira.base(mx, y, 0, w, 0.4, d, cor, 0.03);
      return y + 0.4;
    }, 3.6);
    for (const zz of [-2.6, 0, 2.6]) aceso.base(mx, 4.8, zz, 0.2, 0.3, 0.2, 0xffd84a, 0);
    placas.push({
      tex: texturaDePlaca(THREE, ["MAGNATA"], {
        fundo: "#1f4fbf",
        borda: "#e7b334",
        cor: "#ffd55a",
        largura: 512,
        altura: 128,
      }),
      x: Pm.x1 + 0.12,
      y: 3.95,
      z: 0,
      w: 3.6,
      h: 0.9,
      giro: Math.PI / 2,
    });
    sombras.push({ x: mx, z: 0, rx: 2.6, rz: 5 });
    for (const [x, z, tipo] of [
      [-53.2, -7.0, "pinheiro"],
      [-53.0, 7.0, "copa"],
      [-41.6, -7.4, "copinha"],
    ] as const) {
      arvore(folhas, x, z, { tipo }, madeira);
      sombras.push({ x, z, rx: 1.2, rz: 1.2 });
    }
  }

  // =====================================================================
  // ILHA DO ESCRITÓRIO (leste): prédio claro de telhado vermelho, faixas com o H e as mesas
  // =====================================================================
  {
    const I = ILHA_ESCRITORIO;
    ilhaRetangular(I, 0, 9);
    const E = ESCRITORIO;
    for (let x = E.x0 + 0.5; x < E.x1; x++)
      for (let z = E.z0 + 0.5; z < E.z1; z++)
        piso3d.base(x, 0, z, 1, 0.06, 1, escolhe([0xc9a074, 0xbf9468, 0xd2aa7e]), 0.03);
    for (let x = I.x0 + 0.5; x < E.x0; x++)
      for (let z = -1.5; z < 2; z++) piso3d.base(x, 0, z, 1, 0.06, 1, escolhe(PAVE), 0.03);
    const H = 3.4;
    const PAREDE = [0xf1e8d6, 0xe8ddc6] as const;
    for (let z = E.z0 + 0.3; z < E.z1; z += 0.6)
      for (let y = 0; y < H; y += 0.6)
        pedra.base(E.x1 - 0.2, y, z, 0.4, 0.6, 0.6, escolhe(PAREDE), 0.03);
    for (let x = E.x0 + 0.3; x < E.x1; x += 0.6)
      for (let y = 0; y < H; y += 0.6)
        for (const zz of [E.z0 + 0.2, E.z1 - 0.2]) {
          const janela = y > 0.9 && y < 2.4 && Math.abs(((x - E.x0) % 2.4) - 1.2) < 0.5;
          if (janela) aceso.base(x, y, zz, 0.6, 0.6, 0.3, 0xffe2a0, 0);
          else pedra.base(x, y, zz, 0.6, 0.6, 0.4, escolhe(PAREDE), 0.03);
        }
    for (const z of [E.z0 + 0.4, E.z0 + 3.9, E.z1 - 3.9, E.z1 - 0.4]) {
      pedra.base(E.x0 - 0.1, 0, z, 0.5, H, 0.5, 0xfbf7ee, 0.02);
      pedra.base(E.x0 - 0.1, H, z, 0.66, 0.16, 0.66, PEDRA_CLARA[0], 0.02);
    }
    (
      [
        [E.x1 - E.x0 + 1.0, E.z1 - E.z0 + 1.0],
        [E.x1 - E.x0 - 0.6, E.z1 - E.z0 - 0.6],
        [E.x1 - E.x0 - 2.4, E.z1 - E.z0 - 2.4],
        [E.x1 - E.x0 - 4.4, E.z1 - E.z0 - 4.4],
      ] as const
    ).reduce((y, [w, d]) => {
      madeira.base((E.x0 + E.x1) / 2, y, (E.z0 + E.z1) / 2, w, 0.36, d, escolhe(TELHA), 0.04);
      return y + 0.36;
    }, H + 0.16);
    for (const x of [E.x0 + 1.6, E.x1 - 1.6]) {
      madeira.base(x, H - 0.25, E.z1 + 0.06, 1.2, 0.1, 0.1, 0xd9a83a, 0.02);
      placas.push({
        tex: texturaDePlaca(THREE, ["H"], {
          fundo: "#c8231c",
          borda: "#e7b334",
          cor: "#ffd55a",
          largura: 160,
          altura: 256,
        }),
        x,
        y: H - 1.2,
        z: E.z1 + 0.08,
        w: 1.0,
        h: 1.6,
      });
    }
    placas.push({
      tex: texturaDePlaca(THREE, ["ESCRITÓRIO", "HOST"], {
        fundo: "#4a2f16",
        borda: "#e7b334",
        cor: "#ffd55a",
        largura: 512,
        altura: 230,
      }),
      x: (E.x0 + E.x1) / 2,
      y: H + 2.05,
      z: E.z1 - 1.4,
      w: 3.8,
      h: 1.7,
    });
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
      const cz = m.z + 1.0;
      madeira.base(m.x, 0, cz, 0.1, 0.36, 0.1, FERRO, 0);
      madeira.base(m.x, 0.36, cz, 0.52, 0.08, 0.52, VERMELHO, 0.03);
      madeira.base(m.x, 0.44, cz + 0.25, 0.52, 0.5, 0.08, VERMELHO, 0.03);
    }
    lanterna((E.x0 + E.x1) / 2, H - 0.6, (E.z0 + E.z1) / 2, 0xfff0c8);
    for (const z of [E.z0 + 1.0, E.z1 - 1.0]) {
      pedra.base(E.x1 - 1.0, 0, z, 0.5, 0.4, 0.5, BRANCO, 0.03);
      folhas.base(E.x1 - 1.0, 0.4, z, 0.6, 0.7, 0.6, GRAMA_ESCURA[0], 0.08);
    }
    sombras.push({ x: (E.x0 + E.x1) / 2, z: (E.z0 + E.z1) / 2, rx: 6.5, rz: 6.5 });
    for (const [x, z, tipo] of [
      [53.4, -7.2, "pinheiro"],
      [41.4, 7.0, "copa"],
      [41.6, -7.4, "copinha"],
    ] as const) {
      arvore(
        folhas,
        x,
        z,
        { tipo, ...(tipo === "copa" ? { cor: "amarelo" as const } : {}) },
        madeira,
      );
      sombras.push({ x, z, rx: 1.2, rz: 1.2 });
    }
  }

  // =====================================================================
  // EM BREVE (nordeste, no alto): escadaria, ilha e o portão de pedra trancado
  // =====================================================================
  const escadaria = (e: Escadaria, H: number, ilhaZ1: number) => {
    const esc = naEscadaria(0, 0, e);
    const giro = Math.atan2(esc.ux, esc.uz);
    const naRampa = (ao: number, lado: number) => ({
      x: e.pe.x + esc.ux * ao + esc.uz * lado,
      z: e.pe.z + esc.uz * ao - esc.ux * lado,
    });
    const N = 22;
    const passo = (esc.comp + 1.4) / N;
    for (let i = 0; i < N; i++) {
      const ao = (i + 0.5) * passo;
      const y = Math.min(H + 0.03, (H * ao) / (esc.comp - 1.2));
      for (const lado of [-1.47, 0, 1.47]) {
        const c = naRampa(ao, lado);
        piso3d.add(c.x, y - 0.275, c.z, 1.47, 0.55, passo, escolhe(PAVE), 0.04, giro);
      }
      for (const l of [-1, 1]) {
        const m = naRampa(ao, l * (e.meia + 0.25));
        pedra.add(m.x, y + 0.05, m.z, 0.5, 1.2, passo, escolhe(PEDRA), 0.04, giro);
        if (i % 3 === 1) {
          pedra.add(m.x, y + 0.325, m.z, 0.74, 1.75, 0.74, escolhe(PEDRA), 0.03, giro);
          lanterna(m.x, y + 1.27, m.z);
        }
      }
      const b = naRampa(ao, 0);
      if (ao < esc.comp - 0.5)
        encosta.add(b.x, y - 0.85, b.z, e.meia * 2 + 0.3, 0.6, passo, escolhe(ROCHA), 0.05, giro);
      if (i % 5 === 2) encosta.add(b.x, y - 3.6, b.z, 3.6, 5, 1.7, escolhe(ROCHA), 0.05, giro);
    }
    for (const p of pilaresDaEscadaria(e)) {
      pedra.base(p.x, 0, p.z, 1.05, 2.3, 1.05, escolhe(PEDRA), 0.04);
      lanterna(p.x, 2.3, p.z);
      sombras.push({ x: p.x, z: p.z, rx: 0.85, rz: 0.85 });
    }
    for (const l of [-1, 1]) {
      pedra.base(
        e.topo.x + l * (e.meia + 1.5),
        H,
        ilhaZ1 - 0.5,
        1.05,
        2.3,
        1.05,
        escolhe(PEDRA),
        0.04,
      );
      lanterna(e.topo.x + l * (e.meia + 1.5), H + 2.3, ilhaZ1 - 0.5);
    }
  };
  {
    const I = ILHA_EM_BREVE;
    const H = I.y;
    ilhaRetangular(I, H, 7);
    escadaria(PONTE_EM_BREVE, H, I.z1);
    for (let x = PONTE_EM_BREVE.topo.x - 2.5; x < PONTE_EM_BREVE.topo.x + 2.6; x++)
      for (let z = PORTAO_EM_BREVE.z1 + 0.5; z < I.z1; z++)
        piso3d.base(x, H, z, 1, 0.06, 1, escolhe(PEDRA), 0.04);
    const G = PORTAO_EM_BREVE;
    const gx = (G.x0 + G.x1) / 2;
    const gz = (G.z0 + G.z1) / 2;
    for (let x = G.x0 + 0.3; x < G.x1; x += 0.6)
      for (let y = 0; y < 4.8; y += 0.6) {
        const porta = Math.abs(x - gx) < 1.6 && y < 3.0;
        if (!porta) pedra.base(x, H + y, G.z1 - 0.3, 0.6, 0.6, 0.6, escolhe(PEDRA), 0.05);
        pedra.base(x, H + y, G.z0 + 0.3, 0.6, 0.6, 0.6, escolhe(PEDRA), 0.05);
      }
    for (let z = G.z0 + 0.9; z < G.z1 - 0.5; z += 0.6)
      for (let y = 0; y < 4.8; y += 0.6)
        for (const xx of [G.x0 + 0.3, G.x1 - 0.3])
          pedra.base(xx, H + y, z, 0.6, 0.6, 0.6, escolhe(PEDRA), 0.05);
    pedra.base(gx, H, G.z1 - 0.62, 3.2, 3.0, 0.2, 0x24262b, 0);
    for (let k = 0; k < 3; k++)
      pedra.base(
        gx,
        H + 4.8 + k * 0.5,
        gz,
        G.x1 - G.x0 + 0.6 - k * 2.6,
        0.5,
        G.z1 - G.z0 + 0.6 - k * 0.8,
        escolhe(PEDRA),
        0.04,
      );
    for (let x = -1.5; x < 1.55; x += 0.3)
      pedra.base(
        gx + x + 0.15,
        H,
        G.z1 + 0.15,
        0.3,
        0.24,
        0.12,
        Math.round((x + 1.5) / 0.3) % 2 ? 0x1d1a17 : 0xffc933,
        0,
      );
    pedra.base(gx, H + 1.0, G.z1 - 0.46, 0.62, 0.56, 0.14, 0xe7b334, 0.02);
    pedra.base(gx, H + 1.56, G.z1 - 0.46, 0.4, 0.32, 0.08, 0xc8c8cc, 0.02);
    pedra.base(gx, H + 1.12, G.z1 - 0.38, 0.09, 0.2, 0.04, 0x1d1a17, 0);
    for (const l of [-1, 1]) {
      madeira.base(gx + l * 2.6, H + 0.9, G.z1 + 0.02, 0.9, 2.2, 0.06, 0xc8231c, 0.03);
      madeira.base(gx + l * 2.6, H + 2.0, G.z1 + 0.06, 0.5, 0.1, 0.04, 0xf6f1e4, 0, l * 0.7);
      madeira.base(gx + l * 2.6, H + 2.0, G.z1 + 0.06, 0.5, 0.1, 0.04, 0xf6f1e4, 0, -l * 0.7);
      aceso.base(gx + l * 3.4, H + 4.85, G.z1 - 0.1, 0.26, 0.26, 0.26, 0xff3b30, 0);
      brilhos.push([gx + l * 3.4, H + 5.0, G.z1 - 0.1]);
      for (let y = 0.4; y < 4.2; y += 0.5)
        folhas.base(gx + l * 4.9, H + y, G.z1 + 0.05, 0.5, 0.5, 0.2, escolhe(GRAMA_ESCURA), 0.07);
    }
    placas.push({
      tex: texturaDePlaca(THREE, ["EM BREVE"], {
        fundo: "#3a3c42",
        borda: "#9a9aa2",
        cor: "#ffffff",
        largura: 512,
        altura: 120,
      }),
      x: gx,
      y: H + 3.75,
      z: G.z1 + 0.04,
      w: 3.4,
      h: 0.8,
    });
    for (const C of CANTEIROS_EM_BREVE) {
      for (let x = C.x0 + 0.5; x < C.x1; x++)
        for (const zz of [C.z0 + 0.2, C.z1 - 0.2])
          pedra.base(x, H, zz, 1, 0.45, 0.4, escolhe(PEDRA), 0.04);
      for (let x = C.x0 + 0.7; x < C.x1 - 0.4; x += 1.4)
        for (let z = C.z0 + 1.0; z < C.z1 - 0.6; z += 1.4)
          arbusto(folhas, x, z, 0.8, { y: H, flor: escolhe(FLORES) });
    }
    for (const p of POSTES_EM_BREVE) poste(p.x, p.z, H, 2.3);
    for (const a of ARVORES_EM_BREVE) {
      arvore(folhas, a.x, a.z, { tipo: a.tipo, y: H }, madeira);
      sombras.push({ x: a.x, z: a.z, y: H + 0.03, rx: 1.15, rz: 1.15 });
    }
    sombras.push({ x: gx, z: gz, y: H + 0.03, rx: 6, rz: 3 });
  }

  // ---------------- HOST FAZENDAS: escadaria-ponte larga, ilha no alto e o celeiro com o portal ----------------
  {
    const I = ILHA_FAZENDAS;
    const P = PONTE_FAZENDAS;
    const C = CELEIRO;
    const H = I.y;
    const cx = (I.x0 + I.x1) / 2;
    const cz = (I.z0 + I.z1) / 2;
    const larg = I.x1 - I.x0;
    const fund = I.z1 - I.z0;
    const PEDRA_PONTE = [0xcfc7b8, 0xc2baab, 0xd9d2c4] as const;
    const TRIGO = [0xf2c230, 0xe8b020, 0xf8d44a, 0xdca018] as const;
    const CELEIRO_COR = [0xc8402f, 0xb93629, 0xd04a38] as const;
    const TELHA = [0x8a5a3a, 0x7a4a2e, 0x96643f] as const;
    const TORA = 0x6e4a2b;
    const BRANCO = 0xf6f1e4;
    /** Lanterna: caixinha acesa com tampa e o ponto de luz que brilha à noite. */
    const lanterna = (x: number, y: number, z: number) => {
      aceso.base(x, y, z, 0.34, 0.4, 0.34, 0xffc670, 0);
      madeira.base(x, y + 0.4, z, 0.48, 0.1, 0.48, FERRO, 0);
      lampadas.push([x, y + 0.25, z]);
    };
    /** Pilar de pedra com capitel e lanterna em cima. */
    const pilar = (x: number, y: number, z: number, alt: number, lado = 1.05) => {
      pedra.base(x, y, z, lado, alt, lado, escolhe(PEDRA_PONTE), 0.04);
      pedra.base(x, y + alt, z, lado + 0.22, 0.18, lado + 0.22, PEDRA_PONTE[1], 0.02);
      lanterna(x, y + alt + 0.18, z);
    };

    // corpo da ilha: terra e rocha afinando para baixo, com pedras penduradas na frente
    for (let k = 1; k <= 6; k++) {
      const f = 1 - k * 0.14;
      encosta.base(
        cx + (k % 2 ? 0.5 : -0.4),
        H - 0.4 - k * 1.15,
        cz + (k % 2 ? -0.3 : 0.4),
        larg * f,
        1.15,
        fund * f,
        escolhe(k < 3 ? TERRA : ROCHA),
        0.05,
      );
    }
    for (let n = 0; n < 16; n++)
      encosta.base(
        I.x0 + 1 + r() * (larg - 2),
        H - 1.6 - r() * 3.2,
        (n % 2 ? I.z1 - 0.2 : I.z0 + 0.2) + (r() - 0.5),
        1.3 + r() * 1.7,
        0.9 + r() * 1.3,
        1.3,
        escolhe(n % 3 ? ROCHA : TERRA),
        0.05,
      );
    // gramado, com a avenida calçada do topo da escadaria até a porta do celeiro
    const naAvenida = (x: number, z: number) =>
      (Math.abs(x - P.topo.x) < 2.7 && z > C.z1) ||
      (z > C.z1 && z < -42.3 && Math.abs(x - P.topo.x) < 5.4);
    for (let x = I.x0 + 0.5; x < I.x1; x++)
      for (let z = I.z0 + 0.5; z < I.z1; z++)
        if (naAvenida(x, z)) piso3d.base(x, H - 0.4, z, 1, 0.4, 1, escolhe(PAVE), 0.04);
        else chao.base(x, H - 0.4, z, 1, 0.4, 1, escolhe(GRAMA), 0.05);

    // escadaria-ponte em diagonal: degraus largos, muretas grossas, pilares com lanterna e apoios de pedra por baixo
    const esc = naEscadaria(0, 0);
    const giro = Math.atan2(esc.ux, esc.uz);
    /** Ponto do mundo a `ao` do pé, ao longo da escadaria, e `lado` para o lado do eixo. */
    const naRampa = (ao: number, lado: number) => ({
      x: P.pe.x + esc.ux * ao + esc.uz * lado,
      z: P.pe.z + esc.uz * ao - esc.ux * lado,
    });
    const N = 22;
    const passo = (esc.comp + 1.4) / N;
    for (let i = 0; i < N; i++) {
      const ao = (i + 0.5) * passo;
      // sobe até a altura da ilha e termina num patamar (um fio acima do gramado, para não piscar)
      const y = Math.min(H + 0.03, (H * ao) / (esc.comp - 1.2));
      for (const lado of [-1.47, 0, 1.47]) {
        const c = naRampa(ao, lado);
        piso3d.add(c.x, y - 0.275, c.z, 1.47, 0.55, passo, escolhe(PAVE), 0.04, giro);
      }
      for (const l of [-1, 1]) {
        const m = naRampa(ao, l * (P.meia + 0.25));
        pedra.add(m.x, y + 0.05, m.z, 0.5, 1.2, passo, escolhe(PEDRA_PONTE), 0.04, giro);
        if (i % 3 === 1) {
          pedra.add(m.x, y + 0.325, m.z, 0.74, 1.75, 0.74, escolhe(PEDRA_PONTE), 0.03, giro);
          pedra.add(m.x, y + 1.27, m.z, 0.9, 0.14, 0.9, PEDRA_PONTE[1], 0.02, giro);
          lanterna(m.x, y + 1.34, m.z);
        }
      }
      const b = naRampa(ao, 0);
      if (ao < esc.comp - 0.5)
        encosta.add(b.x, y - 0.85, b.z, P.meia * 2 + 0.3, 0.6, passo, escolhe(ROCHA), 0.05, giro);
      if (i % 5 === 2) {
        encosta.add(b.x, y - 3.6, b.z, 3.6, 5, 1.7, escolhe(ROCHA), 0.05, giro);
        encosta.add(b.x, y - 7.6, b.z, 2.3, 3, 1.2, escolhe(ROCHA), 0.05, giro);
      }
    }
    // pilares grandes no pé (na praça) e no topo (na ilha)
    for (const p of PILARES_DA_ESCADARIA) {
      pilar(p.x, 0, p.z, 2.3);
      sombras.push({ x: p.x, z: p.z, rx: 0.85, rz: 0.85 });
      clarao.push({ x: p.x, z: p.z + 1, rx: 2.3, rz: 2.3 });
    }
    for (const l of [-1, 1]) pilar(P.topo.x + l * (P.meia + 1.5), H, I.z1 - 0.5, 2.3);

    // celeiro: base de pedra, paredes de tábuas vermelhas, cantos brancos e telhado em degraus
    const bx = (C.x0 + C.x1) / 2;
    const bz = (C.z0 + C.z1) / 2;
    const W = C.x1 - C.x0;
    const D = C.z1 - C.z0;
    const PAREDE = 5.2;
    const VAO = 2.7; // meia largura do vão da porta (o batente fica por dentro)
    for (const l of [-1, 1])
      pedra.base(
        bx + l * (VAO + (W / 2 - VAO) / 2),
        H,
        bz,
        W / 2 - VAO + 0.3,
        0.45,
        D + 0.3,
        escolhe(PEDRA_PONTE),
        0.04,
      );
    for (let x = C.x0 + 0.45; x < C.x1; x += 0.9) {
      const naPorta = Math.abs(x - bx) < VAO;
      if (!naPorta)
        madeira.base(x, H + 0.45, C.z1 - 0.2, 0.9, PAREDE - 0.45, 0.4, escolhe(CELEIRO_COR), 0.04);
      madeira.base(x, H + 0.45, C.z0 + 0.2, 0.9, PAREDE - 0.45, 0.4, escolhe(CELEIRO_COR), 0.04);
    }
    for (let z = C.z0 + 0.65; z < C.z1 - 0.3; z += 0.9)
      for (const l of [-1, 1])
        madeira.base(
          bx + l * (W / 2 - 0.2),
          H + 0.45,
          z,
          0.4,
          PAREDE - 0.45,
          0.9,
          escolhe(CELEIRO_COR),
          0.04,
        );
    // fundo escuro atrás do portal, batente de toras e o fio de luz azul por dentro
    pedra.base(bx, H, C.z1 - 1.4, VAO * 2 + 0.4, PAREDE, 0.3, 0x0a1230, 0);
    for (const l of [-1, 1]) {
      madeira.base(bx + l * (VAO - 0.2), H, C.z1 + 0.05, 0.44, 5.0, 0.55, TORA, 0.05);
      aceso.base(bx + l * (VAO - 0.46), H + 0.1, C.z1 - 0.12, 0.08, 4.8, 0.08, 0x6fd8ff, 0);
      madeira.base(
        bx + l * (W / 2 - 0.05),
        H + 0.45,
        C.z1 - 0.08,
        0.36,
        PAREDE - 0.45,
        0.5,
        BRANCO,
        0.02,
      );
      // painel branco em X de cada lado da porta
      const x0 = bx + l * (VAO + 0.35);
      const x1 = bx + l * (W / 2 - 0.5);
      const meio = (x0 + x1) / 2;
      const vao = Math.abs(x1 - x0);
      for (const yy of [1.0, 3.9])
        madeira.base(meio, H + yy, C.z1 + 0.04, vao, 0.2, 0.12, BRANCO, 0.02);
      for (const xx of [x0, x1])
        madeira.base(xx, H + 1.0, C.z1 + 0.04, 0.2, 3.1, 0.12, BRANCO, 0.02);
      for (let k = 0; k < 7; k++) {
        const f = (k + 0.5) / 7;
        for (const s of [f, 1 - f])
          madeira.base(
            Math.min(x0, x1) + s * vao,
            H + 1.2 + f * 2.7 - 0.2,
            C.z1 + 0.04,
            0.3,
            0.42,
            0.1,
            BRANCO,
            0.02,
          );
      }
      // pilares de pedra com lanterna, guardando a porta
      pilar(bx + l * 3.45, H, C.z1 + 0.8, 2.7);
      clarao.push({ x: bx + l * 3.45, z: C.z1 + 1.6, y: H + 0.03, rx: 2.2, rz: 2.2 });
    }
    madeira.base(bx, H + 5.0, C.z1 + 0.05, VAO * 2 + 0.5, 0.46, 0.6, TORA, 0.05);
    aceso.base(bx, H + 4.9, C.z1 - 0.12, VAO * 2 - 1.0, 0.08, 0.08, 0x6fd8ff, 0);
    let yTelhado = H + PAREDE;
    for (const [w, h] of [
      [W, 0.9],
      [9.4, 0.9],
      [7.6, 0.9],
      [5.2, 0.8],
      [2.6, 0.7],
    ] as const) {
      for (const zz of [C.z1 - 0.2, C.z0 + 0.2])
        madeira.base(bx, yTelhado, zz, w, h, 0.4, escolhe(CELEIRO_COR), 0.04);
      for (const l of [-1, 1])
        madeira.base(
          bx + l * (w / 2 + 0.2),
          yTelhado - 0.1,
          bz,
          0.4,
          h + 0.1,
          D + 1.1,
          escolhe(TELHA),
          0.05,
        );
      madeira.base(bx, yTelhado + h, bz, w + 0.8, 0.24, D + 1.1, escolhe(TELHA), 0.05);
      yTelhado += h;
    }
    sombras.push({ x: bx, z: bz, y: H + 0.03, rx: W / 2 + 0.8, rz: D / 2 + 0.8 });

    // trigais dourados, com terra batida embaixo e uma cerquinha em volta
    for (const T of TRIGAIS) {
      madeira.base(
        (T.x0 + T.x1) / 2,
        H,
        (T.z0 + T.z1) / 2,
        T.x1 - T.x0,
        0.12,
        T.z1 - T.z0,
        0x8a5a3a,
        0.04,
      );
      for (let x = T.x0 + 0.3; x < T.x1 - 0.1; x += 0.5)
        for (let z = T.z0 + 0.3; z < T.z1 - 0.1; z += 0.5)
          folhas.base(
            x + (r() - 0.5) * 0.12,
            H + 0.1,
            z + (r() - 0.5) * 0.12,
            0.36,
            0.65 + r() * 0.55,
            0.36,
            escolhe(TRIGO),
            0.06,
          );
      for (const zz of [T.z0 - 0.1, T.z1 + 0.1]) {
        madeira.base(
          (T.x0 + T.x1) / 2,
          H + 0.45,
          zz,
          T.x1 - T.x0 + 0.3,
          0.1,
          0.1,
          escolhe(MADEIRA),
          0.04,
        );
        for (let x = T.x0 - 0.1; x <= T.x1 + 0.11; x += (T.x1 - T.x0 + 0.2) / 4)
          madeira.base(x, H, zz, 0.16, 0.7, 0.16, escolhe(MADEIRA), 0.04);
      }
    }
    // abóboras na beira dos trigais
    for (const [x, z] of [
      [-24.9, -36.4],
      [-24.8, -40.9],
      [-17.1, -36.6],
      [-17.2, -41.1],
    ] as const) {
      folhas.base(x, H, z, 0.46, 0.36, 0.46, 0xf08a24, 0.05);
      folhas.base(x, H + 0.36, z, 0.1, 0.12, 0.1, 0x3f8f2f, 0);
    }
    // galpãozinho vermelho
    {
      const G = GALPAO;
      const gx = (G.x0 + G.x1) / 2;
      const gz = (G.z0 + G.z1) / 2;
      madeira.base(gx, H, gz, G.x1 - G.x0, 1.9, G.z1 - G.z0, CELEIRO_COR[0], 0.04);
      madeira.base(gx, H, G.z1 + 0.02, 0.8, 1.3, 0.06, BRANCO, 0.02);
      madeira.base(gx, H + 0.1, G.z1 + 0.05, 0.56, 1.1, 0.06, CELEIRO_COR[1], 0.02);
      madeira.base(gx, H + 1.9, gz, G.x1 - G.x0 + 0.5, 0.3, G.z1 - G.z0 + 0.5, TELHA[0], 0.04);
      madeira.base(gx, H + 2.2, gz, G.x1 - G.x0 - 0.6, 0.3, G.z1 - G.z0 + 0.5, TELHA[1], 0.04);
      madeira.base(gx, H + 2.5, gz, 0.8, 0.26, G.z1 - G.z0 + 0.5, TELHA[2], 0.04);
      sombras.push({ x: gx, z: gz, y: H + 0.03, rx: 1.7, rz: 1.5 });
    }
    // moinho: torre de pedra que afina e o chapéu de madeira (as pás giram, à parte)
    {
      const { x, z } = MOINHO;
      [1.9, 1.6, 1.3, 1.05].forEach((lado, k) =>
        pedra.base(x, H + k * 1.4, z, lado, 1.4, lado, escolhe(PEDRA_PONTE), 0.04),
      );
      madeira.base(x, H, z + 0.96, 0.6, 1.1, 0.06, TORA, 0.03);
      madeira.base(x, H + 5.6, z, 1.5, 0.5, 1.5, TELHA[0], 0.04);
      madeira.base(x, H + 6.1, z, 0.9, 0.4, 0.9, TELHA[1], 0.04);
      madeira.base(x, H + 4.75, z + 0.75, 0.3, 0.3, 0.7, TORA, 0.03);
      sombras.push({ x, z, y: H + 0.03, rx: 1.5, rz: 1.5 });
    }
    // fardos de feno
    {
      const F = FARDOS;
      const fz = (F.z0 + F.z1) / 2;
      for (const [x, y] of [
        [F.x0 + 0.6, 0],
        [F.x1 - 0.6, 0],
        [(F.x0 + F.x1) / 2, 0.72],
      ] as const) {
        folhas.base(x, H + y, fz, 1.08, 0.72, 1.3, TRIGO[1], 0.05);
        for (const dz of [-0.36, 0.36])
          madeira.base(x, H + y, fz + dz, 1.12, 0.74, 0.08, 0xb88a18, 0);
      }
    }
    // cerca de madeira na beirada (aberta onde chega a escadaria)
    const cerca = (x0: number, z0: number, x1: number, z1: number) => {
      const comp = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(comp / 1.6));
      const noX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      for (let k = 0; k <= n; k++)
        madeira.base(
          x0 + ((x1 - x0) * k) / n,
          H,
          z0 + ((z1 - z0) * k) / n,
          0.18,
          0.8,
          0.18,
          escolhe(MADEIRA),
          0.04,
        );
      for (const yy of [0.3, 0.6])
        madeira.base(
          (x0 + x1) / 2,
          H + yy,
          (z0 + z1) / 2,
          noX ? comp : 0.09,
          0.09,
          noX ? 0.09 : comp,
          escolhe(MADEIRA),
          0.04,
        );
    };
    const B = 0.4;
    cerca(I.x0 + B, I.z1 - B, P.topo.x - P.meia - 2.1, I.z1 - B);
    cerca(P.topo.x + P.meia + 2.1, I.z1 - B, I.x1 - B, I.z1 - B);
    cerca(I.x0 + B, I.z0 + B, I.x0 + B, I.z1 - B);
    cerca(I.x1 - B, I.z0 + B, I.x1 - B, I.z1 - B);
    cerca(I.x0 + B, I.z0 + B, I.x1 - B, I.z0 + B);
    // postes de luz na avenida e as árvores
    for (const p of POSTES_FAZENDAS) {
      madeira.base(p.x, H, p.z, 0.16, 2.3, 0.16, FERRO, 0);
      madeira.base(p.x, H, p.z, 0.34, 0.2, 0.34, FERRO, 0);
      lanterna(p.x, H + 2.3, p.z);
      sombras.push({ x: p.x, z: p.z, y: H + 0.03, rx: 0.45, rz: 0.45 });
      clarao.push({ x: p.x, z: p.z, y: H + 0.03, rx: 2.6, rz: 2.6 });
    }
    for (const a of ARVORES_FAZENDAS) {
      arvore(
        folhas,
        a.x,
        a.z,
        { tipo: a.tipo, y: H, ...(a.tipo === "copinha" ? { cor: "amarelo" as const } : {}) },
        madeira,
      );
      sombras.push({ x: a.x, z: a.z, y: H + 0.03, rx: 1.15, rz: 1.15 });
    }
  }

  // =====================================================================
  // NUVEM DO BERÇO (sul) e o ESCORREGADOR turquesa até a plataforma da praça
  // =====================================================================
  {
    const { x: bx, y: by, z: bz } = BERCO;
    const { meiaX, meiaZ } = DECK_DO_BERCO;
    const NUVEM = [0xffffff, 0xf8fbff, 0xf0f5ff] as const;
    const SOMBRA_NUVEM = [0xdfe8f8, 0xd4e0f4, 0xe6edfa] as const;
    for (let x = -meiaX - 1.2; x <= meiaX + 1.21; x += 0.8)
      for (let z = -meiaZ - 1.2; z <= meiaZ + 1.21; z += 0.8) {
        const v =
          Math.pow(Math.abs(x) / (meiaX + 1.4), 2.2) + Math.pow(Math.abs(z) / (meiaZ + 1.4), 2.2);
        if (v > 1) continue;
        const cama = Math.abs(x) <= meiaX && Math.abs(z) <= meiaZ;
        const alto = cama ? 0 : 0.25 + (1 - v) * 0.5 + r() * 0.35;
        nuvem.add(
          bx + x,
          by - 0.2 + alto / 2,
          bz + z,
          0.82,
          0.42 + alto,
          0.82,
          escolhe(NUVEM),
          0.012,
        );
        for (let k = 1; k <= 4; k++)
          if (v < 1 - k * 0.2)
            nuvem.add(
              bx + x,
              by - 0.2 - k * 0.55,
              bz + z,
              0.82,
              0.6,
              0.82,
              escolhe(SOMBRA_NUVEM),
              0.012,
            );
      }
    for (const [dx, dz, t] of [
      [-3.4, 4.1, 1.6],
      [-0.6, 4.6, 2.1],
      [2.4, 4.3, 1.8],
      [5.2, 2.6, 1.4],
      [-5.5, 2.4, 1.3],
      [5.6, -1.6, 1.1],
      [-5.8, -1.8, 1.0],
    ] as const)
      nuvem.add(bx + dx, by + t / 2 - 0.1, bz + dz, t * 1.2, t, t, escolhe(NUVEM), 0.012);
    for (const v of VAGAS) nuvem.add(v.x, v.y - 0.06, v.z - 0.34, 0.62, 0.12, 0.3, 0xcfe6ff, 0.01);
  }
  const tAguaCalha = texturaAgua(THREE, 11);
  tAguaCalha.wrapS = tAguaCalha.wrapT = THREE.RepeatWrapping;
  {
    const pts = PONTOS_DO_ESCORREGADOR;
    const R = 0.55;
    const LADOS = 12;
    const pos: number[] = [];
    const nor: number[] = [];
    const posA: number[] = [];
    const uvA: number[] = [];
    const idx: number[] = [];
    const idxA: number[] = [];
    let v = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(pts.length - 1, i + 1)]!;
      const n = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const lx = -(b.z - a.z) / n;
      const lz = (b.x - a.x) / n;
      if (i > 0) v += Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y, p.z - pts[i - 1]!.z);
      for (let k = 0; k <= LADOS; k++) {
        const ang = Math.PI + (k / LADOS) * Math.PI;
        const cx = Math.cos(ang);
        const cy = Math.sin(ang);
        pos.push(p.x + lx * cx * R, p.y + 0.42 + cy * R, p.z + lz * cx * R);
        nor.push(-lx * cx, -cy, -lz * cx);
      }
      posA.push(
        p.x + lx * 0.32,
        p.y + 0.02,
        p.z + lz * 0.32,
        p.x - lx * 0.32,
        p.y + 0.02,
        p.z - lz * 0.32,
      );
      uvA.push(0, v * 0.8, 1, v * 0.8);
      if (i > 0) {
        const base = (i - 1) * (LADOS + 1);
        for (let k = 0; k < LADOS; k++) {
          const q = base + k;
          idx.push(q, q + LADOS + 1, q + 1, q + 1, q + LADOS + 1, q + LADOS + 2);
        }
        const kk = i * 2;
        idxA.push(kk - 2, kk - 1, kk, kk - 1, kk + 1, kk);
      }
    });
    const gCalha = new THREE.BufferGeometry();
    gCalha.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    gCalha.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    gCalha.setIndex(idx);
    const mCalha = new THREE.MeshPhysicalMaterial({
      color: 0x3fd0e6,
      roughness: 0.18,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      emissive: 0x0b7c96,
      emissiveIntensity: 0.25,
    });
    const calha = new THREE.Mesh(gCalha, mCalha);
    calha.castShadow = true;
    grupo.add(calha);
    const gAguaCalha = new THREE.BufferGeometry();
    gAguaCalha.setAttribute("position", new THREE.Float32BufferAttribute(posA, 3));
    gAguaCalha.setAttribute("uv", new THREE.Float32BufferAttribute(uvA, 2));
    gAguaCalha.setIndex(idxA);
    gAguaCalha.computeVertexNormals();
    const mAguaCalha = new THREE.MeshBasicMaterial({
      map: tAguaCalha,
      color: 0xc8f6ff,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    grupo.add(new THREE.Mesh(gAguaCalha, mAguaCalha));
    lixo.push(gCalha, mCalha, gAguaCalha, mAguaCalha, tAguaCalha);
    pts.forEach((p, i) => {
      if (i % 8 !== 4 || p.z > beiradaEmZ(p.x) - 0.3 || p.z < PLATAFORMA.z + 1.6) return;
      pedra.base(p.x, 0, p.z, 0.22, p.y, 0.22, 0xf6f1e4, 0.01);
      sombras.push({ x: p.x, z: p.z, rx: 0.4, rz: 0.4 });
    });
  }
  // plataforma redonda e brilhante onde o escorregador chega
  {
    const { x, z, r: R } = PLATAFORMA;
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      piso3d.base(
        x + Math.cos(a) * (R + 0.3),
        0,
        z + Math.sin(a) * (R + 0.3),
        0.7,
        0.3,
        0.62,
        escolhe(PEDRA_CLARA),
        0.03,
        -a,
      );
      aceso.base(
        x + Math.cos(a) * (R - 0.2),
        0.02,
        z + Math.sin(a) * (R - 0.2),
        0.32,
        0.06,
        0.5,
        0x6fd8ff,
        0,
        -a,
      );
    }
    for (let k = 0; k < 6; k++) brilhos.push([x + Math.cos(k) * 1.2, 0.6, z + Math.sin(k) * 1.2]);
    clarao.push({ x, z, rx: 3.2, rz: 3.2 });
  }

  // =====================================================================
  // CONSTRUIR OS BLOCOS
  // =====================================================================
  const conjuntos = [
    chao.construir(THREE, {
      sombra: false,
      acabamento: { chanfro: 0.035, junta: 0.07, pe: 0, grao: 0.05, nevoa: NEVOA },
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
    nuvem.construir(THREE, {
      sombra: false,
      material: acabamento(
        new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0x9fb8e0,
          emissiveIntensity: 0.4,
        }),
        { chanfro: 0.2, junta: 0.02, pe: 0.05, grao: 0.012 },
      ),
    }),
  ];
  for (const c of conjuntos) {
    grupo.add(c.malha);
    lixo.push({ dispose: c.descartar });
  }
  for (const p of placas) {
    const g = new THREE.PlaneGeometry(p.w, p.h);
    const m = new THREE.MeshBasicMaterial({
      map: p.tex,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const malha = new THREE.Mesh(g, m);
    malha.position.set(p.x, p.y, p.z);
    malha.rotation.y = p.giro ?? 0;
    grupo.add(malha);
    lixo.push(g, m, p.tex);
  }

  // ---------------- sombras de contato, luz das lanternas no piso e brilhos ----------------
  const tMancha = texturaMancha(THREE);
  const tBrilho = texturaMancha(THREE, 0.08);
  const contato = criarManchas(THREE, tMancha, sombras, { cor: 0x1d150c, forca: 0.4 });
  const luzPiso = criarManchas(THREE, tMancha, clarao, { cor: 0xffc77a, forca: 0.15, soma: true });
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
      g.attributes["color"]!.needsUpdate = true;
    };
  };

  // ---------------- HOST FAZENDAS: logo 3D no celeiro, redemoinho do portal, brilhos e as pás do moinho ----------------
  const yFazendas = ILHA_FAZENDAS.y;
  const xCeleiro = (CELEIRO.x0 + CELEIRO.x1) / 2;
  const logoFazendas = new THREE.Group();
  logoFazendas.position.set(xCeleiro, yFazendas + 5.6, CELEIRO.z1 + 0.6);
  {
    // placa de tábuas com rebites, o galo espiando por cima, o celeirinho, o trigo e as folhas
    const base = new Blocos(r);
    base.base(0, -0.12, -0.14, 9.3, 3.56, 0.3, 0x6e4420, 0.03);
    (
      [
        [8.3, 0xb97a38],
        [8.9, 0xc98a44],
        [8.1, 0xb07434],
      ] as const
    ).forEach(([w, cor], k) => base.base(0, k * 1.1, 0.02, w, 1.08, 0.4, cor, 0.05));
    for (const sx of [-1, 1])
      for (const yy of [0.35, 2.85]) base.base(sx * 3.85, yy, 0.24, 0.18, 0.18, 0.1, 0xb9bcc2, 0);
    // galo: corpo, cabeça, crista, bico, barbela, olhos, asa apoiada na placa e o rabo vermelho
    const G = -3.0;
    const GY = 3.0;
    const PENA = 0xfbf7ee;
    const CRISTA = 0xe02a20;
    base.base(G, GY - 0.2, 0, 1.7, 1.3, 0.7, PENA, 0.03);
    base.base(G + 0.35, GY + 1.0, 0.05, 1.05, 1.05, 0.8, PENA, 0.03);
    base.base(G + 1.05, 3.12, 0.3, 0.8, 0.42, 0.5, PENA, 0.03);
    (
      [
        [0.05, 0.45],
        [0.38, 0.62],
        [0.7, 0.4],
      ] as const
    ).forEach(([dx, h]) => base.base(G + dx, GY + 2.05, 0.05, 0.3, h, 0.3, CRISTA, 0.03));
    base.base(G + 1.08, GY + 1.45, 0.12, 0.52, 0.24, 0.42, 0xffc21a, 0.02);
    base.base(G + 1.02, GY + 1.26, 0.12, 0.38, 0.18, 0.36, 0xf09a10, 0.02);
    base.base(G + 0.82, GY + 0.82, 0.32, 0.34, 0.44, 0.3, CRISTA, 0.03);
    for (const dx of [0.14, 0.58]) {
      base.base(G + dx, GY + 1.5, 0.44, 0.3, 0.36, 0.06, 0xffffff, 0);
      base.base(G + dx + 0.04, GY + 1.54, 0.48, 0.15, 0.2, 0.04, 0x1d1a17, 0);
    }
    (
      [
        [-1.1, 0.1, 1.0],
        [-1.5, 0.5, 1.15],
        [-1.9, 0.15, 0.9],
        [-1.32, 1.45, 0.55],
      ] as const
    ).forEach(([dx, dy, h], k) =>
      base.base(G + dx, GY + dy, -0.05, 0.5, h, 0.36, k % 2 ? 0xc82018 : CRISTA, 0.04),
    );
    // celeirinho atrás, no meio
    base.base(1.0, 3.3, -0.12, 2.6, 1.3, 0.44, 0xc8402f, 0.03);
    base.base(1.0, 3.42, 0.1, 0.96, 0.96, 0.06, 0xf6f1e4, 0.02);
    base.base(1.0, 3.54, 0.14, 0.7, 0.7, 0.04, 0xc8402f, 0.02);
    base.base(1.0, 3.82, 0.16, 0.7, 0.14, 0.04, 0xf6f1e4, 0);
    base.base(1.0, 3.54, 0.16, 0.14, 0.7, 0.04, 0xf6f1e4, 0);
    base.base(1.0, 4.6, -0.12, 3.0, 0.26, 0.6, 0x8a5a3a, 0.04);
    base.base(1.0, 4.86, -0.12, 2.2, 0.3, 0.6, 0x7a4a2e, 0.04);
    base.base(1.0, 5.16, -0.12, 1.2, 0.26, 0.6, 0x96643f, 0.04);
    // espigas de trigo à direita e folhas dos lados
    for (let e = 0; e < 3; e++)
      for (let k = 0; k < 5; k++)
        base.base(
          3.3 + e * 0.42 + k * 0.09,
          3.2 + k * 0.3 + (e % 2) * 0.2,
          0,
          0.28,
          0.3,
          0.28,
          k % 2 ? 0xf2c230 : 0xe0a820,
          0.04,
        );
    for (const sx of [-1, 1])
      (
        [
          [4.55, 0.5],
          [4.85, 1.0],
          [4.6, 1.55],
        ] as const
      ).forEach(([x, y], k) =>
        base.base(sx * x, y, -0.02, 0.8, 0.38, 0.3, k % 2 ? 0x3f9a30 : 0x58b83c, 0.05),
      );
    const mBase = base.construir(THREE, {
      acabamento: { chanfro: 0.03, junta: 0.16, pe: 0.1, grao: 0.06 },
    });
    logoFazendas.add(mBase.malha);
    lixo.push({ dispose: mBase.descartar });
    // letras gordas: "HOST" verde em cima e "FAZENDAS" azul embaixo, cada uma com o contorno escuro atrás
    const palavra = (
      texto: string,
      u: number,
      y: number,
      cores: readonly number[],
      contorno: number,
    ) => {
      (
        [
          [1, [contorno], 0.34, 0.2],
          [0, cores, 0.5, 0.22],
        ] as const
      ).forEach(([engorda, tons, frente, fundo]) => {
        const b = new Blocos(r);
        letrasDePedra(b, texto, u, fundo, {
          linhas: 12,
          relevo: 0.25,
          cores: tons,
          engorda,
          z: frente,
        });
        const m = b.construir(THREE, {
          recebe: false,
          sombra: false,
          material: new THREE.MeshBasicMaterial({ toneMapped: false }),
        });
        m.malha.position.y = y - engorda * u;
        logoFazendas.add(m.malha);
        lixo.push({ dispose: m.descartar });
      });
    };
    palavra("HOST", 0.118, 1.78, [0x7be832, 0x66d824, 0x8cf040, 0x72e02c], 0x1c7a1a);
    palavra("FAZENDAS", 0.098, 0.3, [0x35b6ff, 0x2aa6f5, 0x55c6ff, 0x3cbcff], 0x1746a8);
  }
  grupo.add(logoFazendas);

  // redemoinho do portal: espiral azul girando dentro da porta do celeiro
  const uPortal = { uT: { value: 0 } };
  const mRedemoinho = new THREE.ShaderMaterial({
    uniforms: uPortal,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uT;
      void main() {
        vec2 p = (vUv - 0.5) * vec2(1.0, 1.06);
        float raio = length(p) * 2.0;
        float ang = atan(p.y, p.x);
        // dois braços de espiral girando em sentidos diferentes e um miolo que pulsa
        float a = sin(ang * 3.0 + raio * 9.0 - uT * 2.4);
        float b = sin(ang * 5.0 - raio * 15.0 + uT * 1.5);
        float bracos = smoothstep(-0.1, 1.0, a) * 0.65 + smoothstep(0.35, 1.0, b) * 0.4;
        vec3 fundo = mix(vec3(0.01, 0.05, 0.32), vec3(0.03, 0.34, 0.9), clamp(1.0 - raio * 0.8, 0.0, 1.0));
        vec3 cor = fundo + vec3(0.3, 0.72, 1.0) * bracos * (1.15 - raio * 0.5);
        float miolo = pow(max(0.0, 1.0 - raio * 1.5), 3.0) * (0.85 + 0.15 * sin(uT * 3.0));
        cor += vec3(0.9, 0.97, 1.0) * miolo;
        // faíscas que cintilam no redemoinho
        vec2 g = floor(vUv * vec2(26.0, 28.0));
        float sorte = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453);
        cor += vec3(1.0) * step(0.965, sorte) * pow(max(0.0, sin(uT * (2.0 + sorte * 5.0) + sorte * 40.0)), 8.0);
        gl_FragColor = vec4(cor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const gRedemoinho = new THREE.PlaneGeometry(4.8, 4.95);
  const redemoinho = new THREE.Mesh(gRedemoinho, mRedemoinho);
  redemoinho.position.set(xCeleiro, yFazendas + 2.48, CELEIRO.z1 - 0.5);
  grupo.add(redemoinho);
  // clarão azul no chão da frente e o halo em volta da porta
  const mClaraoPortal = new THREE.MeshBasicMaterial({
    map: tBrilho,
    color: 0x3aa8ff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const gClarao = new THREE.PlaneGeometry(1, 1);
  const claraoPortal = new THREE.Mesh(gClarao, mClaraoPortal);
  claraoPortal.rotation.x = -Math.PI / 2;
  claraoPortal.scale.set(11, 9, 1);
  claraoPortal.position.set(xCeleiro, yFazendas + 0.05, CELEIRO.z1 + 2.4);
  const haloPortal = new THREE.Mesh(gClarao, mClaraoPortal);
  haloPortal.scale.set(10, 10, 1);
  haloPortal.position.set(xCeleiro, yFazendas + 2.5, CELEIRO.z1 + 0.25);
  grupo.add(claraoPortal, haloPortal);
  lixo.push(mRedemoinho, gRedemoinho, mClaraoPortal, gClarao);
  // brilhinhos soltos na frente do portal e subindo pela escadaria
  const faiscasDoPortal: [number, number, number][] = [];
  for (let k = 0; k < 34; k++)
    faiscasDoPortal.push([
      xCeleiro + (r() - 0.5) * 6.4,
      yFazendas + 0.3 + r() * 5.4,
      CELEIRO.z1 + 0.2 + r() * 2.6,
    ]);
  for (let k = 0; k < 16; k++) {
    const f = r();
    const { pe, topo } = PONTE_FAZENDAS;
    faiscasDoPortal.push([
      pe.x + (topo.x - pe.x) * f + (r() - 0.5) * 4.2,
      yFazendas * f + 1.4 + r() * 1.6,
      pe.z + (topo.z - pe.z) * f,
    ]);
  }
  const acenderFaiscasDoPortal = pontos(faiscasDoPortal, 0.5, 0xaee6ff);
  // pás do moinho: quatro braços com vela, girando devagar
  const pasDoMoinho = new THREE.Group();
  pasDoMoinho.position.set(MOINHO.x, yFazendas + 4.9, MOINHO.z + 1.15);
  {
    const pas = new Blocos(r);
    pas.add(0, 0, 0, 0.42, 0.42, 0.3, 0x6e4a2b, 0.03);
    for (const s of [-1, 1]) {
      pas.add(0, s * 1.55, 0, 0.14, 2.9, 0.1, 0x8a5a3a, 0.04);
      pas.add(s * 0.42, s * 1.75, 0, 0.66, 2.1, 0.05, 0xf6f1e4, 0.03);
      pas.add(s * 1.55, 0, 0, 2.9, 0.14, 0.1, 0x8a5a3a, 0.04);
      pas.add(s * 1.75, -s * 0.42, 0, 2.1, 0.66, 0.05, 0xf6f1e4, 0.03);
    }
    const mPas = pas.construir(THREE, {
      acabamento: { chanfro: 0.02, junta: 0.12, pe: 0, grao: 0.05 },
    });
    pasDoMoinho.add(mPas.malha);
    lixo.push({ dispose: mPas.descartar });
  }
  grupo.add(pasDoMoinho);

  const acenderLampadas = pontos(lampadas, 3.4, 0xffc670);
  const acenderBrilhos = pontos(brilhos, 0.6, 0xffffff);

  // ---------------- portal do Magnata: redemoinho azul (com um toque vermelho) na porta ----------------
  const uMagnata = { uT: { value: 0 } };
  const mMagnata = new THREE.ShaderMaterial({
    uniforms: uMagnata,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uT;
      void main() {
        vec2 p = (vUv - 0.5) * vec2(1.0, 1.4);
        float raio = length(p) * 2.0;
        float ang = atan(p.y, p.x);
        float a = sin(ang * 3.0 + raio * 10.0 - uT * 2.6);
        vec3 fundo = mix(vec3(0.02, 0.06, 0.35), vec3(0.08, 0.4, 1.0), clamp(1.0 - raio * 0.8, 0.0, 1.0));
        vec3 cor = fundo + vec3(0.4, 0.75, 1.0) * smoothstep(0.0, 1.0, a) * (1.1 - raio * 0.5);
        cor += vec3(1.0, 0.3, 0.3) * smoothstep(0.6, 1.0, sin(ang * 2.0 - raio * 6.0 + uT * 1.7)) * 0.35;
        cor += vec3(0.95, 0.98, 1.0) * pow(max(0.0, 1.0 - raio * 1.6), 3.0);
        gl_FragColor = vec4(cor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const gMagnata = new THREE.PlaneGeometry(PREDIO_MAGNATA.porta * 2 - 0.1, 2.85);
  const portalMagnata = new THREE.Mesh(gMagnata, mMagnata);
  portalMagnata.position.set(PREDIO_MAGNATA.x1 - 0.5, 1.45, 0);
  portalMagnata.rotation.y = Math.PI / 2;
  grupo.add(portalMagnata);
  lixo.push(mMagnata, gMagnata);

  // ---------------- logo HOST 3D no céu (modelo em public/hoki/logo), flutuando de leve ----------------
  const placa = new THREE.Group();
  placa.position.set(LETREIRO.x, LETREIRO.y, LETREIRO.z);
  grupo.add(placa);
  let logoDescartada = false;
  const recursosDaLogo: { dispose(): void }[] = [];
  void import("three/examples/jsm/loaders/GLTFLoader.js")
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync("/hoki/logo/host-logo.glb"))
    .then((gltf) => {
      const logo = gltf.scene;
      logo.traverse((o) => {
        const m = o as TH.Mesh;
        if (!m.isMesh) return;
        recursosDaLogo.push(m.geometry);
        const mat = m.material as TH.MeshStandardMaterial;
        recursosDaLogo.push(mat);
        if (mat.map) {
          mat.map.anisotropy = 8;
          recursosDaLogo.push(mat.map);
          // um pouco de brilho próprio para a logo ficar viva também à sombra e à noite
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.18;
        }
      });
      if (logoDescartada) return recursosDaLogo.forEach((x) => x.dispose());
      // o modelo tem 0,98 × 0,70 (base no chão, frente para +z): fica com ~17 m de largura
      logo.scale.setScalar(17.5);
      placa.add(logo);
    })
    .catch(() => undefined);
  lixo.push({
    dispose: () => {
      logoDescartada = true;
      recursosDaLogo.forEach((x) => x.dispose());
    },
  });

  // ---------------- ao longe: ilhotas flutuando; no céu e embaixo da ilha, nuvens ----------------
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
  ilhota(-46, 8, -28, 3.4);
  ilhota(46, 8, -28, 3.4);
  ilhota(-62, 2, 14, 3);
  ilhota(62, 2, 14, 3);
  // (a do meio, lá no fundo, fica mais alta e de lado para não aparecer atrás da logo)
  ilhota(-30, 20, -62, 2.6);
  ilhota(30, 20, -62, 2.6);
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
      [-40, 20, -70, 2.6],
      [18, 24, -76, 3],
      [52, 18, -60, 2.2],
      [-64, 16, -40, 2.4],
      [70, 15, -30, 2.3],
      [-20, 26, -90, 3.4],
      [40, 28, -96, 3],
    ],
    11,
  );
  const mar = criarNuvens(
    THREE,
    [
      [-26, -16, 18, 6],
      [8, -18, 24, 7],
      [32, -16, 16, 6],
      [-44, -15, -4, 6],
      [46, -16, -8, 6.5],
      [0, -19, -6, 8],
      [-16, -17, -28, 6.5],
      [22, -17, -30, 7],
      [-58, -16, 22, 6],
      [60, -16, 26, 6],
      [-4, -12, 40, 5],
    ],
    23,
  );
  for (const n of [...ceu.nuvens, ...mar.nuvens]) grupo.add(n.malha);
  lixo.push({ dispose: ceu.descartar }, { dispose: mar.descartar });

  // ---------------- gotas da fonte: jatos subindo do topo e caindo nas taças ----------------
  const GOTAS = 90;
  const gGota = new THREE.SphereGeometry(0.06, 6, 4);
  const mGota = new THREE.MeshBasicMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.85 });
  const gotas = new THREE.InstancedMesh(gGota, mGota, GOTAS);
  gotas.frustumCulled = false;
  grupo.add(gotas);
  lixo.push(gGota, mGota);
  const aux = new THREE.Object3D();
  let nivelNoite = 0;

  return {
    grupo,
    /** Arco do RANKING: `definir` troca o que está escrito no vão. */
    ranking: arcoDoRanking,
    atualizar(t: number) {
      arcoDoRanking.atualizar(t);
      tAgua.offset.y = -t * 0.42;
      tQueda.offset.y = t * 0.9;
      tAguaCalha.offset.y = -t * 1.6;
      tParada.offset.set(Math.sin(t * 0.25) * 0.06, Math.cos(t * 0.2) * 0.06);
      placa.position.y = LETREIRO.y + Math.sin(t * 0.6) * 0.25;
      placa.rotation.y = Math.sin(t * 0.25) * 0.06;
      uMagnata.uT.value = t;
      // HOST FAZENDAS: o redemoinho gira, o clarão pulsa, as faíscas cintilam e o moinho roda
      uPortal.uT.value = t;
      mClaraoPortal.opacity = 0.42 + Math.sin(t * 2.2) * 0.12;
      haloPortal.rotation.z = t * 0.15;
      acenderFaiscasDoPortal(
        (i) => Math.pow(Math.max(0, Math.sin(t * (1.2 + (i % 7) * 0.29) + i * 2.1)), 6) * 1.7,
      );
      pasDoMoinho.rotation.z = -t * 0.55;
      ceu.nuvens.forEach(
        (n, i) => (n.malha.position.x = ((n.x0 + 90 + t * (0.2 + i * 0.04)) % 180) - 90),
      );
      mar.nuvens.forEach((n, i) => (n.malha.position.x = n.x0 + Math.sin(t * 0.05 + i) * 2.5));
      acenderLampadas(() => 0.55 + nivelNoite * 1.25 + Math.sin(t * 2.1) * 0.03);
      acenderBrilhos(
        (i) => Math.pow(Math.max(0, Math.sin(t * (1.1 + (i % 5) * 0.23) + i * 1.7)), 10) * 1.5,
      );
      for (let i = 0; i < GOTAS; i++) {
        const p = (t * 0.7 + i / GOTAS) % 1;
        const ang = i * 2.399;
        const tipo = i % 3;
        const dist = tipo === 0 ? p * 0.5 : tipo === 1 ? 1.0 + p * 0.45 : 1.75 + p * 0.5;
        const y =
          tipo === 0
            ? 3.6 + Math.sin(p * Math.PI) * 0.6 - p * 0.6
            : tipo === 1
              ? 2.95 - p * p * 1.0
              : 1.9 - p * p * 1.4;
        aux.position.set(FONTE.x + Math.cos(ang) * dist, y, FONTE.z + Math.sin(ang) * dist);
        aux.scale.setScalar(tipo === 0 ? 1.1 : 0.85);
        aux.updateMatrix();
        gotas.setMatrixAt(i, aux.matrix);
      }
      gotas.instanceMatrix.needsUpdate = true;
    },
    /** Noite (0 = dia, 1 = noite fechada): as nuvens escurecem e as luzes aparecem mais. */
    noite(v: number) {
      nivelNoite = v;
      for (const n of [ceu.nuvens[0], mar.nuvens[0]])
        if (n) (n.malha.material as TH.MeshLambertMaterial).emissiveIntensity = 0.62 - 0.52 * v;
    },
    descartar: () => lixo.forEach((l) => l.dispose()),
  };
}
