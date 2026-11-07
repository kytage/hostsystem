import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { hasPedsAccess } from "./peds-access";
import { pedSchema, emptyPed } from "./peds-schema";
describe("Peds access", () => {
  for (const role of ["founder", "c_level", "direcao", "coordinator"] as const) it(`allows ${role} without area`, () => assert.equal(hasPedsAccess(role, []), true));
  it("allows area kids", () => assert.equal(hasPedsAccess("support", ["kids"]), true));
  for (const area of ["ped", "peds"]) it(`denies removed area ${area}`, () => assert.equal(hasPedsAccess("support", [area]), false));
  for (const role of ["manager", "head_moderator", "staff", "support", "contributor", "dev"] as const) it(`denies ${role} without PED/KIDS`, () => assert.equal(hasPedsAccess(role, ["ilegal", "policia"]), false));
  it("denies unresolved access", () => assert.equal(hasPedsAccess(undefined, undefined), false));
});
describe("Ped identifiers", () => {
  it("preserves long Discord IDs and multiple passports as text", () => {
    const result = pedSchema.parse({ ...emptyPed("Crianças"), responsavel: "Fael", arquivo: "IceSpacys_BoosterGirl", discord_ped: "1105505473563734106", discord_responsavel: "257980670310088705 | 1164962688695275561", passaporte_responsavel: "1071 / 201" });
    assert.equal(result.discord_ped, "1105505473563734106");
    assert.equal(result.discord_responsavel, "257980670310088705 | 1164962688695275561");
    assert.equal(result.passaporte_responsavel, "1071 / 201");
  });
});