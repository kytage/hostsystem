/**
 * Mapa do lobby do HOKI em 3D (refeito do zero): a ilha central simétrica com a
 * praça da fonte, os quatro caminhos, o rio com cachoeira à direita e o laguinho
 * com cachoeira à esquerda; as ilhas do Magnata (oeste) e do Escritório (leste)
 * ligadas por pontes; HOST FAZENDAS (noroeste) e EM BREVE (nordeste) no alto, com
 * escadarias; o TOP 3 ao norte e, ao sul, o escorregador que desce da nuvem.
 * Aqui só tem contas, sem desenho: o cenário é montado em mundo-cena.ts.
 * Unidades: 1 = um bloco do chão. X cresce para a direita, Z para a frente.
 */
import type { Cultura } from "@/lib/hoki-itens";

export interface Ponto {
  x: number;
  z: number;
}

/** Ilha central: um quadrado arredondado (superelipse), centrado na fonte. */
export const ILHA = { a: 31, b: 23, n: 3.6 };
export const FONTE: Ponto = { x: 0, z: 0 };
/** Praça redonda: a fonte com o canteiro de flores vai até `dentro`; o calçamento, até `fora`. */
export const ANEL = { dentro: 6.0, fora: 11.5 };
/** Raio do "corpo" de um HOKI, para não atravessar as coisas. */
export const CORPO = 0.45;

export function dentroDaIlha(x: number, z: number, folga = 0) {
  return (
    Math.pow(Math.abs(x) / (ILHA.a - folga), ILHA.n) +
      Math.pow(Math.abs(z) / (ILHA.b - folga), ILHA.n) <
    1
  );
}
/** Até onde vai a beirada da ilha nesta linha (z), para a direita (x positivo). */
export const beiradaEmX = (z: number) =>
  ILHA.a * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / ILHA.b, ILHA.n)), 1 / ILHA.n);
/** Até onde vai a beirada da ilha nesta coluna (x), para a frente (z positivo). */
export const beiradaEmZ = (x: number) =>
  ILHA.b * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / ILHA.a, ILHA.n)), 1 / ILHA.n);

/** Distância de um ponto até o segmento a-b. */
function distSegmento(x: number, z: number, a: Ponto, b: Ponto) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}
/** Distância até uma linha de vários pontos. */
export function distLinha(x: number, z: number, linha: readonly Ponto[]) {
  let d = Infinity;
  for (let i = 1; i < linha.length; i++)
    d = Math.min(d, distSegmento(x, z, linha[i - 1]!, linha[i]!));
  return d;
}

// ---------------- ilhas altas: HOST FAZENDAS (noroeste) e EM BREVE (nordeste), espelhadas ----------------
export interface Escadaria {
  pe: Ponto;
  topo: Ponto;
  meia: number;
}
export const ILHA_FAZENDAS = { x0: -33, x1: -12, z0: -50, z1: -34, y: 4.5 };
export const PONTE_FAZENDAS: Escadaria = {
  pe: { x: -12.5, z: -16.5 },
  topo: { x: -21, z: ILHA_FAZENDAS.z1 },
  meia: 2.2,
};
export const ILHA_EM_BREVE = { x0: 12, x1: 33, z0: -50, z1: -34, y: 4.5 };
export const PONTE_EM_BREVE: Escadaria = {
  pe: { x: 12.5, z: -16.5 },
  topo: { x: 21, z: ILHA_EM_BREVE.z1 },
  meia: 2.2,
};
const ESCADARIAS = [PONTE_FAZENDAS, PONTE_EM_BREVE];

/** Onde um ponto fica em relação a uma escadaria: `s` ao longo dela (0 no pé) e `d` para o lado do eixo. */
export function naEscadaria(x: number, z: number, e: Escadaria = PONTE_FAZENDAS) {
  const { pe, topo } = e;
  const comp = Math.hypot(topo.x - pe.x, topo.z - pe.z);
  const ux = (topo.x - pe.x) / comp;
  const uz = (topo.z - pe.z) / comp;
  return {
    s: (x - pe.x) * ux + (z - pe.z) * uz,
    d: (x - pe.x) * uz - (z - pe.z) * ux,
    comp,
    ux,
    uz,
  };
}
/** Os dois pilares grandes no pé de cada escadaria (na ilha central). */
export const pilaresDaEscadaria = (e: Escadaria): Ponto[] =>
  [-1, 1].map((l) => {
    const { ux, uz } = naEscadaria(0, 0, e);
    const lado = l * (e.meia + 0.45);
    return { x: e.pe.x - ux * 0.5 + uz * lado, z: e.pe.z - uz * 0.5 - ux * lado };
  });
export const PILARES_DA_ESCADARIA = pilaresDaEscadaria(PONTE_FAZENDAS);

