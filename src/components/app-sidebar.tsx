import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Home,
  ShieldCheck,
  Skull,
  Code2,
  Users,
  ClipboardList,
  LogOut,
  Rocket,
  FolderKanban,
  PartyPopper,
  Gavel,
  Handshake,
  Baby,
  CircleUserRound,
  Wallet,
  FlaskConical,
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
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  useMyUserPermissions,
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
  /** Item em destaque no menu (vermelho com brilho). */
  destaque?: boolean;
}

const nav: NavEntry[] = [
  { title: "Home", icon: Home, url: "/" },
  { title: "Perfil & Agenda", icon: CircleUserRound, url: "/perfil", destaque: true },
  // Avisos saiu do menu: o quadro fica na tela inicial (a página /avisos continua, pelo atalho do quadro).
  { title: "Comandos Staffs", icon: ShieldCheck, url: "/comandos", category: "comandos" },
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
  { title: "Desenvolvimento", icon: Code2, url: "/desenvolvimento", category: "desenvolvimento" },
];

/** Itens exclusivos do Founder (não passam pelo mapa de permissões). */
const founderOnly: NavEntry[] = [
  { title: "Financeiro", icon: Wallet, url: "/financeiro" },
  { title: "TESTE", icon: FlaskConical, url: "/teste" },
];

const ops: NavEntry[] = [{ title: "HOST UPDATE 3.0", icon: Rocket, url: "/update" }];

