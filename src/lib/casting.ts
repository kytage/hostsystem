/**
 * Controle de CASTING — registros visuais (sem conta no painel).
 * Fonte de dados: tabela `casting` no banco (não usa mais planilha).
 */
import { supabase } from "@/integrations/supabase/client";

export interface CastingRow {
  id: string;
  nome: string;
  host_id: string;
  discord_id: string;
  obs: string;
  created_at: string;
}

export interface CastingInput {
  nome: string;
  host_id: string;
  discord_id: string;
  obs: string;
}

export async function listCasting(): Promise<CastingRow[]> {
  const { data, error } = await supabase
    .from("casting")
    .select("id, nome, host_id, discord_id, obs, created_at")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CastingRow[];
}

export async function createCasting(input: CastingInput): Promise<void> {
  const { error } = await supabase.from("casting").insert({
    nome: input.nome.trim(),
    host_id: input.host_id.trim(),
    discord_id: input.discord_id.trim(),
    obs: input.obs.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function updateCasting(id: string, input: CastingInput): Promise<void> {
  const { error } = await supabase
    .from("casting")
    .update({
      nome: input.nome.trim(),
      host_id: input.host_id.trim(),
      discord_id: input.discord_id.trim(),
      obs: input.obs.trim(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCasting(id: string): Promise<void> {
  const { error } = await supabase.from("casting").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
