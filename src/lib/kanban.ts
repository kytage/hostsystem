import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getAuthUserData } from "@/lib/auth-cache";

export type Categoria = "normal" | "ilegal" | "urgente" | "carro";
export type Prioridade = "alta" | "media" | "baixa";

/** Colunas fixas do fluxo; desenvolvedores usam o prefixo `dev_` + slug. */
export const COL_SOLICITACOES = "solicitacoes";
export const COL_TESTE = "teste";
export const COL_CONCLUIDO = "concluido";
export const devColuna = (slug: string) => `dev_${slug}`;
export const isDevColuna = (coluna: string) => coluna.startsWith("dev_");

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  normal: "Normal",
  ilegal: "Ilegal",
  urgente: "Urgente / Bugs",
  carro: "Carro",
};

export const STATUS = {
  SOLICITACAO: "SOLICITAÇÃO",
  DESENVOLVIMENTO: "EM DESENVOLVIMENTO",
  TESTE: "EM TESTE",
  CONCLUIDO: "CONCLUÍDO",
} as const;

export const TESTE_OPCOES = [
  "Aguardando teste",
  "Testando",
  "Reprovado",
  "Aprovado",
] as const;

export interface Anexo {
  nome: string;
  url: string;
}

export interface ChecklistItem {
  texto: string;
  feito: boolean;
}

type CardRow = Database["public"]["Tables"]["kanban_cards"]["Row"];
type DevRow = Database["public"]["Tables"]["kanban_devs"]["Row"];

export interface KanbanCard {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  categoria: Categoria;
  prioridade: Prioridade;
  coluna: string;
  status: string;
  testeStatus: string | null;
  responsavel: string;
  criadoPor: string;
  aprovadoPor: string;
  obsDev: string;
  patchTexto: string;
  anexos: Anexo[];
  checklist: ChecklistItem[];
  entrouDevAt: string | null;
  concluidoAt: string | null;
  concluidoPor: string;
  patchnoteGerado: boolean;
  patchnoteId: string | null;
  arquivado: boolean;
  createdAt: string;
}

export interface KanbanDev {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  /** Usuário do sistema dono desta coluna de dev (null = não vinculado). */
  userId: string | null;
}

export interface CardComentario {
  id: string;
  cardId: string;
  autor: string;
  texto: string;
  createdAt: string;
}

export interface CardHistorico {
  id: string;
  cardId: string;
  autor: string;
  deColuna: string;
  paraColuna: string;
  observacao: string;
  createdAt: string;
}

export interface PatchNote {
  id: string;
  numero: number;
  texto: string;
  /** Log de auditoria completo gerado no arquivamento. */
  logTexto: string;
  totalAlteracoes: number;
  geradoPor: string;
  publicadoEm: string;
}


export interface Notificacao {
  id: string;
  texto: string;
  tipo: string;
  lida: boolean;
  createdAt: string;
}

export function rowToCard(r: CardRow): KanbanCard {
  return {
    id: r.id,
    numero: r.numero,
    titulo: r.titulo,
    descricao: r.descricao,
    categoria: r.categoria as Categoria,
    prioridade: r.prioridade as Prioridade,
    coluna: r.coluna,
    status: r.status,
    testeStatus: r.teste_status,
    responsavel: r.responsavel,
    criadoPor: r.criado_por,
    aprovadoPor: r.aprovado_por ?? "",
    obsDev: r.obs_dev,
    patchTexto: r.patch_texto,
    anexos: (r.anexos as unknown as Anexo[]) ?? [],
    checklist: (r.checklist as unknown as ChecklistItem[]) ?? [],
    entrouDevAt: r.entrou_dev_at,
    concluidoAt: r.concluido_at,
    concluidoPor: r.concluido_por,
    patchnoteGerado: r.patchnote_gerado,
    patchnoteId: r.patchnote_id,
    arquivado: r.arquivado,
    createdAt: r.created_at,
  };
}

/** Username do usuário logado (para histórico/notificações). */
export async function getCurrentUsername(): Promise<string> {
  const auth = await getAuthUserData();
  if (!auth.user) return "sistema";
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data?.username ?? "sistema";
}

export async function fetchDevs(): Promise<KanbanDev[]> {
  const { data, error } = await supabase
    .from("kanban_devs")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DevRow[]).map((d) => ({
    id: d.id,
    nome: d.nome,
    slug: d.slug,
    ordem: d.ordem,
    userId: d.user_id ?? null,
  }));
}

