/**
 * HOST FAZENDAS — funções do servidor.
 *
 * O cliente só pede ações; aqui o servidor carrega o progresso e a ilha, confere
 * permissões, alcance e hora (do servidor), aplica as regras de src/lib/fazenda/regras.ts
 * e grava tudo de uma vez pela função fazenda_gravar (com ID de operação, sem repetir).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SOCIAL, type Material } from "@/lib/fazenda/catalogo";
import {
  adubacaoNaIlhaDoVisitante,
  adubar,
  aplicar,
  ErroDoJogo,
  inicioDoDiaBR,
  novaIlha,
  novoJogador,
  registrarPresenca,
  renovarPeriodos,
  type Acao,
  type Evento,
  type Ilha,
  type Jogador,
} from "@/lib/fazenda/regras";

type Db = SupabaseClient;
async function banco(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}
const uuid = () => crypto.randomUUID();
interface Linha<T> {
  dados: T;
  versao: number;
}
export interface Selo {
  nivel: number;
  cor: string;
}
export interface EstadoDaFazenda {
  jogador: Jogador;
  ilha: Ilha;
  agora: number;
  ev: Evento[];
}
export interface IlhaVisitada {
  ilha: Ilha;
  agora: number;
  dono: { id: string; nome: string; nivel: number; cor: string };
  visitantes: number;
  /** Acabou de chegar (não estava na ilha no último minuto): o dono recebe o aviso de que entrou. */
  novo?: boolean;
}

async function podeUsarHoki(db: Db, userId: string) {
  const { data } = await db.rpc("pode_usar_hoki", { _user_id: userId });
  if (!data) throw new Error("Sem acesso ao HOKI.");
}
async function nomeDe(db: Db, userId: string) {
  const { data } = await db.from("profiles").select("username").eq("id", userId).maybeSingle();
  return (data as { username?: string } | null)?.username || "alguém";
}
async function carregar(db: Db, userId: string) {
  const [{ data: j }, { data: i }] = await Promise.all([
    db.from("fazenda_jogadores").select("dados, versao").eq("user_id", userId).maybeSingle(),
    db.from("fazenda_ilhas").select("dados, versao").eq("dono_id", userId).maybeSingle(),
  ]);
  return { j: j as Linha<Jogador> | null, i: i as Linha<Ilha> | null };
}
async function carregarIlha(db: Db, donoId: string) {
  const { data } = await db
    .from("fazenda_ilhas")
    .select("dados, versao")
    .eq("dono_id", donoId)
    .maybeSingle();
  return data as Linha<Ilha> | null;
}
async function gravar(
  db: Db,
  args: {
    op: string;
    user: string;
    jogadorId: string;
    jogador: Jogador | null;
    jogadorVersao: number;
    ilhas: { dono: string; dados: Ilha; versao: number }[];
    resultado?: unknown;
    registro?: { ilha: string; nome: string; tipo: string; detalhe: string };
  },
) {
  const { data, error } = await db.rpc("fazenda_gravar", {
    p_op: args.op,
    p_user: args.user,
    p_jogador_id: args.jogadorId,
    p_jogador: args.jogador,
    p_jogador_versao: args.jogadorVersao,
    p_ilhas: args.ilhas,
    p_resultado: args.resultado ?? {},
    p_registro: args.registro ?? null,
  });
  if (error) {
    if (error.message.includes("fazenda_conflito")) return "conflito" as const;
    throw new Error(error.message);
  }
  return (data as { repetida?: boolean })?.repetida ? ("repetida" as const) : ("ok" as const);
}
async function amizadeAceita(db: Db, a: string, b: string) {
  const { data } = await db
    .from("fazenda_amizades")
    .select("id")
    .eq("status", "aceita")
    .or(`and(de.eq.${a},para.eq.${b}),and(de.eq.${b},para.eq.${a})`)
    .maybeSingle();
  return !!data;
}
/** Amigos aceitos que já criaram ilha (contam como vizinhos para a expansão). */
async function vizinhosCom(db: Db, userId: string) {
  const { data } = await db
    .from("fazenda_amizades")
    .select("de, para")
    .eq("status", "aceita")
    .or(`de.eq.${userId},para.eq.${userId}`);
  const ids = ((data ?? []) as { de: string; para: string }[]).map((r) =>
    r.de === userId ? r.para : r.de,
  );
  if (!ids.length) return 0;
  const { count } = await db
    .from("fazenda_ilhas")
    .select("dono_id", { count: "exact", head: true })
    .in("dono_id", ids);
  return count ?? 0;
}
/**
 * Pode entrar na ilha do dono? A ilha "aberta" (o modo padrão, guardado como "amigos")
 * recebe qualquer membro que usa o HOKI sem precisar de aceite: o dono só é avisado de
 * quem entrou. "Por convite" pede um convite válido e "privada" não recebe ninguém.
 */
