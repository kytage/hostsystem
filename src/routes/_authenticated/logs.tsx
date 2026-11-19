import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Map as IconeMapa,
  Hash,
  Loader2,
  Lock,
  MapPin,
  Radio,
  Search,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AntiCheatBot } from "@/components/anticheat-bot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAreas } from "@/lib/permissions";
import { getAuthUserData } from "@/lib/auth-cache";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/roles";
import { lerLog } from "@/lib/logs-leitura";
import { filtroDoBancoPorId, logMencionaId } from "@/lib/logs-id";
import {
  CHAVE_ABRIR_SUSPEITOS,
  segundosDoAlerta,
  useSuspeitos,
  type Suspeito,
} from "@/lib/logs-suspeitos";
import { MapaGta, lerCds, type EstiloDoMapa, type PontoNoMapa } from "@/components/mapa-gta";
import { CHAVE_PERMISSOES_LOGS, useAcessoLogs, type PermissaoDeLog } from "@/lib/logs-acesso";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/lib/realtime";
import {
  CANAIS_DE_LOG,
  CATEGORIAS_DE_LOG,
  SERVIDORES_DE_LOG,
  type ServidorDeLog,
  type CategoriaDeLog,
} from "@/lib/logs-servidor";

export const Route = createFileRoute("/_authenticated/logs")({
  // ?jogador=ID (vem do perfil do player): abre a Pesquisa geral pelo ID dele
  validateSearch: (s: Record<string, unknown>): { jogador?: string } => {
    const j = String(s["jogador"] ?? "").replace(/^#/, "").trim();
    return /^[0-9]{1,9}$/.test(j) ? { jogador: j } : {};
  },
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
/**
 * Como buscar: qualquer texto, ou um jogador por Perfil, ID ou Steam. Toda busca procura em todas
 * as logs que a pessoa pode ver (não só no canal aberto); com a caixa vazia, mostra o canal escolhido.
 */
const TIPOS_DE_BUSCA = [
  { id: "texto", nome: "Tudo", dica: "Buscar por nome, ID, Steam ou qualquer texto" },
  { id: "perfil", nome: "Perfil", dica: "Nome do jogador" },
  { id: "id", nome: "ID", dica: "ID (passaporte) do jogador" },
  { id: "steam", nome: "Steam", dica: "Steam (steam:110000… ou o número do perfil)" },
] as const;
type TipoDeBusca = (typeof TIPOS_DE_BUSCA)[number]["id"];

/** A Steam pode vir como "steam:110000…", o número do perfil ou o link do perfil. */
function termoDaSteam(t: string) {
  const perfil = t.match(/profiles\/(\d{17})/);
  if (perfil) return perfil[1]!;
  return t.replace(/^https?:\/\/\S*?steamcommunity\.com\/(id|profiles)\//i, "").replace(/\/$/, "");
}

async function buscarLogs(
  canal: string,
  periodo: Periodo,
  busca: string,
  tipo: TipoDeBusca = "texto",
  geral = false,
): Promise<LinhaDeLog[]> {
  let q = supabase
    .from("server_logs")
    .select("id, canal, jogador_id, jogador_nome, mensagem, dados, criado_em")
    .gte("criado_em", inicioDo(periodo))
    .order("criado_em", { ascending: false })
    .limit(200);
  const t = busca
    .trim()
    .replace(/[%,()*]/g, " ")
    .trim();
  // busca fica no canal escolhido; "Pesquisa geral" procura em todas as logs que a pessoa pode ver
  if (!t || !geral) q = q.eq("canal", canal);
  if (t && tipo === "texto") {
    q = q.or(`mensagem.ilike.%${t}%,jogador_nome.ilike.%${t}%,jogador_id.ilike.%${t}%`);
  } else if (t && tipo === "perfil") {
    q = q.or(`jogador_nome.ilike.%${t}%,mensagem.ilike.%${t}%`);
  } else if (t && tipo === "id") {
    const id = t.replace(/^#/, "");
    if (!/^\d{1,9}$/.test(id)) return [];
    // o ID aparece como "#1", "1 - Nome", "Passaporte: 1"... ("#3" não pode pegar "#396")
    q = q.or(filtroDoBancoPorId(id));
  } else if (t && tipo === "steam") {
    q = q.ilike("mensagem", `%${termoDaSteam(t)}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  const linhas = (data ?? []) as LinhaDeLog[];
  if (t && tipo === "id") {
    const id = t.replace(/^#/, "");
    return linhas.filter((l) => logMencionaId(l, id));
  }
  return linhas;
}

/** Quanto tempo o radar de uma log fica no mapa ao vivo. */
const MINUTOS_AO_VIVO = 120;

/** Todas as logs dos últimos 120 minutos (de todas as categorias que a pessoa pode ver). */
async function buscarAoVivo(): Promise<LinhaDeLog[]> {
  const desde = new Date(Date.now() - MINUTOS_AO_VIVO * 60_000).toISOString();
  const { data, error } = await supabase
    .from("server_logs")
    .select("id, canal, jogador_id, jogador_nome, mensagem, dados, criado_em")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as LinhaDeLog[];
}

/** Quantas logs chegaram hoje, e de quantos canais diferentes. */
async function resumoDeHoje() {
  // o banco já conta por canal (public.logs_resumo_desde); se a função ainda não existir, conta aqui
  const rpc = await supabase.rpc("logs_resumo_desde" as never, { p_desde: inicioDo("hoje") } as never);
  if (!rpc.error && Array.isArray(rpc.data)) {
    const porCanal = new Map<string, number>();
    let total = 0;
    for (const r of rpc.data as { canal: string; total: number | string }[]) {
      const n = Number(r.total) || 0;
      porCanal.set(r.canal, n);
      total += n;
    }
    return { total, porCanal };
  }
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
 * Logs do servidor: em cima, a troca entre os dois servidores do Discord, as categorias (botões)
 * e os canais da categoria escolhida; embaixo, as logs do canal. Coordinator+ vê tudo e, na
 * engrenagem de cada categoria, escolhe quem mais pode ver (por cargo ou área); os outros só veem
 * as categorias liberadas para eles (src/lib/logs-acesso.ts, a mesma regra do banco).
 */
function LogsPage() {
  const acesso = useAcessoLogs();
  const [canal, setCanal] = useState<string>(lerCanal);
  const [servidor, setServidor] = useState<ServidorDeLog>(
    () => CANAIS_DE_LOG.get(lerCanal())?.servidor ?? "logs",
  );
  const [busca, setBusca] = useState("");
  const { jogador } = Route.useSearch();
  const [buscaLog, setBuscaLog] = useState(jogador ?? "");
  const [tipoBusca, setTipoBusca] = useState<TipoDeBusca>(jogador ? "id" : "texto");
  /** false = busca só no canal aberto; true = "Pesquisa geral" (todos os canais). */
  const [geral, setGeral] = useState(!!jogador);
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [editando, setEditando] = useState<CategoriaDeLog | null>(null);
  /** Categorias recolhidas na coluna da esquerda (começa com todas abertas). */
  const [fechadas, setFechadas] = useState<Set<string>>(() => new Set());
  const termoLog = useAtrasado(buscaLog, 300);

  // os servidores e categorias que esta pessoa pode ver
  const servidores = useMemo(
    () =>
      SERVIDORES_DE_LOG.map((x) => ({
        ...x,
        categorias: x.categorias.filter((c) => acesso.podeVer(c.id)),
      })).filter((x) => x.categorias.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acesso.editor, acesso.porCategoria],
  );
  const doServidor = (servidores.find((x) => x.id === servidor) ?? servidores[0])?.categorias ?? [];
  const termo = busca.trim().toLowerCase();
  const categorias = termo
    ? doServidor.filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          c.canais.some((k) => k.nome.toLowerCase().includes(termo)),
      )
    : doServidor;

  // o canal escolhido precisa estar numa categoria visível; senão, o primeiro que der
  const atual = CANAIS_DE_LOG.get(canal);
  const canalValido = !!atual && acesso.podeVer(atual.categoria.id);
  const canalEfetivo = canalValido ? canal : (doServidor[0]?.canais[0]?.id ?? "");
  const efetivo = CANAIS_DE_LOG.get(canalEfetivo);

  const logs = useQuery({
    queryKey: [
      "server-logs",
      geral && termoLog.trim() ? "*" : canalEfetivo,
      periodo,
      termoLog,
      tipoBusca,
      geral,
    ],
    queryFn: () => buscarLogs(canalEfetivo, periodo, termoLog, tipoBusca, geral),
    enabled: !!canalEfetivo,
  });
  const resumo = useQuery({
    queryKey: ["server-logs-resumo"],
    queryFn: resumoDeHoje,
    enabled: acesso.temAcesso,
    staleTime: 15_000,
  });
  // logs novas aparecem na hora (a lista e os números)
  useRealtimeTable("server_logs", [
    ["server-logs"],
    ["server-logs-resumo"],
    ["server-logs-aovivo"],
  ]);

  const escolher = (id: string) => {
    setCanal(id);
    setBuscaLog("");
    try {
      localStorage.setItem(CHAVE_CANAL, id);
    } catch {
      // sem acesso ao armazenamento: só não lembra na próxima visita
    }
  };
  const trocarServidor = (id: ServidorDeLog) => {
    setServidor(id);
    setBusca("");
    const primeira = servidores.find((x) => x.id === id)?.categorias[0];
    if (primeira?.canais[0]) escolher(primeira.canais[0].id);
  };

  if (acesso.carregando) {
    return (
      <div className="grid min-h-[60svh] place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!acesso.temAcesso) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <div className="glass hc p-8 text-center">
          <span className="hc-icone mx-auto !size-11">
            <Lock className="size-5" strokeWidth={1.75} />
          </span>
          <h1 className="hc-titulo mt-4">Área restrita</h1>
          <p className="hc-nota mt-1.5">
            As logs do servidor são para Coordinator e acima, ou para quem tiver uma categoria
            liberada.
          </p>
        </div>
      </div>
    );
  }

  const totalCategorias = servidores.reduce((n, x) => n + x.categorias.length, 0);
  const totalCanais = servidores.reduce(
    (n, x) => n + x.categorias.reduce((m, c) => m + c.canais.length, 0),
    0,
  );
  const hoje = resumo.data?.porCanal;
  const servidorAtivo = (servidores.find((x) => x.id === servidor) ?? servidores[0])?.id;

  return (
    <div className="pagina">
      <PageHeader
        title="Logs"
        subtitle="Tudo o que o servidor registra, separado nas mesmas categorias do Discord."
        actions={<AntiCheatBot ativo={acesso.temAcesso} />}
      />

      {/* números pequenos */}
      <div className="logs-numeros">
        <span>
          <b>{totalCategorias}</b> categorias
        </span>
        <span>
          <b>{totalCanais}</b> canais
        </span>
        <span>
          <b>{hoje?.size ?? 0}</b> canais com log hoje
        </span>
        <span>
          <b>{resumo.data?.total ?? 0}</b> logs hoje
        </span>
      </div>

      {/* ---------- ao vivo: todas as logs no mapa e na lista ---------- */}
      <AoVivo
        onAbrirCanal={(id) => {
          const c = CANAIS_DE_LOG.get(id);
          if (c) setServidor(c.servidor);
          escolher(id);
        }}
      />

      <div className="logs-grade">
        {/* ---------- servidores, categorias e canais (coluna da esquerda) ---------- */}
        <aside className="glass hc logs-lista" aria-label="Categorias de log">
          {servidores.length > 1 && (
            <div
              className="segmentos logs-servidores"
              role="tablist"
              aria-label="Servidor do Discord"
            >
              {servidores.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={servidorAtivo === x.id}
                  onClick={() => trocarServidor(x.id)}
                >
                  {x.nome}
                </button>
              ))}
            </div>
          )}
          <label className="campo-busca">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar categoria ou canal"
              aria-label="Buscar categoria ou canal"
            />
            {busca && (
              <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca">
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <div className="logs-lista-acoes">
            <span>
              {categorias.length} {categorias.length === 1 ? "categoria" : "categorias"}
            </span>
            {categorias.some((c) => fechadas.has(c.id)) ? (
              <button type="button" onClick={() => setFechadas(new Set())}>
                <ChevronsUpDown className="size-3.5" strokeWidth={2} />
                Abrir todas
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFechadas(new Set(categorias.map((c) => c.id)))}
              >
                <ChevronsDownUp className="size-3.5" strokeWidth={2} />
                Fechar todas
              </button>
            )}
          </div>
          <div className="logs-categorias">
            {categorias.map((c) => (
              <CategoriaLateral
                key={c.id}
                c={c}
                aberta={!!termo || !fechadas.has(c.id)}
                canal={canalEfetivo}
                termo={termo}
                hoje={hoje}
                liberada={acesso.porCategoria.get(c.id)}
                editor={acesso.editor}
                onAlternar={() =>
                  setFechadas((f) => {
                    const n = new Set(f);
                    if (n.has(c.id)) n.delete(c.id);
                    else n.add(c.id);
                    return n;
                  })
                }
                onCanal={escolher}
                onConfigurar={() => setEditando(c)}
              />
            ))}
            {categorias.length === 0 && (
              <p className="hc-nota px-2 py-6 text-center">Nada encontrado.</p>
            )}
          </div>
        </aside>

        {/* ---------- as logs do canal escolhido ---------- */}
        <section className="glass hc logs-painel" aria-live="polite">
          <header className="logs-painel-topo">
            <div className="min-w-0">
              <p className="hc-sobre">
                {efetivo?.categoria.emoji} {efetivo?.categoria.nome}
              </p>
              <h2 className="logs-painel-titulo">
                <Hash className="size-[18px] text-white/35" strokeWidth={2} />
                <span className="truncate">{efetivo?.canal.nome}</span>
              </h2>
            </div>
            {hoje?.get(canalEfetivo) ? (
              <span className="hc-estado" title="Este canal já recebeu logs hoje">
                <i aria-hidden />
                {hoje.get(canalEfetivo)} hoje
              </span>
            ) : (
              <span className="hc-estado" title="Nenhuma log deste canal chegou hoje">
                <Radio className="size-3.5 text-white/50" strokeWidth={2} />
                Aguardando o servidor
              </span>
            )}
          </header>

          <div className="logs-filtros">
            <div className="segmentos" role="tablist" aria-label="Onde buscar">
              <button
                type="button"
                role="tab"
                aria-selected={!geral}
                onClick={() => setGeral(false)}
                title="A busca fica só neste canal"
              >
                <Hash className="size-3.5" strokeWidth={2} />
                <span className="max-w-32 truncate">{efetivo?.canal.nome ?? "Este canal"}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={geral}
                onClick={() => setGeral(true)}
                title="Busca em todos os canais que você pode ver"
              >
                <Search className="size-3.5" strokeWidth={2} /> Pesquisa geral
              </button>
            </div>
            <div className="segmentos" role="tablist" aria-label="Buscar por">
              {TIPOS_DE_BUSCA.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tipoBusca === t.id}
                  onClick={() => setTipoBusca(t.id)}
                  title={t.dica}
                >
                  {t.nome}
                </button>
              ))}
            </div>
            <label className="campo-busca min-w-0 flex-1">
              <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
              <input
                value={buscaLog}
                onChange={(e) => setBuscaLog(e.target.value)}
                placeholder={`${TIPOS_DE_BUSCA.find((t) => t.id === tipoBusca)?.dica ?? ""} — ${
                  geral ? "em todos os canais" : `só em #${efetivo?.canal.nome ?? "este canal"}`
                }`}
                aria-label="Buscar nas logs"
                inputMode={tipoBusca === "id" ? "numeric" : undefined}
              />
              {buscaLog && (
                <button type="button" onClick={() => setBuscaLog("")} aria-label="Limpar busca">
                  <X className="size-3.5" />
                </button>
              )}
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

          <div className="logs-tabela logs-lista-cartoes" aria-label="Logs">
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
              logs.data.map((l) => <LinhaLog key={l.id} l={l} mostrarCanal={geral && !!termoLog.trim()} />)
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

      {editando && (
        <QuemPodeVer
          categoria={editando}
          atual={acesso.porCategoria.get(editando.id)}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/** Uma categoria na coluna da esquerda: abre e fecha, mostra os canais e a engrenagem. */
function CategoriaLateral({
  c,
  aberta,
  canal,
  termo,
  hoje,
  liberada,
  editor,
  onAlternar,
  onCanal,
  onConfigurar,
}: {
  c: CategoriaDeLog;
  aberta: boolean;
  canal: string;
  termo: string;
  hoje: Map<string, number> | undefined;
  liberada: PermissaoDeLog | undefined;
  editor: boolean;
  onAlternar: () => void;
  onCanal: (id: string) => void;
  onConfigurar: () => void;
}) {
  const temAtual = c.canais.some((k) => k.id === canal);
  const canais =
    termo && !c.nome.toLowerCase().includes(termo)
      ? c.canais.filter((k) => k.nome.toLowerCase().includes(termo))
      : c.canais;
  const comLog = c.canais.reduce((n, k) => n + (hoje?.get(k.id) ?? 0), 0);
  const extra = (liberada?.cargos.length ?? 0) + (liberada?.areas.length ?? 0);
  return (
    <div className="logs-categoria" data-aberta={aberta ? "" : undefined}>
      <div className="logs-categoria-linha">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberta}
          className="logs-categoria-botao"
          data-atual={temAtual ? "" : undefined}
        >
          <span className="logs-categoria-emoji" aria-hidden>
            {c.emoji}
          </span>
          <span className="min-w-0 flex-1 truncate">{c.nome}</span>
          {comLog > 0 ? (
            <span className="logs-canal-conta">{comLog}</span>
          ) : (
            <span className="logs-categoria-conta">{c.canais.length}</span>
          )}
          <ChevronDown className="logs-categoria-seta" strokeWidth={2} aria-hidden />
        </button>
        {editor && (
          <button
            type="button"
            className="logs-categoria-config"
            onClick={onConfigurar}
            title={`Quem pode ver ${c.nome}`}
            aria-label={`Quem pode ver ${c.nome}`}
            data-liberada={extra > 0 ? "" : undefined}
          >
            <Settings2 className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      {aberta && (
        <ul className="logs-canais">
          {canais.map((k) => (
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

/** Cargos que dá para liberar (Coordinator e acima já veem tudo). */
const CARGOS_LIBERAVEIS = ROLE_ORDER.slice(ROLE_ORDER.indexOf("coordinator") + 1);

/** Engrenagem da categoria: quem, além de Coordinator+, pode ver (por cargo ou área). */
function QuemPodeVer({
  categoria,
  atual,
  onFechar,
}: {
  categoria: CategoriaDeLog;
  atual: PermissaoDeLog | undefined;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { data: areas = [] } = useAreas();
  const [cargos, setCargos] = useState<string[]>(atual?.cargos ?? []);
  const [areasSel, setAreasSel] = useState<string[]>(atual?.areas ?? []);
  const alterna = (lista: string[], v: string) =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

  const salvar = useMutation({
    mutationFn: async () => {
      const auth = await getAuthUserData();
      const { error } = await supabase.from("server_log_permissoes").upsert({
        categoria: categoria.id,
        cargos,
        areas: areasSel,
        atualizado_por: auth.user?.id ?? null,
        atualizado_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHAVE_PERMISSOES_LOGS });
      toast.success(`Pronto: quem pode ver ${categoria.nome} foi salvo.`);
      onFechar();
    },
    onError: () => toast.error("Não foi possível salvar. Tente de novo."),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {categoria.emoji} Quem pode ver {categoria.nome}
          </DialogTitle>
          <DialogDescription>
            Coordinator e acima sempre veem. Marque os cargos e as áreas que também podem ver as
            logs desta categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="hc-sobre mb-2">Cargos</p>
            <div className="logs-opcoes">
              {CARGOS_LIBERAVEIS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={cargos.includes(r)}
                  onClick={() => setCargos((l) => alterna(l, r))}
                  className="logs-opcao"
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="hc-sobre mb-2">Áreas</p>
            <div className="logs-opcoes">
              {areas.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={areasSel.includes(a.key)}
                  onClick={() => setAreasSel((l) => alterna(l, a.key))}
                  className="logs-opcao"
                >
                  <span aria-hidden>{a.emoji}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button type="button" onClick={onFechar} className="pilula justify-center">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
          >
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Copia um texto e avisa. */
async function copiar(texto: string, oQue: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${oQue} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

/**
 * Uma log: a hora e um cartão com só o que importa (título, quem fez e as linhas "nome: valor"),
 * mais os botões de copiar as coordenadas (CDS), o ID do Discord e o jogador.
 */
function LinhaLog({
  l,
  semMapa = false,
  mostrarCanal = false,
}: {
  l: LinhaDeLog;
  semMapa?: boolean;
  /** Mostra a categoria e o canal (na busca por jogador, que junta todos os canais). */
  mostrarCanal?: boolean;
}) {
  const [noMapa, setNoMapa] = useState<{ x: number; y: number } | null>(null);
  const lida = useMemo(
    () => lerLog(l.mensagem, l.dados, l.jogador_id, l.jogador_nome),
    [l.mensagem, l.dados, l.jogador_id, l.jogador_nome],
  );
  const { jogador } = lida;
  const textoJogador = jogador
    ? [jogador.nome, jogador.id && `#${jogador.id}`].filter(Boolean).join(" ")
    : "";
  return (
    <article className="log-item">
      <time className="log-item-hora" dateTime={l.criado_em}>
        {quando(l.criado_em)}
      </time>
      <div className="log-item-corpo">
        {mostrarCanal && (
          <p className="log-item-canal">
            {CANAIS_DE_LOG.get(l.canal)?.categoria.emoji}{" "}
            {CANAIS_DE_LOG.get(l.canal)?.categoria.nome} · #
            {CANAIS_DE_LOG.get(l.canal)?.canal.nome ?? l.canal}
          </p>
        )}
        {(lida.titulo || jogador) && (
          <div className="log-item-cabeca">
            {lida.titulo && <h3 className="log-item-titulo">{lida.titulo}</h3>}
            {jogador && (
              <span className="log-jogador">
                <span className="log-jogador-letra" aria-hidden>
                  {(jogador.nome ?? "#").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 truncate">
                  {jogador.nome ?? "Jogador"}
                  {jogador.id && <span className="log-jogador-id">#{jogador.id}</span>}
                </span>
                <button
                  type="button"
                  className="log-icone"
                  onClick={() => void copiar(textoJogador, "Jogador")}
                  title="Copiar nome e ID"
                  aria-label="Copiar nome e ID do jogador"
                >
                  <Copy className="size-3.5" strokeWidth={2} />
                </button>
                {jogador.id ? (
                  <Link
                    to="/players"
                    search={{ jogador: jogador.id }}
                    className="log-icone"
                    title="Abrir o perfil do jogador"
                    aria-label="Abrir o perfil do jogador"
                  >
                    <UserRound className="size-3.5" strokeWidth={2} />
                  </Link>
                ) : null}
              </span>
            )}
          </div>
        )}
        {lida.linhas.length > 0 && (
          <dl className="log-campos">
            {lida.linhas.map((x, n) =>
              x.rotulo ? (
                <div key={n} className="log-campo">
                  <dt>{x.rotulo}</dt>
                  <dd>{x.valor}</dd>
                </div>
              ) : (
                <p key={n} className="log-texto">
                  {x.valor}
                </p>
              ),
            )}
          </dl>
        )}
        {(lida.cds.length > 0 || lida.discord.length > 0) && (
          <div className="log-acoes">
            {lida.cds.map((c) => {
              const ponto = lerCds(c);
              return (
                <span key={c} className="contents">
                  {!semMapa && ponto && (
                    <button
                      type="button"
                      className="log-acao"
                      onClick={() => setNoMapa(ponto)}
                      title={c}
                    >
                      <IconeMapa className="size-3.5" strokeWidth={2} />
                      Ver no mapa
                    </button>
                  )}
                  <button
                    type="button"
                    className="log-acao"
                    onClick={() => void copiar(c, "CDS")}
                    title={c}
                  >
                    <MapPin className="size-3.5" strokeWidth={2} />
                    Copiar CDS
                  </button>
                </span>
              );
            })}
            {lida.discord.map((d) => (
              <button
                key={d}
                type="button"
                className="log-acao"
                onClick={() => void copiar(d, "ID do Discord")}
                title={d}
              >
                <Copy className="size-3.5" strokeWidth={2} />
                Copiar ID Discord
              </button>
            ))}
          </div>
        )}
      </div>
      {noMapa && (
        <Dialog open onOpenChange={(v) => !v && setNoMapa(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Onde aconteceu</DialogTitle>
              <DialogDescription>
                {lida.titulo || CANAIS_DE_LOG.get(l.canal)?.canal.nome} · {noMapa.x.toFixed(2)},{" "}
                {noMapa.y.toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            <MapaGta
              pontos={[{ id: l.id, x: noMapa.x, y: noMapa.y }]}
              foco={noMapa}
              selecionado={l.id}
              className="h-[min(62svh,560px)]"
            />
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}

/**
 * AO VIVO: todas as logs dos últimos 120 minutos, de todas as categorias que a pessoa pode ver.
 * No mapa, cada log com coordenadas vira um radar que vai esfriando até sumir em 120 minutos;
 * clicando no radar (ou na lista) abre a log por cima do mapa.
 */
function AoVivo({ onAbrirCanal }: { onAbrirCanal: (canal: string) => void }) {
  const [estilo, setEstilo] = useState<EstiloDoMapa>("atlas");
  /** O mapa e a lista ao vivo começam sempre ocultos (abre no botão). */
  const [aberto, setAberto] = useState(false);
  /** Aba SUSPEITOS (abre sozinha quando a pessoa chega pelo aviso). */
  const [suspeitosAberto, setSuspeitosAberto] = useState(() => {
    try {
      const v = sessionStorage.getItem(CHAVE_ABRIR_SUSPEITOS);
      sessionStorage.removeItem(CHAVE_ABRIR_SUSPEITOS);
      return !!v;
    } catch {
      return false;
    }
  });
  const acessoLogs = useAcessoLogs();
  const veSuspeitos = acessoLogs.podeVer("players");
  const suspeitos = useSuspeitos(veSuspeitos);
  const suspeitosHoje = (suspeitos.data ?? []).filter(
    (x) => new Date(x.fim).toDateString() === new Date().toDateString(),
  ).length;
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [foco, setFoco] = useState<{ x: number; y: number } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  // o radar esfria com o tempo: recalcula a cada minuto
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const q = useQuery({
    enabled: aberto,
    queryKey: ["server-logs-aovivo"],
    queryFn: buscarAoVivo,
    refetchInterval: 60_000,
  });

  const itens = useMemo(
    () =>
      (q.data ?? []).map((l) => {
        const lida = lerLog(l.mensagem, l.dados, l.jogador_id, l.jogador_nome);
        const ponto = lida.cds[0] ? lerCds(lida.cds[0]) : null;
        return { l, lida, ponto, onde: CANAIS_DE_LOG.get(l.canal) };
      }),
    [q.data],
  );
  const pontos: PontoNoMapa[] = useMemo(
    () =>
      itens
        .filter((i) => i.ponto)
        .map((i) => {
          const idade = (agora - new Date(i.l.criado_em).getTime()) / 60_000;
          return {
            id: i.l.id,
            x: i.ponto!.x,
            y: i.ponto!.y,
            forca: 1 - idade / MINUTOS_AO_VIVO,
            titulo: i.lida.titulo || i.onde?.canal.nome || "",
          };
        })
        .filter((p) => (p.forca ?? 0) > 0),
    [itens, agora],
  );
  const sel = itens.find((i) => i.l.id === selecionado) ?? null;
  const abrir = (id: number) => {
    setSelecionado(id);
    const i = itens.find((x) => x.l.id === id);
    if (i?.ponto) setFoco({ ...i.ponto });
  };

  return (
    <section className="glass hc logs-aovivo" aria-label="Logs ao vivo">
      <header className="logs-aovivo-topo">
        <span className="logs-aovivo-selo">
          <i aria-hidden />
          AO VIVO
        </span>
        <span className="hc-nota">
          {itens.length} {itens.length === 1 ? "log" : "logs"} nos últimos {MINUTOS_AO_VIVO} minutos
          · {pontos.length} no mapa
        </span>
        <div className="ml-auto flex items-center gap-2">
          {aberto && (
            <div className="segmentos" role="tablist" aria-label="Estilo do mapa">
              {(["atlas", "satelite"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  role="tab"
                  aria-selected={estilo === e}
                  onClick={() => setEstilo(e)}
                >
                  {e === "atlas" ? "Atlas" : "Satélite"}
                </button>
              ))}
            </div>
          )}
          {veSuspeitos && (
            <button
              type="button"
              className="pilula logs-suspeitos-botao"
              aria-expanded={suspeitosAberto}
              data-tem={suspeitosHoje > 0 ? "" : undefined}
              onClick={() => {
                setSuspeitosAberto((v) => !v);
                setAberto(false);
              }}
            >
              <Crosshair className="size-3.5" strokeWidth={2} />
              Suspeitos
              {suspeitosHoje > 0 && <span className="logs-canal-conta">{suspeitosHoje}</span>}
            </button>
          )}
          <button
            type="button"
            className="pilula"
            aria-expanded={aberto}
            onClick={() => {
              setAberto((v) => !v);
              setSuspeitosAberto(false);
            }}
          >
            {aberto ? (
              <EyeOff className="size-3.5" strokeWidth={2} />
            ) : (
              <Eye className="size-3.5" strokeWidth={2} />
            )}
            {aberto ? "Ocultar" : "Mostrar ao vivo"}
          </button>
        </div>
      </header>
      {suspeitosAberto && veSuspeitos && (
        <PainelSuspeitos lista={suspeitos.data ?? []} carregando={suspeitos.isLoading} />
      )}
      {aberto && (
        <div className="logs-aovivo-grade">
          <div className="logs-aovivo-mapa">
            <MapaGta
              pontos={pontos}
              selecionado={selecionado}
              foco={foco}
              estilo={estilo}
              onPonto={(id) => abrir(Number(id))}
              className="absolute inset-0"
            />
            {sel && (
              <div className="logs-aovivo-popup" role="dialog" aria-label="Log escolhida">
                <div className="logs-aovivo-popup-topo">
                  <span className="hc-sobre">
                    {sel.onde?.categoria.emoji} {sel.onde?.categoria.nome} · #{sel.onde?.canal.nome}
                  </span>
                  <button
                    type="button"
                    className="log-icone"
                    onClick={() => setSelecionado(null)}
                    aria-label="Fechar"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
                <LinhaLog l={sel.l} semMapa />
                <button
                  type="button"
                  className="log-acao mt-1"
                  onClick={() => onAbrirCanal(sel.l.canal)}
                >
                  <Hash className="size-3.5" strokeWidth={2} />
                  Abrir o canal
                </button>
              </div>
            )}
          </div>
          <ol className="logs-aovivo-lista">
            {q.isLoading && (
              <li className="logs-vazio !min-h-[200px]">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </li>
            )}
            {!q.isLoading && itens.length === 0 && (
              <li className="hc-nota px-3 py-10 text-center">
                Nenhuma log nos últimos {MINUTOS_AO_VIVO} minutos.
              </li>
            )}
            {itens.map((i) => (
              <li key={i.l.id}>
                <button
                  type="button"
                  className="logs-aovivo-item"
                  aria-current={i.l.id === selecionado ? "true" : undefined}
                  onClick={() => abrir(i.l.id)}
                >
                  <span className="logs-aovivo-hora">{quando(i.l.criado_em)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="logs-aovivo-canal">
                      {i.onde?.categoria.emoji} {i.onde?.canal.nome ?? i.l.canal}
                    </span>
                    <span className="logs-aovivo-titulo">
                      {i.lida.titulo || i.lida.linhas[0]?.valor || "Log"}
                      {i.lida.jogador?.nome && (
                        <span className="text-white/45"> · {i.lida.jogador.nome}</span>
                      )}
                    </span>
                  </span>
                  {i.ponto && (
                    <MapPin className="size-3.5 shrink-0 text-[#e5484d]" strokeWidth={2} />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** Aba SUSPEITOS: quem fez 4 ou mais kills em 60 segundos, com as logs das mortes. */
function PainelSuspeitos({ lista, carregando }: { lista: Suspeito[]; carregando: boolean }) {
  const [aberto, setAberto] = useState<number | null>(() => lista[0]?.id ?? null);
  if (carregando) {
    return (
      <div className="logs-vazio !min-h-[160px]">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (lista.length === 0) {
    return (
      <div className="logs-suspeitos-vazio">
        <span className="hc-icone !size-10">
          <Crosshair className="size-5" strokeWidth={1.75} />
        </span>
        <p className="hc-titulo mt-3">Nenhum suspeito nos últimos 7 dias</p>
        <p className="hc-nota mt-1">
          Quando alguém fizer 4 ou mais kills em 60 segundos, aparece aqui e o painel avisa na hora.
        </p>
      </div>
    );
  }
  return (
    <ol className="logs-suspeitos">
      {lista.map((x) => (
        <li key={x.id} className="logs-suspeito" data-aberto={aberto === x.id ? "" : undefined}>
          <button
            type="button"
            className="logs-suspeito-topo"
            onClick={() => setAberto((a) => (a === x.id ? null : x.id))}
            aria-expanded={aberto === x.id}
          >
            <span className="logs-suspeito-kills">
              <b>{x.kills}</b> kills
            </span>
            <span className="min-w-0 flex-1">
              <span className="logs-suspeito-nome">
                {x.jogador_nome ?? "Jogador"} <span className="text-white/45">#{x.jogador_id}</span>
              </span>
              <span className="hc-nota">
                em {segundosDoAlerta(x)} segundos · {quando(x.fim)}
              </span>
            </span>
            <ChevronDown className="logs-categoria-seta" strokeWidth={2} aria-hidden />
          </button>
          {aberto === x.id && <LogsDoSuspeito ids={x.logs} />}
        </li>
      ))}
    </ol>
  );
}

/** As logs das mortes que entraram no alerta. */
function LogsDoSuspeito({ ids }: { ids: number[] }) {
  const q = useQuery({
    queryKey: ["server-logs-suspeito", ids.join(",")],
    queryFn: async (): Promise<LinhaDeLog[]> => {
      const { data, error } = await supabase
        .from("server_logs")
        .select("id, canal, jogador_id, jogador_nome, mensagem, dados, criado_em")
        .in("id", ids)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LinhaDeLog[];
    },
  });
  if (q.isLoading) {
    return (
      <div className="logs-vazio !min-h-[120px]">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="logs-lista-cartoes">
      {(q.data ?? []).map((l) => (
        <LinhaLog key={l.id} l={l} />
      ))}
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
