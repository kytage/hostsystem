import { test } from "node:test";
import assert from "node:assert/strict";
import { lidoPeloBot } from "./logs-bot";

test("bot lê só as categorias dos scripts protegidos", () => {
  assert.equal(lidoPeloBot("anti-cheat/ban-pl"), true);
  assert.equal(lidoPeloBot("banco/pix"), true);
  assert.equal(lidoPeloBot("mdt/prisões"), true);
  assert.equal(lidoPeloBot("celular/celular"), true);
  assert.equal(lidoPeloBot("inventario/usou"), false);
  assert.equal(lidoPeloBot("staffs/nc"), false);
});
