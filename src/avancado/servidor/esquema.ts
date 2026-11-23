// Tabelas do HOST AVANÇADO (as mesmas do HOST CENTRAL local, com o prefixo avancado_ no banco).
import {
  AREAS,
  AUTOMACAO_STATUS,
  AUTOMACAO_TIPOS,
  CANAIS,
  CONFIANCAS,
  CONTEUDO_FORMATOS,
  CONTEUDO_STATUS,
  ESTILOS,
  ETAPAS,
  EVIDENCIA_CLASSES,
  EXECUCAO_RESULTADOS,
  INTERACAO_TIPOS,
  LEAD_TIPOS,
  MATERIAL_CATEGORIAS,
  MODELO_TIPOS,
  ORIGENS,
  PILARES,
  PLATAFORMAS,
  PRIORIDADES,
  RECORRENCIAS,
  TAREFA_PRIORIDADES,
  TAREFA_STATUS,
  TAREFA_TIPOS,
  TRIAGENS,
} from "@/avancado/shared/dominio";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type TipoColuna = "t" | "t?" | "n" | "n?" | "b" | "ja" | "jo";
export interface DefTabela {
  colunas: Record<string, TipoColuna>;
  padroes?: Record<string, unknown>;
  enums?: Record<string, string[]>;
  obrigatorias?: string[];
  datas?: string[];
  indices?: string[];
  ocultas?: string[];
  pai?: string;
  semAtualizado?: boolean;
  semCriado?: boolean;
  idLivre?: boolean;
}

const ids = (lista: readonly { id: string }[]) => lista.map((o) => o.id);
const ouVazio = (lista: readonly { id: string }[]) => ["", ...ids(lista)];