/** HOST FAZENDAS: celeiro (a porta é o portal), trigais, galpão, moinho e fardos. */
export const CELEIRO = { x0: -26.4, x1: -15.6, z0: -49.4, z1: -45.2, porta: 2.3 };
export const PORTAL_FAZENDAS: Ponto = { x: PONTE_FAZENDAS.topo.x, z: CELEIRO.z1 };
/** Onde o HOKI fica ao voltar da fazenda (na frente da porta do celeiro). */
export const FRENTE_DO_PORTAL_FAZENDAS: Ponto = { x: PORTAL_FAZENDAS.x, z: CELEIRO.z1 + 2.4 };
/** Entrou na porta do celeiro (o portal do HOST FAZENDAS)? */
export const naPortaDoCeleiro = (x: number, z: number) =>
  Math.abs(x - PORTAL_FAZENDAS.x) < CELEIRO.porta - 0.4 && z < CELEIRO.z1 + 0.5 && z > CELEIRO.z0;
export const TRIGAIS = [
  { x0: -31.8, x1: -25.4, z0: -41.6, z1: -35.8 },
  { x0: -16.6, x1: -13.2, z0: -41.6, z1: -35.8 },
];
export const GALPAO = { x0: -31.6, x1: -29.0, z0: -45.0, z1: -42.8 };
export const MOINHO: Ponto = { x: -29.8, z: -47.6 };
export const FARDOS = { x0: -15.4, x1: -13.0, z0: -44.6, z1: -43.0 };
export const ARVORES_FAZENDAS: (Ponto & { tipo: "copa" | "copinha" | "pinheiro" })[] = [
  { x: -31.6, z: -48.8, tipo: "pinheiro" },
  { x: -27.6, z: -48.6, tipo: "copinha" },
  { x: -13.8, z: -48.4, tipo: "copa" },
  { x: -13.6, z: -46, tipo: "pinheiro" },
];
export const POSTES_FAZENDAS: Ponto[] = [-37.2, -41].flatMap((z) =>
  [-1, 1].map((l) => ({ x: PONTE_FAZENDAS.topo.x + l * 3.1, z })),
);
/** EM BREVE: prédio de pedra com o portão trancado (espelho do celeiro), árvores e postes. */
export const PORTAO_EM_BREVE = { x0: 15.6, x1: 26.4, z0: -49.4, z1: -45.2 };
export const ARVORES_EM_BREVE: (Ponto & { tipo: "copa" | "copinha" | "pinheiro" })[] =
  ARVORES_FAZENDAS.map((a) => ({ ...a, x: -a.x }));
export const POSTES_EM_BREVE: Ponto[] = POSTES_FAZENDAS.map((p) => ({ x: -p.x, z: p.z }));
export const CANTEIROS_EM_BREVE = [
  { x0: 13.2, x1: 18.8, z0: -41.6, z1: -36.4 },
  { x0: 23.2, x1: 28.8, z0: -41.6, z1: -36.4 },
];

type Ret = { x0: number; x1: number; z0: number; z1: number };
const dentroDe = (r: Ret, x: number, z: number, folga = 0) =>
  x > r.x0 - folga && x < r.x1 + folga && z > r.z0 - folga && z < r.z1 + folga;
const BLOQUEIOS_FAZENDAS: Ret[] = [CELEIRO, ...TRIGAIS, GALPAO, FARDOS];
const BLOQUEIOS_EM_BREVE: Ret[] = [PORTAO_EM_BREVE, ...CANTEIROS_EM_BREVE];
const ILHAS_ALTAS = [
  { ilha: ILHA_FAZENDAS, bloqueios: BLOQUEIOS_FAZENDAS, porta: true },
  { ilha: ILHA_EM_BREVE, bloqueios: BLOQUEIOS_EM_BREVE, porta: false },
];

export const naPonteFazendas = (x: number, z: number, folga = 0) =>
  ESCADARIAS.some((e) => {
    const { s: ao, d, comp } = naEscadaria(x, z, e);
    return Math.abs(d) < e.meia - 0.45 + folga && ao >= -1 && ao <= comp + 1.4;
  });
export const naIlhaFazendas = (x: number, z: number, folga = 0) =>
  ILHAS_ALTAS.some(
    ({ ilha: I, bloqueios, porta }) =>
      x >= I.x0 + 0.7 - folga &&
      x <= I.x1 - 0.7 + folga &&
      z >= I.z0 + 0.7 - folga &&
      z <= I.z1 - 0.7 + folga &&
      !bloqueios.some(
        (b) =>
          dentroDe(b, x, z, CORPO - folga) &&
          // dentro do vão da porta do celeiro dá para dar um passo (é o portal)
          !(
            porta &&
            b === CELEIRO &&
            Math.abs(x - PORTAL_FAZENDAS.x) < CELEIRO.porta - CORPO &&
            z > b.z1 - 0.9
          ),
      ),
  );
/** Altura do chão: a ilha central fica em 0; as escadarias sobem até as ilhas altas. */
export function alturaDoChao(x: number, z: number) {
  for (const { ilha: I } of ILHAS_ALTAS)
    if (z <= I.z1 && x > I.x0 - 0.6 && x < I.x1 + 0.6 && z > I.z0 - 0.6) return I.y;
  for (const e of ESCADARIAS) {
    // a escadaria chega na altura da ilha um pouco antes do fim, para emendar sem degrau
    const { s: ao, d, comp } = naEscadaria(x, z, e);
    if (Math.abs(d) < e.meia + 0.7 && ao > 0 && ao < comp + 1.6)
      return ILHA_FAZENDAS.y * Math.min(1, ao / (comp - 1.2));
  }
  return 0;
}

