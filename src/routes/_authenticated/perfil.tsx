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

      {/* tarefas à esquerda; perfil compacto e anotações na coluna da direita (no celular: perfil, tarefas e anotações) */}
      <div className="mt-5 flex flex-col gap-6 xl:grid xl:grid-cols-4 xl:items-start">
        <div className="order-2 min-w-0 xl:order-none xl:col-span-3">
          <TarefasParticulares />
        </div>
        <div className="contents xl:col-span-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
          <div className="order-1 xl:order-none">
            <PerfilCartao />
          </div>
          <div className="order-3 xl:order-none">
            <Anotacoes />
          </div>
        </div>
      </div>
    </div>
  );
}
