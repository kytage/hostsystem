import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cargoDoPlayer,
  lerGrupo,
  lerGrupos,
  progressoNoRank,
  rankDoNivel,
  resumirLogs,
  type LogDoPlayer,
} from "./player-perfil";

test("cargo do topo segue a prioridade e ignora maiúsculas", () => {
  assert.equal(cargoDoPlayer(lerGrupos(["Ultimate", "Boss", "Admin"]))?.id, "admin");
  assert.equal(cargoDoPlayer(lerGrupos(["ultra", "Streamer02"]))?.id, "streamer");
  assert.equal(cargoDoPlayer(lerGrupos(["Ultra", "BabyUltra"]))?.id, "baby_ultra");
  assert.equal(cargoDoPlayer(lerGrupos(["Doadorbaby", "Police"]))?.id, "baby");
  assert.equal(cargoDoPlayer(lerGrupos(["Police", "Armas04"])), null);
});

test("rank por nível respeita as faixas", () => {
  assert.equal(rankDoNivel(0).min, 0);
  assert.equal(rankDoNivel(19).min, 0);
  assert.equal(rankDoNivel(20).min, 20);
  assert.equal(rankDoNivel(99).min, 90);
  assert.equal(rankDoNivel(149).min, 100);
  assert.equal(rankDoNivel(250).min, 250);
  assert.equal(rankDoNivel(999).ate, null);
  assert.equal(progressoNoRank(25), 0.5);
  assert.equal(progressoNoRank(300), 1);
});

test("grupo com nível em vários formatos", () => {
  assert.deepEqual(lerGrupo("Police:3"), { nome: "Police", nivel: 3, bruto: "Police:3" });
  assert.deepEqual(lerGrupo("Police (2)"), { nome: "Police", nivel: 2, bruto: "Police (2)" });
  assert.deepEqual(lerGrupo("Armas04"), { nome: "Armas04", nivel: null, bruto: "Armas04" });
});

test("resumo das logs conta categorias, dias e anti-cheat", () => {
  const agora = new Date("2026-11-19T15:00:00");
  const log = (canal: string, iso: string, id: number): LogDoPlayer => ({
    id,
    canal,
    jogador_id: "1",
    jogador_nome: null,
    mensagem: "",
    dados: {},
    criado_em: iso,
  });
  const r = resumirLogs(
    [
      log("anti-cheat/ban-pl", "2026-11-19T14:00:00", 1),
      log("anti-cheat/aimbot", "2026-11-19T10:00:00", 2),
      log("banco/transferencia", "2026-11-10T10:00:00", 3),
    ],
    agora,
  );
  assert.equal(r.total, 3);
  assert.equal(r.hoje, 2);
  assert.equal(r.ultimos7, 2);
  assert.equal(r.antiCheat, 2);
  assert.equal(r.porCategoria[0]?.id, "anti-cheat");
  assert.equal(r.porDia.length, 14);
  assert.equal(r.porDia.at(-1)?.total, 2);
});

test("situação: banido > temporário > whitelist > nolist > sem dado", async () => {
  const { situacaoDoPlayer } = await import("./player-perfil");
  const ban = (o: Partial<{ ativo: boolean; temporario: boolean; ate: string | null }>) => ({
    jogadorId: "5",
    punicao: "Banimento Permanente",
    data: "2026-11-01T00:00:00Z",
    ativo: true,
    temporario: false,
    ate: null,
    ...o,
  });
  assert.equal(situacaoDoPlayer("5", true, [ban({})]).id, "banido");
  assert.equal(
    situacaoDoPlayer("5", true, [ban({ temporario: true, ate: "2026-12-01T00:00:00Z" })]).id,
    "banido_temp",
  );
  assert.equal(situacaoDoPlayer("5", true, [ban({ ativo: false })]).id, "whitelist");
  assert.equal(situacaoDoPlayer("5", false, []).id, "nolist");
  assert.equal(situacaoDoPlayer("5", null, []).id, "sem_dado");
  assert.equal(situacaoDoPlayer("6", true, [ban({})]).id, "whitelist");
});

test("horas online: entrada→saída, sessão aberta e virada de dia", async () => {
  const { calcularHorasOnline } = await import("./player-perfil");
  const agora = new Date("2026-11-19T15:00:00");
  const r = calcularHorasOnline(
    ["2026-11-18T22:00:00", "2026-11-19T10:00:00", "2026-11-19T13:00:00"],
    ["2026-11-19T01:00:00", "2026-11-19T12:00:00"],
    true,
    agora,
  );
  // 18/11: 2h (22h-00h) · 19/11: 1h + 2h + 2h (sessão aberta até 15h) = 5h
  assert.equal(r.porDia.at(-2)?.horas, 2);
  assert.equal(r.porDia.at(-1)?.horas, 5);
  assert.equal(r.horas7, 7);
  assert.equal(r.sessoes, 3);
});
