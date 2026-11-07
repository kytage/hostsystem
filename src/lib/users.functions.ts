import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ROLE_ORDER, type AppRole } from "@/lib/roles";
type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

const roleSchema = z.enum(ROLE_ORDER);
const usernameSchema = z
  .string()
  .min(3, "Usuário deve ter ao menos 3 caracteres")
  .max(20, "Usuário deve ter no máximo 20 caracteres")
  .regex(/^[a-z0-9_.]+$/, "Use apenas letras minúsculas, números, _ ou .");

async function getRoles(supabase: {
  from: (t: string) => any;
}): Promise<Map<string, AppRole[]>> {
  const { data } = await supabase.from("user_roles").select("user_id, role");
  const map = new Map<string, AppRole[]>();
  for (const row of (data ?? []) as { user_id: string; role: AppRole }[]) {
    if (!map.has(row.user_id)) map.set(row.user_id, []);
    map.get(row.user_id)!.push(row.role);
  }
  return map;
}

function highestRole(roles: AppRole[] | undefined): AppRole {
  return ROLE_ORDER.find((r) => roles?.includes(r)) ?? "staff";
}

type ManageAction = "view" | "create" | "edit" | "delete";

/**
 * Garante que o chamador pode gerenciar usuários.
 * Regras (em ordem):
 *  1. FOUNDER e C-LEVEL sempre podem (compatibilidade histórica).
 *  2. Qualquer outro cargo (ex.: Direção) pode desde que a Central de
 *     permissões libere a ação pedida na categoria "usuarios" — via cargo
 *     ou via alguma área do usuário.
 * Retorna `true` quando o chamador é FOUNDER.
 */
async function assertManager(
  context: { supabase: any; userId: string },
  action: ManageAction = "view"
): Promise<boolean> {
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const myRoles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);

  if (myRoles.includes("founder")) return true;
  if (myRoles.includes("c_level")) return false;

  const allowed = new Set<string>();

  const role = highestRole(myRoles);
  const { data: rolePerms } = await context.supabase
    .from("role_permissions")
    .select("actions")
    .eq("role", role)
    .eq("category", "usuarios");
  for (const row of (rolePerms ?? []) as { actions: unknown }[]) {
    if (Array.isArray(row.actions) && row.actions.length > 0) {
      for (const a of row.actions) allowed.add(String(a));
    } else {
      allowed.add("view");
    }
  }

  const { data: areaRows } = await context.supabase
    .from("user_areas")
    .select("area")
    .eq("user_id", context.userId);
  const areaKeys = ((areaRows ?? []) as { area: string }[]).map((r) => r.area);
  if (areaKeys.length > 0) {
    const { data: areaPerms } = await context.supabase
      .from("area_permissions")
      .select("actions")
      .eq("category", "usuarios")
      .in("area", areaKeys);
    for (const row of (areaPerms ?? []) as { actions: unknown }[]) {
      if (Array.isArray(row.actions) && row.actions.length > 0) {
        for (const a of row.actions) allowed.add(String(a));
      } else {
        allowed.add("view");
      }
    }
  }

  if (!allowed.has(action)) {
    throw new Error("Sem permissão para gerenciar usuários");
  }
  return false;
}


