/**
 * Registro de autoria: cada mudança feita no site (criar, editar, apagar) vira uma linha em
 * public.registro_autoria, gravada por um gatilho no banco (migração 20261219120000). Aqui ficam
 * os nomes que a tela mostra: de qual aba do site é cada tabela, como chamar cada campo, qual é
 * o registro que mudou ("a ficha da Armas01 · Favela Barragem") e como mostrar cada valor.
 */
import { CATEGORIAS_DE_LOG } from "@/lib/logs-servidor";

/** A aba do site de cada tabela do banco. */
export const ABA_DA_TABELA: Record<string, string> = {
  anotacoes: "Perfil & Agenda",
  tarefas_particulares: "Perfil & Agenda",
  pendencias: "Áreas",
  area_grupo_lideres: "Áreas",
  areas: "Áreas",
  avisos: "Avisos",
  captacoes: "Captações",
  captacoes_categorias: "Captações",
  captacoes_estabelecimentos: "Captações",
  captacoes_modelos: "Captações",
  captacoes_reunioes: "Captações",
  card_comentarios: "Desenvolvimento",
  kanban_cards: "Desenvolvimento",
  kanban_devs: "Desenvolvimento",
  kanban_ranking_base: "Desenvolvimento",
  solicitacoes_admin: "Desenvolvimento",
  dev_tasks: "HOST UPDATE 3.0",
  patch_notes: "HOST UPDATE 3.0",
  casting: "Equipe",
  profiles: "Equipe",
  user_roles: "Equipe",
  user_areas: "Equipe",
  staff_anotacoes: "Equipe",
  area_permissions: "Permissões",
  role_permissions: "Permissões",
  user_permissions: "Permissões",
  eventos: "Eventos e Cronograma",
  eventos_gestao: "Eventos e Cronograma",
  financeiro_entradas: "Financeiro",
  financeiro_meses: "Financeiro",
  financeiro_saidas: "Financeiro",
  ilegal_anotacoes: "Ilegal",
  ilegal_avisos: "Ilegal",
  ilegal_coroas: "Ilegal",
  ilegal_cronograma: "Ilegal",
  ilegal_detalhes: "Ilegal",
  ilegal_orgs: "Ilegal",
  org_membros: "Ilegal",
  org_paineis: "Ilegal",
  marketing_conteudos: "Marketing",
  marketing_leads: "Marketing",
  marketing_referencias: "Marketing",
  peds: "Peds",
  players: "Players",
  punicoes: "Punições",
  server_log_permissoes: "Logs",
};

/** O que é cada tabela, em poucas palavras (aparece no cartão: "editou ficha · …"). */
export const NOME_DA_TABELA: Record<string, string> = {
  anotacoes: "anotação",
  tarefas_particulares: "tarefa particular",
  pendencias: "pendência",
  area_grupo_lideres: "líder de grupo",
  areas: "área",
  avisos: "aviso",
  captacoes: "captação",
  captacoes_categorias: "categoria de captação",
  captacoes_estabelecimentos: "estabelecimento",
  captacoes_modelos: "modelo de proposta",
  captacoes_reunioes: "reunião",
  card_comentarios: "comentário de card",
  kanban_cards: "card",
  kanban_devs: "dev",
  kanban_ranking_base: "ranking",
  solicitacoes_admin: "solicitação",
  dev_tasks: "projeto",
  patch_notes: "patch note",
  casting: "casting",
  profiles: "perfil",
  user_roles: "cargo",
  user_areas: "área do staff",
  staff_anotacoes: "anotação de staff",
  area_permissions: "permissão de área",
  role_permissions: "permissão de cargo",
  user_permissions: "permissão de usuário",
  eventos: "evento",
  eventos_gestao: "evento",
  financeiro_entradas: "entrada",
  financeiro_meses: "mês do financeiro",
  financeiro_saidas: "saída",
  ilegal_anotacoes: "anotação do ilegal",
  ilegal_avisos: "aviso do ilegal",
  ilegal_coroas: "coroa",
  ilegal_cronograma: "cronograma",
  ilegal_detalhes: "ficha",
  ilegal_orgs: "organização",
  org_membros: "membro de org",
  org_paineis: "painel de org",
  marketing_conteudos: "conteúdo",
  marketing_leads: "lead",
  marketing_referencias: "referência",
  peds: "ped",
  players: "player",
  punicoes: "punição",
  server_log_permissoes: "acesso às logs",
};

