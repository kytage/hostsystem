import { createFileRoute } from "@tanstack/react-router";
import { Anotacoes, TarefasParticulares } from "@/components/home-pessoal";
import { PageHeader } from "@/components/page-header";
import { PerfilCartao } from "@/components/perfil/perfil-cartao";
import { InventarioFundo } from "@/components/players/inventario-fundo";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil & Agenda — HOST" },
      { name: "description", content: "Sua central no painel: perfil, status, Staff Coins, tarefas e anotações." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  return (
    <div className="pagina relative isolate">
      {/* fundo: preto com brilho vermelho e a malha de holograma que segue o mouse */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-[640px] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <InventarioFundo />
      </div>

      <PageHeader title="Perfil & Agenda" subtitle="Sua central no painel: perfil, status, Staff Coins, tarefas e anotações." />

      <div className="mt-5">
        <PerfilCartao />
      </div>

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
