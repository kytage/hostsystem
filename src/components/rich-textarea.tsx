import { useRef } from "react";
import { Bold, Code, Italic, List, SquareCode, Strikethrough, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorTexto } from "@/components/editor-texto";

export interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Classe aplicada ao campo (para manter os estilos de input do projeto). */
  inputClassName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPaste?: React.ClipboardEventHandler<any>;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Campo de descrição com botões de formatação. Mostra o texto já formatado enquanto escreve
 * (igual ao Discord); selecionar um trecho também abre a barra flutuante.
 */
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
  const ref = useRef<HTMLDivElement>(null);

  /** Garante o cursor dentro deste campo antes de aplicar (se não estiver, vai para o fim). */
  const focar = () => {
    const ed = ref.current;
    if (!ed) return false;
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !ed.contains(s.getRangeAt(0).commonAncestorContainer)) {
      ed.focus();
      const r = document.createRange();
      r.selectNodeContents(ed);
      r.collapse(false);
      s?.removeAllRanges();
      s?.addRange(r);
    }
    return true;
  };
  const avisar = () => ref.current?.dispatchEvent(new Event("input", { bubbles: true }));

  const comando = (c: string) => () => {
    if (!focar()) return;
    document.execCommand(c);
    avisar();
  };
  const codigo = () => {
    if (!focar()) return;
    const s = window.getSelection();
    const r = s?.getRangeAt(0);
    if (!r) return;
    const el = document.createElement("code");
    el.textContent = r.toString() || "código";
    r.deleteContents();
    r.insertNode(el);
    avisar();
  };
  const linhas = (antes: string, depois = "") => () => {
    if (!focar()) return;
    const texto = window.getSelection()?.toString() || "";
    document.execCommand("insertText", false, `${antes}${texto}${depois}`);
    avisar();
  };

  const acoes = [
    { label: "Negrito (Ctrl+B)", icon: Bold, f: comando("bold") },
    { label: "Itálico (Ctrl+I)", icon: Italic, f: comando("italic") },
    { label: "Sublinhado (Ctrl+U)", icon: Underline, f: comando("underline") },
    { label: "Riscado", icon: Strikethrough, f: comando("strikeThrough") },
    { label: "Código", icon: Code, f: codigo },
    { label: "Caixa para copiar", icon: SquareCode, f: linhas("```\n", "\n```") },
    { label: "Lista", icon: List, f: linhas("- ") },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {acoes.map((a) => (
          <button
            key={a.label}
            type="button"
            title={a.label}
            aria-label={a.label}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={a.f}
            className="rounded-lg glass-inset p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <a.icon className="size-3.5" />
          </button>
        ))}
        <span className="ml-auto text-[10.5px] text-ink-3">Selecione o texto para mais opções</span>
      </div>
      <EditorTexto
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        className={inputClassName}
      />
    </div>
  );
}
