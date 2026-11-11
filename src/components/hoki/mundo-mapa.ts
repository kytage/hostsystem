/**
 * Mapa da Praça HOST em 3D: o traçado da ilha (fonte, caminhos, rio, ponte,
 * coreto, morro), os 20 bancos e as regras de caminhada. Aqui só tem contas,
 * sem nada de desenho: o cenário é montado em mundo-cena.ts a partir disto.
 * Unidades: 1 = um bloco do chão. X cresce para a direita, Z para a frente.
 */
import type { Cultura } from "@/lib/hoki-itens";

export interface Ponto {
  x: number;
  z: number;
}

export const ILHA = { a: 23.5, b: 15.5, n: 3.2 };
export const FONTE: Ponto = { x: -1, z: 0 };
/** Anel calçado em volta da fonte. */
export const ANEL = { dentro: 4.4, fora: 8.2 };
export const CORETO: Ponto = { x: -14.5, z: -8.5 };
export const RIO = { meia: 1.7, inicio: -9.5 };
/** Morro com a cachoeira, no fundo à direita (não dá para subir). */
export const MORRO = { x0: 16.5, z1: -8.5 };
export const ENTRADA: Ponto = { x: FONTE.x, z: FONTE.z + 12 };
/** Raio do "corpo" de um HOKI, para não atravessar as coisas. */
export const CORPO = 0.45;

/** Centro do rio em cada Z (ele serpenteia). */
export const xRio = (z: number) => 15.5 + 1.8 * Math.sin(z * 0.22 + 0.6);
/** A ponte fica alinhada com o caminho do leste. */
export const PONTE = { z: FONTE.z, meia: 1.5 };

export function dentroDaIlha(x: number, z: number, folga = 0) {
  return (
    Math.pow(Math.abs(x) / (ILHA.a - folga), ILHA.n) +
      Math.pow(Math.abs(z) / (ILHA.b - folga), ILHA.n) <
    1
  );
}
export const naAgua = (x: number, z: number, folga = 0) =>
  z >= RIO.inicio && Math.abs(x - xRio(z)) < RIO.meia + folga;
export const naPonte = (z: number) => Math.abs(z - PONTE.z) < PONTE.meia - 0.4;
export const noMorro = (x: number, z: number) => x > MORRO.x0 && z < MORRO.z1;

/** Retângulos calçados: os caminhos, a pracinha do norte e o piso do coreto. */
export const CAMINHOS = [
  { x0: FONTE.x - 1.5, x1: FONTE.x + 1.5, z0: FONTE.z + 8, z1: 16 },
  { x0: FONTE.x - 1.5, x1: FONTE.x + 1.5, z0: -14, z1: FONTE.z - 8 },
  { x0: FONTE.x + 8, x1: 23, z0: FONTE.z - 1.5, z1: FONTE.z + 1.5 },
  { x0: -23.2, x1: FONTE.x - 8, z0: FONTE.z - 1.5, z1: FONTE.z + 1.5 },
  { x0: -16, x1: -13, z0: -6, z1: FONTE.z - 1.5 },
  { x0: FONTE.x - 4, x1: FONTE.x + 4, z0: -14, z1: -11 },
  { x0: CORETO.x - 3, x1: CORETO.x + 3, z0: CORETO.z - 3, z1: CORETO.z + 3 },
];
/** Tipo de piso de cada bloco do chão. */
export function piso(x: number, z: number): "anel" | "caminho" | "grama" {
  const d = Math.hypot(x - FONTE.x, z - FONTE.z);
  if (d >= ANEL.dentro && d <= ANEL.fora) return "anel";
  for (const c of CAMINHOS) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return "caminho";
  return "grama";
}

export interface Banco extends Ponto {
  /** Direção para onde quem senta fica olhando (ângulo em torno de Y). */
  ang: number;
  /** De onde o HOKI sobe para sentar (se não vier, é o ponto em frente ao banco). */
  de?: Ponto;
  /** Cadeira de escritório: quem senta fica trabalhando no computador. */
  trabalho?: boolean;
  /** Lugar do balanço do letreiro HOST (o assento se mexe; a posição vem do mundo 3D). */
  balanco?: boolean;
}

