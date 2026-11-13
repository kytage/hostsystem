import { test } from "node:test";
import assert from "node:assert/strict";
import { escolherRoubo, escreverBoletim, sementeDe, sorteio } from "./boletim";

const roubo = {
  ladrao: "Zeca",
  vitima: "Lia",
  levou: [
    { nome: "Melancia", qtd: 2 },
    { nome: "Ovos", qtd: 1 },
  ],
  ouros: 1045,
  estragados: 2,
  em: Date.UTC(2026, 10, 13, 6, 30), // 03:30 em Brasília
};

test("boletim: mesma semente, mesma história; o texto cita quem roubou, a vítima e o que sumiu", () => {
  const a = escreverBoletim(roubo, sementeDe("2026-11-13"));
  assert.deepEqual(escreverBoletim(roubo, sementeDe("2026-11-13")), a);
  assert.ok(a.titulo.length > 5 && a.titulo.length <= 90, a.titulo);
  assert.ok(a.texto.includes("Zeca"));
  assert.ok(a.texto.includes("Lia"));
  assert.ok(/melancia/.test(a.texto) || /1\.045 Ouros/.test(a.texto), a.texto);
  assert.ok(!/\{[a-z_]+\}/.test(a.titulo + a.texto), "sobrou marcador sem trocar");
  assert.equal(a.texto.split("\n\n").length, 3);
});

test("boletim: muitas sementes, nenhum marcador sobrando e sem item quando só estragou", () => {
  const titulos = new Set<string>();
  for (let k = 0; k < 400; k++) {
    for (const r of [
      roubo,
      { ...roubo, levou: [], ouros: 0, em: Date.UTC(2026, 10, 13, 15, 0) }, // meio-dia
      { ...roubo, estragados: 0, em: Date.UTC(2026, 10, 13, 3, 0) }, // meia-noite
    ]) {
      const b = escreverBoletim(r, k);
      titulos.add(b.titulo);
      assert.ok(!/\{[a-z_]+\}/.test(b.titulo + b.texto), `${b.titulo} ${b.texto}`);
      assert.ok(!b.texto.includes("das 0") && !b.texto.includes("pelas 0"), b.texto);
      if (!r.levou.length) assert.ok(!b.titulo.includes("cesta de  ") && !b.titulo.endsWith("de "));
    }
  }
  assert.ok(titulos.size >= 8);
});

test("boletim: o roubo do dia é sorteado sempre igual e não repete os que já saíram", () => {
  const lista = ["c", "a", "b"].map((id) => ({ id }));
  const hoje = escolherRoubo(lista, "2026-11-13", new Set());
  assert.deepEqual(escolherRoubo([...lista].reverse(), "2026-11-13", new Set()), hoje);
  const outro = escolherRoubo(lista, "2026-11-13", new Set([hoje!.id]));
  assert.notEqual(outro?.id, hoje?.id);
  assert.equal(escolherRoubo(lista, "2026-11-13", new Set(["a", "b", "c"])), null);
  const s = sorteio(7);
  for (let k = 0; k < 50; k++) {
    const v = s();
    assert.ok(v >= 0 && v < 1);
  }
});
