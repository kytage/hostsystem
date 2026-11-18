/**
 * Ajudas para os webhooks públicos (/api/public/webhook/*): conferir o token sem dar pista pelo
 * tempo de resposta (nem pelo tamanho) e recusar corpos grandes demais antes de ler o JSON.
 */

async function sha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/** true quando os dois tokens são iguais. Compara os resumos SHA-256 byte a byte, sempre inteiros. */
export async function tokenIgual(
  recebido: string | null | undefined,
  esperado: string | null | undefined,
): Promise<boolean> {
  if (!recebido || !esperado) return false;
  const [a, b] = await Promise.all([sha256(recebido), sha256(esperado)]);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

/** Lê o JSON do pedido, recusando (413) quando passa de `maxBytes`. */
export async function lerJsonLimitado(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false; resposta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > maxBytes) {
    return { ok: false, resposta: Response.json({ error: "Corpo grande demais" }, { status: 413 }) };
  }
  let texto: string;
  try {
    texto = await request.text();
  } catch {
    return { ok: false, resposta: Response.json({ error: "Corpo inválido" }, { status: 400 }) };
  }
  if (texto.length > maxBytes) {
    return { ok: false, resposta: Response.json({ error: "Corpo grande demais" }, { status: 413 }) };
  }
  try {
    return { ok: true, body: JSON.parse(texto) as unknown };
  } catch {
    return { ok: false, resposta: Response.json({ error: "JSON inválido" }, { status: 400 }) };
  }
}
