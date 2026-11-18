import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS_META } from "./ilegal-data";
import { HEX_CATEGORIA, hexDaCategoria } from "./ilegal-cores";

const ids = CATEGORIAS_META.map((c) => c.id);

test("Central existe como setagem do Ilegal", () => {
  assert.ok(ids.includes("central"));
  assert.equal(CATEGORIAS_META.find((c) => c.id === "central")?.nome, "Central");
});

test("Garagem e Drogas não aparecem mais como setagens separadas", () => {
  assert.ok(!ids.includes("garagem"));
  assert.ok(!ids.includes("drogas"));
});

test("Central tem cor própria e as antigas não têm mais", () => {
  assert.equal(HEX_CATEGORIA["central"], "#0ea5e9");
  assert.equal(HEX_CATEGORIA["garagem"], undefined);
  assert.equal(HEX_CATEGORIA["drogas"], undefined);
  assert.equal(hexDaCategoria("central"), "#0ea5e9");
});
