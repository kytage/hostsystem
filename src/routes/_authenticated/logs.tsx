import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Hash, Loader2, Lock, Radio, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Indice, Indices } from "@/components/indice";
import { useMyRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/lib/realtime";
import {
  CANAIS_DE_LOG,
  CATEGORIAS_DE_LOG,
  SERVIDORES_DE_LOG,
  TOTAL_DE_CANAIS,
  type ServidorDeLog,
  type CategoriaDeLog,
} from "@/lib/logs-servidor";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { title: "Logs — HOST" },
      { name: "description", content: "As logs do servidor, por categoria, como no Discord." },
    ],
  }),
  component: LogsPage,
});

const PERIODOS = [
  { id: "hoje", nome: "Hoje" },
  { id: "7d", nome: "7 dias" },
  { id: "30d", nome: "30 dias" },
] as const;
type Periodo = (typeof PERIODOS)[number]["id"];

const CHAVE_CANAL = "logs-canal-escolhido";

interface LinhaDeLog {
  id: number;
  canal: string;
  jogador_id: string | null;
  jogador_nome: string | null;
  mensagem: string;
  dados: unknown;
  criado_em: string;
}

/** Desde quando vale cada período (Hoje = desde a meia-noite). */
function inicioDo(periodo: Periodo) {
  const d = new Date();
  if (periodo === "hoje") d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - (periodo === "7d" ? 7 : 30));
  return d.toISOString();
}

