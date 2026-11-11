import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { meuPet, type Visual } from "@/lib/hoki";
import {
  conectarPresenca,
  definirIdentidade,
  desconectarPresenca,
  meuIdNaPraca,
  ouvirNaPraca,
} from "@/lib/hoki-presenca";
import { playSfx } from "@/lib/sfx";
import { useMyRole } from "@/lib/permissions";
import { ROLE_TAG } from "@/lib/roles";

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
function avisarNoComputador(titulo: string, corpo: string, aoClicar: () => void) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  try {
    const n = new Notification(titulo, {
      body: corpo,
      tag: "hoki-chamar",
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
  const { data: pet } = useQuery({ queryKey: ["hoki-meu"], queryFn: meuPet, staleTime: Infinity });
  const { data: cargo } = useMyRole();
  const tag = cargo ? ROLE_TAG[cargo] : "";
  const id = pet?.user_id;
  const nome = pet ? pet.username || pet.nome : "";
  const nomeDoPet = pet?.nome ?? "";
  // texto estável do visual: só reenvia quando a aparência muda de verdade
  const visual = pet ? JSON.stringify(pet.visual) : "";

  useEffect(() => {
    if (!id || !visual) return;
    conectarPresenca(id);
    definirIdentidade({ nome, tag, pet: nomeDoPet, visual: JSON.parse(visual) as Visual });
  }, [id, nome, nomeDoPet, visual, tag]);
  useEffect(() => () => desconectarPresenca(), []);
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
}
