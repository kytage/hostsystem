/**
 * Marketing › Artes: tópicos com arquivos anexados (migração 20261226120000). Aberto para toda a
 * staff ler e enviar; editar e apagar fica com quem criou, Coordinator+ e a equipe de Marketing
 * (o banco confere de novo pelas políticas). Os arquivos ficam no bucket privado "marketing-artes".
 */
import { supabase } from "@/integrations/supabase/client";

export const BUCKET_ARTES = "marketing-artes";
export const LIMITE_ARQUIVO = 50 * 1024 * 1024;

export interface TopicoArte {
  id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  criado_por: string | null;
  criado_por_id: string | null;
  created_at: string;
}

export interface ArquivoArte {
  id: string;
  topico_id: string;
  nome: string;
  caminho: string;
  tipo: string | null;
  tamanho: number | null;
  descricao: string | null;
  criado_por: string | null;
  criado_por_id: string | null;
  created_at: string;
}

// tabelas novas ainda fora dos tipos gerados do Supabase
type Resposta<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface Consulta<T> extends Resposta<T> {
  order: (c: string, o?: { ascending: boolean }) => Consulta<T>;
  eq: (c: string, v: string) => Consulta<T>;
  select: (c?: string) => Consulta<T>;
  single: () => Resposta<T extends (infer U)[] ? U : T>;
}
interface Tabela<T> {
  select: (c: string) => Consulta<T[]>;
  insert: (v: Partial<T> | Partial<T>[]) => Consulta<T[]>;
  update: (v: Partial<T>) => Consulta<T[]>;
  delete: () => Consulta<T[]>;
}
const tabela = <T>(nome: string) =>
  (supabase as unknown as { from: (t: string) => Tabela<T> }).from(nome);

const COLS_TOPICO = "id, titulo, descricao, ordem, criado_por, criado_por_id, created_at";
const COLS_ARQUIVO =
  "id, topico_id, nome, caminho, tipo, tamanho, descricao, criado_por, criado_por_id, created_at";

const falhar = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function fetchTopicos(): Promise<TopicoArte[]> {
  const { data, error } = await tabela<TopicoArte>("marketing_artes_topicos")
    .select(COLS_TOPICO)
    .order("ordem")
    .order("created_at");
  falhar(error);
  return data ?? [];
}

export async function fetchArquivos(): Promise<ArquivoArte[]> {
  const { data, error } = await tabela<ArquivoArte>("marketing_artes_arquivos")
    .select(COLS_ARQUIVO)
    .order("created_at", { ascending: false });
  falhar(error);
  return data ?? [];
}

async function quemSou() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("Entre novamente para continuar.");
  const { data: p } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  return { id: user.id, nome: p?.username ?? user.email ?? "staff" };
}

export async function criarTopico(input: { titulo: string; descricao?: string | null; ordem?: number }) {
  const eu = await quemSou();
  const { error } = await tabela<TopicoArte>("marketing_artes_topicos").insert({
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || null,
    ordem: input.ordem ?? 100,
    criado_por: eu.nome,
    criado_por_id: eu.id,
  });
  falhar(error);
}

export async function editarTopico(id: string, patch: { titulo?: string; descricao?: string | null }) {
  const { error } = await tabela<TopicoArte>("marketing_artes_topicos")
    .update({ ...patch, ...(patch.titulo ? { titulo: patch.titulo.trim() } : {}) })
    .eq("id", id);
  falhar(error);
}

export async function apagarTopico(id: string, arquivos: ArquivoArte[]) {
  const caminhos = arquivos.filter((a) => a.topico_id === id).map((a) => a.caminho);
  if (caminhos.length) await supabase.storage.from(BUCKET_ARTES).remove(caminhos);
  const { data, error } = await tabela<TopicoArte>("marketing_artes_topicos").delete().eq("id", id).select("id");
  falhar(error);
  if (!data?.length) throw new Error("Você não tem permissão para apagar este tópico.");
}

const nomeSeguro = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);

/** Envia um arquivo para o tópico (pasta do próprio usuário no bucket, como pede a política). */
export async function anexarArquivo(topicoId: string, file: File) {
  if (file.size > LIMITE_ARQUIVO) throw new Error(`"${file.name}" passa de 50 MB.`);
  const eu = await quemSou();
  const caminho = `${eu.id}/${topicoId}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`;
  const up = await supabase.storage
    .from(BUCKET_ARTES)
    .upload(caminho, file, { contentType: file.type || "application/octet-stream" });
  if (up.error) throw new Error(up.error.message);
  const { error } = await tabela<ArquivoArte>("marketing_artes_arquivos").insert({
    topico_id: topicoId,
    nome: file.name,
    caminho,
    tipo: file.type || null,
    tamanho: file.size,
    criado_por: eu.nome,
    criado_por_id: eu.id,
  });
  if (error) {
    await supabase.storage.from(BUCKET_ARTES).remove([caminho]);
    throw new Error(error.message);
  }
}

export async function apagarArquivo(a: ArquivoArte) {
  const { data, error } = await tabela<ArquivoArte>("marketing_artes_arquivos").delete().eq("id", a.id).select("id");
  falhar(error);
  if (!data?.length) throw new Error("Você não tem permissão para apagar este arquivo.");
  await supabase.storage.from(BUCKET_ARTES).remove([a.caminho]);
}

/** Links assinados (1 hora) para ver e baixar os arquivos do bucket privado. */
export async function linksDosArquivos(caminhos: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!caminhos.length) return m;
  const { data } = await supabase.storage.from(BUCKET_ARTES).createSignedUrls(caminhos, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) m.set(d.path, d.signedUrl);
  return m;
}

export const ehImagemArte = (a: Pick<ArquivoArte, "tipo" | "nome">) =>
  (a.tipo ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(a.nome);

export function tamanhoBonito(b: number | null): string {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