/** As últimas 200 logs do canal no período (com a busca por jogador, ID ou texto). */
async function buscarLogs(canal: string, periodo: Periodo, busca: string): Promise<LinhaDeLog[]> {
  let q = supabase
    .from("server_logs")
    .select("id, canal, jogador_id, jogador_nome, mensagem, dados, criado_em")
    .eq("canal", canal)
    .gte("criado_em", inicioDo(periodo))
    .order("criado_em", { ascending: false })
    .limit(200);
  const t = busca
    .trim()
    .replace(/[%,()*]/g, " ")
    .trim();
  if (t) q = q.or(`mensagem.ilike.%${t}%,jogador_nome.ilike.%${t}%,jogador_id.ilike.%${t}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LinhaDeLog[];
}

/** Quantas logs chegaram hoje, e de quantos canais diferentes. */
async function resumoDeHoje() {
  const { data, error } = await supabase
    .from("server_logs")
    .select("canal")
    .gte("criado_em", inicioDo("hoje"))
    .limit(10000);
  if (error) throw error;
  const porCanal = new Map<string, number>();
  for (const r of data ?? []) porCanal.set(r.canal, (porCanal.get(r.canal) ?? 0) + 1);
  return { total: data?.length ?? 0, porCanal };
}

const hora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const quando = (iso: string) => {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje ? hora.format(d) : `${dia.format(d)} ${hora.format(d)}`;
};
const lerCanal = () => {
  try {
    const v = localStorage.getItem(CHAVE_CANAL);
    if (v && CANAIS_DE_LOG.has(v)) return v;
  } catch {
    // sem acesso ao armazenamento do navegador: começa pelo primeiro canal
  }
  return CATEGORIAS_DE_LOG[2]?.canais[0]?.id ?? "dev/upload";
};

/**
 * Logs do servidor: à esquerda as categorias (as mesmas do Discord "Host - Logs"), cada uma com
 * os seus canais; à direita, as logs do canal escolhido. Por enquanto só o Founder vê.
 *
 * As logs ainda não chegam: o servidor passa a mandar cada uma para o site (além do Discord) no
 * próximo passo. Até lá cada canal mostra que está esperando o servidor.
 */
function LogsPage() {
  const { data: role, isLoading } = useMyRole();
  const [canal, setCanal] = useState<string>(lerCanal);
  /** Qual servidor do Discord está na lista da esquerda (começa no do canal escolhido). */
  const [servidor, setServidor] = useState<ServidorDeLog>(
    () => CANAIS_DE_LOG.get(lerCanal())?.servidor ?? "logs",
  );
  const [abertas, setAbertas] = useState<Set<string>>(
    () => new Set([CANAIS_DE_LOG.get(lerCanal())?.categoria.id ?? "dev"]),
  );
  const [buscaCanal, setBuscaCanal] = useState("");
  const [buscaLog, setBuscaLog] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const ehFounder = role === "founder";
  const termoLog = useAtrasado(buscaLog, 300);
  const logs = useQuery({
    queryKey: ["server-logs", canal, periodo, termoLog],
    queryFn: () => buscarLogs(canal, periodo, termoLog),
    enabled: ehFounder,
  });
  const resumo = useQuery({
    queryKey: ["server-logs-resumo"],
    queryFn: resumoDeHoje,
    enabled: ehFounder,
    staleTime: 15_000,
  });
  // logs novas aparecem na hora (a lista e os números)
  useRealtimeTable("server_logs", [["server-logs"], ["server-logs-resumo"]]);

  const escolher = (id: string) => {
    setCanal(id);
    setBuscaLog("");
    try {
      localStorage.setItem(CHAVE_CANAL, id);
    } catch {
      // sem acesso ao armazenamento: só não lembra na próxima visita
    }
  };
  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // busca de canal: mostra só as categorias com algum canal que bate (e abre todas elas)
  const termo = buscaCanal.trim().toLowerCase();
  const doServidor =
    SERVIDORES_DE_LOG.find((x) => x.id === servidor)?.categorias ?? CATEGORIAS_DE_LOG;
  const categorias = useMemo(() => {
    if (!termo) return doServidor;
    return doServidor
      .map((c) =>
        c.nome.toLowerCase().includes(termo)
          ? c
          : { ...c, canais: c.canais.filter((k) => k.nome.toLowerCase().includes(termo)) },
      )
      .filter((c) => c.canais.length > 0);
  }, [termo, doServidor]);

  if (isLoading) {
    return (
      <div className="grid min-h-[60svh] place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!ehFounder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <div className="glass hc p-8 text-center">
          <span className="hc-icone mx-auto !size-11">
            <Lock className="size-5" strokeWidth={1.75} />
          </span>
          <h1 className="hc-titulo mt-4">Área restrita</h1>
          <p className="hc-nota mt-1.5">As logs do servidor são exclusivas do Founder.</p>
        </div>
      </div>
    );
  }

  const atual = CANAIS_DE_LOG.get(canal);

  return (
    <div className="pagina">
      <PageHeader
        title="Logs"
        subtitle="Tudo o que o servidor registra, separado nas mesmas categorias do Discord."
      />

      <Indices>
        <Indice
          valor={SERVIDORES_DE_LOG.reduce((n, x) => n + x.categorias.length, 0)}
          titulo="Categorias"
          nota="dos dois servidores do Discord"
        />
        <Indice valor={TOTAL_DE_CANAIS} titulo="Canais" nota="cada um com a sua log" />
        <Indice
          valor={resumo.data?.porCanal.size ?? 0}
          titulo="Canais com log hoje"
          nota={resumo.data?.porCanal.size ? "mandando para o site" : "o servidor ainda não mandou"}
        />
        <Indice
          valor={resumo.data?.total ?? 0}
          titulo="Logs hoje"
          nota={resumo.data?.total ? "recebidas desde a meia-noite" : "nenhuma recebida"}
        />
      </Indices>

      <div className="logs-grade">
        {/* ---------- categorias e canais ---------- */}
        <aside className="glass hc logs-lista" aria-label="Categorias de log">
          {/* os dois servidores de log do Discord */}
          <div
            className="segmentos logs-servidores"
            role="tablist"
            aria-label="Servidor do Discord"
          >
            {SERVIDORES_DE_LOG.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={servidor === x.id}
                onClick={() => setServidor(x.id)}
              >
                {x.nome}
              </button>
            ))}
          </div>
          <label className="campo-busca">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input
              value={buscaCanal}
              onChange={(e) => setBuscaCanal(e.target.value)}
              placeholder="Buscar canal ou categoria"
              aria-label="Buscar canal ou categoria"
            />
            {buscaCanal && (
              <button type="button" onClick={() => setBuscaCanal("")} aria-label="Limpar busca">
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <div className="logs-categorias">
            {categorias.map((c) => (
              <Categoria
                key={c.id}
                c={c}
                aberta={!!termo || abertas.has(c.id)}
                canal={canal}
                hoje={resumo.data?.porCanal}
                onAlternar={() => alternar(c.id)}
                onCanal={escolher}
              />
            ))}
            {categorias.length === 0 && (
              <p className="hc-nota px-2 py-6 text-center">Nenhum canal.</p>
            )}
          </div>
        </aside>

        {/* ---------- as logs do canal escolhido ---------- */}
        <section className="glass hc logs-painel" aria-live="polite">
          <header className="logs-painel-topo">
            <div className="min-w-0">
              <p className="hc-sobre">
                {atual?.categoria.emoji} {atual?.categoria.nome}
              </p>
              <h2 className="logs-painel-titulo">
                <Hash className="size-[18px] text-white/35" strokeWidth={2} />
                <span className="truncate">{atual?.canal.nome}</span>
              </h2>
            </div>
            {resumo.data?.porCanal.get(canal) ? (
              <span className="hc-estado" title="Este canal já recebeu logs hoje">
                <i aria-hidden />
                {resumo.data.porCanal.get(canal)} hoje
              </span>
            ) : (
              <span className="hc-estado" title="Nenhuma log deste canal chegou hoje">
                <Radio className="size-3.5 text-white/50" strokeWidth={2} />
                Aguardando o servidor
              </span>
            )}
          </header>

          <div className="logs-filtros">
            <label className="campo-busca min-w-0 flex-1">
              <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
              <input
                value={buscaLog}
                onChange={(e) => setBuscaLog(e.target.value)}
                placeholder="Buscar por jogador, ID ou texto"
                aria-label="Buscar nas logs"
              />
            </label>
            <div className="segmentos" role="tablist" aria-label="Período">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={periodo === p.id}
                  onClick={() => setPeriodo(p.id)}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="logs-tabela" role="table" aria-label="Logs">
            <div className="logs-linha logs-linha-cabeca" role="row">
              <span role="columnheader">Quando</span>
              <span role="columnheader">Jogador</span>
              <span role="columnheader">O que aconteceu</span>
            </div>
            {logs.isLoading ? (
              <div className="logs-vazio">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : logs.isError ? (
              <div className="logs-vazio">
                <p className="hc-titulo">Não deu para carregar as logs</p>
                <p className="hc-nota mt-1">Tente de novo em instantes.</p>
              </div>
            ) : logs.data && logs.data.length > 0 ? (
              logs.data.map((l) => <LinhaLog key={l.id} l={l} />)
            ) : (
              <div className="logs-vazio">
                <span className="hc-icone !size-11">
                  <Radio className="size-5" strokeWidth={1.75} />
                </span>
                <p className="hc-titulo mt-3">
                  {termoLog.trim() ? "Nada encontrado" : "Nenhuma log neste período"}
                </p>
                <p className="hc-nota mx-auto mt-1 max-w-[380px]">
                  {termoLog.trim()
                    ? "Tente outro nome, ID ou palavra, ou um período maior."
                    : "As logs deste canal aparecem aqui assim que o servidor mandar, ao vivo."}
                </p>
              </div>
            )}
            {logs.data && logs.data.length >= 200 && (
              <p className="hc-nota px-4 py-3 text-center">
                Mostrando as 200 mais recentes. Use a busca para achar uma log mais antiga.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Categoria({
  c,
  aberta,
  canal,
  hoje,
  onAlternar,
  onCanal,
}: {
  c: CategoriaDeLog;
  aberta: boolean;
  canal: string;
  /** Quantas logs chegaram hoje, por canal. */
  hoje: Map<string, number> | undefined;
  onAlternar: () => void;
  onCanal: (id: string) => void;
}) {
  const temAtual = c.canais.some((k) => k.id === canal);
  return (
    <div className="logs-categoria" data-aberta={aberta ? "" : undefined}>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberta}
        className={cn("logs-categoria-botao", temAtual && "text-white")}
      >
        <span className="logs-categoria-emoji" aria-hidden>
          {c.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate">{c.nome}</span>
        <span className="logs-categoria-conta">{c.canais.length}</span>
        <ChevronDown className="logs-categoria-seta" strokeWidth={2} aria-hidden />
      </button>
      {aberta && (
        <ul className="logs-canais">
          {c.canais.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => onCanal(k.id)}
                aria-current={k.id === canal ? "true" : undefined}
                className="logs-canal"
              >
                <Hash className="size-3.5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1 truncate">{k.nome}</span>
                {hoje?.get(k.id) ? (
                  <span className="logs-canal-conta">{hoje.get(k.id)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uma log: a hora, quem fez e o texto (clicando, abre o resto do que o servidor mandou). */
function LinhaLog({ l }: { l: LinhaDeLog }) {
  const [aberta, setAberta] = useState(false);
  const extra =
    l.dados && typeof l.dados === "object" && Object.keys(l.dados as object).length > 0
      ? JSON.stringify(l.dados, null, 2)
      : null;
  return (
    <div className="logs-linha logs-linha-dado" role="row">
      <span role="cell" className="tabular-nums text-white/55">
        {quando(l.criado_em)}
      </span>
      <span role="cell" className="min-w-0 truncate">
        {l.jogador_nome || l.jogador_id ? (
          <>
            {l.jogador_nome ?? "—"}
            {l.jogador_id && <span className="ml-1.5 text-white/40">#{l.jogador_id}</span>}
          </>
        ) : (
          <span className="text-white/35">—</span>
        )}
      </span>
      <span role="cell" className="min-w-0">
        <span className="whitespace-pre-wrap break-words">{l.mensagem}</span>
        {extra && (
          <>
            <button type="button" className="logs-mais" onClick={() => setAberta((v) => !v)}>
              {aberta ? "esconder detalhes" : "ver detalhes"}
            </button>
            {aberta && <pre className="logs-dados">{extra}</pre>}
          </>
        )}
      </span>
    </div>
  );
}

/** O valor só muda depois de `ms` sem mexer (a busca não consulta a cada letra). */
function useAtrasado<T>(valor: T, ms: number) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setV(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return v;
}