export const abaDaTabela = (t: string) => ABA_DA_TABELA[t] ?? "Outros";
export const nomeDaTabela = (t: string) => NOME_DA_TABELA[t] ?? t.replace(/_/g, " ");

/** Todas as abas, em ordem alfabética (filtro da tela). */
export const ABAS_DA_AUTORIA = [...new Set(Object.values(ABA_DA_TABELA))].sort((a, b) =>
  a.localeCompare(b, "pt-BR"),
);

/** As tabelas de uma aba (para filtrar no banco). */
export const tabelasDaAba = (aba: string) =>
  Object.entries(ABA_DA_TABELA)
    .filter(([, a]) => a === aba)
    .map(([t]) => t);

export const VERBO: Record<string, string> = {
  INSERT: "criou",
  UPDATE: "editou",
  DELETE: "apagou",
};

/** Campos que não interessam mostrar no detalhe. */
export const CAMPOS_ESCONDIDOS = new Set([
  "id",
  "created_at",
  "updated_at",
  "criado_em",
  "atualizado_em",
  "last_seen_at",
]);

/* ------------------------------------------------------------------ nomes dos campos */

const ROTULO_DO_CAMPO: Record<string, string> = {
  // ficha do ilegal
  org_id: "Organização (código)",
  logo: "Logo",
  nome1: "Nome 1",
  nome2: "Nome 2",
  nome3: "Nome 3",
  telefone1: "Telefone 1",
  telefone2: "Telefone 2",
  telefone3: "Telefone 3",
  cds_bau_lider: "CDS do baú do líder",
  cds_bau_membro: "CDS do baú dos membros",
  cds_craft: "CDS do craft",
  cds_shop: "CDS da loja",
  cds_rota: "CDS da rota",
  cds_blip_desmanche: "CDS do desmanche",
  garagem_blip: "Garagem (blip)",
  garagem_spawn: "Garagem (spawn)",
  uniforme: "Uniforme",
  cor_veiculo: "Cor do veículo",
  anotacoes_sobre: "Anotações",
  vips: "VIPs",
  vip_config: "Configuração VIP",
  salario: "Salário",
  bauLider: "Baú do líder",
  bauMembro: "Baú dos membros",
  tatuagem: "Tatuagem",
  barbearia: "Barbearia",
  lojaRoupa: "Loja de roupa",
  textoExtra: "Texto extra",
  radioPrivada: "Rádio privada",
  garagemComumBlip: "Garagem comum (blip)",
  garagemComumCarro: "Garagem comum (carro)",
  garagemComumSpawn: "Garagem comum (spawn)",
  garagemCaminhaoBlip: "Garagem do caminhão (blip)",
  garagemCaminhaoIndex: "Garagem do caminhão (veículo)",
  garagemCaminhaoSpawn: "Garagem do caminhão (spawn)",
  // organização do ilegal
  setagem: "Setagem",
  setagens: "Setagens",
  local: "Local",
  grupo: "Grupo",
  cds: "CDS",
  organizacao: "Organização",
  status: "Status",
  situacao: "Situação",
  observacao: "Observação",
  categoria: "Categoria",
  limpo_em: "Limpo em",
  limpo_por: "Limpo por",
  ordem: "Ordem",
  motivo: "Motivo",
  // geral
  nome: "Nome",
  titulo: "Título",
  title: "Título",
  descricao: "Descrição",
  description: "Descrição",
  texto: "Texto",
  tipo: "Tipo",
  subtipo: "Subtipo",
  prioridade: "Prioridade",
  priority: "Prioridade",
  coluna: "Coluna",
  column_id: "Coluna",
  responsavel: "Responsável",
  responsaveis: "Responsáveis",
  assignee: "Responsável",
  checklist: "Checklist",
  data_hora: "Data e hora",
  prazo: "Prazo",
  tag: "Tag",
  anexos: "Anexos",
  attachments: "Anexos",
  estrutura: "Estrutura",
  criado_por: "Criado por",
  criado_por_id: "Criado por",
  concluido_em: "Concluído em",
  concluido_at: "Concluído em",
  concluido_por: "Concluído por",
  aprovado_por: "Aprovado por",
  arquivado: "Arquivado",
  numero: "Número",
  obs_dev: "Observação do dev",
  patch_texto: "Texto do patch",
  teste_status: "Status do teste",
  entrou_dev_at: "Entrou no dev em",
  // financeiro
  valor: "Valor",
  mes: "Mês",
  data_pagamento: "Data do pagamento",
  comprovante: "Comprovante",
  recorrencia_pai: "Repete de",
  // equipe
  username: "Nome de usuário",
  avatar_url: "Foto",
  banner_url: "Banner",
  bio: "Bio",
  discord_id: "ID do Discord",
  host_id: "ID HOST (passaporte)",
  deve_trocar_senha: "Precisa trocar a senha",
  staff_id: "Staff",
  autor_id: "Autor",
  autor_nome: "Autor",
  user_id: "Usuário",
  role: "Cargo",
  area: "Área",
  // logs
  cargos: "Cargos",
  areas: "Áreas",
  atualizado_por: "Atualizado por",
  // peds
  tamanho: "Tamanho",
  discord_ped: "Discord do ped",
  passaporte_ped: "Passaporte do ped",
  arquivo: "Arquivo",
  discord_responsavel: "Discord do responsável",
  passaporte_responsavel: "Passaporte do responsável",
  adicao: "Adição",
  staff: "Staff",
  categoria_id: "Categoria",
};

