import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aluguelDe,
  aplicar,
  CASAS,
  DELEGACIA,
  FIANCA,
  jogadaAutomatica,
  N_CASAS,
  novaSala,
  patrimonio,
  SALARIO,
  SALDO_INICIAL,
  type Acao,
  type Estado,
} from "./hoki-magnata";
import type { Visual } from "./hoki";

const visual = {} as Visual;
const sorteador = (semente: number) => () => {
  semente = (semente * 1664525 + 1013904223) % 4294967296;
  return semente / 4294967296;
};
/** Sorte que devolve os dados pedidos, na ordem. */
const dados = (...faces: number[]) => {
  let i = 0;
  return () => ((faces[i++ % faces.length] ?? 1) - 1) / 6 + 0.01;
};
const faz = (e: Estado, de: string, a: Acao, sorte = Math.random) => {
  const novo = aplicar(e, de, a, 1000, sorte);
  assert.ok(novo, `ação ${a.t} de ${de} deveria valer`);
  return novo;
};
function partida(n = 2): Estado {
  let e = novaSala("TESTE", { id: "a", nome: "Ana", visual });
  for (const id of ["b", "c", "d"].slice(0, n - 1)) {
    e = faz(e, id, { t: "entrar", nome: id.toUpperCase(), visual });
    e = faz(e, id, { t: "pronto", v: true });
  }
  // sorte perto de 1 mantém a ordem de entrada no sorteio dos turnos
  return faz(e, "a", { t: "iniciar" }, () => 0.999);
}
/** Rola com os dados pedidos e deixa o mascote chegar na casa. */
function rolar(e: Estado, d1: number, d2: number) {
  const id = e.jogadores[e.vez]!.id;
  e = faz(e, id, { t: "rolar" }, dados(d1, d2));
  e = faz(e, id, { t: "_prazo" });
  if (e.etapa === "andando") e = faz(e, id, { t: "_prazo" });
  return e;
}

test("o tabuleiro tem 36 casas e os cantos certos", () => {
  assert.equal(CASAS.length, N_CASAS);
  assert.deepEqual(
    [0, 9, 18, 27].map((i) => CASAS[i]!.tipo),
    ["partida", "delegacia", "praca", "blitz"],
  );
});

test("sala: só começa com 2 jogadores e todos prontos", () => {
  let e = novaSala("X", { id: "a", nome: "Ana", visual });
  assert.equal(aplicar(e, "a", { t: "iniciar" }, 0), null);
  e = faz(e, "b", { t: "entrar", nome: "Bia", visual });
  assert.equal(aplicar(e, "a", { t: "iniciar" }, 0), null);
  e = faz(e, "b", { t: "pronto", v: true });
  assert.equal(aplicar(e, "b", { t: "iniciar" }, 0), null, "só o anfitrião inicia");
  e = faz(e, "a", { t: "iniciar" });
  assert.equal(e.fase, "jogo");
});

test("comprar, pagar aluguel e só jogar na própria vez", () => {
  let e = partida();
  assert.equal(aplicar(e, "b", { t: "rolar" }, 0), null);
  e = rolar(e, 1, 2); // casa 3: Vanilla
  assert.equal(e.etapa, "decidir");
  e = faz(e, "a", { t: "comprar" });
  assert.equal(e.posses[3]?.dono, "a");
  assert.equal(e.jogadores[0]!.saldo, SALDO_INICIAL - 70);
  e = faz(e, "a", { t: "encerrar" });
  e = rolar(e, 1, 2);
  const aluguel = aluguelDe(e, 3);
  assert.ok(aluguel > 0);
  assert.equal(e.jogadores[1]!.saldo, SALDO_INICIAL - aluguel);
  assert.equal(e.jogadores[0]!.saldo, SALDO_INICIAL - 70 + aluguel);
});

