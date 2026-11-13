import { test } from "node:test";
import assert from "node:assert/strict";
import { diaCurto, iniciosDosPeriodos, somarDias } from "./termometro-periodos";

test("a semana do queridômetro começa na segunda e o mês no dia 1", () => {
  // sexta-feira
  assert.deepEqual(iniciosDosPeriodos("2026-11-13"), {
    hoje: "2026-11-13",
    semana: "2026-11-09",
    mes: "2026-11-01",
    ontem: "2026-11-12",
  });
  // segunda-feira: a semana começa hoje
  assert.equal(iniciosDosPeriodos("2026-11-09").semana, "2026-11-09");
  // domingo ainda é da semana que começou na segunda
  assert.equal(iniciosDosPeriodos("2026-11-15").semana, "2026-11-09");
});

test("a semana pode começar no mês (e no ano) anterior", () => {
  const dezembro = iniciosDosPeriodos("2026-12-01");
  assert.equal(dezembro.semana, "2026-11-30");
  assert.equal(dezembro.mes, "2026-12-01");
  assert.equal(dezembro.ontem, "2026-11-30");
  const anoNovo = iniciosDosPeriodos("2027-01-01");
  assert.equal(anoNovo.semana, "2026-12-28");
  assert.equal(anoNovo.ontem, "2026-12-31");
});

test("contas de dias e o dia curto", () => {
  assert.equal(somarDias("2028-02-28", 1), "2028-02-29");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(diaCurto("2026-11-09"), "09/11");
});
