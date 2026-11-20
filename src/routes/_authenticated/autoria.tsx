import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileClock, Loader2, Lock, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { useMyRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  ABAS_DA_AUTORIA,
  CHAVE_SEM_ID,
  VERBO,
  abaDaTabela,
  buscaBate,
  contextoVazio,
  descobrirChaves,
  ehImagem,
  idDoRegistro,
  mudancasDoRegistro,
  nomeDaTabela,
  resumoDasMudancas,
  tabelasDaAba,
  textoDeBusca,
  tituloDoRegistro,
  valorLegivel,
  type ContextoAutoria,
  type Linha,
  type Mudanca,
  type RegistroAutoria,
} from "@/lib/autoria";

export const Route = createFileRoute("/_authenticated/autoria")({
  head: () => ({
    meta: [
      { title: "Registro de autoria — HOST" },
      { name: "description", content: "Quem mudou o quê no painel, com busca, filtro por aba e usuário." },
    ],
  }),
  component: Autoria,
});

interface LinhaAutoria extends RegistroAutoria {
  user_id: string | null;
  username: string | null;
  criado_em: string;
}

const PAGINA = 150;
/** Com busca, lê o histórico inteiro (até aqui) para achar a palavra em qualquer registro. */
const LIMITE_DA_BUSCA = 5000;

const PERIODOS = [
  { value: "tudo", label: "Qualquer data", dias: 0 },
  { value: "hoje", label: "Hoje", dias: 0 },
  { value: "7", label: "Últimos 7 dias", dias: 7 },
  { value: "30", label: "Últimos 30 dias", dias: 30 },
] as const;

function inicioDoPeriodo(p: string): string | null {
  if (p === "tudo") return null;
  const d = new Date();
  if (p === "hoje") d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - Number(p));
  return d.toISOString();
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const quandoCompleto = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/** Colunas que dão nome ao registro, por tabela (para "editou card #41 Login quebrado"). */
const COLUNAS_DO_NOME: Record<string, string> = {
  kanban_cards: "id, numero, titulo",
  dev_tasks: "id, title",
  financeiro_saidas: "id, titulo, valor, mes",
  ilegal_cronograma: "id, titulo, setagem",
  ilegal_coroas: "id, setagem, organizacao",
  peds: "id, responsavel, passaporte_ped, grupo, categoria",
  captacoes_estabelecimentos: "id, nome, status",
  staff_anotacoes: "id, staff_id, texto",
};

/** Colunas das tabelas sem "id", para descobrir qual registro cada edição mexeu. */
const COLUNAS_SEM_ID: Record<string, string> = {
  ilegal_detalhes: "*",
  server_log_permissoes: "categoria, cargos, areas",
};

// tabelas diferentes, colunas diferentes: aqui o tipo do cliente não ajuda
type Consulta = PromiseLike<{ data: unknown[] | null }> & {
  in: (c: string, v: string[]) => Consulta;
  order: (c: string, o: { ascending: boolean }) => Consulta;
  limit: (n: number) => Consulta;
  eq: (c: string, v: string) => Consulta;
};
const ler = (tabela: string, colunas: string) =>
  (supabase as unknown as { from: (t: string) => { select: (c: string) => Consulta } })
    .from(tabela)
    .select(colunas);

