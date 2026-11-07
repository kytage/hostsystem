import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marca presença real do usuário logado (profiles.last_seen_at).
 * O `last_sign_in_at` do Auth só muda em um novo login — sessões persistidas
 * ficavam "há 2 dias" mesmo com o usuário online. Este heartbeat corrige isso.
 */
const INTERVALO_MS = 2 * 60 * 1000;

export function usePresenceHeartbeat() {
  useEffect(() => {
    let cancelado = false;

    const ping = async () => {
      if (cancelado || typeof document === "undefined") return;
      if (document.visibilityState === "hidden") return;
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return;
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", userId);
      } catch {
        // presença é best-effort: falha silenciosa não deve quebrar a UI
      }
    };

    void ping();
    const timer = window.setInterval(() => void ping(), INTERVALO_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelado = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
}
