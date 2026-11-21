import { useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { lerLinha, tipoDaLinha } from "@/lib/formatacao";
import { nosEmReact } from "@/components/texto-formatado";

/**
 * Renderizador leve de texto formatado (subset de Markdown).
 * Suporta a formatação do Discord (src/lib/formatacao.ts): **negrito**, *itálico*, __sublinhado__,
 * ~~riscado~~, ||spoiler||, `code`, títulos (#), citação (>), blocos ``` com botão copiar,
 * listas com "- " e links http.
 */

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="group relative my-2 rounded-xl glass-inset">
      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar texto"
        className="absolute right-2 top-2 flex items-center gap-1 rounded-lg glass-modal px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-3 pr-24 font-mono text-xs text-foreground">
        {text}
      </pre>
    </div>
  );
}

function renderInline(raw: string, keyPrefix: string) {
  return nosEmReact(lerLinha(raw), keyPrefix);
}

export interface RichTextProps extends ComponentProps<"div"> {
  value: string;
}

export function RichText({ value, className, ...rest }: RichTextProps) {
  if (!value?.trim()) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)} {...rest}>
        Sem descrição.
      </p>
    );
  }

  const blocks = value.split(/```/g);

  return (
    <div className={cn("space-y-1 text-sm leading-relaxed text-foreground", className)} {...rest}>
      {blocks.map((block, bi) => {
        // Índices ímpares são blocos de código (entre ```)
        if (bi % 2 === 1) {
          return <CopyBox key={`b${bi}`} text={block.replace(/^\n|\n$/g, "")} />;
        }
        return block.split("\n").map((line, li) => {
          const key = `b${bi}-l${li}`;
          if (!line.trim()) return <div key={key} className="h-2" />;
          const { tipo, conteudo } = tipoDaLinha(line);
          if (tipo === "h1") return <p key={key} className="tf-h1">{renderInline(conteudo, key)}</p>;
          if (tipo === "h2") return <p key={key} className="tf-h2">{renderInline(conteudo, key)}</p>;
          if (tipo === "h3") return <p key={key} className="tf-h3">{renderInline(conteudo, key)}</p>;
          if (tipo === "pequeno") return <p key={key} className="tf-pequeno">{renderInline(conteudo, key)}</p>;
          if (tipo === "citacao") return <p key={key} className="tf-citacao">{renderInline(conteudo, key)}</p>;
          if (/^\s*[-*]\s+/.test(line)) {
            return (
              <div key={key} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{renderInline(line.replace(/^\s*[-*]\s+/, ""), key)}</span>
              </div>
            );
          }
          return <p key={key}>{renderInline(line, key)}</p>;
        });
      })}
    </div>
  );
}
