import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ClipboardEventHandler,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEventHandler,
} from "react";
import { htmlParaMarkdown, markdownParaHtml } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/** O mesmo formato do onChange de um textarea (dá para trocar <textarea> por <EditorTexto>). */
export interface MudancaTexto {
  target: { value: string };
  currentTarget: { value: string };
}

export interface EditorTextoProps {
  value: string | null | undefined;
  onChange?: (e: MudancaTexto) => void | undefined;
  placeholder?: string | undefined;
  rows?: number | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  id?: string | undefined;
  autoFocus?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Só leitura (igual ao readOnly do textarea). */
  readOnly?: boolean | undefined;
  maxLength?: number | undefined;
  name?: string | undefined;
  required?: boolean | undefined;
  "aria-label"?: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onKeyDown?: KeyboardEventHandler<any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPaste?: ClipboardEventHandler<any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBlur?: FocusEventHandler<any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFocus?: FocusEventHandler<any> | undefined;
}

/**
 * Campo de texto que já mostra a formatação (negrito, itálico, título...) enquanto escreve, igual ao
 * Discord. O texto continua guardado com as marcas (**negrito**), então tudo o que já existia
 * continua funcionando e as telas mostram formatado (TextoFormatado / RichText).
 * Selecionar um trecho abre a barra de formatação (src/components/barra-formatacao.tsx).
 */
export const EditorTexto = forwardRef<HTMLDivElement, EditorTextoProps>(function EditorTexto(
  { value, onChange, placeholder, rows = 3, className, style, id, autoFocus, disabled: desligado, readOnly, maxLength, onKeyDown, onPaste, onBlur, onFocus, ...resto },
  ref,
) {
  const disabled = desligado || readOnly;
  const el = useRef<HTMLDivElement>(null);
  const ultimo = useRef<string | null>(null);
  useImperativeHandle(ref, () => el.current as HTMLDivElement);

  // texto novo vindo de fora (abriu outro registro, limpou o campo...): redesenha
  useLayoutEffect(() => {
    const v = value ?? "";
    if (!el.current || v === ultimo.current) return;
    el.current.innerHTML = markdownParaHtml(v);
    ultimo.current = v;
  }, [value]);

  useLayoutEffect(() => {
    if (!autoFocus || !el.current) return;
    el.current.focus();
    // cursor no fim
    const r = document.createRange();
    r.selectNodeContents(el.current);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  }, [autoFocus]);

  const mudou = () => {
    const div = el.current;
    if (!div) return;
    let md = htmlParaMarkdown(div);
    if (maxLength && md.length > maxLength) md = md.slice(0, maxLength);
    // apagou tudo: limpa de verdade (para o texto de exemplo aparecer de novo)
    if (!md && div.innerHTML !== "") div.innerHTML = "";
    if (md === ultimo.current) return;
    ultimo.current = md;
    onChange?.({ target: { value: md }, currentTarget: { value: md } });
  };

  return (
    <div
      ref={el}
      id={id}
      role="textbox"
      aria-multiline="true"
      aria-label={resto["aria-label"] ?? placeholder}
      aria-disabled={disabled || undefined}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-editor-texto=""
      data-placeholder={placeholder}
      spellCheck
      className={cn("editor-texto", className)}
      style={{ minHeight: `${Math.max(1, rows) * 1.55 + 1.1}em`, ...style }}
      onInput={mudou}
      onBlur={(e) => {
        mudou();
        onBlur?.(e);
      }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        onPaste?.(e);
        if (e.defaultPrevented) return;
        // colar sempre como texto (sem trazer cor/fonte de outro site)
        const texto = e.clipboardData.getData("text/plain");
        if (!texto) return;
        e.preventDefault();
        document.execCommand("insertText", false, texto);
      }}
    />
  );
});
