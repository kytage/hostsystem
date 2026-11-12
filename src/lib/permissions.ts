import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { hasCaptacoesAccess } from "@/lib/captacoes-access";
import { hasPedsAccess } from "@/lib/peds-access";
import { ROLE_ORDER, type AppRole } from "@/lib/roles";
export { ROLE_ORDER, ROLE_LABELS, ROLE_DOT, type AppRole } from "@/lib/roles";


export const CATEGORIES = [
  { key: "avisos", label: "Avisos" },
  { key: "itens", label: "Itens" },
  { key: "comandos", label: "Comandos Staffs" },
  { key: "carros", label: "Carros" },
  { key: "ilegal", label: "Ilegal" },
  { key: "captacoes", label: "Captações" },
  { key: "peds", label: "Peds" },
  { key: "controle_staff", label: "Controle Staff" },
  { key: "marketing", label: "Marketing" },
  { key: "area_manager", label: "Área Manager" },
  { key: "cronograma", label: "Cronograma" },
  { key: "punicoes", label: "Punições" },
  { key: "desenvolvimento", label: "Desenvolvimento" },
  { key: "players", label: "Players" },
  { key: "usuarios", label: "Usuários" },
  { key: "configuracoes", label: "Configurações" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** Marketing: Coordinator+ e quem tem a área Marketing entram sempre; os outros, pela tela de Permissões. */
const marketingPadrao = (role: AppRole, myAreas: string[] | undefined) =>
  isCoordinatorPlus(role) || (myAreas ?? []).includes("marketing");

/* ------------------------------------------------------------------ *
 * Ações granulares por categoria
 * ------------------------------------------------------------------ */

export const ACTIONS = [
  { key: "view", label: "Visualizar", hint: "Abrir e consultar a área" },
  { key: "create", label: "Criar", hint: "Registrar novos itens" },
  { key: "edit", label: "Editar", hint: "Alterar itens existentes" },
  { key: "delete", label: "Excluir", hint: "Remover registros" },
  { key: "approve", label: "Aprovar", hint: "Aprovar/mover fluxos" },
] as const;

export type ActionKey = (typeof ACTIONS)[number]["key"];
export const ALL_ACTIONS: ActionKey[] = ACTIONS.map((a) => a.key);
export const ACTION_LABELS: Record<ActionKey, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.key, a.label])
) as Record<ActionKey, string>;

/** Normaliza a lista de ações vinda do banco. */
export function normalizeActions(value: unknown): ActionKey[] {
  if (!Array.isArray(value)) return [...ALL_ACTIONS];
  const list = value.filter((v): v is ActionKey =>
    ALL_ACTIONS.includes(v as ActionKey)
  );
  return list.length > 0 ? list : ["view"];
}

/** Mapa categoria -> ações liberadas. */
export type CategoryActions = Map<string, ActionKey[]>;


/** Áreas (sub-cargos) disponíveis — sincronizadas com a planilha de staff */
export const AREAS = [
  { key: "hospital", label: "Hospital", emoji: "🏥" },
  { key: "judiciario", label: "Judiciário", emoji: "⚖️" },
  { key: "mecanica", label: "Mecânica", emoji: "🔧" },
  { key: "restaurantes", label: "Restaurantes", emoji: "🍽️" },
  { key: "jornal", label: "Jornal", emoji: "📰" },
  { key: "creators", label: "Creators", emoji: "🎬" },
  { key: "kids", label: "Peds e Kids", emoji: "🧸" },
  { key: "ilegal", label: "Ilegal", emoji: "💀" },
  { key: "policia", label: "Policia", emoji: "👮" },
  { key: "eventos", label: "Eventos", emoji: "🎉" },
  { key: "competitive", label: "Competitive", emoji: "🏆" },
  { key: "var", label: "VAR", emoji: "🎥" },
  { key: "cars", label: "Cars", emoji: "🚗" },
  { key: "clotches", label: "Clotches", emoji: "👕" },
  { key: "denuncias", label: "Denuncias", emoji: "🚨" },
  { key: "financeiro", label: "Financeiro", emoji: "💰" },
  { key: "marketing", label: "Marketing", emoji: "📣" },
  { key: "staff", label: "Staff", emoji: "🛡️" },
  { key: "desenvolvimento", label: "Desenvolvimento", emoji: "💻" },
  { key: "captacao", label: "CAPTAÇÃO", emoji: "🤝" },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];
