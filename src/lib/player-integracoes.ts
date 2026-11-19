/**
 * Integrações do Painel do Player com o servidor do jogo — MODULADAS, AINDA DESLIGADAS.
 *
 * Cada integração tem um lugar fixo aqui. Hoje nenhuma está ligada: o painel mostra os dados que
 * já chegam pelo webhook de players (/api/public/webhook/players) e as logs da aba /logs.
 * Quando for ligar uma, implemente só a função dela (no servidor do site, com checagem de
 * permissão) e troque `ativa` para true. A tela já sabe lidar com as duas situações.
 */
import type { Player } from "@/lib/players";

export type IntegracaoId = "foto" | "comandos" | "inventarioAoVivo" | "garagemAoVivo";

export interface Integracao {
  id: IntegracaoId;
  nome: string;
  descricao: string;
  ativa: boolean;
}

export const INTEGRACOES: Record<IntegracaoId, Integracao> = {
  foto: {
    id: "foto",
    nome: "Foto do personagem",
    descricao: "Headshot do personagem tirado pelo jogo e enviado ao site (hoje só existe no jogo).",
    ativa: false,
  },
  comandos: {
    id: "comandos",
    nome: "Enviar comandos",
    descricao: "Executar comandos de staff no servidor pelo painel (ex.: /god ID).",
    ativa: false,
  },
  inventarioAoVivo: {
    id: "inventarioAoVivo",
    nome: "Inventário ao vivo",
    descricao: "Ler o inventário na hora, direto do servidor, em vez da última cópia enviada.",
    ativa: false,
  },
  garagemAoVivo: {
    id: "garagemAoVivo",
    nome: "Garagem ao vivo",
    descricao: "Ler a garagem na hora, direto do servidor.",
    ativa: false,
  },
};

const NAO_LIGADA = (i: IntegracaoId) =>
  new Error(`A integração "${INTEGRACOES[i].nome}" ainda não está ligada ao servidor.`);

/** Foto do personagem. null = usar a foto padrão. */
export async function fotoDoPlayer(_p: Pick<Player, "passaporte" | "license">): Promise<string | null> {
  if (!INTEGRACOES.foto.ativa) return null;
  throw NAO_LIGADA("foto");
}

/* ------------------------------------------------------------------ comandos */

export interface ComandoRapido {
  id: string;
  rotulo: string;
  /** Modelo do comando: {id} vira o passaporte; o resto a staff completa antes de enviar. */
  modelo: string;
  tom: "normal" | "perigo" | "allowlist";
  emoji: string;
}

/** Comandos fixos do botão de seta (os nomes reais dos comandos se confirmam ao ligar). */
export const COMANDOS_RAPIDOS: ComandoRapido[] = [
  { id: "reviver", rotulo: "Reviver jogador", modelo: "/god {id}", tom: "normal", emoji: "❤️" },
  { id: "kikar", rotulo: "Kikar jogador", modelo: "/kick {id} ", tom: "normal", emoji: "🥾" },
  { id: "consertar", rotulo: "Consertar veículo", modelo: "/fix {id}", tom: "normal", emoji: "🧰" },
  { id: "matar", rotulo: "Matar jogador", modelo: "/kill {id}", tom: "normal", emoji: "🗡️" },
  { id: "nome", rotulo: "Alterar nome", modelo: "/rename {id} ", tom: "normal", emoji: "🪪" },
  { id: "idade", rotulo: "Alterar idade", modelo: "/age {id} ", tom: "normal", emoji: "🪪" },
  { id: "telefone", rotulo: "Alterar telefone", modelo: "/phone {id} ", tom: "normal", emoji: "📱" },
  { id: "add_dinheiro", rotulo: "Adicionar dinheiro", modelo: "/addmoney {id} ", tom: "normal", emoji: "💸" },
  { id: "rem_dinheiro", rotulo: "Remover dinheiro", modelo: "/remmoney {id} ", tom: "normal", emoji: "💸" },
  { id: "set_grupo", rotulo: "Setar grupo", modelo: "/group {id} ", tom: "normal", emoji: "💼" },
  { id: "rem_grupo", rotulo: "Remover grupo", modelo: "/ungroup {id} ", tom: "normal", emoji: "💼" },
  { id: "add_veiculo", rotulo: "Adicionar veículo", modelo: "/addcar {id} ", tom: "normal", emoji: "🚙" },
  { id: "rem_veiculo", rotulo: "Remover veículo", modelo: "/remcar {id} ", tom: "normal", emoji: "🚙" },
  { id: "item", rotulo: "Enviar item", modelo: "/item {id} ", tom: "normal", emoji: "📦" },
  { id: "banir", rotulo: "Banir jogador", modelo: "/ban {id} ", tom: "perigo", emoji: "🔒" },
  { id: "desbanir", rotulo: "Desbanir jogador", modelo: "/unban {id}", tom: "perigo", emoji: "🔓" },
  { id: "allow_set", rotulo: "Setar allowlist", modelo: "/wl {id}", tom: "allowlist", emoji: "📜" },
  { id: "allow_rem", rotulo: "Remover allowlist", modelo: "/unwl {id}", tom: "allowlist", emoji: "📜" },
];

export const montarComando = (c: ComandoRapido, passaporte: string) =>
  c.modelo.replaceAll("{id}", passaporte);

/** Envia um comando ao servidor. Desligado: a última etapa do painel. */
export async function enviarComando(_passaporte: string, _comando: string): Promise<void> {
  if (!INTEGRACOES.comandos.ativa) throw NAO_LIGADA("comandos");
  throw NAO_LIGADA("comandos");
}

/**
 * Whitelist: o painel já mostra "Whitelist ativa" / "NoList" quando o player vier com o campo
 * `whitelist` (true/false). Para ligar: criar a coluna players.whitelist e o webhook de players
 * passar a aceitar esse campo. Enquanto isso, aparece "Whitelist —".
 */
export const WHITELIST_LIGADA = false;
