import { test } from "node:test";
import assert from "node:assert/strict";
import { isSemLocal, statusPorLocal } from "./ilegal-status";

test("sem nenhum local a setagem fica Fechado automaticamente", () => {
  for (const local of ["", "   ", "-", "—", "sem local", "(sem local)"]) {
    assert.equal(isSemLocal(local), true, `local "${local}" deve ser considerado vazio`);
  }
  assert.equal(isSemLocal("Casa do Franklin"), false);
  assert.equal(statusPorLocal({ local: "", status: "Assumida" }), "Fechado");
  assert.equal(statusPorLocal({ local: "-", status: "Livre" }), "Fechado");
  assert.equal(statusPorLocal({ local: "Casa 1", status: "Assumida" }), "Assumida");
});
