import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Foto do perfil do site para um player que é ADMIN no jogo: acha a pessoa na Equipe pelo
 * ID HOST (= passaporte) ou, se não achar, pelo ID Discord. Devolve só o endereço da foto.
 * Só para quem é da equipe (tem cargo).
 */
export const fotoDoAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        passaporte: z.string().regex(/^\d{1,9}$/).nullable(),
        discordId: z.string().regex(/^\d{5,25}$/).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ foto: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: eu } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).limit(1);
    if (!eu?.length) return { foto: null };
    for (const [coluna, valor] of [
      ["host_id", data.passaporte],
      ["discord_id", data.discordId],
    ] as const) {
      if (!valor) continue;
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("avatar_url")
        .eq(coluna, valor)
        .not("avatar_url", "is", null)
        .limit(1)
        .maybeSingle();
      const foto = (perfil?.avatar_url ?? "").trim();
      // link (https) ou imagem salva no próprio perfil (data:image/...;base64), até ~2 MB
      if (/^https?:\/\//i.test(foto) || (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(foto) && foto.length < 2_800_000))
        return { foto };
    }
    return { foto: null };
  });