/** Nome bonito do campo ("telefone2" → "Telefone 2", "cds_bau_lider" → "CDS do baú do líder"). */
export function rotuloDoCampo(c: string): string {
  if (ROTULO_DO_CAMPO[c]) return ROTULO_DO_CAMPO[c];
  const t = c
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/(\D)(\d+)$/, "$1 $2")
    .toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ qual registro mudou */

export type Linha = Record<string, unknown>;

export interface RegistroAutoria {
  id: number;
  tabela: string;
  acao: string;
  registro_id: string | null;
  campos: string[];
  antes: Linha | null;
  depois: Linha | null;
}

/** Tabelas cuja chave não é "id": o gatilho não guarda quem é o registro na edição. */
export const CHAVE_SEM_ID: Record<string, string> = {
  ilegal_detalhes: "org_id",
  server_log_permissoes: "categoria",
};

/** O que o site sabe além do registro em si: nomes das pessoas e os registros de cada tabela. */
export interface ContextoAutoria {
  /** id do usuário → nome */
  pessoas: Map<string, string>;
  /** "tabela:id" → registro (como está agora, ou como era antes de ser apagado) */
  linhas: Map<string, Linha>;
  /** id da linha do registro de autoria → chave do registro (tabelas sem "id") */
  chaves: Map<number, string>;
}

export const contextoVazio = (): ContextoAutoria => ({
  pessoas: new Map(),
  linhas: new Map(),
  chaves: new Map(),
});

const vazio = (v: unknown) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

const igual = (a: unknown, b: unknown) =>
  (vazio(a) && vazio(b)) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Descobre qual registro cada edição mexeu, nas tabelas sem "id" (a ficha do ilegal, o acesso às
 * logs). Parte de como as fichas estão agora e volta no tempo, da edição mais nova para a mais
 * velha: a ficha que hoje tem "Rafaella" no Nome 2 é a que recebeu "Rafaella" no Nome 2. A cada
 * edição achada, a ficha volta a ter o valor de antes, para achar as edições mais velhas.
 */
