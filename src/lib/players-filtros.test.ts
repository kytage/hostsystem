import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTROS_PADRAO, ordenarPlayers, passaNosFiltros } from "./players-filtros";
import type { Player } from "./players";

const p = (o: Partial<Player>): Player => ({
  id: o.nome ?? "x", license: "l", passaporte: "1", nome: "X", idade: null, telefone: null, banco: 0, carteira: 0,
  grupos: [], inventario: [], veiculos: [], discord_id: null, discord_nome: null, online: false, level: 1, xp: 0,
  rank_vip: null, host_coins: 0, kills: 0, mortes: 0, headshots: 0, maior_sequencia: 0, ultimo_login: null,
  updated_at: "", whitelist: null, ...o,
});

test("ordena por dinheiro (banco + carteira) e por level", () => {
  const a = p({ nome: "A", banco: 100, carteira: 0, level: 5 });
  const b = p({ nome: "B", banco: 10, carteira: 500, level: 50 });
  const c = p({ nome: "C", banco: 0, carteira: 0, level: 1 });
  assert.deepEqual(ordenarPlayers([a, b, c], "dinheiro_desc").map((x) => x.nome), ["B", "A", "C"]);
  assert.deepEqual(ordenarPlayers([a, b, c], "dinheiro_asc").map((x) => x.nome), ["C", "A", "B"]);
  assert.deepEqual(ordenarPlayers([a, b, c], "level_desc").map((x) => x.nome), ["B", "A", "C"]);
});

test("filtros: cargo VIP, whitelist, level, dinheiro e veículos", () => {
  const admin = p({ grupos: ["Admin:1", "Ultra:2"], whitelist: true, level: 210, banco: 2_000_000, veiculos: ["sultan"] });
  const comum = p({ grupos: ["Police:3"], whitelist: false, level: 5, banco: 50 });
  const f = FILTROS_PADRAO;
  assert.equal(passaNosFiltros(admin, { ...f, cargo: "admin" }), true);
  assert.equal(passaNosFiltros(comum, { ...f, cargo: "admin" }), false);
  assert.equal(passaNosFiltros(comum, { ...f, cargo: "sem" }), true);
  assert.equal(passaNosFiltros(comum, { ...f, whitelist: "nolist" }), true);
  assert.equal(passaNosFiltros(admin, { ...f, level: "200+" }), true);
  assert.equal(passaNosFiltros(comum, { ...f, level: "200+" }), false);
  assert.equal(passaNosFiltros(admin, { ...f, dinheiro: "1m" }), true);
  assert.equal(passaNosFiltros(comum, { ...f, dinheiro: "ate10k" }), true);
  assert.equal(passaNosFiltros(comum, { ...f, veiculos: "com" }), false);
});

test("busca pelo ID da Host: 741 acha o #741 primeiro e não pega license/telefone", async () => {
  const { bateNaBusca, idDaBusca, ordenarPorId } = await import("./players-filtros");
  const p = (passaporte: string, extra: Partial<import("./players").Player> = {}) =>
    ({ passaporte, nome: "X", license: "", telefone: "", discord_nome: "", discord_id: "", veiculos: [], ...extra }) as unknown as import("./players").Player;
  assert.equal(idDaBusca("#741"), "741");
  assert.equal(idDaBusca("Dam"), null);
  const lista = [p("7410"), p("741"), p("74"), p("999", { telefone: "741-000", license: "741abc" })];
  const achados = lista.filter((x) => bateNaBusca(x, "741"));
  assert.deepEqual(ordenarPorId(achados, "741").map((x) => x.passaporte), ["741", "7410"]);
});
