import { CENTRO_SIEGE } from "@/lib/hoki-areas";

/**
 * HOST SIEGE — Cerco dos Guardiões: TODOS os números de balanceamento e o
 * desenho lógico da arena ficam aqui (mudar valores = mexer só neste arquivo).
 *
 * Unidade: "bloco" do mundo da praça. O boneco tem 1,83 m e ~1,55 bloco, então
 * 1 metro do documento = M blocos (as distâncias em metros são convertidas).
 */

export const M = 0.847;
export type Time = "vermelho" | "azul";
export const TIMES: Time[] = ["vermelho", "azul"];
export const outroTime = (t: Time): Time => (t === "vermelho" ? "azul" : "vermelho");
export type Kit = "vanguarda" | "atirador" | "alquimista" | "batedor";
export const KITS: Kit[] = ["vanguarda", "atirador", "alquimista", "batedor"];
export type Modo = "publica" | "privada" | "treino";

export const SIEGE = {
  /** Fila: mínimo e máximo de jogadores; com o mínimo, começa nesse tempo e avisa todos. */
  FILA_MIN: 2,
  FILA_MAX: 20,
  FILA_CONTAGEM_S: 120,
  PREPARACAO_S: 15,
  PARTIDA_S: 8 * 60,
  PRORROGACAO_S: 60,
  RESULTADO_S: 15,
  HP_JOGADOR: 100,
  HP_GUARDIAO: 1000,
  RESPAWN_S: 7,
  PROTECAO_SPAWN_S: 2,
  FORJA_CAPTURA_S: 6,
  FORJA_JANELA_S: 35,
  FORJA_RECARGA_S: 12,
  FORJA_RAIO: 3.5,
  FORJA_PONTOS: 10,
  PONTO_POR_DANO_GUARDIAO: 50,
  PONTOS_ELIMINACAO: 1,
  POCAO_CURA: 35,
  POCAO_USO_S: 1,
  PEDESTAL_RECARGA_S: 25,
  PEDESTAL_ALCANCE: 1.8,
  GUARDIAO_GOLPE: {
    dano: 22,
    aviso_s: 0.7,
    recarga_s: 3,
    alcance: 6.5,
    arco: (75 * Math.PI) / 180,
  },
  GUARDIAO_PISADA: { dano: 28, aviso_s: 1.2, recarga_s: 10, raio: 4 * M },
  XP: { concluir: 30, vitoria: 20, empate: 10 },
  RECONEXAO_VAGA_S: 60,
  RECONEXAO_AVATAR_S: 10,
} as const;

/** Arma (slot 1) e as duas habilidades (slots 2 e 3) de cada kit. */
export const KITS_INFO: Record<
  Kit,
  {
    nome: string;
    resumo: string;
    arma: {
      nome: string;
      dano: number;
      intervalo: number;
      alcance: number;
      tipo: "corpo" | "projetil";
      velocidade?: number;
    };
    hab2: { nome: string; recarga: number; texto: string };
    hab3: { nome: string; recarga: number; texto: string };
  }
> = {
  vanguarda: {
    nome: "Vanguarda",
    resumo: "Linha de frente: espada, escudo e investida.",
    arma: { nome: "Espada", dano: 20, intervalo: 0.75, alcance: 2.2 * M, tipo: "corpo" },
    hab2: { nome: "Bastião", recarga: 15, texto: "40 de escudo por até 4 s" },
    hab3: { nome: "Investida", recarga: 12, texto: "Avança 4 m e causa 18 ao primeiro inimigo" },
  },
  atirador: {
    nome: "Atirador",
    resumo: "De longe: arco, flecha de gelo e recuo.",
    arma: {
      nome: "Arco",
      dano: 17,
      intervalo: 0.85,
      alcance: 18 * M,
      tipo: "projetil",
      velocidade: 30,
    },
    hab2: { nome: "Flecha de Gelo", recarga: 12, texto: "14 de dano e 30% mais lento por 2 s" },
    hab3: { nome: "Recuo", recarga: 10, texto: "Salta 4 m para trás" },
  },
  alquimista: {
    nome: "Alquimista",
    resumo: "Suporte: cajado, cura em área e barreira.",
    arma: {
      nome: "Cajado",
      dano: 12,
      intervalo: 0.9,
      alcance: 12 * M,
      tipo: "projetil",
      velocidade: 20,
    },
    hab2: { nome: "Pulso Vital", recarga: 18, texto: "Cura 25 em você e aliados a 4 m" },
    hab3: { nome: "Barreira", recarga: 14, texto: "20 de escudo por 4 s num aliado mirado a 8 m" },
  },
  batedor: {
    nome: "Batedor",
    resumo: "Rápido: adagas, arrancada e fumaça.",
    arma: { nome: "Adagas", dano: 13, intervalo: 0.5, alcance: 1.7 * M, tipo: "corpo" },
    hab2: { nome: "Arrancada", recarga: 10, texto: "Avança 5 m para onde está indo" },
    hab3: { nome: "Fumaça", recarga: 16, texto: "Nuvem de 3 m por 4 s que esconde os marcadores" },
  },
};

