// As mesmas rotas /api do HOST CENTRAL local, atendidas aqui no navegador com o banco do site.
// As telas chamam api.get("/leads") etc. como antes; quem responde é esta tabela de rotas.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Banco, ErroHttp, type Linha, agora, contem, hoje, listaDe, ordenar, somarDias } from "./banco";
import {
  alterarFilha,
  alterarLead,
  criarFilha,
  criarLead,
  duplicadosDe,
  excluirFilha,
  excluirLead,
  importarLeads,
  indicadoresCaptacao,
  leadCompleto,
  listarLeads,
  mesclarLeads,
} from "./leads";
import {
  coletarMercado,
  concluirTarefa,
  exportarTudo,
  importarTudo,
  listarServidores,
  listarTarefas,
  montarPainel,
  registrarExecucao,
} from "./servicos";

export const VERSAO = "0.1.0-site";

type Q = any;
type Contexto = { db: Banco; p: any; q: Q; corpo: Linha };
type Acao = (c: Contexto) => Promise<unknown>;
const rotas: { metodo: string; partes: string[]; acao: Acao }[] = [];
const rota = (metodo: string, caminho: string, acao: Acao) => rotas.push({ metodo, partes: caminho.split("/").filter(Boolean), acao });

/** Rotas padrão (listar, ver, criar, alterar, apagar) de uma tabela simples. */
function crud(
  caminho: string,
  tabela: string,
  {
    oQue,
    filtrar,
    ordem = [["criado_em", "desc"]],
    porId = false,
    aoAlterar,
    limite,
  }: {
    oQue?: string;
    filtrar?: (q: Q) => (l: Linha) => boolean;
    ordem?: Parameters<typeof ordenar>[1];
    porId?: boolean;
    aoAlterar?: (antes: Linha, dados: Linha) => Linha;
    limite?: (q: Q) => number | undefined;
  } = {},
) {
  rota("GET", caminho, async ({ db, q }) => {
    const passa = filtrar ? filtrar(q) : () => true;
    const itens = ordenar((await db.todas(tabela)).filter(passa), ordem);
    const n = limite?.(q);
    return { itens: n ? itens.slice(0, n) : itens };
  });
  rota("GET", `${caminho}/:id`, ({ db, p }) => db.obterOu404(tabela, p.id, oQue));
  rota("POST", caminho, async ({ db, corpo }) => {
    if (porId && corpo.id && (await db.buscarLinha(tabela, String(corpo.id)))) {
      await db.atualizar(tabela, String(corpo.id), corpo);
      return db.obter(tabela, String(corpo.id));
    }
    const id = await db.inserir(tabela, corpo);
    await db.historico(tabela, id, "criou", corpo.titulo ?? corpo.nome ?? "");
    return db.obter(tabela, id);
  });
  rota("PATCH", `${caminho}/:id`, async ({ db, p, corpo }) => {
    const antes = await db.obterOu404(tabela, p.id, oQue);
    const extras = aoAlterar ? aoAlterar(antes, corpo) : {};
    await db.atualizar(tabela, p.id, { ...corpo, ...extras });
    return db.obter(tabela, p.id);
  });
  rota("DELETE", `${caminho}/:id`, async ({ db, p }) => {
    const antes = await db.obterOu404(tabela, p.id, oQue);
    await db.apagar(tabela, p.id);
    await db.historico(tabela, p.id, "excluiu", antes.titulo ?? antes.nome ?? "");
    return undefined;
  });
}

const resumoColeta = (r: Awaited<ReturnType<typeof coletarMercado>>) =>
  `${r.coletados} de ${r.total} cidades coletadas${r.falhas.length ? `; falhou: ${r.falhas.map((f) => f.nome).join(", ")}` : ""}`;
const resultadoColeta = (r: Awaited<ReturnType<typeof coletarMercado>>) => (r.falhas.length === 0 ? "ok" : r.coletados > 0 ? "parcial" : "erro");

/* ---------- sistema ---------- */
rota("GET", "/saude", async () => ({ ok: true, versao: VERSAO, banco: "Banco do site (hostgg.dev)", iniciado_em: agora(), rede_local: false }));
rota("GET", "/painel", ({ db }) => montarPainel(db));
rota("GET", "/config", ({ db }) => db.lerConfig());
rota("PUT", "/config/:chave", async ({ db, p, corpo }) => {
  await db.gravarConfig(p.chave, corpo.valor);
  return db.lerConfig();
});
rota("GET", "/backups", async () => ({ itens: [] }));
rota("GET", "/exportar-tudo", ({ db }) => exportarTudo(db));
rota("POST", "/importar-tudo", async ({ db, corpo }) => ({ inseridos: await importarTudo(db, corpo.dados) }));
rota("GET", "/historico", async ({ db, q }) => ({ itens: await db.listarHistorico(Math.min(500, Number(q.limite ?? 100) || 100)) }));

