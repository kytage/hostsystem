// Tarefas (recorrência), visão geral, mercado (FiveM), automações e exportação (igual ao HOST CENTRAL local).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CONTEUDO_STATUS, ETAPAS, ETAPAS_ABERTAS } from "@/avancado/shared/dominio";
import { TABELAS, defDe } from "./esquema";
import { Banco, ErroHttp, type Linha, agora, contem, deLinha, hoje, ordenar, somarDias, somarMeses } from "./banco";

/* ---------------- tarefas ---------------- */

const ABERTAS = ["a_fazer", "fazendo", "aguardando"];
const PESO_TAREFA: Record<string, number> = { urgente: 0, alta: 1, media: 2 };
export const ORDEM_TAREFA: Parameters<typeof ordenar>[1] = [
  ["prazo", "asc", "ultimo"],
  [(t) => PESO_TAREFA[t.prioridade] ?? 3, "asc"],
  ["ordem", "asc"],
  ["criado_em", "asc"],
];

export async function listarTarefas(db: Banco, q: any = {}) {
  const testes: ((t: Linha) => boolean)[] = [];
  const lista = (coluna: string, itens: string[]) => testes.push((t) => itens.includes(String(t[coluna] ?? "")));
  const status = q.status ?? "abertas";
  if (status === "abertas") lista("status", ABERTAS);
  else if (status !== "todas") lista("status", String(status).split(",").filter(Boolean));
  for (const c of ["tipo", "area", "prioridade", "responsavel"]) if (q[c]) lista(c, String(q[c]).split(",").filter(Boolean));
  const d = hoje();
  if (q.prazo === "atrasadas") testes.push((t) => !!t.prazo && t.prazo < d);
  else if (q.prazo === "hoje") testes.push((t) => t.prazo === d);
  else if (q.prazo === "semana") testes.push((t) => !!t.prazo && t.prazo <= somarDias(d, 7));
  else if (q.prazo === "sem") testes.push((t) => !t.prazo);
  if (q.busca) testes.push((t) => ["titulo", "notas", "responsavel"].some((c) => contem(t[c], q.busca)));
  const itens = (await db.todas("tarefas")).filter((t) => testes.every((f) => f(t)));
  return status === "todas" || status === "feito" ? ordenar(itens, [[(t) => t.concluida_em ?? t.atualizado_em, "desc"]]) : ordenar(itens, ORDEM_TAREFA);
}

/** Próxima data de uma tarefa que repete: avança o passo até cair depois de hoje. */
export function proximoPrazo(prazo: string | null, recorrencia: string) {
  const d = hoje();
  let p = prazo ?? d;
  if (recorrencia === "mensal") {
    do p = somarMeses(p, 1);
    while (p <= d);
    return p;
  }
  const passo = ({ diaria: 1, semanal: 7, quinzenal: 14 } as Record<string, number>)[recorrencia];
  if (!passo) return null;
  do p = somarDias(p, passo);
  while (p <= d);
  return p;
}

export async function concluirTarefa(db: Banco, id: string) {
  const tarefa = await db.obter("tarefas", id);
  if (!tarefa) throw new ErroHttp(404, "Tarefa não encontrada.");
  let proximaId: string | null = null;
  await db.atualizar("tarefas", id, { status: "feito", concluida_em: agora() });
  await db.historico("tarefa", id, "concluiu", tarefa.titulo);
  if (tarefa.recorrencia) {
    const copia: Linha = {
      ...tarefa,
      status: "a_fazer",
      concluida_em: null,
      prazo: proximoPrazo(tarefa.prazo, tarefa.recorrencia),
      checklist: (tarefa.checklist ?? []).map((i: Linha) => ({ texto: i.texto, feito: false })),
    };
    delete copia.id;
    delete copia.criado_em;
    delete copia.atualizado_em;
    proximaId = await db.inserir("tarefas", copia);
  }
  return { concluida: await db.obter("tarefas", id), proxima: proximaId ? await db.obter("tarefas", proximaId) : null };
}