export async function addDev(nome: string): Promise<void> {
  const slug = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  const { error } = await supabase
    .from("kanban_devs")
    .insert({ nome: nome.trim(), slug });
  if (error) throw error;
}

/** Vincula (ou desvincula, com null) a coluna de um dev a um usuário do sistema. */
export async function setDevUser(devId: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("kanban_devs")
    .update({ user_id: userId })
    .eq("id", devId);
  if (error) throw error;
}

/** Perfis disponíveis para vincular a uma coluna de dev. */
export async function fetchProfilesBasic(): Promise<{ id: string; username: string }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .order("username", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCards(arquivados = false): Promise<KanbanCard[]> {
  const { data, error } = await supabase
    .from("kanban_cards")
    .select("*")
    .eq("arquivado", arquivados)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CardRow[]).map(rowToCard);
}

export async function createCard(input: {
  titulo: string;
  descricao: string;
  categoria: Categoria;
  prioridade: Prioridade;
  criadoPor: string;
  anexos?: Anexo[];
  obsDev?: string;
  patchTexto?: string;
  checklist?: ChecklistItem[];
}): Promise<string> {
  const { data, error } = await supabase.from("kanban_cards").insert({
    titulo: input.titulo,
    descricao: input.descricao,
    categoria: input.categoria,
    prioridade: input.prioridade,
    criado_por: input.criadoPor,
    coluna: COL_SOLICITACOES,
    status: STATUS.SOLICITACAO,
    anexos: (input.anexos ?? []) as never,
    obs_dev: input.obsDev ?? "",
    patch_texto: input.patchTexto ?? "",
    checklist: (input.checklist ?? []) as never,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function updateCard(
  id: string,
  fields: Partial<{
    titulo: string;
    descricao: string;
    categoria: Categoria;
    prioridade: Prioridade;
    obs_dev: string;
    patch_texto: string;
    teste_status: string | null;
    anexos: Anexo[];
    checklist: ChecklistItem[];
  }>
): Promise<void> {
  const { error } = await supabase
    .from("kanban_cards")
    .update(fields as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from("kanban_cards").delete().eq("id", id);
  if (error) throw error;
}

export function addNotificacao(texto: string, tipo = "info"): void {
  void supabase.from("notificacoes").insert({ texto, tipo }).then(() => undefined);
}

/**
 * Move um card entre colunas aplicando as regras do fluxo:
 * responsável, status, datas, histórico e notificações.
 */
/**
 * Erro de concorrência: o card já havia sido movido por outra pessoa
 * antes desta movimentação chegar ao banco.
 */
export class CardConflitoError extends Error {
  constructor(public readonly atual: KanbanCard) {
    super(
      `"${atual.titulo}" já foi movido por ${atual.responsavel || "outro usuário"}. A lista foi atualizada.`
    );
    this.name = "CardConflitoError";
  }
}

export async function moveCard(
  card: KanbanCard,
  paraColuna: string,
  devs: KanbanDev[],
  autor: string
): Promise<void> {
  if (card.coluna === paraColuna) return;

  // Lê o estado real antes de decidir: a tela do usuário pode estar
  // desatualizada (evento realtime perdido, aba em segundo plano).
  const { data: atualRow, error: readError } = await supabase
    .from("kanban_cards")
    .select("*")
    .eq("id", card.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!atualRow) throw new Error("Card não encontrado — ele pode ter sido arquivado.");

  const atual = rowToCard(atualRow as CardRow);
  if (atual.coluna === paraColuna) return; // outra pessoa já fez o mesmo movimento
  if (atual.coluna !== card.coluna) throw new CardConflitoError(atual);

  const agora = new Date().toISOString();
  const dev = devs.find((d) => devColuna(d.slug) === paraColuna);

  const patch: Record<string, unknown> = { coluna: paraColuna };
  let notificacao: string | null = null;

  if (paraColuna === COL_SOLICITACOES) {
    patch["status"] = STATUS.SOLICITACAO;
    patch["responsavel"] = "";
    patch["teste_status"] = null;
  } else if (dev) {
    patch["status"] = STATUS.DESENVOLVIMENTO;
    patch["responsavel"] = dev.nome;
    patch["teste_status"] = null;
    if (!atual.entrouDevAt) patch["entrou_dev_at"] = agora;
    notificacao = `${dev.nome} recebeu a solicitação "${atual.titulo}".`;
  } else if (paraColuna === COL_TESTE) {
    patch["status"] = STATUS.TESTE;
    patch["teste_status"] = "Aguardando teste";
    notificacao = `${atual.responsavel || autor} enviou "${atual.titulo}" para TESTE.`;
  } else if (paraColuna === COL_CONCLUIDO) {
    patch["status"] = STATUS.CONCLUIDO;
    patch["concluido_at"] = agora;
    // Crédito de conclusão sempre vai para o responsável real do card.
    patch["concluido_por"] = atual.responsavel || autor;
    notificacao = `A solicitação "${atual.titulo}" foi concluída e aguarda Patch Note.`;
  }

  // Update condicional: só aplica se a coluna no banco ainda for a esperada.
  const { data: updated, error } = await supabase
    .from("kanban_cards")
    .update(patch as never)
    .eq("id", card.id)
    .eq("coluna", atual.coluna)
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) {
    // Perdemos a corrida entre a leitura e o update.
    const { data: fresh } = await supabase
      .from("kanban_cards")
      .select("*")
      .eq("id", card.id)
      .maybeSingle();
    throw new CardConflitoError(fresh ? rowToCard(fresh as CardRow) : atual);
  }

  await supabase.from("card_historico").insert({
    card_id: card.id,
    autor,
    de_coluna: atual.coluna,
    para_coluna: paraColuna,
  });

  if (notificacao) addNotificacao(notificacao, "kanban");
}

export async function fetchComentarios(cardId: string): Promise<CardComentario[]> {
  const { data, error } = await supabase
    .from("card_comentarios")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    cardId: c.card_id,
    autor: c.autor,
    texto: c.texto,
    createdAt: c.created_at,
  }));
}

