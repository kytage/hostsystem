import { z } from "zod";

/** Palavra que o usuário precisa digitar para liberar a exclusão. */
export const PALAVRA_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

/** Ação destrutiva exige digitar EXCLUIR, não apenas abrir o diálogo. */
export function confirmaExclusaoSetagem(setagem: string, confirmacao: string): boolean {
  return setagem.trim().length > 0 && confirmacao.trim() === PALAVRA_CONFIRMACAO_EXCLUSAO;
}

export const excluirSetagemSchema = z.object({
  id: z.string().trim().min(1),
  setagem: z.string().trim().min(1),
  confirmacao: z.string(),
}).refine((data) => confirmaExclusaoSetagem(data.setagem, data.confirmacao), {
  message: "Digite EXCLUIR para confirmar a exclusão.",
});