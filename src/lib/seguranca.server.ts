/**
 * Checagens de acesso das server functions (só servidor).
 *
 * Estar logado não basta: contas criadas fora do painel
 * também têm login. Antes de usar o client privilegiado, a função precisa confirmar que a
 * pessoa é da equipe e, quando for o caso, que tem a permissão daquela aba.
 */
import { ROLE_ORDER, type AppRole } from "@/lib/roles";
import {
  acoesDaPessoa,
  actionsFor,
  normalizeActions,
  type ActionKey,
  type CategoryActions,
  type CategoryKey,
} from "@/lib/permissoes-regras";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** O cargo mais alto da pessoa, ou null se ela não for da equipe. */
export async function cargoDe(userId: string): Promise<AppRole | null> {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
  return ROLE_ORDER.find((r) => roles.includes(r)) ?? null;
}

/** Garante que a pessoa é da equipe (tem cargo). Devolve o cargo. */
export async function exigirEquipe(userId: string): Promise<AppRole> {
  const cargo = await cargoDe(userId);
  if (!cargo) throw new Error("Sem permissão: apenas a equipe pode fazer isso.");
  return cargo;
}

/** Garante a permissão da aba (mesma regra da tela: cargo, áreas e permissão da pessoa). */
export async function exigirPermissao(
  userId: string,
  categoria: CategoryKey,
  acao: ActionKey = "view",
): Promise<AppRole> {
  const cargo = await exigirEquipe(userId);
  if (cargo === "founder") return cargo;
  const db = await admin();
  const [{ data: areas }, { data: doCargo }, { data: daPessoa }] = await Promise.all([
    db.from("user_areas").select("area").eq("user_id", userId),
    db.from("role_permissions").select("role, category, actions").eq("role", cargo),
    db.from("user_permissions").select("category, actions").eq("user_id", userId),
  ]);
  const minhasAreas = ((areas ?? []) as { area: string }[]).map((a) => a.area);
  const { data: dasAreas } = minhasAreas.length
    ? await db.from("area_permissions").select("area, category, actions").in("area", minhasAreas)
    : { data: [] };

  const perms = new Map<AppRole, CategoryActions>([[cargo, new Map()]]);
  for (const r of (doCargo ?? []) as { category: string; actions: unknown }[])
    perms.get(cargo)!.set(r.category, normalizeActions(r.actions));
  const areaPerms = new Map<string, CategoryActions>();
  for (const r of (dasAreas ?? []) as { area: string; category: string; actions: unknown }[]) {
    if (!areaPerms.has(r.area)) areaPerms.set(r.area, new Map());
    areaPerms.get(r.area)!.set(r.category, normalizeActions(r.actions));
  }
  const userPerms: CategoryActions = new Map();
  for (const r of (daPessoa ?? []) as { category: string; actions: unknown }[])
    userPerms.set(r.category, acoesDaPessoa(r.actions));

  if (!actionsFor(cargo, minhasAreas, categoria, perms, areaPerms, userPerms).includes(acao))
    throw new Error("Sem permissão para fazer isso nesta aba.");
  return cargo;
}

/**
 * Garante que a pessoa pode mexer naquele evento da Gestão de eventos: quem criou o evento
 * ou Coordinator e acima (a mesma regra do banco para editar o evento).
 */
export async function exigirEventoEditavel(userId: string, eventoId: string): Promise<void> {
  const cargo = await exigirEquipe(userId);
  const db = await admin();
  const { data } = await db
    .from("eventos_gestao")
    .select("criado_por_id")
    .eq("id", eventoId)
    .maybeSingle();
  if (!data) throw new Error("Evento não encontrado.");
  const coordenadorOuAcima =
    ROLE_ORDER.indexOf(cargo) <= ROLE_ORDER.indexOf("coordinator");
  if (!coordenadorOuAcima && (data as { criado_por_id: string | null }).criado_por_id !== userId)
    throw new Error("Só quem criou o evento ou Coordinator+ pode publicar.");
}

/** O nome de usuário da pessoa (para gravar autoria sem confiar no que o navegador manda). */
export async function nomeDe(userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db.from("profiles").select("username").eq("id", userId).maybeSingle();
  return (data as { username: string | null } | null)?.username ?? "desconhecido";
}
