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
        className="hc-seta !size-9"
      >
        {isDark ? (
          <Sun className="size-4 shrink-0" strokeWidth={1.75} />
        ) : (
          <Moon className="size-4 shrink-0" strokeWidth={1.75} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
      className="hc-dentro flex w-full items-center gap-2.5 px-2.5 py-2 text-[13px] font-semibold leading-none text-foreground transition-colors"
    >
      {isDark ? (
        <Sun className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      ) : (
        <Moon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      )}
      <span className="truncate">{isDark ? "Modo claro" : "Modo noturno"}</span>
    </button>
  );
}