async function acessoAIlha(db: Db, visitante: string, dono: string, privacidade: string) {
  if (visitante === dono) return true;
  if (privacidade === "privada") return false;
  if (privacidade === "amigos") return true;
  const { data } = await db
    .from("fazenda_convites")
    .select("id")
    .eq("dono", dono)
    .eq("convidado", visitante)
    .eq("revogado", false)
    .gt("expira_em", new Date().toISOString())
    .limit(1);
  return !!(data && data.length);
}
const opSchema = z.string().trim().min(8).max(80);
const posSchema = z.object({ x: z.number().finite(), z: z.number().finite() }).optional();
/** Ferramentas agem até 3 m do mascote (o quadrado do terreno é 1 m; a ilha começa no 0,0). */
function noAlcance(
  pos: { x: number; z: number } | undefined,
  x: number,
  zz: number,
  tamanho: number,
) {
  if (!pos) return false;
  const cx = x + 0.5 - tamanho / 2;
  const cz = zz + 0.5 - tamanho / 2;
  return Math.hypot(pos.x - cx, pos.z - cz) <= SOCIAL.alcanceFerramenta + 0.75;
}

// ---------------- entrar (cria a ilha no primeiro acesso) ----------------
export const fazendaEntrar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EstadoDaFazenda> => {
    const db = await banco();
    const user = context.userId;
    await podeUsarHoki(db, user);
    let { j, i } = await carregar(db, user);
    const agora = Date.now();
    if (!j || !i) {
      await db.rpc("fazenda_criar", {
        p_user: user,
        p_jogador: novoJogador(agora),
        p_ilha: novaIlha(),
      });
      ({ j, i } = await carregar(db, user));
      if (!j || !i) throw new Error("Não deu para criar a sua ilha agora.");
    }
    // presença do dia e virada de dia/semana
    const ev: Evento[] = [];
    const novo = structuredClone(j.dados);
    renovarPeriodos(novo, agora);
    registrarPresenca(novo, agora, ev);
    if (JSON.stringify(novo) !== JSON.stringify(j.dados)) {
      const r = await gravar(db, {
        op: `presenca:${user}:${novo.presenca.dia}:${j.versao}`,
        user,
        jogadorId: user,
        jogador: novo,
        jogadorVersao: j.versao,
        ilhas: [],
      });
      if (r === "ok") return { jogador: novo, ilha: i.dados, agora, ev };
    }
    return { jogador: j.dados, ilha: i.dados, agora, ev: [] };
  });

