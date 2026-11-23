// Captação: oportunidades, duplicados, juntar, importar/exportar e indicadores (igual ao HOST CENTRAL local).
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ETAPAS,
  ETAPAS_ABERTAS,
  LEAD_TIPOS,
  ORIGENS,
  PLATAFORMAS,
  PRIORIDADES,
  chavesDoLead,
  nomeDe,
  normalizarNome,
  plataformaDoLink,
} from "@/avancado/shared/dominio";
import { defDe } from "./esquema";
import { Banco, ErroHttp, type Linha, agora, contem, deLinha, hoje, listaDe, ordenar, prepararLinha, somarDias } from "./banco";
import { lerCsv, paraCsv } from "./csv";

const NOME_REDE: Record<string, string> = Object.fromEntries(PLATAFORMAS.map((p) => [p.id, p.nome]));
const ABERTAS = ETAPAS_ABERTAS as readonly string[];

/** Conta evidências e históricos de cada oportunidade. */
async function contagens(db: Banco) {
  const ev = new Map<string, number>();
  const it = new Map<string, number>();
  for (const e of await db.cruas("lead_evidencias")) ev.set(e.lead_id, (ev.get(e.lead_id) ?? 0) + 1);
  for (const i of await db.cruas("lead_interacoes")) it.set(i.lead_id, (it.get(i.lead_id) ?? 0) + 1);
  return (lead: Linha) => ({ ...lead, total_evidencias: ev.get(lead.id) ?? 0, total_interacoes: it.get(lead.id) ?? 0 });
}

function arrumarLinks(links: unknown) {
  if (!Array.isArray(links)) return [];
  const vistos = new Set<string>();
  const saida: Linha[] = [];
  for (const bruto of links) {
    const l = typeof bruto === "string" ? { url: bruto } : (bruto as Linha);
    const url = String(l?.url ?? "").trim();
    if (!url || vistos.has(url.toLowerCase())) continue;
    vistos.add(url.toLowerCase());
    const item: Linha = { plataforma: l.plataforma && NOME_REDE[l.plataforma] ? l.plataforma : plataformaDoLink(url), url };
    if (l.rotulo) item.rotulo = String(l.rotulo);
    if (l.status) item.status = String(l.status);
    saida.push(item);
  }
  return saida;
}

function motivoDaChave(chave: string) {
  const [tipo = "", ...resto] = chave.split(":");
  const valor = resto.join(":");
  if (tipo === "nome") return "nome igual";
  return `mesmo ${NOME_REDE[tipo] ?? tipo} (${tipo === "discord" ? valor : "@" + valor.replace(/^@/, "")})`;
}

export async function duplicadosDe(db: Banco, nome: unknown, links: unknown, ignorarId: string | null = null) {
  const chaves = new Set(chavesDoLead(String(nome ?? ""), arrumarLinks(links) as any));
  if (chaves.size === 0) return [];
  const achados: Linha[] = [];
  for (const l of await db.cruas("leads")) {
    if (l.id === ignorarId) continue;
    const comum = (Array.isArray(l.chaves) ? l.chaves : []).find((c: string) => chaves.has(c));
    if (comum) achados.push({ id: l.id, nome: l.nome, etapa: l.etapa, motivo: motivoDaChave(comum) });
  }
  return achados;
}

export async function leadCompleto(db: Banco, id: string) {
  const linha = await db.buscarLinha("leads", id);
  if (!linha) throw new ErroHttp(404, "Oportunidade não encontrada.");
  const evidencias = (await db.todas("lead_evidencias")).filter((e) => e.lead_id === id);
  const contatos = (await db.todas("lead_contatos")).filter((e) => e.lead_id === id);
  const interacoes = (await db.todas("lead_interacoes")).filter((e) => e.lead_id === id);
  return {
    ...deLinha("leads", linha),
    total_evidencias: evidencias.length,
    total_interacoes: interacoes.length,
    evidencias: ordenar(evidencias, [[(e) => e.data ?? "", "desc"], ["criado_em", "desc"]]),
    contatos: ordenar(contatos, [["criado_em", "asc"]]),
    interacoes: ordenar(interacoes, [["data", "desc"], ["criado_em", "desc"]]),
  };
}