// ---------------- caminhos (faixas calçadas) ----------------
export interface Faixa {
  a: Ponto;
  b: Ponto;
  meia: number;
}
export const CAMINHOS: Faixa[] = [
  { a: { x: 0, z: -ANEL.fora + 0.5 }, b: { x: 0, z: -20.5 }, meia: 2 },
  { a: { x: 0, z: ANEL.fora - 0.5 }, b: { x: 0, z: 19.5 }, meia: 2 },
  { a: { x: -ANEL.fora + 0.5, z: 0 }, b: { x: -31.5, z: 0 }, meia: 2 },
  { a: { x: ANEL.fora - 0.5, z: 0 }, b: { x: 31.5, z: 0 }, meia: 2 },
  { a: { x: -7.6, z: -8.2 }, b: PONTE_FAZENDAS.pe, meia: 1.6 },
  { a: { x: 7.6, z: -8.2 }, b: PONTE_EM_BREVE.pe, meia: 1.6 },
  // trilhas menores: até o coreto e até a ducha
  { a: { x: -8.2, z: 7.6 }, b: { x: -16.4, z: 10.6 }, meia: 1.1 },
  { a: { x: 8.2, z: 7.6 }, b: { x: 14.8, z: 12.2 }, meia: 1.1 },
];
/** Que piso tem neste ponto: o anel da praça, um caminho ou grama. */
export function piso(x: number, z: number): "anel" | "caminho" | "grama" {
  const d = Math.hypot(x - FONTE.x, z - FONTE.z);
  if (d >= ANEL.dentro && d <= ANEL.fora) return "anel";
  for (const c of CAMINHOS) if (distSegmento(x, z, c.a, c.b) <= c.meia) return "caminho";
  return "grama";
}

// ---------------- água: o rio da direita (nasce no nordeste e cai no sudeste) e o laguinho da esquerda ----------------
export const RIO: Ponto[] = [
  { x: 15.5, z: -12.5 },
  { x: 17.5, z: -6.5 },
  { x: 19, z: 0 },
  { x: 20.8, z: 6.5 },
  { x: 22.6, z: 12.5 },
  { x: 24.2, z: 18.4 },
  { x: 25.2, z: 21.5 },
];
export const MEIA_RIO = 1.5;
/** Nascente do rio (um laguinho de pedra) e o laguinho da esquerda, com o riacho até a cachoeira. */
export const NASCENTE = { x: 15.2, z: -13.4, r: 2.1 };
export const LAGO = { x: -21.5, z: 12.6, r: 2.7 };
export const RIACHO: Ponto[] = [
  { x: -22.6, z: 14.6 },
  { x: -23.8, z: 18.2 },
  { x: -24.6, z: 21.6 },
];
export const MEIA_RIACHO = 0.9;
/** Pontezinha do caminho do leste por cima do rio. */
export const PONTE = { z: 0, meia: 2, x: 19 };
export const naPonte = (x: number, z: number) =>
  Math.abs(z - PONTE.z) < PONTE.meia - 0.4 && Math.abs(x - PONTE.x) < 3;
export const naAgua = (x: number, z: number, folga = 0) =>
  distLinha(x, z, RIO) < MEIA_RIO + folga ||
  Math.hypot(x - NASCENTE.x, z - NASCENTE.z) < NASCENTE.r + folga ||
  Math.hypot(x - LAGO.x, z - LAGO.z) < LAGO.r + folga ||
  distLinha(x, z, RIACHO) < MEIA_RIACHO + folga;

// ---------------- ilhas laterais: Magnata (oeste) e Escritório (leste) ----------------
export const PONTE_OESTE = { x0: -40, x1: -30.2, meia: 1.7 };
export const PONTE_LESTE = { x0: 30.2, x1: 40, meia: 1.7 };
export const ILHA_MAGNATA = { x0: -55, x1: -40, z0: -8.5, z1: 8.5 };
export const ILHA_ESCRITORIO = { x0: 40, x1: 55, z0: -8.5, z1: 8.5 };
/** Prédio do portal do Magnata, no fundo da ilha, de frente para a ponte; o portal fica na porta. */
export const PREDIO_MAGNATA = { x0: -54.2, x1: -50.4, z0: -4.6, z1: 4.6, porta: 1.6 };
export const PORTAL: Ponto = { x: PREDIO_MAGNATA.x1, z: 0 };
export const FRENTE_DO_PORTAL: Ponto = { x: PREDIO_MAGNATA.x1 + 2.6, z: 0 };
export const DADOS_DO_MAGNATA: Ponto[] = [
  { x: -43.2, z: -5.6 },
  { x: -42.4, z: 5.4 },
];
export const PEAO_DO_MAGNATA: Ponto = { x: -46.8, z: 5.9 };
/** Escritório: prédio aberto para a ponte (oeste), com as mesas dentro. */
export const ESCRITORIO = { x0: 42.4, x1: 53.4, z0: -6.4, z1: 4.6 };
export const MESAS: Ponto[] = [-4.4, -1.6, 1.2].flatMap((z) =>
  [45.2, 47.4, 49.6, 51.6].map((x) => ({ x, z })),
);

