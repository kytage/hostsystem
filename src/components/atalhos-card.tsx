import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMenu } from "@/components/app-sidebar";
import { usePrefetchRoute } from "@/lib/prefetch";
import { cn } from "@/lib/utils";

/** Telas que entram nos atalhos, na ordem de preferência, com uma linha dizendo o que há em cada uma. */
const ATALHOS: { titulo: string; texto: string }[] = [
  { titulo: "Ilegal", texto: "Organizações, setagens e líderes" },
  { titulo: "Players", texto: "Personagens, inventário e garagem" },
  { titulo: "Área Manager", texto: "Solicitações para aprovar" },
  { titulo: "Desenvolvimento", texto: "Quadro de tarefas do servidor" },
  { titulo: "Marketing", texto: "Gravações, publicações e leads" },
  { titulo: "Áreas", texto: "Quem cuida de cada área" },
  { titulo: "Eventos e Cronograma", texto: "Agenda e gestão dos eventos" },
  { titulo: "HOST UPDATE 3.0", texto: "Projetos da atualização" },
  { titulo: "Captações", texto: "Reuniões e propostas" },
  { titulo: "Tarefas", texto: "Seu quadro pessoal" },
];

function Atalho({
  rota,
  titulo,
  texto,
  icone: Icone,
}: {
  rota: string;
  titulo: string;
  texto: string;
  icone: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const prefetch = usePrefetchRoute(rota);
  return (
    <Link
      to={rota}
      className="hc-dentro group flex min-h-[60px] items-center gap-3 p-2.5 pr-3"
      data-som-passar
      {...prefetch}
    >
      <span className="hc-icone !size-9">
        <Icone className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-medium text-foreground">{titulo}</span>
        <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{texto}</span>
      </span>
      <span className="hc-seta !size-7" aria-hidden>
        <ArrowRight
          className="size-3.5 transition-transform duration-200 group-hover:translate-x-px"
          strokeWidth={1.8}
        />
      </span>
    </Link>
  );
}

/**
 * Atalhos da tela inicial: só as telas que o usuário pode abrir, em quadros com ícone, nome e
 * seta. Fica no pé da grade, ocupando a largura toda (três por linha em tela larga).
 */
export function AtalhosCard({ className }: { className?: string }) {
  const { todos } = useMenu();
  const itens = ATALHOS.flatMap((a) => {
    const item = todos.find((i) => i.title === a.titulo && i.url);
    return item?.url ? [{ ...a, rota: item.url, icone: item.icon }] : [];
  }).slice(0, 6);

  return (
    <section className={cn("glass hc p-5", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="hc-titulo">Atalhos</h2>
        <p className="hc-nota">As telas que você mais usa, a um clique</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {itens.map((a) => (
          <Atalho key={a.titulo} rota={a.rota} titulo={a.titulo} texto={a.texto} icone={a.icone} />
        ))}
      </div>
    </section>
  );
}
