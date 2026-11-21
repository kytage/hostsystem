/**
 * As logs do servidor (FiveM), as mesmas categorias e canais do Discord "Host - Logs".
 *
 * Cada canal tem uma chave única ("categoria/canal", por exemplo "dev/upload"): é com ela que o
 * servidor vai mandar cada log para o site, além do Discord. A ordem aqui é a mesma do Discord.
 */

import faccoes from "./logs-ilegal.json";
import mapaDoDiscord from "./logs-discord.json";

export interface CanalDeLog {
  /** Chave única, "categoria/canal". */
  id: string;
  nome: string;
}

export interface CategoriaDeLog {
  id: string;
  nome: string;
  /** Emoji da categoria (só emojis antigos, que aparecem em qualquer aparelho). */
  emoji: string;
  canais: CanalDeLog[];
}

const cat = (id: string, nome: string, emoji: string, canais: string[]): CategoriaDeLog => {
  const vistos = new Map<string, number>();
  return {
    id,
    nome,
    emoji,
    canais: canais.map((c) => {
      // dois canais com o mesmo nome (o Anti-Cheat tem dois "spoofer"): o segundo ganha "-2"
      const n = (vistos.get(c) ?? 0) + 1;
      vistos.set(c, n);
      return { id: `${id}/${n > 1 ? `${c}-${n}` : c}`, nome: n > 1 ? `${c} (2)` : c };
    }),
  };
};

export const CATEGORIAS_DE_LOG: CategoriaDeLog[] = [
  cat("geral", "Sem categoria", "📌", ["moderator-only"]),
  cat("recepcao", "Recepção", "🛬", ["entrou", "solicitar-tag"]),
  cat("dev", "Dev", "💻", [
    "upload",
    "github",
    "debug",
    "buy-skins",
    "itens-ordem",
    "trocas-player",
    "pedscale",
    "skins-arma",
    "tag",
    "remall",
    "scheduler",
    "transferirbau",
    "vevansy",
  ]),
  cat("infos-players", "Infos Players", "🌐", [
    "connect",
    "disconnect",
    "spawn",
    "cl",
    "relatorio-fac",
    "relatorio-police",
    "money-rank",
    "itemadm-vip",
  ]),
  cat("var", "Var", "👻", ["telagem"]),
  cat("anti-cheat", "Anti-Cheat", "🛑", [
    "ban-pl",
    "aimbot",
    "magic-bullet",
    "head-shot",
    "teleport",
    "health2-1",
    "suspeitos",
    "spec",
    "up",
    "spoofer",
    "spoofer",
    "morte",
    "dev-tools",
    "magneto",
    "spawn-vehicle",
    "anti-trigger",
    "speed-suspect",
    "explosão",
    "admin",
    "ban",
    "tela",
    "teleport_vehicle",
    "no_clip",
    "remove_p1",
  ]),
  cat("staffs", "Staff's", "🧱", [
    "crash-copa-lançou",
    "events",
    "wall",
    "nc",
    "kick",
    "ban",
    "wl",
    "unban",
    "unwl",
    "item",
    "itemadm",
    "carregar",
    "dm",
    "tpto",
    "tpway",
    "tptome",
    "tpcds",
    "fome-e-sede",
    "god",
    "god2",
    "group",
    "ungroup",
    "kill",
    "addcar",
    "remcar",
    "car",
    "fix",
    "tuning",
    "dv",
    "slots",
    "editchar",
    "anunciar",
    "skins",
    "insignia",
    "rename",
    "setskin",
    "limpar-inv",
    "reset-ação",
    "amarrar",
    "me",
    "loja-judiciario",
    "pedcsale",
    "hostcoins",
    "pelúcias",
    "turbao",
  ]),
  cat("inventario", "Inventário", "🎒", [
    "usou",
    "lixeira",
    "dropou",
    "pegar-drop",
    "enviou",
    "armamento",
    "munição",
    "revistar",
    "bau",
    "shops",
    "mesa-venda",
  ]),
  cat("players", "Player's", "💉", [
    "gg",
    "cam",
    "death",
    "seguro",
    "anunciar",
    "disparos",
    "cobranças",
    "adrenalina",
    "animações",
    "voltou-ação",
    "desfibrilador",
  ]),
  cat("celular", "Celular", "📱", ["celular"]),
  cat("banco", "Banco", "💳", [
    "pix",
    "sacar",
    "multas",
    "depositar",
    "transferir",
    "movimentações",
  ]),
  cat("empregos", "Empregos", "💼", ["salários", "trabalho"]),
  cat("veiculos", "Veículos", "🚗", [
    "taxas",
    "vendas",
    "compras",
    "impound",
    "porta-mala",
    "teste-driver",
    "transferências",
  ]),
  cat("imobiliaria", "Imobiliária", "🏠", ["compras", "vendas", "taxas", "penhoras", "alterações"]),
  cat("restaurante", "Restaurante", "🍕", [
    "ifood",
    "hasa",
    "frutas",
    "pesca",
    "lixeiro",
    "minerador",
    "trans-host",
    "single-craft",
  ]),
  cat("mecanica", "Mecânica", "🔧", ["tunning-sul", "tunning-norte"]),
  cat("policia", "Polícia", "👮", [
    "spike",
    "smoke",
    "apreender-itens",
    "apreender-carros",
    "masterpick",
    "aviso-interno",
    "anúncios-police",
    "kit-policial",
    "bau-militar",
    "bau-civil",
    "remover-itens",
    "perímetro",
    "perímetro-ff",
    "perímetro-apreensao",
    "aph",
  ]),
  cat("mdt", "MDT", "📋", [
    "mural",
    "porte",
    "ocorrências",
    "prisões",
    "multas",
    "fugas",
    "procurados",
    "hierarquia",
    "licenças",
    "limpeza-ficha",
  ]),
  cat("painel-administrativo", "Painel Administrativo", "📡", [
    "admitir",
    "promoção",
    "rebaixamento",
    "demitir",
    "saques",
    "depositos",
    "comando",
  ]),
  cat("ilegal", "Ilegal", "🕵", [
    "roubos",
    "roubos-npc",
    "drogas-npc",
    "roubos-atm",
    "dominação",
    "desmanche",
    "mercado-imperio",
  ]),
  cat("hospital", "Hospital", "🏥", [
    "gesso",
    "blocklist",
    "chamado",
    "anuncios",
    "resetchar",
    "tratamento",
    "reanimação",
    "gerenciamento",
  ]),
  cat("centro-comercial", "Centro Comercial", "🏬", ["farmácia"]),
  cat("bombeiros", "Bombeiros", "⛑️", ["anúncios", "chamados", "bate-ponto", "reanimações"]),
  cat("races", "Races", "🏁", ["desistiu", "finalizou", "participar"]),
  cat("battle-royale", "Battle Royale", "🔫", [
    "safes",
    "killfeed",
    "equipes",
    "inicializações",
    "espectadores",
    "desclassificações",
    "vitórias",
  ]),
  cat("competitive", "Competitive", "🏆", [
    "log-partidas",
    "criar-time",
    "desafiar",
    "render",
    "spectar",
    "removeu-membro",
    "entrou-no-time",
    "saiu-do-time",
  ]),
  cat("helicrash", "Helicrash", "🚁", [
    "mega-inicializações",
    "inicializações",
    "cancelados",
    "mortes",
    "coleta",
  ]),
  cat("carro-forte", "Carro Forte", "💵", ["inicializações"]),
  cat("painel-de-acoes", "Painel de Ações", "📊", ["criação", "candidatos", "escalados", "status"]),
  cat("host-drop", "Host Drop", "📦", [
    "abertura",
    "daily-reward",
    "mercado-noturno",
    "resgate-veículo",
    "trade",
    "admin",
  ]),
  cat("focus", "Focus", "📸", ["focus"]),
  cat("bancada-de-droga", "Bancada de Droga", "🍬", [
    "venda",
    "mesa-adicionou",
    "mesa-removeu",
    "mesa-deletada",
  ]),
  cat("manager", "Manager", "🏛️", ["manager-audit", "manager-security"]),
  cat("foguete-kids", "Foguete Kids", "🚀", ["foguete-kids"]),
  cat("crashween", "Crashween", "🎃", ["inicio", "coleta", "morte", "delete"]),
  cat("ultimate-series", "Ultimate Series", "🏅", [
    "ranking-pontos",
    "ultimate-eventos",
    "ultimate-equipes",
    "ultimate-agenda",
    "ultimate-novatos",
    "guerra-controle",
    "guerra-resultados",
  ]),
];