export const AREA_LABELS: Record<AreaKey, string> = Object.fromEntries(
  AREAS.map((a) => [a.key, a.label])
) as Record<AreaKey, string>;
export const AREA_EMOJIS: Record<string, string> = Object.fromEntries(
  AREAS.map((a) => [a.key, a.emoji])
);
/** Rótulo com emoji para exibição (fallback: a própria chave). */
export function areaDisplay(area: string): string {
  const emoji = AREA_EMOJIS[area];
  const label = AREA_LABELS[area as AreaKey] ?? area;
  return emoji ? `${emoji} ${label}` : label;
}


/** Cargo do usuário logado (primeiro cargo encontrado, pelo mais alto na hierarquia) */
export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async (): Promise<AppRole> => {
      const auth = await getAuthUserData();
      if (!auth.user) return "staff";
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      const roles = (data ?? []).map((r) => r.role);
      return ROLE_ORDER.find((r) => roles.includes(r)) ?? "staff";
    },
    staleTime: 60_000,
  });
}

/** Cargos com poder de aprovação/edição: Coordinator ou acima. */
export function isCoordinatorPlus(role: AppRole | undefined): boolean {
  if (!role) return false;
  return ROLE_ORDER.indexOf(role) <= ROLE_ORDER.indexOf("coordinator");
}

/**
 * Edição do painel Ilegal: Coordinator+ OU qualquer membro da área "Ilegal".
 */
export function useCanEditIlegal(): boolean {
  const { data: role } = useMyRole();
  const { data: myAreas } = useMyAreas();
  return isCoordinatorPlus(role) || (myAreas ?? []).includes("ilegal");
}

