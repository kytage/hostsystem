import { createFileRoute } from "@tanstack/react-router";
import { Anotacoes, TarefasParticulares } from "@/components/home-pessoal";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas Particulares — FiveM Host" },
      {
        name: "description",
        content: "Seu quadro pessoal de tarefas e bloco de anotações.",
      },
      { property: "og:title", content: "Tarefas Particulares — FiveM Host" },
      {
        property: "og:description",
        content: "Seu quadro pessoal de tarefas e bloco de anotações.",
      },
    ],
  }),
  component: TarefasPage,
});

function TarefasPage() {
  return (
    <div className="pagina">
      <PageHeader
        title="Tarefas particulares"
        subtitle="Seu quadro pessoal e bloco de anotações — somente você vê."
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <TarefasParticulares />
        </div>
        <div className="xl:col-span-1">
          <Anotacoes />
        </div>
      </div>
    </div>
  );
}