/* ---------------- visão geral ---------------- */

export async function montarPainel(db: Banco) {
  const d = hoje();
  const tarefas = (await db.todas("tarefas")).filter((t) => ABERTAS.includes(t.status));
  const todosLeads = await db.todas("leads");
  const leads = todosLeads.filter((l) => l.triagem === "aprovado" && !l.demo);
  const conteudos = (await db.todas("conteudos")).filter((c) => !c.demo);
  const abertaEtapa = (l: Linha) => (ETAPAS_ABERTAS as readonly string[]).includes(l.etapa);
  const ev = new Map<string, number>();
  const it = new Map<string, number>();
  for (const e of await db.cruas("lead_evidencias")) ev.set(e.lead_id, (ev.get(e.lead_id) ?? 0) + 1);
  for (const i of await db.cruas("lead_interacoes")) it.set(i.lead_id, (it.get(i.lead_id) ?? 0) + 1);
  const comContagens = (l: Linha) => ({ ...l, total_evidencias: ev.get(l.id) ?? 0, total_interacoes: it.get(l.id) ?? 0 });
  const porEtapa = new Map<string, number>();
  for (const l of leads) porEtapa.set(l.etapa, (porEtapa.get(l.etapa) ?? 0) + 1);
  const porStatus = new Map<string, number>();
  for (const c of conteudos) porStatus.set(c.status, (porStatus.get(c.status) ?? 0) + 1);
  const diaSemana = (new Date().getDay() + 6) % 7;
  const segunda = somarDias(d, -diaSemana);
  const domingo = somarDias(segunda, 6);
  const resumos = ordenar(await db.todas("resumos"), [["data", "desc"], ["criado_em", "desc"]]);
  const novidades = ordenar(await db.todas("novidades"), [["data", "desc"], ["criado_em", "desc"]]).slice(0, 4);
  const automacoes = ordenar(await db.todas("automacoes"), [["ordem", "asc"], ["nome", "asc"]]).map((a) => ({
    id: a.id,
    nome: a.nome,
    tipo: a.tipo,
    status: a.status,
    ultima_execucao: a.ultima_execucao,
    ultimo_resultado: a.ultimo_resultado,
    ultimo_resumo: a.ultimo_resumo,
  }));
  const ativo = (c: Linha) => !["publicado", "arquivado"].includes(c.status);
  return {
    hoje: d,
    tarefas: {
      atrasadas: tarefas.filter((t) => t.prazo && t.prazo < d).length,
      para_hoje: tarefas.filter((t) => t.prazo === d).length,
      abertas: tarefas.length,
      proximas: ordenar(tarefas.filter((t) => ["tarefa", "rotina"].includes(t.tipo)), ORDEM_TAREFA).slice(0, 8),
      decisoes: ordenar(tarefas.filter((t) => t.tipo === "decisao"), ORDEM_TAREFA).slice(0, 8),
      reunioes: ordenar(tarefas.filter((t) => t.tipo === "reuniao"), ORDEM_TAREFA).slice(0, 5),
    },
    captacao: {
      total_abertos: leads.filter(abertaEtapa).length,
      por_etapa: ETAPAS.map((e) => ({ etapa: e.id, total: porEtapa.get(e.id) ?? 0 })),
      para_triagem: todosLeads.filter((l) => l.triagem === "pendente" && !l.demo).length,
      novos_7d: leads.filter((l) => String(l.criado_em).slice(0, 10) >= somarDias(d, -7)).length,
      followups_atrasados: leads.filter((l) => l.proximo_followup && l.proximo_followup < d && abertaEtapa(l)).length,
      followups: ordenar(
        leads.filter((l) => l.proximo_followup && l.proximo_followup <= d && abertaEtapa(l)),
        [["proximo_followup", "asc"]],
      )
        .slice(0, 8)
        .map(comContagens),
      prioridades: ordenar(
        leads.filter((l) => l.prioridade === "alta" && !l.ultimo_contato && ["descoberta", "qualificada"].includes(l.etapa)),
        [["atualizado_em", "desc"]],
      )
        .slice(0, 6)
        .map(comContagens),
    },
    conteudo: {
      por_status: CONTEUDO_STATUS.map((s) => ({ status: s.id, total: porStatus.get(s.id) ?? 0 })),
      proximos: ordenar(
        conteudos.filter((c) => ativo(c) && c.data_planejada && c.data_planejada >= d && c.data_planejada <= somarDias(d, 7)),
        [["data_planejada", "asc"], ["hora", "asc"]],
      ).slice(0, 10),
      planejados_semana: conteudos.filter((c) => c.status !== "arquivado" && c.data_planejada >= segunda && c.data_planejada <= domingo).length,
      publicados_semana: conteudos.filter((c) => {
        const quando = c.publicado_em ?? c.data_planejada;
        return c.status === "publicado" && quando >= segunda && quando <= domingo;
      }).length,
      atrasados: conteudos.filter((c) => ativo(c) && c.data_planejada && c.data_planejada < d).length,
    },
    radar: { ultimo_resumo: resumos[0] ?? null, novidades },
    automacoes,
  };
}