/* ---------- captação ---------- */
rota("GET", "/leads", async ({ db, q }) => ({ itens: await listarLeads(db, q) }));
rota("GET", "/leads/indicadores", ({ db }) => indicadoresCaptacao(db));
rota("POST", "/leads/duplicados", async ({ db, corpo }) => ({ duplicados: await duplicadosDe(db, corpo.nome, corpo.links, corpo.ignorar_id ?? null) }));
rota("POST", "/leads/importar", ({ db, corpo }) => importarLeads(db, corpo));
rota("POST", "/leads", ({ db, corpo }) => criarLead(db, corpo));
rota("GET", "/leads/:id", ({ db, p }) => leadCompleto(db, p.id));
rota("PATCH", "/leads/:id", ({ db, p, corpo }) => alterarLead(db, p.id, corpo));
rota("DELETE", "/leads/:id", async ({ db, p }) => {
  await excluirLead(db, p.id);
  return undefined;
});
rota("POST", "/leads/:id/mesclar", ({ db, p, corpo }) => mesclarLeads(db, p.id, String(corpo.outro_id ?? "")));
for (const tipo of ["evidencias", "contatos", "interacoes"]) {
  rota("POST", `/leads/:id/${tipo}`, ({ db, p, corpo }) => criarFilha(db, p.id, tipo, corpo));
  rota("PATCH", `/leads/:id/${tipo}/:fid`, ({ db, p, corpo }) => alterarFilha(db, p.id, tipo, p.fid, corpo));
  rota("DELETE", `/leads/:id/${tipo}/:fid`, ({ db, p }) => excluirFilha(db, p.id, tipo, p.fid));
}

/* ---------- conteúdo ---------- */
rota("POST", "/conteudos/:id/duplicar", async ({ db, p }) => {
  const original = await db.obterOu404("conteudos", p.id, "Conteúdo");
  const copia: Linha = { ...original, titulo: `${original.titulo} (cópia)`, status: "ideia", data_planejada: null, publicado_em: null, metricas: {}, ordem: Date.now() };
  delete copia.id;
  delete copia.criado_em;
  delete copia.atualizado_em;
  return db.obter("conteudos", await db.inserir("conteudos", copia));
});
crud("/conteudos", "conteudos", {
  oQue: "Conteúdo",
  ordem: [["data_planejada", "asc", "ultimo"], ["hora", "asc"], ["ordem", "asc"]],
  filtrar: (q) => {
    const testes: ((l: Linha) => boolean)[] = [];
    const demo = q.demo ?? "0";
    if (demo !== "todos") testes.push((l) => !!l.demo === (demo === "1"));
    if (q.mes) testes.push((l) => String(l.data_planejada ?? "").slice(0, 7) === q.mes);
    if (q.de) testes.push((l) => !!l.data_planejada && l.data_planejada >= q.de);
    if (q.ate) testes.push((l) => !!l.data_planejada && l.data_planejada <= q.ate);
    for (const col of ["status", "pilar", "quadro_id", "formato"]) {
      const itens = listaDe(q[col]);
      if (itens.length) testes.push((l) => itens.includes(String(l[col] ?? "")));
    }
    if (q.busca) testes.push((l) => ["titulo", "gancho", "legenda", "narracao"].some((c) => contem(l[c], q.busca)));
    return (l) => testes.every((t) => t(l));
  },
  aoAlterar: (antes, dados) => (dados.status === "publicado" && antes.status !== "publicado" && !dados.publicado_em && !antes.publicado_em ? { publicado_em: hoje() } : {}),
});
crud("/quadros", "quadros", { oQue: "Quadro", ordem: [["ordem", "asc"], ["nome", "asc"]] });
crud("/modelos", "modelos", {
  oQue: "Modelo",
  ordem: [["tipo", "asc"], ["ordem", "asc"], ["titulo", "asc"]],
  filtrar: (q) => {
    const tipos = listaDe(q.tipo);
    return (l) => !tipos.length || tipos.includes(l.tipo);
  },
});

