/** Captações: membros das áreas ILEGAL/CAPTAÇÃO/POLÍCIA ou os cargos Coordinator, Direção, CEO e Founder. */
const CAPTACOES_ROLES: readonly string[] = [
  "founder",
  "c_level",
  "direcao",
  "coordinator",
];

export function hasCaptacoesArea(areas: readonly string[] | undefined): boolean {
  return areas?.some((area) => area === "ilegal" || area === "captacao" || area === "policia") ?? false;
}

export function hasCaptacoesAccess(
  role: string | undefined,
  areas: readonly string[] | undefined
): boolean {
  return (role !== undefined && CAPTACOES_ROLES.includes(role)) || hasCaptacoesArea(areas);
}
