import { Children, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Contagem } from "@/components/contagem";

export interface IndiceProps {
  /** O número (ou valor já formatado, como "R$ 1.500,00"). */
  valor: ReactNode;
  /** O nome do número. */
  titulo: string;
  /** Uma linha pequena embaixo do nome. */
  nota?: ReactNode | undefined;
  icone?: LucideIcon | undefined;
  /** Pede ação: um ponto vermelho ao lado do número. */
  alerta?: boolean | undefined;
  /** Cor de um ponto antes do nome (para números que têm a cor de um estado, como "Livre"). */
  cor?: string | undefined;
  /** Valor longo (dinheiro, por exemplo): o número fica um pouco menor. */
  compacto?: boolean | undefined;
  /** Quando o quadro serve de filtro: se está escolhido. */
  ativo?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** Leva a outra tela. */
  to?: string | undefined;
  dica?: string | undefined;
  className?: string | undefined;
}

/**
 * Quadro de número, o mesmo da tela inicial: o número grande em cima, o ícone à direita, o nome
 * e uma observação embaixo. Num espaço estreito vira uma linha (ícone, nome e o número à direita).
 * Clicável (com `to` ou `onClick`), o ícone vira uma seta ao passar o mouse.
 * Use dentro de `<Indices>`, que arruma quantos cabem por linha.
 */
export function Indice({
  valor,
  titulo,
  nota,
  icone: Icone,
  alerta,
  cor,
  compacto,
  ativo,
  onClick,
  to,
  dica,
  className,
}: IndiceProps) {
  // leva a algum lugar (ou abre algo): o ícone vira seta ao passar o mouse. Filtro (com `ativo`) não.
  const seta = Boolean(to) || (Boolean(onClick) && ativo === undefined);
  const miolo = (
    <>
      <span className="hc-indice-valor">
        <Contagem valor={valor} />
      </span>
      {Icone && (
        <span className="hc-indice-icone" aria-hidden>
          <Icone strokeWidth={1.75} />
          {seta && <ArrowUpRight strokeWidth={1.75} />}
        </span>
      )}
      <span className="hc-indice-rotulo">
        {cor && <i className="hc-indice-cor" style={{ background: cor }} aria-hidden />}
        {titulo}
      </span>
      {nota !== undefined && nota !== null && nota !== "" && (
        <span className="hc-indice-nota">{nota}</span>
      )}
    </>
  );
  const props = {
    className: cn("hc-indice", className),
    title: dica,
    "data-alerta": alerta ? "" : undefined,
    "data-compacto": compacto ? "" : undefined,
  };
  if (to)
    return (
      <Link to={to} {...props}>
        {miolo}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-pressed={ativo} {...props}>
        {miolo}
      </button>
    );
  return <div {...props}>{miolo}</div>;
}

/**
 * Grade dos quadros de número. Arruma quantos cabem por linha pela largura que ela mesma tem:
 * um por linha no estreito, dois no médio e todos juntos no largo (sem sobrar um sozinho).
 */
export function Indices({
  children,
  colunas,
  className,
  style,
}: {
  children: ReactNode;
  /** Quantos por linha no espaço largo (o padrão é todos numa linha só). */
  colunas?: number | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const quantos = Children.toArray(children).filter(Boolean).length;
  return (
    <div className={cn("hc-cont", className)} style={style}>
      <div className="hc-indices" style={{ "--quantos": colunas ?? quantos } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
