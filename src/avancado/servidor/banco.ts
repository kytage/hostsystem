// Acesso ao banco do HOST AVANÇADO (tabelas avancado_* no Supabase do site).
// As regras de acesso ficam no banco: só Founder e CEO conseguem ler e gravar (public.is_avancado).
// Cada chamada da "API" abre um Banco novo, que guarda o que já leu durante aquela chamada.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { defDe, type TipoColuna } from "./esquema";

// linhas do banco têm colunas diferentes por tabela; o formato de cada uma está em esquema.ts
export type Linha = any;

let clienteDeTeste: SupabaseClient | null = null;
/** Só para os testes automáticos: troca o banco por um falso, em memória. */
export function usarClienteDeTeste(c: SupabaseClient | null) {
  clienteDeTeste = c;
}
const sb = () => clienteDeTeste ?? (supabase as unknown as SupabaseClient);
export const nomeNoBanco = (tabela: string) => `avancado_${tabela}`;

/* ---------------- ajudas ---------------- */

export const novoId = () => crypto.randomUUID();
export const agora = () => new Date().toISOString();
const dois = (n: number) => String(n).padStart(2, "0");
/** Data de hoje no fuso de quem está usando, "AAAA-MM-DD". */
export function hoje(base = new Date()) {
  return `${base.getFullYear()}-${dois(base.getMonth() + 1)}-${dois(base.getDate())}`;
}
export function somarDias(data: string, dias: number) {
  const [a = 0, m = 1, d = 1] = data.split("-").map(Number);
  return hoje(new Date(a, m - 1, d + dias));
}
export function somarMeses(data: string, meses: number) {
  const [a = 0, m = 1, d = 1] = data.split("-").map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return hoje(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(d, ultimo)));
}
export const listaDe = (v: unknown) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
/** Igual ao LIKE '%termo%' do painel local: sem diferença de maiúsculas. */
export const contem = (valor: unknown, termo: string) =>
  String(typeof valor === "string" ? valor : JSON.stringify(valor ?? "")).toLowerCase().includes(termo.toLowerCase());

/** Erro com status e mensagem em português para a tela. */
export class ErroHttp extends Error {
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, mensagem: string, extra: Record<string, unknown> = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

/* ---------------- ordenação ---------------- */

type Chave = [campo: string | ((l: Linha) => unknown), direcao?: "asc" | "desc", nulos?: "primeiro" | "ultimo"];
/** Ordena como um ORDER BY: [["prazo", "asc", "ultimo"], ["ordem"]]. Nulo vai para o fim por padrão. */
export function ordenar<T extends Linha>(lista: T[], chaves: Chave[]): T[] {
  const valor = (l: Linha, c: Chave[0]) => (typeof c === "function" ? c(l) : l[c]);
  return [...lista].sort((a, b) => {
    for (const [campo, direcao = "asc", nulos = "ultimo"] of chaves) {
      const va = valor(a, campo);
      const vb = valor(b, campo);
      const na = va === null || va === undefined || va === "";
      const nb = vb === null || vb === undefined || vb === "";
      if (na || nb) {
        if (na && nb) continue;
        return (na ? 1 : -1) * (nulos === "ultimo" ? 1 : -1);
      }
      let r = 0;
      if (typeof va === "number" && typeof vb === "number") r = va - vb;
      else if (typeof va === "boolean" || typeof vb === "boolean") r = Number(va) - Number(vb);
      else r = String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
      if (r !== 0) return direcao === "asc" ? r : -r;
    }
    return 0;
  });
}

/* ---------------- conversão ---------------- */

const NOMES_BONITOS: Record<string, string> = { titulo: "título", nome: "nome", data: "data", prazo: "prazo" };

function paraBanco(tabela: string, coluna: string, tipo: TipoColuna, valor: unknown): unknown {
  const def = defDe(tabela);
  const erro = (msg: string) => new ErroHttp(400, `Campo "${NOMES_BONITOS[coluna] ?? coluna}": ${msg}`);
  if (tipo === "b") return valor === true || valor === 1 || valor === "1" || valor === "true";
  if (tipo === "ja") {
    if (valor === null || valor === undefined) return [];
    if (typeof valor === "string") {
      try {
        const v = JSON.parse(valor);
        if (Array.isArray(v)) return v;
      } catch {
        // não é JSON
      }
    }
    if (!Array.isArray(valor)) throw erro("precisa ser uma lista.");
    return valor;
  }
  if (tipo === "jo") {
    if (valor === null || valor === undefined) return {};
    if (typeof valor === "string") {
      try {
        const v = JSON.parse(valor);
        if (v && typeof v === "object" && !Array.isArray(v)) return v;
      } catch {
        // não é JSON
      }
    }
    if (typeof valor !== "object" || Array.isArray(valor)) throw erro("formato inválido.");
    return valor;
  }
  if (tipo === "n" || tipo === "n?") {
    if (valor === null || valor === undefined || valor === "") return tipo === "n?" ? null : 0;
    const n = Number(valor);
    if (!Number.isFinite(n)) throw erro("precisa ser um número.");
    return tipo === "n?" ? Math.round(n) : n;
  }
  if (valor === null || valor === undefined) return tipo === "t?" ? null : "";
  let texto = String(valor).trim();
  if (tipo === "t?" && texto === "") return null;
  if ((def.datas ?? []).includes(coluna) && texto !== "") {
    const m = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) throw erro("use o formato AAAA-MM-DD.");
    texto = m[1] ?? texto;
  }
  const aceitos = def.enums?.[coluna];
  if (aceitos && !aceitos.includes(texto)) throw erro(`valor "${texto}" não é aceito (use: ${aceitos.filter(Boolean).join(", ")}).`);
  return texto;
}

