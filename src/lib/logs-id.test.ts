import { test } from "node:test";
import assert from "node:assert/strict";
import { logMencionaId } from "./logs-id";

const log = (mensagem: string, jogador_id: string | null = null) => ({ mensagem, jogador_id });

test("ID 3 não pega #396, #335 nem #11", () => {
  assert.equal(logMencionaId(log("Responsável: #11 - Rayanne\nUsuário: #396 - Resilience"), "3"), false);
  assert.equal(logMencionaId(log("Usuário: #335 - Samufado"), "3"), false);
  assert.equal(logMencionaId(log("Quantidade: 3\nItem: banana"), "3"), false);
});

test("ID 3 é achado nos formatos das logs", () => {
  assert.equal(logMencionaId(log("Responsável: #3 - Julia Rvk"), "3"), true);
  assert.equal(logMencionaId(log("Passaporte: 3\nNome: Julia"), "3"), true);
  assert.equal(logMencionaId(log("Médico(a): 3 - Julia\nPaciente: 346 - Bmo"), "3"), true);
  assert.equal(logMencionaId(log("Proprietário: 3 - Julia"), "3"), true);
  assert.equal(logMencionaId(log("Type: [No_Clip8.2]\nId: 3\nDiscord: @x"), "3"), true);
  assert.equal(logMencionaId(log("qualquer coisa", "3"), "3"), true);
});
