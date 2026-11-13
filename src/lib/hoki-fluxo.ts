/**
 * Movimento contínuo dos HOKIs pela rede (andar com o teclado, correr e pular).
 *
 * O destino continua indo pela presença de sempre (quem ainda está com a versão
 * antiga do site vê o HOKI andar até onde parou). Por cima disso, quem está na
 * praça manda "amostras" curtas num canal à parte: posição, velocidade, rumo e
 * pulo. Quem recebe não espera a próxima: prevê o caminho pela velocidade e
 * corrige devagar quando chega uma nova. Assim dá para mandar pouco (no começo,
 * ao parar, ao virar e uma vez por segundo andando reto) e ainda ver fluido.
 *
 * Contas puras, testadas em hoki-fluxo.test.ts.
 */

export type TipoAmostra = "anda" | "para" | "pula";

import { prenderNoMundo } from "./hoki-areas";

export interface AmostraMovimento {
  x: number;
  z: number;
  /** Altura dos pés. */
  y: number;
  /** Rumo do corpo (radianos). */
  r: number;
  vx: number;
  vz: number;
  /** Velocidade vertical (só no pulo). */
  vy: number;
  k: TipoAmostra;
  /** Número de sequência (descarta mensagem atrasada). */
  s: number;
}

/** Mensagem na rede: a amostra + quem mandou e de qual aba. */
export interface MensagemMovimento extends AmostraMovimento {
  id: string;
  aba: string;
}

const VEL_MAX = 12;
const VY_MAX = 12;

export const FLUXO = {
  /** Andando reto, manda uma amostra por segundo. */
  BATIDA_MS: 1000,
  /** Intervalo mínimo entre amostras (cresce com quem está olhando, ver `intervaloMinimo`). */
  MINIMO_MS: 250,
  /** Virou mais que isso (graus): manda. */
  VIROU_GRAUS: 18,
  /** A velocidade mudou mais que isso (fração): manda. */
  MUDOU_VEL: 0.25,
  /** Prevê o caminho por no máximo este tempo depois da última amostra (s). */
  PREVE_MAX_S: 1.2,
  /** Sem amostra nova há este tempo (andando), volta ao modo antigo (destino + rota). */
  VALIDADE_MS: 2500,
  /** Erro maior que isso (blocos): pula direto para a posição prevista. */
  TELEPORTE: 3.5,
} as const;

const arredonda = (v: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const prende = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Deixa a amostra curta para a rede (2 casas decimais). */
export function compactar(a: AmostraMovimento): AmostraMovimento {
  return {
    x: arredonda(a.x),
    z: arredonda(a.z),
    y: arredonda(a.y),
    r: arredonda(a.r, 3),
    vx: arredonda(a.vx),
    vz: arredonda(a.vz),
    vy: arredonda(a.vy),
    k: a.k,
    s: a.s,
  };
}

/** Confere uma mensagem que chegou da rede. Devolve null se não serve. */
export function lerMensagem(dados: unknown): MensagemMovimento | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as {
    id?: unknown;
    aba?: unknown;
    x?: unknown;
    z?: unknown;
    y?: unknown;
    r?: unknown;
    vx?: unknown;
    vz?: unknown;
    vy?: unknown;
    k?: unknown;
    s?: unknown;
  };
  if (typeof d.id !== "string" || !d.id || d.id.length > 64) return null;
  if (typeof d.aba !== "string" || !d.aba || d.aba.length > 16) return null;
  const x = num(d.x);
  const z = num(d.z);
  const s = num(d.s);
  if (x === null || z === null || s === null) return null;
  const k = d.k === "anda" || d.k === "para" || d.k === "pula" ? d.k : null;
  if (!k) return null;
  // a praça ou uma arena de mini-game (os mesmos limites que a presença aceita)
  const pos = prenderNoMundo(x, z, num(d.y) ?? 0);
  return {
    id: d.id,
    aba: d.aba,
    x: pos.x,
    z: pos.z,
    y: pos.y,
    r: num(d.r) ?? 0,
    vx: k === "para" ? 0 : prende(num(d.vx) ?? 0, -VEL_MAX, VEL_MAX),
    vz: k === "para" ? 0 : prende(num(d.vz) ?? 0, -VEL_MAX, VEL_MAX),
    vy: k === "pula" ? prende(num(d.vy) ?? 0, -VY_MAX, VY_MAX) : 0,
    k,
    s,
  };
}

/**
 * Onde o HOKI deve estar `desde` segundos depois da amostra: anda pela
 * velocidade (até `PREVE_MAX_S`) e, no pulo, faz a parábola até tocar o chão.
 * `livre` evita prever para dentro de uma parede (fica no último ponto livre).
 */
export function prever(
  a: AmostraMovimento,
  desde: number,
  gravidade: number,
  chao: (x: number, z: number) => number,
  livre?: (x: number, z: number) => boolean,
) {
  const t = Math.max(0, Math.min(desde, FLUXO.PREVE_MAX_S));
  let x = a.x + a.vx * t;
  let z = a.z + a.vz * t;
  if (livre && !livre(x, z)) {
    // volta pela reta até achar onde ainda é livre (passos de 10%)
    let ok = false;
    for (let f = 0.9; f > 0; f -= 0.1) {
      const px = a.x + a.vx * t * f;
      const pz = a.z + a.vz * t * f;
      if (livre(px, pz)) {
        x = px;
        z = pz;
        ok = true;
        break;
      }
    }
    if (!ok) {
      x = a.x;
      z = a.z;
    }
  }
  const c = chao(x, z);
  let y = c;
  let noAr = false;
  if (a.k === "pula") {
    const tp = Math.max(0, desde);
    const yPulo = a.y + a.vy * tp - (gravidade * tp * tp) / 2;
    if (yPulo > c) {
      y = yPulo;
      noAr = true;
    }
  }
  return { x, z, y, noAr, andando: a.k !== "para" && Math.hypot(a.vx, a.vz) > 0.3 };
}

/** Intervalo mínimo entre amostras, maior quando há mais gente olhando (poupa a cota do servidor). */
export function intervaloMinimo(olhando: number) {
  return Math.max(FLUXO.MINIMO_MS, 60 * Math.max(0, olhando));
}

/** O estado que serve para decidir se vale mandar de novo. */
export interface UltimoEnvio {
  quando: number;
  vx: number;
  vz: number;
  k: TipoAmostra;
}

/**
 * Vale mandar agora? Começou, parou ou pulou: sim (respeitando só o intervalo
 * mínimo). Andando: se virou, mudou de velocidade ou passou um segundo.
 */
export function deveEnviar(
  ultimo: UltimoEnvio | null,
  atual: { vx: number; vz: number; k: TipoAmostra },
  agora: number,
  minimoMs: number,
) {
  if (!ultimo) return atual.k !== "para";
  const passou = agora - ultimo.quando;
  if (passou < minimoMs) return false;
  if (atual.k !== ultimo.k) return true;
  if (atual.k === "para") return false;
  const v0 = Math.hypot(ultimo.vx, ultimo.vz);
  const v1 = Math.hypot(atual.vx, atual.vz);
  if (Math.abs(v1 - v0) > Math.max(0.3, v0 * FLUXO.MUDOU_VEL)) return true;
  if (v0 > 0.2 && v1 > 0.2) {
    const a0 = Math.atan2(ultimo.vx, ultimo.vz);
    const a1 = Math.atan2(atual.vx, atual.vz);
    const dif = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
    if ((dif * 180) / Math.PI > FLUXO.VIROU_GRAUS) return true;
  }
  return passou >= FLUXO.BATIDA_MS;
}