/** Emoji de cada tipo de facção do Discord "Host - Ilegal". */
const EMOJI_DA_FACCAO: [RegExp, string][] = [
  [/^armas/i, "🔫"],
  [/^muni/i, "💣"],
  [/^lavagem/i, "💵"],
  [/^contrabando/i, "🔗"],
  [/^droga/i, "🧪"],
  [/^garagem/i, "🚗"],
  [/^hpi/i, "💊"],
];

/** As facções do Discord "Host - Ilegal", cada uma com os seus canais de log (gerado do Discord). */
export const CATEGORIAS_ILEGAL: CategoriaDeLog[] = (
  faccoes as { id: string; nome: string; canais: CanalDeLog[] }[]
).map((f) => ({
  ...f,
  emoji: EMOJI_DA_FACCAO.find(([r]) => r.test(f.nome))?.[1] ?? "🕵",
}));

/** Os dois servidores de log do Discord, cada um com as suas categorias. */
export const SERVIDORES_DE_LOG = [
  { id: "logs", nome: "Host - Logs", categorias: CATEGORIAS_DE_LOG },
  { id: "ilegal", nome: "Host - Ilegal", categorias: CATEGORIAS_ILEGAL },
] as const;
export type ServidorDeLog = (typeof SERVIDORES_DE_LOG)[number]["id"];

/** Todos os canais com a sua categoria e servidor, para achar um canal pela chave. */
/**
 * Canais que agora ficam em outro lugar: o site NÃO puxa nem mostra as logs deles, só o aviso.
 * anti-cheat/aimbot: a log de aimbot passou para um webhook do Discord PRINCIPAL.
 */
export const CANAIS_EM_OUTRO_LUGAR: Record<string, { titulo: string; nota: string }> = {
  "anti-cheat/aimbot": {
    titulo: "Conferir no Discord Principal",
    nota: "A log de aimbot agora vai direto para o Discord Principal. Ela não aparece aqui no site.",
  },
};

export const CANAIS_DE_LOG = new Map(
  SERVIDORES_DE_LOG.flatMap((s) =>
    s.categorias.flatMap((c) =>
      c.canais.map((k) => [k.id, { canal: k, categoria: c, servidor: s.id }] as const),
    ),
  ),
);

export const TOTAL_DE_CANAIS = CANAIS_DE_LOG.size;

/**
 * Qual canal do site recebe a log de cada canal do Discord (pelo número do canal no Discord).
 * O servidor manda a cópia da log com o webhook do Discord; o site descobre o canal do webhook e
 * usa este mapa (src/lib/logs-discord.json, gerado lendo os dois servidores do Discord).
 */
export const CANAL_DO_DISCORD = new Map(Object.entries(mapaDoDiscord as Record<string, string>));
