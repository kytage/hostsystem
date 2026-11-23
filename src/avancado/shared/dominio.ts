/**
 * HOST CENTRAL — vocabulário do sistema (fonte única, usada pelo servidor e pela tela).
 * Só sintaxe "apagável" de TypeScript (sem enum/namespace), porque o Node importa este arquivo direto.
 * Para mudar um nome que aparece na tela, mude aqui.
 */

export interface Opcao<T extends string = string> {
  id: T;
  nome: string;
  /** cor do ponto/etiqueta (hex) — opcional */
  cor?: string;
  /** explicação curta, para dica na tela */
  dica?: string;
}

const op = <T extends string>(lista: readonly Opcao<T>[]) => lista;

/* ---------------- Captação ---------------- */

export const LEAD_TIPOS = op([
  { id: "organizacao", nome: "Organização", dica: "Facção, fac, família ou crew do RP ilegal" },
  { id: "jogador", nome: "Jogador", dica: "Pessoa ou grupo pequeno sem organização" },
  { id: "criador", nome: "Criador de conteúdo", dica: "Streamer, youtuber ou tiktoker" },
  { id: "comunidade", nome: "Comunidade", dica: "Servidor de Discord, grupo ou central de facções" },
] as const);
export type LeadTipo = (typeof LEAD_TIPOS)[number]["id"];

export const PLATAFORMAS = op([
  { id: "discord", nome: "Discord", cor: "#5865F2" },
  { id: "instagram", nome: "Instagram", cor: "#E1306C" },
  { id: "tiktok", nome: "TikTok", cor: "#25F4EE" },
  { id: "youtube", nome: "YouTube", cor: "#FF0000" },
  { id: "twitch", nome: "Twitch", cor: "#9146FF" },
  { id: "kick", nome: "Kick", cor: "#53FC18" },
  { id: "x", nome: "X (Twitter)", cor: "#E7E9EA" },
  { id: "site", nome: "Site", cor: "#A1A1A7" },
  { id: "outro", nome: "Outro", cor: "#A1A1A7" },
] as const);
export type Plataforma = (typeof PLATAFORMAS)[number]["id"];

/** Quanto podemos confiar numa informação. Sempre mostrar na tela, nunca esconder. */
export const CONFIANCAS = op([
  { id: "confirmada", nome: "Confirmado", cor: "#46C37B", dica: "Visto na fonte (link e data)" },
  { id: "estimativa", nome: "Estimativa", cor: "#E8B339", dica: "Calculado ou aproximado" },
  { id: "hipotese", nome: "Hipótese", cor: "#8B8B93", dica: "Suposição, ainda sem prova" },
  { id: "desconhecida", nome: "Não sei", cor: "#5A5A61", dica: "Sem informação" },
] as const);
export type Confianca = (typeof CONFIANCAS)[number]["id"];

export const EVIDENCIA_CLASSES = op([
  { id: "fato", nome: "Fato", cor: "#46C37B", dica: "Está escrito ou mostrado na fonte" },
  { id: "estimativa", nome: "Estimativa", cor: "#E8B339" },
  { id: "hipotese", nome: "Hipótese", cor: "#8B8B93" },
] as const);
export type EvidenciaClasse = (typeof EVIDENCIA_CLASSES)[number]["id"];

/** Mesmo vocabulário do painel da staff (Captações → tipo). */
export const ESTILOS = op([
  { id: "p1_crew", nome: "P1 / Crew" },
  { id: "hibrido", nome: "Híbrido" },
  { id: "pvp", nome: "PvP" },
  { id: "desconhecido", nome: "Não sei" },
] as const);
export type Estilo = (typeof ESTILOS)[number]["id"];

export const PRIORIDADES = op([
  { id: "alta", nome: "Alta", cor: "#CE0E0E" },
  { id: "media", nome: "Média", cor: "#E8B339" },
  { id: "baixa", nome: "Baixa", cor: "#8B8B93" },
] as const);
export type Prioridade = (typeof PRIORIDADES)[number]["id"];

export const ORIGENS = op([
  { id: "pesquisa_inicial", nome: "Pesquisa inicial", dica: "Pesquisa feita na criação do painel" },
  { id: "radar_diario", nome: "Radar diário", dica: "Achado pela pesquisa automática" },
  { id: "manual", nome: "Cadastro manual" },
  { id: "indicacao", nome: "Indicação" },
  { id: "importacao", nome: "Importação" },
  { id: "painel_host", nome: "Painel da staff", dica: "Veio do painel hostgg.dev" },
] as const);
export type Origem = (typeof ORIGENS)[number]["id"];

