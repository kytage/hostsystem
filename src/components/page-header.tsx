import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Uma imagem por tema de página (todas tratadas em preto e prata pelo .foto-metal). */
const IMAGENS: [prefixo: string, imagem: string][] = [
  ["/ilegal", "fluido"],
  ["/punicoes", "fluido"],
  ["/players", "cubos"],
  ["/usuarios", "cubos"],
  ["/desenvolvimento", "cubos"],
  ["/update", "cubos"],
  ["/marketing", "curvas"],
  ["/areas", "curvas"],
  ["/eventos", "curvas"],
  ["/captacoes", "curvas"],
  ["/financeiro", "ondas"],
  ["/avisos", "ondas"],
  ["/tarefas", "ondas"],
  ["/area-manager", "ondas"],
  ["/peds", "ondas"],
  ["/configuracoes", "ondas"],
];

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
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const imagem = IMAGENS.find(([prefixo]) => pathname.startsWith(prefixo))?.[1];
  return (
    <header className="animate-rise relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#050505]">
      {imagem && (
        <>
          <img src={`/img/${imagem}.jpg`} alt="" aria-hidden className="foto-metal pointer-events-none absolute inset-y-0 right-0 h-full w-[55%] object-cover" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/90 to-[#050505]/20" />
        </>
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-6 py-6 md:px-8 md:py-7">
        <div className="min-w-0">
          {typeof title === "string" ? (
            <>
              <p className="eyebrow">{kicker}</p>
              <h1 className="text-metal mt-2 font-display text-[30px] font-semibold leading-tight tracking-[-0.035em] md:text-[38px]">{title}</h1>
            </>
          ) : (
            <h1 className="inline-block">{title}</h1>
          )}
          {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
