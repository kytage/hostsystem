import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Rótulo pequeno acima do título */
  kicker?: string;
  /** Quando `title` for um ReactNode (ex.: logo), `kicker` é ignorado */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botões/ações alinhados à direita */
  actions?: ReactNode;
}

/**
 * Cabeçalho padrão do HOST — premium dark glass.
 * Eyebrow discreto, título em Manrope, subtítulo em cinza e ações à direita,
 * sem linha divisória (o respiro entre blocos faz a separação).
 */
export function PageHeader({ kicker = "HOST", title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="animate-rise flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-2">
      <div className="min-w-0">
        {typeof title === "string" ? (
          <>
            <p className="eyebrow">{kicker}</p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground md:text-[28px]">
              {title}
            </h1>
          </>
        ) : (
          <h1 className="inline-block">{title}</h1>
        )}
        {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
