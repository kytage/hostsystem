import { createFileRoute } from "@tanstack/react-router";
import { PaginaAvancado } from "@/components/avancado/pagina-avancado";

// HOST AVANÇADO (só Founder e CEO): página inicial.
export const Route = createFileRoute("/_authenticated/avancado/")({
  head: () => ({ meta: [{ title: "HOST AVANÇADO — HOST" }, { name: "robots", content: "noindex" }] }),
  component: PaginaAvancado,
});
