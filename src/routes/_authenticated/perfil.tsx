import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { abrirPerfil } from "@/lib/menu-perfil";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil & Agenda — HOST" },
      { name: "description", content: "Sua central no painel: perfil, tarefas e anotações." },
    ],
  }),
  component: PerfilPage,
});

/**
 * O Perfil & Agenda agora é um pop-up (botão fixo no topo, src/components/menu-perfil.tsx).
 * Links antigos para /perfil vão para a Home e abrem o pop-up.
 */
function PerfilPage() {
  const navigate = useNavigate();
  useEffect(() => {
    // espera a Home montar (trocar de página fecha o pop-up) e só então abre
    void navigate({ to: "/", replace: true }).then(() => setTimeout(abrirPerfil, 80));
  }, [navigate]);
  return null;
}
