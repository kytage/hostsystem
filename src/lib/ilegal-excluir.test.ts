import { test } from "node:test";
import assert from "node:assert/strict";
import { excluirSetagemSchema } from "./ilegal-excluir";

test("exclusão exige a palavra EXCLUIR", () => {
  const dados = { id: "a1", setagem: "Armas01", confirmacao: "" };
  assert.equal(excluirSetagemSchema.safeParse(dados).success, false);
  assert.equal(excluirSetagemSchema.safeParse({ ...dados, confirmacao: "Armas01" }).success, false);
  assert.equal(excluirSetagemSchema.safeParse({ ...dados, confirmacao: "excluir" }).success, false);
  assert.equal(excluirSetagemSchema.safeParse({ ...dados, confirmacao: " EXCLUIR " }).success, true);
});