export const HABILIDADES = {
  bastiao: { escudo: 40, dur: 4 },
  investida: { dist: 4 * M, dano: 18 },
  gelo: { dano: 14, lento: 0.7, dur: 2, velocidade: 32 },
  recuo: { dist: 4 * M },
  pulso: { cura: 25, raio: 4 * M },
  barreira: { escudo: 20, dur: 4, alcance: 8 * M, mira: (35 * Math.PI) / 180 },
  arrancada: { dist: 5 * M },
  fumaca: { raio: 3 * M, dur: 4 },
} as const;

/* ------------------------------------------------------------------ */
/* arena (coordenadas da arena: x ao longo da ponte, vermelho no -x)   */
/* ------------------------------------------------------------------ */

/** Onde a arena fica no mundo da praça (longe, fora da vista do lobby). */
export const ORIGEM_ARENA = CENTRO_SIEGE;
/** Altura do piso da arena; abaixo de QUEDA o jogador morre. */
export const PISO = 30;
export const QUEDA = PISO - 14;

export interface Caixa {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Altura do topo (pisável se até meio bloco acima de onde se está). */
  topo: number;
  /** Só existe enquanto os portões estão fechados (preparação). */
  portao?: Time;
  cor?: number;
}

const L = (t: Time) => (t === "vermelho" ? -1 : 1);

/** Pontos importantes de cada time (espelhados). */
export function lado(t: Time) {
  const s = L(t);
  return {
    guardiao: { x: s * 60, z: 0 },
    /** Pátio do Guardião (onde ele reage aos invasores). */
    patio: { x0: Math.min(s * 47, s * 72), x1: Math.max(s * 47, s * 72), z0: -11, z1: 11 },
    /** Sala protegida de spawn (inimigos não entram). */
    spawn: { x0: Math.min(s * 73, s * 84), x1: Math.max(s * 73, s * 84), z0: -6, z1: 6 },
    renascer: { x: s * 80, z: 0 },
    portao: { x: s * 46, z: 0 },
  };
}

export const FORJA = { x: 0, z: 0 };
export const PEDESTAIS = [
  { id: "norte", x: 0, z: -13 },
  { id: "sul", x: 0, z: 13 },
];

/** Tudo que é chão ou parede da arena (o desenho e a colisão saem daqui). */
export function caixasDaArena(): Caixa[] {
  const c: Caixa[] = [];
  const P = PISO;
  // ponte (5 de largura) e a plataforma da Forja
  c.push({ x0: -46, x1: 46, z0: -2.6, z1: 2.6, topo: P });
  c.push({ x0: -8, x1: 8, z0: -8, z1: 8, topo: P });
  // desvios laterais: plataformas com o pedestal e passarelas que voltam à ponte
  for (const s of [-1, 1]) {
    const zc = s * 13;
    c.push({ x0: -5, x1: 5, z0: zc - 3.5, z1: zc + 3.5, topo: P });
    for (const x of [-12, 12])
      c.push({
        x0: x - 1.2,
        x1: x + 1.2,
        z0: Math.min(s * 2.6, s * 9.5),
        z1: Math.max(s * 2.6, s * 9.5),
        topo: P,
      });
    c.push({
      x0: -12,
      x1: 12,
      z0: Math.min(s * 9.5, s * 11.5),
      z1: Math.max(s * 9.5, s * 11.5),
      topo: P,
    });
  }
  // coberturas na ponte (iguais nos dois lados)
  for (const s of [-1, 1]) {
    c.push({
      x0: s * 20 - 0.6,
      x1: s * 20 + 0.6,
      z0: -2.6,
      z1: -0.6,
      topo: P + 1.6,
      cor: 0x2a2a30,
    });
    c.push({ x0: s * 32 - 0.6, x1: s * 32 + 0.6, z0: 0.6, z1: 2.6, topo: P + 1.6, cor: 0x2a2a30 });
  }
  // castelos (espelhados)
  for (const t of ["vermelho", "azul"] as Time[]) {
    const s = L(t);
    const x = (a: number) => s * a;
    const caixa = (
      a: number,
      b: number,
      z0: number,
      z1: number,
      topo: number,
      extra: Partial<Caixa> = {},
    ) => c.push({ x0: Math.min(x(a), x(b)), x1: Math.max(x(a), x(b)), z0, z1, topo, ...extra });
    // piso do pátio e da sala de spawn
    caixa(46, 73, -12, 12, P);
    caixa(73, 85, -7, 7, P);
    // muralhas do pátio (com o portão aberto na frente)
    const muro = P + 6;
    caixa(46, 47, -12, -2.4, muro);
    caixa(46, 47, 2.4, 12, muro);
    caixa(46, 73, -12, -11, muro);
    caixa(46, 73, 11, 12, muro);
    // portão: fechado durante a preparação
    caixa(46, 47, -2.4, 2.4, muro, { portao: t });
    // pilares ao redor do Guardião (duas rotas para lutar em volta dele)
    caixa(55, 57, -6.5, -4.5, muro);
    caixa(55, 57, 4.5, 6.5, muro);
    // parede entre o pátio e a sala de spawn, com a saída de lado (sem linha de visão direta)
    caixa(72, 73, -7, 3, muro);
    caixa(72, 73, 5.5, 7, muro);
    caixa(69.5, 72, 3, 3.6, muro);
    // paredes da sala de spawn
    caixa(73, 85, -7, -6, muro);
    caixa(73, 85, 6, 7, muro);
    caixa(84, 85, -7, 7, muro);
  }
  return c;
}

export const dentroDe = (
  r: { x0: number; x1: number; z0: number; z1: number },
  x: number,
  z: number,
) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
