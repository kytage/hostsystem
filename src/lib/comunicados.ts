/**
 * Sino do topo: avisos e tarefas direcionados (migração 20261227120000). Coordinator+ envia para
 * todos, cargos, áreas ou staffs escolhidos; quem recebe confirma a leitura (e marca a tarefa como
 * feita). O banco só mostra a cada staff o que é para ele (RLS + public.comunicado_e_para).
 */
import { supabase } from "@/integrations/supabase/client";
import { ROLE_ORDER, roleRank } from "@/lib/roles";

export type TipoComunicado = "aviso" | "tarefa";
export type Prioridade = "normal" | "importante" | "urgente";
export type Publico = "todos" | "cargos" | "areas" | "pessoas";

export interface Comunicado {
  id: string;
  tipo: TipoComunicado;
  titulo: string;
  texto: string | null;
  prioridade: Prioridade;
  publico: Publico;
  cargos: string[];
  areas: string[];
  pessoas: string[];
  som: boolean;
  exige_leitura: boolean;
  prazo: string | null;
  arquivado: boolean;
  criado_por: string | null;
  criado_por_id: string | null;
  created_at: string;
}

export interface Leitura {
  comunicado_id: string;
  user_id: string;
  username: string | null;
  lido_em: string;
  concluido_em: string | null;
}

/** O mínimo da equipe para saber quem recebe (vem de listEquipeAreas). */
export interface MembroEquipe {
  id: string;
  username: string;
  avatar_url?: string;
  role: string;
  areas: string[];
}

export const PRIORIDADES: { id: Prioridade; rotulo: string; cor: string }[] = [
  { id: "normal", rotulo: "Normal", cor: "#8a8f98" },
  { id: "importante", rotulo: "Importante", cor: "#f2b23a" },
  { id: "urgente", rotulo: "Urgente", cor: "#ff4b3e" },
];

/** Coordinator ou acima envia avisos pelo sino. */
export const podeEnviarComunicado = (role: string | null | undefined) =>
  !!role && roleRank(role) <= roleRank("coordinator");

/** O comunicado é para este membro? (mesma regra do banco) */
export function ehPara(c: Pick<Comunicado, "publico" | "cargos" | "areas" | "pessoas">, m: MembroEquipe): boolean {
  switch (c.publico) {
    case "todos":
      return true;
    case "cargos":
      return c.cargos.includes(m.role);
    case "areas":
      return m.areas.some((a) => c.areas.includes(a));
    case "pessoas":
      return c.pessoas.includes(m.id);
  }
}

/** Quem recebe, em ordem de cargo e nome. */
export function destinatarios(
  c: Pick<Comunicado, "publico" | "cargos" | "areas" | "pessoas">,
  equipe: MembroEquipe[],
): MembroEquipe[] {
  return equipe
    .filter((m) => ehPara(c, m))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.username.localeCompare(b.username, "pt-BR"));
}

/** "Todos os staffs", "Coordinator, Manager", "Área Ilegal", "3 staffs". */
export function textoDoPublico(
  c: Pick<Comunicado, "publico" | "cargos" | "areas" | "pessoas">,
  nomes: { cargo: (r: string) => string; area: (a: string) => string; pessoa: (id: string) => string },
): string {
  switch (c.publico) {
    case "todos":
      return "Todos os staffs";
    case "cargos":
      return c.cargos.map(nomes.cargo).join(", ") || "Nenhum cargo";
    case "areas":
      return c.areas.map(nomes.area).map((a) => `Área ${a}`).join(", ") || "Nenhuma área";
    case "pessoas":
      return c.pessoas.length <= 3
        ? c.pessoas.map(nomes.pessoa).join(", ")
        : `${c.pessoas.length} staffs escolhidos`;
  }
}

export const CARGOS_EM_ORDEM = [...ROLE_ORDER];

/* ------------------------------------------------------------------ banco */

