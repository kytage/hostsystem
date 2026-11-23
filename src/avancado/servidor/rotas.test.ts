// Testes do HOST AVANÇADO com um banco falso em memória (nada toca o banco do site).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { criarBancoFalso } from "./banco-falso";
import { ErroHttp, hoje, somarDias, usarClienteDeTeste } from "./banco";
import { atender } from "./rotas";

/* eslint-disable @typescript-eslint/no-explicit-any */
const get = (c: string) => atender("GET", c) as Promise<any>;
const post = (c: string, corpo: unknown = {}) => atender("POST", c, corpo) as Promise<any>;
const patch = (c: string, corpo: unknown) => atender("PATCH", c, corpo) as Promise<any>;
const del = (c: string) => atender("DELETE", c) as Promise<any>;

beforeEach(() => {
  usarClienteDeTeste(criarBancoFalso().cliente);
});

test("cria oportunidade e barra a parecida (mesmo Instagram)", async () => {
  const a = await post("/leads", { nome: "Família Teste", links: ["https://www.instagram.com/familiateste/"], triagem: "aprovado" });
  assert.equal(a.nome, "Família Teste");
  assert.equal(a.links[0].plataforma, "instagram");
  await assert.rejects(
    () => post("/leads", { nome: "Outro nome", links: [{ url: "https://instagram.com/familiateste" }] }),
    (e: unknown) => e instanceof ErroHttp && e.status === 409 && Array.isArray(e.extra["duplicados"]),
  );
  const forcado = await post("/leads", { nome: "Outro nome", links: ["https://instagram.com/familiateste"], forcar: true });
  assert.ok(forcado.id);
  const lista = await get("/leads?triagem=todos");
  assert.equal(lista.itens.length, 2);
});

test("mudar de etapa grava no histórico da oportunidade", async () => {
  const a = await post("/leads", { nome: "Org Etapa", triagem: "aprovado" });
  const depois = await patch(`/leads/${a.id}`, { etapa: "abordagem" });
  assert.equal(depois.etapa, "abordagem");
  assert.equal(depois.interacoes.length, 1);
  assert.equal(depois.interacoes[0].tipo, "etapa");
});

test("mensagem registrada conta como contato; evidência entra na oportunidade", async () => {
  const a = await post("/leads", { nome: "Org Contato", triagem: "aprovado" });
  await post(`/leads/${a.id}/evidencias`, { url: "https://exemplo.com/post", descricao: "bio", classificacao: "fato" });
  const r = await post(`/leads/${a.id}/interacoes`, { tipo: "mensagem", canal: "discord", resumo: "primeiro contato", data: `${hoje()}T12:00:00.000Z` });
  assert.equal(r.ultimo_contato, hoje());
  assert.equal(r.total_evidencias, 1);
  await assert.rejects(() => post(`/leads/${a.id}/evidencias`, { url: "" }), (e: unknown) => e instanceof ErroHttp && e.status === 400);
});

test("juntar duas oportunidades leva as evidências e apaga a outra", async () => {
  const a = await post("/leads", { nome: "Org A", triagem: "aprovado", tags: ["x"] });
  const b = await post("/leads", { nome: "Org B", triagem: "aprovado", tags: ["y"], lider: "Fulano" });
  await post(`/leads/${b.id}/evidencias`, { url: "https://exemplo.com/b" });
  const j = await post(`/leads/${a.id}/mesclar`, { outro_id: b.id });
  assert.equal(j.lider, "Fulano");
  assert.deepEqual([...j.tags].sort(), ["x", "y"]);
  assert.equal(j.total_evidencias, 1);
  await assert.rejects(() => get(`/leads/${b.id}`), (e: unknown) => e instanceof ErroHttp && e.status === 404);
});

test("apagar oportunidade apaga as evidências dela", async () => {
  const a = await post("/leads", { nome: "Org Apagar", triagem: "aprovado" });
  await post(`/leads/${a.id}/evidencias`, { url: "https://exemplo.com/a" });
  await del(`/leads/${a.id}`);
  assert.equal((await get("/leads?triagem=todos")).itens.length, 0);
});

test("importar planilha: simula sem gravar e barra repetido no próprio arquivo", async () => {
  const csv = "nome;links;cidade_atual\nOrg 1;https://instagram.com/org1;Rise\nOrg 1 de novo;https://instagram.com/org1;Ecco\nOrg 2;;Hype";
  const sim = await post("/leads/importar", { formato: "csv", conteudo: csv, simular: true });
  assert.equal(sim.novos.length, 2);
  assert.equal(sim.duplicados.length, 1);
  assert.equal((await get("/leads?triagem=todos")).itens.length, 0);
  const real = await post("/leads/importar", { formato: "csv", conteudo: csv, simular: false, triagem: "pendente" });
  assert.equal(real.novos.length, 2);
  assert.equal((await get("/leads?triagem=pendente")).itens.length, 2);
});

test("tarefa que repete cria a próxima ao concluir", async () => {
  const t = await post("/tarefas", { titulo: "Postar o resumo", recorrencia: "semanal", prazo: hoje(), checklist: [{ texto: "a", feito: true }] });
  const r = await post(`/tarefas/${t.id}/concluir`);
  assert.equal(r.concluida.status, "feito");
  assert.equal(r.proxima.prazo, somarDias(hoje(), 7));
  assert.equal(r.proxima.checklist[0].feito, false);
  const abertas = await get("/tarefas");
  assert.equal(abertas.itens.length, 1);
});

test("conteúdo publicado ganha a data de hoje; campo inválido é recusado", async () => {
  const c = await post("/conteudos", { titulo: "Reels da HUD", data_planejada: hoje() });
  const p = await patch(`/conteudos/${c.id}`, { status: "publicado" });
  assert.equal(p.publicado_em, hoje());
  await assert.rejects(() => patch(`/conteudos/${c.id}`, { status: "qualquer" }), (e: unknown) => e instanceof ErroHttp && e.status === 400);
  await assert.rejects(() => post("/conteudos", { titulo: "  " }), (e: unknown) => e instanceof ErroHttp && e.status === 400);
});

test("visão geral conta o que está aberto e endereço desconhecido dá 404", async () => {
  await post("/leads", { nome: "Org Painel", triagem: "aprovado", etapa: "descoberta" });
  await post("/leads", { nome: "Org Triagem", triagem: "pendente" });
  await post("/tarefas", { titulo: "Atrasada", prazo: somarDias(hoje(), -1) });
  const p = await get("/painel");
  assert.equal(p.captacao.total_abertos, 1);
  assert.equal(p.captacao.para_triagem, 1);
  assert.equal(p.tarefas.atrasadas, 1);
  await assert.rejects(() => get("/nao-existe"), (e: unknown) => e instanceof ErroHttp && e.status === 404);
});
