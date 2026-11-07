import { useRef, useState } from "react";
import { Bold, Code, Eye, Italic, List, Pencil, SquareCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";

export interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Classe aplicada ao textarea (para manter os estilos de input do projeto). */
  inputClassName?: string;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  disabled?: boolean;
  autoFocus?: boolean;
}

type Acao = {
  key: string;
  label: string;
  icon: typeof Bold;
  before: string;
  after: string;
  /** Insere em linhas novas (blocos). */
  block?: boolean;
  placeholder: string;
};

const ACOES: Acao[] = [
  { key: "bold", label: "Negrito", icon: Bold, before: "**", after: "**", placeholder: "texto" },
  { key: "italic", label: "Itálico", icon: Italic, before: "_", after: "_", placeholder: "texto" },
  { key: "code", label: "Código inline", icon: Code, before: "`", after: "`", placeholder: "código" },
  {
    key: "block",
    label: "Caixa para copiar",
    icon: SquareCode,
    before: "```\n",
    after: "\n```",
    block: true,
    placeholder: "conteúdo para copiar",
  },
  { key: "list", label: "Lista", icon: List, before: "- ", after: "", block: true, placeholder: "item" },
];

export function RichTextarea({
  value,
  onChange,
  placeholder,
  rows = 8,
  className,
  inputClassName,
  onPaste,
  disabled,
  autoFocus,
}: RichTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const aplicar = (acao: Acao) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const selecionado = value.slice(start, end) || acao.placeholder;
    const precisaQuebra = acao.block && start > 0 && value[start - 1] !== "\n";
    const prefixo = precisaQuebra ? "\n" : "";
    const inserido = `${prefixo}${acao.before}${selecionado}${acao.after}`;
    const novo = value.slice(0, start) + inserido + value.slice(end);
    onChange(novo);
    // Reposiciona o cursor selecionando o conteúdo inserido.
    const selStart = start + prefixo.length + acao.before.length;
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selStart + selecionado.length);
    });
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const map: Record<string, string> = { b: "bold", i: "italic", e: "code" };
    const alvo = map[key];
    if (!alvo) return;
    const acao = ACOES.find((a) => a.key === alvo);
    if (!acao) return;
    e.preventDefault();
    aplicar(acao);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {ACOES.map((a) => (
          <button
            key={a.key}
            type="button"
            title={a.label}
            aria-label={a.label}
            disabled={disabled || preview}
            onClick={() => aplicar(a)}
            className="rounded-lg glass-inset p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <a.icon className="size-3.5" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="ml-auto flex items-center gap-1.5 rounded-lg glass-inset px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
          {preview ? "Editar" : "Visualizar"}
        </button>
      </div>

      {preview ? (
        <div
          className={cn(
            "overflow-y-auto rounded-xl glass-inset px-3 py-2",
            inputClassName
          )}
        >
          <RichText value={value} />
        </div>
      ) : (
        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={value}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className={inputClassName}
        />
      )}
    </div>
  );
}