// ---------------- pontos da praça ----------------
/** Totem do termômetro (queridômetro), à esquerda da fonte, e o ponto em frente onde o HOKI para. */
export const TERMOMETRO: Ponto = { x: -13.6, z: 5.2 };
export const FRENTE_DO_TERMOMETRO: Ponto = { x: -12.5, z: 4.4 };
/** Caixa postal, à direita da fonte (espelho do termômetro). */
export const CORREIO: Ponto = { x: 13.6, z: 5.2 };
export const FRENTE_DO_CORREIO: Ponto = { x: 12.5, z: 4.4 };
export const PLACA_QUERIDOMETRO: Ponto = { x: TERMOMETRO.x - 0.2, z: TERMOMETRO.z - 1.25 };
export const PLACA_CORREIO: Ponto = { x: CORREIO.x + 0.2, z: CORREIO.z - 1.25 };
/** Chuveirão, no fim da trilha da direita (o HOKI fica embaixo da ducha para tomar banho). */
export const CHUVEIRO: Ponto = { x: 15.6, z: 12.8 };
/** Coreto: à esquerda, embaixo, no fim da trilha. */
export const CORETO: Ponto = { x: -18.4, z: 10.4 };
export const RAIO_DO_CORETO = 3.1;
/** Arco de flores (pérgola) na trilha do coreto. */
export const ARCO_DE_FLORES: Ponto = { x: -11.9, z: 9.0 };
/** TOP 3: pódio pequeno no terraço ao norte, embaixo do letreiro HOST. */
export const TOP3: Ponto = { x: 0, z: -18.6 };
export const TERRACO_TOP3 = { x0: -6, x1: 6, z0: -22, z1: -15.4 };
/** Letreiro HOST flutuando atrás do terraço. */
export const LETREIRO = { x: 0, y: 10, z: -28 };

