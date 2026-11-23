/**
 * HOST CENTRAL — formato dos dados que trafegam entre o servidor (API) e a tela.
 * É o CONTRATO: o servidor devolve exatamente estes formatos e a tela consome estes formatos.
 * Datas: "AAAA-MM-DD". Momentos: ISO 8601 em UTC ("2026-11-21T08:30:00.000Z"). Ids: texto.
 * Só sintaxe apagável de TypeScript (o Node importa este arquivo direto).
 */
import type {
  Area,
  AutomacaoStatus,
  AutomacaoTipo,
  Canal,
  Confianca,
  ConteudoFormato,
  ConteudoStatus,
  Estilo,
  EtapaId,
  EvidenciaClasse,
  ExecucaoResultado,
  InteracaoTipo,
  LeadTipo,
  MaterialCategoria,
  ModeloTipo,
  Origem,
  Pilar,
  Plataforma,
  Prioridade,
  Recorrencia,
  TarefaPrioridade,
  TarefaStatus,
  TarefaTipo,
  Triagem,
} from "./dominio.ts";

/* =============== Captação =============== */

export interface LinkDoLead {
  plataforma: Plataforma;
  url: string;
  /** texto livre, ex.: "perfil principal", "Discord da org" */
  rotulo?: string;
  /** resultado da última conferência do link */
  status?: "aberto" | "indexado" | "nao_verificado" | "quebrado";
}

export interface Lead {
  id: string;
  tipo: LeadTipo;
  nome: string;
  descricao: string;
  /** plataforma principal de contato */
  plataforma: Plataforma | "";
  links: LinkDoLead[];
  cidade_atual: string;
  cidade_confianca: Confianca;
  lider: string;
  contato_publico: string;
  /** integrantes (número) — null quando não se sabe */
  tamanho: number | null;
  /** explicação do tamanho, ex.: "≈40 no vídeo de recrutamento" */
  tamanho_texto: string;
  tamanho_confianca: Confianca;
  /** seguidores na maior rede — null quando não se sabe */
  alcance: number | null;
  alcance_texto: string;
  estilo: Estilo;
  /** indício de que procura cidade nova / recruta / está insatisfeita */
  indicio: string;
  indicio_confianca: Confianca;
  /** por que a HOST pode interessar (hipótese de abordagem) */
  motivo_host: string;
  prioridade: Prioridade;
  origem: Origem;
  etapa: EtapaId;
  /** momento em que entrou na etapa atual */
  etapa_desde: string;
  triagem: Triagem;
  proximo_passo: string;
  ultimo_contato: string | null;
  proximo_followup: string | null;
  responsavel: string;
  observacoes: string;
  tags: string[];
  alertas: string[];
  motivo_perda: string;
  /** true = dado de demonstração (nunca misturar com resultado real) */
  demo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
  /** contagens (vêm prontas na listagem) */
  total_evidencias: number;
  total_interacoes: number;
}

export interface Evidencia {
  id: string;
  lead_id: string;
  url: string;
  /** data da postagem/fato, se conhecida */
  data: string | null;
  descricao: string;
  classificacao: EvidenciaClasse;
  verificado: boolean;
  como_verificou: string;
  criado_em: string;
}

export interface ContatoDoLead {
  id: string;
  lead_id: string;
  nome: string;
  /** ex.: "Líder (01)", "Recrutador" */
  papel: string;
  discord: string;
  instagram: string;
  outro: string;
  notas: string;
  criado_em: string;
}

export interface Interacao {
  id: string;
  lead_id: string;
  /** quando aconteceu (ISO) */
  data: string;
  tipo: InteracaoTipo;
  canal: Canal | "";
  resumo: string;
  autor: string;
  criado_em: string;
}

export interface LeadCompleto extends Lead {
  evidencias: Evidencia[];
  contatos: ContatoDoLead[];
  interacoes: Interacao[];
}

/** Corpo para criar/alterar um lead. Na criação só `nome` é obrigatório. */
export type LeadEntrada = Partial<
  Omit<Lead, "id" | "criado_em" | "atualizado_em" | "total_evidencias" | "total_interacoes" | "etapa_desde">
> & {
  /** na criação: evidências já junto */
  evidencias?: Array<Partial<Omit<Evidencia, "id" | "lead_id" | "criado_em">> & { url: string }>;
  contatos?: Array<Partial<Omit<ContatoDoLead, "id" | "lead_id" | "criado_em">>>;
  /** criar mesmo se houver parecido */
  forcar?: boolean;
};

export interface Duplicado {
  id: string;
  nome: string;
  etapa: EtapaId;
  /** por que achamos que é o mesmo, ex.: "mesmo Instagram (@av9oficial)" */
  motivo: string;
}