/** Garante que o chamador pode agir sobre o alvo (só founder mexe em founder) */
async function assertTargetAllowed(
  admin: AdminClient,
  actorIsFounder: boolean,
  targetUserId: string
) {
  const roles = await getRoles(admin);
  const targetRole = highestRole(roles.get(targetUserId));
  if (targetRole === "founder" && !actorIsFounder) {
    throw new Error("Apenas o FOUNDER pode gerenciar outro FOUNDER");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actorIsFounder = await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, created_at, avatar_url, discord_id, host_id, last_seen_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);


    // Último acesso — visível a quem já tem permissão de gerenciar a equipe
    void actorIsFounder;
    const lastSignInMap = new Map<string, string | null>();
    {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of authData?.users ?? []) {
        lastSignInMap.set(u.id, u.last_sign_in_at ?? null);
      }
    }

    const roles = await getRoles(supabaseAdmin);
    const { data: areas } = await supabaseAdmin.from("user_areas").select("user_id, area, nivel");
    const areaMap = new Map<string, string[]>();
    const nivelMap = new Map<string, Record<string, "lider" | "auxiliar">>();
    for (const row of (areas ?? []) as {
      user_id: string;
      area: string;
      nivel: string | null;
    }[]) {
      const currentAreas = areaMap.get(row.user_id) ?? [];
      currentAreas.push(row.area);
      areaMap.set(row.user_id, currentAreas);
      const niveis = nivelMap.get(row.user_id) ?? {};
      niveis[row.area] = row.nivel === "lider" ? "lider" : "auxiliar";
      nivelMap.set(row.user_id, niveis);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      created_at: p.created_at,
      avatar_url: p.avatar_url ?? "",
      discord_id: p.discord_id ?? "",
      host_id: p.host_id ?? "",
      role: highestRole(roles.get(p.id)),
      areas: areaMap.get(p.id) ?? [],
      areaNiveis: nivelMap.get(p.id) ?? {},
      last_sign_in_at: (() => {
        // "Último acesso" = o mais recente entre login do Auth e presença real no painel
        const signIn = lastSignInMap.get(p.id) ?? null;
        const seen = (p as { last_seen_at?: string | null }).last_seen_at ?? null;
        if (!signIn) return seen;
        if (!seen) return signIn;
        return new Date(seen) > new Date(signIn) ? seen : signIn;
      })(),

    }));
  });

/** Atualiza ID Discord / ID Host de um usuário — Founder ou C-Level */
export const setUserIdentifiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        discord_id: z.string().trim().max(40).default(""),
        host_id: z.string().trim().max(40).default(""),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetAllowed(supabaseAdmin, actorIsFounder, data.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ discord_id: data.discord_id, host_id: data.host_id })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Lista simples de usuários (id + username) para designar tarefas — qualquer autenticado */
export const listStaffSimple = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .order("username", { ascending: true });
    if (error) throw new Error(error.message);
    return (profiles ?? []).map((p) => ({ id: p.id, username: p.username }));
  });

/** Lista usuários com cargo Coordinator ou superior (para destinatários de solicitações) */
export const listCoordinatorPlus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles = await getRoles(supabaseAdmin);
    const allowed = new Set<AppRole>(["founder", "c_level", "direcao", "coordinator"]);
    const ids = [...roles.entries()]
      .filter(([, r]) => r.some((x) => allowed.has(x)))
      .map(([id]) => id);
    if (ids.length === 0) return [];
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", ids)
      .order("username", { ascending: true });
    if (error) throw new Error(error.message);
    return (profiles ?? []).map((p) => ({ id: p.id, username: p.username }));
  });