test("recusar abre leilão e o maior lance leva", () => {
  let e = partida(3);
  e = rolar(e, 1, 2);
  e = faz(e, "a", { t: "recusar" });
  assert.equal(e.etapa, "leilao");
  e = faz(e, "b", { t: "lance", v: 10 });
  assert.equal(aplicar(e, "c", { t: "lance", v: 15 }, 0), null, "lance mínimo é +10");
  e = faz(e, "a", { t: "lance", v: 40 });
  e = faz(e, "a", { t: "_prazo" });
  assert.equal(e.posses[3]?.dono, "a");
  assert.equal(e.jogadores[0]!.saldo, SALDO_INICIAL - 40);
  assert.equal(e.etapa, "livre");
});

test("iguais dão outra jogada; três seguidos levam para a Delegacia", () => {
  let e = partida();
  e = rolar(e, 2, 2); // casa 4: imposto
  assert.equal(e.etapa, "rolar");
  assert.equal(e.jogadores[e.vez]!.id, "a");
  e = rolar(e, 1, 1); // casa 6: imóvel livre
  e = faz(e, "a", { t: "comprar" });
  assert.equal(e.etapa, "rolar");
  e = faz(e, "a", { t: "rolar" }, dados(3, 3));
  e = faz(e, "a", { t: "_prazo" });
  assert.equal(e.jogadores[0]!.pos, DELEGACIA);
  assert.equal(e.jogadores[0]!.preso, 1);
  assert.equal(e.etapa, "livre");
});

test("preso: fiança solta; cair na Delegacia andando é só visita", () => {
  let e = partida();
  e = rolar(e, 4, 5); // casa 9 pelo movimento normal
  assert.equal(e.jogadores[0]!.preso, 0);
  e = faz(e, "a", { t: "encerrar" });
  e.jogadores[1]!.preso = 1;
  e.jogadores[1]!.pos = DELEGACIA;
  e = faz(e, "b", { t: "fianca" });
  assert.equal(e.jogadores[1]!.preso, 0);
  assert.equal(e.jogadores[1]!.saldo, SALDO_INICIAL - FIANCA);
});

test("preso: três tentativas sem iguais pagam a fiança e andam", () => {
  let e = partida();
  e.jogadores[0]!.preso = 1;
  e.jogadores[0]!.pos = DELEGACIA;
  for (let k = 0; k < 2; k++) {
    e = faz(e, "a", { t: "rolar" }, dados(1, 2));
    e = faz(e, "a", { t: "_prazo" });
    assert.equal(e.etapa, "livre");
    e = faz(e, "a", { t: "encerrar" });
    e = faz(e, "b", { t: "rolar" }, dados(1, 3)); // casa 4, imposto
    e = faz(e, "b", { t: "_prazo" });
    e = faz(e, "b", { t: "_prazo" });
    e.jogadores[1]!.pos = 0;
    e = faz(e, "b", { t: "encerrar" });
  }
  assert.equal(e.jogadores[0]!.preso, 3);
  e = faz(e, "a", { t: "rolar" }, dados(1, 2));
  e = faz(e, "a", { t: "_prazo" });
  assert.equal(e.jogadores[0]!.preso, 0);
  assert.equal(e.jogadores[0]!.pos, DELEGACIA + 3);
});

test("passar pela Partida paga o salário", () => {
  let e = partida();
  e.jogadores[0]!.pos = 34;
  e = rolar(e, 1, 3); // casa 2: carta
  assert.equal(e.jogadores[0]!.saldo, SALDO_INICIAL + SALARIO);
});

test("construir exige o grupo inteiro e obra por igual", () => {
  let e = partida();
  e.posses[1] = { dono: "a", casas: 0, hip: false };
  assert.equal(aplicar(e, "a", { t: "construir", c: 1 }, 0), null);
  e.posses[3] = { dono: "a", casas: 0, hip: false };
  const semObra = aluguelDe(e, 1);
  e = faz(e, "a", { t: "construir", c: 1 });
  assert.equal(aplicar(e, "a", { t: "construir", c: 1 }, 0), null, "por igual");
  e = faz(e, "a", { t: "construir", c: 3 });
  assert.ok(aluguelDe(e, 1) > semObra);
  assert.equal(aplicar(e, "a", { t: "hipotecar", c: 1 }, 0), null, "com obra não hipoteca");
});

