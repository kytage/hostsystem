import { createFileRoute } from "@tanstack/react-router";
import { Anotacoes, TarefasParticulares } from "@/components/home-pessoal";
import { PageHeader } from "@/components/page-header";
import { PerfilCartao } from "@/components/perfil/perfil-cartao";

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
    <div className="pagina">
      <PageHeader title="Perfil & Agenda" subtitle="Sua central no painel: perfil, status, Staff Coins, tarefas e anotações." />

      {/* tarefas à esquerda; perfil compacto e anotações na coluna da direita (no celular: perfil, tarefas e anotações) */}
      <div className="mt-4 flex flex-col gap-3.5 xl:grid xl:grid-cols-4 xl:items-stretch">
        {/* o cartão de tarefas estica até a altura da coluna da direita (as duas terminam na mesma linha) */}
        <div className="order-2 min-w-0 xl:order-none xl:col-span-3 xl:[&>*]:h-full">
          <TarefasParticulares />
        </div>
        <div className="contents xl:col-span-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-3.5">
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
