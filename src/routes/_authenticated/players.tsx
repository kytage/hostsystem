import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowDownUp, ArrowUp, Loader2, PlugZap, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { useRealtimeTable } from "@/lib/realtime";
import { useCan, useMyRole } from "@/lib/permissions";
import { brl, fetchBanimentos, fetchPlayers } from "@/lib/players";
import { CopyBtn, HostAvatar } from "@/components/players/player-inventario";
import { PlayerPerfil, playerSoComId } from "@/components/players/player-perfil";
import { CARGOS_EMBLEMA } from "@/lib/player-perfil";
import {
  FAIXAS_DINHEIRO,
  FAIXAS_LEVEL,
  FILTROS_PADRAO,
  ORDENACOES,
  filtrosLigados,
  ordenarPlayers,
  passaNosFiltros,
  type FiltrosExtras,
  type Ordenacao,
} from "@/lib/players-filtros";
import { PlayersPainel, type FiltroPlayers } from "@/components/players/players-painel";

export const Route = createFileRoute("/_authenticated/players")({
  // ?jogador=ID abre o perfil direto (vem do botão de perfil das logs)
  validateSearch: (s: Record<string, unknown>): { jogador?: string } => {
    const j = String(s["jogador"] ?? "").replace(/^#/, "").trim();
    return /^\d{1,9}$/.test(j) ? { jogador: j } : {};
  },
  head: () => ({
    meta: [
      { title: "Players — HOST Admin" },
      {
        name: "description",
        content:
          "Lista de players do servidor com dados do personagem, grupos, inventário e veículos.",
      },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const can = useCan();
  const { data: role } = useMyRole();
  const podeVer = can("players");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroPlayers>("todos");
  const [grupo, setGrupo] = useState("todos");
  // ordenação e filtros extras (dinheiro, level, cargo VIP, whitelist, veículos)
  const [extras, setExtras] = useState<FiltrosExtras>(FILTROS_PADRAO);
  const setExtra = <K extends keyof FiltrosExtras>(k: K, v: FiltrosExtras[K]) =>
    setExtras((x) => ({ ...x, [k]: v }));
  /** Clicar no cabeçalho: ordena por aquela coluna (clicar de novo inverte). */
  const ordenarPor = (desc: Ordenacao, asc: Ordenacao) =>
    setExtra("ordenacao", extras.ordenacao === desc ? asc : desc);
  const [selId, setSelId] = useState<string | null>(null);
  const [integracao, setIntegracao] = useState(false);

  useRealtimeTable("players", [["players"]]);
  useRealtimeTable("punicoes", [["players-banimentos"]]);
  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: fetchPlayers,
    enabled: podeVer,
  });
  const { data: banimentos = [] } = useQuery({
    queryKey: ["players-banimentos"],
    queryFn: fetchBanimentos,
    enabled: podeVer,
  });
  // passaportes com banimento valendo (o ID da punição é o número do passaporte)
  const banidos = useMemo(
    () => new Set(banimentos.filter((b) => b.ativo && b.jogadorId).map((b) => b.jogadorId)),
    [banimentos],
  );
  // grupos sem o nível ("Admin:1", "Admin:3" → "Admin"): o filtro pega todos os níveis
  const nomeGrupo = (g: string) => g.split(":")[0]!.trim();
  const todosGrupos = useMemo(
    () =>
      [...new Set(players.flatMap((p) => p.grupos.map(nomeGrupo)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [players],
  );
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = players.filter((p) => {
      if (!passaNosFiltros(p, extras)) return false;
      if (filtro === "online" && !p.online) return false;
      if (filtro === "offline" && p.online) return false;
      if (filtro === "banidos" && !(p.passaporte && banidos.has(p.passaporte.trim()))) return false;
      if (grupo !== "todos" && !p.grupos.some((g) => nomeGrupo(g) === grupo)) return false;
      if (!q) return true;
      return (
        [p.nome, p.passaporte, p.license, p.telefone, p.discord_nome, p.discord_id].some((v) =>
          v?.toLowerCase().includes(q),
        ) || p.veiculos.some((v) => v.toLowerCase().includes(q))
      );
    });
    return ordenarPlayers(filtrados, extras.ordenacao);
  }, [players, busca, filtro, grupo, banidos, extras]);
  const ligados = filtrosLigados(extras) + Number(grupo !== "todos") + Number(filtro !== "todos") + Number(!!busca.trim());
  const sel = players.find((p) => p.id === selId) ?? null;
  // aberto pelo link das logs: acha a ficha pelo passaporte; sem ficha, abre só com o ID
  const { jogador } = Route.useSearch();
  const navigate = Route.useNavigate();
  const doLink = jogador
    ? (players.find((p) => p.passaporte?.trim() === jogador) ?? null)
    : null;
  const fecharLink = () => void navigate({ search: {}, replace: true });

  if (role && !podeVer) {
    return (
      <div className="pagina">
        <PageHeader kicker="SERVIDOR" title="Players" />
        <p className="mt-6 rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
          Você não tem acesso a esta área. Peça liberação da categoria “Players” a um Founder.
        </p>
      </div>
    );
  }

  const colunas =
    "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_90px_minmax(0,1fr)_90px_90px_40px]";

  return (
    <div className="pagina">
      <PageHeader
        kicker="Servidor"
        title="Players"
        actions={
          role === "founder" ? (
            <button
              onClick={() => setIntegracao(true)}
              aria-label="Integração"
              title="Integração"
              className="hc-seta !size-9"
            >
              <PlugZap className="size-4" />
            </button>
          ) : undefined
        }
      />

      <PlayersPainel
        players={players}
        banimentos={banimentos}
        banidos={banidos}
        filtro={filtro}
        onFiltro={setFiltro}
      />

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[auto_minmax(0,1fr)_210px]">
        <div
          className="segmentos justify-self-start"
          role="group"
          aria-label="Situação dos players"
        >
          {(["todos", "online", "offline", "banidos"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className="capitalize"
            >
              {f}
            </button>
          ))}
        </div>
        <label className="campo-busca">
          <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar player, passaporte, license, Discord ou veículo"
            aria-label="Buscar player"
          />
        </label>
        <MinimalSelect
          value={grupo}
          onChange={setGrupo}
          options={[
            { value: "todos", label: "Todos os grupos" },
            ...todosGrupos.map((g) => ({ value: g, label: g })),
          ]}
          className="rounded-full px-4"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 pl-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          <ArrowDownUp className="size-3.5" /> Ordenar
        </span>
        <div className="w-60">
          <MinimalSelect
            value={extras.ordenacao}
            onChange={(v) => setExtra("ordenacao", v as Ordenacao)}
            options={ORDENACOES.map((o) => ({ value: o.id, label: o.rotulo }))}
            className="rounded-full px-4"
          />
        </div>
        <span className="mx-1 h-5 w-px bg-white/[0.08]" />
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          <SlidersHorizontal className="size-3.5" /> Filtrar
        </span>
        <div className="w-44">
          <MinimalSelect
            value={extras.cargo}
            onChange={(v) => setExtra("cargo", v as FiltrosExtras["cargo"])}
            options={[
              { value: "todos", label: "Qualquer cargo" },
              ...CARGOS_EMBLEMA.map((c) => ({ value: c.id, label: c.rotulo })),
              { value: "sem", label: "Sem cargo VIP" },
            ]}
            className="rounded-full px-4"
          />
        </div>
        <div className="w-40">
          <MinimalSelect
            value={extras.whitelist}
            onChange={(v) => setExtra("whitelist", v as FiltrosExtras["whitelist"])}
            options={[
              { value: "todas", label: "Whitelist: todas" },
              { value: "ativa", label: "Whitelist ativa" },
              { value: "nolist", label: "NoList" },
              { value: "sem_dado", label: "Sem dado" },
            ]}
            className="rounded-full px-4"
          />
        </div>
        <div className="w-40">
          <MinimalSelect
            value={extras.level}
            onChange={(v) => setExtra("level", v as FiltrosExtras["level"])}
            options={FAIXAS_LEVEL.map((x) => ({ value: x.id, label: x.rotulo }))}
            className="rounded-full px-4"
          />
        </div>
        <div className="w-48">
          <MinimalSelect
            value={extras.dinheiro}
            onChange={(v) => setExtra("dinheiro", v as FiltrosExtras["dinheiro"])}
            options={FAIXAS_DINHEIRO.map((x) => ({ value: x.id, label: x.rotulo }))}
            className="rounded-full px-4"
          />
        </div>
        <div className="w-40">
          <MinimalSelect
            value={extras.veiculos}
            onChange={(v) => setExtra("veiculos", v as FiltrosExtras["veiculos"])}
            options={[
              { value: "todos", label: "Veículos: todos" },
              { value: "com", label: "Com veículos" },
              { value: "sem", label: "Sem veículos" },
            ]}
            className="rounded-full px-4"
          />
        </div>
        <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
          <b className="text-foreground">{lista.length}</b> de {players.length} players
        </span>
        {ligados > 0 && (
          <button
            onClick={() => {
              setExtras(FILTROS_PADRAO);
              setGrupo("todos");
              setFiltro("todos");
              setBusca("");
            }}
            className="pilula rounded-full"
          >
            <X className="size-3.5" /> Limpar filtros ({ligados})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando players…
        </div>
      ) : lista.length === 0 ? (
        <p className="mt-4 rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
          {players.length === 0
            ? "Nenhum player ainda — os dados chegam pela integração com o servidor."
            : "Nenhum player com esses filtros."}
        </p>
      ) : (
        <div className="glass hc mt-4">
          <div
            className={cn(
              "hidden gap-4 border-b border-white/[0.06] px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3 md:grid",
              colunas,
            )}
          >
            <CabecalhoOrdem rotulo="Personagem" ativo={extras.ordenacao === "nome"} onClick={() => setExtra("ordenacao", "nome")} alinhar="esquerda" />
            <CabecalhoOrdem rotulo="Level" ativo={extras.ordenacao.startsWith("level")} desc={extras.ordenacao === "level_desc"} onClick={() => ordenarPor("level_desc", "level_asc")} />
            <CabecalhoOrdem rotulo="Banco" ativo={extras.ordenacao.startsWith("dinheiro") || extras.ordenacao === "banco_desc"} desc={extras.ordenacao !== "dinheiro_asc"} onClick={() => ordenarPor("dinheiro_desc", "dinheiro_asc")} />
            <CabecalhoOrdem rotulo="Grupos" ativo={extras.ordenacao === "grupos_desc"} desc onClick={() => setExtra("ordenacao", "grupos_desc")} />
            <CabecalhoOrdem rotulo="Veículos" ativo={extras.ordenacao === "veiculos_desc"} desc onClick={() => setExtra("ordenacao", "veiculos_desc")} />
            <span />
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {lista.map((p, n) => (
              <li
                key={p.id}
                className="pf-linha"
                style={{ animationDelay: `${Math.min(n, 14) * 30}ms` }}
              >
                <button
                  onClick={() => setSelId(p.id)}
                  className={cn(
                    "grid h-16 w-full items-center gap-4 px-5 text-left transition-colors hover:bg-white/[0.03]",
                    colunas,
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <HostAvatar className="size-10" />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.nome || "Sem nome"}
                          {p.passaporte && (
                            <span className="ml-1 font-normal text-ink-3">#{p.passaporte}</span>
                          )}
                        </span>
                        {p.passaporte && banidos.has(p.passaporte.trim()) && (
                          <span className="selo selo-vermelho shrink-0">Banido</span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {p.discord_nome ? `@${p.discord_nome}` : p.license}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-center text-sm tabular-nums md:block">
                    {p.level}
                  </span>
                  <span
                    className="hidden truncate text-center text-sm tabular-nums md:block"
                    title={`Banco ${brl(p.banco)} · Carteira ${brl(p.carteira)} · Total ${brl(p.banco + p.carteira)}`}
                  >
                    {brl(p.banco)}
                    {p.carteira > 0 && (
                      <span className="block text-[10.5px] text-ink-3">+ {brl(p.carteira)} na carteira</span>
                    )}
                  </span>
                  <span className="hidden text-center text-sm tabular-nums text-muted-foreground md:block">
                    {p.grupos.length}
                  </span>
                  <span className="hidden text-center text-sm tabular-nums text-muted-foreground md:block">
                    {p.veiculos.length}
                  </span>
                  <span className="flex justify-end">
                    <span
                      title={p.online ? "Online" : "Offline"}
                      className={cn(
                        "size-2 rounded-full",
                        p.online ? "bg-emerald-400" : "bg-white/20",
                      )}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sel && (
        <PlayerPerfil
          player={sel}
          banimentos={banimentos}
          onClose={() => setSelId(null)}
        />
      )}
      {!sel && jogador && !isLoading && (
        <PlayerPerfil
          player={doLink ?? playerSoComId(jogador)}
          semFicha={!doLink}
          banimentos={banimentos}
          onClose={fecharLink}
        />
      )}
      {integracao && <IntegracaoDialog onClose={() => setIntegracao(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Cabeçalho que ordena a lista ao clicar (seta mostra o sentido). */
function CabecalhoOrdem({
  rotulo,
  ativo,
  desc,
  onClick,
  alinhar = "centro",
}: {
  rotulo: string;
  ativo: boolean;
  desc?: boolean;
  onClick: () => void;
  alinhar?: "centro" | "esquerda";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ordenar por ${rotulo.toLowerCase()}`}
      className={cn(
        "flex items-center gap-1 uppercase tracking-[0.12em] transition-colors hover:text-foreground",
        alinhar === "centro" ? "justify-center" : "justify-start",
        ativo && "text-foreground",
      )}
    >
      {rotulo}
      {ativo && alinhar === "centro" && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </button>
  );
}

/* ------------------------------------------------------------------ */

const EXEMPLO = `POST /api/public/webhook/players
x-webhook-token: <PLAYERS_WEBHOOK_TOKEN>
Content-Type: application/json

{
  "marcar_offline_ausentes": false,
  "players": [
    {
      "license": "110000172b0d8b0",
      "passaporte": 1,
      "nome": "Henrique Bonne",
      "idade": 25,
      "telefone": "1",
      "banco": 17638061,
      "grupos": ["Admin", "Boss", "Hospital"],
      "inventario": "1x cake-1793737046, 5x biotonico",
      "veiculos": ["tfr32", "UP400x"],
      "discord_id": "123456789012345678",
      "discord_nome": "Bonne",
      "online": true,
      "level": 87,
      "xp": 15420,
      "rank_vip": "VIP Diamante",
      "host_coins": 3500,
      "kills": 412,
      "mortes": 198,
      "headshots": 151,
      "maior_sequencia": 14
    }
  ]
}`;

function IntegracaoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogTitle className="hc-titulo flex items-center gap-3">
          <span className="hc-icone">
            <PlugZap className="size-4" strokeWidth={1.75} />
          </span>
          Integração com o servidor
        </DialogTitle>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            O script do FiveM (ou o bot do Discord) envia os players para este endpoint. Cada envio
            atualiza pela <b className="text-foreground">license</b>; campos que não vierem no envio
            são mantidos.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>
              O token fica na variável{" "}
              <code className="text-foreground">PLAYERS_WEBHOOK_TOKEN</code> do servidor do painel.
            </li>
            <li>
              Grupos, veículos e inventário aceitam lista ou texto separado por vírgula (ex.: “5x
              biotonico”).
            </li>
            <li>
              <code className="text-foreground">marcar_offline_ausentes: true</code> deixa offline
              quem não veio no envio (use ao mandar a lista de online).
            </li>
          </ul>
          <div className="relative">
            <pre className="hc-dentro max-h-[48vh] overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-foreground/90">
              {EXEMPLO}
            </pre>
            <div className="absolute right-2 top-2">
              <CopyBtn value={EXEMPLO} label="exemplo" />
            </div>
          </div>
          <p className="text-xs">
            <Button
              variant="ghost"
              size="sm"
              className="hc-pilula"
              onClick={() =>
                toast.info("Peça o token ao responsável pelo deploy — ele não aparece no painel.")
              }
            >
              Onde pego o token?
            </Button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
