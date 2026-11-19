/**
 * Perfil do player (Painel de Players): regras de exibição que não dependem de onde os dados vêm.
 * - cargo único do topo (emblema), pela prioridade combinada com a direção;
 * - rank HOST por nível (cor + emblema);
 * - grupos com nível ("Police:3", "Police (3)" ou só "Police");
 * - logs do player lidas da mesma tabela da aba /logs.
 */
import { supabase } from "@/integrations/supabase/client";
import { CANAIS_DE_LOG } from "@/lib/logs-servidor";

/** Foto e banner padrão enquanto o servidor não manda a foto do personagem. */
export const FOTO_PADRAO = "/img/player/foto-padrao.png";
export const BANNER_PADRAO = "/img/player/banner-padrao.webp";

/* ------------------------------------------------------------------ cargo / emblema */

export type CargoId =
  | "admin"
  | "streamer"
  | "creator"
  | "boss"
  | "host_ultimate"
  | "ultimate"
  | "baby_ultra"
  | "ultra"
  | "prime"
  | "select"
  | "essencial"
  | "baby";

export interface CargoEmblema {
  id: CargoId;
  /** Nome que aparece no emblema. */
  rotulo: string;
  /** Grupos do jogo que dão este cargo (sem diferenciar maiúsculas). */
  grupos: string[];
  /** Cor do emblema (troque quando chegarem as cores oficiais). */
  cor: string;
  /** Imagem 150x150 do emblema (quando chegar, coloque em /public/img/player/cargos/). */
  imagem: string | null;
}

/** Em ordem de prioridade: o primeiro que o player tiver é o que aparece no topo do perfil. */
export const CARGOS_EMBLEMA: CargoEmblema[] = [
  { id: "admin", rotulo: "ADMIN", grupos: ["Admin"], cor: "#e5231b", imagem: null },
  { id: "streamer", rotulo: "STREAMER", grupos: ["Streamer01", "Streamer02"], cor: "#a855f7", imagem: null },
  { id: "creator", rotulo: "CREATOR", grupos: ["Influencer"], cor: "#ec4899", imagem: null },
  { id: "boss", rotulo: "BOSS EDITION", grupos: ["Boss"], cor: "#f5b301", imagem: null },
  { id: "host_ultimate", rotulo: "HOST ULTIMATE", grupos: ["HostUltimate"], cor: "#ff3b30", imagem: null },
  { id: "ultimate", rotulo: "ULTIMATE", grupos: ["Ultimate"], cor: "#f97316", imagem: null },
  { id: "baby_ultra", rotulo: "BABY ULTRA", grupos: ["BabyUltra"], cor: "#38bdf8", imagem: null },
  { id: "ultra", rotulo: "ULTRA", grupos: ["Ultra"], cor: "#3b82f6", imagem: null },
  { id: "prime", rotulo: "PRIME", grupos: ["Prime"], cor: "#22c55e", imagem: null },
  { id: "select", rotulo: "SELECT", grupos: ["Select"], cor: "#14b8a6", imagem: null },
  { id: "essencial", rotulo: "ESSENCIAL", grupos: ["Essencial"], cor: "#94a3b8", imagem: null },
  { id: "baby", rotulo: "BABY", grupos: ["Doadorbaby"], cor: "#f9a8d4", imagem: null },
];

/** O cargo do topo do perfil (só um), ou null = sem rank. */
export function cargoDoPlayer(grupos: GrupoPlayer[]): CargoEmblema | null {
  const tem = new Set(grupos.map((g) => g.nome.toLowerCase()));
  return CARGOS_EMBLEMA.find((c) => c.grupos.some((g) => tem.has(g.toLowerCase()))) ?? null;
}

/* ------------------------------------------------------------------ rank por nível */

export interface RankNivel {
  /** Nível mínimo (inclusive). */
  min: number;
  /** Nível em que o próximo rank começa (null = último). */
  ate: number | null;
  cor: string;
  imagem: string;
}

