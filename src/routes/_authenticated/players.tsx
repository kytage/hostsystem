import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PlugZap, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { useRealtimeTable } from "@/lib/realtime";
import { useCan, useMyRole } from "@/lib/permissions";
import { brl, fetchBanimentos, fetchPlayers } from "@/lib/players";
import { CopyBtn, HostAvatar, PlayerInventario } from "@/components/players/player-inventario";
import { PlayersPainel, type FiltroPlayers } from "@/components/players/players-painel";

export const Route = createFileRoute("/_authenticated/players")({
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
  const todosGrupos = useMemo(
    () =>
      [...new Set(players.flatMap((p) => p.grupos))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [players],
  );
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return players.filter((p) => {
      if (filtro === "online" && !p.online) return false;
      if (filtro === "offline" && p.online) return false;
      if (filtro === "banidos" && !(p.passaporte && banidos.has(p.passaporte.trim()))) return false;
      if (grupo !== "todos" && !p.grupos.includes(grupo)) return false;
      if (!q) return true;
      return (
        [p.nome, p.passaporte, p.license, p.telefone, p.discord_nome, p.discord_id].some((v) =>
          v?.toLowerCase().includes(q),
        ) || p.veiculos.some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [players, busca, filtro, grupo, banidos]);
  const sel = players.find((p) => p.id === selId) ?? null;

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
            <span>Personagem</span>
            <span className="text-center">Level</span>
            <span className="text-center">Banco</span>
            <span className="text-center">Grupos</span>
            <span className="text-center">Veículos</span>
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
                  <span className="hidden truncate text-center text-sm tabular-nums md:block">
                    {brl(p.banco)}
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

      {sel && <PlayerInventario player={sel} onClose={() => setSelId(null)} />}
      {integracao && <IntegracaoDialog onClose={() => setIntegracao(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

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
