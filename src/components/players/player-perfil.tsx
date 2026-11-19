import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  BadgeCheck,
  Car,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  FileDown,
  Flame,
  Gem,
  Heart,
  Loader2,
  Lock,
  Package,
  Phone,
  Search,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CopyBtn } from "@/components/players/player-inventario";
import { brl, itemBase, type Banimento, type Player } from "@/lib/players";
import { PdfDoPlayer } from "@/components/players/player-pdf";
import { lerLog } from "@/lib/logs-leitura";
import {
  BANNER_PADRAO,
  FOTO_PADRAO,
  cargoDoPlayer,
  categoriaDoCanal,
  dataCurta,
  haQuanto,
  situacaoDoPlayer,
  type Situacao,
  fetchLogsDoPlayer,
  lerGrupos,
  progressoNoRank,
  rankDoNivel,
  resumirLogs,
  type CargoId,
  type LogDoPlayer,
} from "@/lib/player-perfil";
import { COMANDOS_RAPIDOS, INTEGRACOES, montarComando } from "@/lib/player-integracoes";

const R2 = "https://image.hostgg.com.br";
const urlItem = (spawn: string) => `${R2}/inventory/${encodeURIComponent(spawn)}.png`;
const urlVeiculo = (spawn: string) => `${R2}/game/garage/${encodeURIComponent(spawn)}.png`;

const ICONE_CARGO: Record<CargoId, LucideIcon> = {
  admin: ShieldCheck,
  streamer: Video,
  creator: Sparkles,
  boss: Crown,
  host_ultimate: Flame,
  ultimate: Gem,
  baby_ultra: Zap,
  ultra: Zap,
  prime: Star,
  select: BadgeCheck,
  essencial: Heart,
  baby: Baby,
};

const num = (n: number) => n.toLocaleString("pt-BR");
const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Player só com o ID (veio de uma log, mas ainda não tem ficha no Painel de Players). */
export function playerSoComId(id: string, nome?: string | null): Player {
  return {
    id: `log-${id}`,
    license: "",
    passaporte: id,
    nome: nome || `Jogador #${id}`,
    idade: null,
    telefone: null,
    banco: 0,
    carteira: 0,
    grupos: [],
    inventario: [],
    veiculos: [],
    discord_id: null,
    discord_nome: null,
    online: false,
    level: 0,
    xp: 0,
    rank_vip: null,
    host_coins: 0,
    kills: 0,
    mortes: 0,
    headshots: 0,
    maior_sequencia: 0,
    ultimo_login: null,
    updated_at: new Date().toISOString(),
    whitelist: null,
  };
}