export async function criarLeadSemTransacao(db: Banco, entrada: Linha, { forcar = false } = {}) {
  const dados: Linha = { ...entrada };
  delete dados.evidencias;
  delete dados.contatos;
  delete dados.forcar;
  dados.nome = String(dados.nome ?? "").trim();
  if (!dados.nome) throw new ErroHttp(400, 'Preencha o campo "nome".');
  dados.links = arrumarLinks(dados.links);
  if (!forcar) {
    const dup = await duplicadosDe(db, dados.nome, dados.links);
    if (dup.length) throw new ErroHttp(409, `Já existe uma oportunidade parecida: ${dup[0].nome} (${dup[0].motivo}).`, { duplicados: dup });
  }
  if (!dados.plataforma && dados.links[0]) dados.plataforma = dados.links[0].plataforma;
  dados.nome_norm = normalizarNome(dados.nome);
  dados.chaves = chavesDoLead(dados.nome, dados.links);
  dados.etapa_desde = agora();
  if (dados.ordem === undefined) dados.ordem = Date.now();
  const id = await db.inserir("leads", dados);
  for (const e of Array.isArray(entrada.evidencias) ? entrada.evidencias : []) {
    if (e?.url) await db.inserir("lead_evidencias", { ...e, lead_id: id });
  }
  for (const c of Array.isArray(entrada.contatos) ? entrada.contatos : []) {
    if (c && (c.nome || c.discord || c.instagram)) await db.inserir("lead_contatos", { ...c, lead_id: id });
  }
  await db.historico("lead", id, "criou", dados.nome);
  return id;
}

export async function criarLead(db: Banco, entrada: Linha) {
  const id = await criarLeadSemTransacao(db, entrada, { forcar: entrada?.forcar === true });
  return leadCompleto(db, id);
}

export async function alterarLead(db: Banco, id: string, dados: Linha) {
  const atual = await db.buscarLinha("leads", id);
  if (!atual) throw new ErroHttp(404, "Oportunidade não encontrada.");
  const mudancas: Linha = { ...dados };
  const extras: Linha = {};
  if (mudancas.links !== undefined) mudancas.links = arrumarLinks(mudancas.links);
  if (mudancas.nome !== undefined || mudancas.links !== undefined) {
    const nome = String(mudancas.nome ?? atual.nome).trim();
    const links = mudancas.links ?? (Array.isArray(atual.links) ? atual.links : []);
    extras.nome_norm = normalizarNome(nome);
    extras.chaves = chavesDoLead(nome, links);
  }
  if (mudancas.etapa !== undefined && mudancas.etapa !== atual.etapa) {
    extras.etapa_desde = agora();
    const texto = `${nomeDe(ETAPAS, atual.etapa)} → ${nomeDe(ETAPAS, mudancas.etapa)}`;
    await db.inserir("lead_interacoes", { lead_id: id, data: agora(), tipo: "etapa", resumo: texto, autor: "" });
    await db.historico("lead", id, "mudou de etapa", `${atual.nome}: ${texto}`);
  }
  await db.atualizar("leads", id, mudancas, extras);
  return leadCompleto(db, id);
}

export async function excluirLead(db: Banco, id: string) {
  const atual = await db.buscarLinha("leads", id);
  if (!atual) throw new ErroHttp(404, "Oportunidade não encontrada.");
  await db.apagar("leads", id);
  await db.historico("lead", id, "excluiu", atual.nome);
}

/** Filtros da listagem, com os mesmos nomes da URL do painel local. */
function filtroDeLead(q: any = {}) {
  const testes: ((l: Linha) => boolean)[] = [];
  const emLista = (coluna: string, valor: unknown) => {
    const itens = listaDe(valor);
    if (itens.length) testes.push((l) => itens.includes(String(l[coluna] ?? "")));
  };
  emLista("etapa", q.etapa);
  emLista("prioridade", q.prioridade);
  emLista("tipo", q.tipo);
  emLista("plataforma", q.plataforma);
  emLista("origem", q.origem);
  const triagem = q.triagem ?? "aprovado";
  if (triagem !== "todos") emLista("triagem", triagem);
  const demo = q.demo ?? "0";
  if (demo !== "todos") testes.push((l) => !!l.demo === (demo === "1"));
  if (q.cidade) testes.push((l) => contem(l.cidade_atual, q.cidade));
  if (q.tag) testes.push((l) => (l.tags ?? []).includes(q.tag));
  if (q.busca) {
    const t = String(q.busca).trim();
    testes.push((l) => ["nome", "cidade_atual", "lider", "observacoes", "descricao", "tags", "links"].some((c) => contem(l[c], t)));
  }
  const d = hoje();
  if (q.followup === "atrasado") testes.push((l) => !!l.proximo_followup && l.proximo_followup < d);
  else if (q.followup === "hoje") testes.push((l) => l.proximo_followup === d);
  else if (q.followup === "semana") testes.push((l) => !!l.proximo_followup && l.proximo_followup <= somarDias(d, 7));
  else if (q.followup === "sem") testes.push((l) => !l.proximo_followup);
  return (l: Linha) => testes.every((t) => t(l));
}