/** True quando o usuário logado é líder da área "Ilegal". */
export function useIsIlegalLider() {
  return useQuery({
    queryKey: ["is-ilegal-lider"],
    queryFn: async (): Promise<boolean> => {
      const auth = await getAuthUserData();
      if (!auth.user) return false;
      const { data, error } = await supabase
        .from("user_areas")
        .select("area, nivel")
        .eq("user_id", auth.user.id)
        .eq("area", "ilegal")
        .eq("nivel", "lider")
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 60_000,
  });
}



/** Mapa de permissões: role -> (categoria -> ações liberadas) */
export function usePermissions() {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, category, actions");
      if (error) throw error;
      const map = new Map<AppRole, CategoryActions>();
      for (const row of (data ?? []) as { role: AppRole; category: string; actions: unknown }[]) {
        if (!map.has(row.role)) map.set(row.role, new Map());
        map.get(row.role)!.set(row.category, normalizeActions(row.actions));
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Verifica se um cargo tem acesso a uma categoria. Founder sempre tem. */
export function canAccess(
  role: AppRole,
  category: CategoryKey,
  perms: Map<AppRole, CategoryActions> | undefined
): boolean {
  if (category === "peds") return hasPedsAccess(role, []);
  if (category === "captacoes") return false;
  if (role === "founder") return true;
  return perms?.get(role)?.has(category) ?? false;
}

/** Mapa de permissões por área: area -> (categoria -> ações liberadas) */
export function useAreaPermissions() {
  return useQuery({
    queryKey: ["area-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("area_permissions")
        .select("area, category, actions");
      if (error) throw error;
      const map = new Map<string, CategoryActions>();
      for (const row of (data ?? []) as { area: string; category: string; actions: unknown }[]) {
        if (!map.has(row.area)) map.set(row.area, new Map());
        map.get(row.area)!.set(row.category, normalizeActions(row.actions));
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Lista de áreas cadastradas (banco), com fallback para as áreas padrão. */
export interface AreaRow {
  key: string;
  label: string;
  emoji: string;
  ordem: number;
  /** Agrupamento no organograma (ex.: "legal", "ilegal"); null = outras áreas. */
  grupo?: string | null;
}

export function useAreas() {
  return useQuery({
    queryKey: ["areas-list"],
    queryFn: async (): Promise<AreaRow[]> => {
      const { data, error } = await supabase
        .from("areas")
        .select("key, label, emoji, ordem, grupo")
        .order("ordem", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as AreaRow[];
      if (rows.length === 0) {
        return AREAS.map((a, i) => ({ key: a.key, label: a.label, emoji: a.emoji, ordem: i + 1 }));
      }
      return rows;
    },
    staleTime: 30_000,
  });
}

/** Áreas (sub-cargos) do usuário logado */
export function useMyAreas() {
  return useQuery({
    queryKey: ["my-areas"],
    queryFn: async (): Promise<string[]> => {
      const auth = await getAuthUserData();
      if (!auth.user) return [];
      const { data } = await supabase
        .from("user_areas")
        .select("area")
        .eq("user_id", auth.user.id);
      return (data ?? []).map((r) => r.area);
    },
    staleTime: 60_000,
  });
}

/**
 * Acesso combinado: permissão do cargo OU permissão de qualquer área do usuário.
 * Founder sempre tem acesso total.
 */
export function canAccessCombined(
  role: AppRole,
  myAreas: string[] | undefined,
  category: CategoryKey,
  perms: Map<AppRole, CategoryActions> | undefined,
  areaPerms: Map<string, CategoryActions> | undefined
): boolean {
  if (category === "captacoes") return hasCaptacoesAccess(role, myAreas);
  if (category === "peds") return hasPedsAccess(role, myAreas);
  if (category === "marketing" && marketingPadrao(role, myAreas)) return true;
  if (category === "players" && isCoordinatorPlus(role)) return true;
  if (canAccess(role, category, perms)) return true;
  for (const area of myAreas ?? []) {
    if (areaPerms?.get(area)?.has(category)) return true;
  }
  return false;
}

/**
 * União das ações liberadas para o usuário numa categoria (cargo + áreas).
 * Founder recebe todas as ações.
 */
export function actionsFor(
  role: AppRole,
  myAreas: string[] | undefined,
  category: CategoryKey,
  perms: Map<AppRole, CategoryActions> | undefined,
  areaPerms: Map<string, CategoryActions> | undefined
): ActionKey[] {
  if (category === "captacoes") return hasCaptacoesAccess(role, myAreas) ? [...ALL_ACTIONS] : [];
  if (category === "peds") return hasPedsAccess(role, myAreas) ? [...ALL_ACTIONS] : [];
  if (role === "founder") return [...ALL_ACTIONS];
  if (category === "marketing" && marketingPadrao(role, myAreas)) return [...ALL_ACTIONS];
  const set = new Set<ActionKey>();
  if (category === "players" && isCoordinatorPlus(role)) set.add("view");
  for (const action of perms?.get(role)?.get(category) ?? []) set.add(action);
  for (const area of myAreas ?? []) {
    for (const action of areaPerms?.get(area)?.get(category) ?? []) set.add(action);
  }
  return ALL_ACTIONS.filter((a) => set.has(a));
}

/**
 * Hook prático: `can("punicoes", "delete")` para o usuário logado.
 */
export function useCan() {
  const { data: role } = useMyRole();
  const { data: myAreas } = useMyAreas();
  const { data: perms } = usePermissions();
  const { data: areaPerms } = useAreaPermissions();

  return (category: CategoryKey, action: ActionKey = "view"): boolean => {
    if (!role) return false;
    return actionsFor(role, myAreas, category, perms, areaPerms).includes(action);
  };
}
