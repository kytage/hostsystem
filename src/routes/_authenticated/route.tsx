import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ehVisita, useSouVisita } from "@/lib/hoki-visita";
import { getAuthUser } from "@/lib/auth-cache";
import { ChatWidget } from "@/components/chat-widget";
import { Abertura } from "@/components/abertura";
import { useDevSolicitacaoNotify } from "@/hooks/use-dev-solicitacao-notify";
import { useIlegalAvisoNotify } from "@/hooks/use-ilegal-aviso-notify";
import { useHokiOnline } from "@/hooks/use-hoki-online";
import { useVersaoNova } from "@/hooks/use-versao-nova";

/** Avisos e chat da equipe: a visita do HOKI não tem nada disso. */
function SoDaEquipe() {
  useDevSolicitacaoNotify();
  useIlegalAvisoNotify();
  return <ChatWidget />;
}

function AuthenticatedLayout() {
  useHokiOnline();
  useVersaoNova();
  const visita = useSouVisita();

  return (
    <>
      {!visita && <Abertura />}
      <Outlet />
      {!visita && <SoDaEquipe />}
    </>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Sessão local (sem round-trip de rede) — o guard roda em toda navegação
    // dentro da área autenticada, então precisa ser instantâneo.
    const user = await getAuthUser();
    if (!user) throw redirect({ to: "/auth" });
    // visita do HOKI só enxerga a tela do HOKI
    if (location.pathname !== "/hoki" && (await ehVisita(user.id))) throw redirect({ to: "/hoki" });
    return { user };
  },
  component: AuthenticatedLayout,
});