export async function addComentario(
  cardId: string,
  autor: string,
  texto: string
): Promise<void> {
  const { error } = await supabase
    .from("card_comentarios")
    .insert({ card_id: cardId, autor, texto });
  if (error) throw error;
}

export async function fetchHistorico(cardId: string): Promise<CardHistorico[]> {
  const { data, error } = await supabase
    .from("card_historico")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id,
    cardId: h.card_id,
    autor: h.autor,
    deColuna: h.de_coluna,
    paraColuna: h.para_coluna,
    observacao: h.observacao,
    createdAt: h.created_at,
  }));
}

/** Histórico de vários cards de uma vez (ordem cronológica ascendente). */
export async function fetchHistoricoBatch(cardIds: string[]): Promise<CardHistorico[]> {
  if (cardIds.length === 0) return [];

  // A query vai na URL: com muitos IDs o filtro estoura o limite e o Postgres
  // recebe um UUID truncado (erro 22P02). Buscamos em lotes pequenos.
  const TAMANHO_LOTE = 8;
  const lotes: string[][] = [];
  for (let i = 0; i < cardIds.length; i += TAMANHO_LOTE) {
    lotes.push(cardIds.slice(i, i + TAMANHO_LOTE));
  }

  const resultados = await Promise.all(
    lotes.map(async (lote) => {
      const { data, error } = await supabase
        .from("card_historico")
        .select("*")
        .in("card_id", lote)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    })
  );

  return resultados.flat().map((h) => ({
    id: h.id,
    cardId: h.card_id,
    autor: h.autor,
    deColuna: h.de_coluna,
    paraColuna: h.para_coluna,
    observacao: h.observacao,
    createdAt: h.created_at,
  }));
}

/**
 * Monta o log de auditoria textual de um lote de cards arquivados.
 * Inclui solicitante, aprovador, responsável, conclusão e toda a movimentação.
 */
