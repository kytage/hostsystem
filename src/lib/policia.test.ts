import { test } from "node:test";
import assert from "node:assert/strict";
import { UNIDADES, estabDaUnidade, hasPoliciaAccess, patenteBonita, patenteNaUnidade } from "./policia";

const pm = UNIDADES.find((u) => u.id === "pm")!;
const civil = UNIDADES.find((u) => u.id === "civil")!;
const graer = UNIDADES.find((u) => u.grupo === "Graer")!;

test("patente pelo nível do grupo (1 = mais alta)", () => {
  assert.deepEqual(patenteNaUnidade(["Police:2", "BOPE:4"], pm), { nivel: 2, nome: "Coronel" });
  assert.deepEqual(patenteNaUnidade(["police:15"], pm), { nivel: 15, nome: "Recruta" });
  assert.deepEqual(patenteNaUnidade(["Graer:1"], graer), { nivel: 1, nome: "Comando GRAER" });
  assert.deepEqual(patenteNaUnidade(["Civil"], civil), { nivel: null, nome: "Sem patente" });
  assert.equal(patenteNaUnidade(["Police:2"], civil), null);
});

test("nomes de patente ficam legíveis", () => {
  assert.equal(patenteBonita("TenenteCoronel"), "Tenente-Coronel");
  assert.equal(patenteBonita("1Tenente"), "1º Tenente");
  assert.equal(patenteBonita("3Sargento"), "3º Sargento");
  assert.equal(patenteBonita("Inspetor2Classe"), "Inspetor 2ª Classe");
  assert.equal(patenteBonita("Agente1Classe"), "Agente 1ª Classe");
});

test("liga a unidade ao quadro POLICIA HOST pelo nome", () => {
  const estabs = [{ nome: "Polícia Militar" }, { nome: "Policia Civil" }, { nome: "GRAER" }];
  assert.equal(estabDaUnidade(pm, estabs)?.nome, "Polícia Militar");
  assert.equal(estabDaUnidade(civil, estabs)?.nome, "Policia Civil");
  assert.equal(estabDaUnidade(graer, estabs)?.nome, "GRAER");
});

test("acesso: Coordinator+ ou área Polícia", () => {
  assert.equal(hasPoliciaAccess("coordinator", []), true);
  assert.equal(hasPoliciaAccess("manager", ["policia"]), true);
  assert.equal(hasPoliciaAccess("manager", ["ilegal"]), false);
  assert.equal(hasPoliciaAccess(undefined, undefined), false);
});
