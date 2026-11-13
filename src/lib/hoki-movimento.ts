/**
 * Controle direto do HOKI na praça: andar, correr e pular.
 *
 * Contas puras (sem three.js), para poderem ser testadas. A ideia da sensação
 * vem do estudo do Hyperfy (velocidade que chega no alvo de forma exponencial,
 * igual no chão e no ar; gravidade só fora do chão; corpo grudado em rampas),
 * mas o código é nosso. Acrescentamos o que o Hyperfy não tem: tolerância de
 * beirada ("coyote time"), memória do pulo apertado um pouco antes de tocar o
 * chão e um empurrãozinho para contornar quinas e entrar em passagens estreitas.
 *
 * Unidades: blocos do chão e segundos. O HOKI tem ~1,14 bloco de altura.
 */

export const MOV = {
  /**
   * Padrão "estilo Fortnite": sem apertar nada o boneco já vai num trote (igual à
   * velocidade do clique) e o Shift (ou o joystick todo para fora) dispara.
   */
  ANDAR: 4.3,
  /** Disparando (Shift ou joystick todo para fora). */
  CORRER: 6.6,
  /** Com fome ou sede anda devagar (e não corre). */
  LENTO: 0.45,
  /** Quão rápido a velocidade chega no alvo (1/s): 96% em ~0,3 s, igual para frear. */
  ACELERACAO: 10,
  /** Gravidade (blocos/s²) e altura do pulo (blocos): pulo curto e firme, ~0,7 s no ar. */
  GRAVIDADE: 20,
  PULO: 1.2,
  /** Ainda dá para pular logo depois de sair da beirada. */
  COYOTE: 0.1,
  /** Pulo apertado um pouco antes de tocar o chão vale quando tocar. */
  MEMORIA_PULO: 0.13,
  /** Andando para fora de um degrau mais alto que isso, começa a cair. */
  DEGRAU: 0.35,
  /** Abaixo disso o corpo está parado. */
  PARADO: 0.05,
} as const;

/** O que o mapa da praça responde (livre para andar e altura do chão). */
export interface MapaMovimento {
  livre(x: number, z: number): boolean;
  chao(x: number, z: number): number;
}

export interface CorpoHoki {
  x: number;
  z: number;
  /** Altura dos pés (absoluta). */
  y: number;
  vx: number;
  vz: number;
  vy: number;
  noChao: boolean;
  /** Está subindo por um pulo (não gruda no chão nem usa a tolerância de beirada). */
  pulando: boolean;
  /** Há quanto tempo saiu do chão sem pular (para a tolerância de beirada). */
  fora: number;
  /** Quanto tempo ainda vale o pulo apertado. */
  memoriaPulo: number;
  /** Para onde o corpo vira (ângulo no chão: atan2(vx, vz)). */
  rumo: number;
}

export interface EntradaMovimento {
  /** -1 a 1: para frente (+) ou para trás (-), em relação à câmera. */
  frente: number;
  /** -1 a 1: para a direita (+) ou para a esquerda (-). */
  lado: number;
  correr: boolean;
  /** Apertou pular neste quadro. */
  pular: boolean;
}

export interface ResultadoPasso {
  /** Velocidade no chão (blocos/s). */
  velocidade: number;
  andando: boolean;
  correndo: boolean;
  pulou: boolean;
  aterrissou: boolean;
  /** Bateu e não conseguiu andar para onde queria. */
  bateu: boolean;
}

export function criarCorpo(x: number, z: number, y: number, rumo = 0): CorpoHoki {
  return {
    x,
    z,
    y,
    vx: 0,
    vz: 0,
    vy: 0,
    noChao: true,
    pulando: false,
    fora: 0,
    memoriaPulo: 0,
    rumo,
  };
}

/** Velocidade inicial do pulo para chegar na altura `MOV.PULO` com a gravidade `MOV.GRAVIDADE`. */
export const VELOCIDADE_PULO = Math.sqrt(2 * MOV.GRAVIDADE * MOV.PULO);

