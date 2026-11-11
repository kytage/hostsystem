/**
 * Corrida da praça do HOKI: a pista, os carros de enfeite (robôs) e as contas
 * de posição. Tudo aqui é igual em todos os computadores: a pista é sempre a
 * mesma e os robôs andam conforme o relógio da corrida, então todo mundo vê a
 * mesma disputa sem precisar trocar mensagens sobre eles.
 */
export const VOLTAS = 3;
/** Comprimento de cada pedaço da pista e meia largura do asfalto (nas unidades do jogo). */
export const SEG = 200;
export const MEIA_PISTA = 2000;
/** Velocidade máxima (unidades por segundo) e a mesma velocidade mostrada no painel. */
export const VEL_MAX = 11000;
export const KMH_MAX = 220;
/** Quanto tempo o lobby fica aberto e a contagem 3-2-1 antes da largada (ms). */
export const LOBBY_MS = 60_000;
export const CONTAGEM_MS = 4_000;

export interface Trecho {
  /** Quanto a pista vira neste pedaço (negativo = esquerda). */
  curva: number;
  /** Altura no começo e no fim do pedaço (morros). */
  y1: number;
  y2: number;
}

const suave = (a: number, b: number, k: number) => a + (b - a) * (-Math.cos(k * Math.PI) / 2 + 0.5);
const entra = (a: number, b: number, k: number) => a + (b - a) * k * k;
const sai = (a: number, b: number, k: number) => a + (b - a) * (1 - (1 - k) * (1 - k));

/** Monta a pista: retas, curvas e morros, sempre na mesma ordem. Termina na mesma altura em que começa. */
function construir(): Trecho[] {
  const t: Trecho[] = [];
  const ultimoY = () => (t.length ? t[t.length - 1]!.y2 : 0);
  const parte = (entrada: number, meio: number, saida: number, curva: number, morro: number) => {
    const y0 = ultimoY();
    const y1 = y0 + morro * SEG;
    const total = entrada + meio + saida;
    const inicio = t.length;
    const por = (c: number) => {
      const feito = t.length - inicio;
      t.push({
        curva: c,
        y1: suave(y0, y1, feito / total),
        y2: suave(y0, y1, (feito + 1) / total),
      });
    };
    for (let n = 0; n < entrada; n++) por(entra(0, curva, n / entrada));
    for (let n = 0; n < meio; n++) por(curva);
    for (let n = 0; n < saida; n++) por(sai(curva, 0, n / saida));
  };
  const reta = (n: number, morro = 0) => parte(n, n, n, 0, morro);
  const curva = (n: number, c: number, morro = 0) => parte(n, n, n, c, morro);

  reta(40);
  curva(30, 2.2);
  reta(20, 18);
  curva(40, -3.4, -18);
  reta(30);
  curva(24, 4.8);
  curva(24, -4.8, 26);
  reta(36, -26);
  curva(50, 2.6, 14);
  reta(24, -14);
  curva(28, -5.6);
  reta(20, 20);
  curva(36, 3.6, -20);
  curva(20, -2.4);
  reta(44);
  curva(40, -4.2, 12);
  reta(26, -12);
  curva(30, 5.2);
  reta(50);
  // fecha a volta: volta para a altura zero sem degrau
  const sobra = ultimoY();
  parte(20, 20, 20, 0, -sobra / SEG);
  return t;
}

export const TRECHOS = construir();
export const COMPRIMENTO = TRECHOS.length * SEG;
export const TOTAL = COMPRIMENTO * VOLTAS;

/** Carros de enfeite: andam sozinhos, cada um no seu ritmo, iguais em todas as telas. */
export const ROBOS = [
  { id: "robo-1", nome: "Turbo", cor: "#ffb020", ritmo: 0.79, faixa: -0.55 },
  { id: "robo-2", nome: "Faísca", cor: "#4fd1ff", ritmo: 0.84, faixa: 0.5 },
  { id: "robo-3", nome: "Trovão", cor: "#b06bff", ritmo: 0.88, faixa: 0 },
];
/** Quanto um robô já andou, `s` segundos depois da largada. */
export function distanciaDoRobo(i: number, s: number) {
  const r = ROBOS[i];
  if (!r || s <= 0) return 0;
  // arranca devagar e depois oscila um pouco em volta do ritmo dele
  const arranque = Math.min(1, s / 4);
  const media = VEL_MAX * r.ritmo * (s - 2 * arranque);
  return Math.max(0, media + Math.sin(s * 0.5 + i * 2.1) * 900);
}
/** Em quantos segundos o robô termina as voltas (achado por aproximação). */
export function tempoDoRobo(i: number) {
  let a = 0;
  let b = 600;
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2;
    if (distanciaDoRobo(i, m) >= TOTAL) b = m;
    else a = m;
  }
  return b;
}

export interface Piloto {
  id: string;
  nome: string;
  cor: string;
  /** Distância total já andada (todas as voltas). */
  d: number;
  /** Tempo final em ms (só de quem já terminou). */
  fim?: number;
  eu?: boolean;
  robo?: boolean;
}

/** Ordem da corrida: quem terminou vem primeiro (pelo tempo), depois quem andou mais. */
export function classificar(pilotos: Piloto[]) {
  return [...pilotos].sort((a, b) => {
    if (a.fim !== undefined && b.fim !== undefined) return a.fim - b.fim;
    if (a.fim !== undefined) return -1;
    if (b.fim !== undefined) return 1;
    return b.d - a.d;
  });
}

export const tempoCurto = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};