// tabelas novas ainda fora dos tipos gerados do Supabase
type Resp<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface Q<T> extends Resp<T> {
  order: (c: string, o?: { ascending: boolean }) => Q<T>;
  eq: (c: string, v: string | boolean) => Q<T>;
  limit: (n: number) => Q<T>;
  select: (c?: string) => Q<T>;
}
const tabela = <T>(nome: string) =>
  (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Q<T[]>;
      insert: (v: Partial<T>) => Q<T[]>;
      update: (v: Partial<T>) => Q<T[]>;
      upsert: (v: Partial<T>, o?: { onConflict: string }) => Q<T[]>;
      delete: () => Q<T[]>;
    };
  }).from(nome);

const COLS =
  "id, tipo, titulo, texto, prioridade, publico, cargos, areas, pessoas, som, exige_leitura, prazo, arquivado, criado_por, criado_por_id, created_at";

const falhar = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function fetchComunicados(): Promise<Comunicado[]> {
  const { data, error } = await tabela<Comunicado>("comunicados").select(COLS).order("created_at", { ascending: false }).limit(300);
  falhar(error);
  return data ?? [];
}

export async function fetchLeituras(): Promise<Leitura[]> {
  const { data, error } = await tabela<Leitura>("comunicado_leituras").select("comunicado_id, user_id, username, lido_em, concluido_em");
  falhar(error);
  return data ?? [];
}

export type NovoComunicado = Pick<
  Comunicado,
  "tipo" | "titulo" | "texto" | "prioridade" | "publico" | "cargos" | "areas" | "pessoas" | "som" | "exige_leitura" | "prazo"
>;

export async function enviarComunicado(c: NovoComunicado, eu: { id: string; nome: string }) {
  const { error } = await tabela<Comunicado>("comunicados").insert({
    ...c,
    titulo: c.titulo.trim(),
    texto: c.texto?.trim() || null,
    cargos: c.publico === "cargos" ? c.cargos : [],
    areas: c.publico === "areas" ? c.areas : [],
    pessoas: c.publico === "pessoas" ? c.pessoas : [],
    criado_por: eu.nome,
    criado_por_id: eu.id,
  });
  falhar(error);
}

export async function confirmarLeitura(id: string, eu: { id: string; nome: string }) {
  const { error } = await tabela<Leitura>("comunicado_leituras").upsert(
    { comunicado_id: id, user_id: eu.id, username: eu.nome },
    { onConflict: "comunicado_id,user_id" },
  );
  falhar(error);
}

export async function marcarTarefa(id: string, eu: { id: string; nome: string }, feita: boolean) {
  const { error } = await tabela<Leitura>("comunicado_leituras").upsert(
    { comunicado_id: id, user_id: eu.id, username: eu.nome, concluido_em: feita ? new Date().toISOString() : null },
    { onConflict: "comunicado_id,user_id" },
  );
  falhar(error);
}

export async function arquivarComunicado(id: string, arquivado: boolean) {
  const { error } = await tabela<Comunicado>("comunicados").update({ arquivado }).eq("id", id);
  falhar(error);
}

export async function apagarComunicado(id: string) {
  const { error } = await tabela<Comunicado>("comunicados").delete().eq("id", id);
  falhar(error);
}

/** Pendente para mim: precisa confirmar (aviso) ou ainda não fiz (tarefa). */
export function pendenteParaMim(c: Comunicado, minha: Leitura | undefined): boolean {
  if (c.arquivado) return false;
  if (c.tipo === "tarefa") return !minha?.concluido_em;
  return c.exige_leitura ? !minha : false;
}

/* ------------------------------------------------------------------ som */

/** Toque curto de notificação (duas notas), sem depender de arquivo de áudio. */
export function tocarAlerta(urgente = false) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notas = urgente ? [880, 660, 880, 660] : [740, 988];
    notas.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.16);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* sem áudio (navegador bloqueou): fica só o aviso visual */
  }
}
