import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { meuPet, VISUAL_PADRAO, type Visual } from "@/lib/hoki";
import { getAuthUserData } from "@/lib/auth-cache";
import { supabase } from "@/integrations/supabase/client";
import {
  conectarPresenca,
  definirIdentidade,
  meuIdNaPraca,
  ouvirNaPraca,
} from "@/lib/hoki-presenca";
import { playSfx } from "@/lib/sfx";
import { useMyRole } from "@/lib/permissions";
import { ROLE_TAG } from "@/lib/roles";
import { useSouVisita } from "@/lib/hoki-visita";
import {
  estouEmPartida,
  guardarConvite,
  limparCodigo,
  pedirParaAbrir,
} from "@/lib/hoki-magnata-sala";

/** Pede (uma vez só) para o navegador deixar o painel mostrar avisos no computador. */
function pedirAvisosNoComputador() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  // o navegador só mostra o pedido depois de um clique da pessoa
  const pedir = () => void Notification.requestPermission().catch(() => undefined);
  window.addEventListener("pointerdown", pedir, { once: true });
  return () => window.removeEventListener("pointerdown", pedir);
}

/** Pisca o título da aba até a pessoa voltar para ela. */
function piscarTitulo(texto: string) {
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  const original = document.title;
  let mostrando = false;
  const id = window.setInterval(() => {
    mostrando = !mostrando;
    document.title = mostrando ? texto : original;
  }, 900);
  const parar = () => {
    window.clearInterval(id);
    document.title = original;
    window.removeEventListener("focus", parar);
  };
  window.addEventListener("focus", parar);
  window.setTimeout(parar, 60_000);
}

/** Aviso do Windows/Mac quando a pessoa está em outra janela ou aba. */
function avisarNoComputador(
  titulo: string,
  corpo: string,
  aoClicar: () => void,
  tag = "hoki-chamar",
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  try {
    const n = new Notification(titulo, {
      body: corpo,
      tag,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      aoClicar();
      n.close();
    };
  } catch {
    // alguns navegadores só deixam avisar pelo service worker: fica o som e o aviso na tela
  }
}

/**
 * Mantém o HOKI do usuário "online" enquanto o painel está aberto, em qualquer
 * tela: ele aparece dormindo no berço da praça até a pessoa acordá-lo.
 */
export function useHokiOnline() {
  const { data: pet, isError: semPet } = useQuery({
    queryKey: ["hoki-meu"],
    queryFn: meuPet,
    staleTime: Infinity,
    // se o HOKI não carregar (internet oscilou), tenta de novo em vez de deixar a pessoa fora da praça
    retry: 4,
    retryDelay: (n) => Math.min(20_000, 1500 * 2 ** n),
    refetchInterval: (q) => (q.state.status === "error" ? 60_000 : false),
  });
  // Enquanto o HOKI não carrega, a pessoa entra no berço com um HOKI padrão e o nome do perfil.
  const { data: reserva } = useQuery({
    queryKey: ["hoki-online-reserva"],
    enabled: semPet,
    staleTime: Infinity,
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { id: auth.user.id, nome: data?.username || "staff" };
    },
  });
  const { data: cargo } = useMyRole();
  const visita = useSouVisita();
  const tag = visita ? "VIS" : cargo ? ROLE_TAG[cargo] : "";
  const id = pet?.user_id ?? (semPet ? reserva?.id : undefined);
  const nome = pet ? pet.username || pet.nome : (reserva?.nome ?? "");
  const nomeDoPet = pet?.nome ?? "";
  // texto estável do visual: só reenvia quando a aparência muda de verdade
  const visual = JSON.stringify(pet?.visual ?? VISUAL_PADRAO);

  useEffect(() => {
    if (!id) return;
    conectarPresenca(id);
    definirIdentidade({ nome, tag, pet: nomeDoPet, visual: JSON.parse(visual) as Visual });
  }, [id, nome, nomeDoPet, visual, tag]);
  // não desliga ao desmontar: trocar de tela no painel desmonta este pedaço, e o HOKI
  // tem que continuar na praça enquanto a aba estiver aberta (sair da conta desliga sozinho)
  useEffect(() => pedirAvisosNoComputador(), []);

  // "Toc toc": alguém me chamou pela praça. Toca e avisa em qualquer tela do painel.
  const navigate = useNavigate();
  useEffect(
    () =>
      ouvirNaPraca("chamar", (m) => {
        if (m.para !== meuIdNaPraca() || typeof m.de !== "string") return;
        const nome = String(m.nome ?? "Alguém").slice(0, 24);
        playSfx("toc");
        setTimeout(() => playSfx("toc"), 520);
        const irParaPraca = () => {
          if (window.location.pathname !== "/") void navigate({ to: "/" });
        };
        avisarNoComputador(
          "Toc toc! 🚪",
          `${nome} está te chamando na praça do HOKI.`,
          irParaPraca,
        );
        piscarTitulo(`🚪 ${nome} te chamou!`);
        toast(`Toc toc! ${nome} está te chamando na praça.`, {
          icon: "🚪",
          duration: 9000,
          action:
            window.location.pathname === "/"
              ? undefined
              : { label: "Ir para a praça", onClick: () => void navigate({ to: "/" }) },
        });
      }),
    [navigate],
  );

  // Sino do Magnata: alguém me chamou para uma partida. Avisa em qualquer tela e guarda o convite no portal.
  useEffect(
    () =>
      ouvirNaPraca("magnata", (m) => {
        if (m.para !== meuIdNaPraca()) return;
        const codigo = limparCodigo(String(m.codigo ?? ""));
        if (codigo.length !== 5) return;
        const nome = String(m.nome ?? "Alguém").slice(0, 24);
        guardarConvite({ codigo, nome, quando: Date.now() });
        if (estouEmPartida()) return;
        playSfx("sino");
        const entrar = () => {
          pedirParaAbrir(codigo);
          if (!["/", "/hoki"].includes(window.location.pathname)) void navigate({ to: "/" });
        };
        avisarNoComputador(
          "🔔 Magnata HOST",
          `${nome} está te chamando para uma partida de tabuleiro.`,
          entrar,
          "hoki-magnata",
        );
        piscarTitulo(`🔔 ${nome} te chamou para o Magnata!`);
        toast(`${nome} te chamou para o Magnata HOST`, {
          icon: "🔔",
          description: "Partida de tabuleiro de imóveis na praça do HOKI.",
          duration: 20_000,
          action: { label: "Entrar", onClick: entrar },
        });
      }),
    [navigate],
  );
}
