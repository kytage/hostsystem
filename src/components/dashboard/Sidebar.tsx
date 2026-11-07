import {
  Home, Megaphone, Shield, ShieldAlert, ShieldCheck, Smile, ClipboardList, FolderKanban,
  Sparkles, Gavel, ListTodo, Code2, Wallet, Rocket, Settings, Users, Sun, LogOut,
  PanelLeft, Inbox, CheckCircle2, MoreHorizontal, type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

type NavItem = { label: string; icon: LucideIcon; dev?: boolean };

export const navItems: NavItem[] = [
  { label: "Home", icon: Home },
  { label: "Avisos", icon: Megaphone },
  { label: "Comandos Staffs", icon: Shield },
  { label: "Ilegal", icon: ShieldAlert },
  { label: "Captações", icon: ShieldCheck },
  { label: "Peds", icon: Smile },
  { label: "Equipe", icon: ClipboardList },
  { label: "Área Manager", icon: FolderKanban },
  { label: "Eventos e Cronograma", icon: Sparkles },
  { label: "Punições", icon: Gavel },
  { label: "Tarefas", icon: ListTodo },
  { label: "Desenvolvimento", icon: Code2, dev: true },
  { label: "Financeiro", icon: Wallet },
];

const devCounts = [
  { icon: Inbox, value: 1, label: "aguardando" },
  { icon: Code2, value: 48, label: "em dev" },
  { icon: CheckCircle2, value: 0, label: "concluídas" },
];

type NavProps = { active: number; onSelect: (i: number) => void };

function Tooltip({ children, show }: { children: string; show: boolean }) {
  if (!show) return null;
  return (
    <span className="glass-elevated pointer-events-none absolute left-[calc(100%+14px)] top-1/2 z-50 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium text-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
      {children}
    </span>
  );
}

function RailButton({
  icon: Icon, label, open, active, onClick, children,
}: {
  icon: LucideIcon; label: string; open: boolean; active?: boolean; onClick?: () => void; children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 w-full items-center gap-3 rounded-xl px-[13px] text-left text-[13px] transition-colors duration-200",
        active ? "bg-white/[0.07] text-foreground" : "text-ink-2 hover:bg-white/[0.035] hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-all duration-300",
          active ? "opacity-100" : "scale-y-0 opacity-0",
        )}
      />
      <Icon className={cn("h-[17px] w-[17px] shrink-0", active && "text-foreground")} strokeWidth={1.6} />
      <span className={cn("flex-1 truncate transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none w-0 opacity-0")}>
        {label}
      </span>
      {children}
      <Tooltip show={!open}>{label}</Tooltip>
    </button>
  );
}

export function Sidebar({ active, onSelect }: NavProps) {
  const [open, setOpen] = useState(false);

  return (
    <aside
      className={cn(
        "glass-elevated sticky top-4 z-30 my-4 ml-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-[22px] p-2.5 transition-[width] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] md:flex",
        open ? "w-[236px]" : "w-[64px]",
      )}
    >
      <div className="flex h-11 items-center gap-2.5 px-1.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center">
          <Logo className="h-[22px]" />
        </span>
        {open && (
          <div className="min-w-0 flex-1 animate-rise">
            <p className="font-display text-sm font-semibold leading-tight">HOST</p>
            <p className="text-[11px] text-ink-3">Painel FiveM</p>
          </div>
        )}
      </div>

      <RailButton icon={PanelLeft} label={open ? "Recolher menu" : "Expandir menu"} open={open} onClick={() => setOpen((v) => !v)} />

      <div className="mx-2 my-2 h-px bg-white/[0.06]" />

      <nav className="flex flex-col gap-0.5" aria-label="Principal">
        {navItems.map((it, i) => (
          <RailButton key={it.label} icon={it.icon} label={it.label} open={open} active={i === active} onClick={() => onSelect(i)}>
            {it.dev && !open && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />}
            {it.dev && open && (
              <span className="flex items-center gap-1.5 text-[10px] tabular-nums text-ink-3">
                {devCounts.map((c) => (
                  <span key={c.label} title={`${c.value} ${c.label}`} className="flex items-center gap-0.5">
                    <c.icon className="h-2.5 w-2.5" strokeWidth={2} />
                    {c.value}
                  </span>
                ))}
              </span>
            )}
          </RailButton>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <div className="mx-2 my-2 h-px bg-white/[0.06]" />
        <RailButton icon={Rocket} label="HOST Update 2.1" open={open} />
        <RailButton icon={Settings} label="Configurações" open={open} />
        <RailButton icon={Users} label="Usuários" open={open} />
        <RailButton icon={Sun} label="Modo claro" open={open} />
        <RailButton icon={LogOut} label="Sair" open={open} />
      </div>
    </aside>
  );
}

const mobileSlots = [0, 10, 11, 8];

export function MobileNav({ active, onSelect }: NavProps) {
  return (
    <nav
      aria-label="Principal"
      className="glass-elevated fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-full p-1.5 md:hidden"
    >
      {mobileSlots.map((i) => {
        const it = navItems[i]!;
        const on = i === active;
        return (
          <button
            key={it.label}
            onClick={() => onSelect(i)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10px] transition-colors duration-200",
              on ? "bg-white/[0.08] text-foreground" : "text-ink-2",
            )}
          >
            <it.icon className={cn("h-[18px] w-[18px]", on && "text-primary")} strokeWidth={1.6} />
            {it.dev ? "Dev" : it.label.split(" ")[0]}
          </button>
        );
      })}
      <button className="flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10px] text-ink-2">
        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.6} />
        Mais
      </button>
    </nav>
  );
}
