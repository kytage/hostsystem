/**
 * Gestão dos painéis dos líderes pela equipe (aba Ilegal).
 * Usa a sessão do usuário logado: o RLS só libera Coordinator+ e a área Ilegal.
 */
import { supabase } from "@/integrations/supabase/client";
import { gerarCodigo, type Cargo, type OrgMembro } from "@/lib/org-painel-shared";

export interface OrgPainelAdmin {
  id: string;
  nome: string;
  setagem: string;
  lider_nome: string;
  codigo: string;
  link_destino: string;
  ativo: boolean;
  ultimo_acesso: string | null;
  criado_por: string;
  created_at: string;
  membros: OrgMembro[];
}

export interface PainelInput {
  nome: string;
  setagem: string;
  lider_nome: string;
  link_destino: string;
}

const PAGINA = 1000;

/** Todos os membros de todos os painéis (o banco devolve no máximo 1000 linhas por vez). */
async function todosOsMembros() {
  const linhas: (OrgMembro & { painel_id: string })[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("org_membros")
      .select("id, painel_id, nome, discord, passaporte, cargo, slug, visitas, cliques, created_at")
      .order("created_at", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    for (const m of data ?? []) linhas.push({ ...m, cargo: m.cargo as Cargo });
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

export async function fetchPaineis(): Promise<OrgPainelAdmin[]> {
  const [paineis, membros] = await Promise.all([
    supabase
      .from("org_paineis")
      .select("id, nome, setagem, lider_nome, codigo, link_destino, ativo, ultimo_acesso, criado_por, created_at")
      .order("created_at", { ascending: false }),
    todosOsMembros(),
  ]);
  if (paineis.error) throw paineis.error;
  return (paineis.data ?? []).map((p) => ({
    ...p,
    membros: membros.filter((m) => m.painel_id === p.id).map(({ painel_id: _painel, ...m }) => m),
  }));
}

/** Cria o painel já com um código novo e devolve o código para ser enviado ao líder. */
export async function criarPainel(input: PainelInput, criadoPor: string): Promise<{ id: string; codigo: string }> {
  const codigo = gerarCodigo();
  const { data, error } = await supabase
    .from("org_paineis")
    .insert({ ...input, codigo, criado_por: criadoPor })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, codigo };
}

export async function atualizarPainel(id: string, patch: Partial<PainelInput & { ativo: boolean }>): Promise<void> {
  const { error } = await supabase
    .from("org_paineis")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Gera um código novo: o anterior para de funcionar na hora. */
export async function trocarCodigo(id: string): Promise<string> {
  const codigo = gerarCodigo();
  const { error } = await supabase
    .from("org_paineis")
    .update({ codigo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return codigo;
}

/** Exclui o painel e, junto, todos os membros e links de afiliação dele. */
export async function excluirPainel(id: string): Promise<void> {
  const { error } = await supabase.from("org_paineis").delete().eq("id", id);
  if (error) throw error;
}
