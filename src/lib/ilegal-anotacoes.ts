import { supabase } from "@/integrations/supabase/client";

/** Anotação livre do painel Ilegal — ideias, prints e observações da equipe. */
export interface IlegalAnotacao {
  id: string;
  titulo: string;
  descricao: string;
  imagens: string[];
  criadoPor: string;
  createdAt: string;
  updatedAt: string;
}

export interface IlegalAnotacaoInput {
  titulo: string;
  descricao: string;
  imagens: string[];
}

interface Row {
  id: string;
  titulo: string;
  descricao: string;
  imagens: unknown;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

function toAnotacao(row: Row): IlegalAnotacao {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    imagens: Array.isArray(row.imagens)
      ? row.imagens.filter((i): i is string => typeof i === "string")
      : [],
    criadoPor: row.criado_por,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAnotacoesIlegal(): Promise<IlegalAnotacao[]> {
  const { data, error } = await supabase
    .from("ilegal_anotacoes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toAnotacao(r as unknown as Row));
}

export async function criarAnotacaoIlegal(
  input: IlegalAnotacaoInput,
  autor: { username: string; id: string }
): Promise<void> {
  const { error } = await supabase.from("ilegal_anotacoes").insert({
    titulo: input.titulo,
    descricao: input.descricao,
    imagens: input.imagens,
    criado_por: autor.username,
    criado_por_id: autor.id || null,
  });
  if (error) throw error;
}

export async function atualizarAnotacaoIlegal(
  id: string,
  input: IlegalAnotacaoInput
): Promise<void> {
  const { error } = await supabase
    .from("ilegal_anotacoes")
    .update({
      titulo: input.titulo,
      descricao: input.descricao,
      imagens: input.imagens,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deletarAnotacaoIlegal(id: string): Promise<void> {
  const { error } = await supabase.from("ilegal_anotacoes").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Redimensiona e comprime a imagem no cliente antes de guardar como data URL,
 * evitando linhas gigantes no banco.
 */
export function comprimirImagem(file: File, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
