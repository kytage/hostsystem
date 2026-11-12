import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  ALL_ACTIONS,
  actionsFor,
  canAccessCombined,
  nivelDe,
  type ActionKey,
  type CategoryActions,
} from "./permissoes-regras";
import type { AppRole } from "./roles";

const mapa = (linhas: Record<string, ActionKey[]>): CategoryActions =>
  new Map(Object.entries(linhas));
const porCargo = (role: AppRole, linhas: Record<string, ActionKey[]>) =>
  new Map<AppRole, CategoryActions>([[role, mapa(linhas)]]);
const porArea = (area: string, linhas: Record<string, ActionKey[]>) =>
  new Map<string, CategoryActions>([[area, mapa(linhas)]]);
const vazio = new Map<AppRole, CategoryActions>();
const semAreas = new Map<string, CategoryActions>();

describe("Permissões por aba", () => {
  it("Players: toda a equipe vê, mas só vê", () => {
    assert.equal(canAccessCombined("staff", [], "players", vazio, semAreas), true);
    assert.deepEqual(actionsFor("staff", [], "players", vazio, semAreas), ["view"]);
  });

  it("sem permissão da pessoa, soma cargo e áreas", () => {
    const acoes = actionsFor(
      "staff",
      ["hospital"],
      "punicoes",
      porCargo("staff", { punicoes: ["view"] }),
      porArea("hospital", { punicoes: ["edit"] }),
    );
    assert.deepEqual(acoes, ["view", "edit"]);
  });

  it("a permissão da pessoa vale no lugar do cargo e das áreas", () => {
    const cargo = porCargo("staff", { punicoes: ["view", "create", "delete"] });
    const soVer = mapa({ punicoes: ["view"] });
    assert.deepEqual(actionsFor("staff", [], "punicoes", cargo, semAreas, soVer), ["view"]);

    const bloqueado = mapa({ punicoes: [], players: [] });
    assert.equal(canAccessCombined("staff", [], "punicoes", cargo, semAreas, bloqueado), false);
    assert.deepEqual(actionsFor("staff", [], "punicoes", cargo, semAreas, bloqueado), []);
    assert.equal(canAccessCombined("staff", [], "players", cargo, semAreas, bloqueado), false);

    const editar = mapa({ avisos: [...ALL_ACTIONS] });
    assert.equal(canAccessCombined("staff", [], "avisos", vazio, semAreas, editar), true);
    assert.deepEqual(actionsFor("staff", [], "avisos", vazio, semAreas, editar), ALL_ACTIONS);
  });

  it("o FOUNDER tem tudo, mesmo com bloqueio salvo para ele", () => {
    const bloqueado = mapa({ usuarios: [] });
    assert.equal(canAccessCombined("founder", [], "usuarios", vazio, semAreas, bloqueado), true);
    assert.deepEqual(
      actionsFor("founder", [], "usuarios", vazio, semAreas, bloqueado),
      ALL_ACTIONS,
    );
  });

  it("abas de regra fixa (Peds e Captações) ignoram a permissão da pessoa", () => {
    const tudo = mapa({ peds: [...ALL_ACTIONS], captacoes: [...ALL_ACTIONS] });
    assert.deepEqual(actionsFor("staff", [], "peds", vazio, semAreas, tudo), []);
    assert.equal(canAccessCombined("staff", [], "captacoes", vazio, semAreas, tudo), false);
    assert.equal(canAccessCombined("support", ["kids"], "peds", vazio, semAreas), true);
  });

  it("nível de uma lista de ações", () => {
    assert.equal(nivelDe([]), "nenhum");
    assert.equal(nivelDe(undefined), "nenhum");
    assert.equal(nivelDe(["view"]), "ver");
    assert.equal(nivelDe([...ALL_ACTIONS]), "editar");
    assert.equal(nivelDe(["view", "edit"]), "personalizado");
  });
});
