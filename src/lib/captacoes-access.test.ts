import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { hasCaptacoesArea, hasCaptacoesAccess } from "./captacoes-access";

describe("Captações area access", () => {
  it("allows ILEGAL members", () => {
    assert.equal(hasCaptacoesArea(["ilegal"]), true);
  });
  it("allows CAPTAÇÃO members", () => {
    assert.equal(hasCaptacoesArea(["captacao"]), true);
  });
  it("allows POLÍCIA area to view and edit Captações without a privileged role", () => {
    assert.equal(hasCaptacoesArea(["policia"]), true);
    assert.equal(hasCaptacoesAccess("support", ["policia"]), true);
    assert.equal(hasCaptacoesAccess("support", []), false);
  });
  it("denies other areas and missing assignments", () => {
    assert.equal(hasCaptacoesArea(["staff", "financeiro", "devarea"]), false);
    assert.equal(hasCaptacoesArea([]), false);
    assert.equal(hasCaptacoesArea(undefined), false);
  });
});

describe("Captações access (área ou cargo)", () => {
  it("allows Coordinator, Direção, CEO e Founder mesmo sem área", () => {
    assert.equal(hasCaptacoesAccess("coordinator", []), true);
    assert.equal(hasCaptacoesAccess("direcao", undefined), true);
    assert.equal(hasCaptacoesAccess("c_level", []), true);
    assert.equal(hasCaptacoesAccess("founder", undefined), true);
  });
  it("allows area members with any other role", () => {
    assert.equal(hasCaptacoesAccess("staff", ["ilegal"]), true);
    assert.equal(hasCaptacoesAccess("dev", ["captacao"]), true);
  });
  it("denies cargos fora da lista e sem área", () => {
    assert.equal(hasCaptacoesAccess("manager", []), false);
    assert.equal(hasCaptacoesAccess("staff", ["financeiro"]), false);
    assert.equal(hasCaptacoesAccess(undefined, undefined), false);
  });
});
