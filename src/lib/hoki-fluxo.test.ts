import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactar,
  deveEnviar,
  FLUXO,
  intervaloMinimo,
  lerMensagem,
  prever,
  type AmostraMovimento,
} from "./hoki-fluxo";

const BASE: AmostraMovimento = { x: 1, z: 2, y: 0, r: 0, vx: 3, vz: 0, vy: 0, k: "anda", s: 1 };
const CHAO = () => 0;

test("lê e confere a mensagem; recusa o que não serve", () => {
  const ok = lerMensagem({ ...BASE, id: "abc", aba: "x1" });
  assert.ok(ok && ok.x === 1 && ok.k === "anda");
  assert.equal(lerMensagem({ ...BASE, aba: "x1" }), null, "sem id");
  assert.equal(lerMensagem({ ...BASE, id: "abc" }), null, "sem aba");
  assert.equal(lerMensagem({ ...BASE, id: "abc", aba: "x1", k: "voa" }), null, "tipo estranho");
  assert.equal(lerMensagem({ ...BASE, id: "abc", aba: "x1", x: "1" }), null, "x não numérico");
  // limites e velocidades absurdas são presos
  const fora = lerMensagem({ ...BASE, id: "a", aba: "b", x: 999, vx: 500 });
  assert.ok(fora && fora.x === 56 && fora.vx === 12);
  // numa arena de mini-game (longe da praça) a posição e a altura valem como chegaram
  const arena = lerMensagem({ ...BASE, id: "a", aba: "b", x: -770.5, z: 3, y: 30 });
  assert.ok(arena && arena.x === -770.5 && arena.z === 3 && arena.y === 30);
  // parado não tem velocidade
  const parado = lerMensagem({ ...BASE, id: "a", aba: "b", k: "para" });
  assert.ok(parado && parado.vx === 0 && parado.vz === 0);
});

test("compactar deixa 2 casas", () => {
  const c = compactar({ ...BASE, x: 1.23456, vz: -0.98765, r: 1.23456 });
  assert.equal(c.x, 1.23);
  assert.equal(c.vz, -0.99);
  assert.equal(c.r, 1.235);
});

test("prever anda pela velocidade, mas só até o limite de tempo", () => {
  const p = prever(BASE, 0.5, 17, CHAO);
  assert.ok(Math.abs(p.x - 2.5) < 1e-9 && p.andando);
  const longe = prever(BASE, 10, 17, CHAO);
  assert.ok(Math.abs(longe.x - (1 + 3 * FLUXO.PREVE_MAX_S)) < 1e-9);
});

test("prever não entra na parede", () => {
  const p = prever(BASE, 1, 17, CHAO, (x) => x < 2.6);
  assert.ok(p.x < 2.6 && p.x > 2.2, `x ${p.x}`);
});

test("prever faz a parábola do pulo e volta ao chão", () => {
  const pulo: AmostraMovimento = { ...BASE, vx: 0, k: "pula", vy: 6 };
  const meio = prever(pulo, 0.3, 17, CHAO);
  assert.ok(meio.noAr && meio.y > 0.9);
  const depois = prever(pulo, 1.5, 17, CHAO);
  assert.ok(!depois.noAr && depois.y === 0);
});

test("deveEnviar: começa sim; parado não repete; vira, muda de ritmo ou passa 1 s", () => {
  assert.equal(deveEnviar(null, { vx: 3, vz: 0, k: "anda" }, 0, 250), true);
  assert.equal(deveEnviar(null, { vx: 0, vz: 0, k: "para" }, 0, 250), false);
  const u = { quando: 0, vx: 3, vz: 0, k: "anda" as const };
  assert.equal(deveEnviar(u, { vx: 3, vz: 0, k: "anda" }, 100, 250), false, "intervalo mínimo");
  assert.equal(deveEnviar(u, { vx: 3, vz: 0, k: "anda" }, 400, 250), false, "reto e cedo");
  assert.equal(deveEnviar(u, { vx: 3, vz: 0, k: "anda" }, 1000, 250), true, "batida de 1 s");
  assert.equal(deveEnviar(u, { vx: 0, vz: 3, k: "anda" }, 300, 250), true, "virou 90°");
  assert.equal(deveEnviar(u, { vx: 6, vz: 0, k: "anda" }, 300, 250), true, "correu");
  assert.equal(deveEnviar(u, { vx: 0, vz: 0, k: "para" }, 300, 250), true, "parou");
  assert.equal(deveEnviar(u, { vx: 3, vz: 0, k: "pula" }, 300, 250), true, "pulou");
  const parado = { quando: 0, vx: 0, vz: 0, k: "para" as const };
  assert.equal(deveEnviar(parado, { vx: 0, vz: 0, k: "para" }, 5000, 250), false);
});

test("intervalo mínimo cresce com quem está olhando", () => {
  assert.equal(intervaloMinimo(0), FLUXO.MINIMO_MS);
  assert.equal(intervaloMinimo(10), 600);
});
