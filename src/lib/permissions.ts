import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { ROLE_ORDER, type AppRole } from "@/lib/roles";
import {
  acoesDaPessoa,
  actionsFor,
  isCoordinatorPlus,
  normalizeActions,
  type ActionKey,
  type CategoryActions,
  type CategoryKey,
} from "@/lib/permissoes-regras";
export { ROLE_ORDER, ROLE_LABELS, ROLE_DOT, type AppRole } from "@/lib/roles";
export * from "@/lib/permissoes-regras";

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
  AREAS.map((a) => [a.key, a.label]),
) as Record<AreaKey, string>;
export const AREA_EMOJIS: Record<string, string> = Object.fromEntries(
  AREAS.map((a) => [a.key, a.emoji]),
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
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
      const roles = (data ?? []).map((r) => r.role);
      return ROLE_ORDER.find((r) => roles.includes(r)) ?? "staff";
    },
    staleTime: 60_000,
  });
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

/**
 * Permissões da pessoa logada, definidas pelo FOUNDER aba por aba. Quando existe uma linha para
 * a aba, ela vale no lugar do cargo e das áreas. Se a tabela ainda não existir no banco, segue
 * só com cargo e áreas.
 */
export function useMyUserPermissions() {
  return useQuery({
    queryKey: ["user-permissions", "me"],
    queryFn: async (): Promise<CategoryActions> => {
      const map: CategoryActions = new Map();
      const auth = await getAuthUserData();
      if (!auth.user) return map;
      const { data, error } = await supabase
        .from("user_permissions")
        .select("category, actions")
        .eq("user_id", auth.user.id);
      if (error) return map;
      for (const row of (data ?? []) as { category: string; actions: unknown }[]) {
        map.set(row.category, acoesDaPessoa(row.actions));
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Todas as permissões por pessoa (só o FOUNDER consegue ler todas): pessoa -> (aba -> ações). */
export function useUserPermissionsAll(enabled = true) {
  return useQuery({
    queryKey: ["user-permissions", "todas"],
    enabled,
    queryFn: async (): Promise<Map<string, CategoryActions>> => {
      const map = new Map<string, CategoryActions>();
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, category, actions");
      if (error) return map;
      for (const row of (data ?? []) as { user_id: string; category: string; actions: unknown }[]) {
        if (!map.has(row.user_id)) map.set(row.user_id, new Map());
        map.get(row.user_id)!.set(row.category, acoesDaPessoa(row.actions));
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
      const { data } = await supabase.from("user_areas").select("area").eq("user_id", auth.user.id);
      return (data ?? []).map((r) => r.area);
    },
    staleTime: 60_000,
  });
}

/**
 * Hook prático: `can("punicoes", "delete")` para o usuário logado.
 */
export function useCan() {
  const { data: role } = useMyRole();
  const { data: myAreas } = useMyAreas();
  const { data: perms } = usePermissions();
  const { data: areaPerms } = useAreaPermissions();
  const { data: userPerms } = useMyUserPermissions();

  return (category: CategoryKey, action: ActionKey = "view"): boolean => {
    if (!role) return false;
    return actionsFor(role, myAreas, category, perms, areaPerms, userPerms).includes(action);
  };
}
