import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Home,
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
  PanelLeft,
  Search,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { Logo } from "@/components/dashboard/Logo";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/notifications-bell";
import { QuickPendenciaButton } from "@/components/quick-pendencia";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAuthUserData } from "@/lib/auth-cache";
import { usePrefetchRoute } from "@/lib/prefetch";
import { playSfx, setSfxMuted, sfxMuted } from "@/lib/sfx";
import {
  canAccessCombined,
  useMyAreas,
  useMyRole,
  useAreaPermissions,
  usePermissions,
  ROLE_LABELS,
  type CategoryKey,
} from "@/lib/permissions";

export interface NavEntry {
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
  { title: "Desenvolvimento", icon: Code2, url: "/desenvolvimento", category: "desenvolvimento" },
];

/** Itens exclusivos do Founder (não passam pelo mapa de permissões). */
const founderOnly: NavEntry[] = [{ title: "Financeiro", icon: Wallet, url: "/financeiro" }];

const ops: NavEntry[] = [{ title: "HOST UPDATE 3.0", icon: Rocket, url: "/update" }];

/** Grupos do menu, na ordem em que aparecem. Item que não estiver aqui cai em "Outros". */
export const GRUPOS: { nome: string; itens: string[] }[] = [
  { nome: "Geral", itens: ["Home", "Áreas", "Eventos e Cronograma", "Tarefas"] },
  {
    nome: "Operação",
    itens: ["Comandos Staffs", "Ilegal", "Captações", "Peds", "Players", "Punições"],
  },
  {
    nome: "Gestão",
    itens: ["Equipe", "Marketing", "Área Manager", "Desenvolvimento", "Financeiro"],
  },
  { nome: "Sistema", itens: ["HOST UPDATE 3.0", "Configurações", "Usuários"] },
];
export const grupoDe = (titulo: string) =>
  GRUPOS.find((g) => g.itens.includes(titulo))?.nome ?? "Outros";
export const ehAtual = (item: NavEntry, pathname: string) =>
  pathname === item.url || (item.url === "/areas" && pathname.startsWith("/areas/"));

/** O que o usuário pode abrir no menu e quem ele é. */
export function useMenu() {
  const { data: myRole } = useMyRole();
  const { data: perms } = usePermissions();
  const { data: areaPerms } = useAreaPermissions();
  const { data: myAreas } = useMyAreas();
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
  const pode = (i: NavEntry) =>
    !i.category || canAccessCombined(role, myAreas, i.category, perms, areaPerms);
  const todos: NavEntry[] = [
    ...nav.filter(pode),
    ...(role === "founder" ? founderOnly : []),
    ...ops.filter(pode),
    { title: "Configurações", icon: Settings, url: "/configuracoes" },
    ...(canAccessCombined(role, myAreas, "usuarios", perms, areaPerms)
      ? [{ title: "Usuários", icon: Users, url: "/usuarios" } satisfies NavEntry]
      : []),
  ];
  return {
    role,
    username: profile?.username ?? "",
    avatarUrl: profile?.avatar_url || DEFAULT_AVATAR_URL,
    todos,
  };
}

