/**
 * Cenário do cartão do HOKI: o letreiro 3D com o nome do pet e o que fica em
 * volta do pódio (a pracinha de pedra, o gramado, as ilhas e as nuvens ao fundo).
 * Os pódios em si ficam em podios.ts.
 */
import type * as TH from "three";
import { criarManchas, texturaMancha } from "./luz";
import {
  Blocos,
  anelDaMarca,
  arbusto,
  arvore,
  criarNuvens,
  letrasDePedra,
  pedregulho,
  sorteador,
  texturaQueda,
} from "./voxel";

type Lixo = { dispose: () => void }[];

/**
 * Letreiro com o nome do HOKI, no mesmo estilo do HOST da praça: letras de
 * pedra clara em blocos, com relevo, e o anel vermelho da marca em volta.
 */
export function criarLetreiro(THREE: typeof TH, texto: string) {
  const lixo: Lixo = [];
  const grupo = new THREE.Group();
  const miolo = new THREE.Group();
  grupo.add(miolo);
  const LINHAS = 13;
  const u = 0.58 / LINHAS;
  const b = new Blocos(sorteador(3));
  // por trás, as mesmas letras um pouco mais gordas e escuras fazem o contorno que separa o nome do céu
  letrasDePedra(b, texto, u, u * 3, {
    linhas: LINHAS,
    engorda: 1,
    relevo: 0,
    maior: [7, 5],
    cores: [0x7d756b, 0x857c71],
    z: u * 1.6,
  });
  const medida = letrasDePedra(b, texto, u, u * 2.4, {
    linhas: LINHAS,
    relevo: 0.45,
    maior: [6, 5],
    cores: [0xfffdf8, 0xf8f3e9, 0xffffff, 0xf3ede1],
    z: u * 3,
  });
  const letras = b.construir(THREE, {
    recebe: false,
    acabamento: { chanfro: u * 0.3, junta: 0.1, pe: 0, grao: 0 },
  });
  letras.malha.position.y = -medida.altura / 2;
  miolo.add(letras.malha);
  const raio = medida.largura / 2 + 0.17;
  const anel = anelDaMarca(THREE, raio, 0.085);
  anel.malha.rotation.x = -0.98; // inclinado: a parte da frente passa por baixo das letras e a de trás por cima
  const inclinado = new THREE.Group();
  inclinado.rotation.z = 0.14;
  inclinado.add(anel.malha);
  miolo.add(inclinado);
  lixo.push({ dispose: letras.descartar }, { dispose: anel.descartar });

  return {
    grupo,
    largura: raio * 2 + 0.2,
    atualizar(t: number) {
      miolo.position.y = Math.sin(t * 0.9) * 0.025;
      miolo.rotation.y = Math.sin(t * 0.5) * 0.05;
    },
    descartar: () => lixo.forEach((l) => l.dispose()),
  };
}

/**
 * O que fica em volta do pedestal, em duas camadas:
 * - `perto`: a pracinha redonda de pedra onde ele está apoiado (fica nítida, e recebe a sombra);
 * - `longe`: o gramado com canteiros, as árvores, o paredão com a cachoeira, as ilhas e as nuvens
 *   (essa camada é desenhada levemente desfocada, para dar profundidade).
 */
