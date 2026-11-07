import { z } from "zod";
import type { NivelModelo } from "./captacoes";

export const LEVEL_KEYS = ["nivel_1", "nivel_2", "nivel_3"] as const;
export type NivelKey = (typeof LEVEL_KEYS)[number];
const text = z.string().max(2000);
export const benefitSchema = z.object({
  titulo: text, faixa: text, liderancaQtd: text, lideranca: text,
  gerenciaQtd: text, gerencia: text, vipFac: z.array(text).max(50),
  camp: text, campExtras: text, pix: z.boolean(),
  vipFacTitulo: text.optional(), vipFacDuracao: text.optional(),
});
export const pixSchema = z.array(z.object({
  online: z.number().int().min(0).max(100000),
  valor: z.number().min(0).max(100000000),
})).max(30).refine(rows => new Set(rows.map(row => row.online)).size === rows.length, "As faixas de online devem ser diferentes");
export const benefitLevelsSchema = z.object({
  nivel_1: benefitSchema.optional(), nivel_2: benefitSchema.optional(), nivel_3: benefitSchema.optional(),
});

export function resolveBenefits(defaults: NivelModelo, custom: unknown): NivelModelo {
  const parsed = benefitSchema.safeParse(custom);
  return parsed.success ? parsed.data : defaults;
}