/* ---------- tarefas ---------- */
rota("GET", "/tarefas", async ({ db, q }) => ({ itens: await listarTarefas(db, q) }));
rota("POST", "/tarefas/:id/concluir", ({ db, p }) => concluirTarefa(db, p.id));
crud("/tarefas", "tarefas", {
  oQue: "Tarefa",
  aoAlterar: (antes, dados) => {
    if (dados.status === "feito" && antes.status !== "feito") return { concluida_em: agora() };
    if (dados.status && dados.status !== "feito" && antes.status === "feito") return { concluida_em: null };
    return {};
  },
});

/* ---------- radar ---------- */
crud("/pesquisas", "pesquisas", { oQue: "Pesquisa", ordem: [["data", "desc"], ["criado_em", "desc"]] });
crud("/resumos", "resumos", {
  oQue: "Resumo",
  ordem: [["data", "desc"], ["criado_em", "desc"]],
  limite: (q) => (q.limite ? Math.min(365, Number(q.limite) || 30) : undefined),
});
crud("/novidades", "novidades", { oQue: "Novidade", ordem: [["data", "desc"], ["criado_em", "desc"]] });
rota("GET", "/mercado/servidores", async ({ db }) => ({ itens: await listarServidores(db) }));
rota("GET", "/mercado/amostras", async ({ db, q }) => {
  const dias = Math.min(365, Number(q.dias ?? 30) || 30);
  const desde = `${somarDias(hoje(), -dias)}T00:00:00.000Z`;
  const itens = await db.onde("mercado_amostras", (b) => {
    let x = b.gte("coletado_em", desde);
    if (q.servidor_id) x = x.eq("servidor_id", q.servidor_id);
    return x.order("coletado_em", { ascending: true });
  });
  return { itens };
});
rota("POST", "/mercado/coletar", async ({ db }) => {
  const r = await coletarMercado(db);
  if (await db.buscarLinha("automacoes", "mercado-cfx")) {
    await registrarExecucao(db, "mercado-cfx", { resultado: resultadoColeta(r), resumo: resumoColeta(r), detalhes: JSON.stringify(r.falhas) });
  }
  return r;
});
crud("/mercado/servidores", "mercado_servidores", { oQue: "Cidade", ordem: [["ordem", "asc"], ["nome", "asc"]] });

/* ---------- automações e materiais ---------- */
rota("GET", "/automacoes/:id/execucoes", async ({ db, p }) => ({
  itens: ordenar((await db.todas("automacao_execucoes")).filter((e) => e.automacao_id === p.id), [["iniciado_em", "desc"]]).slice(0, 30),
}));
rota("POST", "/automacoes/:id/execucoes", ({ db, p, corpo }) => registrarExecucao(db, p.id, corpo));
rota("POST", "/automacoes/:id/executar", async ({ db, p }) => {
  const inicio = agora();
  if (p.id === "mercado-cfx") {
    const r = await coletarMercado(db);
    return registrarExecucao(db, p.id, { resultado: resultadoColeta(r), resumo: resumoColeta(r), detalhes: JSON.stringify(r.falhas), iniciado_em: inicio });
  }
  if (p.id === "backup-diario") throw new ErroHttp(400, "No site, o banco já tem cópia de segurança automática. Para baixar tudo, use Configurações › Exportar tudo.");
  throw new ErroHttp(400, "Esta automação não roda por aqui: ela é executada pelo Claude.");
});
crud("/automacoes", "automacoes", { oQue: "Automação", ordem: [["ordem", "asc"], ["nome", "asc"]], porId: true });
crud("/materiais", "materiais", { oQue: "Material", ordem: [["fixado", "desc"], ["ordem", "asc"], ["titulo", "asc"]], porId: true });

/** Atende uma chamada como o servidor local faria. Lança ErroHttp com a mesma mensagem. */
export async function atender(metodo: string, caminhoCompleto: string, corpo?: unknown): Promise<unknown> {
  const [caminho = "", busca = ""] = caminhoCompleto.split("?");
  const partes = caminho.split("/").filter(Boolean).map(decodeURIComponent);
  const q = Object.fromEntries(new URLSearchParams(busca)) as Q;
  for (const r of rotas) {
    if (r.metodo !== metodo || r.partes.length !== partes.length) continue;
    const p: Record<string, string> = {};
    const bate = r.partes.every((parte, i) => {
      if (parte.startsWith(":")) {
        p[parte.slice(1)] = partes[i] ?? "";
        return true;
      }
      return parte === partes[i];
    });
    if (!bate) continue;
    const dados = corpo && typeof corpo === "object" ? (corpo as Linha) : {};
    return r.acao({ db: new Banco(), p, q, corpo: dados });
  }
  throw new ErroHttp(404, "Endereço não encontrado.");
}