/** Monta o que a tela precisa para dizer QUAL registro mudou e mostrar nomes no lugar de códigos. */
async function montarContexto(
  linhas: LinhaAutoria[],
  pessoas: { id: string; username: string | null }[],
): Promise<ContextoAutoria> {
  const ctx = contextoVazio();
  for (const p of pessoas) {
    if (p.username) ctx.pessoas.set(p.id, p.username);
    ctx.linhas.set(`profiles:${p.id}`, { id: p.id, username: p.username });
  }

  const tarefas: Promise<void>[] = [];

  // organizações do ilegal (a ficha usa o nome delas)
  tarefas.push(
    (async () => {
      const { data } = await ler("ilegal_orgs", "id, categoria, setagem, local, grupo, organizacao, status");
      for (const o of (data ?? []) as Linha[]) ctx.linhas.set(`ilegal_orgs:${o["id"]}`, o);
    })(),
  );

  // o nome dos registros mudados nas outras tabelas
  const idsPorTabela = new Map<string, Set<string>>();
  for (const l of linhas) {
    if (!l.registro_id || !COLUNAS_DO_NOME[l.tabela]) continue;
    const s = idsPorTabela.get(l.tabela) ?? new Set<string>();
    s.add(l.registro_id);
    idsPorTabela.set(l.tabela, s);
  }
  for (const [tabela, ids] of idsPorTabela) {
    tarefas.push(
      (async () => {
        const { data } = await ler(tabela, COLUNAS_DO_NOME[tabela] ?? "id").in("id", [...ids].slice(0, 300));
        for (const r of (data ?? []) as Linha[]) ctx.linhas.set(`${tabela}:${r["id"]}`, r);
      })(),
    );
  }

  // fichas e acessos às logs: descobrir qual registro cada edição mexeu
  for (const tabela of new Set(linhas.map((l) => l.tabela).filter((t) => CHAVE_SEM_ID[t]))) {
    tarefas.push(
      (async () => {
        const [historico, atuais] = await Promise.all([
          ler("registro_autoria", "id, tabela, acao, registro_id, campos, antes, depois")
            .eq("tabela", tabela)
            .order("id", { ascending: false })
            .limit(5000),
          ler(tabela, COLUNAS_SEM_ID[tabela] ?? "*"),
        ]);
        const chave = CHAVE_SEM_ID[tabela] ?? "id";
        const achou = descobrirChaves(
          (historico.data ?? []) as RegistroAutoria[],
          (atuais.data ?? []) as Linha[],
          chave,
        );
        for (const [id, k] of achou) ctx.chaves.set(id, k);
        for (const r of (atuais.data ?? []) as Linha[]) ctx.linhas.set(`${tabela}:${r[chave]}`, r);
      })(),
    );
  }
  await Promise.all(tarefas);

  // registros que já foram apagados: o nome vem de quando foram criados ou apagados
  const faltam = [
    ...new Set(
      linhas
        .filter((l) => l.registro_id && !ctx.linhas.has(`${l.tabela}:${l.registro_id}`))
        .map((l) => l.registro_id as string),
    ),
  ].slice(0, 300);
  if (faltam.length) {
    const { data } = await ler("registro_autoria", "tabela, registro_id, antes, depois")
      .in("registro_id", faltam)
      .in("acao", ["INSERT", "DELETE"]);
    for (const r of (data ?? []) as Linha[]) {
      const k = `${r["tabela"]}:${r["registro_id"]}`;
      const linha = (r["antes"] ?? r["depois"]) as Linha | null;
      if (linha && !ctx.linhas.has(k)) ctx.linhas.set(k, linha);
    }
  }
  return ctx;
}

