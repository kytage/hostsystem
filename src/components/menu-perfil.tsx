import { Suspense, lazy, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { alternarPerfil, fecharPainel, usePainelTopo } from "@/lib/menu-perfil";
import { PainelAvisos, SinoBotao } from "@/components/sino-avisos";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// o conteúdo do perfil (tarefas, anotações) só é baixado quando o pop-up abre
const PerfilConteudo = lazy(() =>
  import("@/components/perfil/perfil-conteudo").then((m) => ({ default: m.PerfilConteudo })),
);

/** Mesmo cache do menu lateral (chave "my-username"). */
function useEu() {
  return useQuery({
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
}

/**
 * Botões fixos no meio do topo: "Menu @nome" abre o Perfil & Agenda e o sino abre os Avisos,
 * sempre num pop-up grande por cima de qualquer página (ex.: em cima da tabela do Ilegal).
 */
export function MenuPerfil() {
  const painel = usePainelTopo();
  const aberto = painel !== null;
  const { data: eu } = useEu();
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  // trocou de página (ex.: clicou num link dentro do perfil): fecha o pop-up
  useEffect(() => {
    fecharPainel();
  }, [caminho]);

  // Esc fecha; a página de trás não rola enquanto o pop-up está aberto
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc dentro de uma janela aberta por cima (ex.: Editar perfil) fecha só ela
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      const noMeio = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      if (noMeio && !noMeio.closest(".menu-perfil-fundo")) return;
      fecharPainel();
    };
    // captura: roda antes da janela de cima (Radix) se fechar, então ainda dá para ver se ela está aberta
    window.addEventListener("keydown", tecla, true);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla, true);
      document.body.style.overflow = antes;
    };
  }, [aberto]);

  if (typeof document === "undefined") return null;
  const nome = eu?.username || "perfil";
  const perfilAberto = painel === "perfil";

  return createPortal(
    <>
      <div className="menu-topo">
        <button
          type="button"
          onClick={alternarPerfil}
          aria-expanded={perfilAberto}
          aria-label={perfilAberto ? "Fechar o perfil" : "Abrir o perfil"}
          className={cn("menu-perfil-botao", perfilAberto && "menu-perfil-botao-on")}
        >
          <img src={eu?.avatar_url || DEFAULT_AVATAR_URL} alt="" className="menu-perfil-foto" />
          <span className="menu-perfil-nome">
            Menu <b>@{nome}</b>
          </span>
          <span className="menu-perfil-icone" aria-hidden>
            {perfilAberto ? <X className="size-4" strokeWidth={2.25} /> : <ChevronDown className="size-4" strokeWidth={2.25} />}
          </span>
        </button>
        <span className="menu-topo-sep" aria-hidden />
        <SinoBotao />
      </div>

      {aberto && (
        <div className="menu-perfil-fundo" onMouseDown={(e) => e.target === e.currentTarget && fecharPainel()}>
          {perfilAberto ? (
            <div role="dialog" aria-modal="true" aria-label="Perfil & Agenda" className="menu-perfil-janela">
              <div className="menu-perfil-topo">
                <div>
                  <p className="menu-perfil-titulo">Perfil &amp; Agenda</p>
                  <p className="hc-nota">Sua central no painel: perfil, tarefas e anotações.</p>
                </div>
                <button type="button" onClick={fecharPainel} className="menu-perfil-fechar" aria-label="Fechar">
                  <X className="size-4" />
                </button>
              </div>
              <div className="menu-perfil-corpo">
                <Suspense
                  fallback={
                    <div className="grid h-40 place-items-center">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <PerfilConteudo />
                </Suspense>
              </div>
            </div>
          ) : (
            <PainelAvisos />
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
