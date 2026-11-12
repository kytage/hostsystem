import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ehVisita, useSouVisita } from "@/lib/hoki-visita";
import { getAuthUser } from "@/lib/auth-cache";
import { HokiFlutuante } from "@/components/hoki/hoki-flutuante";
import { Abertura } from "@/components/abertura";
import { useDevSolicitacaoNotify } from "@/hooks/use-dev-solicitacao-notify";
import { useIlegalAvisoNotify } from "@/hooks/use-ilegal-aviso-notify";
import { useHokiOnline } from "@/hooks/use-hoki-online";
import { useVersaoNova } from "@/hooks/use-versao-nova";
import { OuvinteReinicio } from "@/components/reiniciar-site";

/** Avisos da equipe (a visita do HOKI não tem) e o HOKI flutuante, que aparece fora da tela inicial. */
function SoDaEquipe() {
  useDevSolicitacaoNotify();
  useIlegalAvisoNotify();
  // (o botão de mensagens saiu do canto; no lugar dele fica o HOKI flutuante)
  return <HokiFlutuante />;
}

function AuthenticatedLayout() {
  useHokiOnline();
  useVersaoNova();
  const visita = useSouVisita();

  return (
    <>
      {!visita && <Abertura />}
      <Outlet />
      <OuvinteReinicio />
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
