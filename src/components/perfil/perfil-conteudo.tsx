import { Anotacoes, TarefasParticulares } from "@/components/home-pessoal";
import { PerfilCartao } from "@/components/perfil/perfil-cartao";

/** Conteúdo do Perfil & Agenda: tarefas à esquerda; perfil e anotações na direita. */
export function PerfilConteudo() {
  return (
    <div className="flex flex-col gap-3.5 xl:grid xl:grid-cols-4 xl:items-stretch">
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
  );
}
