import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COL_SOLICITACOES } from "@/lib/kanban";
import { getAuthUserData } from "@/lib/auth-cache";

/** Usuários que recebem a notificação de nova solicitação. */
const DEVS_NOTIFICADOS = ["brenno", "miguel"];

/**
 * Notificação minimalista no navegador quando uma nova solicitação entra
 * no Kanban. Ativa apenas para os devs listados em DEVS_NOTIFICADOS.
 */
export function useDevSolicitacaoNotify() {
  const { data: username } = useQuery({
    queryKey: ["notify-username"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) return "";
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return (data?.username ?? "").toLowerCase();
    },
    staleTime: 300_000,
  });

  const habilitado = !!username && DEVS_NOTIFICADOS.includes(username);
  const pedido = useRef(false);

  useEffect(() => {
    if (!habilitado) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (pedido.current) return;
    pedido.current = true;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [habilitado]);

  useEffect(() => {
    if (!habilitado) return;

    const channel = supabase
      .channel("dev-solicitacoes-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kanban_cards" },
        (payload) => {
          const row = payload.new as {
            coluna?: string;
            titulo?: string;
            numero?: number;
          };
          if (row.coluna !== COL_SOLICITACOES) return;

          const titulo = "Nova solicitação";
          const corpo = `#${row.numero ?? "?"} ${row.titulo ?? ""}`.trim();

          toast(titulo, { description: corpo });

          try {
            if ("Notification" in window && Notification.permission === "granted") {
              const n = new Notification(titulo, { body: corpo, silent: true });
              n.onclick = () => {
                window.focus();
                window.location.assign("/desenvolvimento");
              };
            }
          } catch {
            // navegador sem suporte / bloqueado — o toast já cobre o aviso
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [habilitado]);
}