/** Prepara os dados para gravar. `parcial`: só as colunas enviadas; senão todas, com os padrões. */
export function prepararLinha(tabela: string, dados: Linha | null | undefined, { parcial = false } = {}): Linha {
  const def = defDe(tabela);
  const linha: Linha = {};
  for (const [coluna, tipo] of Object.entries(def.colunas)) {
    const veio = dados && Object.prototype.hasOwnProperty.call(dados, coluna) && dados[coluna] !== undefined;
    if (!veio) {
      if (parcial) continue;
      linha[coluna] = paraBanco(tabela, coluna, tipo, def.padroes?.[coluna]);
      continue;
    }
    linha[coluna] = paraBanco(tabela, coluna, tipo, dados![coluna]);
  }
  for (const c of def.obrigatorias ?? []) {
    const enviado = Object.prototype.hasOwnProperty.call(linha, c);
    if ((!parcial || enviado) && !String(linha[c] ?? "").trim()) throw new ErroHttp(400, `Preencha o campo "${NOMES_BONITOS[c] ?? c}".`);
  }
  return linha;
}

/** Linha do banco → objeto da tela (sem colunas técnicas). */
export function deLinha(tabela: string, linha: Linha | null | undefined): Linha | null {
  if (!linha) return null;
  const def = defDe(tabela);
  const obj: Linha = { id: linha.id };
  for (const [coluna, tipo] of Object.entries(def.colunas)) {
    if ((def.ocultas ?? []).includes(coluna)) continue;
    const v = linha[coluna];
    if (tipo === "b") obj[coluna] = v === true || v === 1;
    else if (tipo === "ja") obj[coluna] = Array.isArray(v) ? v : [];
    else if (tipo === "jo") obj[coluna] = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    else obj[coluna] = v ?? (tipo === "t" ? "" : tipo === "n" ? 0 : null);
  }
  if (!def.semCriado) obj.criado_em = linha.criado_em ?? "";
  if (!def.semAtualizado) obj.atualizado_em = linha.atualizado_em ?? "";
  return obj;
}

function falhou(erro: { message?: string; code?: string } | null, oQue: string): never {
  const msg = erro?.message ?? "";
  if (erro?.code === "42501" || /permission|row-level/i.test(msg)) throw new ErroHttp(403, "Só Founder e CEO podem usar o HOST AVANÇADO.");
  if (erro?.code === "42P01" || /does not exist|schema cache/i.test(msg))
    throw new ErroHttp(503, "As tabelas do HOST AVANÇADO ainda não foram criadas no banco do site.");
  throw new ErroHttp(500, `Não consegui ${oQue}. Tente de novo.`);
}

/* ---------------- banco ---------------- */

export class Banco {
  /** linhas cruas já lidas nesta chamada, por tabela */
  private lidas = new Map<string, Linha[]>();

  /** Todas as linhas cruas da tabela (lê uma vez por chamada). */
  async cruas(tabela: string): Promise<Linha[]> {
    const ja = this.lidas.get(tabela);
    if (ja) return ja;
    const todas: Linha[] = [];
    const passo = 1000;
    for (let de = 0; ; de += passo) {
      const { data, error } = await sb().from(nomeNoBanco(tabela)).select("*").range(de, de + passo - 1);
      if (error) falhou(error, "ler os dados");
      todas.push(...(data ?? []));
      if (!data || data.length < passo) break;
    }
    this.lidas.set(tabela, todas);
    return todas;
  }

  /** Todas as linhas já convertidas para a tela. */
  async todas(tabela: string): Promise<Linha[]> {
    return (await this.cruas(tabela)).map((l) => deLinha(tabela, l)!);
  }

  /** Lê só as linhas que batem com um filtro simples (para tabelas grandes, como as amostras do mercado). */
  async onde(tabela: string, montar: (q: any) => any): Promise<Linha[]> {
    const todas: Linha[] = [];
    const passo = 1000;
    for (let de = 0; ; de += passo) {
      const { data, error } = await montar(sb().from(nomeNoBanco(tabela)).select("*")).range(de, de + passo - 1);
      if (error) falhou(error, "ler os dados");
      todas.push(...(data ?? []));
      if (!data || data.length < passo) break;
    }
    return todas.map((l) => deLinha(tabela, l)!);
  }