// ---------------- ações do dono na própria ilha ----------------
const acaoSchema = z.object({
  op: opSchema,
  acao: z.object({ t: z.string().min(2).max(30) }).passthrough(),
  pos: posSchema,
});
const ACOES_DE_FERRAMENTA = new Set(["arar", "plantar", "colher", "remover", "coletar"]);
export const fazendaAcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => acaoSchema.parse(d))
  .handler(async ({ data, context }): Promise<EstadoDaFazenda & { erro?: string }> => {
    const db = await banco();
    const user = context.userId;
    const acao = data.acao as unknown as Acao;
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const { j, i } = await carregar(db, user);
      if (!j || !i) throw new Error("Entre na fazenda primeiro.");
      const agora = Date.now();
      try {
        if (ACOES_DE_FERRAMENTA.has(acao.t)) {
          let x = (acao as { x?: number }).x;
          let zz = (acao as { z?: number }).z;
          if (acao.t === "coletar") {
            const o = i.dados.objetos.find((ob) => ob.id === (acao as { id: string }).id);
            x = o?.x;
            zz = o?.z;
          }
          if (x === undefined || zz === undefined || !noAlcance(data.pos, x, zz, i.dados.tamanho))
            throw new ErroDoJogo("Chegue mais perto (até 3 metros) para usar a ferramenta.");
        }
        const vizinhos = acao.t === "expandir" ? await vizinhosCom(db, user) : 0;
        const r = aplicar({ j: j.dados, i: i.dados }, acao, { agora, novoId: uuid, vizinhos });
        const g = await gravar(db, {
          op: data.op,
          user,
          jogadorId: user,
          jogador: r.j,
          jogadorVersao: j.versao,
          ilhas: [{ dono: user, dados: r.i, versao: i.versao }],
          resultado: { ev: r.ev },
        });
        if (g === "conflito") continue;
        if (g === "repetida") {
          const atual = await carregar(db, user);
          return { jogador: atual.j!.dados, ilha: atual.i!.dados, agora, ev: [] };
        }
        return { jogador: r.j, ilha: r.i, agora, ev: r.ev };
      } catch (e) {
        if (e instanceof ErroDoJogo)
          return { jogador: j.dados, ilha: i.dados, agora, ev: [], erro: e.message };
        throw e;
      }
    }
    throw new Error("A fazenda está ocupada agora. Tente de novo.");
  });

// ---------------- visitas ----------------
const donoSchema = z.object({ dono: z.string().uuid() });
async function sanearIlha(ilha: Ilha): Promise<Ilha> {
  // a ilha não tem dinheiro nem inventário (isso fica no jogador): pode ir inteira para quem visita
  return ilha;
}
export const fazendaVisitar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => donoSchema.parse(d))
  .handler(async ({ data, context }): Promise<IlhaVisitada & { erro?: string }> => {
    const db = await banco();
    const user = context.userId;
    await podeUsarHoki(db, user);
    const ilha = await carregarIlha(db, data.dono);
    const vazio = {
      ilha: novaIlha(),
      agora: Date.now(),
      dono: { id: data.dono, nome: "", nivel: 1, cor: "vermelho" },
      visitantes: 0,
    };
    if (!ilha) return { ...vazio, erro: "Essa pessoa ainda não criou a ilha." };
    if (!(await acessoAIlha(db, user, data.dono, ilha.dados.privacidade)))
      return { ...vazio, erro: "Você não tem permissão para entrar nessa ilha." };
    const desde = new Date(Date.now() - 60_000).toISOString();
    const { data: vis } = await db
      .from("fazenda_visitas")
      .select("visitante, removido")
      .eq("ilha_dono", data.dono)
      .gt("visto_em", desde);
    const lista = (vis ?? []) as { visitante: string; removido: boolean }[];
    const eu = lista.find((v) => v.visitante === user);
    if (eu?.removido) return { ...vazio, erro: "O dono pediu para você sair da ilha." };
    const outros = lista.filter(
      (v) => v.visitante !== user && v.visitante !== data.dono && !v.removido,
    ).length;
    if (user !== data.dono && !eu && outros >= SOCIAL.visitantesMax)
      return { ...vazio, erro: "A ilha está cheia (dono + 5 visitantes)." };
    if (user !== data.dono) {
      await db.from("fazenda_visitas").upsert({
        ilha_dono: data.dono,
        visitante: user,
        visto_em: new Date().toISOString(),
        removido: false,
      });
      if (!eu)
        await db.from("fazenda_registro").insert({
          ilha_dono: data.dono,
          ator: user,
          ator_nome: await nomeDe(db, user),
          tipo: "visita",
          detalhe: "visitou a ilha",
        });
    }
    const { data: dj } = await db
      .from("fazenda_jogadores")
      .select("nivel, cor")
      .eq("user_id", data.dono)
      .maybeSingle();
    return {
      ilha: await sanearIlha(ilha.dados),
      agora: Date.now(),
      dono: {
        id: data.dono,
        nome: await nomeDe(db, data.dono),
        nivel: (dj as Selo | null)?.nivel ?? 1,
        cor: (dj as Selo | null)?.cor ?? "vermelho",
      },
      visitantes: outros + (user !== data.dono ? 1 : 0),
      novo: user !== data.dono && !eu,
    };
  });

/**
 * Situação da fazenda de cada pessoa da lista (quem está na ilha agora): se já tem ilha,
 * o nível, a privacidade e se quem pergunta pode entrar direto.
 */
