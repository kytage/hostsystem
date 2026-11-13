import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarDano,
  aplicarEscudo,
  aplicarLentidao,
  creditoDaMorte,
  criarLutador,
  velocidadeAtual,
} from "./combate";
import { FORJA, SIEGE, lado } from "./config";
import {
  acao,
  criarPartida,
  escolherKit,
  kitsLivres,
  moverJogador,
  passo,
  type Partida,
} from "./partida";

const livre = () => true;
const mapa = { livre };

/** Partida já na fase de jogo (pula a preparação). */
function emJogo(jogadores: { id: string; time: "vermelho" | "azul" }[]) {
  let t = 0;
  const p = criarPartida(
    "privada",
    jogadores.map((j) => ({ ...j, nome: j.id })),
    t,
  );
  for (const j of jogadores) escolherKit(p, j.id, kitsLivres(p, j.time, j.id)[0]!);
  t += SIEGE.PREPARACAO_S * 1000 + 1;
  passo(p, t, 0.1, mapa);
  assert.equal(p.fase, "partida");
  return { p, t };
}
const rodar = (p: Partida, de: number, s: number) => {
  let t = de;
  for (let i = 0; i < s * 10; i++) {
    t += 100;
    passo(p, t, 0.1, mapa);
  }
  return t;
};
const colocar = (p: Partida, id: string, x: number, z: number) =>
  moverJogador(p, id, { x, z, y: 30, rumo: 0 });

test("combate: sem fogo amigo e o escudo é gasto antes da vida", () => {
  const a = criarLutador("a", "vermelho");
  const b = criarLutador("b", "vermelho");
  const c = criarLutador("c", "azul");
  assert.equal(aplicarDano(a, 30, { id: b.id, time: b.time }, 0).vida, 0);
  aplicarEscudo(a, 20, 4000, 0);
  const r = aplicarDano(a, 30, { id: c.id, time: c.time }, 100);
  assert.equal(r.escudo, 20);
  assert.equal(r.vida, 10);
  assert.equal(a.hp, 90);
});

test("combate: escudos não somam e lentidões não acumulam", () => {
  const a = criarLutador("a", "vermelho");
  aplicarEscudo(a, 40, 4000, 0);
  aplicarEscudo(a, 20, 4000, 1000);
  assert.equal(a.escudo.valor, 40);
  aplicarLentidao(a, 0.7, 2000, 0);
  aplicarLentidao(a, 0.7, 2000, 500);
  assert.equal(velocidadeAtual(a, 1000), 0.7);
});

test("combate: crédito da eliminação e assistência", () => {
  const alvo = criarLutador("x", "azul");
  aplicarDano(alvo, 20, { id: "a", time: "vermelho" }, 0);
  aplicarDano(alvo, 30, { id: "b", time: "vermelho" }, 3000);
  const c = creditoDaMorte(alvo, 4000);
  assert.equal(c.elimina, "b");
  assert.deepEqual(c.assistencias, ["a"]);
  // depois de 5 s sem dano, a queda não dá ponto a ninguém
  assert.equal(creditoDaMorte(alvo, 9500).elimina, null);
});

test("kits: um por time, e a escolha simultânea do mesmo kit não passa", () => {
  const p = criarPartida(
    "privada",
    [
      { id: "a", nome: "a", time: "vermelho" },
      { id: "b", nome: "b", time: "vermelho" },
    ],
    0,
  );
  assert.ok(escolherKit(p, "a", "vanguarda"));
  assert.ok(!escolherKit(p, "b", "vanguarda"));
  assert.ok(escolherKit(p, "b", "atirador"));
});

test("Forja: 6 s de presença exclusiva captura e expõe o Guardião inimigo", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  colocar(p, "v", FORJA.x, FORJA.z);
  colocar(p, "a", 30, 0);
  // (2 s de proteção ao sair do spawn não contam para a captura)
  const t2 = rodar(p, t, SIEGE.PROTECAO_SPAWN_S + 6.3);
  assert.equal(p.forja.estado, "janela");
  assert.equal(p.pontos.vermelho, SIEGE.FORJA_PONTOS);
  assert.ok(p.guardioes.azul.expostoAte > t2);
  assert.equal(p.jogadores.get("v")!.stats.capturas, 1);
});

