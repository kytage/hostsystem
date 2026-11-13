import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalBaseProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Modal minimalista reutilizado pelos formulários do financeiro. */
export function ModalBase({ title, subtitle, onClose, children, footer }: ModalBaseProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="mt-8 w-full max-w-2xl rounded-[22px] glass-modal">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
          <div className="min-w-0">
            <h2 className="hc-titulo">{title}</h2>
            {subtitle ? <p className="hc-nota mt-1">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="hc-seta">
            <X className="size-3.5" />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export const inputClasses =
  "w-full rounded-xl border border-input bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/30";

export const labelClasses = "hc-sobre mb-1.5 block";

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="pilula rounded-full">
      {children}
    </button>
  );
}
