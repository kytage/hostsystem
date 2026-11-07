import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pedSchema } from "@/lib/peds-schema";
import { normalizePedState, removedPedState } from "@/lib/peds-records";

export const listPeds = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: access, error: accessError } = await context.supabase.rpc("can_access_peds", { _user_id: context.userId });
  if (accessError || !access) throw new Error("Acesso restrito a Coordinator+ e PED/KIDS.");
  const { data, error } = await context.supabase.from("peds").select("*").order("created_at", { ascending: false }).order("source_key");
  if (error) throw new Error("Não foi possível carregar os Peds.");
  return data ?? [];
});
export const savePed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().optional(), input: pedSchema }))
  .handler(async ({ data, context }) => {
    const input = normalizePedState(data.input);
    const result = data.id
      ? await context.supabase.from("peds").update(input).eq("id", data.id).select("id").single()
      : await context.supabase.from("peds").insert(input).select("id").single();
    if (result.error) throw new Error("Não foi possível salvar o Ped. Confira seu acesso e tente novamente.");
    return result.data;
  });
export const deletePed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase.from("peds").update(removedPedState).eq("id", data.id).select("id").single();
    if (error || !removed) throw new Error("Não foi possível mover o Ped para Removidos.");
    return { ok: true };
  });