/**
 * Etapas do funil. `situacao`: aberta (em andamento), ganha ou perdida.
 * `painel_staff`: status equivalente no painel da staff (Captações), para a integração futura.
 */
export interface Etapa extends Opcao {
  situacao: "aberta" | "ganha" | "perdida" | "pausada";
  painel_staff?: string;
}
export const ETAPAS = [
  { id: "descoberta", nome: "Descoberta", cor: "#8B8B93", situacao: "aberta", dica: "Achamos, ainda não avaliamos" },
  { id: "qualificada", nome: "Qualificada", cor: "#5B9DF0", situacao: "aberta", dica: "Vale a pena abordar" },
  { id: "abordagem", nome: "Primeiro contato", cor: "#E8B339", situacao: "aberta", dica: "Mensagem enviada, esperando resposta" },
  { id: "conversa", nome: "Em conversa", cor: "#F08A3C", situacao: "aberta", dica: "Respondeu; conversa ou reunião em andamento" },
  { id: "proposta", nome: "Proposta", cor: "#B58BF5", situacao: "aberta", painel_staff: "pendente / aguardando", dica: "Proposta enviada (segue no painel da staff)" },
  { id: "integracao", nome: "Integração", cor: "#3CC8C8", situacao: "aberta", painel_staff: "aceito", dica: "Aceitou; entrando na cidade" },
  { id: "na_cidade", nome: "Na cidade", cor: "#46C37B", situacao: "ganha", painel_staff: "entregue", dica: "Organização ativa na HOST" },
  { id: "pausada", nome: "Pausada", cor: "#5A5A61", situacao: "pausada", dica: "Retomar depois" },
  { id: "perdida", nome: "Perdida", cor: "#CE0E0E", situacao: "perdida", painel_staff: "negado", dica: "Sem interesse ou negada" },
] as const satisfies readonly Etapa[];
export type EtapaId = (typeof ETAPAS)[number]["id"];

/** Caixa de entrada do radar: o que a pesquisa automática achou e ainda não foi olhado. */
export const TRIAGENS = op([
  { id: "pendente", nome: "Para olhar" },
  { id: "aprovado", nome: "Aprovado" },
  { id: "descartado", nome: "Descartado" },
] as const);
export type Triagem = (typeof TRIAGENS)[number]["id"];

export const INTERACAO_TIPOS = op([
  { id: "nota", nome: "Anotação" },
  { id: "mensagem", nome: "Mensagem enviada" },
  { id: "resposta", nome: "Resposta recebida" },
  { id: "reuniao", nome: "Reunião" },
  { id: "etapa", nome: "Mudança de etapa" },
  { id: "sistema", nome: "Sistema" },
] as const);
export type InteracaoTipo = (typeof INTERACAO_TIPOS)[number]["id"];

export const CANAIS = op([
  { id: "discord", nome: "Discord" },
  { id: "instagram", nome: "Instagram" },
  { id: "tiktok", nome: "TikTok" },
  { id: "whatsapp", nome: "WhatsApp" },
  { id: "na_cidade", nome: "Dentro da cidade" },
  { id: "outro", nome: "Outro" },
] as const);
export type Canal = (typeof CANAIS)[number]["id"];

/* ---------------- Conteúdo ---------------- */

export const CONTEUDO_FORMATOS = op([
  { id: "reels", nome: "Reels" },
  { id: "tiktok", nome: "TikTok" },
  { id: "shorts", nome: "Shorts" },
  { id: "story", nome: "Story" },
  { id: "carrossel", nome: "Carrossel" },
  { id: "corte", nome: "Corte de live" },
  { id: "outro", nome: "Outro" },
] as const);
export type ConteudoFormato = (typeof CONTEUDO_FORMATOS)[number]["id"];

export const CONTEUDO_STATUS = op([
  { id: "ideia", nome: "Ideia", cor: "#8B8B93" },
  { id: "roteiro", nome: "Roteiro", cor: "#5B9DF0" },
  { id: "captacao", nome: "Gravação / clipes", cor: "#E8B339" },
  { id: "edicao", nome: "Edição", cor: "#F08A3C" },
  { id: "revisao", nome: "Revisão", cor: "#B58BF5" },
  { id: "agendado", nome: "Agendado", cor: "#3CC8C8" },
  { id: "publicado", nome: "Publicado", cor: "#46C37B" },
  { id: "arquivado", nome: "Arquivado", cor: "#5A5A61" },
] as const);
export type ConteudoStatus = (typeof CONTEUDO_STATUS)[number]["id"];

