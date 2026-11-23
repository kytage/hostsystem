import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Contact, Home, LayoutGrid, LogOut, Map as MapIcon, Moon, Search, Sun, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS } from "@/lib/permissions";
import { playSfx, setSfxMuted, sfxMuted } from "@/lib/sfx";
import { alternarPerfil, fecharPainel, usePainelTopo } from "@/lib/menu-perfil";
import { GRUPOS, ehAtual, grupoDe, useMenu } from "@/components/app-sidebar";
import { SinoBotao } from "@/components/sino-avisos";
import { cn } from "@/lib/utils";

/**
 * Celular: no lugar do menu lateral e da barra do topo, uma barra presa embaixo com os 5 atalhos
 * principais — Início, Players, Avisos, Menu (todas as páginas) e Perfil. Respeita a "barra de
 * gestos" do iPhone (safe area).
 */
export function BarraCelular() {
  const { role, username, avatarUrl, todos } = useMenu();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const painel = usePainelTopo();
  const [menu, setMenu] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [mudo, setMudo] = useState(false);
  const [escuro, setEscuro] = useState(true);

  useEffect(() => {
    setMudo(sfxMuted());
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);
  // trocou de página: fecha o menu
  useEffect(() => {
    setMenu(false);
    setFiltro("");
  }, [pathname]);
  // menu aberto: a página de trás não rola
  useEffect(() => {
    if (!menu) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [menu]);

  // segundo atalho: Players (ou Áreas, para quem não vê Players)
  const temPlayers = todos.some((i) => i.title === "Players");
  const atalho2 = temPlayers
    ? { titulo: "Players", url: "/players", Icone: Contact }
    : { titulo: "Áreas", url: "/areas", Icone: MapIcon };

  const paginas = todos.filter((i) => i.url);
  const busca = filtro.trim().toLowerCase();
  const grupos = useMemo(
    () =>
      [...GRUPOS.map((g) => g.nome), "Outros"]
        .map((nome) => ({
          nome,
          itens: paginas.filter(
            (i) => grupoDe(i.title) === nome && (!busca || i.title.toLowerCase().includes(busca)),
          ),
        }))
        .filter((g) => g.itens.length > 0),
    [paginas, busca],
  );

  const perfilAberto = painel === "perfil";
  const abrirMenu = () => {
    fecharPainel();
    setMenu((m) => !m);
  };
  const tocar = () => setMenu(false);
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

  return (
    <>
      {menu && (
        <div className="cel-menu-fundo" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div role="dialog" aria-modal="true" aria-label="Todas as páginas" className="cel-menu">
            <div className="cel-menu-topo">
              <div className="flex min-w-0 items-center gap-2.5">
                <img src={avatarUrl} alt="" className="size-9 rounded-[12px] object-cover" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[14px] font-semibold">{username || "…"}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{ROLE_LABELS[role]}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMenu(false)} className="cel-menu-fechar" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
            <label className="cel-menu-busca">
              <Search className="size-4 shrink-0 opacity-60" />
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar página"
                enterKeyHint="go"
                onKeyDown={(e) => {
                  const primeira = grupos[0]?.itens[0];
                  if (e.key === "Enter" && primeira?.url) void navigate({ to: primeira.url });
                }}
              />
            </label>
            <div className="cel-menu-lista">
              {grupos.map((g) => (
                <div key={g.nome} className="cel-menu-grupo">
                  <p className="menu-grupo">{g.nome}</p>
                  <div className="cel-menu-grade">
                    {g.itens.map((i) => (
                      <Link
                        key={i.title}
                        to={i.url as string}
                        onClick={tocar}
                        className="cel-menu-item"
                        data-ativo={ehAtual(i, pathname) ? "" : undefined}
                      >
                        <i.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                        <span className="min-w-0 truncate">{i.title}</span>
                        {i.tag && <span className="menu-tag-novo">{i.tag}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {grupos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>}
              <div className="cel-menu-grupo">
                <p className="menu-grupo">Conta</p>
                <div className="cel-menu-grade">
                  <button type="button" className="cel-menu-item" onClick={alternarSom}>
                    {mudo ? <VolumeX className="size-[18px]" strokeWidth={1.75} /> : <Volume2 className="size-[18px]" strokeWidth={1.75} />}
                    <span>Sons {mudo ? "desligados" : "ligados"}</span>
                  </button>
                  <button type="button" className="cel-menu-item" onClick={alternarTema}>
                    {escuro ? <Sun className="size-[18px]" strokeWidth={1.75} /> : <Moon className="size-[18px]" strokeWidth={1.75} />}
                    <span>{escuro ? "Modo claro" : "Modo noturno"}</span>
                  </button>
                  <button type="button" className="cel-menu-item cel-menu-sair" onClick={() => void supabase.auth.signOut()}>
                    <LogOut className="size-[18px]" strokeWidth={1.75} />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="cel-barra" aria-label="Menu principal">
        <Link to="/" className="cel-botao" data-ativo={pathname === "/" && !menu && !painel ? "" : undefined} aria-label="Início">
          <Home className="size-[21px]" strokeWidth={1.9} />
        </Link>
        <Link
          to={atalho2.url}
          className="cel-botao"
          data-ativo={pathname.startsWith(atalho2.url) && !menu && !painel ? "" : undefined}
          aria-label={atalho2.titulo}
        >
          <atalho2.Icone className="size-[21px]" strokeWidth={1.9} />
        </Link>
        <span className="cel-botao-sino" onClickCapture={() => setMenu(false)}>
          <SinoBotao />
        </span>
        <button
          type="button"
          onClick={abrirMenu}
          className="cel-botao"
          data-ativo={menu ? "" : undefined}
          aria-label="Todas as páginas"
          aria-expanded={menu}
        >
          {menu ? <X className="size-[21px]" strokeWidth={1.9} /> : <LayoutGrid className="size-[21px]" strokeWidth={1.9} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setMenu(false);
            alternarPerfil();
          }}
          className={cn("cel-botao cel-botao-perfil", perfilAberto && "cel-botao-perfil-on")}
          aria-label={perfilAberto ? "Fechar o perfil" : "Abrir o perfil"}
          aria-expanded={perfilAberto}
        >
          <img src={avatarUrl} alt="" />
        </button>
      </nav>
    </>
  );
}
