import { Ban, Car, Landmark, Moon, Users, Wifi, type LucideIcon } from "lucide-react";
import { CartaoMovimento } from "@/components/home-graficos";
import { Indice, Indices } from "@/components/indice";
import { brl, type Banimento, type Player } from "@/lib/players";

export type FiltroPlayers = "todos" | "online" | "offline" | "banidos";

const CORES: Record<FiltroPlayers, string> = {
  todos: "#f4f4f5",
  online: "#4ade80",
  offline: "#a1a1aa",
  banidos: "#ff5a45",
};

const ICONES: Record<FiltroPlayers, LucideIcon> = {
  todos: Users,
  online: Wifi,
  offline: Moon,
  banidos: Ban,
};

/**
 * Painel do topo de Players, no padrão da tela inicial: o gráfico "Movimento" dos últimos
 * 14 dias (logins e banimentos) e, ao lado, os números em quadros (players, online, offline,
 * banidos, dinheiro em bancos e veículos). Clicar num dos quatro primeiros filtra a lista.
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
  const emBancos = players.reduce((s, p) => s + p.banco, 0);
  const veiculos = players.reduce((s, p) => s + p.veiculos.length, 0);

  return (
    <section className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:gap-3.5">
      <CartaoMovimento
        rotulos={["Logins", "Banimentos"]}
        novos={players.flatMap((p) => (p.ultimo_login ? [p.ultimo_login] : []))}
        concluidos={banimentos.map((b) => b.data)}
        legenda="Último login de cada player e banimentos aplicados, por dia"
        className="hc min-h-[280px] !p-5"
      />

      {/* os números, no padrão da tela inicial: clicar em um filtra a lista */}
      <Indices colunas={2}>
        {numeros.map((n) => (
          <Indice
            key={n.id}
            valor={n.valor.toLocaleString("pt-BR")}
            titulo={n.rotulo}
            nota={n.detalhe}
            icone={ICONES[n.id]}
            cor={n.id === "todos" ? undefined : CORES[n.id]}
            ativo={filtro === n.id}
            onClick={() => onFiltro(filtro === n.id ? "todos" : n.id)}
            dica={n.id === "todos" ? "Mostrar todos" : `Ver só: ${n.rotulo}`}
          />
        ))}
        <Indice
          valor={brl(emBancos)}
          titulo="Em bancos"
          nota="somando todos os players"
          icone={Landmark}
          compacto
        />
        <Indice
          valor={veiculos.toLocaleString("pt-BR")}
          titulo="Veículos"
          nota="nas garagens"
          icone={Car}
        />
      </Indices>
    </section>
  );
}