/** Painel do player: perfil, inventário/veículos, logs com estatísticas e comandos (em breve). */
export function PlayerPerfil({
  player: p,
  banimentos = [],
  semFicha,
  onClose,
}: {
  player: Player;
  /** Banimentos das Punições (o painel filtra os deste player). */
  banimentos?: Banimento[];
  /** true = o player ainda não tem ficha (abriu pelo ID de uma log). */
  semFicha?: boolean;
  onClose: () => void;
}) {
  const situacao = situacaoDoPlayer(p.passaporte, p.whitelist, banimentos);
  const [pdf, setPdf] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pp-janela max-h-[94svh] w-[97vw] max-w-[1800px] gap-0 overflow-y-auto p-0 xl:flex xl:h-[min(92svh,980px)] xl:flex-col xl:overflow-hidden">
        <DialogTitle className="sr-only">Perfil de {p.nome}</DialogTitle>
        {/* em telas largas tudo cabe na altura (sem rolar a janela): cada coluna rola por dentro */}
        <div className="grid gap-2.5 p-2.5 lg:grid-cols-[320px_minmax(0,1fr)] xl:min-h-0 xl:flex-1 xl:grid-cols-[320px_300px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
            <CartaoPerfil p={p} situacao={situacao} semFicha={semFicha} onPdf={() => setPdf(true)} />
            <CartaoGrupos p={p} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
            <InventarioVeiculos p={p} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col gap-2.5 lg:col-span-2 xl:col-span-1">
            <PainelLogs p={p} />
            <BarraComandos p={p} />
          </div>
        </div>
        {pdf && <PdfDoPlayer p={p} situacao={situacao} onClose={() => setPdf(false)} />}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ perfil */

function CartaoPerfil({
  p,
  situacao,
  semFicha,
  onPdf,
}: {
  p: Player;
  situacao: Situacao;
  semFicha?: boolean | undefined;
  onPdf: () => void;
}) {
  const grupos = useMemo(() => lerGrupos(p.grupos), [p.grupos]);
  const cargo = cargoDoPlayer(grupos);
  const rank = rankDoNivel(p.level);
  const progresso = progressoNoRank(p.level);
  const IconeCargo = cargo ? ICONE_CARGO[cargo.id] : null;

  return (
    <section className="pp-cartao shrink-0 overflow-hidden">
      <div className="relative h-24">
        <img src={BANNER_PADRAO} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-[#0d0d0d]" />
        <button
          onClick={onPdf}
          className="absolute left-2.5 top-2.5 flex h-[26px] items-center gap-1.5 rounded-full bg-black/55 px-2.5 text-[10.5px] font-bold text-white ring-1 ring-white/15 backdrop-blur hover:bg-black/75"
          title="Gerar PDF com tudo do player"
        >
          <FileDown className="size-3.5" /> PDF
        </button>
        {cargo && IconeCargo && (
          <span
            className="pp-emblema absolute right-2.5 top-2.5"
            style={{ "--cor": cargo.cor } as CSSProperties}
            title={`Cargo: ${cargo.rotulo}`}
          >
            {cargo.imagem ? (
              <img src={cargo.imagem} alt="" className="size-4" />
            ) : (
              <IconeCargo className="size-3.5" strokeWidth={2.2} />
            )}
            {cargo.rotulo}
          </span>
        )}
      </div>

      <div className="relative -mt-10 px-3 pb-3">
        <div className="flex items-end gap-3">
          <span className="relative shrink-0">
            <img
              src={FOTO_PADRAO}
              alt=""
              className="size-[72px] rounded-[18px] border-[3px] border-[#0d0d0d] object-cover shadow-xl"
            />
            <span
              title={p.online ? "Online" : "Offline"}
              className={cn(
                "absolute bottom-1 right-1 size-3 rounded-full border-2 border-[#0d0d0d]",
                p.online ? "bg-emerald-400" : "bg-white/25",
              )}
            />
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h2 className="flex items-baseline gap-1.5 truncate text-[15px] font-bold text-foreground">
              <span className="truncate">{p.nome || "Sem nome"}</span>
              {p.passaporte && (
                <span className="shrink-0 text-sm font-medium text-ink-3">#{p.passaporte}</span>
              )}
            </h2>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {p.discord_nome ? `@${p.discord_nome}` : semFicha ? "Sem ficha no painel" : "—"}
            </p>
          </div>
        </div>

        {/* status (online/offline + último login) e situação (whitelist / ban) */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <div className="min-w-0 rounded-xl bg-white/[0.03] px-2 py-1.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-3">Status</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-bold">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  p.online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-white/25",
                )}
              />
              {p.online ? "Online" : "Offline"}
            </p>
            <p
              className="truncate text-[10.5px] text-ink-3"
              title={p.ultimo_login ? `Último login: ${dataCurta(p.ultimo_login)}` : undefined}
            >
              Último login {haQuanto(p.ultimo_login)}
            </p>
          </div>
          <div
            className="min-w-0 rounded-xl px-2 py-1.5"
            style={{ background: `${situacao.cor}1f`, boxShadow: `inset 0 0 0 1px ${situacao.cor}40` }}
            title={situacao.detalhe ?? undefined}
          >
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-3">Situação</p>
            <p className="mt-0.5 truncate text-[12.5px] font-bold" style={{ color: situacao.cor }}>
              {situacao.rotulo}
            </p>
            <p className="truncate text-[10.5px] text-ink-3">{situacao.detalhe ?? " "}</p>
          </div>
        </div>

        {/* nível + rank */}
        <div className="mt-3 flex items-center gap-2.5">
          <img
            src={rank.imagem}
            alt=""
            title={`Rank do nível ${rank.min}${rank.ate ? `–${rank.ate}` : "+"}`}
            className="size-10 shrink-0 object-contain drop-shadow"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>
                Level <b className="text-[14px] font-bold text-foreground">{p.level}</b>
              </span>
              <span className="tabular-nums">
                {rank.ate ? `próximo rank no ${rank.ate}` : "rank máximo"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, progresso * 100)}%`,
                  background: rank.cor === "#000000" ? "#e5e5e5" : rank.cor,
                }}
              />
            </div>
          </div>
        </div>

        {/* números */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <Numero rotulo="Host Coins" valor={`${num(p.host_coins)} HC`} icone={Gem} />
          <Numero rotulo="Banco" valor={brl(p.banco)} icone={Package} titulo={`Carteira: ${brl(p.carteira)}`} />
          <Numero rotulo="Telefone" valor={p.telefone || "—"} icone={Phone} />
        </div>

        {/* identificação: tudo copiável */}
        <dl className="mt-2.5 divide-y divide-white/[0.05] rounded-xl bg-white/[0.025] px-2.5">
          <Dado rotulo="ID" valor={p.passaporte} mono />
          <Dado rotulo="License (Steam Hex)" valor={p.license} mono />
          <Dado rotulo="ID Discord" valor={p.discord_id} mono />
          <Dado rotulo="Idade" valor={p.idade != null ? String(p.idade) : null} copiar={false} />
        </dl>

      </div>
    </section>
  );
}

function CartaoGrupos({ p }: { p: Player }) {
  const grupos = useMemo(() => lerGrupos(p.grupos), [p.grupos]);
  return (
    <section className="pp-cartao flex min-h-[140px] flex-1 flex-col p-3 xl:min-h-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hc-sobre">Grupos ({grupos.length})</h3>
        {grupos.length > 0 && (
          <CopyBtn value={grupos.map((g) => g.bruto).join(", ")} label="todos os grupos" />
        )}
      </div>
      {grupos.length === 0 ? (
        <p className="text-[12px] text-ink-3">Nenhum grupo.</p>
      ) : (
        <div className="flex min-h-0 flex-wrap content-start gap-1 overflow-y-auto pr-1">
          {grupos.map((g) => (
            <span key={g.bruto} className="pp-chip">
              {g.nome}
              {g.nivel !== null && <span className="pp-chip-nivel">nv {g.nivel}</span>}
              <CopyBtn value={g.nome} label={`grupo ${g.nome}`} className="!size-5" />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  icone: I,
  titulo,
}: {
  rotulo: string;
  valor: string;
  icone: LucideIcon;
  titulo?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-2 py-1.5" title={titulo}>
      <p className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-ink-3">
        <I className="size-3" /> {rotulo}
      </p>
      <p className="mt-0.5 truncate text-[12.5px] font-bold tabular-nums text-foreground">{valor}</p>
    </div>
  );
}

function Dado({
  rotulo,
  valor,
  mono,
  copiar = true,
}: {
  rotulo: string;
  valor: string | null | undefined;
  mono?: boolean;
  copiar?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <dt className="shrink-0 text-[11.5px] text-ink-3">{rotulo}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className={cn("truncate text-[12px] text-foreground/90", mono && "font-mono")}>
          {valor || "—"}
        </span>
        {copiar && valor ? <CopyBtn value={valor} label={rotulo} className="!size-6" /> : null}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ inventário / veículos */

function InventarioVeiculos({ p }: { p: Player }) {
  const itens = p.inventario;
  return (
    <section className="pp-cartao flex min-h-[220px] flex-1 flex-col p-3 xl:min-h-0">
      <div className="grid grid-cols-2 gap-1.5">
        <Popover>
          <PopoverTrigger className="pp-aba pp-aba-ativa" title="Abrir o inventário">
            <Package className="size-3.5" /> Inventário
            <span className="tabular-nums opacity-80">{itens.length}</span>
            <ChevronDown className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="pp-pop w-[min(92vw,460px)]">
            <ListaItens p={p} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger className="pp-aba" title="Abrir a garagem">
            <Car className="size-3.5" /> Veículos
            <span className="tabular-nums opacity-80">{p.veiculos.length}</span>
            <ChevronDown className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="pp-pop w-[min(92vw,520px)]">
            <ListaVeiculos p={p} />
          </PopoverContent>
        </Popover>
      </div>
      {/* prévia: inventário (o principal) e, embaixo, os veículos */}
      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <div className="flex flex-wrap content-start gap-1">
          {itens.length === 0 ? (
            <p className="text-[12px] text-ink-3">Inventário vazio.</p>
          ) : (
            itens.map((i, n) => (
              <span key={`${i.item}-${n}`} className="pp-chip">
                {i.qtd}x {itemBase(i.item)}
              </span>
            ))
          )}
        </div>
        {p.veiculos.length > 0 && (
          <div>
            <p className="hc-sobre mb-1.5">Veículos</p>
            <div className="flex flex-wrap content-start gap-1">
              {p.veiculos.map((v, n) => (
                <span key={`${v}-${n}`} className="pp-chip font-mono !text-[11px]">
                  {v}
                  <CopyBtn value={v} label={`spawn de ${v}`} className="!size-5" />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BuscaPop({ valor, onChange, dica }: { valor: string; onChange: (v: string) => void; dica: string }) {
  return (
    <label className="campo-busca mb-2">
      <Search className="size-[14px] shrink-0" strokeWidth={1.75} />
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={dica} autoFocus />
    </label>
  );
}

function ListaItens({ p }: { p: Player }) {
  const [q, setQ] = useState("");
  const lista = p.inventario.filter((i) => i.item.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <BuscaPop valor={q} onChange={setQ} dica="Buscar item (spawn)" />
      <ul className="max-h-[55svh] space-y-1 overflow-y-auto pr-1">
        {lista.map((i, n) => (
          <li key={`${i.item}-${n}`} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-1.5">
            <Miniatura src={urlItem(itemBase(i.item))} icone={Package} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{itemBase(i.item)}</span>
              <span className="block truncate font-mono text-[10.5px] text-ink-3">{i.item}</span>
            </span>
            <span className="text-[12px] font-bold tabular-nums text-muted-foreground">{num(i.qtd)}x</span>
            <CopyBtn value={itemBase(i.item)} label={`spawn de ${itemBase(i.item)}`} />
          </li>
        ))}
        {lista.length === 0 && <li className="py-6 text-center text-[12px] text-ink-3">Nada aqui.</li>}
      </ul>
    </div>
  );
}

function ListaVeiculos({ p }: { p: Player }) {
  const [q, setQ] = useState("");
  const lista = p.veiculos
    .map((v, n) => ({ spawn: v, indice: n + 1 }))
    .filter((v) => v.spawn.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <BuscaPop valor={q} onChange={setQ} dica="Buscar veículo (spawn)" />
      <ul className="grid max-h-[55svh] grid-cols-2 gap-1.5 overflow-y-auto pr-1">
        {lista.map((v) => (
          <li key={`${v.spawn}-${v.indice}`} className="rounded-xl bg-white/[0.03] p-2">
            <div className="grid h-20 place-items-center overflow-hidden rounded-lg bg-black/30">
              <Miniatura src={urlVeiculo(v.spawn)} icone={Car} grande />
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12px] font-semibold">{v.spawn}</span>
                <span className="text-[10.5px] text-ink-3">index #{v.indice}</span>
              </span>
              <CopyBtn value={v.spawn} label={`spawn de ${v.spawn}`} />
            </div>
          </li>
        ))}
        {lista.length === 0 && (
          <li className="col-span-2 py-6 text-center text-[12px] text-ink-3">Nenhum veículo.</li>
        )}
      </ul>
    </div>
  );
}

function Miniatura({ src, icone: I, grande }: { src: string; icone: LucideIcon; grande?: boolean }) {
  const [erro, setErro] = useState(false);
  if (erro)
    return (
      <span className={cn("grid shrink-0 place-items-center text-white/25", grande ? "size-12" : "size-9")}>
        <I className={grande ? "size-7" : "size-5"} strokeWidth={1.4} />
      </span>
    );
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className={cn("shrink-0 object-contain", grande ? "h-full w-full" : "size-9")}
    />
  );
}

/* ------------------------------------------------------------------ logs */

function PainelLogs({ p }: { p: Player }) {
  const id = p.passaporte?.trim() ?? "";
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const logs = useQuery({
    queryKey: ["player-logs", id],
    queryFn: () => fetchLogsDoPlayer(id, 30),
    enabled: !!id,
    staleTime: 30_000,
  });
  const todas = logs.data ?? [];
  const resumo = useMemo(() => resumirLogs(todas), [todas]);
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return todas.filter((l) => {
      if (categoria && categoriaDoCanal(l.canal).id !== categoria) return false;
      if (!t) return true;
      return `${l.mensagem} ${l.canal}`.toLowerCase().includes(t);
    });
  }, [todas, q, categoria]);
  const catAtual = resumo.porCategoria.find((c) => c.id === categoria);

  return (
    <section className="pp-cartao flex min-h-[460px] flex-1 flex-col xl:min-h-0">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-3 py-2">
        <h3 className="mr-auto pl-1 text-[15px] font-bold">Logs do player</h3>
        <label className="campo-busca w-full sm:w-72">
          <Search className="size-[14px] shrink-0" strokeWidth={1.75} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar nas logs dele" />
        </label>
        <Popover>
          <PopoverTrigger className="pp-botao-vermelho" title="Filtrar por categoria">
            {catAtual ? `${catAtual.emoji} ${catAtual.nome}` : "Categorias"}
            <ChevronDown className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="pp-pop w-64 p-1.5">
            <button
              onClick={() => setCategoria(null)}
              className={cn("pp-pop-item", !categoria && "pp-pop-item-ativo")}
            >
              Todas <span>{resumo.total}</span>
            </button>
            {resumo.porCategoria.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoria(c.id)}
                className={cn("pp-pop-item", categoria === c.id && "pp-pop-item-ativo")}
              >
                {c.emoji} {c.nome} <span>{c.total}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {id && (
          <Link
            to="/logs"
            search={{ jogador: id }}
            className="hc-seta !size-9"
            title="Abrir todas as logs dele na aba Logs"
          >
            <ExternalLink className="size-4" />
          </Link>
        )}
      </header>

      {!id ? (
        <SemLogs texto="Esse player não tem ID (passaporte) para buscar as logs." />
      ) : logs.isLoading ? (
        <div className="grid flex-1 place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.isError ? (
        <SemLogs texto="Não deu para carregar as logs agora. Tente de novo em instantes." />
      ) : todas.length === 0 ? (
        <SemLogs texto="Nenhuma log desse player nos últimos 30 dias." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
          {/* números */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            {/* a busca traz as 1000 mais recentes: com mais que isso, mostra "1.000+" */}
            <Estat rotulo="30 dias" valor={resumo.total} mais={todas.length >= 1000} />
            <Estat rotulo="7 dias" valor={resumo.ultimos7} mais={todas.length >= 1000} />
            <Estat rotulo="Hoje" valor={resumo.hoje} />
            <Estat rotulo="Anti-Cheat" valor={resumo.antiCheat} alerta={resumo.antiCheat > 0} />
          </div>

          <div className="grid shrink-0 gap-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* atividade por dia */}
            <div className="rounded-2xl bg-white/[0.025] p-3">
              <p className="hc-sobre mb-2">Atividade — últimos 14 dias</p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resumo.porDia} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        background: "#141414",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                      formatter={(v: number) => [`${v} logs`, ""]}
                    />
                    <Bar dataKey="total" fill="#e5231b" radius={[5, 5, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* por categoria */}
            <div className="rounded-2xl bg-white/[0.025] p-3">
              <p className="hc-sobre mb-2">Por categoria</p>
              <ul className="space-y-1.5">
                {resumo.porCategoria.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setCategoria(categoria === c.id ? null : c.id)}
                      className={cn(
                        "w-full text-left text-[12px]",
                        categoria && categoria !== c.id && "opacity-50",
                      )}
                    >
                      <span className="flex justify-between gap-2">
                        <span className="truncate">
                          {c.emoji} {c.nome}
                        </span>
                        <b className="tabular-nums">{c.total}</b>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            c.id === "anti-cheat" ? "bg-orange-400" : "bg-primary",
                          )}
                          style={{ width: `${(c.total / resumo.porCategoria[0]!.total) * 100}%` }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* últimas logs */}
          <ul className="min-h-[200px] flex-1 space-y-1 overflow-y-auto pr-1 xl:min-h-0">
            {filtradas.slice(0, 80).map((l) => (
              <ItemLog key={l.id} l={l} />
            ))}
            {filtradas.length === 0 && (
              <li className="py-8 text-center text-[12px] text-ink-3">Nada com esse filtro.</li>
            )}
            {filtradas.length > 80 && (
              <li className="py-2 text-center text-[11px] text-ink-3">
                Mostrando 80 de {filtradas.length}. Abra na aba Logs para ver tudo.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

function Estat({
  rotulo,
  valor,
  alerta,
  mais,
}: {
  rotulo: string;
  valor: number;
  alerta?: boolean;
  mais?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white/[0.03] px-3 py-1.5",
        alerta && "bg-orange-500/[0.12] ring-1 ring-orange-500/30",
      )}
    >
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
        {alerta && <ShieldAlert className="size-3 text-orange-300" />} {rotulo}
      </p>
      <p className="text-lg font-bold leading-tight tabular-nums">
        {num(valor)}
        {mais ? "+" : ""}
      </p>
    </div>
  );
}

function ItemLog({ l }: { l: LogDoPlayer }) {
  const cat = categoriaDoCanal(l.canal);
  const lida = lerLog(l.mensagem, l.dados, l.jogador_id, l.jogador_nome);
  const campos = lida.linhas.filter((x) => x.rotulo).slice(0, 3);
  return (
    <li
      className={cn(
        "rounded-lg bg-white/[0.025] px-2.5 py-1.5",
        cat.id === "anti-cheat" && "ring-1 ring-orange-500/25",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink-3">
        <span className="truncate font-semibold uppercase tracking-wider">
          {cat.emoji} {cat.nome} · #{cat.canal}
        </span>
        <time className="shrink-0 tabular-nums">{hora(l.criado_em)}</time>
      </div>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">
        {lida.titulo || lida.linhas[0]?.valor || "Log"}
      </p>
      {campos.length > 0 && (
        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
          {campos.map((c) => `${c.rotulo}: ${c.valor}`).join(" · ")}
        </p>
      )}
    </li>
  );
}

function SemLogs({ texto }: { texto: string }) {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <div className="text-center">
        <div className="pp-logs-circulo mx-auto">LOGS</div>
        <p className="mt-5 text-[13px] text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ comandos (última etapa) */

function BarraComandos({ p }: { p: Player }) {
  const ativa = INTEGRACOES.comandos.ativa;
  const id = p.passaporte ?? "";
  return (
    <section className="pp-cartao relative shrink-0 overflow-hidden p-2">
      <div
        className={cn("flex items-center gap-2", !ativa && "pointer-events-none select-none blur-[3px]")}
        aria-hidden={!ativa}
      >
        <label className="campo-busca flex-1">
          <span className="font-mono text-ink-3">/</span>
          <input placeholder={`Digite o comando (ex.: /god ${id || "ID"})`} disabled={!ativa} />
          <SendHorizontal className="size-4 text-ink-3" />
        </label>
        <Popover>
          <PopoverTrigger className="pp-botao-vermelho !size-9 !px-0" disabled={!ativa}>
            <ChevronUp className="size-5" />
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="pp-pop w-[min(92vw,560px)]">
            <p className="hc-sobre mb-2">Comandos rápidos</p>
            <div className="flex flex-wrap gap-1.5">
              {COMANDOS_RAPIDOS.map((c) => (
                <button
                  key={c.id}
                  className={cn(
                    "pp-chip",
                    c.tom === "perigo" && "!bg-red-600/80 !text-white",
                    c.tom === "allowlist" && "!bg-indigo-500/80 !text-white",
                  )}
                  title={montarComando(c, id || "ID")}
                >
                  {c.emoji} {c.rotulo}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {!ativa && (
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[12px] font-semibold text-white/85 ring-1 ring-white/10">
            <Lock className="size-3.5" /> Comandos pelo painel — em breve
          </span>
        </div>
      )}
    </section>
  );
}
