import { supabase } from "@/integrations/supabase/client";
import { addNotificacao } from "@/lib/kanban";
import { getAuthUserData } from "@/lib/auth-cache";

export type ColunaTarefa = "pendente" | "andamento" | "concluido";
export type TipoTarefa = "tarefa" | "reuniao";

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  coluna: ColunaTarefa;
  ordem: number;
  createdAt: string;
  designadaPor: string;
  solicitacaoId: string | null;
  tipo: TipoTarefa;
  reuniaoAt: string | null;
  reuniaoConfirmada: boolean;
}

export const COLUNAS_TAREFA: { key: ColunaTarefa; label: string; dot: string }[] = [
  { key: "pendente", label: "Pendente", dot: "bg-warning" },
  { key: "andamento", label: "Em andamento", dot: "bg-primary" },
  { key: "concluido", label: "Concluído", dot: "bg-success" },
];

interface TarefaRow {
  id: string;
  titulo: string;
  descricao: string;
  coluna: string;
  ordem: number;
  created_at: string;
  designada_por: string;
  solicitacao_id: string | null;
  tipo?: string | null;
  reuniao_at?: string | null;
  reuniao_confirmada?: boolean | null;
}

function rowToTarefa(r: TarefaRow): Tarefa {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    coluna: r.coluna as ColunaTarefa,
    ordem: r.ordem,
    createdAt: r.created_at,
    designadaPor: r.designada_por ?? "",
    solicitacaoId: r.solicitacao_id ?? null,
    tipo: (r.tipo as TipoTarefa) ?? "tarefa",
    reuniaoAt: r.reuniao_at ?? null,
    reuniaoConfirmada: r.reuniao_confirmada ?? false,
  };
}

async function myUserId(): Promise<string> {
  const data = await getAuthUserData();
  if (!data.user) throw new Error("Não autenticado");
  return data.user.id;
}

export async function fetchTarefas(): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("tarefas_particulares")
    .select(
      "id, titulo, descricao, coluna, ordem, created_at, designada_por, solicitacao_id, tipo, reuniao_at, reuniao_confirmada"
    )
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TarefaRow[]).map(rowToTarefa);
}

export async function addTarefa(
  titulo: string,
  descricao: string,
  extra?: { tipo?: TipoTarefa; reuniaoAt?: string | null }
): Promise<void> {
  const userId = await myUserId();
  const { error } = await supabase.from("tarefas_particulares").insert({
    user_id: userId,
    titulo,
    descricao,
    coluna: "pendente",
    tipo: extra?.tipo ?? "tarefa",
    reuniao_at: extra?.tipo === "reuniao" ? (extra.reuniaoAt ?? null) : null,
  });
  if (error) throw error;
}

/** Marca a reunião como confirmada — para o alarme sonoro. */
export async function confirmarReuniao(id: string): Promise<void> {
  const { error } = await supabase
    .from("tarefas_particulares")
    .update({ reuniao_confirmada: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Edita uma tarefa particular (título, descrição, tipo e horário da reunião). */
export async function updateTarefa(
  id: string,
  fields: Partial<{
    titulo: string;
    descricao: string;
    tipo: TipoTarefa;
    reuniaoAt: string | null;
  }>
): Promise<void> {
  const payload = {
    updated_at: new Date().toISOString(),
    ...(fields.titulo !== undefined ? { titulo: fields.titulo } : {}),
    ...(fields.descricao !== undefined ? { descricao: fields.descricao } : {}),
    ...(fields.tipo !== undefined ? { tipo: fields.tipo } : {}),
    ...(fields.reuniaoAt !== undefined ? { reuniao_at: fields.reuniaoAt } : {}),
  };

  const { error } = await supabase.from("tarefas_particulares").update(payload).eq("id", id);
  if (error) throw error;
}




/** Designa uma tarefa para outro usuário (cai como pendente no quadro dele). */
export async function designarTarefa(input: {
  titulo: string;
  descricao: string;
  destinatarioId: string;
  designadaPor: string;
}): Promise<void> {
  const { error } = await supabase.from("tarefas_particulares").insert({
    user_id: input.destinatarioId,
    titulo: input.titulo,
    descricao: input.descricao,
    coluna: "pendente",
    designada_por: input.designadaPor,
  });
  if (error) throw error;
  addNotificacao(
    `${input.designadaPor} designou a tarefa "${input.titulo}" para um membro da equipe.`,
    "tarefa"
  );
}

/**
 * Move a tarefa de coluna. Devolve quantas Staff Coins a pessoa ganhou com isso
 * (o banco decide: tarefa recebida de outra pessoa +10, a própria +1, com limites contra spam).
 */
export async function moveTarefa(id: string, coluna: ColunaTarefa): Promise<number> {
  const { error } = await supabase
    .from("tarefas_particulares")
    .update({ coluna, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  let coins = 0;
  if (coluna === "concluido") {
    const { data } = await supabase
      .from("tarefas_particulares")
      .select("coins_recebidas, recompensada_em" as never)
      .eq("id", id)
      .maybeSingle();
    const r = data as { coins_recebidas: number | null; recompensada_em: string | null } | null;
    // só conta se a recompensa acabou de sair (agora há pouco), não de uma conclusão antiga
    if (r?.coins_recebidas && r.recompensada_em && Date.now() - new Date(r.recompensada_em).getTime() < 60_000) {
      coins = r.coins_recebidas;
    }
  }

  // Se a tarefa veio de uma solicitação administrativa, concluir a tarefa
  // conclui a solicitação e notifica quem a criou.
  if (coluna === "concluido") {
    const { data: tarefa } = await supabase
      .from("tarefas_particulares")
      .select("titulo, solicitacao_id")
      .eq("id", id)
      .maybeSingle();
    const row = tarefa as { titulo: string; solicitacao_id: string | null } | null;
    if (row?.solicitacao_id) {
      const { data: sol } = await supabase
        .from("solicitacoes_admin")
        .select("titulo, criado_por")
        .eq("id", row.solicitacao_id)
        .maybeSingle();
      const s = sol as { titulo: string; criado_por: string } | null;
      await supabase
        .from("solicitacoes_admin")
        .update({ status: "concluida" })
        .eq("id", row.solicitacao_id);
      addNotificacao(
        `A solicitação administrativa "${s?.titulo ?? row.titulo}" foi concluída. ${s?.criado_por ? `Criador: ${s.criado_por}.` : ""}`,
        "solicitacao"
      );
    }
  }
  return coins;
}

export async function deleteTarefa(id: string): Promise<void> {
  const { error } = await supabase.from("tarefas_particulares").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAnotacao(): Promise<string> {
  const userId = await myUserId();
  const { data, error } = await supabase
    .from("anotacoes")
    .select("texto")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { texto: string } | null)?.texto ?? "";
}

export async function saveAnotacao(texto: string): Promise<void> {
  const userId = await myUserId();
  const { error } = await supabase
    .from("anotacoes")
    .upsert({ user_id: userId, texto, updated_at: new Date().toISOString() });
  if (error) throw error;
}
