/**
 * Sala online do Magnata HOST.
 *
 * Cada sala é um canal próprio. O computador do anfitrião guarda a partida,
 * aplica as jogadas que chegam e manda o estado pronto para todos. Se o
 * anfitrião cair, o próximo jogador presente assume com o último estado que
 * recebeu, então a partida não se perde.
 */
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lerVisual, type Visual } from "@/lib/hoki";
import { aplicar, daVez, jogadaAutomatica, novaSala, type Acao, type Estado } from "./hoki-magnata";

const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const novoCodigo = () =>
  Array.from({ length: 5 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join("");
export const limparCodigo = (texto: string) =>
  texto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);

/** Guarda a sala em que estou, para voltar pelo portal se a conexão cair. */
const CHAVE = "hoki-magnata-sala";
export const salaGuardada = () => {
  try {
    return limparCodigo(localStorage.getItem(CHAVE) ?? "") || null;
  } catch {
    return null;
  }
};
export const guardarSala = (codigo: string | null) => {
  try {
    if (codigo) localStorage.setItem(CHAVE, codigo);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: só não lembra a sala */
  }
};

/* ---------- convites do sino: chegam em qualquer tela do painel e ficam guardados até a pessoa entrar ---------- */
export interface ConviteMagnata {
  codigo: string;
  nome: string;
  quando: number;
}
const VALIDADE_DO_CONVITE = 15 * 60_000;
let convites: ConviteMagnata[] = [];
let pedidoDeAbrir: string | null = null;
let emPartida = false;
const ouvintes = new Set<() => void>();
const avisarOuvintes = () => ouvintes.forEach((f) => f());
export function guardarConvite(c: ConviteMagnata) {
  convites = [c, ...convites.filter((x) => x.codigo !== c.codigo)].slice(0, 4);
  avisarOuvintes();
}
export function esquecerConvite(codigo: string) {
  convites = convites.filter((x) => x.codigo !== codigo);
  avisarOuvintes();
}
/** O convite foi aceito fora da praça: ela abre a sala assim que estiver na tela. */
export function pedirParaAbrir(codigo: string) {
  pedidoDeAbrir = codigo;
  avisarOuvintes();
}
export function pegarPedidoDeAbrir() {
  const c = pedidoDeAbrir;
  pedidoDeAbrir = null;
  return c;
}
/** Quem já está numa partida não recebe o aviso do sino (o convite fica guardado no portal). */
export const estouEmPartida = () => emPartida;
export const marcarEmPartida = (v: boolean) => {
  emPartida = v;
};
export function useConvitesMagnata() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  const agora = Date.now();
  return {
    convites: convites.filter((c) => agora - c.quando < VALIDADE_DO_CONVITE),
    pedido: pedidoDeAbrir,
  };
}

/** Quanto tempo sem aparecer até o anfitrião jogar no lugar de quem caiu, e de quem só demorou. */
const AUSENTE_MS = 15_000;
const PARADO_MS = 90_000;
const SEM_ANFITRIAO_MS = 7_000;

export interface Eu {
  id: string;
  nome: string;
  visual: Visual;
}
export interface Emote {
  id: string;
  reacao: string;
  n: number;
}
export interface SalaMagnata {
  estado: Estado | null;
  /** Quem está com a sala aberta agora. */
  presentes: Set<string>;
  erro: string | null;
  emote: Emote | null;
  agir: (a: Acao) => void;
  reagir: (reacao: string) => void;
}

/**
 * Liga na sala `codigo`. Com `criar`, abre uma sala nova e vira o anfitrião;
 * sem, procura a sala e entra (como jogador se ainda estiver na espera, como
 * espectador se a partida já começou e eu não estiver nela).
 */
