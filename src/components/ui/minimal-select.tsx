import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MinimalSelectOption {
  value: string;
  label: string;
}

export interface MinimalSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: MinimalSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Select minimalista — substitui o <select> nativo (que renderiza o popup
 * cinza/azul do sistema operacional) por um dropdown tematizado com os
 * tokens do design system.
 */
export function MinimalSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar...",
  className,
  disabled,
}: MinimalSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-left text-[13px] transition-colors hover:border-white/[0.15] focus:border-white/30 focus:outline-none disabled:opacity-50",
          open && "border-white/30",
          selected ? "text-foreground" : "text-muted-foreground/70",
          className
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full min-w-40 overflow-auto rounded-xl glass-modal p-1"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-white/[0.07] font-medium text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">
              Nenhuma opção disponível.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