/** Direção no chão a partir das teclas e do ângulo da câmera (a mesma conta da fazenda). */
export function direcaoNoChao(frente: number, lado: number, giroCamera: number) {
  const n = Math.hypot(frente, lado);
  if (n < 1e-6) return { x: 0, z: 0, forca: 0 };
  const f = frente / n;
  const l = lado / n;
  const c = Math.cos(giroCamera);
  const s = Math.sin(giroCamera);
  return { x: l * c - f * s, z: -l * s - f * c, forca: Math.min(1, n) };
}

// ângulos para contornar quinas quando bate de frente (em radianos, em ordem de preferência)
const DESVIOS = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05];

/**
 * Tenta andar de (x, z) por (dx, dz). Devolve até onde dá: de frente, deslizando
 * num eixo só ou contornando a quina. Se já está preso num lugar fechado, deixa sair.
 */
function andarCom(mapa: MapaMovimento, x: number, z: number, dx: number, dz: number) {
  const nx = x + dx;
  const nz = z + dz;
  if (mapa.livre(nx, nz)) return { x: nx, z: nz, bateu: false };
  // preso (nasceu num lugar fechado): deixa andar para sair
  if (!mapa.livre(x, z)) return { x: nx, z: nz, bateu: false };
  // desliza na parede: tenta só um dos eixos (o de maior movimento primeiro). Um eixo que quase
  // não anda não vale como deslizar (senão fica parado de frente para um poste)
  const d = Math.hypot(dx, dz);
  const vale = (v: number) => Math.abs(v) > d * 0.2;
  const primeiroX = Math.abs(dx) >= Math.abs(dz);
  if (primeiroX) {
    if (vale(dx) && mapa.livre(nx, z)) return { x: nx, z, bateu: true };
    if (vale(dz) && mapa.livre(x, nz)) return { x, z: nz, bateu: true };
  } else {
    if (vale(dz) && mapa.livre(x, nz)) return { x, z: nz, bateu: true };
    if (vale(dx) && mapa.livre(nx, z)) return { x: nx, z, bateu: true };
  }
  // contorna quinas redondas (árvores, postes) e acha a entrada de passagens estreitas
  for (const a of DESVIOS) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rx = (dx * c - dz * s) * 0.85;
    const rz = (dx * s + dz * c) * 0.85;
    if (mapa.livre(x + rx, z + rz)) return { x: x + rx, z: z + rz, bateu: true };
  }
  // empurrãozinho de lado (perpendicular), para entrar numa passagem de 0,3 bloco
  if (d > 1e-6) {
    const px = (-dz / d) * 0.06;
    const pz = (dx / d) * 0.06;
    if (mapa.livre(x + px + dx * 0.3, z + pz + dz * 0.3))
      return { x: x + px + dx * 0.3, z: z + pz + dz * 0.3, bateu: true };
    if (mapa.livre(x - px + dx * 0.3, z - pz + dz * 0.3))
      return { x: x - px + dx * 0.3, z: z - pz + dz * 0.3, bateu: true };
  }
  return { x, z, bateu: true };
}

/**
 * Um passo do corpo: lê a entrada, acelera ou freia, anda com colisão,
 * pula, cai e gruda no chão. Muda o `corpo` no lugar (sem criar objetos por quadro,
 * fora o pequeno resultado).
 */
