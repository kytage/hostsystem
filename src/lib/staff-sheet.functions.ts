import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StaffSheetData } from "@/lib/staff-sheet.server";

export type { StaffSheetData };

/** Busca os dados atuais da planilha pública HOST - STAFF (requer login) */
export const getStaffSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffSheetData> => {
    const { exigirEquipe } = await import("@/lib/seguranca.server");
    await exigirEquipe(context.userId);
    const { fetchStaffSheet } = await import("@/lib/staff-sheet.server");
    return fetchStaffSheet();
  });
