import { hasCaptacoesAccess } from "./captacoes-access";
import { hasPedsAccess } from "./peds-access";
import { ROLE_ORDER, type AppRole } from "./roles";

/*
 * Regras de permissão sem banco nem React (dá para testar com `npx tsx --test`).
 * `permissions.ts` reexporta tudo daqui e cuida das consultas ao banco.
 */

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
  ACTIONS.map((a) => [a.key, a.label]),
) as Record<ActionKey, string>;

/** Normaliza a lista de ações vinda do banco. */
export function normalizeActions(value: unknown): ActionKey[] {
  if (!Array.isArray(value)) return [...ALL_ACTIONS];
  const list = value.filter((v): v is ActionKey => ALL_ACTIONS.includes(v as ActionKey));
  return list.length > 0 ? list : ["view"];
}

/** Mapa categoria -> ações liberadas. */
export type CategoryActions = Map<string, ActionKey[]>;

/**
 * Abas com regra fixa: não seguem a Central de permissões (a regra fica no código e no banco).
 */
export const CATEGORIAS_FIXAS: readonly CategoryKey[] = ["captacoes", "peds"];

/** Níveis simples da Central: sem acesso, só ver, ou editar (todas as ações). */
export type Nivel = "nenhum" | "ver" | "editar";
export const NIVEL_ACOES: Record<Nivel, ActionKey[]> = {
  nenhum: [],
  ver: ["view"],
  editar: [...ALL_ACTIONS],
};
export const NIVEL_LABELS: Record<Nivel, string> = {
  nenhum: "Sem acesso",
  ver: "Ver",
  editar: "Editar",
};

/** Em que nível uma lista de ações se encaixa ("personalizado" quando é uma mistura). */
export function nivelDe(actions: readonly ActionKey[] | undefined): Nivel | "personalizado" {
  if (!actions || actions.length === 0) return "nenhum";
  if (actions.length === 1 && actions[0] === "view") return "ver";
  if (ALL_ACTIONS.every((a) => actions.includes(a))) return "editar";
  return "personalizado";
}

/** Ações da própria pessoa: lista vazia quer dizer "sem acesso" (não vira "ver"). */
export function acoesDaPessoa(value: unknown): ActionKey[] {
  if (!Array.isArray(value)) return [];
  return ALL_ACTIONS.filter((a) => value.includes(a));
}

/** Cargos com poder de aprovação/edição: Coordinator ou acima. */
export function isCoordinatorPlus(role: AppRole | undefined): boolean {
  if (!role) return false;
  return ROLE_ORDER.indexOf(role) <= ROLE_ORDER.indexOf("coordinator");
}

/** Verifica se um cargo tem acesso a uma categoria. Founder sempre tem. */
export function canAccess(
  role: AppRole,
  category: CategoryKey,
  perms: Map<AppRole, CategoryActions> | undefined,
): boolean {
  if (category === "peds") return hasPedsAccess(role, []);
  if (category === "captacoes") return false;
  if (role === "founder") return true;
  return perms?.get(role)?.has(category) ?? false;
}

/**
 * Acesso combinado: permissão da própria pessoa (se o FOUNDER definiu uma para a aba) ou,
 * senão, a do cargo OU de qualquer área do usuário. Players: toda a equipe vê.
 * Founder sempre tem acesso total.
 */
export function canAccessCombined(
  role: AppRole,
  myAreas: string[] | undefined,
  category: CategoryKey,
  perms: Map<AppRole, CategoryActions> | undefined,
  areaPerms: Map<string, CategoryActions> | undefined,
  userPerms?: CategoryActions,
): boolean {
  if (category === "captacoes") return hasCaptacoesAccess(role, myAreas);
  if (category === "peds") return hasPedsAccess(role, myAreas);
  if (role === "founder") return true;
  const daPessoa = userPerms?.get(category);
  if (daPessoa) return daPessoa.length > 0;
  if (category === "players") return true;
  if (category === "marketing" && marketingPadrao(role, myAreas)) return true;
  if (canAccess(role, category, perms)) return true;
  for (const area of myAreas ?? []) {
    if (areaPerms?.get(area)?.has(category)) return true;
  }
  return false;
}

/**
 * Ações liberadas para o usuário numa categoria: as da própria pessoa, quando o FOUNDER
 * definiu; senão a união de cargo + áreas (Players: todos ao menos veem).
 * Founder recebe todas as ações.
 */
export function actionsFor(
  role: AppRole,
  myAreas: string[] | undefined,
  category: CategoryKey,
  perms: Map<AppRole, CategoryActions> | undefined,
  areaPerms: Map<string, CategoryActions> | undefined,
  userPerms?: CategoryActions,
): ActionKey[] {
  if (category === "captacoes") return hasCaptacoesAccess(role, myAreas) ? [...ALL_ACTIONS] : [];
  if (category === "peds") return hasPedsAccess(role, myAreas) ? [...ALL_ACTIONS] : [];
  if (role === "founder") return [...ALL_ACTIONS];
  const daPessoa = userPerms?.get(category);
  if (daPessoa) return ALL_ACTIONS.filter((a) => daPessoa.includes(a));
  if (category === "marketing" && marketingPadrao(role, myAreas)) return [...ALL_ACTIONS];
  const set = new Set<ActionKey>();
  if (category === "players") set.add("view");
  for (const action of perms?.get(role)?.get(category) ?? []) set.add(action);
  for (const area of myAreas ?? []) {
    for (const action of areaPerms?.get(area)?.get(category) ?? []) set.add(action);
  }
  return ALL_ACTIONS.filter((a) => set.has(a));
}