const PESO_PRIORIDADE: Record<string, number> = { alta: 0, media: 1 };
const ORDENS: Record<string, Parameters<typeof ordenar>[1] | undefined> = {
  atualizado: [["atualizado_em", "desc"]],
  prioridade: [[(l) => PESO_PRIORIDADE[l.prioridade] ?? 2, "asc"], ["atualizado_em", "desc"]],
  nome: [["nome", "asc"]],
  followup: [["proximo_followup", "asc", "ultimo"]],
  ordem: [["ordem", "asc"]],
  alcance: [[(l) => l.alcance ?? -1, "desc"]],
};

export async function listarLeads(db: Banco, q: any = {}) {
  const comContagens = await contagens(db);
  const passa = filtroDeLead(q);
  const lista = (await db.todas("leads")).filter(passa).map(comContagens);
  return ordenar(lista, ORDENS[String(q.ordenar)] ?? ORDENS["prioridade"]!);
}

export async function mesclarLeads(db: Banco, id: string, outroId: string) {
  if (id === outroId) throw new ErroHttp(400, "Escolha outra oportunidade para juntar.");
  const a = await db.buscarLinha("leads", id);
  const b = await db.buscarLinha("leads", outroId);
  if (!a || !b) throw new ErroHttp(404, "Oportunidade não encontrada.");
  const la = deLinha("leads", a)!;
  const lb = deLinha("leads", b)!;
  const mudancas: Linha = {};
  for (const campo of Object.keys(defDe("leads").colunas)) {
    if (["nome", "links", "tags", "alertas", "nome_norm", "chaves", "ordem", "demo", "etapa", "etapa_desde", "triagem"].includes(campo)) continue;
    const va = la[campo];
    const vb = lb[campo];
    const vazio = va === "" || va === null || va === undefined || va === "desconhecida" || va === "desconhecido";
    if (vazio && vb !== "" && vb !== null && vb !== undefined) mudancas[campo] = vb;
  }
  mudancas.links = arrumarLinks([...la.links, ...lb.links]);
  mudancas.tags = [...new Set([...la.tags, ...lb.tags])];
  mudancas.alertas = [...new Set([...la.alertas, ...lb.alertas])];
  if (la.observacoes && lb.observacoes && la.observacoes !== lb.observacoes) mudancas.observacoes = `${la.observacoes}\n\n${lb.observacoes}`;
  for (const t of ["lead_evidencias", "lead_contatos", "lead_interacoes"]) await db.atualizarCru(t, { coluna: "lead_id", valor: outroId }, { lead_id: id });
  await db.atualizar("leads", id, mudancas, {
    nome_norm: normalizarNome(la.nome),
    chaves: [...new Set([...(a.chaves ?? []), ...(b.chaves ?? []), ...chavesDoLead(la.nome, mudancas.links)])],
  });
  await db.inserir("lead_interacoes", { lead_id: id, data: agora(), tipo: "sistema", resumo: `Juntado com "${lb.nome}"` });
  await db.apagar("leads", outroId);
  await db.historico("lead", id, "juntou", `${la.nome} + ${lb.nome}`);
  return leadCompleto(db, id);
}

/* ---------------- importar e exportar ---------------- */

const CAMPOS_CSV = [
  "nome", "tipo", "plataforma", "links", "cidade_atual", "cidade_confianca", "lider", "contato_publico",
  "tamanho", "tamanho_texto", "alcance", "alcance_texto", "estilo", "indicio", "indicio_confianca", "motivo_host",
  "prioridade", "origem", "etapa", "proximo_passo", "ultimo_contato", "proximo_followup", "responsavel",
  "observacoes", "tags", "descricao",
];

function linhaCsvParaEntrada(obj: Record<string, string>) {
  const e: Linha = {};
  for (const [k, v] of Object.entries(obj)) {
    const campo = k.trim().toLowerCase();
    if (!CAMPOS_CSV.includes(campo) || v === "") continue;
    if (campo === "links") e.links = v.split(/[\s|]+/).filter(Boolean).map((url) => ({ url }));
    else if (campo === "tags") e.tags = v.split(/[|,]/).map((s) => s.trim()).filter(Boolean);
    else e[campo] = v;
  }
  return e;
}

