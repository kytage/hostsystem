import type * as TH from "three";
import { Blocos, sorteador } from "../voxel";
import { corpoAndando, registrarTerreno } from "../mundo-mapa";
import {
  FORJA,
  ORIGEM_ARENA,
  PEDESTAIS,
  PISO,
  SIEGE,
  caixasDaArena,
  dentroDe,
  lado,
  type Caixa,
  type Time,
} from "@/lib/siege/config";

/**
 * Arena do HOST SIEGE, feita de blocos a partir de `caixasDaArena()` (o mesmo
 * desenho serve para a colisão). Fica longe do lobby (ORIGEM_ARENA), fora da
 * vista dele. Coordenadas "da arena" = mundo − ORIGEM_ARENA.
 */

const VERMELHO = 0xce0e0e;
const AZUL = 0x1e6bff;
const PEDRA = [0x2e2e34, 0x34343b, 0x3a3a42];
const METAL = 0x5d636e;
const RESOLUCAO = 0.5;
const X0 = -90;
const X1 = 90;
const Z0 = -20;
const Z1 = 20;
const NX = Math.round((X1 - X0) / RESOLUCAO);
const NZ = Math.round((Z1 - Z0) / RESOLUCAO);

/** Alturas da arena numa grade (−999 = vazio, dá para cair) e os portões. */
const alturas = new Float32Array(NX * NZ).fill(-999);
const portoes = new Uint8Array(NX * NZ); // 0 nada, 1 vermelho, 2 azul
const SEM_CHAO = -999;
{
  for (const c of caixasDaArena()) {
    const i0 = Math.max(0, Math.floor((c.x0 - X0) / RESOLUCAO));
    const i1 = Math.min(NX - 1, Math.ceil((c.x1 - X0) / RESOLUCAO) - 1);
    const k0 = Math.max(0, Math.floor((c.z0 - Z0) / RESOLUCAO));
    const k1 = Math.min(NZ - 1, Math.ceil((c.z1 - Z0) / RESOLUCAO) - 1);
    for (let i = i0; i <= i1; i++)
      for (let k = k0; k <= k1; k++) {
        const n = i * NZ + k;
        if (c.portao) portoes[n] = c.portao === "vermelho" ? 1 : 2;
        else alturas[n] = Math.max(alturas[n]!, c.topo);
      }
  }
}
const celula = (x: number, z: number) => {
  const i = Math.floor((x - X0) / RESOLUCAO);
  const k = Math.floor((z - Z0) / RESOLUCAO);
  return i < 0 || k < 0 || i >= NX || k >= NZ ? -1 : i * NZ + k;
};

/** Estado que a colisão precisa saber (portões fechados e o meu time). */
export const regrasDaArena = { portoesFechados: true, meuTime: null as Time | null };

/** Altura do chão na arena (coordenadas da arena); vazio = muito baixo (cai). */
export function chaoDaArena(x: number, z: number) {
  const n = celula(x, z);
  if (n < 0) return SEM_CHAO;
  if (regrasDaArena.portoesFechados && portoes[n]) return PISO + 6;
  return alturas[n]!;
}

/** Dá para passar por (x, z) da arena? (paredes não; vazio sim — é por onde se cai) */
export function livreNaArena(x: number, z: number) {
  const h = chaoDaArena(x, z);
  return h <= PISO + 0.6;
}

const LADOS = [
  [0.2, 0.2],
  [-0.2, 0.2],
  [0.2, -0.2],
  [-0.2, -0.2],
] as const;

export const naArena = (xMundo: number, zMundo: number) =>
  xMundo >= ORIGEM_ARENA.x + X0 &&
  xMundo <= ORIGEM_ARENA.x + X1 &&
  zMundo >= ORIGEM_ARENA.z + Z0 - 30 &&
  zMundo <= ORIGEM_ARENA.z + Z1 + 30;

registrarTerreno({
  contem: naArena,
  chao: (x, z) => chaoDaArena(x - ORIGEM_ARENA.x, z - ORIGEM_ARENA.z),
  livre: (xm, zm) => {
    const x = xm - ORIGEM_ARENA.x;
    const z = zm - ORIGEM_ARENA.z;
    // inimigos não entram na sala de spawn do outro time
    if (regrasDaArena.meuTime) {
      const outro: Time = regrasDaArena.meuTime === "vermelho" ? "azul" : "vermelho";
      if (dentroDe(lado(outro).spawn, x, z)) return false;
    }
    for (const [dx, dz] of LADOS) {
      const h = chaoDaArena(x + dx, z + dz);
      if (h > corpoAndando.y + 0.6) return false;
    }
    return true;
  },
});

