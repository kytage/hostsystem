import { test } from "node:test";
import assert from "node:assert/strict";
import { ordenarSetagens } from "./ilegal-data";

test("setagens em ordem crescente, número como número, sem nome no fim", () => {
  const nomes = ["Armas05", "", "Armas10", "Armas01", "armas02", "Armas06"];
  const r = ordenarSetagens(nomes.map((setagem, ordem) => ({ setagem, ordem })));
  assert.deepEqual(
    r.map((o) => o.setagem),
    ["Armas01", "armas02", "Armas05", "Armas06", "Armas10", ""],
  );
});
