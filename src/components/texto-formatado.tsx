import { Fragment, useState, type ReactNode } from "react";
import { lerLinha, tipoDaLinha, type No } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/** Spoiler do Discord: fica escondido até clicar. */
function Spoiler({ children }: { children: ReactNode }) {
  const [visto, setVisto] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setVisto(true);
      }}
      onKeyDown={(e) => e.key === "Enter" && setVisto(true)}
      className={cn("tf-spoiler", visto && "tf-spoiler-visto")}
      title={visto ? undefined : "Clique para ver"}
    >
      {children}
    </span>
  );
}

export function nosEmReact(nos: No[], chave = "n"): ReactNode[] {
  return nos.map((n, i) => {
    const k = `${chave}-${i}`;
    if (typeof n === "string") return <Fragment key={k}>{n}</Fragment>;
    if (n.t === "link")
      return (
        <a key={k} href={n.href} target="_blank" rel="noreferrer" className="tf-link" onClick={(e) => e.stopPropagation()}>
          {n.href}
        </a>
      );
    const filhos = nosEmReact(n.filhos, k);
    switch (n.t) {
      case "b":
        return <strong key={k} className="font-semibold text-foreground">{filhos}</strong>;
      case "i":
        return <em key={k} className="italic">{filhos}</em>;
      case "u":
        return <span key={k} className="underline underline-offset-2">{filhos}</span>;
      case "s":
        return <span key={k} className="line-through opacity-80">{filhos}</span>;
      case "code":
        return <code key={k} className="tf-code">{filhos}</code>;
      case "spoiler":
        return <Spoiler key={k}>{filhos}</Spoiler>;
    }
  });
}

/**
 * Mostra um texto com a formatação do Discord (negrito, itálico, título, citação...).
 * Fica "dentro da linha": pode ir no lugar de {texto} num <p> que já tinha whitespace-pre-wrap.
 */
export function TextoFormatado({ texto }: { texto: string | null | undefined }) {
  if (!texto) return null;
  const linhas = texto.split("\n");
  return (
    <>
      {linhas.map((linha, i) => {
        const { tipo, conteudo } = tipoDaLinha(linha);
        const corpo = nosEmReact(lerLinha(conteudo), `l${i}`);
        const quebra = i < linhas.length - 1 ? "\n" : null;
        switch (tipo) {
          case "h1":
            return <span key={i} className="tf-h1">{corpo}</span>;
          case "h2":
            return <span key={i} className="tf-h2">{corpo}</span>;
          case "h3":
            return <span key={i} className="tf-h3">{corpo}</span>;
          case "pequeno":
            return <span key={i} className="tf-pequeno">{corpo}</span>;
          case "citacao":
            return <span key={i} className="tf-citacao">{corpo}</span>;
          case "lista":
            return (
              <span key={i} className="tf-lista">
                <span className="tf-bolinha">•</span>
                <span>{corpo}</span>
              </span>
            );
          default:
            return (
              <Fragment key={i}>
                {corpo}
                {quebra}
              </Fragment>
            );
        }
      })}
    </>
  );
}
