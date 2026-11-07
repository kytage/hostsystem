import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * `supabase.auth.getUser()` faz uma requisição de rede a cada chamada
 * (/auth/v1/user). Como o app chama isso em dezenas de lugares (queries,
 * mutations, guards de rota), cada navegação pagava vários round-trips.
 *
 * Aqui usamos a sessão local (já persistida e renovada pelo SDK) com um
 * cache curto em memória — leitura instantânea e sem rede.
 */
let cached: { user: User | null; at: number } | null = null;
const TTL = 30_000;

/** Invalida o cache — chamado em mudanças de estado de autenticação. */
export function clearAuthCache() {
  cached = null;
}

supabase.auth.onAuthStateChange(() => {
  clearAuthCache();
});

/** Usuário autenticado atual (ou null), sem round-trip de rede. */
export async function getAuthUser(): Promise<User | null> {
  // Durante a hidratação, getSession() pode retornar null momentaneamente.
  // Nunca reutilize esse estado transitório como identidade por 30 segundos.
  if (cached?.user && Date.now() - cached.at < TTL) return cached.user;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  cached = user ? { user, at: Date.now() } : null;
  return user;
}

/** Compatível com o shape `{ user }` de `supabase.auth.getUser().data`. */
export async function getAuthUserData(): Promise<{ user: User | null }> {
  return { user: await getAuthUser() };
}
