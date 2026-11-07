/**
 * Regras de mesclagem entre a planilha "HOST - STAFF" e os usuários do painel.
 * Mantido separado da UI para poder ser testado e reutilizado.
 */
import { AREAS, ROLE_ORDER, type AppRole } from "@/lib/permissions";
import type { StaffRow } from "@/lib/staff-sheet.server";

export interface EquipeUser {
  id: string;
  username: string;
  created_at: string;
  avatar_url: string;
  discord_id: string;
  host_id: string;
  role: AppRole;
  areas: string[];
  /** Nível do usuário em cada área: líder ou auxiliar */
  areaNiveis?: Record<string, "lider" | "auxiliar">;
  last_sign_in_at: string | null;
}

export interface EquipeRow {
  key: string;
  /** ID da planilha (usado como ID HOST) */
  sheetId: string;
  nome: string;
  cargoPlanilha: string;
  discord: string;
  hex: string;
  /** Áreas conforme a planilha (rótulos originais) */
  areasSheet: string[];
  liderAreas: string[];
  /** Usuário do painel vinculado (null = ainda sem conta) */
  user: EquipeUser | null;
}

/** Remove acentos e normaliza para comparação */
export function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Gera um username válido (a-z, 0-9, _ .) a partir do nome da planilha */
export function slugUsername(nome: string): string {
  const base = norm(nome).replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return base.slice(0, 20) || "novo.usuario";
}

/** Converte o rótulo de área da planilha na chave de área do painel */
export function areaKeyFromLabel(label: string): string {
  const n = norm(label);
  const found = AREAS.find((a) => norm(a.label) === n || a.key === n);
  if (found) return found.key;
  return n.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || n;
}

/** Deduz o cargo do painel a partir do texto de cargo da planilha */
export function roleFromCargo(cargo: string): AppRole {
  const n = norm(cargo);
  if (!n) return "staff";
  if (n.includes("founder")) return "founder";
  if (n.includes("c-level") || n.includes("c level") || n.includes("clevel") || n === "ceo") return "c_level";
  if (n.includes("dire")) return "direcao";
  if (n.includes("coorden") || n.includes("coordinator")) return "coordinator";
  if (n.includes("manager") || n.includes("gerente")) return "manager";
  if (n.includes("head moderator") || n.includes("head_moderator")) return "head_moderator";
  if (n.includes("contributor")) return "contributor";
  if (n.includes("dev")) return "dev";
  if (n.includes("support") || n.includes("suporte")) return "support";
  return "staff";
}

/** Linha da planilha é CASTING? (controle visual, sem conta no painel) */
export function isCasting(row: StaffRow): boolean {
  const alvo = [row.cargo, ...row.areas].map(norm).join(" ");
  return alvo.includes("casting");
}

/**
 * Casa cada linha da planilha com um usuário do painel.
 * Prioridade: ID Discord → ID Host → username derivado do nome.
 */
export function mergeEquipe(sheet: StaffRow[], users: EquipeUser[]): {
  equipe: EquipeRow[];
  casting: EquipeRow[];
  semPlanilha: EquipeUser[];
} {
  const porDiscord = new Map<string, EquipeUser>();
  const porHost = new Map<string, EquipeUser>();
  const porUsername = new Map<string, EquipeUser>();
  for (const u of users) {
    if (u.discord_id) porDiscord.set(u.discord_id.trim(), u);
    if (u.host_id) porHost.set(u.host_id.trim(), u);
    porUsername.set(norm(u.username), u);
  }

  const usados = new Set<string>();
  const toRow = (row: StaffRow, index: number): EquipeRow => {
    const candidato =
      (row.discord && porDiscord.get(row.discord.trim())) ||
      (row.id && porHost.get(row.id.trim())) ||
      porUsername.get(norm(row.nome)) ||
      porUsername.get(norm(slugUsername(row.nome))) ||
      null;
    if (candidato) usados.add(candidato.id);
    return {
      key: `${row.id || "s"}-${index}`,
      sheetId: row.id,
      nome: row.nome,
      cargoPlanilha: row.cargo,
      discord: row.discord,
      hex: row.hex,
      areasSheet: row.areas,
      liderAreas: row.liderAreas,
      user: candidato,
    };
  };

  const rows = sheet.map(toRow);
  const equipe = rows.filter((r, i) => !isCasting(sheet[i]!));
  const casting = rows.filter((r, i) => isCasting(sheet[i]!));
  const semPlanilha = users.filter((u) => !usados.has(u.id));

  const rank = (r: EquipeRow) => ROLE_ORDER.indexOf(roleFromCargo(r.cargoPlanilha));
  equipe.sort((a, b) => rank(a) - rank(b) || a.nome.localeCompare(b.nome, "pt-BR"));

  return { equipe, casting, semPlanilha };
}