export interface IlhaDeAlguem {
  id: string;
  temIlha: boolean;
  nivel: number | null;
  cor: string;
  privacidade: string | null;
  podeEntrar: boolean;
}
export const fazendaIlhasDe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(80) }).parse(d))
  .handler(async ({ data, context }): Promise<IlhaDeAlguem[]> => {
    const db = await banco();
    const user = context.userId;
    await podeUsarHoki(db, user);
    const ids = [...new Set(data.ids)].filter((x) => x !== user);
    if (!ids.length) return [];
    const agoraIso = new Date().toISOString();
    const [{ data: ilhas }, { data: jogs }, { data: conv }] = await Promise.all([
      db.from("fazenda_ilhas").select("dono_id, privacidade").in("dono_id", ids),
      db.from("fazenda_jogadores").select("user_id, nivel, cor").in("user_id", ids),
      db
        .from("fazenda_convites")
        .select("dono")
        .eq("convidado", user)
        .eq("revogado", false)
        .gt("expira_em", agoraIso)
        .in("dono", ids),
    ]);
    const convidadoPor = new Set(((conv ?? []) as { dono: string }[]).map((c) => c.dono));
    return ids.map((id) => {
      const il = ((ilhas ?? []) as { dono_id: string; privacidade: string }[]).find(
        (x) => x.dono_id === id,
      );
      const jj = ((jogs ?? []) as { user_id: string; nivel: number; cor: string }[]).find(
        (x) => x.user_id === id,
      );
      const privacidade = il?.privacidade ?? null;
      return {
        id,
        temIlha: !!il,
        nivel: jj?.nivel ?? null,
        cor: jj?.cor ?? "vermelho",
        privacidade,
        podeEntrar:
          !!il && (privacidade === "amigos" || (privacidade === "convite" && convidadoPor.has(id))),
      };
    });
  });
/** Batida de presença do visitante (a cada ~25 s): mantém a vaga e avisa se perdeu o acesso. */
export const fazendaPresenca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => donoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await banco();
    const user = context.userId;
    if (user === data.dono) return { ok: true };
    const ilha = await carregarIlha(db, data.dono);
    const { data: v } = await db
      .from("fazenda_visitas")
      .select("removido")
      .eq("ilha_dono", data.dono)
      .eq("visitante", user)
      .maybeSingle();
    if (
      !ilha ||
      (v as { removido?: boolean } | null)?.removido ||
      !(await acessoAIlha(db, user, data.dono, ilha.dados.privacidade))
    )
      return { ok: false };
    await db.from("fazenda_visitas").upsert({
      ilha_dono: data.dono,
      visitante: user,
      visto_em: new Date().toISOString(),
      removido: false,
    });
    return { ok: true };
  });
export const fazendaRemoverVisitante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ visitante: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await banco();
    await db.from("fazenda_visitas").upsert({
      ilha_dono: context.userId,
      visitante: data.visitante,
      visto_em: new Date().toISOString(),
      removido: true,
    });
    return { ok: true };
  });

