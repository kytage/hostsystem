import { supabase } from "@/integrations/supabase/client";
import {
  COL_SOLICITACOES,
  STATUS,
  addNotificacao,
  type Categoria,
} from "@/lib/kanban";
import { AREA_LABELS, type AreaKey } from "@/lib/permissions";
import { getAuthUserData } from "@/lib/auth-cache";

export type TipoSolicitacao = "solicitacao" | "report_bug" | "report_car";
export type StatusPendencia = "pendente" | "standby" | "aprovada" | "reprovada";

export interface PendenciaArea {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  area: string;
  tipo: TipoSolicitacao;
  status: StatusPendencia;
  criadoPor: string;
  aprovadoPor: string;
  aprovadoAt: string | null;
  kanbanCardId: string | null;
  anexos: { nome: string; url: string }[];
  createdAt: string;
  /** Comentário da coordenação pedindo mais informações ao autor. */
  obsCoordenacao: string;
  obsPor: string;
  obsAt: string | null;
  obsResolvida: boolean;
}

export interface SolicitacaoAdmin {
  id: string;
  titulo: string;
  descricao: string;
  anexos: { nome: string; url: string }[];
  destinatarioId: string;
  destinatarioNome: string;
  criadoPor: string;
  status: string;
  createdAt: string;
}

export const TIPO_LABEL: Record<TipoSolicitacao, string> = {
  solicitacao: "Solicitação",
  report_bug: "Report Bug",
  report_car: "Report Car",
};

export function areaLabel(area: string): string {
  return (AREA_LABELS as Record<string, string>)[area] ?? area;
}

// ---------- Solicitações de área (pendencias) ----------

type PendRow = {
  id: string;
  title: string;
  description: string;
  priority: string;
  area: string;
  tipo: string;
  status: string;
  criado_por: string;
  aprovado_por: string;
  aprovado_at: string | null;
  kanban_card_id: string | null;
  anexos: { nome: string; url: string }[] | null;
  created_at: string;
  obs_coordenacao: string | null;
  obs_por: string | null;
  obs_at: string | null;
  obs_resolvida: boolean | null;
};

function rowToPendencia(r: PendRow): PendenciaArea {
  return {
    id: r.id,
    titulo: r.title,
    descricao: r.description,
    prioridade: r.priority,
    area: r.area,
    tipo: r.tipo as TipoSolicitacao,
    status: r.status as StatusPendencia,
    criadoPor: r.criado_por,
    aprovadoPor: r.aprovado_por,
    aprovadoAt: r.aprovado_at,
    kanbanCardId: r.kanban_card_id,
    anexos: Array.isArray(r.anexos) ? r.anexos : [],
    createdAt: r.created_at,
    obsCoordenacao: r.obs_coordenacao ?? "",
    obsPor: r.obs_por ?? "",
    obsAt: r.obs_at,
    obsResolvida: r.obs_resolvida ?? false,
  };
}

export async function fetchPendenciasArea(): Promise<PendenciaArea[]> {
  const { data, error } = await supabase
    .from("pendencias")
    .select(
      "id, title, description, priority, area, tipo, status, criado_por, aprovado_por, aprovado_at, kanban_card_id, anexos, created_at, obs_coordenacao, obs_por, obs_at, obs_resolvida"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PendRow[]).map(rowToPendencia);
}

export async function criarSolicitacaoArea(input: {
  titulo: string;
  descricao: string;
  prioridade: string;
  area: AreaKey | "";
  tipo: TipoSolicitacao;
  criadoPor: string;
  anexos?: { nome: string; url: string }[];
}): Promise<void> {
  const { error } = await supabase.from("pendencias").insert({
    title: input.titulo,
    description: input.descricao,
    priority: input.prioridade,
    tag: input.tipo === "solicitacao" ? areaLabel(input.area) : TIPO_LABEL[input.tipo],
    area: input.area,
    tipo: input.tipo,
    criado_por: input.criadoPor,
    anexos: input.anexos ?? [],
    status: "pendente",
  });
  if (error) throw error;
}

function categoriaPara(p: PendenciaArea): Categoria {
  if (p.tipo === "report_bug") return "urgente";
  if (p.tipo === "report_car") return "carro";
  return p.area === "ilegal" ? "ilegal" : "normal";
}

