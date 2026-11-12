import { Car, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartaoMovimento } from "@/components/home-graficos";
import { Linha } from "@/components/ilegal-resumo";
import { brl, type Banimento, type Player } from "@/lib/players";

export type FiltroPlayers = "todos" | "online" | "offline" | "banidos";

const CORES: Record<FiltroPlayers, string> = {
  todos: "#f4f4f5",
  online: "#4ade80",
  offline: "#a1a1aa",
  banidos: "#ff5a45",
};

/**
 * Painel do topo de Players, no desenho do "Movimento" da tela inicial: o gráfico dos últimos
 * 14 dias (logins e banimentos) e os números de players, online, offline e banidos. Clicar
 * num número filtra a lista.
 */
export function PlayersPainel({
  players,
  banimentos,
  banidos,
  filtro,
  onFiltro,
}: {
  players: Player[];
  banimentos: Banimento[];
  /** IDs (passaporte) com banimento valendo. */
  banidos: Set<string>;
  filtro: FiltroPlayers;
  onFiltro: (f: FiltroPlayers) => void;
}) {
  const total = players.length;
  const online = players.filter((p) => p.online).length;
  const offline = total - online;
  const nBanidos = banidos.size;
  const numeros: { id: FiltroPlayers; rotulo: string; valor: number; detalhe: string }[] = [
    { id: "todos", rotulo: "Players", valor: total, detalhe: "no servidor" },
    { id: "online", rotulo: "Online agora", valor: online, detalhe: `de ${total}` },
    { id: "offline", rotulo: "Offline", valor: offline, detalhe: `de ${total}` },
    {
      id: "banidos",
      rotulo: "Banidos",
      valor: nBanidos,
      detalhe: nBanidos === 1 ? "banimento valendo" : "banimentos valendo",
    },
  ];
  const parte = (n: { id: FiltroPlayers; valor: number }) => {
    if (!n.valor) return 0;
    if (n.id === "todos" || !total) return 1;
    return Math.max(0.14, Math.min(1, n.valor / total));
  };
  const emBancos = players.reduce((s, p) => s + p.banco, 0);
  const veiculos = players.reduce((s, p) => s + p.veiculos.length, 0);

  return (
    <section className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <CartaoMovimento
        rotulos={["Logins", "Banimentos"]}
        novos={players.flatMap((p) => (p.ultimo_login ? [p.ultimo_login] : []))}
        concluidos={banimentos.map((b) => b.data)}
        legenda="Último login de cada player e banimentos aplicados, por dia"
        className="min-h-[280px]"
      />

      <div className="grid grid-cols-2 gap-3">
        {numeros.map((n) => {
          const cor = CORES[n.id];
          const ativo = filtro === n.id && n.id !== "todos";
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onFiltro(filtro === n.id ? "todos" : n.id)}
              aria-pressed={filtro === n.id}
              title={n.id === "todos" ? "Mostrar todos" : `Ver só: ${n.rotulo}`}
              className={cn(
                "glass relative isolate overflow-hidden rounded-[20px] px-3.5 pb-3 pt-3 text-left",
                ativo && "!border-white/30",
              )}
            >
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: cor, boxShadow: `0 0 8px ${cor}` }}
                />
                {n.rotulo}
              </span>
              <span className="mt-0.5 flex items-baseline gap-1.5 leading-tight">
                <span
                  className="font-display text-[28px] font-medium tabular-nums"
                  style={{ color: cor }}
                >
                  {n.valor.toLocaleString("pt-BR")}
                </span>
                <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                  {n.detalhe}
                </span>
              </span>
              <Linha id={`pl-${n.id}`} cor={cor} parte={parte(n)} ativo={ativo} />
            </button>
          );
        })}

        <div className="glass col-span-2 grid grid-cols-2 items-center rounded-[20px] px-4 py-3">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Landmark className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
            <span className="truncate font-display font-semibold tabular-nums">
              {brl(emBancos)}
            </span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
              em bancos
            </span>
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 text-sm">
            <Car className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
            <span className="font-display font-semibold tabular-nums">
              {veiculos.toLocaleString("pt-BR")}
            </span>
            <span className="text-[11px] text-muted-foreground">veículos</span>
          </span>
        </div>
      </div>
    </section>
  );
}
