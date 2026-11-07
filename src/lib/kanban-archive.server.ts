/**
 * Gravação server-side do Patch Note e arquivamento dos cards concluídos.
 * Usa o client privilegiado para garantir que o arquivamento seja aplicado
 * (a coluna Concluído deve ficar vazia após a confirmação).
 */
export async function gravarPatchNoteEArquivar(input: {
  texto: string;
  logTexto: string;
  cardIds: string[];
  totalAlteracoes: number;
  geradoPor: string;
}): Promise<{ patchNoteId: string; arquivados: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pn, error } = await supabaseAdmin
    .from("patch_notes")
    .insert({
      texto: input.texto,
      total_alteracoes: input.totalAlteracoes,
      gerado_por: input.geradoPor,
      log_texto: input.logTexto,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao gravar Patch Note: ${error.message}`);

  const patchNoteId = (pn as { id: string }).id;

  // Arquiva TODOS os cards da coluna Concluído (não só os itens do texto),
  // limpando a coluna. Cards fora dela permanecem intactos.
  const { data: arquivados, error: upError } = await supabaseAdmin
    .from("kanban_cards")
    .update({
      patchnote_gerado: true,
      patchnote_id: patchNoteId,
      arquivado: true,
    } as never)
    .eq("coluna", "concluido")
    .eq("arquivado", false)
    .select("id");
  if (upError) throw new Error(`Falha ao arquivar cards: ${upError.message}`);

  return { patchNoteId, arquivados: (arquivados ?? []).length };
}
