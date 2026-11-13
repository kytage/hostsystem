import { createFileRoute, redirect } from "@tanstack/react-router";

// Foto, IDs, bio e status agora ficam no Perfil & Agenda.
export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: () => {
    throw redirect({ to: "/perfil", replace: true });
  },
});