/** Aprova a solicitação: cria o card no quadro de Desenvolvimento e registra histórico. */
export async function aprovarPendencia(
  p: PendenciaArea,
  aprovadoPor: string
): Promise<void> {
  // A info de "quem criou / quem aprovou" agora vive em colunas próprias do card
  // e é exibida no topo do modal — não mais embutida na descrição.
  const { data: card, error } = await supabase
    .from("kanban_cards")
    .insert({
      titulo: p.titulo,
      descricao: p.descricao.trim(),
      categoria: categoriaPara(p),
      prioridade: (p.prioridade || "media") as never,
      criado_por: p.criadoPor || aprovadoPor,
      aprovado_por: aprovadoPor,
      coluna: COL_SOLICITACOES,
      status: STATUS.SOLICITACAO,
      anexos: p.anexos,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: upError } = await supabase
    .from("pendencias")
    .update({
      status: "aprovada",
      aprovado_por: aprovadoPor,
      aprovado_at: new Date().toISOString(),
      kanban_card_id: card.id,
    })
    .eq("id", p.id);
  if (upError) throw upError;

  await supabase.from("card_historico").insert({
    card_id: card.id,
    autor: aprovadoPor,
    de_coluna: "area_manager",
    para_coluna: COL_SOLICITACOES,
    observacao: `Solicitação de ${p.criadoPor || "área"} aprovada por ${aprovadoPor}`,
  });

  addNotificacao(
    `${aprovadoPor} aprovou "${p.titulo}" — enviado para Solicitações do Desenvolvimento.`
  );
}

export async function reprovarPendencia(
  id: string,
  aprovadoPor: string
): Promise<void> {
  const { error } = await supabase
    .from("pendencias")
    .update({ status: "reprovada", aprovado_por: aprovadoPor })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Solicitações Administrativas ----------

type AdmRow = {
  id: string;
  titulo: string;
  descricao: string;
  anexos: { nome: string; url: string }[];
  destinatario_id: string;
  destinatario_nome: string;
  criado_por: string;
  status: string;
  created_at: string;
};

function rowToAdm(r: AdmRow): SolicitacaoAdmin {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    anexos: Array.isArray(r.anexos) ? r.anexos : [],
    destinatarioId: r.destinatario_id,
    destinatarioNome: r.destinatario_nome,
    criadoPor: r.criado_por,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function fetchSolicitacoesAdmin(): Promise<SolicitacaoAdmin[]> {
  const { data, error } = await supabase
    .from("solicitacoes_admin")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AdmRow[]).map(rowToAdm);
}

/** Caixa de entrada: solicitações pendentes destinadas ao usuário logado. */
export async function fetchMinhasSolicitacoesAdmin(): Promise<SolicitacaoAdmin[]> {
  const auth = await getAuthUserData();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("solicitacoes_admin")
    .select("*")
    .eq("destinatario_id", auth.user.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AdmRow[]).map(rowToAdm);
}

export async function criarSolicitacaoAdmin(input: {
  titulo: string;
  descricao: string;
  anexos: { nome: string; url: string }[];
  destinatarioId: string;
  destinatarioNome: string;
  criadoPor: string;
}): Promise<void> {
  const auth = await getAuthUserData();
  const { data: sol, error } = await supabase
    .from("solicitacoes_admin")
    .insert({
      titulo: input.titulo,
      descricao: input.descricao,
      anexos: input.anexos,
      destinatario_id: input.destinatarioId,
      destinatario_nome: input.destinatarioNome,
      criado_por: input.criadoPor,
      criado_por_id: auth.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // A solicitação vira automaticamente uma tarefa particular pendente do destinatário.
  const descricaoTarefa = [
    input.descricao,
    ...input.anexos.map((a) => a.url),
    "",
    `Solicitação administrativa de ${input.criadoPor}`,
  ]
    .filter(Boolean)
    .join("\n");
  await supabase.from("tarefas_particulares").insert({
    user_id: input.destinatarioId,
    titulo: input.titulo,
    descricao: descricaoTarefa,
    coluna: "pendente",
    designada_por: input.criadoPor,
    solicitacao_id: sol.id,
  });

  addNotificacao(
    `${input.criadoPor} enviou uma solicitação administrativa para ${input.destinatarioNome}: "${input.titulo}".`
  );
}


export async function marcarSolicitacaoAdminLida(id: string): Promise<void> {
  const { error } = await supabase
    .from("solicitacoes_admin")
    .update({ status: "lida" })
    .eq("id", id);
  if (error) throw error;
}

/** Exclui uma solicitação de área. Regra de quem pode excluir é aplicada na UI. */
export async function excluirPendencia(id: string): Promise<void> {
  const { error } = await supabase.from("pendencias").delete().eq("id", id);
  if (error) throw error;
}

/** Edita a própria solicitação (apenas enquanto pendente). */
export async function atualizarPendencia(
  id: string,
  fields: { titulo: string; descricao: string; prioridade: string }
): Promise<void> {
  const { error } = await supabase
    .from("pendencias")
    .update({
      title: fields.titulo,
      description: fields.descricao,
      priority: fields.prioridade,
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Move a solicitação para Stand-by (análise futura).
 * A regra de "apenas Coordinator+" é aplicada na UI.
 */
export async function enviarParaStandby(
  id: string,
  quem: string
): Promise<void> {
  const { error } = await supabase
    .from("pendencias")
    .update({ status: "standby", aprovado_por: quem })
    .eq("id", id);
  if (error) throw error;
}

/** Retorna uma solicitação de Stand-by para a fila de pendentes. */
export async function voltarParaPendente(id: string): Promise<void> {
  const { error } = await supabase
    .from("pendencias")
    .update({ status: "pendente", aprovado_por: "" })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Coordenação comenta na solicitação mencionando o autor (falta informação, etc.).
 * O card fica em destaque para o autor editar e o autor recebe notificação.
 */
export async function pedirInformacoes(
  p: PendenciaArea,
  quem: string,
  texto: string
): Promise<void> {
  const comentario = texto.trim();
  if (!comentario) throw new Error("Escreva o que está faltando.");

  const { error } = await supabase
    .from("pendencias")
    .update({
      obs_coordenacao: comentario,
      obs_por: quem,
      obs_at: new Date().toISOString(),
      obs_resolvida: false,
    })
    .eq("id", p.id);
  if (error) throw error;

  addNotificacao(
    `🚨 @${p.criadoPor || "autor"} — ${quem} pediu mais informações em "${p.titulo}": ${comentario}`,
    "pendencia"
  );
}

/** O autor marca o pedido de informações como resolvido (após editar). */
export async function resolverObservacao(id: string): Promise<void> {
  const { error } = await supabase
    .from("pendencias")
    .update({ obs_resolvida: true })
    .eq("id", id);
  if (error) throw error;
}
