/**
 * Combate reaproveitável dos mini-games da HOST: vida, escudo, dano, cura,
 * lentidão, morte e crédito de eliminação/assistência. Não sabe nada de mapa
 * nem de desenho: quem decide (o "dono" da partida) chama estas funções e manda
 * o resultado para todos.
 */

export interface Lutador {
  id: string;
  /** Time (sem fogo amigo entre o mesmo time). */
  time: string;
  hp: number;
  hpMax: number;
  /** Escudo temporário: absorve dano antes da vida. */
  escudo: { valor: number; ate: number };
  /** Até quando está mais lento (fator de velocidade). */
  lento: { fator: number; ate: number };
  morto: boolean;
  /** Danos recebidos recentemente (para crédito de eliminação e assistência). */
  danos: { de: string; qt: number; t: number }[];
}

export const REGRAS_DE_CREDITO = {
  /** Quem causou dano nos últimos N segundos leva a eliminação (inclusive em quedas). */
  JANELA_ELIMINACAO_S: 5,
  /** Assistência: pelo menos tanto de dano nos últimos N segundos. */
  ASSISTENCIA_DANO: 15,
  JANELA_ASSISTENCIA_S: 8,
};

export function criarLutador(id: string, time: string, hpMax = 100): Lutador {
  return {
    id,
    time,
    hp: hpMax,
    hpMax,
    escudo: { valor: 0, ate: 0 },
    lento: { fator: 1, ate: 0 },
    morto: false,
    danos: [],
  };
}

/** Escudo que ainda vale agora. */
export const escudoAtivo = (l: Lutador, agora: number) =>
  l.escudo.ate > agora ? l.escudo.valor : 0;
/** Fator de velocidade agora (lentidões não se acumulam). */
export const velocidadeAtual = (l: Lutador, agora: number) =>
  l.lento.ate > agora ? l.lento.fator : 1;

/** Escudos não somam: fica o maior valor restante, com a duração dele. */
export function aplicarEscudo(l: Lutador, valor: number, dur: number, agora: number) {
  if (l.morto) return;
  const atual = escudoAtivo(l, agora);
  if (valor >= atual) l.escudo = { valor, ate: agora + dur };
}

/** Lentidões não se acumulam: vale a mais forte (e renova a duração se for a mesma). */
export function aplicarLentidao(l: Lutador, fator: number, dur: number, agora: number) {
  if (l.morto) return;
  if (l.lento.ate <= agora || fator <= l.lento.fator)
    l.lento = { fator, ate: Math.max(l.lento.ate, agora + dur) };
}

export function curar(l: Lutador, qt: number) {
  if (l.morto || qt <= 0) return 0;
  const antes = l.hp;
  l.hp = Math.min(l.hpMax, l.hp + qt);
  return l.hp - antes;
}

export interface ResultadoDano {
  /** Vida realmente removida (sem contar o escudo). */
  vida: number;
  escudo: number;
  morreu: boolean;
}

/**
 * Aplica dano de `de` em `alvo`. Sem fogo amigo (mesmo time não machuca).
 * O escudo é consumido antes da vida.
 */
export function aplicarDano(
  alvo: Lutador,
  qt: number,
  de: { id: string; time: string } | null,
  agora: number,
): ResultadoDano {
  const r: ResultadoDano = { vida: 0, escudo: 0, morreu: false };
  if (alvo.morto || qt <= 0) return r;
  if (de && de.time === alvo.time && de.id !== alvo.id) return r;
  let resto = qt;
  const esc = escudoAtivo(alvo, agora);
  if (esc > 0) {
    r.escudo = Math.min(esc, resto);
    alvo.escudo.valor = esc - r.escudo;
    resto -= r.escudo;
  }
  if (resto > 0) {
    r.vida = Math.min(alvo.hp, resto);
    alvo.hp -= r.vida;
  }
  if (de && de.id !== alvo.id && r.vida + r.escudo > 0) {
    alvo.danos.push({ de: de.id, qt: r.vida + r.escudo, t: agora });
    // só guarda o que ainda importa
    const corte =
      agora -
      Math.max(REGRAS_DE_CREDITO.JANELA_ASSISTENCIA_S, REGRAS_DE_CREDITO.JANELA_ELIMINACAO_S) *
        1000;
    alvo.danos = alvo.danos.filter((d) => d.t >= corte);
  }
  if (alvo.hp <= 0) {
    alvo.hp = 0;
    alvo.morto = true;
    r.morreu = true;
  }
  return r;
}

/**
 * Quem leva o crédito de uma morte (inclusive queda): o último inimigo que causou
 * dano nos 5 s anteriores; assistência para quem causou 15+ nos últimos 8 s.
 * Queda sem atacante válido não dá ponto (elimina = null).
 */
export function creditoDaMorte(alvo: Lutador, agora: number) {
  const J = REGRAS_DE_CREDITO;
  const recentes = alvo.danos.filter((d) => d.t >= agora - J.JANELA_ELIMINACAO_S * 1000);
  const elimina = recentes.length ? recentes[recentes.length - 1]!.de : null;
  const soma = new Map<string, number>();
  for (const d of alvo.danos)
    if (d.t >= agora - J.JANELA_ASSISTENCIA_S * 1000) soma.set(d.de, (soma.get(d.de) ?? 0) + d.qt);
  const assistencias = [...soma]
    .filter(([id, qt]) => id !== elimina && qt >= J.ASSISTENCIA_DANO)
    .map(([id]) => id);
  return { elimina, assistencias };
}

/** Volta à vida cheia (respawn). */
export function renascer(l: Lutador) {
  l.hp = l.hpMax;
  l.morto = false;
  l.escudo = { valor: 0, ate: 0 };
  l.lento = { fator: 1, ate: 0 };
  l.danos = [];
}

/* ------------------------------------------------------------------ */
/* geometria simples de acerto (plano do chão)                         */
/* ------------------------------------------------------------------ */

export interface Ponto {
  x: number;
  z: number;
}

/** O ponto está no arco frontal (ângulo total `arco` em radianos) e no alcance? */
export function noArco(origem: Ponto, rumo: number, alvo: Ponto, alcance: number, arco: number) {
  const dx = alvo.x - origem.x;
  const dz = alvo.z - origem.z;
  const d = Math.hypot(dx, dz);
  if (d > alcance) return false;
  if (d < 0.35) return true;
  const fx = Math.sin(rumo);
  const fz = Math.cos(rumo);
  return (dx * fx + dz * fz) / d >= Math.cos(arco / 2);
}

/** Linha de visão livre entre dois pontos (amostra o caminho com `livre`). */
export function linhaDeVisao(
  a: Ponto,
  b: Ponto,
  livre: (x: number, z: number) => boolean,
  passo = 0.25,
) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(d / passo));
  for (let i = 1; i < n; i++) {
    const k = i / n;
    if (!livre(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k)) return false;
  }
  return true;
}