/**
 * Balanço pendurado no letreiro HOST: um banco comprido, para 10, que balança
 * para a frente e para trás sobre a beira de trás da ilha. O vai e vem sai do
 * relógio do mundo real, então todo mundo vê o balanço no mesmo ponto.
 */
export const BALANCO = {
  /** Onde as cordas prendem: no pé das letras do letreiro. */
  eixo: { x: 0, y: 9.8, z: -19 },
  /** Comprimento das cordas (do pé das letras até o assento). */
  corda: 8.6,
  lugares: 10,
  /** Distância entre um lugar e outro. */
  passo: 0.84,
  /** O quanto ele abre (em radianos) e quanto dura um vai e vem (ms). */
  amplitude: 0.4,
  periodoMs: 5200,
};
/** Ângulo do balanço agora (positivo = para a frente, na direção da ilha). */
export const anguloDoBalanco = (agoraMs = Date.now()) =>
  BALANCO.amplitude * Math.sin((agoraMs / BALANCO.periodoMs) * Math.PI * 2);
/** Na beira de trás da ilha, embaixo do balanço: dali o HOKI pula para o assento (tecla E). */
export const EMBARQUE_DO_BALANCO: Ponto = { x: 0, z: -14.3 };

/** Escritório HOST: um anexo flutuante a leste, ligado à ilha por uma ponte no fim do caminho. */
export const ESCRITORIO = { x0: 33, x1: 43, z0: -4.5, z1: 4.5 };
export const PONTE_DO_ESCRITORIO = { x0: 22.2, x1: ESCRITORIO.x0, meia: 1.25 };
/** Mesas de trabalho (centro do tampo). A cadeira fica atrás, olhando para o monitor (para o fundo). */
export const MESAS: Ponto[] = [-3.4, -0.6, 2.2].flatMap((z) =>
  [2.9, 4.9, 6.9, 8.75].map((dx) => ({ x: ESCRITORIO.x0 + dx, z })),
);
/**
 * Fazenda: um anexo grande a oeste, no fim de uma ponte bem comprida. Ao pisar
 * na ponte o HOKI dispara e só para na outra ponta (na ida e na volta).
 */
export const FAZENDA = { x0: -78, x1: -62, z0: -7, z1: 7 };
export const PONTE_DA_FAZENDA = { x0: FAZENDA.x1, x1: -22.2, meia: 1.25 };
/** Está em cima da ponte da fazenda (o trecho da disparada)? */
export const naPonteDaFazenda = (x: number, z: number) =>
  x > PONTE_DA_FAZENDA.x0 + 0.6 &&
  x < PONTE_DA_FAZENDA.x1 - 0.6 &&
  Math.abs(z) < PONTE_DA_FAZENDA.meia;
/** Um clique caiu na ponte da fazenda (inclusive bem perto das pontas)? Aí o HOKI vai direto até a outra ponta. */
export const cliqueNaPonteDaFazenda = (x: number, z: number) =>
  // de longe a ponte é uma linha fina: o clique vale com folga dos lados (ali só tem o vazio)
  x > PONTE_DA_FAZENDA.x0 - 0.6 &&
  x < PONTE_DA_FAZENDA.x1 + 1.4 &&
  Math.abs(z) < PONTE_DA_FAZENDA.meia + 1.6;
/** As duas pontas da ponte da fazenda: a do lado da fazenda e a do lado da ilha. */
export const PONTAS_DA_FAZENDA: [Ponto, Ponto] = [
  { x: PONTE_DA_FAZENDA.x0 - 0.9, z: 0 },
  { x: PONTE_DA_FAZENDA.x1 + 0.9, z: 0 },
];
/** Um lugar da fazenda que dá para colher: canteiro da horta, árvore do pomar, bicho ou a mina de água. */
export interface Canteiro extends Ponto {
  cultura: Cultura;
}
const fileira = (cultura: Cultura, x: number, zs: number[]): Canteiro[] =>
  zs.map((z) => ({ cultura, x, z }));