test("dívida: quem não paga vai à falência e o credor fica com os bens", () => {
  let e = partida();
  e.posses[3] = { dono: "b", casas: 5, hip: false };
  e.posses[1] = { dono: "b", casas: 5, hip: false };
  e.posses[6] = { dono: "a", casas: 0, hip: false };
  e.jogadores[0]!.saldo = 20;
  e = rolar(e, 1, 2);
  assert.equal(e.etapa, "divida");
  assert.equal(aplicar(e, "a", { t: "encerrar" }, 0), null);
  e = faz(e, "a", { t: "hipotecar", c: 6 });
  e = faz(e, "a", { t: "falir" });
  assert.equal(e.fase, "fim");
  assert.equal(e.posses[6]?.dono, "b");
  assert.equal(e.ranking?.[0]?.id, "b");
});

test("troca: os dois lados confirmam e os bens mudam de dono", () => {
  let e = partida();
  e.posses[1] = { dono: "a", casas: 0, hip: false };
  e.posses[6] = { dono: "b", casas: 0, hip: false };
  e = faz(e, "a", { t: "propor", para: "b", dou: [1], douD: 100, quero: [6], queroD: 0 });
  const id = e.trocas[0]!.id;
  assert.equal(
    aplicar(e, "a", { t: "troca", id, aceita: true }, 0),
    null,
    "quem propôs não aceita",
  );
  e = faz(e, "b", { t: "troca", id, aceita: true });
  assert.equal(e.posses[1]?.dono, "b");
  assert.equal(e.posses[6]?.dono, "a");
  assert.equal(e.jogadores[0]!.saldo, SALDO_INICIAL - 100);
  assert.equal(e.jogadores[1]!.saldo, SALDO_INICIAL + 100);
});

test("modo rápido: acabou o tempo, fecha no fim do turno pelo patrimônio", () => {
  let e = novaSala("R", { id: "a", nome: "Ana", visual });
  e = faz(e, "b", { t: "entrar", nome: "Bia", visual });
  e = faz(e, "b", { t: "pronto", v: true });
  e = faz(e, "a", { t: "modo", modo: "rapido" });
  e = faz(e, "a", { t: "iniciar" }, () => 0.999);
  e.posses[35] = { dono: "b", casas: 0, hip: false };
  e.fimEm = 500;
  e = rolar(e, 4, 5);
  e = faz(e, "a", { t: "encerrar" });
  assert.equal(e.fase, "fim");
  assert.equal(e.ranking?.[0]?.id, "b");
  assert.equal(e.ranking?.[0]?.patrimonio, patrimonio(e, "b"));
});

test("partidas inteiras no automático sempre terminam e o dinheiro fecha", () => {
  for (let semente = 1; semente <= 30; semente++) {
    const sorte = sorteador(semente);
    let e = partida(2 + (semente % 3));
    // robôs que não constroem podem jogar para sempre: aqui a partida fecha pelo tempo
    e.modo = "rapido";
    e.fimEm = 4_000_000;
    let agora = 1000;
    let passos = 0;
    while (e.fase === "jogo" && passos++ < 60_000) {
      agora += 1000;
      const j = e.jogadores[e.vez]!;
      let a: Acao | null = e.prazo !== null ? { t: "_prazo" } : jogadaAutomatica(e);
      // os robôs compram quando dá, para a partida ter imóveis e aluguéis
      if (e.etapa === "decidir" && j.saldo >= (CASAS[j.pos]?.preco ?? 0) + 200)
        a = { t: "comprar" };
      assert.ok(a, `travou na etapa ${e.etapa}`);
      const novo = aplicar(e, j.id, a, agora, sorte);
      assert.ok(novo, `ação ${a.t} recusada na etapa ${e.etapa}`);
      e = novo;
      for (const x of e.jogadores) assert.ok(Number.isFinite(x.saldo));
      for (const p of Object.values(e.posses))
        assert.ok(!e.jogadores.find((x) => x.id === p.dono)?.falido);
    }
    assert.equal(e.fase, "fim", `semente ${semente} não terminou`);
    assert.equal(e.ranking?.length, e.jogadores.length);
  }
});
