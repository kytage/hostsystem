import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Landmark,
  Loader2,
  PlugZap,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { useRealtimeTable } from "@/lib/realtime";
import { useCan, useMyRole } from "@/lib/permissions";
import { brl, fetchPlayers } from "@/lib/players";
import { CopyBtn, PlayerInventario } from "@/components/players/player-inventario";

export const Route = createFileRoute("/_authenticated/players")({
  head: () => ({
    meta: [
      { title: "Players — HOST Admin" },
      { name: "description", content: "Lista de players do servidor com dados do personagem, grupos, inventário e veículos." },
    ],
  }),
  component: PlayersPage,
});

type Filtro = "todos" | "online" | "offline";

function PlayersPage() {
  const can = useCan();
  const { data: role } = useMyRole();
  const podeVer = can("players");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [grupo, setGrupo] = useState("todos");
  const [selId, setSelId] = useState<string | null>(null);
  const [integracao, setIntegracao] = useState(false);

  useRealtimeTable("players", [["players"]]);
  const { data: players = [], isLoading } = useQuery({ queryKey: ["players"], queryFn: fetchPlayers, enabled: podeVer });

  const todosGrupos = useMemo(() => [...new Set(players.flatMap((p) => p.grupos))].sort((a, b) => a.localeCompare(b, "pt-BR")), [players]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return players.filter((p) => {
      if (filtro === "online" && !p.online) return false;
      if (filtro === "offline" && p.online) return false;
      if (grupo !== "todos" && !p.grupos.includes(grupo)) return false;
      if (!q) return true;
      return [p.nome, p.passaporte, p.license, p.telefone, p.discord_nome, p.discord_id]
        .some((v) => v?.toLowerCase().includes(q)) || p.veiculos.some((v) => v.toLowerCase().includes(q));
    });
  }, [players, busca, filtro, grupo]);
  const sel = players.find((p) => p.id === selId) ?? null;

  const online = players.filter((p) => p.online).length;
  const kpis = [
    { k: "Players", v: players.length.toLocaleString("pt-BR"), icon: Users },
    { k: "Online agora", v: online.toLocaleString("pt-BR"), icon: PlugZap },
    { k: "Dinheiro em banco", v: brl(players.reduce((s, p) => s + p.banco, 0)), icon: Landmark },
    { k: "Veículos", v: players.reduce((s, p) => s + p.veiculos.length, 0).toLocaleString("pt-BR"), icon: Car },
  ];

  if (role && !podeVer) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8">
        <PageHeader kicker="SERVIDOR" title="Players" />
        <p className="glass-inset mt-6 rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
          Você não tem acesso a esta área. Peça liberação da categoria “Players” a um Founder.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        kicker="SERVIDOR"
        title="Players"
        subtitle="Todos os personagens do servidor: dados, grupos, inventário e veículos."
        actions={
          role === "founder" ? (
            <Button variant="outline" onClick={() => setIntegracao(true)}>
              <PlugZap className="size-4" /> Integração
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((c) => (
          <div key={c.k} className="glass rounded-2xl p-4">
            <p className="eyebrow flex items-center gap-1.5">
              <c.icon className="size-3.5" /> {c.k}
            </p>
            <p className="mt-2 truncate font-display text-2xl font-semibold tabular-nums">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="glass-inset flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full px-4">
          <Search className="size-4 text-ink-3" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, passaporte, telefone, license, Discord ou veículo…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </label>
        <div className="glass-inset flex gap-1 rounded-full p-1">
          {(["todos", "online", "offline"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn("rounded-full px-3 py-1.5 text-xs capitalize", filtro === f ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="w-48">
          <MinimalSelect
            value={grupo}
            onChange={setGrupo}
            options={[{ value: "todos", label: "Todos os grupos" }, ...todosGrupos.map((g) => ({ value: g, label: g }))]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando players…
        </div>
      ) : lista.length === 0 ? (
        <p className="glass-inset mt-5 rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
          {players.length === 0 ? "Nenhum player ainda — os dados chegam pela integração com o servidor." : "Nenhum player com esses filtros."}
        </p>
      ) : (
        <div className="glass mt-5 overflow-hidden rounded-[20px]">
          <div className="hidden grid-cols-[minmax(0,2fr)_90px_110px_minmax(0,1.3fr)_minmax(0,1.6fr)_80px] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-ink-3 lg:grid">
            <span>Personagem</span>
            <span>Idade</span>
            <span>Telefone</span>
            <span>Banco</span>
            <span>Grupos</span>
            <span className="text-right">Veículos</span>
          </div>
          <ul>
            {lista.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelId(p.id)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.04] px-5 py-3 text-left transition-colors last:border-0 hover:bg-white/[0.03] lg:grid-cols-[minmax(0,2fr)_90px_110px_minmax(0,1.3fr)_minmax(0,1.6fr)_80px]",
                    selId === p.id && "bg-white/[0.05]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] font-display text-sm font-semibold">
                      {(p.nome || "?").charAt(0).toUpperCase()}
                      <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-black", p.online ? "bg-emerald-500" : "bg-white/25")} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.nome || "Sem nome"}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        #{p.passaporte ?? "—"} · {p.discord_nome ? `@${p.discord_nome}` : p.license}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground lg:block">{p.idade ?? "—"}</span>
                  <span className="hidden text-sm text-muted-foreground lg:block">{p.telefone ?? "—"}</span>
                  <span className="hidden truncate text-sm tabular-nums lg:block">{brl(p.banco)}</span>
                  <span className="hidden min-w-0 items-center gap-1 overflow-hidden lg:flex">
                    {p.grupos.slice(0, 3).map((g) => (
                      <span key={g} className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-muted-foreground">
                        {g}
                      </span>
                    ))}
                    {p.grupos.length > 3 && <span className="shrink-0 text-[10.5px] text-ink-3">+{p.grupos.length - 3}</span>}
                  </span>
                  <span className="text-right text-sm tabular-nums text-muted-foreground">
                    <Car className="mr-1 inline size-3.5" />
                    {p.veiculos.length}
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
        <DialogTitle className="flex items-center gap-2">
          <PlugZap className="size-4 text-primary" /> Integração com o servidor
        </DialogTitle>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            O script do FiveM (ou o bot do Discord) envia os players para este endpoint. Cada envio atualiza pela <b className="text-foreground">license</b>;
            campos que não vierem no envio são mantidos.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>
              O token fica na variável <code className="text-foreground">PLAYERS_WEBHOOK_TOKEN</code> do servidor do painel.
            </li>
            <li>Grupos, veículos e inventário aceitam lista ou texto separado por vírgula (ex.: “5x biotonico”).</li>
            <li>
              <code className="text-foreground">marcar_offline_ausentes: true</code> deixa offline quem não veio no envio (use ao mandar a lista de online).
            </li>
          </ul>
          <div className="relative">
            <pre className="glass-inset max-h-[48vh] overflow-auto rounded-xl p-4 font-mono text-[11.5px] leading-relaxed text-foreground/90">{EXEMPLO}</pre>
            <div className="absolute right-2 top-2">
              <CopyBtn value={EXEMPLO} label="exemplo" />
            </div>
          </div>
          <p className="text-xs">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => toast.info("Peça o token ao responsável pelo deploy — ele não aparece no painel.")}>
              Onde pego o token?
            </Button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
