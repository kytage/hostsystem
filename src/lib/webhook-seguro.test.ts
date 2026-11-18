import { test } from "node:test";
import assert from "node:assert/strict";
import { lerJsonLimitado, tokenIgual } from "./webhook-seguro";

test("token igual confere; diferente, vazio ou de outro tamanho não", async () => {
  assert.equal(await tokenIgual("abc123segredo", "abc123segredo"), true);
  assert.equal(await tokenIgual("abc123segredX", "abc123segredo"), false);
  assert.equal(await tokenIgual("abc", "abc123segredo"), false);
  assert.equal(await tokenIgual(null, "abc"), false);
  assert.equal(await tokenIgual("abc", ""), false);
});

test("corpo grande demais é recusado antes de virar JSON", async () => {
  const grande = new Request("http://x", { method: "POST", body: JSON.stringify({ a: "x".repeat(200) }) });
  const r = await lerJsonLimitado(grande, 100);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.resposta.status, 413);

  const ok = await lerJsonLimitado(new Request("http://x", { method: "POST", body: '{"a":1}' }), 100);
  assert.deepEqual(ok, { ok: true, body: { a: 1 } });

  const ruim = await lerJsonLimitado(new Request("http://x", { method: "POST", body: "{" }), 100);
  assert.equal(ruim.ok, false);
  if (!ruim.ok) assert.equal(ruim.resposta.status, 400);
});
