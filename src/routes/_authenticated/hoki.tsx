import { createFileRoute } from "@tanstack/react-router";
import { HokiCard } from "@/components/hoki/hoki-card";

export const Route = createFileRoute("/_authenticated/hoki")({
  head: () => ({ meta: [{ title: "HOKI — HOST" }] }),
  component: HokiPage,
});

/**
 * Tela só do HOKI. É a única que a visita enxerga; a equipe também pode abrir.
 * No alto, no lugar do título: a ilha com o nome, o perfil com o "Acordar agora" e quem está online.
 */
function HokiPage() {
  return (
    <div className="pagina">
      <HokiCard alto cabecalho />
    </div>
  );
}
