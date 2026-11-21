import { test } from "node:test";
import assert from "node:assert/strict";
import { TABELA_EXEMPLO, lerDestaque, lerTabela, nomeDoArquivo, separarMoeda } from "./arte-modelos";

test("palavra entre asteriscos sai em vermelho", () => {
  assert.deepEqual(lerDestaque("BENEFÍCIO *E* ARMAS"), [
    [
      { t: "BENEFÍCIO ", vermelho: false },
      { t: "E", vermelho: true },
      { t: " ARMAS", vermelho: false },
    ],
  ]);
  assert.equal(lerDestaque("LINHA 1\n*LINHA 2*").length, 2);
});

test("tabela de exemplo: 3 colunas, seções e linhas", () => {
  const c = lerTabela(TABELA_EXEMPLO);
  assert.equal(c.length, 3);
  assert.equal(c[0]![0]!.titulo, "ARMAS");
  assert.equal(c[0]![0]!.legenda, "R$ / UNIDADE");
  assert.equal(c[0]![0]!.linhas.length, 9);
  assert.deepEqual(c[1]![0]!.linhas[2], { produto: "HOSTWATCH", a: "—", b: "R$ 5.000" });
  assert.equal(c[2]![0]!.linhas.length, 12);
});

test("linha sem seção e valores faltando", () => {
  const c = lerTabela("ITEM ; R$ 10");
  assert.deepEqual(c[0]![0]!.linhas[0], { produto: "ITEM", a: "R$ 10", b: "—" });
});

test("moeda separada do número", () => {
  assert.deepEqual(separarMoeda("R$ 55.000"), { moeda: "R$", valor: "55.000" });
  assert.deepEqual(separarMoeda("35%"), { moeda: "", valor: "35%" });
});

test("nome do arquivo", () => {
  assert.equal(nomeDoArquivo({ formato: "banner", titulo: "BENEFÍCIO *E* ARMAS" }), "host-banner-beneficio-e-armas.png");
});
