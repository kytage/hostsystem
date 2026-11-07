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
                id: z.string(),
                numero: z.number(),
                titulo: z.string(),
                descricao: z.string(),
                categoria: z.string(),
                patchTexto: z.string(),
              })
            )
            .min(1),
        })
        .parse(data)
  )
  .handler(async ({ data }) => {
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
        texto: z.string().min(1),
        logTexto: z.string(),
        cardIds: z.array(z.string()),
        totalAlteracoes: z.number().int().nonnegative(),
        geradoPor: z.string().min(1),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { gravarPatchNoteEArquivar } = await import("./kanban-archive.server");
    return gravarPatchNoteEArquivar(data);
  });