// ---------------- adubar (visitante) ----------------
export const fazendaAdubar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        op: opSchema,
        dono: z.string().uuid(),
        x: z.number().int(),
        z: z.number().int(),
        plantioId: z.string().max(80).optional(),
        pos: posSchema,
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      ilha?: Ilha;
      jogador?: Jogador;
      ev: Evento[];
      erro?: string;
      reducao?: number;
    }> => {
      const db = await banco();
      const user = context.userId;
      if (user === data.dono) return { ev: [], erro: "Adubo é para ajudar amigos." };
      await podeUsarHoki(db, user);
      if (!(await amizadeAceita(db, user, data.dono)))
        return { ev: [], erro: "Só amigos aceitos podem adubar." };
      const nome = await nomeDe(db, user);
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const [{ j, i: minha }, dono] = await Promise.all([
          carregar(db, user),
          carregarIlha(db, data.dono),
        ]);
        if (!j || !minha)
          return { ev: [], erro: "Crie a sua ilha primeiro (entre em Minha Ilha)." };
        if (!dono) return { ev: [], erro: "Ilha não encontrada." };
        if (!(await acessoAIlha(db, user, data.dono, dono.dados.privacidade)))
          return { ev: [], erro: "Você não tem acesso a essa ilha." };
        const { data: v } = await db
          .from("fazenda_visitas")
          .select("visto_em, removido")
          .eq("ilha_dono", data.dono)
          .eq("visitante", user)
          .maybeSingle();
        const visita = v as { visto_em: string; removido: boolean } | null;
        if (!visita || visita.removido || Date.now() - Date.parse(visita.visto_em) > 120_000)
          return { ev: [], erro: "Entre na ilha para adubar." };
        if (!noAlcance(data.pos, data.x, data.z, dono.dados.tamanho))
          return { ev: [], erro: "Chegue mais perto (até 3 metros)." };
        try {
          const agora = Date.now();
          const r = adubar(
            j.dados,
            dono.dados,
            data.dono,
            { id: user, nome },
            data.x,
            data.z,
            data.plantioId,
            { agora, novoId: uuid },
          );
          const minhaNova = adubacaoNaIlhaDoVisitante(minha.dados);
          const minutos = Math.round(r.reducao / 60_000);
          const g = await gravar(db, {
            op: data.op,
            user,
            jogadorId: user,
            jogador: r.visitante,
            jogadorVersao: j.versao,
            ilhas: [
              { dono: data.dono, dados: r.ilha, versao: dono.versao },
              { dono: user, dados: minhaNova, versao: minha.versao },
            ],
            registro: {
              ilha: data.dono,
              nome,
              tipo: "adubo",
              detalhe: `adubou um canteiro (−${minutos} min)`,
            },
          });
          if (g === "conflito") continue;
          return { ilha: r.ilha, jogador: r.visitante, ev: r.ev, reducao: r.reducao };
        } catch (e) {
          if (e instanceof ErroDoJogo) return { ev: [], erro: e.message };
          throw e;
        }
      }
      return { ev: [], erro: "A ilha está movimentada agora. Tente de novo." };
    },
  );

// ---------------- amizades e convites ----------------
export interface Amigo {
  id: string;
  nome: string;
  nivel: number | null;
  cor: string;
  temIlha: boolean;
  privacidade: string | null;
}
export const fazendaAmigos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await banco();
    const user = context.userId;
    const { data: rel } = await db
      .from("fazenda_amizades")
      .select("id, de, para, status, criado_em")
      .or(`de.eq.${user},para.eq.${user}`);
    const relacoes = (rel ?? []) as { id: string; de: string; para: string; status: string }[];
    const agoraIso = new Date().toISOString();
    const { data: conv } = await db
      .from("fazenda_convites")
      .select("id, dono, convidado, expira_em")
      .or(`dono.eq.${user},convidado.eq.${user}`)
      .eq("revogado", false)
      .gt("expira_em", agoraIso);
    const convites = (conv ?? []) as {
      id: string;
      dono: string;
      convidado: string;
      expira_em: string;
    }[];
    const ids = [
      ...new Set([
        ...relacoes.flatMap((r) => [r.de, r.para]),
        ...convites.flatMap((c) => [c.dono, c.convidado]),
      ]),
    ].filter((x) => x !== user);
    const [{ data: perfis }, { data: jogs }, { data: ilhas }] = await Promise.all([
      ids.length
        ? db.from("profiles").select("id, username").in("id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("fazenda_jogadores").select("user_id, nivel, cor").in("user_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("fazenda_ilhas").select("dono_id, privacidade").in("dono_id", ids)
        : Promise.resolve({ data: [] }),
    ]);
    const pessoa = (id: string): Amigo => {
      const p = ((perfis ?? []) as { id: string; username: string }[]).find((x) => x.id === id);
      const jj = ((jogs ?? []) as { user_id: string; nivel: number; cor: string }[]).find(
        (x) => x.user_id === id,
      );
      const il = ((ilhas ?? []) as { dono_id: string; privacidade: string }[]).find(
        (x) => x.dono_id === id,
      );
      return {
        id,
        nome: p?.username ?? "alguém",
        nivel: jj?.nivel ?? null,
        cor: jj?.cor ?? "vermelho",
        temIlha: !!il,
        privacidade: il?.privacidade ?? null,
      };
    };
    return {
      amigos: relacoes
        .filter((r) => r.status === "aceita")
        .map((r) => ({ relacao: r.id, ...pessoa(r.de === user ? r.para : r.de) })),
      recebidos: relacoes
        .filter((r) => r.status === "pendente" && r.para === user)
        .map((r) => ({ relacao: r.id, ...pessoa(r.de) })),
      enviados: relacoes
        .filter((r) => r.status === "pendente" && r.de === user)
        .map((r) => ({ relacao: r.id, ...pessoa(r.para) })),
      convitesRecebidos: convites
        .filter((c) => c.convidado === user)
        .map((c) => ({ convite: c.id, expiraEm: Date.parse(c.expira_em), ...pessoa(c.dono) })),
      convitesEnviados: convites
        .filter((c) => c.dono === user)
        .map((c) => ({ convite: c.id, expiraEm: Date.parse(c.expira_em), ...pessoa(c.convidado) })),
    };
  });
