/**
 * Registro de autoria: cada mudança feita no site (criar, editar, apagar) vira uma linha em
 * public.registro_autoria, gravada por um gatilho no banco (migração 20261219120000). Aqui ficam
 * os nomes que a tela mostra: de qual aba do site é cada tabela e como chamar cada campo.
 */

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

/** O que é cada tabela, em poucas palavras (aparece no cartão: "editou … em Ilegal"). */
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

/** Campos que dão nome ao registro, na ordem de preferência. */
const CAMPOS_DE_NOME = [
  "nome",
  "titulo",
  "title",
  "username",
  "nome_org",
  "label",
  "area",
  "role",
  "texto",
  "descricao",
];

/** Um nome curto para o registro mudado ("Fulano", "Card de login"...). */
export function nomeDoRegistro(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): string | null {
  for (const c of CAMPOS_DE_NOME) {
    const v = (depois?.[c] ?? antes?.[c]) as unknown;
    if (typeof v === "string" && v.trim()) {
      const t = v
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (t.startsWith("data:")) continue;
      return t.length > 70 ? `${t.slice(0, 70)}…` : t;
    }
  }
  return null;
}

/** Um valor do banco em texto para a tela (curto; imagens e textos enormes viram aviso). */
export function valorEmTexto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "(imagem)";
    const t = v
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return t.length > 240 ? `${t.slice(0, 240)}…` : t || "—";
  }
  const j = JSON.stringify(v);
  return j.length > 240 ? `${j.slice(0, 240)}…` : j;
}

/** Campos que não interessam mostrar no detalhe. */
export const CAMPOS_ESCONDIDOS = new Set([
  "id",
  "created_at",
  "updated_at",
  "criado_em",
  "atualizado_em",
  "last_seen_at",
]);