export interface ResultadoImportacao {
  simulado: boolean;
  novos: Array<{ nome: string; id?: string }>;
  duplicados: Array<{ nome: string; existente: Duplicado }>;
  erros: Array<{ linha: number; erro: string }>;
}

export interface IndicadoresCaptacao {
  total: number;
  /** contagem por etapa, na ordem do funil */
  por_etapa: Array<{ etapa: EtapaId; total: number }>;
  por_prioridade: Array<{ prioridade: Prioridade; total: number }>;
  por_origem: Array<{ origem: Origem; total: number }>;
  por_tipo: Array<{ tipo: LeadTipo; total: number }>;
  /** cidades atuais mais comuns (vazio = "não sei") */
  por_cidade: Array<{ cidade: string; total: number }>;
  novos_7d: number;
  novos_30d: number;
  para_triagem: number;
  followups_atrasados: number;
  followups_hoje: number;
  followups_semana: number;
  /** leads em etapa aberta sem nenhum contato registrado */
  sem_contato: number;
  contatados_30d: number;
  ganhos: number;
  perdidos: number;
  /** ganhos / (ganhos + perdidos), de 0 a 1; null se não houver nenhum fechado */
  taxa_conversao: number | null;
  /** quantos leads entraram por semana nas últimas 8 semanas (mais antiga primeiro) */
  novos_por_semana: Array<{ semana: string; total: number }>;
}

/* =============== Conteúdo =============== */

export interface Cena {
  descricao: string;
  /** ex.: "3s" */
  duracao?: string;
}

export interface ArquivoRef {
  rotulo: string;
  /** caminho no computador ou link */
  caminho: string;
}

export interface Metricas {
  visualizacoes?: number;
  curtidas?: number;
  comentarios?: number;
  compartilhamentos?: number;
  salvamentos?: number;
  link?: string;
}

export interface Conteudo {
  id: string;
  titulo: string;
  formato: ConteudoFormato;
  plataformas: Plataforma[];
  quadro_id: string | null;
  pilar: Pilar | "";
  status: ConteudoStatus;
  data_planejada: string | null;
  /** "HH:MM" ou "" */
  hora: string;
  publicado_em: string | null;
  /** roteiro */
  gancho: string;
  cenas: Cena[];
  texto_tela: string[];
  narracao: string;
  legenda: string;
  cta: string;
  hashtags: string;
  material_necessario: string;
  arquivos: ArquivoRef[];
  responsavel: string;
  observacoes: string;
  metricas: Metricas;
  origem: string;
  demo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}
export type ConteudoEntrada = Partial<Omit<Conteudo, "id" | "criado_em" | "atualizado_em">>;

export interface Quadro {
  id: string;
  nome: string;
  descricao: string;
  formato: ConteudoFormato | "";
  /** ex.: "toda terça" */
  frequencia: string;
  exemplo: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}
export type QuadroEntrada = Partial<Omit<Quadro, "id" | "criado_em" | "atualizado_em">>;

export interface Modelo {
  id: string;
  tipo: ModeloTipo;
  titulo: string;
  /** texto com variáveis entre chaves: {nome_org}, {lider}, {cidade_atual}, {meu_nome} */
  texto: string;
  categoria: string;
  observacao: string;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}
export type ModeloEntrada = Partial<Omit<Modelo, "id" | "criado_em" | "atualizado_em">>;

/* =============== Tarefas =============== */

export interface ItemChecklist {
  texto: string;
  feito: boolean;
}

export interface Tarefa {
  id: string;
  titulo: string;
  notas: string;
  tipo: TarefaTipo;
  area: Area;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  responsavel: string;
  prazo: string | null;
  hora: string;
  concluida_em: string | null;
  recorrencia: Recorrencia;
  /** tarefa: subtarefas · reunião: itens da pauta */
  checklist: ItemChecklist[];
  /** só para reunião */
  participantes: string;
  /** vínculo opcional com um lead ou conteúdo */
  vinculo_tipo: "" | "lead" | "conteudo";
  vinculo_id: string;
  origem: string;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}
export type TarefaEntrada = Partial<Omit<Tarefa, "id" | "criado_em" | "atualizado_em">>;

/* =============== Radar (pesquisas, resumos, mercado) =============== */

export interface LinkSimples {
  rotulo: string;
  url: string;
}

export interface Pesquisa {
  id: string;
  data: string;
  titulo: string;
  /** o que foi buscado */
  consulta: string;
  /** onde: "Instagram", "TikTok", "buscador"... */
  fonte: string;
  resumo: string;
  links: LinkSimples[];
  /** quantas oportunidades saíram daqui */
  achados: number;
  origem: string;
  criado_em: string;
}
export type PesquisaEntrada = Partial<Omit<Pesquisa, "id" | "criado_em">>;