/** Um item do menu. Aberto: ícone e nome numa linha fina. Fechado: só o ícone, com o nome numa dica ao lado. */
function Item({ item, active, fechado }: { item: NavEntry; active: boolean; fechado: boolean }) {
  const prefetch = usePrefetchRoute(item.url);
  const classes = cn(
    "item-menu w-full text-left",
    active && "item-menu-ativo",
    fechado && "justify-center !px-0",
  );
  const miolo = (
    <>
      <item.icon className="size-[15px] shrink-0" strokeWidth={1.6} />
      {!fechado && (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate">{item.title}</span>
          {item.trailing}
        </span>
      )}
    </>
  );
  const peca = item.url ? (
    <Link
      to={item.url}
      className={classes}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      data-sem-elastico
      data-som-passar
      {...prefetch}
    >
      {miolo}
    </Link>
  ) : (
    <button
      type="button"
      className={classes}
      aria-label={item.title}
      data-sem-elastico
      data-som-passar
    >
      {miolo}
    </button>
  );
  if (!fechado) return peca;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{peca}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={14}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Menu lateral: a única barra do painel. Um painel de vidro solto da borda,
 * com letras pequenas e ícones finos. O botão de abrir e fechar fica sempre
 * no topo. Aqui também moram a busca (Ctrl K), o sino, a pendência rápida e a conta.
 */
export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { role, username, avatarUrl, todos } = useMenu();
  const [fechado, setFechado] = useState(false);
  const [busca, setBusca] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [escuro, setEscuro] = useState(true);

  useEffect(() => {
    const salvo = localStorage.getItem("host-sidebar-collapsed");
    setFechado(salvo === null ? window.innerWidth < 900 : salvo === "1");
    setMudo(sfxMuted());
    setEscuro(document.documentElement.classList.contains("dark"));
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBusca((v) => !v);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const alternarMenu = () =>
    setFechado((f) => {
      localStorage.setItem("host-sidebar-collapsed", f ? "0" : "1");
      return !f;
    });
  const alternarSom = () => {
    const novo = !mudo;
    setSfxMuted(novo);
    setMudo(novo);
    if (!novo) playSfx("success");
  };
  const alternarTema = () => {
    const novo = !escuro;
    setEscuro(novo);
    localStorage.setItem("host-theme", novo ? "dark" : "light");
    document.documentElement.classList.toggle("dark", novo);
  };
  const sair = () => void supabase.auth.signOut();

  const grupos = GRUPOS.map((g) => ({
    nome: g.nome,
    itens: todos.filter((i) => g.itens.includes(i.title)),
  })).filter((g) => g.itens.length > 0);
  const semGrupo = todos.filter((i) => !GRUPOS.some((g) => g.itens.includes(i.title)));
  if (semGrupo.length) grupos.push({ nome: "Outros", itens: semGrupo });
  const paginas = todos.filter((i) => i.url);
  // dois itens podem levar à mesma tela: só o primeiro fica marcado
  const tituloAtual = todos.find((i) => ehAtual(i, pathname))?.title;

  const alternar = (
    <button
      type="button"
      onClick={alternarMenu}
      aria-label={fechado ? "Abrir menu" : "Fechar menu"}
      aria-expanded={!fechado}
      title={fechado ? "Abrir menu" : "Fechar menu"}
      className="grid size-8 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
    >
      <PanelLeft className="size-[15px]" strokeWidth={1.6} />
    </button>
  );

  const conta = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Sua conta"
          data-sem-elastico
          className={cn(
            "flex items-center rounded-xl text-left outline-none hover:bg-white/[0.06]",
            fechado ? "size-9 justify-center" : "min-w-0 flex-1 gap-2 p-1",
          )}
        >
          <img
            src={avatarUrl}
            alt=""
            className="size-7 shrink-0 rounded-[9px] object-cover ring-1 ring-white/10"
          />
          {!fechado && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12px] font-semibold text-foreground">
                  {username || "…"}
                </span>
                <span className="block truncate text-[10px] text-ink-3">{ROLE_LABELS[role]}</span>
              </span>
              <ChevronsUpDown className="size-3 shrink-0 text-ink-3" strokeWidth={1.8} />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={12} className="w-[214px] p-1.5">
        <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
          <img
            src={avatarUrl}
            alt=""
            className="size-8 rounded-[10px] object-cover ring-1 ring-white/10"
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12.5px] font-semibold">{username || "…"}</p>
            <p className="truncate text-[10.5px] text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/configuracoes" })}>
          <Settings strokeWidth={1.6} /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem
          data-sem-som
          onSelect={(e) => {
            e.preventDefault();
            alternarSom();
          }}
        >
          {mudo ? <VolumeX strokeWidth={1.6} /> : <Volume2 strokeWidth={1.6} />} Sons
          <span className="ml-auto text-[10.5px] text-muted-foreground">
            {mudo ? "desligados" : "ligados"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            alternarTema();
          }}
        >
          {escuro ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}{" "}
          {escuro ? "Modo claro" : "Modo noturno"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={sair} className="text-[#ff8f85] focus:text-[#ff8f85]">
          <LogOut strokeWidth={1.6} /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <TooltipProvider delayDuration={60} skipDelayDuration={300}>
      <aside
        data-fechado={fechado}
        className={cn(
          "menu-lateral glass z-30 my-2.5 ml-2.5 flex h-[calc(100svh-1.25rem)] shrink-0 flex-col overflow-hidden rounded-[24px]",
          fechado ? "w-[58px]" : "w-[226px]",
        )}
      >
        {/* topo: a marca e o botão de abrir e fechar, que nunca sai daqui */}
        {fechado ? (
          <div className="flex shrink-0 flex-col items-center gap-2 pt-2.5">
            {alternar}
            <Link to="/" title="HOST" className="grid size-8 place-items-center">
              <Logo className="h-[17px]" />
            </Link>
          </div>
        ) : (
          <div className="flex h-[52px] shrink-0 items-center gap-2 pl-4 pr-2.5">
            <Link to="/" title="HOST" className="flex min-w-0 items-center gap-2.5">
              <Logo className="h-[18px] shrink-0" />
              <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">
                HOST
              </span>
            </Link>
            <div className="ml-auto">{alternar}</div>
          </div>
        )}

        {/* busca */}
        <div className={cn("shrink-0", fechado ? "flex justify-center pt-2" : "px-2.5 pb-1.5")}>
          <button
            type="button"
            onClick={() => setBusca(true)}
            aria-label="Buscar página"
            title="Buscar página (Ctrl K)"
            className={cn(
              "glass-inset flex items-center border text-muted-foreground hover:text-foreground",
              fechado
                ? "size-9 justify-center rounded-xl"
                : "h-[34px] w-full gap-2 rounded-xl px-2.5 text-left text-[12px]",
            )}
          >
            <Search className="size-[14px] shrink-0" strokeWidth={1.7} />
            {!fechado && (
              <>
                <span className="min-w-0 flex-1 truncate">Buscar</span>
                <kbd className="rounded-md border border-white/[0.08] bg-white/[0.05] px-1.5 py-px font-sans text-[9.5px] font-medium text-foreground/70">
                  Ctrl K
                </kbd>
              </>
            )}
          </button>
        </div>

        <nav
          aria-label="Menu principal"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            fechado ? "px-[10px] pt-2" : "px-2.5 pt-1.5",
          )}
        >
          {grupos.map((g, n) => (
            <div
              key={g.nome}
              className={cn(n > 0 && (fechado ? "mt-2 border-t border-white/[0.06] pt-2" : "mt-4"))}
            >
              {!fechado && (
                <p className="px-[9px] pb-1.5 text-[9.5px] font-medium uppercase tracking-[0.2em] text-ink-3">
                  {g.nome}
                </p>
              )}
              <div className="space-y-px">
                {g.itens.map((item) => (
                  <Item
                    key={item.title}
                    item={item}
                    active={item.title === tituloAtual}
                    fechado={fechado}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* rodapé: conta, sino e pendência rápida */}
        {fechado ? (
          <div className="flex shrink-0 flex-col items-center gap-1 border-t border-white/[0.06] pb-2.5 pt-2">
            <NotificationsBell />
            <QuickPendenciaButton />
            {conta}
          </div>
        ) : (
          <div className="shrink-0 p-2.5 pt-1.5">
            <div className="glass-inset flex items-center gap-0.5 rounded-2xl border p-1">
              {conta}
              <NotificationsBell />
              <QuickPendenciaButton />
            </div>
          </div>
        )}
      </aside>

      <CommandDialog open={busca} onOpenChange={setBusca}>
        <CommandInput placeholder="Para onde você quer ir?" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {[...GRUPOS.map((g) => g.nome), "Outros"].map((nome) => {
            const itens = paginas.filter((i) => grupoDe(i.title) === nome);
            if (!itens.length) return null;
            return (
              <CommandGroup key={nome} heading={nome}>
                {itens.map((i) => (
                  <CommandItem
                    key={i.title}
                    value={i.title}
                    onSelect={() => {
                      setBusca(false);
                      void navigate({ to: i.url as string });
                    }}
                  >
                    <i.icon className="size-4" strokeWidth={1.6} /> {i.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </TooltipProvider>
  );
}
