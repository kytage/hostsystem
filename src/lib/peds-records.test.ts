import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { emptyPed } from "./peds-schema";
import { normalizePedState, pedCategory, removedPedState, summarizePeds } from "./peds-records";

describe("Peds removal", () => {
  it("moves the Ped to Removidos preserving all other data", () => {
    const original = { ...emptyPed("Crianças"), responsavel: "Fael", arquivo: "Skin_01", discord_ped: "1105505473563734106", observacao: "Histórico preservado" };
    const removed = normalizePedState({ ...original, grupo: "Removido" });
    assert.deepEqual(removed, { ...original, ...removedPedState });
    assert.equal(pedCategory(removed), "Removidos");
  });
  it("excludes removed records from Total de registros and active status counts", () => {
    assert.deepEqual(summarizePeds([
      { categoria: "Crianças", grupo: "Setado" }, { categoria: "StaffFilhos", grupo: "N/ Setado" },
      { categoria: "Removidos", grupo: "Setado" }, { categoria: "Removidos", grupo: "N/ Setado" },
      { categoria: "Crianças", grupo: "Removido" },
    ]), { total: 2, setados: 1, naoSetados: 1, removidos: 3 });
  });
});