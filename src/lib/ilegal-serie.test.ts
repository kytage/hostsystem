import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { serieDoPico } from "./ilegal-online";
describe("serieDoPico", () => {
  it("10+ é Série A", () => { assert.equal(serieDoPico(10), "A"); assert.equal(serieDoPico(31), "A"); });
  it("5 a 9 é Série B", () => { assert.equal(serieDoPico(5), "B"); assert.equal(serieDoPico(9), "B"); });
  it("0 a 4 é Série C", () => { assert.equal(serieDoPico(0), "C"); assert.equal(serieDoPico(4), "C"); assert.equal(serieDoPico(undefined), "C"); });
});
