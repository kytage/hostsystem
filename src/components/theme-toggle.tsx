import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "host-theme";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY) as "dark" | "light") ?? "dark";
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  const isDark = theme === "dark";

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
        title={isDark ? "Modo claro" : "Modo noturno"}
        className="flex size-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-white/10 hover:text-neutral-200"
      >
        {isDark ? (
          <Sun className="size-[18px] shrink-0 text-primary" strokeWidth={1.9} />
        ) : (
          <Moon className="size-[18px] shrink-0 text-primary" strokeWidth={1.9} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
      className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border glass px-2.5 py-2 text-[13px] font-semibold leading-none text-foreground transition-colors hover:bg-white/[0.08]"
    >
      {isDark ? (
        <Sun className="size-4 shrink-0 text-primary" />
      ) : (
        <Moon className="size-4 shrink-0 text-primary" />
      )}
      <span className="truncate">{isDark ? "Modo claro" : "Modo noturno"}</span>
    </button>
  );
}