/** Grupos do menu, na ordem em que aparecem. Item que não estiver aqui cai em "Outros". */
export const GRUPOS: { nome: string; itens: string[] }[] = [
  { nome: "Geral", itens: ["Home", "Perfil & Agenda", "Áreas", "Eventos e Cronograma"] },
  {
    nome: "Operação",
    itens: ["Comandos Staffs", "Ilegal", "Captações", "Peds", "Players", "Punições"],
  },
  {
    nome: "Gestão",
    itens: ["Equipe", "Marketing", "Área Manager", "Desenvolvimento", "Financeiro"],
  },
  { nome: "Sistema", itens: ["HOST UPDATE 3.0", "Usuários", "TESTE"] },
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
  const { data: userPerms } = useMyUserPermissions();
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
    !i.category || canAccessCombined(role, myAreas, i.category, perms, areaPerms, userPerms);
  const todos: NavEntry[] = [
    ...nav.filter(pode),
    ...(role === "founder" ? founderOnly : []),
    ...ops.filter(pode),
    ...(canAccessCombined(role, myAreas, "usuarios", perms, areaPerms, userPerms)
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

/**
 * Um botão do menu. Todos seguem o mesmo padrão: ícone numa caixa de 20 px, nome em uma linha e
 * 34 px de altura. Fechado: só o ícone, com o nome numa dica ao lado. A página ativa ganha um
 * grafite mais claro e um traço vermelho; o item em destaque, um ponto vermelho.
 */
function Item({
  item,
  active,
  fechado,
  aoIr,
}: {
  item: NavEntry;
  active: boolean;
  fechado: boolean;
  /** chamado ao escolher a página (em tela estreita, fecha o menu que estava por cima) */
  aoIr: () => void;
}) {
  const prefetch = usePrefetchRoute(item.url);
  const classes = cn("menu-item", fechado && "menu-item-so-icone");
  const miolo = (
    <>
      <span className="menu-item-icone" aria-hidden>
        <item.icon className="size-4" strokeWidth={1.75} />
      </span>
      {!fechado && (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate">{item.title}</span>
          {item.trailing}
        </span>
      )}
      {item.destaque && <span className="menu-item-ponto" aria-hidden />}
    </>
  );
  const peca = item.url ? (
    <Link
      to={item.url}
      className={classes}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      data-ativo={active ? "" : undefined}
      data-sem-elastico
      data-som-passar
      {...prefetch}
      onClick={aoIr}
    >
      {miolo}
    </Link>
  ) : (
    <button
      type="button"
      className={classes}
      aria-label={item.title}
      data-ativo={active ? "" : undefined}
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
 * Menu lateral: a única barra do painel. Um painel de grafite preso à borda,
 * separado da página por um fio, com letras pequenas e ícones finos. O botão
 * de abrir e fechar fica sempre no topo. Aqui também moram a busca (Ctrl K),
 * o sino, a pendência rápida e a conta. Em tela estreita a barra fica só com
 * os ícones e, quando aberta, vem por cima da página.
 */
export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { role, username, avatarUrl, todos } = useMenu();
  const [fechado, setFechado] = useState(false);
  const [estreito, setEstreito] = useState(false);
  const [busca, setBusca] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [escuro, setEscuro] = useState(true);

  useEffect(() => {
    setMudo(sfxMuted());
    setEscuro(document.documentElement.classList.contains("dark"));
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBusca((v) => !v);
      }
    };
    window.addEventListener("keydown", tecla);
    const telas = window.matchMedia("(max-width: 767px)");
    const medir = () => {
      setEstreito(telas.matches);
      // em tela estreita começa sempre fechado; nas outras vale o que a pessoa escolheu
      const salvo = localStorage.getItem("host-sidebar-collapsed");
      setFechado(telas.matches || (salvo === null ? window.innerWidth < 900 : salvo === "1"));
    };
    medir();
    telas.addEventListener("change", medir);
    return () => {
      window.removeEventListener("keydown", tecla);
      telas.removeEventListener("change", medir);
    };
  }, []);

  // menu aberto por cima da página (tela estreita): Esc fecha
  const porCima = estreito && !fechado;
  useEffect(() => {
    if (!porCima) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFechado(true);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [porCima]);

  const alternarMenu = () =>
    setFechado((f) => {
      // a escolha só é guardada em tela larga: no celular o menu abre e fecha sem mexer nela
      if (!estreito) localStorage.setItem("host-sidebar-collapsed", f ? "0" : "1");
      return !f;
    });
  /** Ao escolher uma página em tela estreita, o menu que estava por cima se fecha. */
  const aoIr = () => {
    if (estreito) setFechado(true);
  };

  // se o menu não cabe na altura da janela, a lista rola: um esfumado avisa que há mais botões
  const lista = useRef<HTMLElement>(null);
  const [rola, setRola] = useState({ acima: false, abaixo: false });
  useEffect(() => {
    const nav = lista.current;
    if (!nav) return;
    const medir = () => {
      const acima = nav.scrollTop > 4;
      const abaixo = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 4;
      setRola((r) => (r.acima === acima && r.abaixo === abaixo ? r : { acima, abaixo }));
    };
    medir();
    nav.addEventListener("scroll", medir, { passive: true });
    const tamanho = new ResizeObserver(medir);
    tamanho.observe(nav);
    return () => {
      nav.removeEventListener("scroll", medir);
      tamanho.disconnect();
    };
  }, [fechado, todos.length]);
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
      data-sem-elastico
      className="menu-botao"
    >
      <PanelLeft className="size-4" strokeWidth={1.75} />
    </button>
  );

  const conta = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Configurações e conta"
          title="Configurações e conta"
          data-sem-elastico
          className={cn(
            "menu-conta",
            fechado ? "size-[38px] justify-center" : "min-w-0 flex-1 gap-2.5 p-1",
          )}
        >
          {/* ícone de configurações no lugar da foto (que repetia o H do topo); a foto fica dentro do menu */}
          <span className="menu-config" aria-hidden>
            <Settings className="size-4" strokeWidth={1.75} />
          </span>
          {!fechado && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="menu-conta-nome block truncate text-[12.5px] font-semibold">
                  {username || "…"}
                </span>
                <span className="menu-conta-cargo mt-px block truncate text-[10.5px]">
                  {ROLE_LABELS[role]}
                </span>
              </span>
              <ChevronsUpDown className="menu-conta-cargo size-3.5 shrink-0" strokeWidth={1.75} />
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
      {/* tela estreita com o menu aberto: um véu escurece a página e um espaço guarda o lugar da barra */}
      {porCima && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            data-sem-elastico
            className="menu-veu"
            onClick={() => setFechado(true)}
          />
          <div aria-hidden className="w-[70px] shrink-0" />
        </>
      )}
      <aside
        data-fechado={fechado}
        className={cn(
          "menu-lateral",
          porCima ? "menu-lateral-por-cima w-[248px]" : "mr-2.5",
          !porCima && (fechado ? "w-[60px]" : "w-[234px]"),
        )}
      >
        {/* topo: a marca e o botão de abrir e fechar, que nunca sai daqui */}
        {fechado ? (
          <div className="flex shrink-0 flex-col items-center gap-2 pt-2.5">
            {alternar}
            <Link to="/" title="HOST" aria-label="HOST" className="menu-selo">
              <Logo className="h-[14px]" />
            </Link>
          </div>
        ) : (
          <div className="flex h-[54px] shrink-0 items-center gap-2 pl-[13px] pr-2.5">
            <Link to="/" title="HOST" className="menu-marca" onClick={aoIr}>
              <span className="menu-selo">
                <Logo className="h-[14px]" />
              </span>
              <span className="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
                HOST
              </span>
            </Link>
            <div className="ml-auto">{alternar}</div>
          </div>
        )}

        {/* busca */}
        <div className={cn("shrink-0", fechado ? "flex justify-center pt-1.5" : "px-2.5 pb-1.5")}>
          <button
            type="button"
            onClick={() => setBusca(true)}
            aria-label="Buscar página"
            title="Buscar página (Ctrl K)"
            data-sem-elastico
            className={cn("menu-busca", fechado && "menu-busca-so-icone")}
          >
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            {!fechado && (
              <>
                <span className="min-w-0 flex-1 truncate">Buscar</span>
                <kbd className="menu-tecla">Ctrl K</kbd>
              </>
            )}
          </button>
        </div>

        <nav
          ref={lista}
          aria-label="Menu principal"
          data-mais-acima={rola.acima ? "" : undefined}
          data-mais-abaixo={rola.abaixo ? "" : undefined}
          className={cn(
            "menu-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            fechado ? "flex flex-col items-center pt-1.5" : "px-2.5 pt-1.5",
          )}
        >
          {grupos.map((g, n) => (
            <div
              key={g.nome}
              className={cn(
                n > 0 &&
                  (fechado ? "mt-1.5 border-t border-[color:var(--gf-linha)] pt-1.5" : "mt-4"),
              )}
            >
              {!fechado && <p className="menu-grupo">{g.nome}</p>}
              <div className="flex flex-col gap-0.5">
                {g.itens.map((item) => (
                  <Item
                    key={item.title}
                    item={item}
                    active={item.title === tituloAtual}
                    fechado={fechado}
                    aoIr={aoIr}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* rodapé: conta, sino e pendência rápida */}
        {fechado ? (
          <div className="flex shrink-0 flex-col items-center gap-0.5 border-t border-[color:var(--gf-linha)] pb-2.5 pt-2">
            <NotificationsBell />
            <QuickPendenciaButton />
            {conta}
          </div>
        ) : (
          <div className="shrink-0 p-2.5 pt-2">
            <div className="menu-conta-caixa">
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