export function descobrirChaves(
  registros: RegistroAutoria[],
  atuais: Linha[],
  chave: string,
): Map<number, string> {
  const estado = new Map<string, Linha>();
  for (const r of atuais) {
    const k = r[chave];
    if (typeof k === "string" && k) estado.set(k, { ...r });
  }
  const achou = new Map<number, string>();
  const ordem = [...registros].sort((a, b) => b.id - a.id);
  for (const r of ordem) {
    if (r["acao"] === "INSERT" || r["acao"] === "DELETE") {
      const linha = r["acao"] === "INSERT" ? r["depois"] : r["antes"];
      const k = linha?.[chave];
      if (typeof k !== "string" || !k) continue;
      achou.set(r["id"], k);
      if (r["acao"] === "INSERT") estado.delete(k);
      else estado.set(k, { ...linha });
      continue;
    }
    const direto = r["depois"]?.[chave] ?? r["antes"]?.[chave];
    if (typeof direto === "string" && direto) {
      achou.set(r["id"], direto);
      const linha = estado.get(direto);
      if (linha) for (const c of r["campos"]) linha[c] = r["antes"]?.[c];
      continue;
    }
    const campos = r["campos"].filter((c) => c !== chave);
    if (campos.length === 0) continue;
    const candidatos = [...estado.entries()].filter(([, linha]) =>
      campos.every((c) => igual(linha[c], r["depois"]?.[c])),
    );
    if (candidatos.length !== 1) continue;
    const [k, linha] = candidatos[0]!;
    achou.set(r["id"], k);
    for (const c of campos) linha[c] = r["antes"]?.[c];
  }
  return achou;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** "local-favela-colombia" → "Favela Colombia" (quando a organização já nem existe mais). */
export const nomeDoCodigo = (k: string) =>
  k
    .replace(/^local-/, "")
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

/** O id do registro mudado (ou a chave, nas tabelas sem "id"). */
export function idDoRegistro(l: RegistroAutoria, ctx: ContextoAutoria): string | null {
  if (l.registro_id) return l.registro_id;
  const chave = CHAVE_SEM_ID[l.tabela];
  if (!chave) return null;
  const direto = texto(l.depois?.[chave]) || texto(l.antes?.[chave]);
  return direto || ctx.chaves.get(l.id) || null;
}

/** Tudo que se sabe do registro: como está agora + o que a mudança mostra (sem apagar com vazio). */
export function linhaJunta(l: RegistroAutoria, ctx: ContextoAutoria): Linha {
  const id = idDoRegistro(l, ctx);
  const base: Linha = { ...((id && ctx.linhas.get(`${l.tabela}:${id}`)) || {}) };
  for (const parte of [l.antes, l.depois]) {
    for (const [k, v] of Object.entries(parte ?? {})) if (!vazio(v)) base[k] = v;
  }
  return base;
}

const juntar = (...partes: unknown[]) =>
  [...new Set(partes.map(texto).filter(Boolean))].join(" · ");

const encurtar = (t: string, n = 80) => {
  const s = t
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** "Armas01 · Favela Barragem · AVENUE" */
export const rotuloDaOrg = (o: Linha) => juntar(o["setagem"], o["local"], o["organizacao"]);

const reais = (v: unknown) =>
  typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "";

/** Qual é o registro mudado, em palavras: "Armas01 · Favela Barragem · AVENUE", "#41 Login quebrado". */
export function tituloDoRegistro(l: RegistroAutoria, ctx: ContextoAutoria): string | null {
  const r = linhaJunta(l, ctx);
  const pessoa = (v: unknown) => (typeof v === "string" && ctx.pessoas.get(v)) || "";
  let t = "";
  switch (l.tabela) {
    case "ilegal_detalhes": {
      const id = idDoRegistro(l, ctx);
      const org = id ? ctx.linhas.get(`ilegal_orgs:${id}`) : undefined;
      t = org ? rotuloDaOrg(org) : id ? nomeDoCodigo(id) : "";
      break;
    }
    case "ilegal_orgs":
      t = rotuloDaOrg(r) || nomeDoCodigo(texto(r["id"]));
      break;
    case "ilegal_coroas":
      t = juntar(r["setagem"], r["organizacao"]);
      break;
    case "ilegal_cronograma":
      t = juntar(r["titulo"], r["setagem"]);
      break;
    case "kanban_cards":
      t = juntar(r["numero"] ? `#${r["numero"]}` : "", r["titulo"]);
      break;
    case "dev_tasks":
      t = texto(r["title"]);
      break;
    case "financeiro_saidas":
    case "financeiro_entradas":
      t = juntar(r["titulo"] ?? r["descricao"], reais(r["valor"]));
      break;
    case "profiles":
      t = texto(r["username"]) || pessoa(r["id"]);
      break;
    case "staff_anotacoes":
      t = pessoa(r["staff_id"]) ? `sobre ${pessoa(r["staff_id"])}` : "";
      break;
    case "user_roles":
    case "user_areas":
    case "user_permissions":
      t = juntar(pessoa(r["user_id"]), r["role"] ?? r["area"] ?? r["permissao"]);
      break;
    case "peds":
      t = juntar(r["responsavel"], r["passaporte_ped"] ? `passaporte ${texto(r["passaporte_ped"])}` : "", r["grupo"]);
      break;
    case "server_log_permissoes": {
      const id = idDoRegistro(l, ctx) ?? "";
      t = CATEGORIAS_DE_LOG.find((c) => c.id === id)?.nome ?? id;
      break;
    }
  }
  if (!t) {
    for (const c of ["nome", "titulo", "title", "username", "organizacao", "setagem", "label", "area", "role", "texto", "descricao"]) {
      const v = texto(r[c]);
      if (v && !v.startsWith("data:")) {
        t = v;
        break;
      }
    }
  }
  return t ? encurtar(t) : null;
}

/* ------------------------------------------------------------------ valores */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** É uma imagem (para mostrar a miniatura em vez do texto)? */
export const ehImagem = (v: unknown): v is string =>
  typeof v === "string" &&
  (v.startsWith("data:image/") || /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?$/i.test(v));

/** Um item de lista em texto (checklist, VIPs, anexos...). */
function itemEmTexto(v: unknown, ctx: ContextoAutoria): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Linha;
    const nome = texto(o["texto"] ?? o["titulo"] ?? o["nome"] ?? o["label"] ?? o["name"] ?? o["title"] ?? o["id"]);
    const feito = typeof o["feito"] === "boolean" ? (o["feito"] ? " ✓" : " ☐") : typeof o["done"] === "boolean" ? (o["done"] ? " ✓" : " ☐") : "";
    if (nome) return `${nome}${feito}`;
    return Object.entries(o)
      .filter(([, x]) => !vazio(x))
      .map(([k, x]) => `${rotuloDoCampo(k)}: ${valorLegivel(k, x, ctx)}`)
      .join(", ");
  }
  return valorLegivel("", v, ctx);
}