// ---------------- berço: a nuvem ao sul, e o escorregador turquesa que desce dela até a praça ----------------
export const BERCO = { x: 0, y: 2.7, z: 31.2 };
export const DECK_DO_BERCO = { meiaX: 4.6, meiaZ: 3.2 };
const COLCHAO = BERCO.y + 0.36;
/** As 20 vagas da nuvem: 5 colunas por 4 fileiras. Quem deita fica com a cabeça para o fundo. */
export const VAGAS: { x: number; y: number; z: number }[] = [0, 1, 2, 3].flatMap((f) =>
  [-2, -1, 0, 1, 2].map((c) => ({
    x: BERCO.x + c * 1.15,
    y: COLCHAO,
    z: BERCO.z - 1.1 + f * 0.95,
  })),
);
export function vagaDoBerco(i: number) {
  const n = Math.max(0, Math.floor(i));
  const camada = Math.floor(n / VAGAS.length);
  const base = VAGAS[n % VAGAS.length] ?? VAGAS[0]!;
  const torto = camada % 2 === 1;
  return {
    x: base.x + (torto ? 0.55 : 0),
    y: base.y + camada * 0.42,
    z: base.z + (torto ? 0.45 : 0),
  };
}
/** Plataforma redonda e brilhante onde o escorregador chega, no fim do caminho sul. */
export const PLATAFORMA = { x: 0, z: 17.6, r: 2.4 };
/** Pontos de controle do escorregador (x, y, z), do topo (na nuvem) até a plataforma. */
export const CURVA_DO_ESCORREGADOR: [number, number, number][] = [
  [0.6, BERCO.y + 0.5, BERCO.z - DECK_DO_BERCO.meiaZ - 0.1],
  [2.9, BERCO.y + 0.1, 26.6],
  [2.6, 1.85, 24.0],
  [-1.6, 1.25, 22.6],
  [-1.9, 0.75, 21.0],
  [0, 0.32, 19.6],
];
/** Curva suave (Catmull-Rom) passando pelos pontos de controle, com o comprimento de cada trecho. */
const AMOSTRAS = (() => {
  const p = CURVA_DO_ESCORREGADOR;
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const d = p[Math.min(p.length - 1, i + 2)]!;
    for (let k = 0; k < 16; k++) {
      const t = k / 16;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (j: number) =>
        0.5 *
        (2 * b[j]! +
          (-a[j]! + c[j]!) * t +
          (2 * a[j]! - 5 * b[j]! + 4 * c[j]! - d[j]!) * t2 +
          (-a[j]! + 3 * b[j]! - 3 * c[j]! + d[j]!) * t3);
      pts.push({ x: f(0), y: f(1), z: f(2) });
    }
  }
  const ult = p[p.length - 1]!;
  pts.push({ x: ult[0], y: ult[1], z: ult[2] });
  const acum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    acum.push(acum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return { pts, acum, total: acum[acum.length - 1]! };
})();
/** Pontos da curva do escorregador (para desenhar a calha). */
export const PONTOS_DO_ESCORREGADOR = AMOSTRAS.pts;
/** Onde está quem desce pelo escorregador: `f` vai de 0 (topo) a 1 (chegada), pelo comprimento da calha. */
export function noEscorregador(f: number) {
  const { pts, acum, total } = AMOSTRAS;
  const alvo = Math.max(0, Math.min(1, f)) * total;
  let i = 1;
  while (i < pts.length - 1 && acum[i]! < alvo) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const t = (alvo - acum[i - 1]!) / Math.max(0.0001, acum[i]! - acum[i - 1]!);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
/** Fim da calha: o HOKI escorrega até a plataforma e dali pula para a praça. */
export const AGUA_DA_PISCINA = 0.55;
export const MERGULHO: Ponto = { x: PLATAFORMA.x, z: PLATAFORMA.z + 0.4 };
export const CHEGADA: Ponto = { x: PLATAFORMA.x, z: PLATAFORMA.z - 3.2 };
/** Ponto de referência ao sul da praça (usado nos shows do Founder). */
export const ENTRADA: Ponto = { x: FONTE.x, z: 14.4 };
/**
 * Embarque do avião (evento do Founder): a fila fica no gramado do sudoeste, longe da piscina
 * e da calha do escorregador, e o avião para do lado de fora da cerca, encostado na beirada.
 * `EMBARQUE` é o meio da primeira fila (as outras vão para dentro da ilha).
 */
export const EMBARQUE: Ponto = { x: -13, z: 20.5 };
export const AVIAO_PARADO = { x: EMBARQUE.x + 0.6, y: 0.35, z: 25.2 };
/** Píer de madeira do embarque: a cerca abre aqui e as tábuas passam um pouco da beirada. */
export const PIER_DO_AVIAO = { x0: EMBARQUE.x - 2.6, x1: EMBARQUE.x + 2.6, z0: 21.2, z1: 23.4 };
/** Plaquinha "EMBARQUE" ao lado da fila (dois postes). */
export const PLACA_EMBARQUE: Ponto = { x: EMBARQUE.x - 4.8, z: PIER_DO_AVIAO.z0 - 0.9 };

/** Comércio HOST: barraca de feira no gramado a noroeste da fonte, de frente para o sul. */
export const COMERCIO = { x0: -15.9, x1: -12.1, z0: -8.5, z1: -6.9 };
export const CENTRO_DO_COMERCIO: Ponto = {
  x: (COMERCIO.x0 + COMERCIO.x1) / 2,
  z: (COMERCIO.z0 + COMERCIO.z1) / 2,
};
/** Onde o HOKI para para negociar (na frente do balcão). */
export const FRENTE_DO_COMERCIO: Ponto = { x: CENTRO_DO_COMERCIO.x, z: COMERCIO.z1 + 1.2 };

// ---------------- bancos ----------------
export interface Banco extends Ponto {
  /** Direção para onde quem senta fica olhando (ângulo em torno de Y). */
  ang: number;
  /** De onde o HOKI sobe para sentar (se não vier, é o ponto em frente ao banco). */
  de?: Ponto;
  /** Cadeira de escritório: quem senta fica trabalhando no computador. */
  trabalho?: boolean;
  /** (não usado mais: era o balanço do letreiro) */
  balanco?: boolean;
}
const olhando = (x: number, z: number, paraX: number, paraZ: number): Banco => ({
  x,
  z,
  ang: Math.atan2(paraX - x, paraZ - z),
});
export const BANCOS: Banco[] = [
  // oito em volta da fonte, entre os caminhos, olhando para ela
  ...Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    return olhando(FONTE.x + Math.cos(a) * 9.4, FONTE.z + Math.sin(a) * 9.4, FONTE.x, FONTE.z);
  }),
  // dois de cada lado do caminho do sul, olhando para ele
  ...[-1, 1].map((l) => olhando(l * 3.4, 14.6, 0, 14.6)),
  // dois na frente do terraço do TOP 3
  ...[-1, 1].map((l) => olhando(l * 3.4, -13.4, 0, -13.4)),
  // dois dentro do coreto, de frente um para o outro
  ...[-1, 1].map((l) => olhando(CORETO.x + l * 1.3, CORETO.z, CORETO.x, CORETO.z)),
  // dois na beira do caminho do oeste e dois na beira do caminho do leste (antes da pontezinha)
  ...[-1, 1].map((l) => olhando(-22, l * 3.2, -22, 0)),
  ...[-1, 1].map((l) => olhando(14.6, l * 3.2, 14.6, 0)),
  // cadeiras do escritório (uma por mesa): quem senta fica de frente para o monitor, trabalhando
  ...MESAS.map((m) => ({
    x: m.x,
    z: m.z + 1.0,
    ang: Math.PI,
    de: { x: m.x + (m.x > ESCRITORIO.x1 - 2.5 ? -1.0 : 1.0), z: m.z + 1.0 },
    trabalho: true,
  })),
];
export const frenteDoBanco = (b: Banco): Ponto =>
  b.de ?? {
    x: b.x + Math.sin(b.ang) * 1.3,
    z: b.z + Math.cos(b.ang) * 1.3,
  };
/** (não há mais balanço; ficam vazios para quem ainda procura por eles) */
export const LUGARES_DO_BALANCO: number[] = [];

