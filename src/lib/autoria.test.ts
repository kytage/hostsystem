import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buscaBate,
  contextoVazio,
  descobrirChaves,
  mudancasDoRegistro,
  resumoDasMudancas,
  rotuloDoCampo,
  textoDeBusca,
  tituloDoRegistro,
  type RegistroAutoria,
} from "./autoria";

const reg = (p: Partial<RegistroAutoria> & { id: number }): RegistroAutoria => ({
  tabela: "ilegal_detalhes",
  acao: "UPDATE",
  registro_id: null,
  campos: [],
  antes: null,
  depois: null,
  ...p,
});

test("descobre qual ficha cada edição mexeu, voltando no tempo", () => {
  const atuais = [
    { org_id: "local-favela-barragem", nome2: "Rafaella", telefone2: "000001" },
    { org_id: "local-favela-selva", nome2: "Joao", telefone2: "" },
  ];
  const historico = [
    // mais velha: Barragem recebeu "Ana", depois trocou para "Rafaella"
    reg({ id: 1, campos: ["nome2"], antes: { nome2: "" }, depois: { nome2: "Ana" } }),
    reg({ id: 2, campos: ["nome2", "telefone2"], antes: { nome2: "Ana", telefone2: "" }, depois: { nome2: "Rafaella", telefone2: "000001" } }),
    reg({ id: 3, campos: ["nome2"], antes: { nome2: "" }, depois: { nome2: "Joao" } }),
  ];
  const k = descobrirChaves(historico, atuais, "org_id");
  assert.equal(k.get(2), "local-favela-barragem");
  assert.equal(k.get(1), "local-favela-barragem");
  assert.equal(k.get(3), "local-favela-selva");
});

test("ficha apagada: a edição antes da exclusão ainda é achada", () => {
  const historico = [
    reg({ id: 1, campos: ["cds_craft"], antes: { cds_craft: "" }, depois: { cds_craft: "1, 2, 3" } }),
    reg({ id: 2, acao: "DELETE", antes: { org_id: "local-favela-colombia", cds_craft: "1, 2, 3" } }),
  ];
  const k = descobrirChaves(historico, [], "org_id");
  assert.equal(k.get(2), "local-favela-colombia");
  assert.equal(k.get(1), "local-favela-colombia");
});

test("duas fichas iguais: não chuta", () => {
  const atuais = [
    { org_id: "a", nome1: "X" },
    { org_id: "b", nome1: "X" },
  ];
  const k = descobrirChaves([reg({ id: 1, campos: ["nome1"], antes: { nome1: "" }, depois: { nome1: "X" } })], atuais, "org_id");
  assert.equal(k.has(1), false);
});

test("título da ficha usa a organização: setagem · local · organização", () => {
  const ctx = contextoVazio();
  ctx.linhas.set("ilegal_orgs:local-favela-barragem", {
    id: "local-favela-barragem",
    setagem: "Armas01",
    local: "Favela Barragem",
    organizacao: "AVENUE",
  });
  ctx.chaves.set(7, "local-favela-barragem");
  const l = reg({ id: 7, campos: ["nome2"], antes: { nome2: "" }, depois: { nome2: "Rafaella" } });
  assert.equal(tituloDoRegistro(l, ctx), "Armas01 · Favela Barragem · AVENUE");
  assert.equal(resumoDasMudancas(l, ctx), "Nome 2: — → Rafaella");
});

test("organização que ficou livre continua com o nome antigo no título", () => {
  const ctx = contextoVazio();
  ctx.linhas.set("ilegal_orgs:local-favela-colombia", { id: "local-favela-colombia", setagem: "Armas04", local: "Favela Colombia", organizacao: "" });
  const l = reg({
    id: 9,
    tabela: "ilegal_orgs",
    registro_id: "local-favela-colombia",
    campos: ["organizacao", "status"],
    antes: { id: "local-favela-colombia", organizacao: "BAIT", status: "Reservada" },
    depois: { id: "local-favela-colombia", organizacao: "", status: "Livre" },
  });
  assert.equal(tituloDoRegistro(l, ctx), "Armas04 · Favela Colombia · BAIT");
});

test("dentro de objeto mostra só o que mudou; lista mostra o que entrou e saiu", () => {
  const l = reg({
    id: 1,
    campos: ["vip_config", "vips"],
    antes: { vip_config: { salario: "R$ 2.000", bauLider: "5000kg" }, vips: ["Ouro"] },
    depois: { vip_config: { salario: "R$ 3.000", bauLider: "5000kg" }, vips: ["Ouro", "Prata"] },
  });
  const m = mudancasDoRegistro(l, contextoVazio());
  assert.equal(m[0]!.rotulo, "Configuração VIP › Salário");
  assert.deepEqual(m[1]!.entrou, ["Prata"]);
  assert.deepEqual(m[1]!.saiu, []);
});

test("busca acha por valor, pessoa e organização, sem acento", () => {
  const ctx = contextoVazio();
  ctx.chaves.set(1, "local-favela-colombia");
  const l = { ...reg({ id: 1, campos: ["nome2"], antes: { nome2: "" }, depois: { nome2: "Rafaella" } }), username: "pequim" };
  const t = textoDeBusca(l, ctx);
  assert.ok(buscaBate(t, "rafaella"));
  assert.ok(buscaBate(t, "pequim colômbia"));
  assert.ok(buscaBate(t, "telefone") === false);
  assert.ok(buscaBate(t, "nome 2"));
});

test("nomes dos campos", () => {
  assert.equal(rotuloDoCampo("telefone2"), "Telefone 2");
  assert.equal(rotuloDoCampo("cds_bau_lider"), "CDS do baú do líder");
  assert.equal(rotuloDoCampo("algumCampoNovo"), "Algum campo novo");
});
