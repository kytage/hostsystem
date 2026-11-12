/**
 * Comércio do lobby do HOKI: mercado entre jogadores. Quem vende anuncia itens da
 * mochila por um preço em Staff Coins; quem compra paga e recebe os itens na mochila.
 * Tudo que mexe em moedas e itens passa pelas funções do banco (hoki_comercio_*),
 * que conferem saldo, mochila e se o anúncio ainda está aberto, numa transação só.
 */
import { supabase } from "@/integrations/supabase/client";
import { lerVisual, type Visual } from "@/lib/hoki";

export interface Anuncio {
  id: string;
  vendedor: string;
  item: string;
  quantidade: number;
  /** Preço do lote inteiro, em Staff Coins. */
  preco: number;
  criado_em: string;
  comprador: string | null;
  vendido_em: string | null;
  cancelado_em: string | null;
}
export interface PessoaDoComercio {
  id: string;
  nome: string;
  visual: Visual;
}
/** Mochila e saldo de quem fez a operação, como ficaram no banco. */
export interface Saldos {
  inventario: Record<string, number>;
  coins: number;
}

/** Limites (os mesmos que o banco confere). */
export const MAX_ANUNCIOS = 10;
export const MAX_QTD = 99;
export const MAX_PRECO = 9999;

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
const COLUNAS =
  "id, vendedor, item, quantidade, preco, criado_em, comprador, vendido_em, cancelado_em";

/** O Comércio ainda não foi instalado no banco (a tabela não existe). */
export class ComercioFechado extends Error {}
const fechado = (msg: string) =>
  /hoki_comercio|does not exist|schema cache|Could not find/i.test(msg);

function lerSaldos(bruto: unknown): Saldos {
  const d = (bruto ?? {}) as { inventario?: unknown; coins?: unknown };
  const inventario: Record<string, number> = {};
  if (d.inventario && typeof d.inventario === "object" && !Array.isArray(d.inventario))
    for (const [k, v] of Object.entries(d.inventario as Record<string, unknown>))
      if (typeof v === "number" && Number.isFinite(v) && v > 0) inventario[k.slice(0, 32)] = v;
  return { inventario, coins: typeof d.coins === "number" ? d.coins : 0 };
}
async function chamar(fn: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase.rpc as unknown as Rpc)(fn, args);
  if (error) {
    if (fechado(error.message)) throw new ComercioFechado("O Comércio ainda está sendo montado.");
    throw new Error(error.message);
  }
  return data;
}

/** Anúncios abertos (de todo mundo), do mais novo para o mais antigo. */
export async function anunciosAbertos(): Promise<Anuncio[]> {
  const { data, error } = await supabase
    .from("hoki_comercio" as never)
    .select(COLUNAS)
    .is("vendido_em" as never, null)
    .is("cancelado_em" as never, null)
    .order("criado_em" as never, { ascending: false })
    .limit(200);
  if (error) {
    if (fechado(error.message)) throw new ComercioFechado("O Comércio ainda está sendo montado.");
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as Anuncio[];
}

/** Os meus anúncios mais recentes (abertos, vendidos e retirados). */
export async function meusAnuncios(userId: string): Promise<Anuncio[]> {
  const { data, error } = await supabase
    .from("hoki_comercio" as never)
    .select(COLUNAS)
    .eq("vendedor" as never, userId as never)
    .order("criado_em" as never, { ascending: false })
    .limit(40);
  if (error) {
    if (fechado(error.message)) throw new ComercioFechado("O Comércio ainda está sendo montado.");
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as Anuncio[];
}

/** Nome e aparência do HOKI de quem anunciou ou comprou. */
export async function pessoasDoComercio(ids: string[]): Promise<Record<string, PessoaDoComercio>> {
  const lista = [...new Set(ids)].filter(Boolean);
  if (!lista.length) return {};
  const { data } = await supabase
    .from("hoshi_pets")
    .select("user_id, username, nome, visual")
    .in("user_id", lista);
  const mapa: Record<string, PessoaDoComercio> = {};
  for (const p of (data ?? []) as {
    user_id: string;
    username: string;
    nome: string;
    visual: unknown;
  }[])
    mapa[p.user_id] = { id: p.user_id, nome: p.username || p.nome, visual: lerVisual(p.visual) };
  return mapa;
}

/** Anuncia `qtd` unidades de um item da mochila pelo preço do lote. */
export async function anunciar(item: string, qtd: number, preco: number): Promise<Saldos> {
  return lerSaldos(
    await chamar("hoki_comercio_anunciar", { p_item: item, p_qtd: qtd, p_preco: preco }),
  );
}

/** Retira um anúncio meu: os itens voltam para a mochila. */
export async function retirar(id: string): Promise<Saldos> {
  return lerSaldos(await chamar("hoki_comercio_cancelar", { p_id: id }));
}

/** Compra um anúncio: paga e recebe os itens. Devolve também o que foi comprado e de quem. */
export async function comprar(
  id: string,
): Promise<Saldos & { vendedor: string; item: string; quantidade: number; preco: number }> {
  const d = (await chamar("hoki_comercio_comprar", { p_id: id })) as {
    vendedor?: unknown;
    item?: unknown;
    quantidade?: unknown;
    preco?: unknown;
  } | null;
  return {
    ...lerSaldos(d),
    vendedor: String(d?.vendedor ?? ""),
    item: String(d?.item ?? ""),
    quantidade: Number(d?.quantidade ?? 0),
    preco: Number(d?.preco ?? 0),
  };
}