/** Postes de luz: em volta da praça e ao longo dos caminhos. */
export const POSTES: Ponto[] = [
  ...Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    return { x: Math.cos(a) * 12.4, z: Math.sin(a) * 12.4 };
  }),
  ...[-1, 1].flatMap((l) => [
    { x: l * 2.7, z: -16.2 },
    { x: l * 2.7, z: 13.4 },
    { x: -17.4, z: l * 2.7 },
    { x: -26.6, z: l * 2.7 },
    { x: 24.6, z: l * 2.7 },
  ]),
];

/** Árvores (espelhadas dos dois lados), com o tipo e a cor da copa. */
type Arvore = Ponto & { tipo: "copa" | "copinha" | "pinheiro"; cor?: "laranja" | "amarelo" };
const METADE: Arvore[] = [
  { x: -8.6, z: -14.6, tipo: "copa", cor: "amarelo" },
  { x: -6.8, z: -19.6, tipo: "copinha" },
  { x: -17.8, z: -11.6, tipo: "pinheiro" },
  { x: -23.6, z: -8.4, tipo: "copa" },
  { x: -27.4, z: -4.2, tipo: "copinha", cor: "amarelo" },
  { x: -18.2, z: -4.6, tipo: "copa", cor: "laranja" },
  { x: -27.2, z: 6.4, tipo: "copa" },
  { x: -13.2, z: 15.8, tipo: "copa", cor: "amarelo" },
  { x: -7.4, z: 19.2, tipo: "pinheiro" },
  { x: -17.6, z: 17.8, tipo: "copinha" },
];
export const ARVORES: Arvore[] = [
  ...METADE,
  // do lado direito, o rio passa por onde ficariam algumas: elas vão um pouco para o lado
  ...METADE.map((a) => ({ ...a, x: -a.x })).filter(
    (a) => distLinha(a.x, a.z, RIO) > MEIA_RIO + 1.4,
  ),
  { x: 25.6, z: 9.6, tipo: "copa", cor: "amarelo" },
];

// ---------------- colheita (a fazenda antiga saiu: fica a lista vazia, para a HOST FAZENDAS usar depois) ----------------
export interface Canteiro extends Ponto {
  cultura: Cultura;
}
export const CANTEIROS: Canteiro[] = [];

// ---------------- o que não dá para atravessar ----------------
const OBSTACULOS: (Ponto & { r: number })[] = [
  { ...FONTE, r: ANEL.dentro - 0.1 },
  ...ARVORES.map((a) => ({ x: a.x, z: a.z, r: a.tipo === "copinha" ? 0.6 : 0.75 })),
  ...POSTES.map((p) => ({ ...p, r: 0.3 })),
  ...BANCOS.filter((b) => !b.trabalho).map((b) => ({ x: b.x, z: b.z, r: 0.7 })),
  ...MESAS.flatMap((m) => [-0.42, 0.42].map((d) => ({ x: m.x + d, z: m.z, r: 0.42 }))),
  { ...TERMOMETRO, r: 0.55 },
  { ...CORREIO, r: 0.4 },
  ...[PLACA_QUERIDOMETRO, PLACA_CORREIO].map((p) => ({ ...p, r: 0.35 })),
  ...[-0.7, 0, 0.7].map((d) => ({ x: PLACA_EMBARQUE.x + d, z: PLACA_EMBARQUE.z, r: 0.2 })),
  { x: CHUVEIRO.x - 0.62, z: CHUVEIRO.z - 0.62, r: 0.16 },
  // colunas do coreto (oito, em volta) e do arco de flores
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return {
      x: CORETO.x + Math.cos(a) * RAIO_DO_CORETO,
      z: CORETO.z + Math.sin(a) * RAIO_DO_CORETO,
      r: 0.3,
    };
  }),
  ...[-1, 1].map((l) => ({
    x: ARCO_DE_FLORES.x + l * 1.05,
    z: ARCO_DE_FLORES.z + l * 0.42,
    r: 0.25,
  })),
  // pódio do TOP 3
  ...[-0.7, 0, 0.7].map((d) => ({ x: TOP3.x + d, z: TOP3.z, r: 0.42 })),
  // pilares no pé das escadarias
  ...ESCADARIAS.flatMap(pilaresDaEscadaria).map((p) => ({ ...p, r: 0.6 })),
  // ilhas altas: moinho, árvores e postes
  { ...MOINHO, r: 1.1 },
  ...[...ARVORES_FAZENDAS, ...ARVORES_EM_BREVE].map((a) => ({ x: a.x, z: a.z, r: 0.7 })),
  ...[...POSTES_FAZENDAS, ...POSTES_EM_BREVE].map((p) => ({ ...p, r: 0.25 })),
  // pé da calha do escorregador (os apoios que ficam na ilha)
  ...PONTOS_DO_ESCORREGADOR.filter(
    (p, i) => i % 8 === 4 && p.z < beiradaEmZ(p.x) - 0.3 && p.z > PLATAFORMA.z + 1.6,
  ).map((p) => ({ x: p.x, z: p.z, r: 0.5 })),
  // Magnata: dados e peão
  ...DADOS_DO_MAGNATA.map((p) => ({ ...p, r: 0.6 })),
  { ...PEAO_DO_MAGNATA, r: 0.4 },
];
/** Paredes e caixas que não dá para atravessar (prédios das ilhas laterais). */
const PAREDES: Ret[] = [
  // prédio do Magnata, menos o vão da porta (o portal)
  {
    x0: PREDIO_MAGNATA.x0,
    x1: PREDIO_MAGNATA.x1,
    z0: PREDIO_MAGNATA.z0,
    z1: -PREDIO_MAGNATA.porta,
  },
  { x0: PREDIO_MAGNATA.x0, x1: PREDIO_MAGNATA.x1, z0: PREDIO_MAGNATA.porta, z1: PREDIO_MAGNATA.z1 },
  {
    x0: PREDIO_MAGNATA.x0,
    x1: PREDIO_MAGNATA.x1 - 0.9,
    z0: -PREDIO_MAGNATA.porta,
    z1: PREDIO_MAGNATA.porta,
  },
  // escritório: paredes do fundo, de cima e de baixo (a frente, virada para a ponte, é aberta)
  { x0: ESCRITORIO.x1 - 0.4, x1: ESCRITORIO.x1, z0: ESCRITORIO.z0, z1: ESCRITORIO.z1 },
  { x0: ESCRITORIO.x0, x1: ESCRITORIO.x1, z0: ESCRITORIO.z0, z1: ESCRITORIO.z0 + 0.4 },
  { x0: ESCRITORIO.x0, x1: ESCRITORIO.x1, z0: ESCRITORIO.z1 - 0.4, z1: ESCRITORIO.z1 },
  // terraço do TOP 3: o morrinho de trás (na frente dá para chegar perto do pódio)
  { x0: TERRACO_TOP3.x0, x1: TERRACO_TOP3.x1, z0: TERRACO_TOP3.z0 - 2, z1: TERRACO_TOP3.z0 + 1.6 },
  // barraca do Comércio (balcão e fundo)
  COMERCIO,
];