export const TABELAS: Record<string, DefTabela> = {
  leads: {
    colunas: {
      tipo: "t", nome: "t", descricao: "t", plataforma: "t", links: "ja",
      cidade_atual: "t", cidade_confianca: "t", lider: "t", contato_publico: "t",
      tamanho: "n?", tamanho_texto: "t", tamanho_confianca: "t",
      alcance: "n?", alcance_texto: "t", estilo: "t",
      indicio: "t", indicio_confianca: "t", motivo_host: "t",
      prioridade: "t", origem: "t", etapa: "t", etapa_desde: "t", triagem: "t",
      proximo_passo: "t", ultimo_contato: "t?", proximo_followup: "t?",
      responsavel: "t", observacoes: "t", tags: "ja", alertas: "ja", motivo_perda: "t",
      demo: "b", ordem: "n",
      // técnicas (não saem na API)
      nome_norm: "t", chaves: "ja",
    },
    ocultas: ["nome_norm", "chaves"],
    padroes: {
      tipo: "organizacao", cidade_confianca: "desconhecida", tamanho_confianca: "desconhecida",
      estilo: "desconhecido", indicio_confianca: "desconhecida", prioridade: "media",
      origem: "manual", etapa: "descoberta", triagem: "aprovado",
    },
    enums: {
      tipo: ids(LEAD_TIPOS), plataforma: ouVazio(PLATAFORMAS), cidade_confianca: ids(CONFIANCAS),
      tamanho_confianca: ids(CONFIANCAS), indicio_confianca: ids(CONFIANCAS), estilo: ids(ESTILOS),
      prioridade: ids(PRIORIDADES), origem: ids(ORIGENS), etapa: ids(ETAPAS), triagem: ids(TRIAGENS),
    },
    datas: ["ultimo_contato", "proximo_followup"],
    obrigatorias: ["nome"],
    indices: ["etapa", "triagem", "proximo_followup", "nome_norm"],
  },
  lead_evidencias: {
    colunas: { lead_id: "t", url: "t", data: "t?", descricao: "t", classificacao: "t", verificado: "b", como_verificou: "t" },
    padroes: { classificacao: "fato" },
    enums: { classificacao: ids(EVIDENCIA_CLASSES) },
    datas: ["data"],
    pai: "leads",
    semAtualizado: true,
  },
  lead_contatos: {
    colunas: { lead_id: "t", nome: "t", papel: "t", discord: "t", instagram: "t", outro: "t", notas: "t" },
    pai: "leads",
    semAtualizado: true,
  },
  lead_interacoes: {
    colunas: { lead_id: "t", data: "t", tipo: "t", canal: "t", resumo: "t", autor: "t" },
    padroes: { tipo: "nota" },
    enums: { tipo: ids(INTERACAO_TIPOS), canal: ouVazio(CANAIS) },
    pai: "leads",
    semAtualizado: true,
  },
  conteudos: {
    colunas: {
      titulo: "t", formato: "t", plataformas: "ja", quadro_id: "t?", pilar: "t", status: "t",
      data_planejada: "t?", hora: "t", publicado_em: "t?",
      gancho: "t", cenas: "ja", texto_tela: "ja", narracao: "t", legenda: "t", cta: "t", hashtags: "t",
      material_necessario: "t", arquivos: "ja", responsavel: "t", observacoes: "t", metricas: "jo",
      origem: "t", demo: "b", ordem: "n",
    },
    padroes: { formato: "reels", status: "ideia", origem: "manual" },
    enums: { formato: ids(CONTEUDO_FORMATOS), status: ids(CONTEUDO_STATUS), pilar: ouVazio(PILARES) },
    datas: ["data_planejada", "publicado_em"],
    obrigatorias: ["titulo"],
    indices: ["data_planejada", "status"],
  },
  quadros: {
    colunas: { nome: "t", descricao: "t", formato: "t", frequencia: "t", exemplo: "t", ativo: "b", ordem: "n" },
    padroes: { ativo: true },
    enums: { formato: ouVazio(CONTEUDO_FORMATOS) },
    obrigatorias: ["nome"],
  },
  modelos: {
    colunas: { tipo: "t", titulo: "t", texto: "t", categoria: "t", observacao: "t", ordem: "n" },
    padroes: { tipo: "legenda" },
    enums: { tipo: ids(MODELO_TIPOS) },
    obrigatorias: ["titulo"],
  },
  tarefas: {
    colunas: {
      titulo: "t", notas: "t", tipo: "t", area: "t", prioridade: "t", status: "t", responsavel: "t",
      prazo: "t?", hora: "t", concluida_em: "t?", recorrencia: "t", checklist: "ja", participantes: "t",
      vinculo_tipo: "t", vinculo_id: "t", origem: "t", ordem: "n",
    },
    padroes: { tipo: "tarefa", area: "gestao", prioridade: "media", status: "a_fazer", origem: "manual" },
    enums: {
      tipo: ids(TAREFA_TIPOS), area: ids(AREAS), prioridade: ids(TAREFA_PRIORIDADES),
      status: ids(TAREFA_STATUS), recorrencia: ids(RECORRENCIAS), vinculo_tipo: ["", "lead", "conteudo"],
    },
    datas: ["prazo"],
    obrigatorias: ["titulo"],
    indices: ["status", "prazo"],
  },
  pesquisas: {
    colunas: { data: "t", titulo: "t", consulta: "t", fonte: "t", resumo: "t", links: "ja", achados: "n", origem: "t" },
    padroes: { origem: "manual" },
    datas: ["data"],
    obrigatorias: ["titulo"],
    semAtualizado: true,
  },
  resumos: {
    colunas: { data: "t", titulo: "t", markdown: "t", novos_leads: "n", links: "ja", origem: "t" },
    padroes: { origem: "manual" },
    datas: ["data"],
    obrigatorias: ["titulo"],
    semAtualizado: true,
  },
  novidades: {
    colunas: { data: "t", titulo: "t", resumo: "t", url: "t", fonte: "t", tags: "ja", verificado: "b" },
    datas: ["data"],
    obrigatorias: ["titulo"],
    semAtualizado: true,
  },
  mercado_servidores: {
    colunas: {
      nome: "t", cfx_codigo: "t", concorrente_direto: "b", proprio: "b", site: "t", discord: "t",
      instagram: "t", tiktok: "t", observacoes: "t", ativo: "b", ordem: "n",
    },
    padroes: { ativo: true },
    obrigatorias: ["nome"],
  },
  mercado_amostras: {
    colunas: { servidor_id: "t", coletado_em: "t", online: "n?", slots: "n?", fonte: "t" },
    semAtualizado: true,
    semCriado: true,
  },
  automacoes: {
    colunas: {
      nome: "t", descricao: "t", tipo: "t", frequencia: "t", status: "t", o_que_falta: "t", como_funciona: "t",
      ultima_execucao: "t?", ultimo_resultado: "t", ultimo_resumo: "t", config: "jo", ordem: "n",
    },
    padroes: { tipo: "manual", status: "preparada" },
    enums: { tipo: ids(AUTOMACAO_TIPOS), status: ids(AUTOMACAO_STATUS), ultimo_resultado: ouVazio(EXECUCAO_RESULTADOS) },
    obrigatorias: ["nome"],
    idLivre: true,
  },
  automacao_execucoes: {
    colunas: { automacao_id: "t", iniciado_em: "t", terminado_em: "t?", resultado: "t", resumo: "t", detalhes: "t" },
    padroes: { resultado: "ok" },
    enums: { resultado: ids(EXECUCAO_RESULTADOS) },
    semAtualizado: true,
    semCriado: true,
  },
  materiais: {
    colunas: { titulo: "t", categoria: "t", resumo: "t", markdown: "t", arquivo: "t", fixado: "b", ordem: "n" },
    padroes: { categoria: "outros" },
    enums: { categoria: ids(MATERIAL_CATEGORIAS) },
    obrigatorias: ["titulo"],
    idLivre: true,
  },
};

/** Definição de uma tabela (erro claro se o nome estiver errado). */
export function defDe(tabela: string): DefTabela {
  const def = TABELAS[tabela];
  if (!def) throw new Error(`Tabela desconhecida: ${tabela}`);
  return def;
}
