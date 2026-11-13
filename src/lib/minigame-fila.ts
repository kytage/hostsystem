/**
 * Fila pública, sala privada e canal da partida dos mini-games do HOKI
 * (canais em tempo real do Supabase). Cada mini-game passa as próprias regras.
 *
 * - Fila: quem entra aparece na presença do canal. Com o mínimo de pessoas, o
 *   primeiro da fila (o "coordenador") abre a contagem e avisa todo mundo
 *   online; no fim, monta a partida (com até o máximo de jogadores).
 * - Sala privada: um código de 4 letras; quem criou é o anfitrião e começa
 *   quando as regras do mini-game deixam.
 * - Partida: cada uma tem o seu canal (isolamento entre partidas).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface NaFila {
  id: string;
  nome: string;
  desde: number;
}

export const novoId = () => Math.random().toString(36).slice(2, 10);

export const novoCodigo = () =>
  Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join(
    "",
  );

export function listaDaPresenca(ch: RealtimeChannel): NaFila[] {
  const estado = ch.presenceState() as Record<
    string,
    { id?: unknown; nome?: unknown; desde?: unknown }[]
  >;
  const out: NaFila[] = [];
  for (const metas of Object.values(estado)) {
    const m = metas[0];
    if (m && typeof m.id === "string" && typeof m.desde === "number")
      out.push({ id: m.id, nome: typeof m.nome === "string" ? m.nome : "?", desde: m.desde });
  }
  return out.sort((a, b) => a.desde - b.desde || a.id.localeCompare(b.id));
}

export interface RegrasDaFila<M> {
  /** Nome do canal da fila. */
  canal: string;
  min: number;
  max: number;
  contagemS: number;
  /** Monta a partida com quem está na fila (já cortado no máximo). */
  montar: (lista: NaFila[], anfitriao: string) => M;
  /** Eu estou nesta partida? */
  participa: (m: M, id: string) => boolean;
}

/**
 * Entra na fila pública. `aoMudar` recebe quem está na fila e quando a partida
 * começa (ou null); `aoPartida` quando a partida em que eu estou foi montada;
 * `aoAvisarTodos` é chamado no coordenador para avisar o lobby inteiro.
 */
export function entrarNaFilaDe<M>(
  regras: RegrasDaFila<M>,
  eu: { id: string; nome: string },
  cb: {
    aoMudar: (lista: NaFila[], comecaEm: number | null) => void;
    aoPartida: (m: M) => void;
    aoAvisarTodos: (comecaEm: number) => void;
  },
) {
  const ch = supabase.channel(regras.canal, {
    config: { presence: { key: eu.id }, broadcast: { self: true } },
  });
  let lista: NaFila[] = [];
  let comecaEm: number | null = null;
  let vivo = true;
  const souCoordenador = () => lista[0]?.id === eu.id;

  const reavaliar = () => {
    if (!vivo) return;
    if (souCoordenador()) {
      if (lista.length >= regras.min && comecaEm === null) {
        const fim = Date.now() + regras.contagemS * 1000;
        void ch.send({ type: "broadcast", event: "contagem", payload: { fim } });
        cb.aoAvisarTodos(fim);
      } else if (lista.length < regras.min && comecaEm !== null)
        void ch.send({ type: "broadcast", event: "contagem", payload: { fim: null } });
    }
    cb.aoMudar(lista, comecaEm);
  };
  ch.on("presence", { event: "sync" }, () => {
    lista = listaDaPresenca(ch);
    reavaliar();
  });
  ch.on("broadcast", { event: "contagem" }, ({ payload }) => {
    const fim = (payload as { fim?: unknown })?.fim;
    comecaEm = typeof fim === "number" ? fim : null;
    cb.aoMudar(lista, comecaEm);
  });
  ch.on("broadcast", { event: "partida" }, ({ payload }) => {
    const m = payload as M;
    if (m && regras.participa(m, eu.id)) {
      cb.aoPartida(m);
      sair();
    } else {
      comecaEm = null;
      cb.aoMudar(lista, null);
    }
  });
  ch.subscribe((s) => {
    if (s === "SUBSCRIBED") void ch.track({ id: eu.id, nome: eu.nome, desde: Date.now() });
  });
  // o coordenador monta a partida quando a contagem acaba
  const timer = setInterval(() => {
    if (!vivo || comecaEm === null || Date.now() < comecaEm || !souCoordenador()) return;
    if (lista.length < regras.min) return;
    const m = regras.montar(lista.slice(0, regras.max), eu.id);
    comecaEm = null;
    void ch.send({ type: "broadcast", event: "partida", payload: m });
  }, 500);

  function sair() {
    if (!vivo) return;
    vivo = false;
    clearInterval(timer);
    void ch.untrack().catch(() => undefined);
    void supabase.removeChannel(ch);
  }
  return { sair };
}

export interface RegrasDaSala<M> {
  /** Começo do nome do canal (o código vem depois). */
  prefixo: string;
  /** Dá para começar com essa lista? */
  pode: (lista: NaFila[]) => boolean;
  montar: (lista: NaFila[], anfitriao: string) => M;
  participa: (m: M, id: string) => boolean;
}

/** Uma sala privada: dá para ver quem entrou; o anfitrião (o primeiro) começa a partida. */
export function entrarNaSalaDe<M>(
  regras: RegrasDaSala<M>,
  codigo: string,
  eu: { id: string; nome: string },
  cb: {
    aoMudar: (lista: NaFila[], anfitriao: string | null) => void;
    aoPartida: (m: M) => void;
  },
) {
  const ch = supabase.channel(`${regras.prefixo}${codigo}`, {
    config: { presence: { key: eu.id }, broadcast: { self: true } },
  });
  let lista: NaFila[] = [];
  ch.on("presence", { event: "sync" }, () => {
    lista = listaDaPresenca(ch);
    cb.aoMudar(lista, lista[0]?.id ?? null);
  });
  ch.on("broadcast", { event: "partida" }, ({ payload }) => {
    const m = payload as M;
    if (m && regras.participa(m, eu.id)) cb.aoPartida(m);
  });
  ch.subscribe((s) => {
    if (s === "SUBSCRIBED") void ch.track({ id: eu.id, nome: eu.nome, desde: Date.now() });
  });
  return {
    /** Só o anfitrião, e só quando as regras deixam. */
    comecar() {
      if (lista[0]?.id !== eu.id || !regras.pode(lista)) return false;
      void ch.send({ type: "broadcast", event: "partida", payload: regras.montar(lista, eu.id) });
      return true;
    },
    sair() {
      void ch.untrack().catch(() => undefined);
      void supabase.removeChannel(ch);
    },
  };
}

/** Canal de uma partida: manda e recebe mensagens com nome (não recebe as próprias). */
export function abrirCanal(nome: string, ouvir: Record<string, (payload: unknown) => void>) {
  const ch = supabase.channel(nome, { config: { broadcast: { self: false, ack: false } } });
  for (const [evento, f] of Object.entries(ouvir))
    ch.on("broadcast", { event: evento }, ({ payload }) => f(payload));
  ch.subscribe();
  return {
    enviar: (evento: string, payload: unknown) =>
      void ch.send({ type: "broadcast", event: evento, payload }),
    fechar: () => void supabase.removeChannel(ch),
  };
}
