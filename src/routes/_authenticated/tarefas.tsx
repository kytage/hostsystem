import { createFileRoute, redirect } from "@tanstack/react-router";

// As tarefas particulares agora moram no Perfil & Agenda.
export const Route = createFileRoute("/_authenticated/tarefas")({
  beforeLoad: () => {
    throw redirect({ to: "/perfil", replace: true });
  },
});