export const CANTEIROS: Canteiro[] = [
  // horta do norte e horta do sul, uma fileira por cultura
  ...fileira("milho", -64.5, [-2.5, -4, -5.5]),
  ...fileira("cenoura", -66.5, [-2.5, -4, -5.5]),
  ...fileira("tomate", -68.5, [-2.5, -4, -5.5]),
  ...fileira("batata", -70.5, [-2.5, -4, -5.5]),
  ...fileira("morango", -64.5, [2.5, 4, 5.5]),
  ...fileira("abobora", -66.5, [2.5, 4, 5.5]),
  ...fileira("melancia", -68.5, [2.5, 4, 5.5]),
  ...fileira("uva", -70.5, [2.5, 4, 5.5]),
  // no fundo: o pomar, os bichos e a mina de água
  { cultura: "maca", x: -73.5, z: -4.6 },
  { cultura: "banana", x: -76, z: -2.4 },
  { cultura: "laranja", x: -73.5, z: 4.6 },
  { cultura: "coco", x: -76.2, z: 5.4 },
  { cultura: "cafe", x: -73.2, z: 1.9 },
  { cultura: "ovo", x: -76.2, z: -5.6 },
  { cultura: "leite", x: -76, z: 1 },
  { cultura: "agua", x: -72.6, z: -1.6 },
  // na praça: a floricultura (vasos no gramado da frente) e a doceria (carrinho ao norte, perto da fonte)
  { cultura: "rosa", x: 3.6, z: 11.3 },
  { cultura: "girassol", x: 4.7, z: 12.3 },
  { cultura: "tulipa", x: 3.6, z: 13.3 },
  { cultura: "chocolate", x: 5.4, z: -6.5 },
  { cultura: "bala", x: 6.3, z: -5.5 },
  // no escritório: a prateleira de brindes, no canto da entrada
  { cultura: "ursinho", x: ESCRITORIO.x0 + 1.0, z: ESCRITORIO.z1 - 1.2 },
];
/** Culturas que ocupam o chão (não dá para atravessar): árvores, bichos e a mina. As da horta, dá. */
const OCUPA: Partial<Record<Cultura, number>> = {
  maca: 0.5,
  banana: 0.5,
  laranja: 0.5,
  coco: 0.5,
  cafe: 0.35,
  ovo: 0.6,
  leite: 0.65,
  agua: 0.7,
  chocolate: 0.55,
  bala: 0.55,
  ursinho: 0.45,
};

/** Dá para pisar no anexo? (as pontes, o piso do escritório e o da fazenda, com `folga` a mais em volta) */
export const noAnexo = (x: number, z: number, folga = 0) =>
  (x >= PONTE_DA_FAZENDA.x0 - 0.3 &&
    x <= PONTE_DA_FAZENDA.x1 + folga &&
    Math.abs(z) < PONTE_DA_FAZENDA.meia - 0.4 + folga) ||
  (x >= FAZENDA.x0 + 0.6 - folga &&
    x <= FAZENDA.x1 - 0.1 + folga &&
    z >= FAZENDA.z0 + 0.6 - folga &&
    z <= FAZENDA.z1 - 0.6 + folga) ||
  (x >= PONTE_DO_ESCRITORIO.x0 - folga &&
    x <= PONTE_DO_ESCRITORIO.x1 + 0.3 &&
    Math.abs(z) < PONTE_DO_ESCRITORIO.meia - 0.4 + folga) ||
  (x >= ESCRITORIO.x0 + 0.1 - folga &&
    x <= ESCRITORIO.x1 - 0.6 + folga &&
    z >= ESCRITORIO.z0 + 0.6 - folga &&
    z <= ESCRITORIO.z1 - 0.6 + folga);
