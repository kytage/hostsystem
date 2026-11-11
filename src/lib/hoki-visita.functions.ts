/**
 * Visitas do HOKI (funções do servidor).
 *
 * Quem entra por um convite ainda não tem conta: quem autoriza é o CÓDIGO do
 * convite, conferido aqui no servidor (service role). A conta criada não ganha
 * cargo nenhum, só a marca de visita: o banco deixa ela usar o HOKI e mais nada.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

function validar<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data as z.infer<S>;
}

const tokenSchema = z
  .string({ required_error: "Informe o código do convite." })
  .trim()
  .regex(/^[A-Za-z0-9]{8,32}$/, "Código de convite inválido.");

/** Mesmas regras do nome de usuário da equipe (é com ele que a visita entra depois). */
const nomeSchema = z
  .string({ required_error: "Escolha um nome." })
  .trim()
  .toLowerCase()
  .min(3, "O nome precisa ter ao menos 3 caracteres.")
  .max(20, "O nome pode ter no máximo 20 caracteres.")
  .regex(/^[a-z0-9_.]+$/, "Use só letras sem acento, números, _ ou ponto (sem espaço).");

const senhaSchema = z
  .string({ required_error: "Escolha uma senha." })
  .min(6, "A senha precisa ter ao menos 6 caracteres.")
  .max(72, "Senha longa demais.");

interface Convite {
  id: string;
  criado_por: string;
  expira_em: string;
  max_usos: number;
  usos: number;
  ativo: boolean;
}

/** Busca o convite e confere se ainda vale (ativo, no prazo e com vagas). */
async function conviteValido(admin: Admin, token: string): Promise<Convite> {
  const { data, error } = await admin
    .from("hoki_convites" as never)
    .select("id, criado_por, expira_em, max_usos, usos, ativo")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("Não deu para conferir o convite agora. Tente de novo.");
  const c = data as Convite | null;
  if (!c || !c.ativo) throw new Error("Esse convite não existe ou foi desligado.");
  if (new Date(c.expira_em).getTime() < Date.now())
    throw new Error("Esse convite venceu. Peça um novo.");
  if (c.usos >= c.max_usos)
    throw new Error("Esse convite já foi usado o máximo de vezes. Peça um novo.");
  return c;
}

/** Abre o convite: diz se ainda vale e quem convidou (só o nome de usuário). */
export const visitaConviteAbrir = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validar(z.object({ token: tokenSchema }), input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await conviteValido(supabaseAdmin, data.token);
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", c.criado_por)
      .maybeSingle();
    return { convidadoPor: perfil?.username ?? "a equipe" };
  });

/** Cria a conta de visita com o nome e a senha que a pessoa escolheu. */
export const visitaCriar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    validar(z.object({ token: tokenSchema, nome: nomeSchema, senha: senhaSchema }), input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await conviteValido(supabaseAdmin, data.token);

    // o nome vira o usuário de entrada: não pode repetir o de ninguém (equipe ou visita)
    const { data: existe } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.nome)
      .maybeSingle();
    if (existe) throw new Error("Esse nome já está em uso. Escolha outro.");

    // reserva a vaga no convite antes de criar a conta (só passa se ainda tiver vaga)
    const { data: reservado, error: erroVaga } = await supabaseAdmin
      .from("hoki_convites" as never)
      .update({ usos: c.usos + 1 } as never)
      .eq("id", c.id)
      .eq("usos", c.usos)
      .select("id");
    if (erroVaga || !(reservado as unknown[] | null)?.length)
      throw new Error("O convite acabou de ser usado por outra pessoa. Tente de novo.");

    const devolverVaga = () =>
      supabaseAdmin
        .from("hoki_convites" as never)
        .update({ usos: c.usos } as never)
        .eq("id", c.id)
        .eq("usos", c.usos + 1);

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.nome}@host.local`,
      password: data.senha,
      email_confirm: true,
      user_metadata: { username: data.nome, visita: true },
    });
    if (error || !criado.user) {
      await devolverVaga();
      const jaExiste = /already|registered|exists/i.test(error?.message ?? "");
      throw new Error(
        jaExiste ? "Esse nome já está em uso. Escolha outro." : "Não deu para criar a conta agora.",
      );
    }

    const { error: erroVisita } = await supabaseAdmin.from("hoki_visitantes" as never).insert({
      user_id: criado.user.id,
      nome: data.nome,
      convite_id: c.id,
      convidado_por: c.criado_por,
    } as never);
    if (erroVisita) {
      // sem a marca de visita a conta não teria acesso a nada: desfaz tudo
      await supabaseAdmin.auth.admin.deleteUser(criado.user.id);
      await devolverVaga();
      throw new Error("Não deu para criar a conta agora.");
    }
    return { ok: true as const, usuario: data.nome };
  });