const RANK_IMG = "https://i.postimg.cc";
/** RANK HOST — emblemas por nível (cor e imagem 150x150). */
export const RANKS_NIVEL: RankNivel[] = [
  { min: 0, ate: 20, cor: "#CE0F0F", imagem: `${RANK_IMG}/RqrWbMJD/image.png` },
  { min: 20, ate: 30, cor: "#de7021", imagem: `${RANK_IMG}/14x8Y9Vd/20.png` },
  { min: 30, ate: 40, cor: "#edeb16", imagem: `${RANK_IMG}/Jtwsd1Hf/30.png` },
  { min: 40, ate: 50, cor: "#77fb58", imagem: `${RANK_IMG}/6Ts819Gs/40.png` },
  { min: 50, ate: 60, cor: "#9a4894", imagem: `${RANK_IMG}/YjcvypmB/50.png` },
  { min: 60, ate: 70, cor: "#643ca6", imagem: `${RANK_IMG}/NLhKPgrq/60.png` },
  { min: 70, ate: 80, cor: "#486ed3", imagem: `${RANK_IMG}/K4X1sZgb/70.png` },
  { min: 80, ate: 90, cor: "#6dc8d7", imagem: `${RANK_IMG}/Z0kWDTyJ/80.png` },
  { min: 90, ate: 100, cor: "#4a9f30", imagem: `${RANK_IMG}/z3myPJRz/90.png` },
  { min: 100, ate: 150, cor: "#ffffff", imagem: `${RANK_IMG}/WtRdf2Jp/100.png` },
  { min: 150, ate: 200, cor: "#6f6f6f", imagem: `${RANK_IMG}/vTx1z1DR/150.png` },
  { min: 200, ate: 250, cor: "#9f8d6d", imagem: `${RANK_IMG}/XXMrDVB1/200.png` },
  { min: 250, ate: null, cor: "#000000", imagem: `${RANK_IMG}/6Ts81941/250.png` },
];

export function rankDoNivel(level: number): RankNivel {
  const n = Math.max(0, Math.floor(level || 0));
  return [...RANKS_NIVEL].reverse().find((r) => n >= r.min) ?? RANKS_NIVEL[0]!;
}

/** Quanto do rank atual já foi (0 a 1), para a barrinha do nível. */
export function progressoNoRank(level: number): number {
  const r = rankDoNivel(level);
  if (r.ate === null) return 1;
  return Math.min(1, Math.max(0, (level - r.min) / (r.ate - r.min)));
}

/* ------------------------------------------------------------------ grupos */

export interface GrupoPlayer {
  nome: string;
  /** Nível/hierarquia no grupo, quando o servidor mandar. */
  nivel: number | null;
  /** Texto original (o que se copia). */
  bruto: string;
}

/** Aceita "Police", "Police:3", "Police (3)" ou "Police|3". */
export function lerGrupo(bruto: string): GrupoPlayer {
  const t = bruto.trim();
  const m = t.match(/^(.+?)\s*(?::|\||\()\s*(\d{1,3})\s*\)?$/);
  if (m) return { nome: m[1]!.trim(), nivel: Number(m[2]), bruto: t };
  return { nome: t, nivel: null, bruto: t };
}

export const lerGrupos = (lista: string[]) => lista.filter(Boolean).map(lerGrupo);

/* ------------------------------------------------------------------ logs do player */

export interface LogDoPlayer {
  id: number;
  canal: string;
  jogador_id: string | null;
  jogador_nome: string | null;
  mensagem: string;
  dados: unknown;
  criado_em: string;
}

/** Logs do player (pelo ID/passaporte) dos últimos `dias`, da mesma tabela da aba /logs. */
export async function fetchLogsDoPlayer(id: string, dias = 30): Promise<LogDoPlayer[]> {
  const pid = id.trim().replace(/^#/, "");
  if (!/^\d{1,9}$/.test(pid)) return [];
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("server_logs")
    .select("id, canal, jogador_id, jogador_nome, mensagem, dados, criado_em")
    .gte("criado_em", desde)
    // o ID aparece como "#1", "1 - Nome", "Passaporte: 1"... (igual à busca por ID da aba /logs)
    .or(
      [
        `jogador_id.eq.${pid}`,
        `mensagem.ilike.%#${pid} %`,
        `mensagem.ilike.%#${pid}-%`,
        `mensagem.ilike.%: ${pid} -%`,
        `mensagem.ilike.%: #${pid}%`,
        `mensagem.ilike.%: ${pid}\n%`,
      ].join(","),
    )
    .order("criado_em", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as LogDoPlayer[];
}

export interface CategoriaContada {
  id: string;
  nome: string;
  emoji: string;
  total: number;
}

export interface ResumoDeLogs {
  total: number;
  hoje: number;
  ultimos7: number;
  porCategoria: CategoriaContada[];
  /** Últimos 14 dias, do mais antigo para hoje. */
  porDia: { dia: string; rotulo: string; total: number }[];
  antiCheat: number;
  ultima: string | null;
}

const chaveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function categoriaDoCanal(canal: string) {
  const c = CANAIS_DE_LOG.get(canal);
  return {
    id: c?.categoria.id ?? canal.split("/")[0] ?? canal,
    nome: c?.categoria.nome ?? canal.split("/")[0] ?? canal,
    emoji: c?.categoria.emoji ?? "•",
    canal: c?.canal.nome ?? canal.split("/")[1] ?? canal,
  };
}

export function resumirLogs(logs: LogDoPlayer[], agora = new Date()): ResumoDeLogs {
  const hojeK = chaveDia(agora);
  const limite7 = agora.getTime() - 7 * 86_400_000;
  const cats = new Map<string, CategoriaContada>();
  const dias = new Map<string, number>();
  let hoje = 0;
  let ultimos7 = 0;
  let antiCheat = 0;
  for (const l of logs) {
    const d = new Date(l.criado_em);
    const k = chaveDia(d);
    dias.set(k, (dias.get(k) ?? 0) + 1);
    if (k === hojeK) hoje++;
    if (d.getTime() >= limite7) ultimos7++;
    const c = categoriaDoCanal(l.canal);
    if (c.id === "anti-cheat") antiCheat++;
    const atual = cats.get(c.id) ?? { id: c.id, nome: c.nome, emoji: c.emoji, total: 0 };
    atual.total++;
    cats.set(c.id, atual);
  }
  const porDia: ResumoDeLogs["porDia"] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 86_400_000);
    const k = chaveDia(d);
    porDia.push({
      dia: k,
      rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: dias.get(k) ?? 0,
    });
  }
  return {
    total: logs.length,
    hoje,
    ultimos7,
    porCategoria: [...cats.values()].sort((a, b) => b.total - a.total),
    porDia,
    antiCheat,
    ultima: logs[0]?.criado_em ?? null,
  };
}