export async function importarLeads(
  db: Banco,
  { formato = "json", conteudo = "", simular = true, origem, triagem }: { formato?: string; conteudo?: unknown; simular?: boolean; origem?: string; triagem?: string } = {},
) {
  let itens: Linha[] | null;
  try {
    if (formato === "csv") itens = lerCsv(String(conteudo)).map(linhaCsvParaEntrada);
    else {
      const bruto = typeof conteudo === "string" ? JSON.parse(conteudo) : conteudo;
      itens = Array.isArray(bruto) ? bruto : Array.isArray((bruto as Linha)?.itens) ? (bruto as Linha).itens : null;
    }
  } catch (e) {
    throw new ErroHttp(400, `Não consegui ler o arquivo: ${(e as Error).message}`);
  }
  if (!Array.isArray(itens)) throw new ErroHttp(400, "O arquivo precisa ser uma lista de oportunidades.");
  const resultado = { simulado: !!simular, novos: [] as Linha[], duplicados: [] as Linha[], erros: [] as Linha[] };
  const chavesDoArquivo = new Map<string, string>();
  for (const [n, item] of itens.entries()) {
    try {
      const nome = String(item?.nome ?? "").trim();
      if (!nome) throw new Error('sem "nome"');
      const links = arrumarLinks(item.links);
      const dup = await duplicadosDe(db, nome, links);
      if (dup.length) {
        resultado.duplicados.push({ nome, existente: dup[0] });
        continue;
      }
      const chaves = chavesDoLead(nome, links as any);
      const repetida = chaves.find((c) => chavesDoArquivo.has(c));
      if (repetida) {
        resultado.duplicados.push({ nome, existente: { id: "", nome: chavesDoArquivo.get(repetida) ?? "", etapa: "descoberta", motivo: `repetido no arquivo (${motivoDaChave(repetida)})` } });
        continue;
      }
      chaves.forEach((c) => chavesDoArquivo.set(c, nome));
      const entrada: Linha = { ...item, links };
      if (origem && !item.origem) entrada.origem = origem;
      if (triagem && !item.triagem) entrada.triagem = triagem;
      if (simular) {
        const copia = { ...entrada };
        delete copia.evidencias;
        delete copia.contatos;
        prepararLinha("leads", copia);
        resultado.novos.push({ nome });
      } else {
        const id = await criarLeadSemTransacao(db, entrada, { forcar: true });
        resultado.novos.push({ nome, id });
      }
    } catch (e) {
      resultado.erros.push({ linha: n + 1, erro: (e as Error).message });
    }
  }
  return resultado;
}

export async function exportarLeads(db: Banco, formato: "csv" | "json", q: any) {
  const leads = await listarLeads(db, q);
  if (formato === "json") {
    const completos = [];
    for (const l of leads) completos.push(await leadCompleto(db, l.id));
    return { tipo: "application/json; charset=utf-8", nome: `host-avancado-oportunidades-${hoje()}.json`, corpo: JSON.stringify(completos, null, 1) };
  }
  const linhas = leads.map((l) => {
    const o: Linha = {};
    for (const c of CAMPOS_CSV) {
      if (c === "links") o.links = (l.links ?? []).map((x: Linha) => x.url).join(" | ");
      else if (c === "tags") o.tags = (l.tags ?? []).join(", ");
      else o[c] = l[c] ?? "";
    }
    return o;
  });
  return { tipo: "text/csv; charset=utf-8", nome: `host-avancado-oportunidades-${hoje()}.csv`, corpo: "﻿" + paraCsv(CAMPOS_CSV, linhas) };
}

/* ---------------- indicadores ---------------- */

