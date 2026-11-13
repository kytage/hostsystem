/**
 * HOST SIEGE em rede (canais em tempo real do Supabase).
 *
 * - Fila pública: quem entra aparece na presença do canal "host-siege-fila".
 *   Com SIEGE.FILA_MIN pessoas, o primeiro da fila (o "coordenador") abre a
 *   contagem de SIEGE.FILA_CONTAGEM_S s e avisa todo mundo online; no fim, monta
 *   a partida com até SIEGE.FILA_MAX jogadores e divide os times.
 * - Sala privada: um código de 4 letras; quem criou é o anfitrião e começa
 *   quando os dois times ficam do mesmo tamanho.
 * - Partida: o anfitrião roda as regras (partida.ts) e manda o estado; os
 *   outros mandam a própria posição e as ações. Cada partida tem o seu canal
 *   (isolamento entre partidas).
 */
import { supabase } from "@/integrations/supabase/client";
import { SIEGE, type Kit, type Modo, type Time } from "./config";
import type { Acao } from "./partida";
import {
  entrarNaFilaDe,
  entrarNaSalaDe,
  novoCodigo,
  novoId,
  type NaFila,
} from "@/lib/minigame-fila";

export { novoCodigo, type NaFila };
export interface InicioPartida {
  id: string;
  modo: Modo;
  host: string;
  jogadores: { id: string; nome: string; time: Time }[];
}

/** Divide em dois times do mesmo tamanho (alternando pela ordem de chegada). */
export function dividirTimes(lista: { id: string; nome: string }[]): InicioPartida["jogadores"] {
  return lista.map((j, i) => ({ id: j.id, nome: j.nome, time: i % 2 === 0 ? "vermelho" : "azul" }));
}

const participa = (m: InicioPartida, id: string) => !!m?.jogadores?.some((j) => j.id === id);

/**
 * Entra na fila pública. `aoMudar` recebe quem está na fila e quando a partida
 * começa (ou null); `aoPartida` quando a partida em que eu estou foi montada;
 * `aoAvisarTodos` é chamado no coordenador para avisar o lobby inteiro.
 */
export function entrarNaFila(
  eu: { id: string; nome: string },
  cb: {
    aoMudar: (lista: NaFila[], comecaEm: number | null) => void;
    aoPartida: (m: InicioPartida) => void;
    aoAvisarTodos: (comecaEm: number) => void;
  },
) {
  return entrarNaFilaDe<InicioPartida>(
    {
      canal: "host-siege-fila",
      min: SIEGE.FILA_MIN,
      max: SIEGE.FILA_MAX,
      contagemS: SIEGE.FILA_CONTAGEM_S,
      montar: (lista, host) => ({
        id: novoId(),
        modo: "publica",
        host,
        jogadores: dividirTimes(lista),
      }),
      participa,
    },
    eu,
    cb,
  );
}

/** Uma sala privada: dá para ver quem entrou; o anfitrião começa a partida (2v2, 3v3 ou 4v4). */
export function entrarNaSala(
  codigo: string,
  eu: { id: string; nome: string },
  cb: {
    aoMudar: (lista: NaFila[], anfitriao: string | null) => void;
    aoPartida: (m: InicioPartida) => void;
  },
) {
  return entrarNaSalaDe<InicioPartida>(
    {
      prefixo: "host-siege-sala-",
      pode: (l) => l.length % 2 === 0 && l.length >= 4 && l.length <= 8,
      montar: (lista, host) => ({
        id: novoId(),
        modo: "privada",
        host,
        jogadores: dividirTimes(lista),
      }),
      participa,
    },
    codigo,
    eu,
    cb,
  );
}

/* ------------------------------------------------------------------ */
/* canal da partida                                                    */
/* ------------------------------------------------------------------ */

export interface PosicaoRede {
  id: string;
  x: number;
  z: number;
  y: number;
  rumo: number;
}

export function abrirCanalDaPartida(
  id: string,
  cb: {
    aoEstado?: (snap: unknown) => void;
    aoPos?: (p: PosicaoRede) => void;
    aoAcao?: (quem: string, a: Acao) => void;
    aoKit?: (quem: string, k: Kit) => void;
  },
) {
  const ch = supabase.channel(`host-siege-partida-${id}`, {
    config: { broadcast: { self: false, ack: false } },
  });
  ch.on("broadcast", { event: "estado" }, ({ payload }) => cb.aoEstado?.(payload));
  ch.on("broadcast", { event: "pos" }, ({ payload }) => cb.aoPos?.(payload as PosicaoRede));
  ch.on("broadcast", { event: "acao" }, ({ payload }) => {
    const p = payload as { quem: string; a: Acao };
    if (p?.quem && p.a) cb.aoAcao?.(p.quem, p.a);
  });
  ch.on("broadcast", { event: "kit" }, ({ payload }) => {
    const p = payload as { quem: string; k: Kit };
    if (p?.quem && p.k) cb.aoKit?.(p.quem, p.k);
  });
  ch.subscribe();
  const enviar = (event: string, payload: unknown) =>
    void ch.send({ type: "broadcast", event, payload });
  return {
    estado: (snap: unknown) => enviar("estado", snap),
    pos: (p: PosicaoRede) => enviar("pos", p),
    acao: (quem: string, a: Acao) => enviar("acao", { quem, a }),
    kit: (quem: string, k: Kit) => enviar("kit", { quem, k }),
    fechar: () => void supabase.removeChannel(ch),
  };
}