export const fazendaPedirAmizade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ para: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await banco();
    const user = context.userId;
    if (data.para === user) return { erro: "Você não pode se adicionar." };
    await podeUsarHoki(db, user);
    const { data: alvo } = await db.rpc("pode_usar_hoki", { _user_id: data.para });
    if (!alvo) return { erro: "Essa pessoa não usa o HOKI." };
    const { data: existe } = await db
      .from("fazenda_amizades")
      .select("id, de, status")
      .or(`and(de.eq.${user},para.eq.${data.para}),and(de.eq.${data.para},para.eq.${user})`)
      .maybeSingle();
    const ex = existe as { id: string; de: string; status: string } | null;
    if (ex?.status === "aceita") return { erro: "Vocês já são amigos." };
    if (ex && ex.de === data.para) {
      // a outra pessoa já tinha pedido: aceita direto
      await db.from("fazenda_amizades").update({ status: "aceita" }).eq("id", ex.id);
      return { ok: true, aceito: true };
    }
    if (ex) return { erro: "Pedido já enviado." };
    const { error } = await db.from("fazenda_amizades").insert({ de: user, para: data.para });
    if (error) return { erro: "Não deu para enviar o pedido." };
    return { ok: true };
  });
export const fazendaResponderAmizade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ relacao: z.string().uuid(), aceitar: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await banco();
    const user = context.userId;
    const { data: r } = await db
      .from("fazenda_amizades")
      .select("id, de, para, status")
      .eq("id", data.relacao)
      .maybeSingle();
    const rel = r as { id: string; de: string; para: string; status: string } | null;
    if (!rel || (rel.de !== user && rel.para !== user)) return { erro: "Pedido não encontrado." };
    if (data.aceitar) {
      if (rel.para !== user) return { erro: "Só quem recebeu pode aceitar." };
      await db.from("fazenda_amizades").update({ status: "aceita" }).eq("id", rel.id);
    } else await db.from("fazenda_amizades").delete().eq("id", rel.id);
    return { ok: true };
  });
export const fazendaConvidar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ convidado: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await banco();
    const user = context.userId;
    if (data.convidado === user) return { erro: "Você já é o dono." };
    await podeUsarHoki(db, user);
    const { data: alvo } = await db.rpc("pode_usar_hoki", { _user_id: data.convidado });
    if (!alvo) return { erro: "Essa pessoa não usa o HOKI." };
    await db.from("fazenda_convites").insert({
      dono: user,
      convidado: data.convidado,
      expira_em: new Date(Date.now() + SOCIAL.conviteMs).toISOString(),
    });
    return { ok: true };
  });
export const fazendaRevogarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await banco();
    await db
      .from("fazenda_convites")
      .update({ revogado: true })
      .eq("id", data.id)
      .eq("dono", context.userId);
    return { ok: true };
  });

