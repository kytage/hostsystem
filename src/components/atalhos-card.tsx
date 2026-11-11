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
      className="glass-inset group flex min-h-[54px] items-center gap-3 rounded-2xl border p-2.5"
      data-som-passar
      {...prefetch}
    >
      <span className="icone-quadro size-9 text-foreground/90">
        <Icone className="size-4" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-medium">{titulo}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{texto}</span>
      </span>
      <span className="grid size-7 shrink-0 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-muted-foreground transition-colors duration-200 group-hover:border-white/25 group-hover:bg-white group-hover:text-black">
        <ArrowRight
          className="size-3.5 transition-transform duration-200 group-hover:translate-x-px"
          strokeWidth={1.8}
        />
      </span>
    </Link>
  );
}

/** Atalhos da tela inicial: só as telas que o usuário pode abrir, em linhas com ícone, nome e seta. */
export function AtalhosCard({ className }: { className?: string }) {
  const { todos } = useMenu();
  const itens = ATALHOS.flatMap((a) => {
    const item = todos.find((i) => i.title === a.titulo && i.url);
    return item?.url ? [{ ...a, rota: item.url, icone: item.icon }] : [];
  }).slice(0, 6);

  return (
    <section
      className={cn(
        "glass relative flex min-h-[300px] flex-col overflow-hidden rounded-[24px] p-4",
        className,
      )}
    >
      <span aria-hidden className="pontilhado opacity-50" />
      <div className="relative">
        <h2 className="text-[13.5px] font-medium text-foreground/90">Atalhos</h2>
        <p className="text-[11px] text-ink-3">As telas que você mais usa, a um clique</p>
      </div>
      <div className="relative mt-3 grid flex-1 auto-rows-fr gap-2 sm:grid-cols-2">
        {itens.map((a) => (
          <Atalho key={a.titulo} rota={a.rota} titulo={a.titulo} texto={a.texto} icone={a.icone} />
        ))}
      </div>
    </section>
  );
}
