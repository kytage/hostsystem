import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Home,
  Megaphone,
  ShieldCheck,
  Skull,
  Code2,
  Settings,
  Users,
  ClipboardList,
  LogOut,
  Rocket,
  FolderKanban,
  PartyPopper,
  Gavel,
  Handshake,
  Baby,
  NotebookPen,
  Wallet,
  Contact,
  Clapperboard,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { Logo } from "@/components/dashboard/Logo";
import { supabase } from "@/integrations/supabase/client";
import { DevMiniCounts } from "@/components/dev-mini-counts";
import { QuickPendenciaButton } from "@/components/quick-pendencia";
import { getAuthUserData } from "@/lib/auth-cache";
import { usePrefetchRoute } from "@/lib/prefetch";
import {
  canAccessCombined,
  useMyAreas,
  useMyRole,
  useAreaPermissions,
  usePermissions,
  ROLE_LABELS,
  type CategoryKey,
} from "@/lib/permissions";

interface NavEntry {
  title: string;
  icon: LucideIcon;
  url?: string;
  badge?: number;
  category?: CategoryKey;
  trailing?: ReactNode;
}

const nav: NavEntry[] = [
  { title: "Home", icon: Home, url: "/" },
  // Avisos saiu do menu: o quadro fica na tela inicial (a página /avisos continua, pelo atalho do quadro).
  { title: "Comandos Staffs", icon: ShieldCheck, category: "comandos" },
  { title: "Ilegal", icon: Skull, url: "/ilegal", category: "ilegal" },
  { title: "Captações", icon: Handshake, url: "/captacoes", category: "captacoes" },
  { title: "Peds", icon: Baby, url: "/peds", category: "peds" },
  { title: "Áreas", icon: MapIcon, url: "/areas" },
  { title: "Equipe", icon: ClipboardList, url: "/usuarios", category: "controle_staff" },
  { title: "Players", icon: Contact, url: "/players", category: "players" },
  { title: "Marketing", icon: Clapperboard, url: "/marketing", category: "marketing" },
  { title: "Área Manager", icon: FolderKanban, url: "/area-manager", category: "area_manager" },
  { title: "Eventos e Cronograma", icon: PartyPopper, url: "/eventos" },
  { title: "Punições", icon: Gavel, url: "/punicoes", category: "punicoes" },
  { title: "Tarefas", icon: NotebookPen, url: "/tarefas" },
  { title: "Desenvolvimento", icon: Code2, url: "/desenvolvimento", category: "desenvolvimento", trailing: <DevMiniCounts /> },
];

/** Itens exclusivos do Founder (não passam pelo mapa de permissões). */
const founderOnly: NavEntry[] = [
  { title: "Financeiro", icon: Wallet, url: "/financeiro" },
];

const ops: NavEntry[] = [
  { title: "HOST UPDATE 3.0", icon: Rocket, url: "/update" },
];

/* ---- Icon-only button (rail style, used in footer + collapsed) ---- */