/* ------------------------------------------------------------------ status e situação */

export type SituacaoId = "banido" | "banido_temp" | "whitelist" | "nolist" | "sem_dado";

export interface Situacao {
  id: SituacaoId;
  rotulo: string;
  detalhe: string | null;
  cor: string;
}

interface BanResumo {
  jogadorId: string;
  ativo: boolean;
  temporario: boolean;
  ate: string | null;
  punicao: string;
  data: string;
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Situação do player: banimento valendo (das Punições) vem primeiro; sem banimento, a whitelist.
 * whitelist null = o servidor ainda não manda essa informação.
 */
export function situacaoDoPlayer(
  passaporte: string | null,
  whitelist: boolean | null,
  banimentos: BanResumo[],
): Situacao {
  const id = passaporte?.trim() ?? "";
  const ativos = id ? banimentos.filter((b) => b.ativo && b.jogadorId === id) : [];
  const permanente = ativos.find((b) => !b.temporario);
  if (permanente)
    return {
      id: "banido",
      rotulo: "Banido",
      detalhe: `${permanente.punicao} desde ${dataCurta(permanente.data)}`,
      cor: "#ef4444",
    };
  const temp = ativos
    .filter((b) => b.temporario)
    .sort((a, b) => (b.ate ?? "").localeCompare(a.ate ?? ""))[0];
  if (temp)
    return {
      id: "banido_temp",
      rotulo: "Banido temporariamente",
      detalhe: temp.ate ? `até ${dataCurta(temp.ate)}` : null,
      cor: "#f97316",
    };
  if (whitelist === true)
    return { id: "whitelist", rotulo: "Whitelist ativa", detalhe: null, cor: "#22c55e" };
  if (whitelist === false)
    return { id: "nolist", rotulo: "NoList", detalhe: "sem whitelist liberada", cor: "#a1a1aa" };
  return {
    id: "sem_dado",
    rotulo: "Whitelist —",
    detalhe: "o servidor ainda não manda a whitelist",
    cor: "#71717a",
  };
}

/** "há 3 h", "há 2 d"... para o último login. */
export function haQuanto(iso: string | null, agora = Date.now()): string {
  if (!iso) return "nunca";
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 60) return `há ${d} d`;
  return `há ${Math.round(d / 30)} meses`;
}

export { dataCurta };

/* ------------------------------------------------------------------ punições do player */

export interface PunicaoDoPlayer {
  punicao: string;
  motivo: string;
  staff: string;
  data: string;
  dias: number | null;
}

/** Punições registradas para o ID do player (para o PDF). */
export async function fetchPunicoesDoPlayer(id: string): Promise<PunicaoDoPlayer[]> {
  const pid = id.trim().replace(/^#/, "");
  if (!pid) return [];
  const { data, error } = await supabase
    .from("punicoes")
    .select("punicao, motivo, staff, data_punicao, dias")
    .eq("jogador_id", pid)
    .order("data_punicao", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    punicao: r.punicao ?? "",
    motivo: r.motivo ?? "",
    staff: r.staff ?? "",
    data: r.data_punicao,
    dias: r.dias ?? null,
  }));
}