/** Dá para pisar fora da ilha central? (pontes, ilhas laterais, escadarias e ilhas altas) */
export const noAnexo = (x: number, z: number, folga = 0) =>
  (Math.abs(z) < PONTE_OESTE.meia - 0.4 + folga &&
    x >= PONTE_OESTE.x0 - 0.3 &&
    x <= PONTE_OESTE.x1 + folga) ||
  (Math.abs(z) < PONTE_LESTE.meia - 0.4 + folga &&
    x >= PONTE_LESTE.x0 - folga &&
    x <= PONTE_LESTE.x1 + 0.3) ||
  dentroDe(
    {
      x0: ILHA_MAGNATA.x0 + 0.7,
      x1: ILHA_MAGNATA.x1 - 0.1,
      z0: ILHA_MAGNATA.z0 + 0.7,
      z1: ILHA_MAGNATA.z1 - 0.7,
    },
    x,
    z,
    folga,
  ) ||
  dentroDe(
    {
      x0: ILHA_ESCRITORIO.x0 + 0.1,
      x1: ILHA_ESCRITORIO.x1 - 0.7,
      z0: ILHA_ESCRITORIO.z0 + 0.7,
      z1: ILHA_ESCRITORIO.z1 - 0.7,
    },
    x,
    z,
    folga,
  ) ||
  naPonteFazendas(x, z, folga) ||
  naIlhaFazendas(x, z, folga);

/** Dá para um HOKI ficar neste ponto? (dentro da ilha ou de um anexo, fora da água e dos obstáculos) */
export function livre(x: number, z: number) {
  if (!noAnexo(x, z)) {
    if (!dentroDaIlha(x, z, 0.9)) return false;
    if (naAgua(x, z, CORPO) && !naPonte(x, z)) return false;
  }
  for (const p of PAREDES) if (dentroDe(p, x, z, CORPO)) return false;
  for (const o of OBSTACULOS) if (Math.hypot(x - o.x, z - o.z) < o.r + CORPO) return false;
  return true;
}

// Grade de caminhada: a ilha dividida em quadradinhos de meio bloco, marcados como livres ou não.
const PASSO = 0.5;
const X0 = -56; // começa na ilha do Magnata, a oeste
const Z0 = -51; // começa nas ilhas altas, ao norte
const NX = 225; // de x = -56 (Magnata) até x = 56 (escritório)
const NZ = 149; // de z = -51 (ilhas altas) até z = 23 (beirada sul)
let grade: Uint8Array | null = null;
function celulas() {
  if (!grade) {
    grade = new Uint8Array(NX * NZ);
    const solto = new Uint8Array(NX * NZ);
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++)
        solto[i + j * NX] = livre(X0 + i * PASSO, Z0 + j * PASSO) ? 1 : 0;
    // só vale o que dá para alcançar a partir da entrada: cantinhos isolados atrás de árvores ficam de fora
    // (começa no anel da fonte: a entrada do sul agora tem a piscina do escorregador)
    const inicio = { x: FONTE.x, z: FONTE.z + 6 };
    const fila = [Math.round((inicio.x - X0) / PASSO) + Math.round((inicio.z - Z0) / PASSO) * NX];
    grade[fila[0]!] = 1;
    while (fila.length) {
      const c = fila.pop()!;
      const i = c % NX;
      const j = Math.floor(c / NX);
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const v = ni + nj * NX;
        if (solto[v] && !grade[v]) {
          grade[v] = 1;
          fila.push(v);
        }
      }
    }
  }
  return grade;
}
const centro = (c: number): Ponto => ({
  x: X0 + (c % NX) * PASSO,
  z: Z0 + Math.floor(c / NX) * PASSO,
});
/** Quadradinho livre mais perto do ponto (procura em volta, cada vez mais longe). */
function celulaPerto(p: Ponto): number {
  const g = celulas();
  const ci = Math.round((p.x - X0) / PASSO);
  const cj = Math.round((p.z - Z0) / PASSO);
  let melhor = -1;
  let menor = Infinity;
  for (let raio = 0; raio <= 12 && melhor < 0; raio++) {
    for (let j = cj - raio; j <= cj + raio; j++) {
      for (let i = ci - raio; i <= ci + raio; i++) {
        if (i < 0 || j < 0 || i >= NX || j >= NZ || !g[i + j * NX]) continue;
        const d = Math.hypot(X0 + i * PASSO - p.x, Z0 + j * PASSO - p.z);
        if (d < menor) {
          menor = d;
          melhor = i + j * NX;
        }
      }
    }
  }
  return melhor;
}
/** Dá para ir em linha reta de um ponto ao outro sem bater em nada? */
function visivel(a: Ponto, b: Ponto) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25);
  for (let k = 1; k < n; k++)
    if (!livre(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n)) return false;
  return true;
}