function RailIcon({
  item,
  active,
}: {
  item: NavEntry;
  active: boolean;
}) {
  const classes = cn(
    "group relative flex size-8 items-center justify-center rounded-lg transition-colors",
    item.url === "/update"
      ? active ? "bg-update/15 text-update ring-1 ring-update/25" : "text-update/80 hover:bg-update/10 hover:text-update"
      : active
      ? "bg-white/[0.08] text-foreground ring-1 ring-white/[0.06]"
      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
  );

  const dot = active && (
    <span className={cn("absolute -left-[11px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full", item.url === "/update" ? "bg-update" : "bg-primary")} />
  );

  const label = (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap glass-elevated rounded-lg px-2.5 py-1 text-[11px] font-medium text-foreground group-hover:block">
      {item.title}
    </span>
  );

  const icon = <item.icon className="size-4" strokeWidth={1.9} />;

  if (!item.url) {
    return (
      <button type="button" className={classes}>
        {dot}
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Link to={item.url} className={classes}>
      {dot}
      {icon}
      {label}
    </Link>
  );
}

/* ---- Aligned row: icon cell (rail) + label cell (panel) ---- */

function NavRow({ item, active }: { item: NavEntry; active: boolean }) {
  const prefetch = usePrefetchRoute(item.url);
  const iconClasses = cn(
    "group relative mx-auto flex size-8 items-center justify-center rounded-lg transition-colors",
    item.url === "/update"
      ? active ? "bg-update/15 text-update ring-1 ring-update/25" : "text-update/80 hover:bg-update/10 hover:text-update"
      : active
      ? "bg-white/[0.08] text-foreground ring-1 ring-white/[0.06]"
      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
  );

  const dot = active && (
    <span className={cn("absolute -left-[13px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-full", item.url === "/update" ? "bg-update" : "bg-primary")} />
  );

  const tooltip = (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-neutral-200 shadow-lg group-hover:block">
      {item.title}
    </span>
  );

  const iconEl = item.url ? (
    <Link to={item.url} className={iconClasses} {...prefetch}>
      {dot}
      <item.icon className="size-4" strokeWidth={1.9} />
      {tooltip}
    </Link>
  ) : (
    <button type="button" className={iconClasses}>
      {dot}
      <item.icon className="size-4" strokeWidth={1.9} />
      {tooltip}
    </button>
  );

  const labelClasses = cn(
    "flex w-full items-center rounded-xl px-3 py-1.5 text-left text-[13.5px] font-medium leading-tight transition-colors duration-200",
    item.url === "/update"
      ? active ? "bg-update/10 text-update ring-1 ring-update/20" : "text-update/80 hover:bg-update/5 hover:text-update"
      : active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-white/[0.04] hover:text-foreground"
  );

  const labelText = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="truncate">{item.title}</span>
      {item.trailing}
    </span>
  );

  const labelEl = item.url ? (
    <Link to={item.url} className={labelClasses} {...prefetch}>
      {labelText}
    </Link>
  ) : (
    <button type="button" className={labelClasses}>
      {labelText}
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-center">{iconEl}</div>
      <div className="px-2">{labelEl}</div>
    </>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: myRole } = useMyRole();
  const { data: perms } = usePermissions();
  const { data: areaPerms } = useAreaPermissions();
  const { data: myAreas } = useMyAreas();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(localStorage.getItem("host-sidebar-collapsed") === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("host-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const { data: profile } = useQuery({
    queryKey: ["my-username"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) return { username: "", avatar_url: "" };
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { username: data?.username ?? "", avatar_url: data?.avatar_url ?? "" };
    },
    staleTime: 60_000,
  });

  const role = myRole ?? "staff";
  const username = profile?.username ?? "";
  const avatarUrl = profile?.avatar_url || DEFAULT_AVATAR_URL;

  const visibleNav = [
    ...nav.filter(
      (i) => !i.category || canAccessCombined(role, myAreas, i.category, perms, areaPerms)
    ),
    ...(role === "founder" ? founderOnly : []),
  ];
  const visibleOps = ops.filter(
    (i) => !i.category || canAccessCombined(role, myAreas, i.category, perms, areaPerms)
  );
  const podeUsuarios = canAccessCombined(role, myAreas, "usuarios", perms, areaPerms);

  const settingsEntry: NavEntry = { title: "Configurações", icon: Settings, url: "/configuracoes" };
  const usersEntry: NavEntry = { title: "Usuários", icon: Users, url: "/usuarios" };

  const ToggleButton = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
      className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      {collapsed ? (
        <PanelLeftOpen className="size-4" strokeWidth={1.9} />
      ) : (
        <PanelLeftClose className="size-4" strokeWidth={1.9} />
      )}
    </button>
  );

  /* ---------------- Collapsed: icon rail only ---------------- */
  if (collapsed) {
    return (
      <div className="glass-elevated sticky top-3 z-30 my-3 ml-3 flex h-[calc(100svh-1.5rem)] w-14 shrink-0 flex-col items-center overflow-hidden rounded-[22px]">
      <div className="flex flex-col items-center gap-2 pt-2.5">
          <Link
            to="/"
            className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            title="HOST"
          >
            <Logo className="h-[22px]" />
          </Link>
          <NotificationsBell />
          <QuickPendenciaButton />
          {ToggleButton}
        </div>

        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none]">
          <div className="flex flex-col items-center gap-1 py-1">
            {visibleNav.map((item) => (
              <RailIcon key={item.title} item={item} active={pathname === item.url || (item.url === "/areas" && pathname.startsWith("/areas/"))} />
            ))}
          </div>
        </div>

        {visibleOps.length > 0 && (
          <div className="w-full border-t border-white/5 py-1.5">
            <div className="flex flex-col items-center gap-1">
              {visibleOps.map((item) => (
                <RailIcon key={item.title} item={item} active={pathname === item.url || (item.url === "/areas" && pathname.startsWith("/areas/"))} />
              ))}
            </div>
          </div>
        )}

        <div className="w-full border-t border-white/5 py-1.5">
          <div className="flex flex-col items-center gap-1">
            <RailIcon item={settingsEntry} active={pathname === "/configuracoes"} />
            {podeUsuarios && <RailIcon item={usersEntry} active={pathname === "/usuarios"} />}
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              aria-label="Sair"
              title="Sair"
              className="flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" strokeWidth={1.9} />
            </button>
            <img
              src={avatarUrl}
              alt={username}
              className="mt-0.5 size-7 rounded-full border border-white/10 object-cover"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Expanded: rail + panel ---------------- */
  return (
    <div className="glass-elevated sticky top-3 z-30 my-3 ml-3 flex h-[calc(100svh-1.5rem)] shrink-0 overflow-hidden rounded-[22px]">
      {/* Persistent column backgrounds (do not scroll) */}
      <div className="pointer-events-none absolute inset-y-0 left-14 w-px bg-white/[0.05]" aria-hidden />

      <div className="relative grid h-full w-[264px] shrink-0 grid-cols-[56px_208px] grid-rows-[auto_minmax(0,1fr)_auto_auto]">
        {/* ---- Header row ---- */}
        <div className="flex flex-col items-center gap-2 pt-2.5">
          <Link
            to="/"
            className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            title="HOST"
          >
            <Logo className="h-[22px]" />
          </Link>
          <NotificationsBell />
          <QuickPendenciaButton />
          {ToggleButton}
        </div>
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold leading-tight text-foreground">
              {username || "..."}
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Recolher menu"
            title="Recolher menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeftClose className="size-4" strokeWidth={2} />
          </button>
        </div>

        {/* ---- Nav (single area keeps both columns aligned) ---- */}
        <div className="col-span-2 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin]">
          <div className="grid grid-cols-[56px_208px] gap-y-1 py-0.5">

            {visibleNav.map((item) => (
              <NavRow key={item.title} item={item} active={pathname === item.url || (item.url === "/areas" && pathname.startsWith("/areas/"))} />
            ))}
          </div>
        </div>

        {/* ---- Ops (pinned bottom, aligned) ---- */}
        {visibleOps.length > 0 && (
          <div className="col-span-2 border-t border-sidebar-border">
            <div className="grid grid-cols-[56px_208px] gap-y-1 py-1.5">
              {visibleOps.map((item) => (
                <NavRow key={item.title} item={item} active={pathname === item.url || (item.url === "/areas" && pathname.startsWith("/areas/"))} />
              ))}
            </div>
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="col-span-2 border-t border-sidebar-border">
          <div className="grid grid-cols-[56px_208px]">
            <div className="flex flex-col items-center gap-1 py-1.5">
              <RailIcon item={settingsEntry} active={pathname === "/configuracoes"} />
              {podeUsuarios && <RailIcon item={usersEntry} active={pathname === "/usuarios"} />}
              <img
                src={avatarUrl}
                alt={username}
                className="mt-0.5 size-7 rounded-full border border-white/10 object-cover"
              />
            </div>
            <div className="flex flex-col gap-1 px-2.5 py-2.5">
              <ThemeToggle />
              <button
                onClick={() => void supabase.auth.signOut()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium leading-none text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4 shrink-0" /> <span className="truncate">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
