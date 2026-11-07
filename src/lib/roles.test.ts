import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { ROLE_ORDER, roleRank } from "./roles";

describe("Staff hierarchy", () => {
  it("places Head Moderator directly after Manager", () => {
    assert.equal(ROLE_ORDER[roleRank("manager") + 1], "head_moderator");
    assert.equal(ROLE_ORDER[roleRank("head_moderator") + 1], "staff");
  });
  it("places Contributor directly after Support", () => {
    assert.equal(ROLE_ORDER[roleRank("support") + 1], "contributor");
    assert.equal(ROLE_ORDER[roleRank("contributor") + 1], "dev");
  });
  it("keeps both new roles below Coordinator", () => {
    assert.ok(roleRank("head_moderator") > roleRank("coordinator"));
    assert.ok(roleRank("contributor") > roleRank("coordinator"));
  });
});