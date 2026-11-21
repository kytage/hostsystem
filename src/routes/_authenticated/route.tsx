import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthUser } from "@/lib/auth-cache";
import { ChatWidget } from "@/components/chat-widget";
import { Abertura } from "@/components/abertura";
import { useDevSolicitacaoNotify } from "@/hooks/use-dev-solicitacao-notify";
import { useIlegalAvisoNotify } from "@/hooks/use-ilegal-aviso-notify";
import { useAvisoDeSuspeitos } from "@/lib/logs-suspeitos";
import { useVersaoNova } from "@/hooks/use-versao-nova";
import { OuvinteReinicio } from "@/components/reiniciar-site";
import { MenuPerfil } from "@/components/menu-perfil";
import { BarraDeFormatacao } from "@/components/barra-formatacao";

/** Avisos da equipe e o botão de mensagens. */
function SoDaEquipe() {
  useDevSolicitacaoNotify();
  useIlegalAvisoNotify();
  // logs: aviso quando alguém faz 4+ kills em 60 segundos (src/lib/logs-suspeitos.ts)
  useAvisoDeSuspeitos();
  // canto direito: o botão de mensagens (chat geral e da área)
  return <ChatWidget />;
}

function AuthenticatedLayout() {
  useVersaoNova();

  return (
    <>
      <Abertura />
      <Outlet />
      {/* botão fixo no topo que abre o Perfil & Agenda por cima de qualquer página */}
      <MenuPerfil />
      {/* selecionar texto em qualquer campo grande mostra a barra de negrito, itálico... (igual ao Discord) */}
      <BarraDeFormatacao />
      <OuvinteReinicio />
      <SoDaEquipe />
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