/** Resumo diário do radar. */
export interface Resumo {
  id: string;
  data: string;
  titulo: string;
  markdown: string;
  novos_leads: number;
  links: LinkSimples[];
  origem: string;
  criado_em: string;
}
export type ResumoEntrada = Partial<Omit<Resumo, "id" | "criado_em">>;

export interface Novidade {
  id: string;
  data: string;
  titulo: string;
  resumo: string;
  url: string;
  fonte: string;
  tags: string[];
  verificado: boolean;
  criado_em: string;
}
export type NovidadeEntrada = Partial<Omit<Novidade, "id" | "criado_em">>;

export interface ServidorMercado {
  id: string;
  nome: string;
  /** código do cfx.re/join/<codigo>; vazio se não sabemos */
  cfx_codigo: string;
  concorrente_direto: boolean;
  /** true = é a própria HOST */
  proprio: boolean;
  site: string;
  discord: string;
  instagram: string;
  tiktok: string;
  observacoes: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
  /** última amostra, se houver */
  ultimo_online: number | null;
  ultimo_slots: number | null;
  ultima_coleta: string | null;
}
export type ServidorMercadoEntrada = Partial<
  Omit<ServidorMercado, "id" | "criado_em" | "atualizado_em" | "ultimo_online" | "ultimo_slots" | "ultima_coleta">
>;

export interface AmostraMercado {
  id: string;
  servidor_id: string;
  coletado_em: string;
  online: number | null;
  slots: number | null;
  fonte: string;
}

/* =============== Automações e materiais =============== */

export interface Automacao {
  /** identificador fixo, ex.: "radar-diario" */
  id: string;
  nome: string;
  descricao: string;
  tipo: AutomacaoTipo;
  /** ex.: "todo dia às 9h" */
  frequencia: string;
  status: AutomacaoStatus;
  /** o que falta para ligar (vazio se nada) */
  o_que_falta: string;
  /** explicação em markdown de como funciona e como conferir */
  como_funciona: string;
  ultima_execucao: string | null;
  ultimo_resultado: ExecucaoResultado | "";
  ultimo_resumo: string;
  config: Record<string, unknown>;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}
export type AutomacaoEntrada = Partial<Omit<Automacao, "criado_em" | "atualizado_em">>;

export interface Execucao {
  id: string;
  automacao_id: string;
  iniciado_em: string;
  terminado_em: string | null;
  resultado: ExecucaoResultado;
  resumo: string;
  detalhes: string;
}

export interface Material {
  /** identificador fixo, ex.: "estrategia-captacao" */
  id: string;
  titulo: string;
  categoria: MaterialCategoria;
  resumo: string;
  markdown: string;
  /** arquivo anexo dentro da pasta materiais/ (ex.: "apresentacao-host.pdf"); vazio se não houver */
  arquivo: string;
  fixado: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}
export type MaterialEntrada = Partial<Omit<Material, "criado_em" | "atualizado_em">>;

/* =============== Visão geral e sistema =============== */

export interface Painel {
  /** data de hoje no fuso do computador */
  hoje: string;
  tarefas: {
    atrasadas: number;
    para_hoje: number;
    abertas: number;
    /** até 8: atrasadas e de hoje primeiro, depois por prioridade */
    proximas: Tarefa[];
    decisoes: Tarefa[];
    reunioes: Tarefa[];
  };
  captacao: {
    total_abertos: number;
    por_etapa: Array<{ etapa: EtapaId; total: number }>;
    para_triagem: number;
    novos_7d: number;
    followups_atrasados: number;
    /** até 8 leads com acompanhamento vencido ou para hoje */
    followups: Lead[];
    /** até 6 de prioridade alta ainda sem contato */
    prioridades: Lead[];
  };
  conteudo: {
    por_status: Array<{ status: ConteudoStatus; total: number }>;
    /** próximos 7 dias */
    proximos: Conteudo[];
    planejados_semana: number;
    publicados_semana: number;
    atrasados: number;
  };
  radar: {
    ultimo_resumo: Resumo | null;
    novidades: Novidade[];
  };
  automacoes: Array<Pick<Automacao, "id" | "nome" | "tipo" | "status" | "ultima_execucao" | "ultimo_resultado" | "ultimo_resumo">>;
}

export interface Saude {
  ok: true;
  versao: string;
  banco: string;
  iniciado_em: string;
  /** true quando o painel aceita acesso de outros aparelhos da rede */
  rede_local: boolean;
}

export interface BackupInfo {
  arquivo: string;
  tamanho: number;
  criado_em: string;
}

export interface RegistroHistorico {
  id: string;
  quando: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  resumo: string;
}

/** Resposta padrão de listagem. */
export interface Lista<T> {
  itens: T[];
}
/** Resposta padrão de erro (status 4xx/5xx). */
export interface Erro {
  erro: string;
  /** só em 409 de lead duplicado */
  duplicados?: Duplicado[];
}