export async function indicadoresCaptacao(db: Banco) {
  const todos = await db.todas("leads");
  const base = todos.filter((l) => l.triagem === "aprovado" && !l.demo);
  const conta = (f: (l: Linha) => boolean) => base.filter(f).length;
  const grupo = (coluna: string) => {
    const m = new Map<string, number>();
    for (const l of base) m.set(l[coluna], (m.get(l[coluna]) ?? 0) + 1);
    return m;
  };
  const d = hoje();
  const etapas = grupo("etapa");
  const prioridades = grupo("prioridade");
  const origens = grupo("origem");
  const tipos = grupo("tipo");
  const aberta = (l: Linha) => ABERTAS.includes(l.etapa);
  const dia = (l: Linha) => String(l.criado_em ?? "").slice(0, 10);
  const ganhos = etapas.get("na_cidade") ?? 0;
  const perdidos = etapas.get("perdida") ?? 0;
  const semanas = [];
  const diaSemana = (new Date().getDay() + 6) % 7;
  const segunda = somarDias(d, -diaSemana);
  for (let i = 7; i >= 0; i--) {
    const ini = somarDias(segunda, -7 * i);
    const fim = somarDias(ini, 7);
    semanas.push({ semana: ini, total: conta((l) => dia(l) >= ini && dia(l) < fim) });
  }
  const cidades = [...grupo("cidade_atual").entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  return {
    total: base.length,
    por_etapa: ETAPAS.map((e) => ({ etapa: e.id, total: etapas.get(e.id) ?? 0 })),
    por_prioridade: PRIORIDADES.map((p) => ({ prioridade: p.id, total: prioridades.get(p.id) ?? 0 })),
    por_origem: ORIGENS.map((o) => ({ origem: o.id, total: origens.get(o.id) ?? 0 })).filter((o) => o.total > 0),
    por_tipo: LEAD_TIPOS.map((t) => ({ tipo: t.id, total: tipos.get(t.id) ?? 0 })),
    por_cidade: cidades.map(([cidade, total]) => ({ cidade, total })),
    novos_7d: conta((l) => dia(l) >= somarDias(d, -7)),
    novos_30d: conta((l) => dia(l) >= somarDias(d, -30)),
    para_triagem: todos.filter((l) => l.triagem === "pendente" && !l.demo).length,
    followups_atrasados: conta((l) => !!l.proximo_followup && l.proximo_followup < d && aberta(l)),
    followups_hoje: conta((l) => l.proximo_followup === d && aberta(l)),
    followups_semana: conta((l) => !!l.proximo_followup && l.proximo_followup >= d && l.proximo_followup <= somarDias(d, 7) && aberta(l)),
    sem_contato: conta((l) => !l.ultimo_contato && aberta(l)),
    contatados_30d: conta((l) => !!l.ultimo_contato && l.ultimo_contato >= somarDias(d, -30)),
    ganhos,
    perdidos,
    taxa_conversao: ganhos + perdidos > 0 ? ganhos / (ganhos + perdidos) : null,
    novos_por_semana: semanas,
  };
}

/* ---------------- evidências, contatos e histórico ---------------- */

const FILHAS: Record<string, string> = { evidencias: "lead_evidencias", contatos: "lead_contatos", interacoes: "lead_interacoes" };

export async function criarFilha(db: Banco, leadId: string, tipo: string, dados: Linha) {
  const tabela = FILHAS[tipo];
  if (!tabela) throw new ErroHttp(404, "Endereço não encontrado.");
  const lead = await db.buscarLinha("leads", leadId);
  if (!lead) throw new ErroHttp(404, "Oportunidade não encontrada.");
  const entrada: Linha = { ...dados, lead_id: leadId };
  if (tipo === "interacoes" && !entrada.data) entrada.data = agora();
  if (tipo === "evidencias" && !String(entrada.url ?? "").trim()) throw new ErroHttp(400, "Informe o link da evidência.");
  await db.inserir(tabela, entrada);
  // mensagem, resposta ou reunião contam como contato
  if (tipo === "interacoes" && ["mensagem", "resposta", "reuniao"].includes(entrada.tipo)) {
    const dia = String(entrada.data).slice(0, 10);
    const ultimo = !lead.ultimo_contato || lead.ultimo_contato < dia ? dia : lead.ultimo_contato;
    await db.atualizar("leads", leadId, {}, { ultimo_contato: ultimo });
  } else {
    await db.atualizar("leads", leadId, {}, {});
  }
  return leadCompleto(db, leadId);
}

export async function alterarFilha(db: Banco, leadId: string, tipo: string, filhaId: string, dados: Linha) {
  const tabela = FILHAS[tipo];
  if (!tabela) throw new ErroHttp(404, "Endereço não encontrado.");
  const atual = await db.buscarLinha(tabela, filhaId);
  if (!atual || atual.lead_id !== leadId) throw new ErroHttp(404, "Registro não encontrado.");
  const mudancas = { ...dados };
  delete mudancas.lead_id;
  await db.atualizar(tabela, filhaId, mudancas);
  return leadCompleto(db, leadId);
}

export async function excluirFilha(db: Banco, leadId: string, tipo: string, filhaId: string) {
  const tabela = FILHAS[tipo];
  if (!tabela) throw new ErroHttp(404, "Endereço não encontrado.");
  const atual = await db.buscarLinha(tabela, filhaId);
  if (!atual || atual.lead_id !== leadId) throw new ErroHttp(404, "Registro não encontrado.");
  await db.apagar(tabela, filhaId);
  return leadCompleto(db, leadId);
}
