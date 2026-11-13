/**
 * Onde um HOKI pode estar no mundo da praça: a própria praça e as arenas dos
 * mini-games, que ficam longe dela (fora da vista). A rede (presença e
 * movimento) prende as posições que chegam a uma dessas áreas — assim quem
 * está numa arena aparece no lugar certo para os outros jogadores.
 */
export interface Area {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

/** A praça (os limites de sempre). */
export const AREA_PRACA: Area = { x0: -56, x1: 56, z0: -51, z1: 24, y0: -2, y1: 12 };

/** Centro de cada arena (o desenho delas fica no config de cada mini-game). */
export const CENTRO_SIEGE = { x: -760, z: 0 };

export const AREAS_MINIGAME: Area[] = [
  // HOST SIEGE: a ponte e os castelos (o piso fica em y = 30)
  { x0: CENTRO_SIEGE.x - 130, x1: CENTRO_SIEGE.x + 130, z0: -70, z1: 70, y0: -60, y1: 80 },
];

const prende = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A área em que o ponto está (a praça quando não está em nenhuma arena). */
export function areaDe(x: number, z: number): Area {
  return AREAS_MINIGAME.find((a) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) ?? AREA_PRACA;
}

/** Prende uma posição que chegou da rede à área em que ela está. */
export function prenderNoMundo(x: number, z: number, y = 0) {
  const a = areaDe(x, z);
  return { x: prende(x, a.x0, a.x1), z: prende(z, a.z0, a.z1), y: prende(y, a.y0, a.y1) };
}