  async buscarLinha(tabela: string, id: string): Promise<Linha | null> {
    const ja = this.lidas.get(tabela);
    if (ja) return ja.find((l) => l.id === id) ?? null;
    const { data, error } = await sb().from(nomeNoBanco(tabela)).select("*").eq("id", id).maybeSingle();
    if (error) falhou(error, "ler os dados");
    return data ?? null;
  }

  async obter(tabela: string, id: string) {
    return deLinha(tabela, await this.buscarLinha(tabela, id));
  }

  async obterOu404(tabela: string, id: string, oQue = "Registro") {
    const o = await this.obter(tabela, id);
    if (!o) throw new ErroHttp(404, `${oQue} não encontrado.`);
    return o;
  }

  private guardar(tabela: string, linha: Linha) {
    const ja = this.lidas.get(tabela);
    if (!ja) return;
    const i = ja.findIndex((l) => l.id === linha.id);
    if (i >= 0) ja[i] = { ...ja[i], ...linha };
    else ja.push(linha);
  }

  async inserir(tabela: string, dados: Linha, { id }: { id?: string } = {}): Promise<string> {
    const def = defDe(tabela);
    const linha = prepararLinha(tabela, dados);
    const quando = agora();
    linha.id = id ?? (def.idLivre && dados?.id ? String(dados.id) : novoId());
    if (!def.semCriado) linha.criado_em = dados?.criado_em ?? quando;
    if (!def.semAtualizado) linha.atualizado_em = quando;
    const { error } = await sb().from(nomeNoBanco(tabela)).insert(linha);
    if (error) falhou(error, "gravar");
    this.guardar(tabela, linha);
    return linha.id;
  }

  /** Grava várias linhas de uma vez (já preparadas, com id). */
  async inserirVarias(tabela: string, linhas: Linha[]) {
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await sb().from(nomeNoBanco(tabela)).insert(linhas.slice(i, i + 500));
      if (error) falhou(error, "gravar");
    }
    for (const l of linhas) this.guardar(tabela, l);
  }

  async atualizar(tabela: string, id: string, dados: Linha, extras: Linha = {}): Promise<number> {
    const def = defDe(tabela);
    const linha = { ...prepararLinha(tabela, dados, { parcial: true }), ...extras };
    if (!def.semAtualizado) linha.atualizado_em = agora();
    if (Object.keys(linha).length === 0) return 0;
    const { error, count } = await sb().from(nomeNoBanco(tabela)).update(linha, { count: "exact" }).eq("id", id);
    if (error) falhou(error, "salvar");
    this.guardar(tabela, { ...linha, id });
    return count ?? 1;
  }

  /** Atualização crua (sem validação), para colunas técnicas. */
  async atualizarCru(tabela: string, filtro: { coluna: string; valor: string }, valores: Linha) {
    const { error } = await sb().from(nomeNoBanco(tabela)).update(valores).eq(filtro.coluna, filtro.valor);
    if (error) falhou(error, "salvar");
    this.lidas.delete(tabela);
  }

  async apagar(tabela: string, id: string): Promise<number> {
    const { error, count } = await sb().from(nomeNoBanco(tabela)).delete({ count: "exact" }).eq("id", id);
    if (error) falhou(error, "apagar");
    const ja = this.lidas.get(tabela);
    if (ja) this.lidas.set(tabela, ja.filter((l) => l.id !== id));
    return count ?? 1;
  }

  async historico(entidade: string, entidadeId: string, acao: string, resumo = "") {
    const { error } = await sb()
      .from(nomeNoBanco("historico"))
      .insert({ id: novoId(), quando: agora(), entidade, entidade_id: String(entidadeId), acao, resumo: String(resumo).slice(0, 500), autor: await autor() });
    if (error) falhou(error, "gravar o histórico");
  }

  async listarHistorico(limite: number) {
    const { data, error } = await sb().from(nomeNoBanco("historico")).select("*").order("quando", { ascending: false }).limit(limite);
    if (error) falhou(error, "ler o histórico");
    return data ?? [];
  }

  async lerConfig(): Promise<Record<string, unknown>> {
    const { data, error } = await sb().from(nomeNoBanco("config")).select("chave, valor");
    if (error) falhou(error, "ler as configurações");
    return Object.fromEntries((data ?? []).map((r: Linha) => [r.chave, r.valor]));
  }

  async gravarConfig(chave: string, valor: unknown) {
    const { error } = await sb().from(nomeNoBanco("config")).upsert({ chave, valor: valor ?? null });
    if (error) falhou(error, "salvar a configuração");
  }
}

let autorEmCache: string | null = null;
/** Nome de quem está usando (vai no histórico). */
async function autor(): Promise<string> {
  if (autorEmCache !== null) return autorEmCache;
  try {
    const { data } = await sb().auth.getUser();
    const id = data.user?.id;
    if (!id) return "";
    const { data: p } = await sb().from("profiles").select("username").eq("id", id).maybeSingle();
    autorEmCache = (p as { username?: string } | null)?.username ?? "";
  } catch {
    autorEmCache = "";
  }
  return autorEmCache;
}
