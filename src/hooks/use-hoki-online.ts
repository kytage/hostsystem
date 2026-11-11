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

  // "Toc toc": alguém me chamou pela praça. Toca e avisa em qualquer tela do painel.
  const navigate = useNavigate();
  useEffect(
    () =>
      ouvirNaPraca("chamar", (m) => {
        if (m.para !== meuIdNaPraca() || typeof m.de !== "string") return;
        const nome = String(m.nome ?? "Alguém").slice(0, 24);
        playSfx("toc");
        setTimeout(() => playSfx("toc"), 520);
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