export function useSalaMagnata(codigo: string, eu: Eu, criar: boolean): SalaMagnata {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [presentes, setPresentes] = useState<Set<string>>(() => new Set([eu.id]));
  const [erro, setErro] = useState<string | null>(null);
  const [emote, setEmote] = useState<Emote | null>(null);
  const agirRef = useRef<(a: Acao) => void>(() => {});
  const reagirRef = useRef<(r: string) => void>(() => {});
  const euRef = useRef(eu);
  euRef.current = eu;

  useEffect(() => {
    const meu = euRef.current.id;
    let atual: Estado | null = null;
    let ligado = false;
    let morto = false;
    let pediuEntrada = false;
    const inicio = Date.now();
    const visto = new Map<string, number>();
    let aqui = new Set<string>([meu]);
    let ultimaJogada = Date.now();
    let chaveDaEtapa = "";
    let nEmote = 0;

    const canal: RealtimeChannel = supabase.channel(`hoki-magnata-${codigo}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: meu } },
    });
    const mandar = (event: string, payload: Record<string, unknown>) => {
      if (ligado) void canal.send({ type: "broadcast", event, payload });
    };
    const guardar = (e: Estado) => {
      atual = e;
      const chave = `${e.fase}:${e.vez}:${e.etapa}`;
      if (chave !== chaveDaEtapa) {
        chaveDaEtapa = chave;
        ultimaJogada = Date.now();
      }
      if (!morto) setEstado(e);
    };
    const publicar = (e: Estado) => {
      guardar(e);
      mandar("estado", { e });
    };
    const souAnfitriao = () => !!atual && atual.anfitriao === meu;
    /** Só o anfitrião decide: aplica a jogada e conta para todos. */
    const decidir = (de: string, a: Acao) => {
      if (!atual || !souAnfitriao()) return;
      const novo = aplicar(atual, de, a, Date.now());
      if (!novo) return;
      if (de === daVez(atual)?.id) ultimaJogada = Date.now();
      publicar(novo);
    };
    const agir = (a: Acao) => {
      if (a.t === "_prazo") return;
      if (souAnfitriao()) decidir(meu, a);
      else mandar("acao", { de: meu, a });
    };
    agirRef.current = agir;
    // só para testes: o anfitrião força um estado da partida (ex.: dar um grupo inteiro a alguém)
    if (import.meta.env.DEV)
      (window as unknown as { __magnataEstado?: unknown }).__magnataEstado = (
        muda: (e: Estado) => void,
      ) => {
        if (!atual || !souAnfitriao()) return null;
        const novo = structuredClone(atual);
        novo.v++;
        muda(novo);
        publicar(novo);
        return novo;
      };
    reagirRef.current = (reacao) => {
      const e = { id: meu, reacao, n: ++nEmote };
      setEmote(e);
      mandar("emote", { id: meu, reacao });
    };

    canal.on("broadcast", { event: "estado" }, ({ payload }) => {
      const e = (payload as { e?: Estado }).e;
      if (!e || typeof e.v !== "number" || !Array.isArray(e.jogadores)) return;
      // estado chegando é sinal de vida do anfitrião (mesmo se a lista de presença atrasar)
      visto.set(e.anfitriao, Date.now());
      if (atual && e.v <= atual.v) return;
      // o que vem de fora é conferido antes de desenhar
      for (const j of e.jogadores) j.visual = lerVisual(j.visual);
      guardar(e);
    });
    canal.on("broadcast", { event: "acao" }, ({ payload }) => {
      const { de, a } = payload as { de?: string; a?: Acao };
      if (typeof de !== "string" || !a || typeof a.t !== "string" || a.t === "_prazo") return;
      visto.set(de, Date.now());
      if (a.t === "entrar") {
        a.visual = lerVisual(a.visual);
        a.nome = String(a.nome ?? "HOKI");
      }
      decidir(de, a);
    });
    canal.on("broadcast", { event: "ola" }, () => {
      if (souAnfitriao() && atual) mandar("estado", { e: atual });
    });
    canal.on("broadcast", { event: "emote" }, ({ payload }) => {
      const { id, reacao } = payload as { id?: string; reacao?: string };
      if (typeof id !== "string" || typeof reacao !== "string" || reacao.length > 20) return;
      if (!morto) setEmote({ id, reacao, n: ++nEmote });
    });
    canal.on("presence", { event: "sync" }, () => {
      aqui = new Set([meu, ...Object.keys(canal.presenceState())]);
      if (!morto) setPresentes(aqui);
    });
    canal.subscribe((s) => {
      ligado = s === "SUBSCRIBED";
      if (!ligado) return;
      void canal.track({ id: meu });
      if (criar && !atual) publicar(novaSala(codigo, euRef.current));
      else if (!atual) mandar("ola", {});
      else if (souAnfitriao()) mandar("estado", { e: atual });
    });

    const relogio = setInterval(() => {
      const agora = Date.now();
      for (const id of aqui) visto.set(id, agora);
      const sumiu = (id: string) => agora - (visto.get(id) ?? inicio);
      if (!atual) {
        // ainda procurando a sala
        if (!criar) {
          mandar("ola", {});
          if (agora - inicio > 8000 && !morto)
            setErro("Essa partida não existe mais. Peça para tocarem o sino de novo.");
        }
        return;
      }
      // na espera, quem chegou pede um lugar
      if (
        atual.fase === "sala" &&
        !pediuEntrada &&
        !atual.jogadores.some((j) => j.id === meu) &&
        !souAnfitriao()
      ) {
        pediuEntrada = true;
        mandar("acao", {
          de: meu,
          a: { t: "entrar", nome: euRef.current.nome, visual: euRef.current.visual },
        });
        setTimeout(() => (pediuEntrada = false), 3000);
      }
      // o anfitrião sumiu: o primeiro jogador presente assume com o estado que tem
      if (!souAnfitriao() && sumiu(atual.anfitriao) > SEM_ANFITRIAO_MS) {
        const herdeiro = atual.jogadores.find((j) => aqui.has(j.id));
        if (herdeiro?.id === meu) publicar({ ...atual, anfitriao: meu, v: atual.v + 1 });
      }
      if (!souAnfitriao()) return;
      if (agora % 5000 < 300) mandar("estado", { e: atual });
      if (atual.fase === "sala") {
        const fora = atual.jogadores.find((j) => j.id !== meu && sumiu(j.id) > AUSENTE_MS);
        if (fora) decidir(fora.id, { t: "sair" });
        return;
      }
      if (atual.fase !== "jogo") return;
      const vez = daVez(atual);
      if (!vez) return;
      if (atual.prazo !== null) {
        if (agora >= atual.prazo) decidir(vez.id, { t: "_prazo" });
        return;
      }
      // quem caiu ou travou a vez: o jogo faz a jogada mais simples no lugar
      const ausente = !aqui.has(vez.id) && sumiu(vez.id) > AUSENTE_MS;
      if ((ausente && agora - ultimaJogada > 1500) || agora - ultimaJogada > PARADO_MS) {
        const a = jogadaAutomatica(atual);
        if (a) decidir(vez.id, a);
        ultimaJogada = agora;
      }
    }, 300);

    return () => {
      morto = true;
      clearInterval(relogio);
      void canal.untrack();
      void supabase.removeChannel(canal);
    };
  }, [codigo, criar]);

  return {
    estado,
    presentes,
    erro,
    emote,
    agir: (a) => agirRef.current(a),
    reagir: (r) => reagirRef.current(r),
  };
}
