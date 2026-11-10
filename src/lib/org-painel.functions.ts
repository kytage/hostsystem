/**
 * Funções do servidor do painel do líder e do link de afiliação.
 *
 * O líder não tem conta: quem autoriza cada chamada é o CÓDIGO do painel, que é
 * conferido aqui no servidor antes de qualquer leitura ou escrita. As tabelas
 * ficam fechadas pelo RLS e só este arquivo (service role) mexe nelas em nome
 * do líder — sempre limitado ao painel do código informado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  gerarSlug,
  LIMITE_MEMBROS,
  normalizarCodigo,
  urlSegura,
  type Cargo,
  type OrgMembro,
  type PainelDados,
} from "@/lib/org-painel-shared";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Valida a entrada e devolve uma mensagem legível (em vez do JSON do zod). */
function validar<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data as z.infer<S>;
}

const codigoSchema = z
  .string({ required_error: "Informe o código." })
  .max(40, "Código inválido.")
  .transform((valor, ctx) => {
    const codigo = normalizarCodigo(valor);
    if (!codigo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Código inválido." });
      return z.NEVER;
    }
    return codigo;
  });

const cargoSchema = z.enum(["lider", "gerente", "membro"]);
const nomeSchema = z.string().trim().min(2, "Informe o nome (mínimo de 2 letras).").max(60, "Nome muito longo.");
const discordSchema = z.string().trim().max(40, "Discord muito longo.");
const passaporteSchema = z.string().trim().max(12, "Passaporte muito longo.");

const membroNovoSchema = z.object({
  nome: nomeSchema,
  discord: discordSchema.default(""),
  passaporte: passaporteSchema.default(""),
  cargo: cargoSchema.default("membro"),
});

const slugSchema = z.string().regex(/^[a-z0-9]{6,20}$/, "Convite inválido.");

const COLUNAS_MEMBRO = "id, nome, discord, passaporte, cargo, slug, visitas, cliques, created_at";

async function abrirPainel(admin: Admin, codigo: string) {
  const { data, error } = await admin
    .from("org_paineis")
    .select("id, nome, setagem, lider_nome, link_destino, ativo")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error("Não foi possível validar o código agora. Tente de novo.");
  if (!data) throw new Error("Código inválido.");
  if (!data.ativo) throw new Error("Este painel foi desativado. Fale com a equipe da HOST.");
  return data;
}

async function listarMembros(admin: Admin, painelId: string): Promise<OrgMembro[]> {
  const { data, error } = await admin
    .from("org_membros")
    .select(COLUNAS_MEMBRO)
    .eq("painel_id", painelId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os membros.");
  return (data ?? []).map((m) => ({ ...m, cargo: m.cargo as Cargo }));
}

const chave = (valor: string) => valor.trim().replace(/^@/, "").toLowerCase();

/** Entra no painel: confere o código e devolve a organização com os membros. */
export const orgAbrir = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validar(z.object({ codigo: codigoSchema }), input))
  .handler(async ({ data }): Promise<PainelDados> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const painel = await abrirPainel(supabaseAdmin, data.codigo);
    await supabaseAdmin.from("org_paineis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", painel.id);
    return {
      painel: {
        nome: painel.nome,
        setagem: painel.setagem,
        lider_nome: painel.lider_nome,
        link_destino: urlSegura(painel.link_destino) ? painel.link_destino : "",
      },
      membros: await listarMembros(supabaseAdmin, painel.id),
    };
  });

/** Cadastra uma ou várias pessoas. Repetidos (mesmo Discord ou passaporte) são pulados. */
export const orgAdicionar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    validar(
      z.object({
        codigo: codigoSchema,
        membros: z.array(membroNovoSchema).min(1, "Informe ao menos uma pessoa.").max(LIMITE_MEMBROS, "Lista grande demais."),
      }),
      input,
    ),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const painel = await abrirPainel(supabaseAdmin, data.codigo);
    const atuais = await listarMembros(supabaseAdmin, painel.id);
    const vagas = LIMITE_MEMBROS - atuais.length;
    if (vagas <= 0) throw new Error(`A organização já chegou em ${LIMITE_MEMBROS} pessoas.`);

    const discords = new Set(atuais.map((m) => chave(m.discord)).filter(Boolean));
    const passaportes = new Set(atuais.map((m) => chave(m.passaporte)).filter(Boolean));
    const novos: z.infer<typeof membroNovoSchema>[] = [];
    let repetidos = 0;
    for (const m of data.membros) {
      const d = chave(m.discord);
      const p = chave(m.passaporte);
      if ((d && discords.has(d)) || (p && passaportes.has(p))) {
        repetidos++;
        continue;
      }
      if (d) discords.add(d);
      if (p) passaportes.add(p);
      novos.push(m);
    }

    const cabem = novos.slice(0, vagas);
    if (cabem.length > 0) {
      const { error } = await supabaseAdmin.from("org_membros").insert(
        cabem.map((m) => ({
          painel_id: painel.id,
          nome: m.nome,
          discord: m.discord,
          passaporte: m.passaporte,
          cargo: m.cargo,
          slug: gerarSlug(),
        })),
      );
      if (error) {
        throw new Error(
          error.message.includes("limite_membros")
            ? `A organização já chegou em ${LIMITE_MEMBROS} pessoas.`
            : "Não foi possível salvar. Tente de novo.",
        );
      }
    }

    return {
      adicionados: cabem.length,
      repetidos,
      semVaga: novos.length - cabem.length,
      membros: await listarMembros(supabaseAdmin, painel.id),
    };
  });

