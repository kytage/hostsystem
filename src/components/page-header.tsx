import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ehAtual, grupoDe, useMenu } from "@/components/app-sidebar";

interface PageHeaderProps {
  /** Rótulo pequeno acima do título. Sem ele (ou com o antigo "HOST"), aparece o grupo do menu da página. */
  kicker?: string;
  /** Quando `title` for um ReactNode (ex.: logo), `kicker` é ignorado */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botões/ações alinhados à direita */
  actions?: ReactNode;
}

/**
 * Cabeçalho das páginas, no padrão da tela inicial: um rótulo pequeno em cima
 * (o grupo do menu: Geral, Operação, Gestão ou Sistema), o título grande, o
 * subtítulo em cinza e as ações à direita, na mesma linha quando cabe. Fica
 * solto sobre a luz de fundo da página, sem cartão.
 */
export function PageHeader({ kicker, title, subtitle, actions }: PageHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { todos } = useMenu();
  const item = todos.find((i) => ehAtual(i, pathname));
  const grupo = item ? grupoDe(item.title) : null;
  const rotulo =
    kicker && kicker !== "HOST" ? kicker : grupo && grupo !== "Outros" ? grupo : "HOST";

  return (
    <header className="pagina-topo animate-rise">
      <div className="min-w-0">
        {typeof title === "string" ? (
          <>
            <p className="hc-sobre">{rotulo}</p>
            <h1 className="pagina-titulo">{title}</h1>
          </>
        ) : (
          <h1 className="inline-block">{title}</h1>
        )}
        {subtitle ? <p className="pagina-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="pagina-acoes">{actions}</div> : null}
    </header>
  );
}
