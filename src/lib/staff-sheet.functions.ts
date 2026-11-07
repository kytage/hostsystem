import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StaffSheetData } from "@/lib/staff-sheet.server";

export type { StaffSheetData };

/** Busca os dados atuais da planilha pública HOST - STAFF (requer login) */
export const getStaffSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<StaffSheetData> => {
    const { fetchStaffSheet } = await import("@/lib/staff-sheet.server");
    return fetchStaffSheet();
  });
