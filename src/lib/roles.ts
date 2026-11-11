import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Shared by role assignment, permission controls, and staff/chat ordering. */
export const ROLE_ORDER = [
  "founder", "c_level", "direcao", "coordinator", "manager",
  "head_moderator", "staff", "support", "contributor", "dev",
] as const satisfies readonly AppRole[];

export const ROLE_LABELS: Record<AppRole, string> = {
  founder: "Founder", c_level: "CEO", direcao: "Director(a)",
  coordinator: "Coordinator", manager: "Manager",
  head_moderator: "Head Moderator", staff: "Moderator",
  support: "Support", contributor: "Contributor", dev: "Dev",
};

/** Sigla do cargo, mostrada como tag antes do nome (praça do HOKI). */
export const ROLE_TAG: Record<AppRole, string> = {
  founder: "FND", c_level: "CEO", direcao: "DIR",
  coordinator: "COORD", manager: "MNG",
  head_moderator: "HEAD", staff: "MOD",
  support: "SUP", contributor: "CTB", dev: "DEV",
};

export const ROLE_DOT: Record<AppRole, string> = {
  founder: "bg-primary", c_level: "bg-warning", direcao: "bg-primary",
  coordinator: "bg-primary", manager: "bg-primary",
  head_moderator: "bg-primary", staff: "bg-muted-foreground",
  support: "bg-primary", contributor: "bg-primary", dev: "bg-muted-foreground",
};

export function roleRank(role: string): number {
  const index = ROLE_ORDER.findIndex((candidate) => candidate === role);
  return index < 0 ? ROLE_ORDER.length : index;
}