export function montarLogArquivamento(
  cards: KanbanCard[],
  historico: CardHistorico[],
  geradoPor: string
): string {
  const cabecalho = [
    `LOG DE ARQUIVAMENTO — ${new Date().toLocaleString("pt-BR")}`,
    `Arquivado por: ${geradoPor}`,
    `Total de solicitações: ${cards.length}`,
    "",
  ].join("\n");

  const blocos = [...cards]
    .sort((a, b) => a.numero - b.numero)
    .map((c) => {
      const linhas: string[] = [];
      linhas.push(`#${c.numero} — ${c.titulo}`);
      linhas.push(`  Categoria: ${c.categoria} · Prioridade: ${c.prioridade}`);
      if (c.descricao) linhas.push(`  Descrição: ${c.descricao}`);
      linhas.push(`  Criado por: ${c.criadoPor || "—"} em ${fmtDataHora(c.createdAt)}`);
      if (c.aprovadoPor) linhas.push(`  Aprovado por: ${c.aprovadoPor}`);
      linhas.push(`  Responsável: ${c.responsavel || "—"}`);
      if (c.entrouDevAt) linhas.push(`  Entrou em dev: ${fmtDataHora(c.entrouDevAt)}`);
      linhas.push(
        `  Concluído por: ${c.concluidoPor || "—"} em ${fmtDataHora(c.concluidoAt)}`
      );
      if (c.obsDev) linhas.push(`  Obs. dev: ${c.obsDev}`);
      if (c.patchTexto) linhas.push(`  Patch: ${c.patchTexto}`);

      const mov = historico.filter((h) => h.cardId === c.id);
      if (mov.length > 0) {
        linhas.push("  Movimentações:");
        mov.forEach((h) => {
          const obs = h.observacao ? ` — ${h.observacao}` : "";
          linhas.push(
            `    ${fmtDataHora(h.createdAt)} · ${h.autor}: ${h.deColuna} → ${h.paraColuna}${obs}`
          );
        });
      }
      return linhas.join("\n");
    });

  return `${cabecalho}${blocos.join("\n\n")}`;
}


export async function fetchNotificacoes(): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    texto: n.texto,
    tipo: n.tipo,
    lida: n.lida,
    createdAt: n.created_at,
  }));
}

export async function marcarNotificacoesLidas(): Promise<void> {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("lida", false);
  if (error) throw error;
}

export async function limparNotificacoesLidas(): Promise<void> {
  const { error } = await supabase
    .from("notificacoes")
    .delete()
    .eq("lida", true);
  if (error) throw error;
}

export async function fetchPatchNotes(): Promise<PatchNote[]> {
  const { data, error } = await supabase
    .from("patch_notes")
    .select("*")
    .order("numero", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    texto: p.texto,
    logTexto: (p as { log_texto?: string }).log_texto ?? "",
    totalAlteracoes: p.total_alteracoes,
    geradoPor: p.gerado_por,
    publicadoEm: p.publicado_em,
  }));
}

export async function fetchPatchNoteCards(patchnoteId: string): Promise<KanbanCard[]> {
  const { data, error } = await supabase
    .from("kanban_cards")
    .select("*")
    .eq("patchnote_id", patchnoteId)
    .order("numero", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CardRow[]).map(rowToCard);
}

/**
 * Confirma o Patch Note: cria o registro (com log de auditoria),
 * arquiva TODOS os cards concluídos informados e limpa a coluna Concluído.
 */
export async function confirmarPatchNote(input: {
  texto: string;
  /** Cards que compõem os itens do Patch Note. */
  cardIds: string[];
  /** Todos os cards concluídos que devem ser arquivados (>= cardIds). */
  todosCards: KanbanCard[];
  geradoPor: string;
}): Promise<void> {
  // Os IDs vindos do rascunho da IA podem estar truncados/alucinados; só
  // confiamos nos IDs reais dos cards concluídos.
  const idsValidos = new Set(input.todosCards.map((c) => c.id));
  const todosIds = [
    ...new Set([...idsValidos, ...input.cardIds.filter((id) => idsValidos.has(id))]),
  ];

  // Log completo antes de arquivar (histórico de solicitação, autores e datas).
  const historico = await fetchHistoricoBatch(todosIds);
  const logTexto = montarLogArquivamento(input.todosCards, historico, input.geradoPor);

  const { confirmarPatchNoteFn } = await import("./kanban.functions");
  const res = await confirmarPatchNoteFn({
    data: {
      texto: input.texto,
      logTexto,
      cardIds: todosIds,
      totalAlteracoes: input.cardIds.length,
      geradoPor: input.geradoPor,
    },
  });

  addNotificacao(
    `Patch Note publicado por ${input.geradoPor} com ${input.cardIds.length} alterações · ${res.arquivados} solicitações arquivadas.`,
    "patchnote"
  );
}


/** Formata data/hora curta em pt-BR. */
export function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
