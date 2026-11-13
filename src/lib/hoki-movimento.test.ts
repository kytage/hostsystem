import { test } from "node:test";
import assert from "node:assert/strict";
import {
  corpoParado,
  criarCorpo,
  direcaoNoChao,
  MOV,
  passo,
  VELOCIDADE_PULO,
  type EntradaMovimento,
  type MapaMovimento,
} from "./hoki-movimento";

const PLANO: MapaMovimento = { livre: () => true, chao: () => 0 };
const NADA: EntradaMovimento = { frente: 0, lado: 0, correr: false, pular: false };
const FRENTE: EntradaMovimento = { frente: 1, lado: 0, correr: false, pular: false };

/** Roda `segundos` em passos de 1/60 s. */
function rodar(
  corpo: ReturnType<typeof criarCorpo>,
  entrada: EntradaMovimento | ((i: number) => EntradaMovimento),
  segundos: number,
  mapa = PLANO,
) {
  const n = Math.round(segundos * 60);
  let ultimo = passo(corpo, typeof entrada === "function" ? entrada(0) : entrada, 0, 1 / 60, mapa);
  for (let i = 1; i < n; i++)
    ultimo = passo(corpo, typeof entrada === "function" ? entrada(i) : entrada, 0, 1 / 60, mapa);
  return ultimo;
}

test("com a câmera no ângulo 0, frente é para -z e direita para +x", () => {
  const f = direcaoNoChao(1, 0, 0);
  assert.ok(Math.abs(f.x) < 1e-9 && Math.abs(f.z + 1) < 1e-9);
  const d = direcaoNoChao(0, 1, 0);
  assert.ok(Math.abs(d.x - 1) < 1e-9 && Math.abs(d.z) < 1e-9);
  // diagonal não fica mais rápida
  assert.equal(direcaoNoChao(1, 1, 0).forca, 1);
});

test("andando chega na velocidade em ~0,3 s e para logo ao soltar", () => {
  const c = criarCorpo(0, 0, 0);
  rodar(c, FRENTE, 0.3);
  const v = Math.hypot(c.vx, c.vz);
  assert.ok(v > MOV.ANDAR * 0.93 && v <= MOV.ANDAR + 1e-6, `velocidade ${v}`);
  rodar(c, NADA, 0.5);
  assert.ok(corpoParado(c));
});

test("correndo fica mais rápido; lento anda devagar e não corre", () => {
  const c = criarCorpo(0, 0, 0);
  const r = rodar(c, { ...FRENTE, correr: true }, 1);
  assert.ok(Math.abs(r.velocidade - MOV.CORRER) < 0.05 && r.correndo);
  const l = criarCorpo(0, 0, 0);
  const n = 60;
  let rl = passo(l, { ...FRENTE, correr: true }, 0, 1 / 60, PLANO, true);
  for (let i = 1; i < n; i++) rl = passo(l, { ...FRENTE, correr: true }, 0, 1 / 60, PLANO, true);
  assert.ok(Math.abs(rl.velocidade - MOV.ANDAR * MOV.LENTO) < 0.05);
});

test("parede: para de frente e desliza quando anda na diagonal", () => {
  // parede em z < -1 (andando para a frente, -z, bate nela)
  const mapa: MapaMovimento = { livre: (_x, z) => z > -1, chao: () => 0 };
  const c = criarCorpo(0, 0, 0);
  rodar(c, FRENTE, 2, mapa);
  assert.ok(c.z > -1 && c.z < -0.8, `z ${c.z}`);
  const xAntes = c.x;
  // diagonal frente+direita: continua andando para a direita, encostado
  rodar(c, { ...FRENTE, lado: 1 }, 1, mapa);
  assert.ok(c.x > xAntes + 1.5, `deslizou só ${c.x - xAntes}`);
  assert.ok(c.z > -1);
});

test("pulo chega perto da altura certa e volta ao chão", () => {
  const c = criarCorpo(0, 0, 0);
  let maior = 0;
  let aterrissou = false;
  for (let i = 0; i < 90; i++) {
    const r = passo(c, { ...NADA, pular: i === 0 }, 0, 1 / 60, PLANO);
    maior = Math.max(maior, c.y);
    if (r.aterrissou) aterrissou = true;
  }
  assert.ok(Math.abs(maior - MOV.PULO) < 0.08, `subiu ${maior}`);
  assert.ok(aterrissou && c.noChao && c.y === 0);
  assert.ok(Math.abs(VELOCIDADE_PULO - Math.sqrt(2 * MOV.GRAVIDADE * MOV.PULO)) < 1e-9 && VELOCIDADE_PULO > 6);
});

test("tolerância de beirada: pula logo depois de sair do degrau", () => {
  // degrau: em x >= 1 o chão é 2 blocos mais baixo
  const mapa: MapaMovimento = { livre: () => true, chao: (x) => (x >= 1 ? -2 : 0) };
  const c = criarCorpo(0.9, 0, 0);
  c.vx = MOV.ANDAR;
  const direita = { frente: 0, lado: 1, correr: false, pular: false };
  passo(c, direita, 0, 1 / 60, mapa); // sai do degrau
  passo(c, direita, 0, 1 / 60, mapa);
  assert.equal(c.noChao, false);
  const r = passo(c, { ...direita, pular: true }, 0, 1 / 60, mapa);
  assert.ok(r.pulou, "deveria pular dentro da tolerância");
});

test("memória do pulo: apertado pouco antes de tocar o chão, pula ao tocar", () => {
  const c = criarCorpo(0, 0, 0.12);
  c.noChao = false;
  c.pulando = true;
  c.vy = -2;
  let pulouDeNovo = false;
  for (let i = 0; i < 30; i++) {
    const r = passo(c, { ...NADA, pular: i === 0 }, 0, 1 / 60, PLANO);
    if (r.pulou) pulouDeNovo = true;
  }
  assert.ok(pulouDeNovo);
});

test("contorna um poste redondo em vez de travar", () => {
  // poste em (0, -2) de raio 0,5
  const mapa: MapaMovimento = { livre: (x, z) => Math.hypot(x, z + 2) > 0.5, chao: () => 0 };
  const c = criarCorpo(0.05, 0, 0);
  rodar(c, FRENTE, 2, mapa);
  assert.ok(c.z < -3, `ficou preso em z=${c.z}`);
});

test("entra numa passagem estreita de 0,3 bloco quando chega perto do meio", () => {
  // parede em z < -1, com uma passagem em |x| < 0,15
  const mapa: MapaMovimento = {
    livre: (x, z) => z > -1 || Math.abs(x) < 0.15,
    chao: () => 0,
  };
  const c = criarCorpo(0.1, 0, 0);
  rodar(c, FRENTE, 2, mapa);
  assert.ok(c.z < -2, `não entrou: z=${c.z}`);
});