export function passo(
  corpo: CorpoHoki,
  entrada: EntradaMovimento,
  giroCamera: number,
  dt: number,
  mapa: MapaMovimento,
  lento = false,
  /**
   * Proporção do mundo: 1 = as medidas de MOV valem como estão (aba TESTE, 1 unidade = 1 m
   * do boneco). Na praça o boneco é menor em relação ao chão, então anda, pula e cai na
   * mesma proporção (o tempo no ar fica igual).
   */
  escala = 1,
): ResultadoPasso {
  const r: ResultadoPasso = {
    velocidade: 0,
    andando: false,
    correndo: false,
    pulou: false,
    aterrissou: false,
    bateu: false,
  };
  if (dt <= 0) return r;

  // 1) velocidade alvo e aproximação exponencial (igual no chão e no ar)
  const dir = direcaoNoChao(entrada.frente, entrada.lado, giroCamera);
  const correr = entrada.correr && !lento;
  const alvo = (correr ? MOV.CORRER : MOV.ANDAR) * escala * (lento ? MOV.LENTO : 1) * dir.forca;
  const k = 1 - Math.exp(-MOV.ACELERACAO * dt);
  corpo.vx += (dir.x * alvo - corpo.vx) * k;
  corpo.vz += (dir.z * alvo - corpo.vz) * k;
  if (Math.abs(corpo.vx) < 1e-4) corpo.vx = 0;
  if (Math.abs(corpo.vz) < 1e-4) corpo.vz = 0;

  // 2) anda com colisão (deslizando ou contornando)
  const vel = Math.hypot(corpo.vx, corpo.vz);
  if (vel > 1e-4) {
    const m = andarCom(mapa, corpo.x, corpo.z, corpo.vx * dt, corpo.vz * dt);
    if (m.bateu) {
      r.bateu = true;
      // a velocidade fica só com o que realmente andou (não acumula contra a parede)
      corpo.vx = (m.x - corpo.x) / dt;
      corpo.vz = (m.z - corpo.z) / dt;
    }
    corpo.x = m.x;
    corpo.z = m.z;
  }
  const velReal = Math.hypot(corpo.vx, corpo.vz);
  if (velReal > 0.15) corpo.rumo = Math.atan2(corpo.vx, corpo.vz);

  // 3) pulo: memória do botão e tolerância de beirada
  if (entrada.pular) corpo.memoriaPulo = MOV.MEMORIA_PULO;
  else corpo.memoriaPulo = Math.max(0, corpo.memoriaPulo - dt);
  const podePular = !lento && (corpo.noChao || (!corpo.pulando && corpo.fora < MOV.COYOTE));
  if (corpo.memoriaPulo > 0 && podePular) {
    corpo.vy = VELOCIDADE_PULO * escala;
    corpo.noChao = false;
    corpo.pulando = true;
    corpo.memoriaPulo = 0;
    r.pulou = true;
  }

  // 4) chão e gravidade
  const chao = mapa.chao(corpo.x, corpo.z);
  if (corpo.noChao) {
    if (chao < corpo.y - MOV.DEGRAU) {
      // andou para fora de um degrau alto: começa a cair (com tolerância para ainda pular)
      corpo.noChao = false;
      corpo.vy = 0;
      corpo.fora = 0;
    } else {
      // gruda no chão: sobe e desce rampas e escadas sem pulinhos
      corpo.y = chao;
      corpo.vy = 0;
    }
  }
  if (!corpo.noChao) {
    if (!corpo.pulando) corpo.fora += dt;
    corpo.vy -= MOV.GRAVIDADE * escala * dt;
    corpo.y += corpo.vy * dt;
    if (corpo.vy <= 0 && corpo.y <= chao) {
      corpo.y = chao;
      corpo.vy = 0;
      corpo.noChao = true;
      corpo.pulando = false;
      corpo.fora = 0;
      r.aterrissou = true;
    }
  }

  r.velocidade = velReal;
  r.andando = velReal > 0.3;
  r.correndo = velReal > MOV.ANDAR * escala * 1.2;
  return r;
}

/** O corpo está totalmente parado (no chão, sem velocidade e sem pulo pendente). */
export const corpoParado = (c: CorpoHoki) =>
  c.noChao && c.memoriaPulo <= 0 && Math.hypot(c.vx, c.vz) < MOV.PARADO;