/* ---------------- automações ---------------- */

export async function registrarExecucao(
  db: Banco,
  automacaoId: string,
  { resultado = "ok", resumo = "", detalhes = "", iniciado_em, terminado_em }: Linha = {},
) {
  if (!(await db.buscarLinha("automacoes", automacaoId))) throw new ErroHttp(404, "Automação não encontrada.");
  const fim = terminado_em ?? agora();
  const id = await db.inserir("automacao_execucoes", { automacao_id: automacaoId, iniciado_em: iniciado_em ?? fim, terminado_em: fim, resultado, resumo, detalhes });
  await db.atualizar("automacoes", automacaoId, { ultima_execucao: fim, ultimo_resultado: resultado, ultimo_resumo: String(resumo).slice(0, 400) });
  return db.obter("automacao_execucoes", id);
}

/* ---------------- mercado (lista pública do FiveM) ---------------- */

const ENDERECO_CFX = "https://frontend.cfx-services.net/api/servers/single/";

export async function listarServidores(db: Banco) {
  // só a última amostra de cada cidade (lê os últimos 3 dias, que bastam com coleta de hora em hora)
  const amostras = await db.onde("mercado_amostras", (q) => q.gte("coletado_em", `${somarDias(hoje(), -3)}T00:00:00.000Z`));
  const ultima = new Map<string, Linha>();
  for (const a of amostras) {
    const u = ultima.get(a.servidor_id);
    if (!u || a.coletado_em > u.coletado_em) ultima.set(a.servidor_id, a);
  }
  return ordenar(await db.todas("mercado_servidores"), [["proprio", "desc"], ["ordem", "asc"], ["nome", "asc"]]).map((s) => {
    const u = ultima.get(s.id);
    return { ...s, ultimo_online: u?.online ?? null, ultimo_slots: u?.slots ?? null, ultima_coleta: u?.coletado_em ?? null };
  });
}

