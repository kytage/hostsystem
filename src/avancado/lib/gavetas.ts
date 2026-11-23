// Qual gaveta está aberta (lead, conteúdo ou tarefa). Qualquer página abre qualquer uma sem importar a outra.
import { useSyncExternalStore } from "react";
import type { ConteudoEntrada, LeadEntrada, TarefaEntrada } from "@/avancado/shared/tipos";

export type GavetaAberta =
  | { tipo: "lead"; id: string; inicial?: Partial<LeadEntrada> | undefined }
  | { tipo: "conteudo"; id: string; inicial?: ConteudoEntrada | undefined }
  | { tipo: "tarefa"; id: string; inicial?: TarefaEntrada | undefined }
  | null;

let atual: GavetaAberta = null;
const ouvintes = new Set<() => void>();
const mudar = (g: GavetaAberta) => {
  atual = g;
  ouvintes.forEach((f) => f());
};

/** `id` = identificador existente ou "novo". */
export const abrirLead = (id: string, inicial?: Partial<LeadEntrada>) => mudar({ tipo: "lead", id, inicial });
export const abrirConteudo = (id: string, inicial?: ConteudoEntrada) => mudar({ tipo: "conteudo", id, inicial });
export const abrirTarefa = (id: string, inicial?: TarefaEntrada) => mudar({ tipo: "tarefa", id, inicial });
export const fecharGaveta = () => mudar(null);

export function useGavetaAberta(): GavetaAberta {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}
