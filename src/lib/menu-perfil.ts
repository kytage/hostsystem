/**
 * Pop-ups do topo: o Perfil & Agenda (botão "Menu @nome") e os Avisos (sino). Só um aberto por vez.
 * Estado bem simples, compartilhado entre os botões, o cartão da Home e o link antigo /perfil.
 */
import { useSyncExternalStore } from "react";

export type PainelTopo = "perfil" | "avisos" | null;

let painel: PainelTopo = null;
const ouvintes = new Set<() => void>();
const mudar = (p: PainelTopo) => {
  if (painel === p) return;
  painel = p;
  ouvintes.forEach((f) => f());
};

export const abrirPerfil = () => mudar("perfil");
export const abrirAvisos = () => mudar("avisos");
export const fecharPainel = () => mudar(null);
export const fecharPerfil = fecharPainel;
export const alternarPerfil = () => mudar(painel === "perfil" ? null : "perfil");
export const alternarAvisos = () => mudar(painel === "avisos" ? null : "avisos");

export function usePainelTopo(): PainelTopo {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => painel,
    () => null,
  );
}

export const usePerfilAberto = () => usePainelTopo() === "perfil";
