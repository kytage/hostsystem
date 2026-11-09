import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ROLE_ORDER, type AppRole } from "@/lib/roles";
import type { EquipeUser } from "@/lib/equipe-merge";

/**
 * Equipe por área para o menu Áreas: disponível a qualquer membro da equipe.
 * Expõe só o necessário para exibir (sem IDs de Discord/Host nem dados de login).
 */
export const listEquipeAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EquipeUser[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: perfis, error }, { data: cargos }, { data: areas }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, avatar_url, last_seen_at").order("username", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_areas").select("user_id, area, nivel"),
    ]);
    if (error) throw new Error(error.message);
    if (!(cargos ?? []).some((c) => c.user_id === context.userId)) throw new Error("Sem acesso à equipe");

    return (perfis ?? []).map((p) => {
      const meus = (areas ?? []).filter((a) => a.user_id === p.id);
      const roles = (cargos ?? []).filter((c) => c.user_id === p.id).map((c) => c.role as AppRole);
      return {
        id: p.id,
        username: p.username,
        created_at: "",
        avatar_url: p.avatar_url ?? "",
        discord_id: "",
        host_id: "",
        role: ROLE_ORDER.find((r) => roles.includes(r)) ?? "staff",
        areas: meus.map((a) => a.area),
        areaNiveis: Object.fromEntries(meus.map((a) => [a.area, a.nivel === "lider" ? ("lider" as const) : ("auxiliar" as const)])),
        last_sign_in_at: p.last_seen_at ?? null,
      };
    });
  });
