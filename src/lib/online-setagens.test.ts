import { test } from "node:test";
import assert from "node:assert/strict";
import { contarPorSetagem, janelaDePico } from "./online-setagens.server";

// Brasília = UTC-3
const brt = (hhmm: string) => new Date(`2026-11-19T${hhmm}:00-03:00`);

test("janelas de pico: 20h-23h no começo da hora e 00h no fim do dia", () => {
  assert.deepEqual(janelaDePico(brt("20:05")), { hora: 20, modo: "primeiro" });
  assert.deepEqual(janelaDePico(brt("23:00")), { hora: 23, modo: "primeiro" });
  assert.deepEqual(janelaDePico(brt("23:55")), { hora: 0, modo: "ultimo" });
  assert.equal(janelaDePico(brt("20:30")), null);
  assert.equal(janelaDePico(brt("19:05")), null);
  assert.equal(janelaDePico(brt("00:05")), null);
});

test("conta online por setagem pelo nome do grupo (sem o nível, sem repetir)", () => {
  const c = contarPorSetagem(
    ["Muni01", "Armas01"],
    [{ grupos: ["Muni01:2", "Police"] }, { grupos: ["muni01"] }, { grupos: ["Armas01", "Armas01:1"] }, { grupos: null }],
  );
  assert.equal(c.get("muni01"), 2);
  assert.equal(c.get("armas01"), 1);
});
