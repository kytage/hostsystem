import { z } from "zod";

export const PED_CATEGORIES = ["Crianças", "PréTeenTeen", "AnãoAdultos", "StaffFilhos", "Removidos"] as const;
export const PED_GROUPS = ["Setado", "N/ Setado", "Removido"] as const;
export const PED_CATEGORY_LABELS: Record<string, string> = { Crianças: "Crianças", PréTeenTeen: "Pré-teen / Teen", AnãoAdultos: "Anão / Adultos", StaffFilhos: "Staff / Filhos", Removidos: "Removidos" };
const text = z.string().trim().max(2000);
export const pedSchema = z.object({
  categoria: z.enum(PED_CATEGORIES), responsavel: text.min(1, "Informe o responsável Peds."),
  tamanho: text, grupo: z.enum(PED_GROUPS), discord_ped: text, passaporte_ped: text,
  arquivo: text.min(1, "Informe o arquivo da skin."), discord_responsavel: text,
  passaporte_responsavel: text, adicao: text, observacao: z.string().trim().max(10000),
});
export type PedInput = z.infer<typeof pedSchema>;
export const PED_FIELDS = [
  ["responsavel", "Responsável Peds"], ["tamanho", "Tamanho"],
  ["discord_ped", "Discord ID · Ped"], ["passaporte_ped", "Passaporte · Ped"],
  ["arquivo", "Arquivo / Skin"], ["discord_responsavel", "Discord ID · Responsável"],
  ["passaporte_responsavel", "Passaporte · Responsável"], ["adicao", "Adição"],
] as const;
export function emptyPed(categoria: PedInput["categoria"]): PedInput {
  return { categoria, responsavel: "", tamanho: "", grupo: categoria === "Removidos" ? "Removido" : "N/ Setado", discord_ped: "", passaporte_ped: "", arquivo: "", discord_responsavel: "", passaporte_responsavel: "", adicao: "", observacao: "" };
}