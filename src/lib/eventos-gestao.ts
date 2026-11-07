/**
 * Gestão de Eventos (aba /eventos).
 *
 * Camada de dados isolada da UI: tipos, catálogos (equipes, status, adições,
 * frequência), leitura/escrita no banco, publicação no Cronograma do site e
 * geração de eventos recorrentes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { getAuthUserData } from "@/lib/auth-cache";
import type { EventoTipo } from "@/lib/eventos";
import {
  publicarEventoNoSite,
  removerEventoDoSite,
} from "@/lib/eventos-site.functions";

/* ------------------------------- catálogos ------------------------------- */

export type EquipeKey =
  | "ilegal"
  | "kids"
  | "eventos"
  | "competitive"
  | "policia"
  | "crew"
  | "direcao";

export interface EquipeDef {
  key: EquipeKey;
  label: string;
  emoji: string;
  /** Área correspondente em `user_areas` (para "TODOS DA ÁREA"). */
  area: string;
  style: string;
  /** Tipo usado ao publicar no Cronograma do site. */
  cronogramaTipo: EventoTipo;
}

export const EQUIPES: EquipeDef[] = [
  { key: "ilegal", label: "Ilegal", emoji: "🕵️", area: "ilegal", style: "bg-purple-500/15 text-purple-400 border-purple-500/30", cronogramaTipo: "reuniao_imperio" },
  { key: "kids", label: "Kids", emoji: "🧸", area: "kids", style: "bg-pink-500/15 text-pink-400 border-pink-500/30", cronogramaTipo: "evento_kids" },
  { key: "eventos", label: "Eventos", emoji: "🎉", area: "eventos", style: "bg-primary/15 text-primary border-primary/30", cronogramaTipo: "evento_host" },
  { key: "competitive", label: "Competitive", emoji: "🏆", area: "competitive", style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", cronogramaTipo: "competitive" },
  { key: "policia", label: "Policia", emoji: "👮", area: "policia", style: "bg-blue-500/15 text-blue-400 border-blue-500/30", cronogramaTipo: "evento_host" },
  { key: "crew", label: "Crew", emoji: "🏁", area: "cars", style: "bg-amber-500/15 text-amber-400 border-amber-500/30", cronogramaTipo: "evento_races" },
  { key: "direcao", label: "Direção", emoji: "🎩", area: "direcao", style: "bg-red-500/15 text-red-400 border-red-500/30", cronogramaTipo: "evento_host" },
];

export const EQUIPE_MAP: Record<string, EquipeDef> = Object.fromEntries(
  EQUIPES.map((e) => [e.key, e])
);

export function equipeDef(key: string): EquipeDef {
  return EQUIPE_MAP[key] ?? EQUIPES[2]!;
}

export type EventoStatus = "organizando" | "andamento" | "concluido";

export interface StatusDef {
  key: EventoStatus;
  label: string;
  emoji: string;
  style: string;
}

export const STATUS_LIST: StatusDef[] = [
  { key: "organizando", label: "Organizando (ideia)", emoji: "💡", style: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { key: "andamento", label: "Em andamento", emoji: "⚙️", style: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { key: "concluido", label: "Concluído", emoji: "✅", style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
];

export const STATUS_MAP: Record<string, StatusDef> = Object.fromEntries(
  STATUS_LIST.map((s) => [s.key, s])
);

export function statusDef(key: string): StatusDef {
  return STATUS_MAP[key] ?? STATUS_LIST[0]!;
}

export type AdicaoKey = "mapa" | "ped" | "mod" | "script" | "veiculo";

export const ADICOES: { key: AdicaoKey; label: string; emoji: string }[] = [
  { key: "mapa", label: "Mapa", emoji: "🗺️" },
  { key: "ped", label: "Ped", emoji: "🧍" },
  { key: "mod", label: "Mod", emoji: "🧩" },
  { key: "script", label: "Script", emoji: "📜" },
  { key: "veiculo", label: "Veículo", emoji: "🚗" },
];

export const ADICAO_MAP: Record<string, { key: AdicaoKey; label: string; emoji: string }> =
  Object.fromEntries(ADICOES.map((a) => [a.key, a]));

export type FrequenciaKey = "unico" | "semanal";

export const DIAS_SEMANA = [
  { valor: 0, label: "Domingo" },
  { valor: 1, label: "Segunda" },
  { valor: 2, label: "Terça" },
  { valor: 3, label: "Quarta" },
  { valor: 4, label: "Quinta" },
  { valor: 5, label: "Sexta" },
  { valor: 6, label: "Sábado" },
];

/* --------------------------------- modelo -------------------------------- */

type Row = Database["public"]["Tables"]["eventos_gestao"]["Row"];

export interface StaffRef {
  id: string;
  username: string;
}

export interface EventoGestao {
  id: string;
  nome: string;
  equipe: EquipeKey;
  staff: StaffRef[];
  todosDaArea: boolean;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  premiacao: string;
  informacoes: string;
  anexos: string[];
  status: EventoStatus;
  adicoes: AdicaoKey[];
  solicitacaoBanner: boolean;
  bannerUrl: string;
  frequencia: FrequenciaKey;
  frequenciaDia: number | null;
  frequenciaRepeticoes: number;
  recorrenciaPai: string | null;
  publicadoCronograma: boolean;
  cronogramaEventoId: string | null;
  publicadoDiscord: boolean;
  criadoPor: string;
  criadoPorId: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseStaff(value: unknown): StaffRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const obj = item as Record<string, unknown>;
    const id = typeof obj["id"] === "string" ? obj["id"] : "";
    const username = typeof obj["username"] === "string" ? obj["username"] : "";
    if (!id && !username) return [];
    return [{ id, username }];
  });
}

function parseAnexos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export function mapEventoRow(r: Row): EventoGestao {
  return {
    id: r.id,
    nome: r.nome,
    equipe: (r.equipe as EquipeKey) ?? "eventos",
    staff: parseStaff(r.staff_responsaveis),
    todosDaArea: r.todos_da_area,
    data: r.data_evento,
    horario: (r.horario || "21:00").slice(0, 5),
    premiacao: r.premiacao,
    informacoes: r.informacoes,
    anexos: parseAnexos(r.anexos),
    status: (r.status as EventoStatus) ?? "organizando",
    adicoes: (r.adicoes ?? []) as AdicaoKey[],
    solicitacaoBanner: r.solicitacao_banner,
    bannerUrl: r.banner_url,
    frequencia: (r.frequencia as FrequenciaKey) ?? "unico",
    frequenciaDia: r.frequencia_dia,
    frequenciaRepeticoes: r.frequencia_repeticoes,
    recorrenciaPai: r.recorrencia_pai,
    publicadoCronograma: r.publicado_cronograma,
    cronogramaEventoId: r.cronograma_evento_id,
    publicadoDiscord: r.publicado_discord,
    criadoPor: r.criado_por,
    criadoPorId: r.criado_por_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* --------------------------------- helpers -------------------------------- */

/** Data de hoje (fuso de São Paulo) em YYYY-MM-DD. */
export function hojeISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

/** Combina data (YYYY-MM-DD) + horário (HH:MM) em ISO UTC, assumindo -03:00. */
export function combinarDataHora(data: string, horario: string): string {
  const hora = /^\d{2}:\d{2}$/.test(horario) ? horario : "21:00";
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
}

export function formatarData(data: string): string {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

/** Soma dias a uma data YYYY-MM-DD sem sofrer efeito de fuso. */
function addDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Ajusta a data para o próximo dia da semana desejado (inclusive o próprio). */
function alinharDiaSemana(data: string, dia: number): string {
  const atual = new Date(`${data}T12:00:00Z`).getUTCDay();
  const delta = (dia - atual + 7) % 7;
  return addDias(data, delta);
}

/* --------------------------------- leitura ------------------------------- */

/**
 * Cache de banners em memória (id -> { versão, banner }).
 * Os banners são imagens grandes (~240 KB cada); sem esse cache, toda
 * atualização em tempo real baixava ~12 MB de novo. Agora só baixamos
 * o banner de eventos novos ou alterados (detectado pelo updated_at).
 */
const bannerCache = new Map<string, { versao: string; banner: string }>();

const COLUNAS_SEM_BANNER =
  "id, nome, equipe, staff_responsaveis, todos_da_area, data_evento, horario, premiacao, informacoes, anexos, status, adicoes, solicitacao_banner, frequencia, frequencia_dia, frequencia_repeticoes, recorrencia_pai, publicado_cronograma, cronograma_evento_id, publicado_discord, criado_por, criado_por_id, created_at, updated_at";

export async function fetchEventosGestao(): Promise<EventoGestao[]> {
  const { data, error } = await supabase
    .from("eventos_gestao")
    .select(COLUNAS_SEM_BANNER)
    .order("data_evento", { ascending: false })
    .order("horario", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];

  const faltando = rows
    .filter((r) => bannerCache.get(r.id)?.versao !== r.updated_at)
    .map((r) => r.id);
  if (faltando.length > 0) {
    const { data: banners, error: errB } = await supabase
      .from("eventos_gestao")
      .select("id, banner_url, updated_at")
      .in("id", faltando);
    if (errB) throw errB;
    for (const b of banners ?? []) {
      bannerCache.set(b.id, { versao: b.updated_at, banner: b.banner_url });
    }
  }

  return rows.map((r) =>
    mapEventoRow({ ...r, banner_url: bannerCache.get(r.id)?.banner ?? "" } as Parameters<
      typeof mapEventoRow
    >[0])
  );
}

export interface StaffOption {
  id: string;
  username: string;
  avatarUrl: string;
  areas: string[];
}

/** Lista simples de usuários do painel para selecionar responsáveis. */
export async function fetchStaffOptions(): Promise<StaffOption[]> {
  const [{ data: profiles, error }, { data: areas }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").order("username"),
    supabase.from("user_areas").select("user_id, area"),
  ]);
  if (error) throw error;
  const areaMap = new Map<string, string[]>();
  for (const row of areas ?? []) {
    const list = areaMap.get(row.user_id) ?? [];
    list.push(row.area);
    areaMap.set(row.user_id, list);
  }
  return (profiles ?? [])
    .filter((p) => Boolean(p.username))
    .map((p) => ({
      id: p.id,
      username: p.username,
      avatarUrl: p.avatar_url ?? "",
      areas: areaMap.get(p.id) ?? [],
    }));
}

/* --------------------------------- escrita ------------------------------- */

export interface EventoInput {
  nome: string;
  equipe: EquipeKey;
  staff: StaffRef[];
  todosDaArea: boolean;
  data: string;
  horario: string;
  premiacao: string;
  informacoes: string;
  anexos: string[];
  status: EventoStatus;
  adicoes: AdicaoKey[];
  solicitacaoBanner: boolean;
  bannerUrl: string;
  frequencia: FrequenciaKey;
  frequenciaDia: number | null;
  frequenciaRepeticoes: number;
}

export const EVENTO_INPUT_DEFAULT: EventoInput = {
  nome: "",
  equipe: "eventos",
  staff: [],
  todosDaArea: false,
  data: hojeISO(),
  horario: "21:00",
  premiacao: "",
  informacoes: "",
  anexos: [],
  status: "organizando",
  adicoes: [],
  solicitacaoBanner: false,
  bannerUrl: "",
  frequencia: "unico",
  frequenciaDia: null,
  frequenciaRepeticoes: 0,
};

function toDbPayload(input: EventoInput) {
  return {
    nome: input.nome.trim(),
    equipe: input.equipe,
    staff_responsaveis: input.staff as unknown as Json,
    todos_da_area: input.todosDaArea,
    data_evento: input.data,
    horario: input.horario,
    premiacao: input.premiacao.trim(),
    informacoes: input.informacoes,
    anexos: input.anexos as unknown as Json,
    status: input.status,
    adicoes: input.adicoes,
    solicitacao_banner: input.solicitacaoBanner,
    banner_url: input.bannerUrl,
    frequencia: input.frequencia,
    frequencia_dia: input.frequenciaDia,
    frequencia_repeticoes: input.frequenciaRepeticoes,
  };
}

async function autorAtual(): Promise<{ id: string | null; username: string }> {
  const auth = await getAuthUserData();
  if (!auth.user) return { id: null, username: "" };
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", auth.user.id)
    .maybeSingle();
  return { id: auth.user.id, username: data?.username ?? "" };
}

/**
 * Cria o evento e, quando houver frequência semanal com repetições, gera
 * automaticamente as próximas ocorrências vinculadas ao evento original.
 */
export async function criarEventoGestao(input: EventoInput): Promise<EventoGestao> {
  if (!input.nome.trim()) throw new Error("Informe o nome do evento");
  const autor = await autorAtual();

  const dataBase =
    input.frequencia === "semanal" && input.frequenciaDia !== null
      ? alinharDiaSemana(input.data, input.frequenciaDia)
      : input.data;

  const { data, error } = await supabase
    .from("eventos_gestao")
    .insert({
      ...toDbPayload({ ...input, data: dataBase }),
      criado_por: autor.username,
      criado_por_id: autor.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  const principal = mapEventoRow(data);

  const repeticoes = input.frequencia === "semanal" ? Math.max(0, Math.min(52, input.frequenciaRepeticoes)) : 0;
  if (repeticoes > 0) {
    const extras = Array.from({ length: repeticoes }, (_, i) => ({
      ...toDbPayload({
        ...input,
        data: addDias(dataBase, 7 * (i + 1)),
        frequencia: "semanal" as FrequenciaKey,
        frequenciaRepeticoes: 0,
      }),
      recorrencia_pai: principal.id,
      criado_por: autor.username,
      criado_por_id: autor.id,
    }));
    const { error: errExtras } = await supabase.from("eventos_gestao").insert(extras);
    if (errExtras) throw errExtras;
  }

  return principal;
}

export async function atualizarEventoGestao(id: string, input: EventoInput): Promise<void> {
  if (!input.nome.trim()) throw new Error("Informe o nome do evento");
  const { error } = await supabase.from("eventos_gestao").update(toDbPayload(input)).eq("id", id);
  if (error) throw error;
}

/**
 * Salva apenas o banner do evento (fluxo "Aguardando banner" → "Banner OK").
 * Passar string vazia remove o banner e devolve o evento à fila de espera.
 */
export async function salvarBannerEvento(id: string, bannerUrl: string): Promise<void> {
  const { error } = await supabase
    .from("eventos_gestao")
    .update({ banner_url: bannerUrl })
    .eq("id", id);
  if (error) throw error;
}

export async function atualizarStatusEvento(id: string, status: EventoStatus): Promise<void> {
  const { error } = await supabase.from("eventos_gestao").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function excluirEventoGestao(id: string): Promise<void> {
  const { error } = await supabase.from("eventos_gestao").delete().eq("id", id);
  if (error) throw error;
}

/** Categoria equivalente na agenda pública do site (hostgg.org/eventos). */
const SITE_CATEGORIA: Record<EquipeKey, "ilegal" | "competitive" | "pvp" | "diversao" | "descoberta"> = {
  ilegal: "ilegal",
  competitive: "competitive",
  policia: "pvp",
  kids: "diversao",
  eventos: "diversao",
  crew: "descoberta",
  direcao: "diversao",
};

/** Publica (ou republica) o evento no Cronograma e na agenda do site. */
export async function publicarNoCronograma(evento: EventoGestao): Promise<void> {
  const autor = await autorAtual();
  const inicio = combinarDataHora(evento.data, evento.horario);
  const equipe = equipeDef(evento.equipe);

  const responsaveis = evento.todosDaArea
    ? `Todos da área ${equipe.label}`
    : evento.staff.map((s) => s.username).filter(Boolean).join(", ");

  const descricao = [
    evento.premiacao ? `🏆 Premiação: ${evento.premiacao}` : "",
    responsaveis ? `👥 Responsáveis: ${responsaveis}` : "",
    evento.informacoes,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (evento.cronogramaEventoId) {
    const { error } = await supabase
      .from("eventos")
      .update({
        titulo: evento.nome,
        descricao,
        data_inicio: inicio,
        tipo: equipe.cronogramaTipo,
      })
      .eq("id", evento.cronogramaEventoId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("eventos")
      .insert({
        titulo: evento.nome,
        descricao,
        data_inicio: inicio,
        data_fim: null,
        tipo: equipe.cronogramaTipo,
        criado_por: autor.username,
        criado_por_id: autor.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: errLink } = await supabase
      .from("eventos_gestao")
      .update({ publicado_cronograma: true, cronograma_evento_id: data.id })
      .eq("id", evento.id);
    if (errLink) throw errLink;
  }

  // Agenda pública do site (outro projeto): falha aqui não desfaz o cronograma
  // interno, mas é reportada para o usuário saber que o site não recebeu.
  await publicarEventoNoSite({
    data: {
      externalId: evento.id,
      nome: evento.nome,
      descricao,
      eventAt: inicio,
      local: "",
      responsavel: responsaveis || autor.username,
      categoria: SITE_CATEGORIA[equipe.key] ?? "diversao",
      banner: evento.bannerUrl || "",
    },
  });
}

/** Remove a publicação do Cronograma e da agenda do site. */
export async function despublicarDoCronograma(evento: EventoGestao): Promise<void> {
  if (evento.cronogramaEventoId) {
    await supabase.from("eventos").delete().eq("id", evento.cronogramaEventoId);
  }
  const { error } = await supabase
    .from("eventos_gestao")
    .update({ publicado_cronograma: false, cronograma_evento_id: null })
    .eq("id", evento.id);
  if (error) throw error;

  await removerEventoDoSite({ data: { externalId: evento.id } });
}

/** Texto pronto para publicar no Discord (copiar/colar ou webhook futuro). */
export function textoDiscord(evento: EventoGestao): string {
  const equipe = equipeDef(evento.equipe);
  const responsaveis = evento.todosDaArea
    ? `Todos da área ${equipe.label}`
    : evento.staff.map((s) => s.username).filter(Boolean).join(", ") || "—";
  const adicoes = evento.adicoes.length
    ? evento.adicoes.map((a) => `${ADICAO_MAP[a]?.emoji ?? ""} ${ADICAO_MAP[a]?.label ?? a}`).join(", ")
    : "Não tem";

  return [
    `**${evento.nome.toUpperCase()}**`,
    "",
    `${equipe.emoji} **Equipe:** ${equipe.label}`,
    `👥 **Staff responsável:** ${responsaveis}`,
    `📅 **Data:** ${formatarData(evento.data)}`,
    `🕘 **Horário:** ${evento.horario}`,
    `🏆 **Premiação:** ${evento.premiacao || "—"}`,
    `${statusDef(evento.status).emoji} **Status:** ${statusDef(evento.status).label}`,
    `🧩 **Adições:** ${adicoes}`,
    "",
    evento.informacoes || "",
  ]
    .join("\n")
    .trim();
}