/** Edita os dados ou o cargo de uma pessoa do próprio painel. */
export const orgAtualizar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    validar(
      z.object({
        codigo: codigoSchema,
        id: z.string().uuid("Membro inválido."),
        nome: nomeSchema.optional(),
        discord: discordSchema.optional(),
        passaporte: passaporteSchema.optional(),
        cargo: cargoSchema.optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const painel = await abrirPainel(supabaseAdmin, data.codigo);
    const atuais = await listarMembros(supabaseAdmin, painel.id);
    if (!atuais.some((m) => m.id === data.id)) throw new Error("Essa pessoa não está mais na sua organização.");

    const outros = atuais.filter((m) => m.id !== data.id);
    if (data.discord !== undefined && chave(data.discord) && outros.some((m) => chave(m.discord) === chave(data.discord ?? ""))) {
      throw new Error("Já existe alguém com esse Discord na organização.");
    }
    if (data.passaporte !== undefined && chave(data.passaporte) && outros.some((m) => chave(m.passaporte) === chave(data.passaporte ?? ""))) {
      throw new Error("Já existe alguém com esse passaporte na organização.");
    }

    const patch: { nome?: string; discord?: string; passaporte?: string; cargo?: Cargo; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.discord !== undefined) patch.discord = data.discord;
    if (data.passaporte !== undefined) patch.passaporte = data.passaporte;
    if (data.cargo !== undefined) patch.cargo = data.cargo;

    const { error } = await supabaseAdmin.from("org_membros").update(patch).eq("id", data.id).eq("painel_id", painel.id);
    if (error) throw new Error("Não foi possível salvar. Tente de novo.");
    return { membros: await listarMembros(supabaseAdmin, painel.id) };
  });

/** Remove uma pessoa do próprio painel (o link de afiliação dela deixa de funcionar). */
export const orgRemover = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validar(z.object({ codigo: codigoSchema, id: z.string().uuid("Membro inválido.") }), input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const painel = await abrirPainel(supabaseAdmin, data.codigo);
    const { error } = await supabaseAdmin.from("org_membros").delete().eq("id", data.id).eq("painel_id", painel.id);
    if (error) throw new Error("Não foi possível remover. Tente de novo.");
    return { membros: await listarMembros(supabaseAdmin, painel.id) };
  });

/* ------------------------------------------------------------------ *
 * Link de afiliação (página pública do membro)
 * ------------------------------------------------------------------ */

/** Dados públicos do convite: só nome, cargo e organização — nunca Discord ou passaporte. */
export const conviteAbrir = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validar(z.object({ slug: slugSchema, contar: z.boolean().default(false) }), input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membro } = await supabaseAdmin
      .from("org_membros")
      .select("nome, cargo, painel_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!membro) throw new Error("Convite não encontrado.");
    const { data: painel } = await supabaseAdmin
      .from("org_paineis")
      .select("nome, link_destino, ativo")
      .eq("id", membro.painel_id)
      .maybeSingle();
    if (!painel || !painel.ativo) throw new Error("Convite não encontrado.");

    if (data.contar) await supabaseAdmin.rpc("org_convite_contar", { _slug: data.slug, _campo: "visita" });
    return {
      nome: membro.nome,
      cargo: membro.cargo as Cargo,
      org: painel.nome,
      link_destino: urlSegura(painel.link_destino) ? painel.link_destino : "",
    };
  });

/** Registra o clique no botão de entrar na cidade. */
export const conviteClique = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validar(z.object({ slug: slugSchema }), input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("org_convite_contar", { _slug: data.slug, _campo: "clique" });
    return { ok: true };
  });
