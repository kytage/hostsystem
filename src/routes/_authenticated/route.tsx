import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthUser } from "@/lib/auth-cache";
import { ChatWidget } from "@/components/chat-widget";
import { Abertura } from "@/components/abertura";
import { useDevSolicitacaoNotify } from "@/hooks/use-dev-solicitacao-notify";
import { useIlegalAvisoNotify } from "@/hooks/use-ilegal-aviso-notify";
import { useHokiOnline } from "@/hooks/use-hoki-online";

function AuthenticatedLayout() {
  useDevSolicitacaoNotify();
  useIlegalAvisoNotify();
  useHokiOnline();

  return (
    <>
      <Abertura />
      <Outlet />
      <ChatWidget />
    </>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Sessão local (sem round-trip de rede) — o guard roda em toda navegação
    // dentro da área autenticada, então precisa ser instantâneo.
    const user = await getAuthUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});