test("Forja: contestada pausa; quem tinha progresso saindo zera a barra", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  colocar(p, "v", 0, 0);
  colocar(p, "a", 30, 0);
  let t2 = rodar(p, t, 3);
  const meio = p.forja.progresso;
  colocar(p, "a", 1, 0);
  t2 = rodar(p, t2, 2);
  assert.ok(p.forja.contestada);
  assert.ok(Math.abs(p.forja.progresso - meio) < 0.01);
  colocar(p, "v", 30, 0);
  rodar(p, t2, 0.2);
  assert.equal(p.forja.time, "azul");
  assert.ok(p.forja.progresso < 0.5);
});

test("Guardião: barreira bloqueia dano; exposto perde vida que fica; 50 de dano = 1 ponto", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  const g = lado("azul").guardiao;
  colocar(p, "v", g.x - 1.2, g.z);
  const rumo = Math.PI / 2;
  acao(p, "v", { tipo: "ataque", rumo }, t, mapa);
  assert.equal(p.guardioes.azul.hp, SIEGE.HP_GUARDIAO);
  p.guardioes.azul.expostoAte = t + 60000;
  let agora = t + 1000;
  for (let i = 0; i < 3; i++) {
    acao(p, "v", { tipo: "ataque", rumo }, agora, mapa);
    agora += 800;
  }
  const kitDano = 60; // vanguarda: 20 x 3
  assert.equal(p.guardioes.azul.hp, SIEGE.HP_GUARDIAO - kitDano);
  assert.equal(p.pontos.vermelho, 1);
  p.guardioes.azul.expostoAte = 0;
  acao(p, "v", { tipo: "ataque", rumo }, agora + 1000, mapa);
  assert.equal(p.guardioes.azul.hp, SIEGE.HP_GUARDIAO - kitDano);
});

test("Guardião derrubado: vitória imediata", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  const g = lado("azul").guardiao;
  colocar(p, "v", g.x - 1.2, g.z);
  p.guardioes.azul.hp = 10;
  p.guardioes.azul.expostoAte = t + 60000;
  acao(p, "v", { tipo: "ataque", rumo: Math.PI / 2 }, t + 10, mapa);
  assert.equal(p.fase, "resultado");
  assert.equal(p.resultado?.vencedor, "vermelho");
});

test("fim do tempo: desempate por vida do Guardião, depois por pontos, senão empate", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  colocar(p, "v", 70, 30);
  colocar(p, "a", -70, 30);
  p.guardioes.vermelho.hp = 900;
  rodar(p, t, SIEGE.PARTIDA_S + 1);
  assert.equal(p.resultado?.vencedor, "azul");
  const b = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  b.p.pontos.vermelho = 3;
  rodar(b.p, b.t, SIEGE.PARTIDA_S + 1);
  assert.equal(b.p.resultado?.vencedor, "vermelho");
  const c = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  rodar(c.p, c.t, SIEGE.PARTIDA_S + 1);
  assert.equal(c.p.resultado?.vencedor, "empate");
});

test("prorrogação: com a Forja em disputa no fim do tempo", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  colocar(p, "v", 0, 0);
  colocar(p, "a", 0.5, 0);
  rodar(p, t, SIEGE.PARTIDA_S + 1);
  assert.equal(p.fase, "prorrogacao");
});

test("poção: tomar dano interrompe e não gasta a carga", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  const v = p.jogadores.get("v")!;
  colocar(p, "v", 0, 0);
  colocar(p, "a", 0, 1);
  v.hp = 50;
  assert.ok(acao(p, "v", { tipo: "pocao" }, t, mapa));
  acao(p, "a", { tipo: "ataque", rumo: Math.PI }, t + 300, mapa);
  passo(p, t + 1200, 0.1, mapa);
  assert.equal(v.pocao, 1);
  assert.ok(v.hp < 50);
});

test("queda: sem atacante não dá ponto; com dano recente dá", () => {
  const { p, t } = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  moverJogador(p, "a", { x: 0, z: 0, y: 0, rumo: 0 });
  passo(p, t + 100, 0.1, mapa);
  assert.equal(p.pontos.vermelho, 0);
  const b = emJogo([
    { id: "v", time: "vermelho" },
    { id: "a", time: "azul" },
  ]);
  colocar(b.p, "v", 0, 0);
  colocar(b.p, "a", 0, 1);
  acao(b.p, "v", { tipo: "ataque", rumo: 0 }, b.t + 10, mapa);
  moverJogador(b.p, "a", { x: 0, z: 1, y: 0, rumo: 0 });
  passo(b.p, b.t + 500, 0.1, mapa);
  assert.equal(b.p.pontos.vermelho, 1);
});