/** Consulta a lista pública do FiveM para cada cidade com código e grava uma amostra. */
export async function coletarMercado(db: Banco, { pausa = 800 } = {}) {
  const servidores = ordenar(
    (await db.todas("mercado_servidores")).filter((s) => s.ativo && s.cfx_codigo),
    [["ordem", "asc"]],
  );
  const falhas: { nome: string; erro: string }[] = [];
  let coletados = 0;
  for (const [n, s] of servidores.entries()) {
    if (n > 0 && pausa) await new Promise((r) => setTimeout(r, pausa));
    try {
      const resp = await fetch(ENDERECO_CFX + encodeURIComponent(s.cfx_codigo), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`a lista do FiveM respondeu ${resp.status}`);
      const dados = (await resp.json())?.Data ?? {};
      const online = Number.isFinite(Number(dados.clients)) ? Number(dados.clients) : null;
      const slots = Number.isFinite(Number(dados.sv_maxclients)) ? Number(dados.sv_maxclients) : null;
      if (online === null) throw new Error("resposta sem número de jogadores");
      await db.inserir("mercado_amostras", { servidor_id: s.id, coletado_em: agora(), online, slots, fonte: "cfx.re" });
      coletados++;
    } catch (e) {
      const err = e as Error;
      falhas.push({ nome: s.nome, erro: err?.name === "TimeoutError" ? "demorou demais para responder" : String(err.message ?? e) });
    }
  }
  return { coletados, falhas, total: servidores.length };
}

/* ---------------- exportar / importar tudo ---------------- */

export async function exportarTudo(db: Banco) {
  const dados: Linha = { gerado_em: agora(), versao: 1, origem: "host-avancado", tabelas: {} };
  for (const tabela of Object.keys(TABELAS)) dados.tabelas[tabela] = await db.cruas(tabela);
  const config = await db.lerConfig();
  dados.tabelas.config = Object.entries(config).map(([chave, valor]) => ({ chave, valor: JSON.stringify(valor) }));
  return dados;
}

/** Converte uma linha do painel local (SQLite: 0/1 e JSON em texto) para o formato do banco do site. */
export function linhaDoLocal(tabela: string, l: Linha): Linha {
  const def = defDe(tabela);
  const saida: Linha = { id: String(l.id) };
  for (const [c, tipo] of Object.entries(def.colunas)) {
    if (l[c] === undefined) continue;
    const v = l[c];
    if (tipo === "b") saida[c] = v === 1 || v === true || v === "1";
    else if (tipo === "ja" || tipo === "jo") {
      let lido = v;
      if (typeof v === "string") {
        try {
          lido = JSON.parse(v);
        } catch {
          lido = tipo === "ja" ? [] : {};
        }
      }
      saida[c] = lido ?? (tipo === "ja" ? [] : {});
    } else saida[c] = v;
  }
  if (!def.semCriado && l.criado_em !== undefined) saida.criado_em = l.criado_em;
  if (!def.semAtualizado && l.atualizado_em !== undefined) saida.atualizado_em = l.atualizado_em;
  return saida;
}

/** Insere o que ainda não existe (pelo id). Nunca apaga nem sobrescreve. */
export async function importarTudo(db: Banco, dados: Linha) {
  const tabelas = dados?.tabelas;
  if (!tabelas || typeof tabelas !== "object") throw new ErroHttp(400, "Arquivo de exportação inválido.");
  const resumo: Record<string, number> = {};
  // pais primeiro, por causa das chaves estrangeiras (a ordem de TABELAS já começa por leads)
  for (const tabela of Object.keys(TABELAS)) {
    const linhas: Linha[] = Array.isArray(tabelas[tabela]) ? tabelas[tabela] : [];
    const existentes = new Set((await db.cruas(tabela)).map((l) => l.id));
    const novas = linhas.filter((l) => l?.id && !existentes.has(String(l.id))).map((l) => linhaDoLocal(tabela, l));
    if (novas.length) await db.inserirVarias(tabela, novas);
    resumo[tabela] = novas.length;
  }
  const configAtual = await db.lerConfig();
  for (const r of Array.isArray(tabelas.config) ? tabelas.config : []) {
    if (!r?.chave || r.chave === "pin_acesso" || r.chave in configAtual) continue;
    let valor = r.valor;
    if (typeof valor === "string") {
      try {
        valor = JSON.parse(valor);
      } catch {
        // fica como texto
      }
    }
    await db.gravarConfig(r.chave, valor);
  }
  return resumo;
}

export { deLinha };
