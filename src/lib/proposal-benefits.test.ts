import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { LEVEL_KEYS, resolveBenefits, pixSchema } from "./proposal-benefits";
const defaults = { titulo: "NÍVEL 3", faixa: "+15", liderancaQtd: "até 3 pessoas", lideranca: "3x VIP ULTRA", gerenciaQtd: "até 7 pessoas", gerencia: "7x Blindados", vipFac: ["Uniforme"], camp: "Camp mensal", campExtras: "100 Coins", pix: true };
describe("Proposal benefit customization", () => {
  it("preserves all three default levels", () => assert.deepEqual(LEVEL_KEYS, ["nivel_1", "nivel_2", "nivel_3"]));
  it("uses defaults when a proposal has no override", () => assert.deepEqual(resolveBenefits(defaults, undefined), defaults));
  it("allows editing VIP quantities and free text without changing defaults", () => {
    const result = resolveBenefits(defaults, { ...defaults, lideranca: "5x VIP PERSONALIZADO", gerenciaQtd: "10 pessoas", vipFac: ["Rádio", "Salário extra"] });
    assert.equal(result.lideranca, "5x VIP PERSONALIZADO");
    assert.equal(result.gerenciaQtd, "10 pessoas");
    assert.deepEqual(result.vipFac, ["Rádio", "Salário extra"]);
    assert.equal(defaults.lideranca, "3x VIP ULTRA");
  });
  it("rejects negative and duplicate Pix thresholds", () => {
    assert.equal(pixSchema.safeParse([{ online: 15, valor: -1 }]).success, false);
    assert.equal(pixSchema.safeParse([{ online: 15, valor: 400 }, { online: 15, valor: 600 }]).success, false);
  });
});