/** Ajusta o lugar clicado para o ponto livre mais perto. Devolve null se for fora da ilha ou longe demais de onde dá para pisar. */
export function ajustar(alvo: Ponto): Ponto | null {
  if (!dentroDaIlha(alvo.x, alvo.z, 0.3) && !noAnexo(alvo.x, alvo.z, 0.7)) return null;
  const c = celulaPerto(alvo);
  if (c < 0) return null;
  const p = centro(c);
  const d = Math.hypot(p.x - alvo.x, p.z - alvo.z);
  if (d < 0.4 && livre(alvo.x, alvo.z)) return alvo;
  return d <= 5 ? p : null;
}

/**
 * Rota de `de` até `para` contornando rio (pela ponte), morro e obstáculos:
 * busca o menor caminho na grade (A*) e depois "estica" a rota, deixando só as curvas necessárias.
 */
export function planejar(de: Ponto, para: Ponto): Ponto[] {
  if (visivel(de, para) && livre(para.x, para.z)) return [para];
  const g = celulas();
  const inicio = celulaPerto(de);
  const fim = celulaPerto(para);
  if (inicio < 0 || fim < 0) return [para];
  const custo = new Float32Array(NX * NZ).fill(Infinity);
  const veio = new Int32Array(NX * NZ).fill(-1);
  const fechado = new Uint8Array(NX * NZ);
  const fx = fim % NX;
  const fz = Math.floor(fim / NX);
  const abertos: number[] = [inicio];
  custo[inicio] = 0;
  while (abertos.length) {
    let k = 0;
    let melhor = Infinity;
    for (let n = 0; n < abertos.length; n++) {
      const c = abertos[n]!;
      const f = custo[c]! + Math.hypot((c % NX) - fx, Math.floor(c / NX) - fz);
      if (f < melhor) {
        melhor = f;
        k = n;
      }
    }
    const atual = abertos[k]!;
    if (atual === fim) break;
    abertos[k] = abertos[abertos.length - 1]!;
    abertos.pop();
    if (fechado[atual]) continue;
    fechado[atual] = 1;
    const i = atual % NX;
    const j = Math.floor(atual / NX);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const viz = ni + nj * NX;
        if (!g[viz] || fechado[viz]) continue;
        // na diagonal, não corta a quina de um obstáculo
        if (di && dj && (!g[i + di + j * NX] || !g[i + (j + dj) * NX])) continue;
        const novo = custo[atual]! + (di && dj ? 1.4142 : 1);
        if (novo < custo[viz]!) {
          custo[viz] = novo;
          veio[viz] = atual;
          abertos.push(viz);
        }
      }
    }
  }
  if (veio[fim] === -1 && fim !== inicio) return [];
  const bruta: Ponto[] = [];
  for (let c = fim; c !== -1 && c !== inicio; c = veio[c]!) bruta.push(centro(c));
  bruta.reverse();
  if (livre(para.x, para.z)) bruta.push(para);
  // estica: de onde estou, pula direto para o ponto mais distante que ainda é visível
  const rota: Ponto[] = [];
  let ancora = de;
  let idx = 0;
  while (idx < bruta.length) {
    let longe = idx;
    for (let n = bruta.length - 1; n > idx; n--) {
      if (visivel(ancora, bruta[n]!)) {
        longe = n;
        break;
      }
    }
    ancora = bruta[longe]!;
    rota.push(ancora);
    idx = longe + 1;
  }
  return rota;
}

/** Um passo em linha reta em direção ao próximo ponto da rota. */
export function avancar(pos: Ponto, alvo: Ponto, passo: number): Ponto & { chegou: boolean } {
  const dx = alvo.x - pos.x;
  const dz = alvo.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= passo) return { x: alvo.x, z: alvo.z, chegou: true };
  return { x: pos.x + (dx / dist) * passo, z: pos.z + (dz / dist) * passo, chegou: false };
}