export const PILARES = op([
  { id: "humor", nome: "Humor e histórias", cor: "#E8B339", dica: "Momentos engraçados e histórias da cidade" },
  { id: "faccoes", nome: "Facções", cor: "#CE0E0E", dica: "Organizações, guerras, domínio" },
  { id: "eventos", nome: "Eventos", cor: "#F08A3C", dica: "Eventos e competições" },
  { id: "novidades", nome: "Novidades", cor: "#5B9DF0", dica: "Sistemas e atualizações da HOST" },
  { id: "criadores", nome: "Criadores", cor: "#B58BF5", dica: "Criadores de conteúdo e cortes de live" },
  { id: "bastidores", nome: "Bastidores", cor: "#3CC8C8", dica: "Bastidores e curiosidades" },
  { id: "depoimentos", nome: "Depoimentos", cor: "#46C37B", dica: "Experiências de jogadores" },
  { id: "convite", nome: "Convite", cor: "#E7E9EA", dica: "Chamada para conhecer a cidade" },
] as const);
export type Pilar = (typeof PILARES)[number]["id"];

export const MODELO_TIPOS = op([
  { id: "legenda", nome: "Legenda" },
  { id: "cta", nome: "Chamada para ação" },
  { id: "primeiro_contato", nome: "Primeiro contato" },
  { id: "acompanhamento", nome: "Acompanhamento" },
  { id: "resposta", nome: "Resposta" },
  { id: "comunicado", nome: "Comunicado" },
  { id: "outro", nome: "Outro" },
] as const);
export type ModeloTipo = (typeof MODELO_TIPOS)[number]["id"];

/* ---------------- Tarefas ---------------- */

export const TAREFA_TIPOS = op([
  { id: "tarefa", nome: "Tarefa" },
  { id: "decisao", nome: "Decisão", dica: "Algo que só você pode decidir" },
  { id: "reuniao", nome: "Reunião", dica: "Com pauta e participantes" },
  { id: "rotina", nome: "Rotina", dica: "Repete toda semana, dia ou mês" },
] as const);
export type TarefaTipo = (typeof TAREFA_TIPOS)[number]["id"];

export const TAREFA_STATUS = op([
  { id: "a_fazer", nome: "A fazer", cor: "#8B8B93" },
  { id: "fazendo", nome: "Fazendo", cor: "#E8B339" },
  { id: "aguardando", nome: "Aguardando alguém", cor: "#B58BF5" },
  { id: "feito", nome: "Feito", cor: "#46C37B" },
  { id: "cancelado", nome: "Cancelado", cor: "#5A5A61" },
] as const);
export type TarefaStatus = (typeof TAREFA_STATUS)[number]["id"];

export const TAREFA_PRIORIDADES = op([
  { id: "urgente", nome: "Urgente", cor: "#CE0E0E" },
  { id: "alta", nome: "Alta", cor: "#F08A3C" },
  { id: "media", nome: "Média", cor: "#E8B339" },
  { id: "baixa", nome: "Baixa", cor: "#8B8B93" },
] as const);
export type TarefaPrioridade = (typeof TAREFA_PRIORIDADES)[number]["id"];

export const AREAS = op([
  { id: "gestao", nome: "Gestão" },
  { id: "staff", nome: "Staff" },
  { id: "eventos", nome: "Eventos" },
  { id: "marketing", nome: "Marketing" },
  { id: "captacao", nome: "Captação" },
  { id: "organizacoes", nome: "Organizações" },
  { id: "criadores", nome: "Criadores" },
  { id: "desenvolvimento", nome: "Desenvolvimento" },
  { id: "financeiro", nome: "Financeiro" },
  { id: "outros", nome: "Outros" },
] as const);
export type Area = (typeof AREAS)[number]["id"];

export const RECORRENCIAS = op([
  { id: "", nome: "Não repete" },
  { id: "diaria", nome: "Todo dia" },
  { id: "semanal", nome: "Toda semana" },
  { id: "quinzenal", nome: "A cada 15 dias" },
  { id: "mensal", nome: "Todo mês" },
] as const);
export type Recorrencia = (typeof RECORRENCIAS)[number]["id"];

/* ---------------- Radar, automações e materiais ---------------- */

export const AUTOMACAO_TIPOS = op([
  { id: "claude_agendada", nome: "Tarefa agendada do Claude", dica: "Roda sozinha no app do Claude, no horário marcado" },
  { id: "job_interno", nome: "Rotina do painel", dica: "O próprio HOST CENTRAL executa" },
  { id: "skill", nome: "Skill do Claude", dica: "Você pede ao Claude e ele executa" },
  { id: "manual", nome: "Manual", dica: "Passo a passo feito por uma pessoa" },
] as const);
export type AutomacaoTipo = (typeof AUTOMACAO_TIPOS)[number]["id"];

