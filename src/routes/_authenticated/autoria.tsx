import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileClock, Loader2, Lock, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { useMyRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  ABAS_DA_AUTORIA,
  CAMPOS_ESCONDIDOS,
  VERBO,
  abaDaTabela,
  nomeDaTabela,
  nomeDoRegistro,
  tabelasDaAba,
  valorEmTexto,
} from "@/lib/autoria";

export const Route = createFileRoute("/_authenticated/autoria")({
  head: () => ({
    meta: [
      { title: "Registro de autoria — HOST" },
      { name: "description", content: "Quem mudou o quê no painel, com filtro por aba e usuário." },
    ],
  }),
  component: Autoria,
});

interface LinhaAutoria {
  id: number;
  user_id: string | null;
  username: string | null;
  tabela: string;
  acao: string;
  registro_id: string | null;
  campos: string[];
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  criado_em: string;
}

const PAGINA = 150;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Registro de autoria (só o Founder): toda modificação feita no site, de quem e quando. */
function Autoria() {
  const { data: role, isLoading } = useMyRole();
  const [aba, setAba] = useState("todas");
  const [usuario, setUsuario] = useState("todos");
  const [acao, setAcao] = useState("todas");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PAGINA);
  const founder = role === "founder";

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

  const q = useQuery({
    queryKey: ["registro-autoria", aba, usuario, acao, limite],
    enabled: founder,
    queryFn: async (): Promise<LinhaAutoria[]> => {
      let r = supabase
        .from("registro_autoria")
        .select(
          "id, user_id, username, tabela, acao, registro_id, campos, antes, depois, criado_em",
        )
        .order("criado_em", { ascending: false })
        .limit(limite);
      if (aba !== "todas") r = r.in("tabela", tabelasDaAba(aba));
      if (usuario !== "todos") r = r.eq("user_id", usuario);
      if (acao !== "todas") r = r.eq("acao", acao);
      const { data, error } = await r;
      if (error) throw error;
      return (data ?? []) as unknown as LinhaAutoria[];
    },
    staleTime: 10_000,
  });

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const todas = q.data ?? [];
    if (!t) return todas;
    return todas.filter((l) =>
      [
        l.username,
        abaDaTabela(l.tabela),
        nomeDaTabela(l.tabela),
        nomeDoRegistro(l.antes, l.depois),
        l.campos.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(t),
    );
  }, [q.data, busca]);

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

  return (
    <>
      <PageHeader
        kicker="Sistema"
        title="Registro de autoria"
        subtitle="Toda modificação feita no site: quem fez, em qual aba, o que mudou e quando."
      />
      <div className="autoria-filtros">
        <label className="autoria-busca">
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, registro, campo…"
          />
        </label>
        <MinimalSelect
          value={aba}
          onChange={(v) => {
            setAba(v);
            setLimite(PAGINA);
          }}
          className="h-9 min-w-[180px] rounded-full px-3.5 text-xs"
          options={[
            { value: "todas", label: "Todas as abas" },
            ...ABAS_DA_AUTORIA.map((a) => ({ value: a, label: a })),
          ]}
        />
        <MinimalSelect
          value={usuario}
          onChange={(v) => {
            setUsuario(v);
            setLimite(PAGINA);
          }}
          className="h-9 min-w-[170px] rounded-full px-3.5 text-xs"
          options={[
            { value: "todos", label: "Todos os usuários" },
            ...(pessoas.data ?? []).map((p) => ({ value: p.id, label: p.username || "—" })),
          ]}
        />
        <MinimalSelect
          value={acao}
          onChange={(v) => {
            setAcao(v);
            setLimite(PAGINA);
          }}
          className="h-9 min-w-[140px] rounded-full px-3.5 text-xs"
          options={[
            { value: "todas", label: "Tudo" },
            { value: "INSERT", label: "Criou" },
            { value: "UPDATE", label: "Editou" },
            { value: "DELETE", label: "Apagou" },
          ]}
        />
      </div>

      <section className="glass mt-3 rounded-[22px] p-2">
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
              Quando alguém criar, editar ou apagar algo no site, aparece aqui.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-1">
            {linhas.map((l) => (
              <LinhaDoRegistro
                key={l.id}
                l={l}
                foto={(l.user_id && fotoDe.get(l.user_id)) || DEFAULT_AVATAR_URL}
              />
            ))}
          </ol>
        )}
        {(q.data?.length ?? 0) >= limite && (
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

function LinhaDoRegistro({ l, foto }: { l: LinhaAutoria; foto: string }) {
  const [aberto, setAberto] = useState(false);
  const nome = nomeDoRegistro(l.antes, l.depois);
  const campos =
    l.acao === "UPDATE"
      ? l.campos.filter((c) => !CAMPOS_ESCONDIDOS.has(c))
      : Object.keys(l.depois ?? l.antes ?? {}).filter((c) => !CAMPOS_ESCONDIDOS.has(c));
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
            {nome && <span className="text-muted-foreground"> · {nome}</span>}
          </span>
          <span className="hc-nota block truncate">
            {abaDaTabela(l.tabela)}
            {l.acao === "UPDATE" && campos.length > 0 && ` · mudou ${campos.join(", ")}`}
          </span>
        </span>
        <span className="hc-nota shrink-0 tabular-nums">{quando(l.criado_em)}</span>
        <ChevronDown className="autoria-seta size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      </button>
      {aberto && (
        <div className="autoria-detalhe">
          {campos.length === 0 ? (
            <p className="hc-nota">Sem detalhes.</p>
          ) : (
            campos.map((c) => (
              <div key={c} className="autoria-campo">
                <span className="autoria-campo-nome">{c.replace(/_/g, " ")}</span>
                {l.acao === "UPDATE" ? (
                  <span className="min-w-0 flex-1 break-words">
                    <span className="autoria-antes">{valorEmTexto(l.antes?.[c])}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span className="text-foreground">{valorEmTexto(l.depois?.[c])}</span>
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 break-words text-foreground">
                    {valorEmTexto((l.depois ?? l.antes)?.[c])}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </li>
  );
}
