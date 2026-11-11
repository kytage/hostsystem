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
 * Cabeçalho das páginas: sem cartão e sem barra. O título fica solto sobre o
 * fundo, com um rótulo pequeno em cima (e um ponto vermelho), o subtítulo em
 * cinza e as ações à direita, na mesma linha quando cabe.
 */
export function PageHeader({ kicker = "HOST", title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="animate-rise relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1.5 pb-1 pt-1">
      <div className="min-w-0">
        {typeof title === "string" ? (
          <>
            <p className="eyebrow flex items-center gap-2">
              <span
                aria-hidden
                className="size-[5px] rounded-full bg-[#e5231b] shadow-[0_0_8px_rgba(229,35,27,0.95)]"
              />
              {kicker}
            </p>
            <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-none tracking-[-0.035em] md:text-[30px]">
              {title}
            </h1>
          </>
        ) : (
          <h1 className="inline-block">{title}</h1>
        )}
        {subtitle ? (
          <p className="mt-1.5 max-w-3xl text-[12.5px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