/* ------------------------------------------------------------------ horas online */

export interface HorasOnline {
  /** Últimos 14 dias, do mais antigo para hoje (horas com 1 casa). */
  porDia: { dia: string; rotulo: string; horas: number }[];
  horas7: number;
  horas30: number;
  sessoes: number;
  /** Duração média de cada sessão, em horas. */
  mediaSessao: number;
}

const LIMITE_SESSAO_MS = 16 * 3600_000;

/**
 * Sessões a partir das logs de entrada e saída do servidor: a saída (#disconnect) traz o
 * passaporte e a license; a entrada (#connect) traz a license. Cada saída fecha a última entrada
 * antes dela; sessão sem saída (player online) vai até agora.
 */
export function calcularHorasOnline(
  entradas: string[],
  saidas: string[],
  online: boolean,
  agora = new Date(),
): HorasOnline {
  const ev = [
    ...entradas.map((t) => ({ t: new Date(t).getTime(), tipo: "in" as const })),
    ...saidas.map((t) => ({ t: new Date(t).getTime(), tipo: "out" as const })),
  ].sort((a, b) => a.t - b.t);
  const sessoes: [number, number][] = [];
  let aberta: number | null = null;
  for (const e of ev) {
    if (e.tipo === "in") aberta = e.t;
    else if (aberta !== null) {
      sessoes.push([aberta, Math.min(e.t, aberta + LIMITE_SESSAO_MS)]);
      aberta = null;
    }
  }
  if (aberta !== null && online) sessoes.push([aberta, Math.min(agora.getTime(), aberta + LIMITE_SESSAO_MS)]);

  // horas por dia (a sessão que passa da meia-noite é dividida entre os dias)
  const porDiaMs = new Map<string, number>();
  for (const [ini, fim] of sessoes) {
    let a = ini;
    while (a < fim) {
      const d = new Date(a);
      const meiaNoite = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      const b = Math.min(fim, meiaNoite);
      const k = chaveDia(d);
      porDiaMs.set(k, (porDiaMs.get(k) ?? 0) + (b - a));
      a = b;
    }
  }
  const h = (ms: number) => Math.round((ms / 3600_000) * 10) / 10;
  const porDia: HorasOnline["porDia"] = [];
  let ms7 = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 86_400_000);
    const k = chaveDia(d);
    const ms = porDiaMs.get(k) ?? 0;
    if (i < 7) ms7 += ms;
    porDia.push({ dia: k, rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), horas: h(ms) });
  }
  const total = [...porDiaMs.values()].reduce((s, x) => s + x, 0);
  return {
    porDia,
    horas7: h(ms7),
    horas30: h(total),
    sessoes: sessoes.length,
    mediaSessao: sessoes.length ? h(total / sessoes.length) : 0,
  };
}

/** Busca as entradas e saídas do player (30 dias) e calcula as horas online. */
export async function fetchHorasOnline(
  p: { passaporte: string | null; license: string; online: boolean },
  dias = 30,
): Promise<HorasOnline> {
  const pid = p.passaporte?.trim() ?? "";
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data: saidas, error } = pid
    ? await supabase
        .from("server_logs")
        .select("mensagem, criado_em")
        .eq("canal", "infos-players/disconnect")
        .eq("jogador_id", pid)
        .gte("criado_em", desde)
        .order("criado_em", { ascending: true })
        .limit(2000)
    : { data: [], error: null };
  if (error) throw error;
  // a entrada não tem passaporte: acha pela license (das saídas) ou pela Steam da ficha
  const chaves = new Set<string>();
  for (const s of saidas ?? []) {
    const m = s.mensagem.match(/license:([0-9a-f]{20,60})/i);
    if (m) chaves.add(`license:${m[1]!.toLowerCase()}`);
  }
  if (/^1100001[0-9a-f]{8,}$/i.test(p.license)) chaves.add(`steam:${p.license.toLowerCase()}`);
  let entradas: string[] = [];
  if (chaves.size) {
    const { data, error: e2 } = await supabase
      .from("server_logs")
      .select("criado_em")
      .eq("canal", "infos-players/connect")
      .gte("criado_em", desde)
      .or([...chaves].slice(0, 5).map((k) => `mensagem.ilike.%${k}%`).join(","))
      .order("criado_em", { ascending: true })
      .limit(2000);
    if (e2) throw e2;
    entradas = (data ?? []).map((x) => x.criado_em);
  }
  return calcularHorasOnline(
    entradas,
    (saidas ?? []).map((x) => x.criado_em),
    p.online,
  );
}
