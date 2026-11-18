import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gera o rascunho do Patch Note com IA a partir dos cards concluídos.
 * Somente organiza e redige — a gravação (confirmar/arquivar) é feita
 * pelo cliente após a revisão do administrador.
 */
export const gerarPatchNoteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data) =>
      z
        .object({
          cards: z
            .array(
              z.object({
                id: z.string().max(64),
                numero: z.number(),
                titulo: z.string().max(300),
                descricao: z.string().max(4000),
                categoria: z.string().max(60),
                patchTexto: z.string().max(2000),
              })
            )
            .min(1)
            .max(200),
        })
        .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { exigirPermissao } = await import("./seguranca.server");
    await exigirPermissao(context.userId, "desenvolvimento", "view");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");
    const { gerarPatchNoteComIA } = await import("./kanban-ai.server");
    return gerarPatchNoteComIA(data.cards, apiKey);
  });

/**
 * Confirma o Patch Note: grava o registro com log de auditoria e arquiva
 * todos os cards da coluna Concluído (limpando-a).
 */
export const confirmarPatchNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        texto: z.string().min(1).max(60_000),
        logTexto: z.string().max(60_000),
        cardIds: z.array(z.string().max(64)).max(500),
        totalAlteracoes: z.number().int().nonnegative(),
        // ignorado: a autoria vem do login (o navegador não escolhe quem gerou)
        geradoPor: z.string().max(60).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { exigirPermissao, nomeDe } = await import("./seguranca.server");
    await exigirPermissao(context.userId, "desenvolvimento", "view");
    const geradoPor = await nomeDe(context.userId);
    const { gravarPatchNoteEArquivar } = await import("./kanban-archive.server");
    return gravarPatchNoteEArquivar({ ...data, geradoPor });
  });