// ---------------- presentes e correio ----------------
const MATERIAL = z.enum(["tabua", "tijolo", "cimento", "ferramenta"]);
export const fazendaPresentear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ op: opSchema, para: z.string().uuid(), material: MATERIAL }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await banco();
    const user = context.userId;
    if (data.para === user) return { erro: "Presentes são para amigos." };
    await podeUsarHoki(db, user);
    if (!(await amizadeAceita(db, user, data.para)))
      return { erro: "Só amigos aceitos podem trocar presentes." };
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const { j } = await carregar(db, user);
      if (!j) return { erro: "Crie a sua ilha primeiro." };
      const agora = Date.now();
      const eu = structuredClone(j.dados);
      renovarPeriodos(eu, agora);
      if (eu.diario.presentes >= SOCIAL.presentesEnviarDia)
        return { erro: "Você já enviou 3 presentes hoje." };
      if (eu.diario.presentesPara.includes(data.para))
        return { erro: "Você já enviou um presente para essa pessoa hoje." };
      const { count } = await db
        .from("fazenda_presentes")
        .select("id", { count: "exact", head: true })
        .eq("para", data.para)
        .gte("enviado_em", new Date(inicioDoDiaBR(agora)).toISOString());
      if ((count ?? 0) >= SOCIAL.presentesReceberDia)
        return { erro: "Essa pessoa já recebeu 5 presentes hoje." };
      eu.diario.presentes += 1;
      eu.diario.presentesPara.push(data.para);
      const g = await gravar(db, {
        op: data.op,
        user,
        jogadorId: user,
        jogador: eu,
        jogadorVersao: j.versao,
        ilhas: [],
      });
      if (g === "conflito") continue;
      if (g === "ok") {
        await db.from("fazenda_presentes").insert({
          de: user,
          para: data.para,
          material: data.material,
          expira_em: new Date(agora + SOCIAL.presenteValidadeMs).toISOString(),
        });
        await db.from("fazenda_registro").insert({
          ilha_dono: data.para,
          ator: user,
          ator_nome: await nomeDe(db, user),
          tipo: "presente",
          detalhe: `enviou um presente`,
        });
      }
      return { ok: true, jogador: eu };
    }
    return { erro: "Tente de novo." };
  });
export const fazendaCorreio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await banco();
    const user = context.userId;
    const { data } = await db
      .from("fazenda_presentes")
      .select("id, de, material, enviado_em, expira_em, resgatado_em")
      .eq("para", user)
      .is("resgatado_em", null)
      .gt("expira_em", new Date().toISOString())
      .order("enviado_em", { ascending: false });
    const lista = (data ?? []) as {
      id: string;
      de: string;
      material: Material;
      enviado_em: string;
      expira_em: string;
    }[];
    const ids = [...new Set(lista.map((p) => p.de))];
    const { data: perfis } = ids.length
      ? await db.from("profiles").select("id, username").in("id", ids)
      : { data: [] };
    const nome = (id: string) =>
      ((perfis ?? []) as { id: string; username: string }[]).find((p) => p.id === id)?.username ??
      "alguém";
    const { data: reg } = await db
      .from("fazenda_registro")
      .select("ator_nome, tipo, detalhe, criado_em")
      .eq("ilha_dono", user)
      .order("criado_em", { ascending: false })
      .limit(30);
    return {
      presentes: lista.map((p) => ({
        id: p.id,
        de: nome(p.de),
        material: p.material,
        enviadoEm: Date.parse(p.enviado_em),
        expiraEm: Date.parse(p.expira_em),
      })),
      registro: (
        (reg ?? []) as { ator_nome: string; tipo: string; detalhe: string; criado_em: string }[]
      ).map((r) => ({ ...r, em: Date.parse(r.criado_em) })),
    };
  });
export const fazendaResgatarPresente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ op: opSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await banco();
    const user = context.userId;
    // marca como resgatado primeiro (só uma vez); depois credita o material
    const { data: p } = await db
      .from("fazenda_presentes")
      .update({ resgatado_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("para", user)
      .is("resgatado_em", null)
      .gt("expira_em", new Date().toISOString())
      .select("material")
      .maybeSingle();
    const pres = p as { material: Material } | null;
    if (!pres) return { erro: "Presente indisponível (já resgatado ou vencido)." };
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const { j } = await carregar(db, user);
      if (!j) return { erro: "Crie a sua ilha primeiro." };
      const eu = structuredClone(j.dados);
      eu.materiais[pres.material] += 1;
      const g = await gravar(db, {
        op: data.op,
        user,
        jogadorId: user,
        jogador: eu,
        jogadorVersao: j.versao,
        ilhas: [],
      });
      if (g !== "conflito") return { ok: true, jogador: eu };
    }
    return { erro: "Tente de novo." };
  });
