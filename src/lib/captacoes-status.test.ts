import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

describe("Establishment status persistence", () => {
  it("accepts desativado in the database alongside all existing statuses", () => {
    const sql = readFileSync(new URL("../../drizzle/migrations/0015_captacoes_desativado_policia.sql", import.meta.url), "utf8");
    const allowed = sql.match(/CHECK \(status IN \(([^)]+)\)\)/)?.[1]?.match(/'([^']+)'/g)?.map((s) => s.slice(1, -1));
    assert.deepEqual(allowed, ["livre", "reservado", "ocupado", "desativado"]);
  });
});