export const AUTOMACAO_STATUS = op([
  { id: "ativa", nome: "Ativa", cor: "#46C37B" },
  { id: "pausada", nome: "Pausada", cor: "#8B8B93" },
  { id: "preparada", nome: "Pronta para ligar", cor: "#E8B339", dica: "Tudo pronto; falta só você ativar" },
  { id: "pendente", nome: "Falta algo", cor: "#CE0E0E", dica: "Depende de um acesso ou decisão" },
] as const);
export type AutomacaoStatus = (typeof AUTOMACAO_STATUS)[number]["id"];

export const EXECUCAO_RESULTADOS = op([
  { id: "ok", nome: "Deu certo", cor: "#46C37B" },
  { id: "parcial", nome: "Parcial", cor: "#E8B339" },
  { id: "erro", nome: "Erro", cor: "#CE0E0E" },
] as const);
export type ExecucaoResultado = (typeof EXECUCAO_RESULTADOS)[number]["id"];

export const MATERIAL_CATEGORIAS = op([
  { id: "relatorio", nome: "Relatórios" },
  { id: "captacao", nome: "Captação" },
  { id: "apresentacao", nome: "Apresentação" },
  { id: "mensagens", nome: "Mensagens" },
  { id: "processo", nome: "Processos" },
  { id: "indicadores", nome: "Indicadores" },
  { id: "redes", nome: "Redes sociais" },
  { id: "outros", nome: "Outros" },
] as const);
export type MaterialCategoria = (typeof MATERIAL_CATEGORIAS)[number]["id"];

/* ---------------- Ajudas ---------------- */

export function nomeDe(lista: readonly Opcao[], id: string | null | undefined): string {
  if (id === null || id === undefined || id === "") return "";
  return lista.find((o) => o.id === id)?.nome ?? String(id);
}
export function corDe(lista: readonly Opcao[], id: string | null | undefined): string | undefined {
  return lista.find((o) => o.id === id)?.cor;
}
export const ids = <T extends string>(lista: readonly Opcao<T>[]): T[] => lista.map((o) => o.id);

/** Etapas em que a negociação ainda está em andamento. */
export const ETAPAS_ABERTAS: EtapaId[] = ETAPAS.filter((e) => e.situacao === "aberta").map((e) => e.id);

/** Tira acentos, símbolos e palavras genéricas: base para achar duplicados por nome. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(oficial|official|ofc|fivem|rp|roleplay|org|fac|faccao|familia|fml|crew|tropa)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "instagram:av9oficial", "tiktok:realbelgica", "discord:abc123"... ou null se o link não for de perfil conhecido. */
export function chaveDoLink(url: string): string | null {
  const u = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.|m\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  let m: RegExpMatchArray | null;
  if ((m = u.match(/^instagram\.com\/([a-z0-9._]+)$/))) return `instagram:${m[1]}`;
  if ((m = u.match(/^tiktok\.com\/@([a-z0-9._]+)/))) return `tiktok:${m[1]}`;
  if ((m = u.match(/^(?:x|twitter)\.com\/([a-z0-9_]+)$/))) return `x:${m[1]}`;
  if ((m = u.match(/^youtube\.com\/(@[a-z0-9._-]+|channel\/[a-z0-9_-]+|c\/[a-z0-9._-]+)/))) return `youtube:${m[1]}`;
  if ((m = u.match(/^twitch\.tv\/([a-z0-9_]+)$/))) return `twitch:${m[1]}`;
  if ((m = u.match(/^kick\.com\/([a-z0-9_-]+)$/))) return `kick:${m[1]}`;
  if ((m = u.match(/^discord\.(?:gg|com\/invite)\/([a-z0-9-]+)/))) return `discord:${m[1]}`;
  return null;
}

/** Todas as chaves de um lead (nome + perfis), usadas para detectar duplicados. */
export function chavesDoLead(nome: string, links: readonly { url: string }[]): string[] {
  const chaves = new Set<string>();
  const n = normalizarNome(nome);
  if (n.length >= 2) chaves.add(`nome:${n}`);
  for (const l of links) {
    const c = chaveDoLink(l.url);
    if (c) chaves.add(c);
  }
  return [...chaves];
}

/** Descobre a plataforma pelo endereço. */
export function plataformaDoLink(url: string): Plataforma {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("discord.gg") || u.includes("discord.com")) return "discord";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("kick.com")) return "kick";
  if (u.includes("twitter.com") || /\/\/(www\.)?x\.com/.test(u)) return "x";
  return "site";
}
