import type { PedInput } from "./peds-schema";

type PedState = { categoria: string; grupo: string };
export const removedPedState = { categoria: "Removidos", grupo: "Removido" } as const;
export function isRemovedPed(ped: PedState): boolean {
  return ped.categoria === "Removidos" || ped.grupo === "Removido";
}
export function pedCategory(ped: PedState): string {
  return isRemovedPed(ped) ? "Removidos" : ped.categoria;
}
export function normalizePedState(input: PedInput): PedInput {
  return isRemovedPed(input) ? { ...input, ...removedPedState } : input;
}
export function summarizePeds(rows: PedState[]) {
  const active = rows.filter((ped) => !isRemovedPed(ped));
  return { total: active.length, setados: active.filter((ped) => ped.grupo === "Setado").length,
    naoSetados: active.filter((ped) => ped.grupo === "N/ Setado").length, removidos: rows.length - active.length };
}