/** Registro de autoria (só o Founder): toda modificação feita no site, de quem e quando. */
function Autoria() {
  const { data: role, isLoading } = useMyRole();
  const [aba, setAba] = useState("todas");
  const [usuario, setUsuario] = useState("todos");
  const [acao, setAcao] = useState("todas");
  const [periodo, setPeriodo] = useState("tudo");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PAGINA);
  const founder = role === "founder";
  const buscando = busca.trim().length > 0;

  const pessoas = useQuery({
    queryKey: ["autoria-pessoas"],
    enabled: founder,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .order("username");
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const fotoDe = useMemo(
    () => new Map((pessoas.data ?? []).map((p) => [p.id, p.avatar_url])),
    [pessoas.data],
  );

  const limiteReal = buscando ? LIMITE_DA_BUSCA : limite;
  const q = useQuery({
    queryKey: ["registro-autoria", aba, usuario, acao, periodo, limiteReal],
    enabled: founder,
    queryFn: async (): Promise<LinhaAutoria[]> => {
      let r = supabase
        .from("registro_autoria")
        .select(
          "id, user_id, username, tabela, acao, registro_id, campos, antes, depois, criado_em",
        )
        .order("criado_em", { ascending: false })
        .limit(limiteReal);
      if (aba !== "todas") r = r.in("tabela", tabelasDaAba(aba));
      if (usuario !== "todos") r = r.eq("user_id", usuario);
      if (acao !== "todas") r = r.eq("acao", acao);
      const desde = inicioDoPeriodo(periodo);
      if (desde) r = r.gte("criado_em", desde);
      const { data, error } = await r;
      if (error) throw error;
      return (data ?? []) as unknown as LinhaAutoria[];
    },
    staleTime: 10_000,
    placeholderData: (anterior) => anterior,
  });

  const contexto = useQuery({
    queryKey: [
      "autoria-contexto",
      (q.data ?? []).map((l) => l.id).join(","),
      (pessoas.data ?? []).length,
    ],
    enabled: founder && !!q.data && !!pessoas.data,
    queryFn: () => montarContexto(q.data ?? [], pessoas.data ?? []),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const ctx = contexto.data ?? contextoVazio();

  const textos = useMemo(() => {
    const m = new Map<number, string>();
    if (!buscando) return m;
    for (const l of q.data ?? []) m.set(l.id, textoDeBusca(l, ctx));
    return m;
  }, [q.data, ctx, buscando]);

  const linhas = useMemo(() => {
    const todas = q.data ?? [];
    if (!buscando) return todas;
    return todas.filter((l) => buscaBate(textos.get(l.id) ?? "", busca));
  }, [q.data, textos, busca, buscando]);

  if (isLoading) return null;
  if (!founder)
    return (
      <div className="grid min-h-[50vh] place-items-center text-center text-sm text-muted-foreground">
        <div>
          <Lock className="mx-auto mb-3 size-6" />
          Esta aba é só do Founder.
        </div>
      </div>
    );

  const filtrosLigados =
    Number(aba !== "todas") +
    Number(usuario !== "todos") +
    Number(acao !== "todas") +
    Number(periodo !== "tudo") +
    Number(buscando);
  const voltar = () => setLimite(PAGINA);

  return (
    <>
      <PageHeader
        kicker="Sistema"
        title="Registro de autoria"
        subtitle="Toda modificação feita no site: quem fez, em qual aba, em qual registro, o que mudou (antes → depois) e quando."
      />
      <div className="autoria-filtros">
        <label className="autoria-busca">
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar qualquer coisa: pessoa, organização, setagem, card, campo, valor antigo ou novo…"
          />
          {buscando && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <MinimalSelect
          value={aba}
          onChange={(v) => {
            setAba(v);
            voltar();
          }}
          className="h-9 min-w-[170px] rounded-full px-3.5 text-xs"
          options={[
            { value: "todas", label: "Todas as abas" },
            ...ABAS_DA_AUTORIA.map((a) => ({ value: a, label: a })),
          ]}
        />
        <MinimalSelect
          value={usuario}
          onChange={(v) => {
            setUsuario(v);
            voltar();
          }}
          className="h-9 min-w-[160px] rounded-full px-3.5 text-xs"
          options={[
            { value: "todos", label: "Todos os usuários" },
            ...(pessoas.data ?? []).map((p) => ({ value: p.id, label: p.username || "—" })),
          ]}
        />
        <MinimalSelect
          value={acao}
          onChange={(v) => {
            setAcao(v);
            voltar();
          }}
          className="h-9 min-w-[120px] rounded-full px-3.5 text-xs"
          options={[
            { value: "todas", label: "Tudo" },
            { value: "INSERT", label: "Criou" },
            { value: "UPDATE", label: "Editou" },
            { value: "DELETE", label: "Apagou" },
          ]}
        />
        <MinimalSelect
          value={periodo}
          onChange={(v) => {
            setPeriodo(v);
            voltar();
          }}
          className="h-9 min-w-[140px] rounded-full px-3.5 text-xs"
          options={PERIODOS.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
        <span className="tabular-nums">
          <b className="text-foreground">{linhas.length}</b>{" "}
          {linhas.length === 1 ? "alteração" : "alterações"}
          {buscando ? ` com “${busca.trim()}”` : ""}
        </span>
        {(q.isFetching || contexto.isFetching) && <Loader2 className="size-3.5 animate-spin" />}
        {filtrosLigados > 0 && (
          <button
            type="button"
            className="ml-auto hover:text-foreground"
            onClick={() => {
              setAba("todas");
              setUsuario("todos");
              setAcao("todas");
              setPeriodo("tudo");
              setBusca("");
              voltar();
            }}
          >
            Limpar filtros ({filtrosLigados})
          </button>
        )}
      </div>

      <section className="glass mt-2 rounded-[22px] p-2">
        {q.isLoading ? (
          <div className="grid min-h-[200px] place-items-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : q.isError ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Não deu para ler o registro agora. (Se acabou de ser criado, o banco ainda não foi
            atualizado.)
          </p>
        ) : linhas.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <span className="hc-icone !size-10">
              <FileClock className="size-5" strokeWidth={1.75} />
            </span>
            <p className="hc-titulo mt-3">Nada por aqui</p>
            <p className="hc-nota mt-1">
              {buscando
                ? "Nenhuma alteração tem essa palavra. Tente outra, ou limpe os filtros."
                : "Quando alguém criar, editar ou apagar algo no site, aparece aqui."}
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-1">
            {linhas.map((l) => (
              <LinhaDoRegistro
                key={l.id}
                l={l}
                ctx={ctx}
                foto={(l.user_id && fotoDe.get(l.user_id)) || DEFAULT_AVATAR_URL}
              />
            ))}
          </ol>
        )}
        {!buscando && (q.data?.length ?? 0) >= limite && (
          <div className="flex justify-center p-2">
            <button
              type="button"
              className="hc-pilula"
              onClick={() => setLimite((n) => n + PAGINA)}
            >
              Carregar mais
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function LinhaDoRegistro({
  l,
  foto,
  ctx,
}: {
  l: LinhaAutoria;
  foto: string;
  ctx: ContextoAutoria;
}) {
  const [aberto, setAberto] = useState(false);
  const titulo = tituloDoRegistro(l, ctx);
  const resumo = resumoDasMudancas(l, ctx);
  return (
    <li className="autoria-linha" data-aberto={aberto ? "" : undefined}>
      <button
        type="button"
        className="autoria-topo"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <img src={foto} alt="" className="size-8 shrink-0 rounded-[10px] object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground">
            <b className="font-semibold">{l.username ?? "Alguém"}</b>{" "}
            <span className={cn("autoria-acao", `autoria-acao-${l.acao.toLowerCase()}`)}>
              {VERBO[l.acao] ?? l.acao}
            </span>{" "}
            {nomeDaTabela(l.tabela)}
            {titulo ? (
              <>
                {" "}
                <b className="autoria-alvo">{titulo}</b>
              </>
            ) : (
              <span className="text-muted-foreground"> (registro não identificado)</span>
            )}
          </span>
          <span className="hc-nota block truncate">
            {abaDaTabela(l.tabela)}
            {resumo && <> · {resumo}</>}
          </span>
        </span>
        <span className="hc-nota shrink-0 tabular-nums">{quando(l.criado_em)}</span>
        <ChevronDown className="autoria-seta size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      </button>
      {aberto && <DetalheDoRegistro l={l} ctx={ctx} titulo={titulo} />}
    </li>
  );
}

function DetalheDoRegistro({
  l,
  ctx,
  titulo,
}: {
  l: LinhaAutoria;
  ctx: ContextoAutoria;
  titulo: string | null;
}) {
  const mudancas = mudancasDoRegistro(l, ctx);
  const id = idDoRegistro(l, ctx);
  const titulos =
    l.acao === "UPDATE"
      ? "O que mudou (antes → depois)"
      : l.acao === "INSERT"
        ? "Como foi criado"
        : "Como estava quando foi apagado";
  return (
    <div className="autoria-detalhe">
      <div className="autoria-info">
        <Info rotulo="Quem">{l.username ?? "Alguém"}</Info>
        <Info rotulo="Quando">{quandoCompleto(l.criado_em)}</Info>
        <Info rotulo="Onde">
          aba {abaDaTabela(l.tabela)} · {nomeDaTabela(l.tabela)}
        </Info>
        <Info rotulo="Registro">
          {titulo ?? "não identificado"}
          {id && <span className="autoria-codigo">{id}</span>}
        </Info>
      </div>
      <p className="autoria-secao">
        {titulos}
        {l.acao === "UPDATE" && ` · ${mudancas.length} campo${mudancas.length === 1 ? "" : "s"}`}
      </p>
      {mudancas.length === 0 ? (
        <p className="hc-nota">Sem detalhes.</p>
      ) : (
        mudancas.map((m, i) => <CampoMudado key={`${m.rotulo}-${i}`} m={m} l={l} ctx={ctx} />)
      )}
    </div>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="autoria-info-item">
      <span className="autoria-info-rotulo">{rotulo}</span>
      <span className="min-w-0 break-words text-foreground">{children}</span>
    </div>
  );
}

function Valor({ campo, v, ctx, riscado }: { campo: string; v: unknown; ctx: ContextoAutoria; riscado?: boolean }) {
  if (ehImagem(v))
    return <img src={v} alt="" className={cn("autoria-imagem", riscado && "opacity-50")} />;
  return (
    <span className={cn("autoria-valor", riscado ? "autoria-antes" : "text-foreground")}>
      {valorLegivel(campo, v, ctx)}
    </span>
  );
}

function CampoMudado({ m, l, ctx }: { m: Mudanca; l: LinhaAutoria; ctx: ContextoAutoria }) {
  return (
    <div className="autoria-campo">
      <span className="autoria-campo-nome">{m.rotulo}</span>
      {l.acao !== "UPDATE" ? (
        <span className="min-w-0 flex-1">
          <Valor campo={m.campo} v={m.depois} ctx={ctx} />
        </span>
      ) : m.entrou || m.saiu ? (
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {(m.entrou ?? []).map((x, i) => (
            <span key={`e${i}`} className="autoria-chip autoria-chip-entrou">
              + {x}
            </span>
          ))}
          {(m.saiu ?? []).map((x, i) => (
            <span key={`s${i}`} className="autoria-chip autoria-chip-saiu">
              − {x}
            </span>
          ))}
          {!m.entrou?.length && !m.saiu?.length && (
            <span className="text-muted-foreground">mesma lista, em outra ordem ou com detalhe mudado</span>
          )}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 gap-y-1">
          <Valor campo={m.campo} v={m.antes} ctx={ctx} riscado />
          <span className="text-muted-foreground">→</span>
          <Valor campo={m.campo} v={m.depois} ctx={ctx} />
        </span>
      )}
    </div>
  );
}
