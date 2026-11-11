import { z } from "zod";

/** Palavra que o usuário precisa digitar para liberar a exclusão. */
export const PALAVRA_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

/**
 * Ação destrutiva exige digitar EXCLUIR, não apenas abrir o diálogo.
 * O nome da setagem não entra na conta: linhas sem nome (ainda "a definir")
 * também precisam poder ser excluídas.
 */
export function confirmaExclusaoSetagem(_setagem: string, confirmacao: string): boolean {
  return confirmacao.trim() === PALAVRA_CONFIRMACAO_EXCLUSAO;
}

export const excluirSetagemSchema = z
  .object({
    id: z.string().trim().min(1),
    // pode vir vazia: a linha é encontrada pelo id
    setagem: z.string(),
    confirmacao: z.string(),
  })
  .refine((data) => confirmaExclusaoSetagem(data.setagem, data.confirmacao), {
    message: "Digite EXCLUIR para confirmar a exclusão.",
  });