const olhando = (x: number, z: number, paraX: number, paraZ: number): Banco => ({
  x,
  z,
  ang: Math.atan2(paraX - x, paraZ - z),
});
/** Os 20 bancos: 8 em volta da fonte, 4 no caminho da frente, 2 na pracinha do norte, 2 no coreto, 2 no caminho do oeste e 2 na beira do rio. */
export const BANCOS: Banco[] = [
  ...[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((g) => {
    const a = (g * Math.PI) / 180;
    return olhando(FONTE.x + Math.cos(a) * 9.1, FONTE.z + Math.sin(a) * 9.1, FONTE.x, FONTE.z);
  }),
  ...[10.5, 13].flatMap((dz) =>
    [-1, 1].map((l) => olhando(FONTE.x + l * 2.7, FONTE.z + dz, FONTE.x, FONTE.z + dz)),
  ),
  ...[-1, 1].map((l) => olhando(FONTE.x + l * 3.2, -12.6, FONTE.x + l * 3.2, 0)),
  ...[-1, 1].map((l) => olhando(CORETO.x + l * 1.5, CORETO.z, CORETO.x, CORETO.z)),
  ...[-1, 1].map((l) => olhando(-12.2, FONTE.z + l * 2.7, -12.2, FONTE.z)),
  olhando(xRio(5.5) - 4.2, 5.5, 30, 5.5),
  olhando(xRio(9) - 4.2, 9, 30, 9),
  // cadeiras do escritório (uma por mesa): quem senta fica de frente para o monitor, trabalhando
  ...MESAS.map((m) => ({
    x: m.x,
    z: m.z + 1.0,
    ang: Math.PI,
    // chega pelo corredor ao lado da cadeira (a última coluna, pelo outro lado)
    de: { x: m.x + (m.x > ESCRITORIO.x1 - 2 ? -1.0 : 1.0), z: m.z + 1.0 },
    trabalho: true,
  })),
  // os 10 lugares do balanço do letreiro (ficam no fim da lista para não mudar o número dos outros bancos)
  ...Array.from({ length: BALANCO.lugares }, (_, i) => {
    const x = (i - (BALANCO.lugares - 1) / 2) * BALANCO.passo;
    return {
      x,
      z: BALANCO.eixo.z,
      ang: 0,
      // cada um sobe por um ponto da beira da ilha, na direção do seu lugar
      de: { x: x * 0.62, z: EMBARQUE_DO_BALANCO.z },
      balanco: true,
    };
  }),
];
/** Números (na lista de bancos) dos lugares do balanço. */
export const LUGARES_DO_BALANCO = BANCOS.flatMap((b, i) => (b.balanco ? [i] : []));
/** Ponto em frente ao banco, de onde o HOKI "sobe" para sentar. */
export const frenteDoBanco = (b: Banco): Ponto =>
  b.de ?? {
    x: b.x + Math.sin(b.ang) * 1.3,
    z: b.z + Math.cos(b.ang) * 1.3,
  };

export const POSTES: Ponto[] = [
  ...[-1, 1].flatMap((l) => [
    { x: FONTE.x + l * 2.2, z: FONTE.z + 8.9 },
    { x: FONTE.x + l * 2.2, z: FONTE.z - 8.9 },
    { x: FONTE.x + 8.9, z: FONTE.z + l * 2.2 },
    { x: FONTE.x - 8.9, z: FONTE.z + l * 2.2 },
  ]),
  { x: xRio(0) - 3, z: 2.3 },
  { x: xRio(0) + 3, z: -2.3 },
];
export const ARVORES: (Ponto & {
  tipo: "copa" | "copinha" | "pinheiro";
  cor?: "laranja" | "amarelo";
})[] = [
  { x: -8, z: -9.5, tipo: "copa" },
  { x: -19, z: -3.5, tipo: "pinheiro" },
  { x: -18.5, z: 5, tipo: "copa", cor: "amarelo" },
  { x: -11.5, z: 9.5, tipo: "copa", cor: "laranja" },
  { x: -6.5, z: 11.5, tipo: "pinheiro" },
  { x: 8, z: -9.5, tipo: "copa", cor: "laranja" },
  { x: 11.5, z: -6, tipo: "pinheiro" },
  { x: 4.5, z: -11.5, tipo: "copinha", cor: "amarelo" },
  { x: -20, z: -8.5, tipo: "copinha", cor: "amarelo" },
  { x: -9.5, z: -12.5, tipo: "pinheiro" },
  { x: 21.4, z: 6, tipo: "copinha" },
  { x: 19.5, z: -4.5, tipo: "copinha", cor: "laranja" },
  { x: 20.9, z: 9.8, tipo: "copinha" },
  { x: -15.5, z: 10, tipo: "pinheiro" },
];
export const PEDRAS: Ponto[] = [
  { x: -10, z: 6.5 },
  { x: 10.5, z: -9.5 },
  { x: -5.5, z: -10.5 },
  { x: 6, z: 9 },
  { x: 19, z: 9.5 },
];
/** Poça onde cai a cachoeira do morro. */
export const POCA: Ponto = { x: 18, z: -7.4 };
/** Os 4 pilares do coreto. */
export const PILARES: Ponto[] = [-1, 1].flatMap((i) =>
  [-1, 1].map((j) => ({ x: CORETO.x + i * 2.4, z: CORETO.z + j * 2.4 })),
);

/** Pérgolas das áreas de descanso, cada uma cobrindo um ou dois bancos (retângulos no chão). */
export const PERGOLAS = [
  { x0: -13.6, x1: -10.8, z0: 1.9, z1: 3.7 },
  { x0: 11.2, x1: 13.9, z0: 4.3, z1: 9.9 },
  { x0: -5.4, x1: -3.0, z0: -13.5, z1: -11.7 },
  { x0: 1.0, x1: 3.4, z0: -13.5, z1: -11.7 },
];
/** Postes de uma pérgola: nos cantos e, nas compridas, também no meio. */
export const postesDaPergola = (p: (typeof PERGOLAS)[number]): Ponto[] =>
  (p.z1 - p.z0 > 4 ? [p.z0, (p.z0 + p.z1) / 2, p.z1] : [p.z0, p.z1]).flatMap((z) => [
    { x: p.x0, z },
    { x: p.x1, z },
  ]);

/**
 * Berçário: uma ilhota flutuante na frente da ilha, mais alta que a praça.
 * Quem está com o site aberto fica deitado aqui até acordar. (x, z) é o centro
 * do deck e `y` a altura do piso dele.
 */
export const BERCO = { x: 8.25, y: 5, z: 18.2 };
/** Meia largura (x) e meia fundura (z) do deck do berçário. */
export const DECK_DO_BERCO = { meiaX: 3.25, meiaZ: 2.55 };
/** Altura em que o HOKI deita (em cima do colchão). */
const COLCHAO = BERCO.y + 0.36;
/** As 20 vagas do berço: 5 colunas por 4 fileiras. Quem deita fica com a cabeça para o fundo. */
export const VAGAS: { x: number; y: number; z: number }[] = [0, 1, 2, 3].flatMap((f) =>
  [-2, -1, 0, 1, 2].map((c) => ({ x: BERCO.x + c * 1.0, y: COLCHAO, z: BERCO.z - 1.3 + f * 0.9 })),
);
/**
 * Vaga de quem dorme no berço. Passando de 20 pessoas, as próximas deitam numa
 * camada de cima, um pouco deslocada, para ninguém ficar escondido embaixo de outro.
 */
export function vagaDoBerco(i: number) {
  const n = Math.max(0, Math.floor(i));
  const camada = Math.floor(n / VAGAS.length);
  const base = VAGAS[n % VAGAS.length] ?? VAGAS[0]!;
  const torto = camada % 2 === 1;
  return {
    x: base.x + (torto ? 0.5 : 0),
    y: base.y + camada * 0.42,
    z: base.z + (torto ? 0.45 : 0),
  };
}
/** Escorregador: sai do fundo do deck e desce até o gramado, entre duas árvores. */
export const ESCORREGADOR = {
  topo: { x: BERCO.x, y: BERCO.y + 0.05, z: BERCO.z - DECK_DO_BERCO.meiaZ },
  pe: { x: BERCO.x, y: 0.3, z: 9.4 },
};
/** Onde o HOKI pousa ao sair do escorregador. */
export const CHEGADA: Ponto = { x: BERCO.x - 0.15, z: 8.4 };
/** Totem do termômetro (queridômetro), no gramado ao lado da praça, e o ponto em frente onde o HOKI para. */
export const TERMOMETRO: Ponto = { x: -7.8, z: 6.8 };
export const FRENTE_DO_TERMOMETRO: Ponto = { x: -6.95, z: 5.95 };
/** Caixa do correio (cartão postal), na beira do anel da fonte (lado de cima, à esquerda), e o ponto em frente onde o HOKI para. */
export const CORREIO: Ponto = { x: -7.3, z: -6.3 };
export const FRENTE_DO_CORREIO: Ponto = { x: -6.45, z: -5.45 };
/** Chuveirão: na beira do caminho do leste, antes da ponte do rio. O HOKI fica embaixo da ducha para tomar banho. */
export const CHUVEIRO: Ponto = { x: 11.2, z: -2.9 };
/** Portal do parkour, na beirada da frente da ilha, e o ponto onde o HOKI para diante dele. */
export const PARKOUR: Ponto = { x: -13, z: 13.2 };
export const FRENTE_DO_PARKOUR: Ponto = { x: -13, z: 11.9 };

/** Coisas redondas que não dá para atravessar. */
const OBSTACULOS: (Ponto & { r: number })[] = [
  { ...FONTE, r: ANEL.dentro - 0.1 },
  ...ARVORES.map((a) => ({ x: a.x, z: a.z, r: a.tipo === "copinha" ? 0.6 : 0.75 })),
  ...POSTES.map((p) => ({ ...p, r: 0.3 })),
  ...PILARES.map((p) => ({ ...p, r: 0.4 })),
  ...PEDRAS.map((p) => ({ ...p, r: 0.6 })),
  { ...POCA, r: 1.3 },
  // (os lugares do balanço ficam no ar, fora da ilha: não bloqueiam o chão)
  ...BANCOS.filter((b) => !b.balanco).map((b) => ({ x: b.x, z: b.z, r: b.trabalho ? 0.42 : 0.7 })),
  // tampos das mesas do escritório
  ...MESAS.flatMap((m) => [-0.42, 0.42].map((d) => ({ x: m.x + d, z: m.z, r: 0.42 }))),
  ...PERGOLAS.flatMap(postesDaPergola).map((p) => ({ ...p, r: 0.2 })),
  { ...TERMOMETRO, r: 0.5 },
  { ...CORREIO, r: 0.35 },
  // poste do chuveirão (a ducha em si fica livre, para o HOKI entrar embaixo)
  { x: CHUVEIRO.x - 0.62, z: CHUVEIRO.z - 0.62, r: 0.16 },
  ...CANTEIROS.flatMap((c) =>
    OCUPA[c.cultura] ? [{ x: c.x, z: c.z, r: OCUPA[c.cultura] ?? 0.5 }] : [],
  ),
  ...[-0.95, 0.95].map((d) => ({ x: PARKOUR.x + d, z: PARKOUR.z, r: 0.3 })),
  // a parte baixa do escorregador e os dois pares de pés dele
  ...[9.9, 10.7, 11.5].map((z) => ({ x: ESCORREGADOR.pe.x, z, r: 0.5 })),
  ...[12.4, 14].flatMap((z) => [-0.5, 0.5].map((d) => ({ x: ESCORREGADOR.pe.x + d, z, r: 0.2 }))),
];

/** Dá para um HOKI ficar neste ponto? (dentro da ilha, fora da água, do morro e dos obstáculos) */
export function livre(x: number, z: number) {
  // fora da ilha só dá para pisar na ponte e no piso do escritório
  if (!noAnexo(x, z)) {
    if (!dentroDaIlha(x, z, 0.9) || noMorro(x, z)) return false;
    if (naAgua(x, z, CORPO) && !naPonte(z)) return false;
  }
  for (const o of OBSTACULOS) if (Math.hypot(x - o.x, z - o.z) < o.r + CORPO) return false;
  return true;
}

// Grade de caminhada: a ilha dividida em quadradinhos de meio bloco, marcados como livres ou não.
const PASSO = 0.5;
const X0 = -79; // começa na fazenda, a oeste
const Z0 = -16;
const NX = 247; // de x = -79 (fazenda) até x = 44 (escritório)
const NZ = 65;
let grade: Uint8Array | null = null;
function celulas() {
  if (!grade) {
    grade = new Uint8Array(NX * NZ);
    const solto = new Uint8Array(NX * NZ);
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++)
        solto[i + j * NX] = livre(X0 + i * PASSO, Z0 + j * PASSO) ? 1 : 0;
    // só vale o que dá para alcançar a partir da entrada: cantinhos isolados atrás de árvores ficam de fora
    const fila = [Math.round((ENTRADA.x - X0) / PASSO) + Math.round((ENTRADA.z - Z0) / PASSO) * NX];
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