export function criarFundo(THREE: typeof TH) {
  const lixo: Lixo = [];
  const perto = new THREE.Group();
  const longe = new THREE.Group();
  const r = sorteador(21);
  const escolhe = (l: readonly number[]) => l[Math.floor(r() * l.length)] ?? l[0]!;
  const GRAMA = [0x6cc046, 0x63b73f, 0x76c84e];
  const TERRA = [0x8e5b35, 0x82512e, 0x9a663c];
  const ROCHA = [0x8b8279, 0x7b736b, 0x999289];

  // ---------- perto: pedras rosadas em anéis, com rejunte e meio-fio ----------
  const piso = new Blocos(r);
  const gRejunte = new THREE.CircleGeometry(3.7, 56);
  gRejunte.rotateX(-Math.PI / 2);
  const mRejunte = new THREE.MeshStandardMaterial({ color: 0x9a8876, roughness: 1 });
  const rejunte = new THREE.Mesh(gRejunte, mRejunte);
  rejunte.position.y = -0.028;
  rejunte.receiveShadow = true;
  perto.add(rejunte);
  for (let k = 0; k < 5; k++) {
    const raio = 1.36 + 0.44 * (k + 0.5);
    const n = Math.round((Math.PI * 2 * raio) / 0.66);
    for (let i = 0; i < n; i++) {
      const a = k * 0.4 + (i / n) * Math.PI * 2;
      piso.base(
        Math.cos(a) * raio,
        -0.05,
        Math.sin(a) * raio,
        0.41,
        0.05,
        (Math.PI * 2 * raio) / n - 0.03,
        escolhe([0xe7d3c6, 0xdfc9bb, 0xeddbd0, 0xd9c1b2]),
        0.03,
        -a,
      );
    }
  }
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    piso.base(
      Math.cos(a) * 3.68,
      -0.05,
      Math.sin(a) * 3.68,
      0.24,
      0.13,
      (Math.PI * 2 * 3.68) / 40 - 0.03,
      i % 2 ? 0xbcab97 : 0xb1a08c,
      0.03,
      -a,
    );
  }
  const cPiso = piso.construir(THREE, {
    sombra: false,
    acabamento: { chanfro: 0.03, junta: 0.3, pe: 0.1, grao: 0.05 },
  });
  perto.add(cPiso.malha);
  const tMancha = texturaMancha(THREE);
  const contato = criarManchas(THREE, tMancha, [{ x: 0.1, z: -0.05, rx: 2.05, rz: 2.05 }], {
    cor: 0x1d150c,
    forca: 0.5,
  });
  perto.add(contato.malha);
  lixo.push(
    gRejunte,
    mRejunte,
    tMancha,
    { dispose: cPiso.descartar },
    { dispose: contato.descartar },
  );

  // ---------- longe: o gramado em volta, em degraus, com canteiros, árvores e pedras ----------
  const mundo = new Blocos(r);
  const degrau = (x: number, z: number) =>
    x < -3.3
      ? Math.min(3, Math.floor((-x - 3.3) * 0.6 + (z < -1.5 ? 1 : 0))) * 0.5
      : x > 3.6 && z < -0.5
        ? Math.min(2, Math.floor((x - 3.6) * 0.7)) * 0.5
        : 0;
  for (let x = -9; x <= 9; x++) {
    for (let z = -8; z <= 5; z++) {
      const d = Math.hypot(x, (z + 1) * 1.2);
      const borda = 7.6 + Math.sin(x * 1.7 + z) * 0.7;
      if (d < 3.2 || d > borda) continue;
      const h = degrau(x, z);
      const pedregoso = x > 4.6 && z < -1 && r() < 0.55;
      mundo.base(x, -0.5, z, 1, 0.5 + h, 1, escolhe(pedregoso ? ROCHA : GRAMA), 0.045);
      if (d > borda - 1.3) {
        // beirada da ilha: terra e rocha por baixo
        const fundo = 1 + Math.floor(r() * 3);
        for (let k = 0; k < fundo; k++)
          mundo.base(
            x,
            -1.5 - k,
            z,
            1 + (r() < 0.3 ? 0.2 : 0),
            1,
            1 + (r() < 0.3 ? 0.2 : 0),
            escolhe(k < 1 ? TERRA : ROCHA),
            0.07,
          );
      }
      if (!pedregoso && r() < 0.1) {
        mundo.base(x + (r() - 0.5) * 0.5, h, z + (r() - 0.5) * 0.5, 0.05, 0.2, 0.05, 0x4f9c35, 0);
        mundo.base(
          x,
          h + 0.2,
          z,
          0.17,
          0.13,
          0.17,
          escolhe([0xffffff, 0xffffff, 0xffd84a, 0xff8fc8]),
          0,
        );
      }
    }
  }
  // canteiros de cerca viva com margaridas, dos dois lados
  for (const [x, z, s] of [
    [-3.5, 0.5, 1],
    [-3.0, -1.7, 0.85],
    [3.5, 0.3, 0.95],
    [3.1, -2.0, 0.8],
    [-4.4, 2.2, 0.8],
    [4.5, 2.0, 0.75],
  ] as const) {
    mundo.base(x, 0, z, 0.9 * s, 0.6 * s, 0.9 * s, 0x58a83b, 0.06, r());
    mundo.base(x + 0.5 * s, 0, z - 0.3 * s, 0.6 * s, 0.42 * s, 0.6 * s, 0x4f9c35, 0.06, r());
    for (let n = 0; n < 4; n++) {
      const fx = x + (r() - 0.5) * 0.7 * s;
      const fz = z + (r() - 0.2) * 0.5 * s;
      mundo.base(fx, 0.6 * s, fz, 0.2 * s, 0.07, 0.2 * s, 0xffffff, 0);
      mundo.base(fx, 0.6 * s + 0.07, fz, 0.08 * s, 0.05, 0.08 * s, 0xffd84a, 0);
    }
  }
  arvore(mundo, -5.6, -2.4, { tipo: "copa", cor: "amarelo", u: 0.5, y: degrau(-5.6, -2.4) });
  arvore(mundo, -4.5, -5.2, { tipo: "copinha", u: 0.52, y: degrau(-4.5, -5.2) });
  arvore(mundo, -7, 0.5, { tipo: "pinheiro", u: 0.46, y: degrau(-7, 0.5) });
  arvore(mundo, 5.2, -4.6, { tipo: "copinha", cor: "laranja", u: 0.46, y: degrau(5.2, -4.6) });
  arbusto(mundo, -2.6, -3.4, 0.7);
  arbusto(mundo, 2.7, -3.6, 0.6, { flor: 0xff8fc8 });
  pedregulho(mundo, 4.9, 0.9, 0.7);
  pedregulho(mundo, -4.9, 3.4, 0.6);

  // paredão de rocha à direita, com a cachoeira e árvores em cima
  const alturaParedao = (x: number, z: number) =>
    Math.max(1, Math.min(6, Math.round(2.5 + (x - 6) * 0.9 + (-10 - z) * 0.5 + (r() - 0.5))));
  for (let x = 5; x <= 10; x++) {
    for (let z = -13; z <= -9; z++) {
      const h = alturaParedao(x, z);
      for (let l = -2; l < h; l++)
        mundo.base(
          x,
          l,
          z,
          1 + (r() < 0.25 ? 0.16 : 0),
          1,
          1 + (r() < 0.25 ? 0.16 : 0),
          escolhe(l < 0 ? TERRA : ROCHA),
          0.07,
        );
      mundo.base(x, h, z, 1.05, 0.3, 1.05, escolhe(GRAMA), 0.05);
    }
  }
  arvore(mundo, 8.2, -11.4, { tipo: "copinha", u: 0.52, y: 5.3 });
  arvore(mundo, 6.2, -12.4, { tipo: "pinheiro", u: 0.46, y: 4.3 });
  // ilha flutuando à esquerda e outra, pequena, mais ao fundo
  const ilha = (cx: number, cy: number, cz: number, raio: number) => {
    for (let k = 0; k <= 4; k++) {
      const rk = raio - k * 0.7 + (k ? r() * 0.3 : 0);
      const alcance = Math.ceil(rk);
      const topo = k === 0 ? cy : cy - 0.35 - (k - 1) * 0.8;
      const alt = k === 0 ? 0.35 : 0.8;
      for (let i = -alcance; i <= alcance; i++)
        for (let j = -alcance; j <= alcance; j++)
          if (Math.hypot(i, j) <= rk)
            mundo.base(
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
  };
  ilha(-8, 1.6, -12.5, 3.3);
  arvore(mundo, -8.8, -12.4, { tipo: "copa", u: 0.5, y: 1.6 });
  arvore(mundo, -6.6, -13, { tipo: "copinha", cor: "amarelo", u: 0.48, y: 1.6 });
  ilha(1.5, 4.6, -24, 2.4);
  arvore(mundo, 1.5, -24, { tipo: "copinha", u: 0.5, y: 4.6 });
  const cMundo = mundo.construir(THREE, {
    sombra: false,
    acabamento: { chanfro: 0.06, junta: 0.14, pe: 0.26, grao: 0.06 },
  });
  longe.add(cMundo.malha);

  const tQueda = texturaQueda(THREE);
  tQueda.repeat.set(1, 2.4);
  const mQueda = new THREE.MeshBasicMaterial({ map: tQueda, transparent: true, opacity: 0.92 });
  const gQueda = new THREE.PlaneGeometry(1.5, 6.6);
  const queda = new THREE.Mesh(gQueda, mQueda);
  queda.position.set(6.6, 1.1, -8.42);
  longe.add(queda);
  const ceu = criarNuvens(
    THREE,
    [
      [-7.5, 7, -17, 1.15],
      [6.5, 8.6, -21, 1.4],
      [0.5, 10.5, -26, 1.7],
      [-11, 3.4, -19, 1.0],
      [11, 4.4, -18, 0.9],
      [-2.5, 5.2, -30, 1.3],
    ],
    31,
  );
  for (const n of ceu.nuvens) longe.add(n.malha);
  lixo.push({ dispose: cMundo.descartar }, tQueda, mQueda, gQueda, { dispose: ceu.descartar });

  return {
    perto,
    longe,
    atualizar(t: number) {
      tQueda.offset.y = t * 0.6;
      ceu.nuvens.forEach(
        (n, i) => (n.malha.position.x = ((n.x0 + 16 + t * (0.1 + i * 0.025)) % 32) - 16),
      );
    },
    descartar: () => lixo.forEach((l) => l.dispose()),
  };
}
