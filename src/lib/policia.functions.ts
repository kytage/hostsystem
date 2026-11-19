import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRUPOS_POLICIA, type PolicialResumo } from "@/lib/policia";

export interface EstabPolicia {
  id: string;
  nome: string;
  status: string;
  observacao: string;
}

export interface OnlinePolicia {
  set_name: string;
  amount: number;
  hour: number;
  captured_at: string;
}

export interface DadosPolicia {
  policiais: PolicialResumo[];
  estabelecimentos: EstabPolicia[];
  online: OnlinePolicia[];
  atualizadoEm: string;
}

/**
 * Tudo da aba /policia numa chamada só (lido no banco do site, nada no servidor FiveM).
 * Acesso: Coordinator+ ou área Polícia — checado aqui no servidor do site.
 */
export const carregarPolicia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DadosPolicia> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles }, { data: areas }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin.from("user_areas").select("area").eq("user_id", context.userId),
    ]);
    const coordenacao = (roles ?? []).some((r) =>
      ["founder", "c_level", "direcao", "coordinator"].includes(r.role as string),
    );
    const daArea = (areas ?? []).some((a) => a.area === "policia");
    if (!coordenacao && !daArea) throw new Error("Sem acesso à Polícia.");

    // players de cada grupo policial (a função do banco acha "Police" e "Police:3")
    const porPassaporte = new Map<string, PolicialResumo>();
    const grupos = new Set(GRUPOS_POLICIA.map((g) => g.toLowerCase()));
    const listas = await Promise.all(
      GRUPOS_POLICIA.map((g) => supabaseAdmin.rpc("players_com_grupo" as never, { p_grupo: g } as never)),
    );
    for (const { data } of listas) {
      for (const r of (data ?? []) as {
        passaporte: string | null;
        license: string;
        nome: string;
        discord_nome: string | null;
        online: boolean;
        ultimo_login: string | null;
        level: number | null;
        grupos: string[] | null;
      }[]) {
        const chave = r.passaporte ?? r.license;
        if (porPassaporte.has(chave)) continue;
        porPassaporte.set(chave, {
          passaporte: r.passaporte ?? "",
          nome: r.nome,
          discord: r.discord_nome,
          online: r.online,
          ultimoLogin: r.ultimo_login,
          level: r.level ?? 0,
          grupos: (r.grupos ?? []).filter((x) => grupos.has(x.split(":")[0]!.trim().toLowerCase())),
        });
      }
    }

    const desde = new Date(Date.now() - 15 * 86_400_000).toISOString();
    const [{ data: cat }, { data: online }] = await Promise.all([
      supabaseAdmin.from("captacoes_categorias").select("id, nome").ilike("nome", "%polic%"),
      supabaseAdmin
        .from("set_online_log")
        .select("set_name, amount, hour, captured_at")
        .eq("webhook", "faccoes")
        .in("set_name", GRUPOS_POLICIA)
        .gte("captured_at", desde)
        .order("captured_at", { ascending: true })
        .limit(5000),
    ]);
    const ids = (cat ?? []).map((c) => c.id);
    const { data: estabs } = ids.length
      ? await supabaseAdmin
          .from("captacoes_estabelecimentos")
          .select("id, nome, status, observacao")
          .in("categoria_id", ids)
          .order("ordem")
      : { data: [] };

    return {
      policiais: [...porPassaporte.values()],
      estabelecimentos: (estabs ?? []) as EstabPolicia[],
      online: ((online ?? []) as OnlinePolicia[]).map((o) => ({ ...o, amount: Number(o.amount) })),
      atualizadoEm: new Date().toISOString(),
    };
  });