/** Um valor do banco em texto completo para o detalhe (pessoas pelo nome, datas e dinheiro bonitos). */
export function valorLegivel(campo: string, v: unknown, ctx: ContextoAutoria): string {
  if (vazio(v)) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return campo === "valor" ? reais(v) : v.toLocaleString("pt-BR");
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "(imagem)";
    if (UUID.test(v)) return ctx.pessoas.get(v) ?? v;
    if (DATA_HORA.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime()))
        return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    if (SO_DATA.test(v)) return v.split("-").reverse().join("/");
    if (campo === "valor") return reais(v) || v;
    return v
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || "—";
  }
  if (Array.isArray(v)) return v.map((x) => itemEmTexto(x, ctx)).join(", ");
  return Object.entries(v as Linha)
    .filter(([, x]) => !vazio(x))
    .map(([k, x]) => `${rotuloDoCampo(k)}: ${valorLegivel(k, x, ctx)}`)
    .join("\n") || "—";
}

/** Para a busca e para o resumo: valor numa linha só, curto. */
export const valorCurto = (campo: string, v: unknown, ctx: ContextoAutoria, n = 48) =>
  encurtar(valorLegivel(campo, v, ctx), n);

/** O texto antigo da tela (mantido para quem ainda usa). */
export function valorEmTexto(v: unknown): string {
  return valorCurto("", v, contextoVazio(), 240);
}

/* ------------------------------------------------------------------ o que mudou */

export interface Mudanca {
  campo: string;
  rotulo: string;
  antes: unknown;
  depois: unknown;
  /** Nas listas: o que entrou e o que saiu. */
  entrou?: string[];
  saiu?: string[];
}