/** Monta o desenho da arena. */
export function criarArena3D(THREE: typeof TH) {
  const grupo = new THREE.Group();
  grupo.name = "arena-siege";
  grupo.position.set(ORIGEM_ARENA.x, 0, ORIGEM_ARENA.z);
  const r = sorteador(77);
  const escolhe = (l: number[]) => l[Math.floor(r() * l.length)]!;
  const pedra = new Blocos(r);
  const metal = new Blocos(r);
  const brilho = new Blocos(r);
  const lixo: { dispose: () => void }[] = [];

  const corDoLado = (c: Caixa) => (c.x0 + c.x1 < 0 ? VERMELHO : AZUL);
  for (const c of caixasDaArena()) {
    if (c.portao) continue;
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    if (c.topo <= PISO + 0.01) {
      // piso: laje de pedra escura com a base afinando para baixo (silhueta flutuante)
      pedra.base(cx, PISO - 1.2, cz, w, 1.2, d, escolhe(PEDRA), 0.05);
      const fundo = Math.min(9, 2 + Math.min(w, d) * 0.35);
      pedra.base(
        cx,
        PISO - 1.2 - fundo,
        cz,
        Math.max(1, w - 1.5),
        fundo,
        Math.max(1, d - 1.5),
        0x23232a,
        0.06,
      );
    } else {
      // paredes e coberturas
      const alto = c.topo - PISO;
      pedra.base(cx, PISO, cz, w, alto, d, c.cor ?? escolhe(PEDRA), 0.05);
      if (alto > 3 && Math.abs(cx) > 40)
        brilho.base(cx, c.topo - 0.25, cz, w + 0.02, 0.18, d + 0.02, corDoLado(c), 0);
    }
  }
  // detalhes de metal na ponte (bordas) e os trechos escuros de cobertura
  for (let x = -45.5; x <= 45.5; x += 1) {
    metal.base(x, PISO, -2.5, 0.12, 0.6, 0.12, METAL, 0);
    metal.base(x, PISO, 2.5, 0.12, 0.6, 0.12, METAL, 0);
  }
  metal.base(0, PISO + 0.55, -2.5, 92, 0.08, 0.08, METAL, 0);
  metal.base(0, PISO + 0.55, 2.5, 92, 0.08, 0.08, METAL, 0);

  // Forja Central: quatro pilares de metal e o núcleo que brilha na cor de quem dominou
  for (const [dx, dz] of [
    [-5.5, -5.5],
    [5.5, -5.5],
    [-5.5, 5.5],
    [5.5, 5.5],
  ] as const)
    metal.base(FORJA.x + dx, PISO, FORJA.z + dz, 0.9, 4.2, 0.9, METAL, 0.04);
  // bandeiras, faixas e torres de cada castelo
  for (const t of ["vermelho", "azul"] as Time[]) {
    const s = t === "vermelho" ? -1 : 1;
    const cor = t === "vermelho" ? VERMELHO : AZUL;
    for (const z of [-11.5, 11.5]) {
      pedra.base(s * 47, PISO, z, 2.4, 9, 2.4, 0x2a2a30, 0.04);
      pedra.base(s * 72.5, PISO, z, 2.4, 9, 2.4, 0x2a2a30, 0.04);
      metal.base(s * 47, PISO + 9, z, 0.15, 3, 0.15, METAL, 0);
      brilho.base(s * 47 + s * 0.6, PISO + 10.6, z, 1.2, 0.8, 0.06, cor, 0);
    }
    brilho.base(s * 46.5, PISO + 6, 0, 0.3, 0.3, 5.2, cor, 0);
    // a sala de spawn: faixa no piso
    brilho.base(s * 79, PISO + 0.02, 0, 9, 0.04, 9, cor, 0);
  }
  // plataformas distantes (silhueta do mapa)
  for (const [x, z, w] of [
    [-30, -24, 6],
    [30, 24, 6],
    [-58, 26, 5],
    [58, -26, 5],
    [0, -30, 7],
    [0, 30, 7],
  ] as const) {
    pedra.base(x, PISO - 6, z, w, 1.2, w, escolhe(PEDRA), 0.06);
    pedra.base(x, PISO - 10, z, w - 2, 4, w - 2, 0x23232a, 0.06);
  }

  const conjuntos = [
    pedra.construir(THREE, { acabamento: { chanfro: 0.05, junta: 0.22, pe: 0.2, grao: 0.06 } }),
    metal.construir(THREE, { acabamento: { chanfro: 0.03, junta: 0.1, pe: 0.1, grao: 0.04 } }),
    brilho.construir(THREE, {
      sombra: false,
      material: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
  ];
  for (const c of conjuntos) {
    grupo.add(c.malha);
    lixo.push({ dispose: c.descartar });
  }

  // portões (somem quando a partida começa)
  const gPortao = new THREE.BoxGeometry(1, 6, 4.8);
  const portoes3d: Record<Time, TH.Mesh> = {
    vermelho: new THREE.Mesh(
      gPortao,
      new THREE.MeshStandardMaterial({ color: 0x5a1010, emissive: 0x6a0606, roughness: 0.5 }),
    ),
    azul: new THREE.Mesh(
      gPortao,
      new THREE.MeshStandardMaterial({ color: 0x0f2a5a, emissive: 0x06246a, roughness: 0.5 }),
    ),
  };
  portoes3d.vermelho.position.set(-46.5, PISO + 3, 0);
  portoes3d.azul.position.set(46.5, PISO + 3, 0);
  grupo.add(portoes3d.vermelho, portoes3d.azul);
  lixo.push(
    gPortao,
    portoes3d.vermelho.material as TH.Material,
    portoes3d.azul.material as TH.Material,
  );

  // anel de captura da Forja e o núcleo
  const gAnel = new THREE.RingGeometry(SIEGE.FORJA_RAIO - 0.25, SIEGE.FORJA_RAIO, 64);
  gAnel.rotateX(-Math.PI / 2);
  const mAnel = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
  });
  const anel = new THREE.Mesh(gAnel, mAnel);
  anel.position.set(FORJA.x, PISO + 0.05, FORJA.z);
  const gProg = new THREE.RingGeometry(
    SIEGE.FORJA_RAIO - 0.9,
    SIEGE.FORJA_RAIO - 0.35,
    64,
    1,
    0,
    0.001,
  );
  gProg.rotateX(-Math.PI / 2);
  const mProg = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const progresso = new THREE.Mesh(gProg, mProg);
  progresso.position.set(FORJA.x, PISO + 0.06, FORJA.z);
  const gNucleo = new THREE.OctahedronGeometry(1.1);
  const mNucleo = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const nucleo = new THREE.Mesh(gNucleo, mNucleo);
  nucleo.position.set(FORJA.x, PISO + 3.4, FORJA.z);
  grupo.add(anel, progresso, nucleo);
  lixo.push(gAnel, mAnel, gProg, mProg, gNucleo, mNucleo);

  // pedestais de poção
  const gPed = new THREE.CylinderGeometry(0.55, 0.7, 1, 12);
  const mPed = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.6 });
  const gPocao = new THREE.SphereGeometry(0.32, 14, 10);
  const mPocao = new THREE.MeshBasicMaterial({ color: 0xff3b6b, toneMapped: false });
  const pocoes = PEDESTAIS.map((p) => {
    const ped = new THREE.Mesh(gPed, mPed);
    ped.position.set(p.x, PISO + 0.5, p.z);
    const po = new THREE.Mesh(gPocao, mPocao);
    po.position.set(p.x, PISO + 1.45, p.z);
    grupo.add(ped, po);
    return po;
  });
  lixo.push(gPed, mPed, gPocao, mPocao);

  const COR: Record<Time, number> = { vermelho: VERMELHO, azul: AZUL };
  return {
    grupo,
    atualizar(o: {
      t: number;
      portoesFechados: boolean;
      forja: { estado: string; progresso: number; time: Time | null; contestada: boolean };
      pedestaisProntos: boolean[];
    }) {
      portoes3d.vermelho.visible = portoes3d.azul.visible = o.portoesFechados;
      const cor = o.forja.contestada ? 0xffc83d : o.forja.time ? COR[o.forja.time] : 0xffffff;
      mAnel.color.setHex(
        o.forja.estado === "livre"
          ? cor
          : o.forja.estado === "janela" && o.forja.time
            ? COR[o.forja.time]
            : 0x555560,
      );
      mNucleo.color.setHex(
        o.forja.estado === "janela" && o.forja.time
          ? COR[o.forja.time]
          : o.forja.estado === "recarga"
            ? 0x444450
            : cor,
      );
      nucleo.rotation.y = o.t * 1.2;
      nucleo.position.y = PISO + 3.4 + Math.sin(o.t * 2) * 0.2;
      const k = Math.min(1, o.forja.progresso / SIEGE.FORJA_CAPTURA_S);
      progresso.visible = o.forja.estado === "livre" && k > 0;
      progresso.geometry.dispose();
      progresso.geometry = new THREE.RingGeometry(
        SIEGE.FORJA_RAIO - 0.9,
        SIEGE.FORJA_RAIO - 0.35,
        64,
        1,
        Math.PI / 2,
        -Math.max(0.001, k * Math.PI * 2),
      );
      progresso.geometry.rotateX(-Math.PI / 2);
      mProg.color.setHex(cor);
      pocoes.forEach((po, i) => {
        po.visible = !!o.pedestaisProntos[i];
        po.position.y = PISO + 1.45 + Math.sin(o.t * 2.5 + i) * 0.12;
      });
    },
    descartar() {
      progresso.geometry.dispose();
      for (const l of lixo) l.dispose();
    },
  };
}
