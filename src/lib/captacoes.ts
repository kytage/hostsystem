import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type CaptacaoUpdate = Database["public"]["Tables"]["captacoes"]["Update"];

/* ================= Tipos ================= */

export type CaptacaoTipo = "p1_crew" | "hibrido" | "pvp";
export type CaptacaoStatus =
  | "pendente"
  | "aguardando"
  | "aceito"
  | "entregue"
  | "negado";

export const TIPO_LABELS: Record<CaptacaoTipo, string> = {
  p1_crew: "P1 / Crew",
  hibrido: "Híbrido",
  pvp: "PvP",
};

export const STATUS_LABELS: Record<CaptacaoStatus, string> = {
  pendente: "Pendente",
  aguardando: "Aguardando resposta",
  aceito: "Aceito / Entregar",
  entregue: "Entregue",
  negado: "Negado",
};

export interface Captacao {
  id: string;
  organizacao: string;
  lider: string;
  contato: string;
  tipo: CaptacaoTipo;
  /** id da setagem no /ilegal (ilegal_orgs.id) quando vinculada */
  setagem: string;
  local: string;
  onlineEsperado: string;
  status: CaptacaoStatus;
  captador: string;
  captadorId: string | null;
  observacao: string;
  proposta: Record<string, unknown>;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaptacaoReuniao {
  id: string;
  captacaoId: string;
  dataHora: string;
  meio: string;
  comQuem: string;
  participantes: string;
  createdAt: string;
}

export interface EstabCategoria {
  id: string;
  nome: string;
  staff: string;
  ordem: number;
}

export type EstabStatus = "livre" | "reservado" | "ocupado" | "desativado";

export const ESTAB_STATUS_LABELS: Record<EstabStatus, string> = {
  livre: "Livre",
  reservado: "Reservado",
  ocupado: "Ocupado",
  desativado: "Desativado",
};

export interface Estabelecimento {
  id: string;
  categoriaId: string;
  nome: string;
  status: EstabStatus;
  observacao: string;
  staff: string;
  ordem: number;
}

export interface NivelModelo {
  titulo: string;
  faixa: string;
  liderancaQtd: string;
  lideranca: string;
  gerenciaQtd: string;
  gerencia: string;
  vipFac: string[];
  vipFacTitulo?: string | undefined;
  vipFacDuracao?: string | undefined;
  camp: string;
  campExtras: string;
  pix: boolean;
}

export interface PixFaixa {
  online: number;
  valor: number;
}

export const NIVEL_VAZIO: NivelModelo = {
  titulo: "",
  faixa: "",
  liderancaQtd: "",
  lideranca: "",
  gerenciaQtd: "",
  gerencia: "",
  vipFac: [],
  camp: "",
  campExtras: "",
  pix: false,
};

/* ================= Captações (pipeline) ================= */

interface CaptacaoRow {
  id: string;
  organizacao: string;
  lider: string;
  contato: string;
  tipo: string;
  setagem: string;
  local: string;
  online_esperado: string;
  status: string;
  captador: string;
  captador_id: string | null;
  observacao: string;
  proposta: unknown;
  ordem: number;
  created_at: string;
  updated_at: string;
}

function rowToCaptacao(r: CaptacaoRow): Captacao {
  return {
    id: r.id,
    organizacao: r.organizacao,
    lider: r.lider,
    contato: r.contato,
    tipo: r.tipo as CaptacaoTipo,
    setagem: r.setagem,
    local: r.local,
    onlineEsperado: r.online_esperado,
    status: r.status as CaptacaoStatus,
    captador: r.captador,
    captadorId: r.captador_id,
    observacao: r.observacao,
    proposta: (r.proposta ?? {}) as Record<string, unknown>,
    ordem: r.ordem,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchCaptacoes(): Promise<Captacao[]> {
  const { data, error } = await supabase
    .from("captacoes")
    .select("*")
    .order("ordem")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as CaptacaoRow[]).map(rowToCaptacao);
}

export interface CaptacaoInput {
  organizacao: string;
  lider: string;
  contato: string;
  tipo: CaptacaoTipo;
  setagem: string;
  local: string;
  onlineEsperado: string;
  status: CaptacaoStatus;
  captador: string;
  captadorId: string | null;
  observacao: string;
}

export async function createCaptacao(input: CaptacaoInput): Promise<void> {
  const { error } = await supabase.from("captacoes").insert({
    organizacao: input.organizacao,
    lider: input.lider,
    contato: input.contato,
    tipo: input.tipo,
    setagem: input.setagem,
    local: input.local,
    online_esperado: input.onlineEsperado,
    status: input.status,
    captador: input.captador,
    captador_id: input.captadorId,
    observacao: input.observacao,
  });
  if (error) throw error;
}

export async function updateCaptacao(
  id: string,
  input: Partial<CaptacaoInput> & { proposta?: Record<string, unknown> },
): Promise<void> {
  const patch: CaptacaoUpdate = {};
  if (input.organizacao !== undefined) patch.organizacao = input.organizacao;
  if (input.lider !== undefined) patch.lider = input.lider;
  if (input.contato !== undefined) patch.contato = input.contato;
  if (input.tipo !== undefined) patch.tipo = input.tipo;
  if (input.setagem !== undefined) patch.setagem = input.setagem;
  if (input.local !== undefined) patch.local = input.local;
  if (input.onlineEsperado !== undefined) patch.online_esperado = input.onlineEsperado;
  if (input.status !== undefined) patch.status = input.status;
  if (input.captador !== undefined) patch.captador = input.captador;
  if (input.captadorId !== undefined) patch.captador_id = input.captadorId;
  if (input.observacao !== undefined) patch.observacao = input.observacao;
  if (input.proposta !== undefined) patch.proposta = input.proposta as Json;
  const { error } = await supabase.from("captacoes").update(patch).eq("id", id);
  if (error) throw error;
}

/** Move de coluna no pipeline, com checagem de concorrência (como no Kanban de Dev). */
export async function moverCaptacao(
  id: string,
  status: CaptacaoStatus,
): Promise<void> {
  const { error } = await supabase
    .from("captacoes")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCaptacao(id: string): Promise<void> {
  const { error } = await supabase.from("captacoes").delete().eq("id", id);
  if (error) throw error;
}

/* ================= Reuniões ================= */

interface ReuniaoRow {
  id: string;
  captacao_id: string;
  data_hora: string;
  meio: string;
  com_quem: string;
  participantes: string;
  created_at: string;
}

export async function fetchReunioes(): Promise<CaptacaoReuniao[]> {
  const { data, error } = await supabase
    .from("captacoes_reunioes")
    .select("*")
    .order("data_hora");
  if (error) throw error;
  return ((data ?? []) as ReuniaoRow[]).map((r) => ({
    id: r.id,
    captacaoId: r.captacao_id,
    dataHora: r.data_hora,
    meio: r.meio,
    comQuem: r.com_quem,
    participantes: r.participantes,
    createdAt: r.created_at,
  }));
}

export async function createReuniao(input: {
  captacaoId: string;
  dataHora: string;
  meio: string;
  comQuem: string;
  participantes: string;
}): Promise<void> {
  const { error } = await supabase.from("captacoes_reunioes").insert({
    captacao_id: input.captacaoId,
    data_hora: input.dataHora,
    meio: input.meio,
    com_quem: input.comQuem,
    participantes: input.participantes,
  });
  if (error) throw error;
}

export async function deleteReuniao(id: string): Promise<void> {
  const { error } = await supabase.from("captacoes_reunioes").delete().eq("id", id);
  if (error) throw error;
}

/* ================= Estabelecimentos (LEGAL) ================= */

export async function fetchEstabCategorias(): Promise<EstabCategoria[]> {
  const { data, error } = await supabase
    .from("captacoes_categorias")
    .select("*")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as EstabCategoria[];
}

export async function createEstabCategoria(nome: string, staff: string): Promise<void> {
  const { error } = await supabase
    .from("captacoes_categorias")
    .insert({ nome, staff, ordem: 99 });
  if (error) throw error;
}

export async function updateEstabCategoria(
  id: string,
  nome: string,
  staff: string,
): Promise<void> {
  const { error } = await supabase
    .from("captacoes_categorias")
    .update({ nome, staff })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEstabCategoria(id: string): Promise<void> {
  const { error } = await supabase
    .from("captacoes_categorias")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchEstabelecimentos(): Promise<Estabelecimento[]> {
  const { data, error } = await supabase
    .from("captacoes_estabelecimentos")
    .select("*")
    .order("ordem")
    .order("created_at");
  if (error) throw error;
  interface EstabRow {
    id: string;
    categoria_id: string;
    nome: string;
    status: string;
    observacao: string;
    staff: string;
    ordem: number;
  }
  return ((data ?? []) as EstabRow[]).map((r) => ({
    id: r.id,
    categoriaId: r.categoria_id,
    nome: r.nome,
    status: r.status as EstabStatus,
    observacao: r.observacao ?? "",
    staff: r.staff ?? "",
    ordem: r.ordem ?? 0,
  }));
}

export async function createEstabelecimento(input: {
  categoriaId: string;
  nome: string;
  status: EstabStatus;
  observacao: string;
  staff: string;
}): Promise<void> {
  const { error } = await supabase.from("captacoes_estabelecimentos").insert({
    categoria_id: input.categoriaId,
    nome: input.nome,
    status: input.status,
    observacao: input.observacao,
    staff: input.staff,
    ordem: 99,
  });
  if (error) throw error;
}

export async function updateEstabelecimento(
  id: string,
  input: Partial<{
    nome: string;
    status: EstabStatus;
    observacao: string;
    staff: string;
    categoriaId: string;
  }>,
): Promise<void> {
  const patch: Database["public"]["Tables"]["captacoes_estabelecimentos"]["Update"] = {};
  if (input.nome !== undefined) patch.nome = input.nome;
  if (input.status !== undefined) patch.status = input.status;
  if (input.observacao !== undefined) patch.observacao = input.observacao;
  if (input.staff !== undefined) patch.staff = input.staff;
  if (input.categoriaId !== undefined) patch.categoria_id = input.categoriaId;
  const { error } = await supabase
    .from("captacoes_estabelecimentos")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEstabelecimento(id: string): Promise<void> {
  const { error } = await supabase
    .from("captacoes_estabelecimentos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ================= Modelos de proposta ================= */

export async function fetchModelos(): Promise<{
  niveis: Record<"nivel_1" | "nivel_2" | "nivel_3", NivelModelo>;
  pix: PixFaixa[];
}> {
  const { data, error } = await supabase.from("captacoes_modelos").select("*");
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key, r.conteudo]));
  const parseNivel = (key: string): NivelModelo => {
    const raw = (map.get(key) ?? {}) as Partial<NivelModelo>;
    return {
      ...NIVEL_VAZIO,
      ...raw,
      vipFac: Array.isArray(raw.vipFac) ? raw.vipFac : [],
    };
  };
  const pixRaw = (map.get("pix") ?? {}) as { faixas?: PixFaixa[] };
  return {
    niveis: {
      nivel_1: parseNivel("nivel_1"),
      nivel_2: parseNivel("nivel_2"),
      nivel_3: parseNivel("nivel_3"),
    },
    pix: Array.isArray(pixRaw.faixas) ? pixRaw.faixas : [],
  };
}

export async function updateModelo(
  key: string,
  conteudo: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("captacoes_modelos")
    .update({ conteudo: conteudo as Json, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}
