import { test } from "node:test";
import assert from "node:assert/strict";
import { destinatarios, ehPara, pendenteParaMim, podeEnviarComunicado, textoDoPublico, type Comunicado, type MembroEquipe } from "./comunicados";

const equipe: MembroEquipe[] = [
  { id: "a", username: "Ana", role: "staff", areas: ["ilegal"] },
  { id: "b", username: "Bia", role: "coordinator", areas: ["eventos"] },
  { id: "c", username: "Caio", role: "support", areas: ["ilegal", "policia"] },
];
const alvo = (p: Partial<Pick<Comunicado, "publico" | "cargos" | "areas" | "pessoas">>) => ({
  publico: "todos" as const,
  cargos: [],
  areas: [],
  pessoas: [],
  ...p,
});

test("público: todos, cargos, áreas e staffs escolhidos", () => {
  assert.equal(destinatarios(alvo({}), equipe).length, 3);
  assert.deepEqual(destinatarios(alvo({ publico: "cargos", cargos: ["staff", "support"] }), equipe).map((m) => m.id), ["a", "c"]);
  assert.deepEqual(destinatarios(alvo({ publico: "areas", areas: ["ilegal"] }), equipe).map((m) => m.username).sort(), ["Ana", "Caio"]);
  assert.equal(ehPara(alvo({ publico: "pessoas", pessoas: ["b"] }), equipe[1]!), true);
  assert.equal(ehPara(alvo({ publico: "pessoas", pessoas: ["b"] }), equipe[0]!), false);
});

test("quem recebe vem em ordem de cargo (Coordinator primeiro)", () => {
  assert.equal(destinatarios(alvo({}), equipe)[0]!.username, "Bia");
});

test("pendente: aviso precisa confirmar; tarefa precisa ser feita; arquivado não conta", () => {
  const base = { arquivado: false, exige_leitura: true, tipo: "aviso" } as Comunicado;
  assert.equal(pendenteParaMim(base, undefined), true);
  assert.equal(pendenteParaMim(base, { comunicado_id: "x", user_id: "a", username: null, lido_em: "", concluido_em: null }), false);
  assert.equal(pendenteParaMim({ ...base, exige_leitura: false }, undefined), false);
  const tarefa = { ...base, tipo: "tarefa" } as Comunicado;
  assert.equal(pendenteParaMim(tarefa, { comunicado_id: "x", user_id: "a", username: null, lido_em: "", concluido_em: null }), true);
  assert.equal(pendenteParaMim({ ...base, arquivado: true }, undefined), false);
});

test("só Coordinator+ envia", () => {
  assert.equal(podeEnviarComunicado("coordinator"), true);
  assert.equal(podeEnviarComunicado("direcao"), true);
  assert.equal(podeEnviarComunicado("manager"), false);
  assert.equal(podeEnviarComunicado(undefined), false);
});

test("texto do público", () => {
  const nomes = { cargo: (r: string) => r.toUpperCase(), area: (a: string) => a, pessoa: (id: string) => `@${id}` };
  assert.equal(textoDoPublico(alvo({}), nomes), "Todos os staffs");
  assert.equal(textoDoPublico(alvo({ publico: "areas", areas: ["ilegal"] }), nomes), "Área ilegal");
  assert.equal(textoDoPublico(alvo({ publico: "pessoas", pessoas: ["a", "b", "c", "d"] }), nomes), "4 staffs escolhidos");
});