export const setUserAreas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        areas: z.array(z.string().trim().min(1).max(80)).max(40),
        /** Áreas em que o usuário é LÍDER; as demais entram como auxiliar */
        lideres: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetAllowed(supabaseAdmin, actorIsFounder, data.userId);
    const uniqueAreas = Array.from(new Set(data.areas.map((area) => area.trim()).filter(Boolean)));
    const lideres = new Set((data.lideres ?? []).map((area) => area.trim()).filter(Boolean));

    const { error: delError } = await supabaseAdmin
      .from("user_areas")
      .delete()
      .eq("user_id", data.userId);
    if (delError) throw new Error(delError.message);

    if (uniqueAreas.length > 0) {
      const { error } = await supabaseAdmin.from("user_areas").insert(
        uniqueAreas.map((area) => ({
          user_id: data.userId,
          area,
          nivel: lideres.has(area) ? "lider" : "auxiliar",
        }))
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Gera um token temporário seguro para primeiro acesso / reset de senha */
function generateToken(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        username: usernameSchema,
        role: roleSchema,
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "create");
    if (data.role === "founder" && !actorIsFounder) {
      throw new Error("Apenas o FOUNDER pode criar outro FOUNDER");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const token = generateToken();
    const email = `${data.username}@host.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: token,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error) throw new Error(error.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });
    if (roleError) throw new Error(roleError.message);

    const { error: flagError } = await supabaseAdmin
      .from("profiles")
      .update({ deve_trocar_senha: true })
      .eq("id", created.user.id);
    if (flagError) throw new Error(flagError.message);

    return { ok: true, id: created.user.id, token };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "delete");
    if (data.userId === context.userId) throw new Error("Você não pode excluir a própria conta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetAllowed(supabaseAdmin, actorIsFounder, data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetAllowed(supabaseAdmin, actorIsFounder, data.userId);

    const token = generateToken();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: token,
    });
    if (error) throw new Error(error.message);

    const { error: flagError } = await supabaseAdmin
      .from("profiles")
      .update({ deve_trocar_senha: true })
      .eq("id", data.userId);
    if (flagError) throw new Error(flagError.message);

    return { ok: true, token };
  });

/** Usuário logado define a própria senha no primeiro acesso / após reset */
export const definirMinhaSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z
          .string()
          .min(6, "Senha deve ter ao menos 6 caracteres")
          .max(72, "Senha deve ter no máximo 72 caracteres"),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    const { error: flagError } = await supabaseAdmin
      .from("profiles")
      .update({ deve_trocar_senha: false })
      .eq("id", context.userId);
    if (flagError) throw new Error(flagError.message);

    return { ok: true };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetAllowed(supabaseAdmin, actorIsFounder, data.userId);
    if (data.role === "founder" && !actorIsFounder) {
      throw new Error("Apenas o FOUNDER pode promover a FOUNDER");
    }
    if (data.userId === context.userId && actorIsFounder && data.role !== "founder") {
      throw new Error("O FOUNDER não pode rebaixar a si mesmo");
    }

    const { error: delError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delError) throw new Error(delError.message);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ACTION_KEYS = ["view", "create", "edit", "delete", "approve"] as const;
const actionsSchema = z.array(z.enum(ACTION_KEYS)).min(1).max(5);

/** Garante que o chamador é FOUNDER (única função que configura permissões/áreas). */
async function assertFounder(context: { supabase: any; userId: string }) {
  const { data: isFounder } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "founder" as AppRole,
  });
  if (!isFounder) throw new Error("Apenas o FOUNDER pode configurar permissões");
}

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        role: roleSchema,
        category: z.string().min(1),
        allowed: z.boolean(),
        actions: actionsSchema.optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertFounder(context);
    if (data.role === "founder") throw new Error("O FOUNDER sempre tem acesso total");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.allowed) {
      const { error } = await supabaseAdmin.from("role_permissions").upsert(
        {
          role: data.role,
          category: data.category,
          actions: data.actions ?? ["view"],
        },
        { onConflict: "role,category" }
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .eq("category", data.category);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Define/remove permissão de uma ÁREA para uma categoria — apenas FOUNDER */
export const setAreaPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        area: z.string().min(1),
        category: z.string().min(1),
        allowed: z.boolean(),
        actions: actionsSchema.optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertFounder(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.allowed) {
      const { error } = await supabaseAdmin.from("area_permissions").upsert(
        {
          area: data.area,
          category: data.category,
          actions: data.actions ?? ["view"],
        },
        { onConflict: "area,category" }
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("area_permissions")
        .delete()
        .eq("area", data.area)
        .eq("category", data.category);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Áreas personalizadas (CRUD) — apenas FOUNDER
 * ------------------------------------------------------------------ */

const areaKeySchema = z
  .string()
  .trim()
  .min(2, "Chave muito curta")
  .max(40)
  .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _");

export const upsertArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: areaKeySchema,
        label: z.string().trim().min(2).max(60),
        emoji: z.string().trim().min(1).max(8).default("•"),
        ordem: z.number().int().min(0).max(999).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertFounder(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("areas").upsert(
      {
        key: data.key,
        label: data.label,
        emoji: data.emoji,
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
      },
      { onConflict: "key" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: areaKeySchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertFounder(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove vínculos antes de apagar a área para não deixar dados órfãos.
    const { error: permError } = await supabaseAdmin
      .from("area_permissions")
      .delete()
      .eq("area", data.key);
    if (permError) throw new Error(permError.message);

    const { error: userError } = await supabaseAdmin
      .from("user_areas")
      .delete()
      .eq("area", data.key);
    if (userError) throw new Error(userError.message);

    const { error } = await supabaseAdmin.from("areas").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/**
 * Renomeia o usuário (username + e-mail interno de login).
 * O login usa `${username}@host.local`, portanto os dois precisam mudar juntos.
 */
export const renameUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), username: usernameSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorIsFounder = await assertManager(context, "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetAllowed(supabaseAdmin, actorIsFounder, data.userId);

    const username = data.username.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing && existing.id !== data.userId) {
      throw new Error("Já existe um usuário com esse nome");
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: `${username}@host.local`,
      email_confirm: true,
      user_metadata: { username },
    });
    if (authError) throw new Error(authError.message);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ username })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, username };
  });
