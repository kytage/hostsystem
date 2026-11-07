import type { AppRole } from "@/lib/roles";

export function hasPedsAccess(role: AppRole | undefined, areas: readonly string[] | undefined): boolean {
  return Boolean(role && ["founder", "c_level", "direcao", "coordinator"].includes(role)) ||
    (areas ?? []).some((area) => area === "kids");
}