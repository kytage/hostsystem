import { useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renderizador leve de texto formatado (subset de Markdown).
 * Suporta: **negrito**, _itálico_, `code` inline, blocos ``` com botão copiar,
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
  // Divide preservando os delimitadores suportados.
  const tokens = raw.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|https?:\/\/\S+)/g);
  return tokens.filter(Boolean).map((tk, i) => {
    const key = `${keyPrefix}-${i}`;
    if (tk.startsWith("**") && tk.endsWith("**") && tk.length > 4) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {tk.slice(2, -2)}
        </strong>
      );
    }
    if (tk.startsWith("`") && tk.endsWith("`") && tk.length > 2) {
      return (
        <code
          key={key}
          className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {tk.slice(1, -1)}
        </code>
      );
    }
    if (tk.startsWith("_") && tk.endsWith("_") && tk.length > 2) {
      return (
        <em key={key} className="italic">
          {tk.slice(1, -1)}
        </em>
      );
    }
    if (/^https?:\/\//.test(tk)) {
      return (
        <a
          key={key}
          href={tk}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {tk}
        </a>
      );
    }
    return <span key={key}>{tk}</span>;
  });
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