const objeto = (v: unknown): v is Linha => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * As mudanças de uma edição, campo a campo. Dentro de "Configuração VIP" mostra só o que mudou
 * ("Configuração VIP › Salário"); nas listas mostra o que entrou e o que saiu.
 */
export function mudancasDoRegistro(l: RegistroAutoria, ctx: ContextoAutoria): Mudanca[] {
  const lista: Mudanca[] = [];
  const campos =
    l.acao === "UPDATE"
      ? l.campos
      : Object.keys(l.depois ?? l.antes ?? {}).filter((c) => !vazio((l.depois ?? l.antes)?.[c]));
  for (const c of campos) {
    if (CAMPOS_ESCONDIDOS.has(c)) continue;
    const a = l.antes?.[c];
    const d = l.depois?.[c];
    if (l.acao !== "UPDATE") {
      lista.push({ campo: c, rotulo: rotuloDoCampo(c), antes: undefined, depois: l.acao === "DELETE" ? a : d });
      continue;
    }
    if (objeto(a) && objeto(d)) {
      for (const k of [...new Set([...Object.keys(a), ...Object.keys(d)])]) {
        if (igual(a[k], d[k])) continue;
        lista.push({ campo: k, rotulo: `${rotuloDoCampo(c)} › ${rotuloDoCampo(k)}`, antes: a[k], depois: d[k] });
      }
      continue;
    }
    if (Array.isArray(a) || Array.isArray(d)) {
      const ia = (Array.isArray(a) ? a : []).map((x) => itemEmTexto(x, ctx));
      const id = (Array.isArray(d) ? d : []).map((x) => itemEmTexto(x, ctx));
      lista.push({
        campo: c,
        rotulo: rotuloDoCampo(c),
        antes: a,
        depois: d,
        entrou: id.filter((x) => !ia.includes(x)),
        saiu: ia.filter((x) => !id.includes(x)),
      });
      continue;
    }
    lista.push({ campo: c, rotulo: rotuloDoCampo(c), antes: a, depois: d });
  }
  return lista;
}

/** Resumo de uma linha: "Nome 2: — → Rafaella · Telefone 2: — → 000001". */
export function resumoDasMudancas(l: RegistroAutoria, ctx: ContextoAutoria, max = 3): string {
  if (l.acao !== "UPDATE") return "";
  const m = mudancasDoRegistro(l, ctx);
  const partes = m.slice(0, max).map((x) => {
    if (x.entrou || x.saiu) {
      const p = [
        ...(x.entrou ?? []).map((e) => `+ ${encurtar(e, 30)}`),
        ...(x.saiu ?? []).map((s) => `− ${encurtar(s, 30)}`),
      ];
      return `${x.rotulo}: ${p.join(", ") || "reordenado"}`;
    }
    return `${x.rotulo}: ${valorCurto(x.campo, x.antes, ctx, 30)} → ${valorCurto(x.campo, x.depois, ctx, 30)}`;
  });
  if (m.length > max) partes.push(`+${m.length - max} campo${m.length - max > 1 ? "s" : ""}`);
  return partes.join(" · ");
}

/* ------------------------------------------------------------------ busca */

/** Tira acento e deixa minúsculo, para "colombia" achar "Colômbia". */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Todo o texto de uma linha do registro, para a busca por palavra-chave. */
export function textoDeBusca(
  l: RegistroAutoria & { username: string | null },
  ctx: ContextoAutoria,
): string {
  const partes: string[] = [
    l.username ?? "",
    VERBO[l.acao] ?? l.acao,
    abaDaTabela(l.tabela),
    nomeDaTabela(l.tabela),
    tituloDoRegistro(l, ctx) ?? "",
    idDoRegistro(l, ctx) ?? "",
  ];
  for (const m of mudancasDoRegistro(l, ctx)) {
    partes.push(m.rotulo, m.campo, valorLegivel(m.campo, m.antes, ctx), valorLegivel(m.campo, m.depois, ctx));
  }
  return normalizar(partes.join(" \n "));
}

/** Todas as palavras da busca precisam aparecer (em qualquer ordem). */
export function buscaBate(textoNormalizado: string, busca: string): boolean {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  return palavras.every((p) => textoNormalizado.includes(p));
}
