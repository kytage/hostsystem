import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lerVisual, type Visual } from "@/lib/hoki";
import { TIPOS_SHOW, type Show, type TipoShow } from "@/lib/hoki-shows";
import { registrarAcesso } from "@/lib/hoki-rankings";

/**
 * Presença dos HOKIs, ao vivo. Um canal só para o site inteiro: enquanto a
 * pessoa está com o painel aberto (em qualquer tela), o HOKI dela aparece
 * dormindo no berço. Na tela inicial, a praça usa este mesmo canal para
 * acordar, andar, sentar, falar e fazer truques.
 */
export interface PresencaHoki {
  id: string;
  nome: string;
  /** Sigla do cargo (SUP, MOD…), mostrada em vermelho antes do nome. */
  tag: string;
  pet: string;
  visual: Visual;
  /** Para onde está indo na praça (só vale acordado). */
  x: number;
  z: number;
  banco: number | null;
  /** Status curto (emoji + texto). */
  status: string;
  /** Está no berço, dormindo: ainda não acordou. */
  dorme: boolean;
  /** Interação em dupla que esta pessoa está fazendo com outra (ela é quem acompanha). */
  par: Par | null;
  /** Animação que fica repetindo até a pessoa parar (o nome dela; quem desenha confere se conhece). */
  anim: string | null;
  /** HOKI sujo (aparece com mosquitos em volta). */
  sujo: boolean;
  /** Com fome ou sede (10% ou menos): anda devagar. */
  lento: boolean;
  /** Está dentro da HOST FAZENDAS (numa ilha de fazenda, a própria ou a de alguém). */
  naFazenda: boolean;
}
/** Status que aparece para todos enquanto a pessoa está dentro da HOST FAZENDAS. */
export const STATUS_NA_FAZENDA = "🌾 No HOST FAZENDAS";
/** Interações em dupla: de mãos dadas, de cavalinho, pulando corda ou num abraço. */
export const DUPLAS = ["maos", "cavalinho", "corda", "abraco"] as const;
export type Dupla = (typeof DUPLAS)[number];
export interface Par {
  /** Com quem (id da outra pessoa). */
  com: string;
  tipo: Dupla;
}
type Identidade = Pick<PresencaHoki, "nome" | "tag" | "pet" | "visual">;
type Lugar = Pick<
  PresencaHoki,
  "x" | "z" | "banco" | "status" | "dorme" | "par" | "anim" | "sujo" | "lento" | "naFazenda"
>;
/** fala e truque vão para todos; convite, resposta, soltar e chamar dizem para quem são (`para`). */
type Evento =
  | "fala"
  | "truque"
  | "convite"
  | "resposta"
  | "soltar"
  | "chamar"
  | "presente"
  | "presente-resposta"
  | "presente-entregue"
  | "estado"
  | "ola"
  | "tchau"
  | "reiniciar"
  | "show"
  | "corrida"
  | "magnata"
  | "fazenda-visita"
  | "comercio";
const EVENTOS: Evento[] = [
  "fala",
  "truque",
  "convite",
  "resposta",
  "soltar",
  "chamar",
  "presente",
  "presente-resposta",
  "presente-entregue",
  "estado",
  "ola",
  "tchau",
  "reiniciar",
  "show",
  "corrida",
  "magnata",
  "fazenda-visita",
  "comercio",
];
/** Eventos internos da presença (não passam para quem ouve a praça). */
const INTERNOS = new Set<Evento>(["estado", "ola", "tchau"]);
/** O que chega numa fala ou num truque (sempre conferir os tipos antes de usar). */
export interface Mensagem {
  id?: unknown;
  texto?: unknown;
  tipo?: unknown;
  /** Quem mandou e para quem é (convites, respostas, soltar e chamar). */
  de?: unknown;
  para?: unknown;
  nome?: unknown;
  aceita?: unknown;
  /** Corrida: quanto falta (ms) para o lobby fechar. */
  faltam?: unknown;
  /** Magnata: código da sala para a qual a pessoa foi convidada. */
  codigo?: unknown;
  /** Presentes: qual item e quantos. */
  item?: unknown;
  n?: unknown;
  /** Comércio: quanto custou (Staff Coins). */
  preco?: unknown;
}

const CANAL = "hoki-praca-3d";
const NO_BERCO: Lugar = {
  x: 0,
  z: 12,
  banco: null,
  status: "",
  dorme: true,
  par: null,
  anim: null,
  sujo: false,
  lento: false,
  naFazenda: false,
};

/**
 * Além da presença, cada aba manda o próprio estado por mensagem direta a cada
 * mudança e de tempos em tempos (acordado a cada 12 s, dormindo a cada 45 s).
 * Se a lista de presença do servidor atrasar ou cair por um tempo (já aconteceu:
 * as mensagens chegavam e a lista ficava vazia), a praça continua vendo todo
 * mundo. Quem fecha a aba avisa e some na hora; quem some sem avisar sai depois
 * de 75 s (acordado) ou 2 min e meio (dormindo: abas escondidas o navegador
 * deixa mais lentas, e ninguém pode sumir do berço por isso).
 */
const BATIDA_MS = 6_000;
const BATIDA_ACORDADO_MS = 12_000;
const BATIDA_DORMINDO_MS = 45_000;
const VALIDADE_ACORDADO_MS = 75_000;
const VALIDADE_DORMINDO_MS = 150_000;
let ultimaBatida = 0;
/** Identifica esta aba (a mesma pessoa pode ter várias abas abertas). */
const MINHA_ABA = Math.random().toString(36).slice(2, 10);
const porMensagem = new Map<string, Map<string, { dados: Partial<PresencaHoki>; visto: number }>>();
let batida: ReturnType<typeof setInterval> | null = null;

let canal: RealtimeChannel | null = null;
let meuId = "";
let pronto = false;
let identidade: Identidade | null = null;
let lugar: Lugar = NO_BERCO;
let foto: { outros: Record<string, PresencaHoki>; pronto: boolean } = { outros: {}, pronto: false };
const assinantes = new Set<() => void>();
const ouvintes = Object.fromEntries(EVENTOS.map((e) => [e, new Set()])) as Record<
  Evento,
  Set<(dados: Mensagem) => void>
>;

const limpar = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 32);
const numero = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : null;

/** Confere a dupla recebida: só vale acordado, com um tipo conhecido e outra pessoa. */
function lerPar(bruto: unknown, dorme: boolean): Par | null {
  if (dorme || !bruto || typeof bruto !== "object") return null;
  const { com, tipo } = bruto as { com?: unknown; tipo?: unknown };
  const t = DUPLAS.find((d) => d === tipo);
  return typeof com === "string" && com.length < 64 && t ? { com, tipo: t } : null;
}

function avisar(outros: Record<string, PresencaHoki>) {
  foto = { outros, pronto };
  assinantes.forEach((f) => f());
}

/**
 * Publica onde estou. Mudanças seguidas (vários cliques rápidos, status e
 * sujeira mudando juntos) viram um envio só, a cada 150 ms no máximo: o canal
 * ao vivo tem limite de mensagens por segundo e assim ninguém fica para trás.
 */
let envioMarcado: ReturnType<typeof setTimeout> | null = null;
let ultimoEnvio = 0;
/** O último estado que o servidor confirmou (vazio = precisa mandar de novo). */
let ultimoTrack = "";
function publicar(forcar = false) {
  if (forcar) ultimoTrack = "";
  if (!canal || !pronto || !identidade || envioMarcado) return;
  const espera = Math.max(0, 150 - (Date.now() - ultimoEnvio));
  envioMarcado = setTimeout(() => {
    envioMarcado = null;
    const ch = canal;
    if (!ch || !pronto || !identidade) return;
    // a marca da aba deixa cada aba se achar na lista (a mesma pessoa pode ter várias abertas)
    const dados = { ...identidade, ...lugar, aba: MINHA_ABA };
    const texto = JSON.stringify(dados);
    // nada mudou desde o último envio confirmado: não gasta mensagem
    if (texto === ultimoTrack) return;
    ultimoEnvio = Date.now();
    ultimoTrack = texto;
    void ch
      .track(dados)
      .then((r) => {
        // não chegou no servidor: a próxima batida manda de novo
        if (r !== "ok" && ultimoTrack === texto) ultimoTrack = "";
      })
      .catch(() => {
        if (ultimoTrack === texto) ultimoTrack = "";
      });
    enviarEstado();
  }, espera);
}

/** Confere e arruma o que chegou de uma pessoa (pela presença ou por mensagem). */
function lerPessoa(id: string, p: Partial<PresencaHoki>): PresencaHoki | null {
  // quem ainda está na versão antiga só aparece quando entra na praça: conta como acordado
  const dorme = p.dorme === true;
  const x = numero(p.x, -56, 56);
  const z = numero(p.z, -51, 24);
  if (!dorme && (x === null || z === null)) return null;
  const banco = numero(p.banco, 0, 63);
  const status = limpar(String(p.status ?? ""));
  return {
    id,
    nome: String(p.nome ?? "staff").slice(0, 24),
    tag: String(p.tag ?? "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 5)
      .toUpperCase(),
    pet: String(p.pet ?? "").slice(0, 24),
    visual: lerVisual(p.visual),
    x: x ?? NO_BERCO.x,
    z: z ?? NO_BERCO.z,
    banco: dorme || banco === null ? null : Math.round(banco),
    status,
    dorme,
    par: lerPar(p.par, dorme),
    anim: !dorme && typeof p.anim === "string" && p.anim.length < 24 ? p.anim : null,
    sujo: p.sujo === true,
    lento: !dorme && p.lento === true,
    // quem ainda está na versão anterior do site só avisa pelo status
    naFazenda: !dorme && (p.naFazenda === true || status === STATUS_NA_FAZENDA),
  };
}

/** Com mais de uma aba aberta, vale a que está acordada na praça. */
const escolher = (lista: Partial<PresencaHoki>[]) =>
  lista.find((m) => m.dorme === false) ?? lista[lista.length - 1];

function lerEstado() {
  if (!canal) return;
  const estado = canal.presenceState() as Record<string, Partial<PresencaHoki>[]>;
  const agora = Date.now();
  const ids = new Set([...Object.keys(estado), ...porMensagem.keys()]);
  const proximo: Record<string, PresencaHoki> = {};
  for (const id of ids) {
    if (id === meuId) continue;
    // a mensagem direta é a mais nova; a presença fica de reserva
    const abas = porMensagem.get(id);
    const frescas: Partial<PresencaHoki>[] = [];
    for (const [aba, m] of abas ?? []) {
      const validade = m.dados.dorme === true ? VALIDADE_DORMINDO_MS : VALIDADE_ACORDADO_MS;
      if (agora - m.visto < validade) frescas.push(m.dados);
      else abas?.delete(aba);
    }
    if (abas && abas.size === 0) porMensagem.delete(id);
    const p = escolher(frescas.length ? frescas : (estado[id] ?? []));
    const pessoa = p && lerPessoa(id, p);
    if (pessoa) proximo[id] = pessoa;
  }
  avisar(proximo);
}

/** Guarda o estado que alguém mandou por mensagem. */
function receberEstado(m: Mensagem & Partial<PresencaHoki> & { aba?: unknown }) {
  const id = typeof m.id === "string" && m.id.length < 64 ? m.id : "";
  const aba = typeof m.aba === "string" ? m.aba.slice(0, 16) : "";
  if (!id || !aba || id === meuId) return;
  let abas = porMensagem.get(id);
  if (!abas) porMensagem.set(id, (abas = new Map()));
  abas.set(aba, { dados: m, visto: Date.now() });
  lerEstado();
}

/** Manda meu estado por mensagem (além da presença). */
function enviarEstado() {
  if (!canal || !pronto || !identidade || !meuId) return;
  ultimaBatida = Date.now();
  void canal.send({
    type: "broadcast",
    event: "estado",
    payload: { ...identidade, ...lugar, id: meuId, aba: MINHA_ABA },
  });
}

/** Aviso de que esta aba fechou: some na hora para os outros. */
function avisarSaida() {
  if (!canal || !pronto || !meuId) return;
  void canal.send({ type: "broadcast", event: "tchau", payload: { id: meuId, aba: MINHA_ABA } });
}
if (typeof window !== "undefined") window.addEventListener("pagehide", avisarSaida);

/**
 * Relógio de acesso (TOP HORAS e TOP DORMINDO do arco da praça): a cada minuto com o site
 * aberto e visível, conta um minuto; se o HOKI está no berço, conta também como dormindo.
 */
let relogioDeAcesso: ReturnType<typeof setInterval> | null = null;
function ligarRelogioDeAcesso() {
  if (relogioDeAcesso) return;
  const bater = () => {
    if (!meuId || document.visibilityState !== "visible") return;
    void registrarAcesso(lugar.dorme).catch(() => undefined);
  };
  relogioDeAcesso = setInterval(bater, 60_000);
}

/** Liga a presença deste usuário (uma vez só; chamar de novo com o mesmo id não faz nada). */
export function conectarPresenca(id: string) {
  if (meuId === id) return;
  desconectarPresenca();
  meuId = id;
  ligarRelogioDeAcesso();
  // Se sobrou um canal antigo com este nome (troca rápida de usuário, recarga parcial do site),
  // ele precisa sair antes: o Supabase devolveria o mesmo canal, já ligado, e não aceitaria os ouvintes.
  const antigos = supabase.getChannels().filter((c) => c.topic === `realtime:${CANAL}`);
  void Promise.all(antigos.map((c) => supabase.removeChannel(c)))
    .catch(() => undefined)
    .then(() => {
      if (meuId !== id || canal) return;
      try {
        abrirCanal(id);
      } catch {
        // sem presença o resto do site segue funcionando; tenta de novo daqui a pouco
        meuId = "";
        setTimeout(() => {
          if (!meuId && !canal) conectarPresenca(id);
        }, 5000);
      }
    });
}

function abrirCanal(id: string) {
  const ch = supabase.channel(CANAL, { config: { presence: { key: id } } });
  ch.on("presence", { event: "sync" }, lerEstado);
  for (const evento of EVENTOS)
    ch.on("broadcast", { event: evento }, ({ payload }) => {
      const dados = (payload ?? {}) as Mensagem & Partial<PresencaHoki> & { aba?: unknown };
      if (evento === "estado") receberEstado(dados);
      else if (evento === "ola") {
        // alguém acabou de entrar: quem está acordado manda o estado na hora (com um atraso
        // sorteado para não chegarem todos juntos); quem dorme aparece pela presença e pela batida
        if (!lugar.dorme) setTimeout(enviarEstado, 200 + Math.random() * 900);
      } else if (evento === "show") {
        void aplicarShow(dados);
        return;
      } else if (evento === "reiniciar") {
        void aplicarReinicio(dados.de);
        return;
      } else if (evento === "tchau") {
        const abas = typeof dados.id === "string" ? porMensagem.get(dados.id) : undefined;
        if (abas && typeof dados.aba === "string") abas.delete(dados.aba);
        lerEstado();
      }
      if (!INTERNOS.has(evento)) ouvintes[evento].forEach((f) => f(dados));
    });
  canal = ch;
  ch.subscribe((s) => {
    if (canal !== ch) return;
    pronto = s === "SUBSCRIBED";
    if (pronto) {
      // entrou ou voltou depois de uma queda: o servidor não lembra de mim, manda tudo de novo
      publicar(true);
      void ch.send({ type: "broadcast", event: "ola", payload: { id } });
    }
    avisar(foto.outros);
  });
  // batida: reenvia o estado a cada 10 s, tira da praça quem parou de mandar e religa o canal se ele caiu
  if (batida) clearInterval(batida);
  batida = setInterval(() => {
    vigiar();
    // o servidor perdeu a minha presença (acontece quando ele se reorganiza): publica de novo
    const minhas = canal
      ? (canal.presenceState()[meuId] as { aba?: unknown }[] | undefined)
      : undefined;
    if (canal && pronto && identidade && !minhas?.some((m) => m.aba === MINHA_ABA)) publicar(true);
    else publicar();
    const intervalo = lugar.dorme ? BATIDA_DORMINDO_MS : BATIDA_ACORDADO_MS;
    if (Date.now() - ultimaBatida >= intervalo - 500) enviarEstado();
    if (porMensagem.size) lerEstado();
  }, BATIDA_MS);
}

/**
 * Se o canal fechou ou deu erro (internet caiu, aba ficou muito tempo em segundo
 * plano), abre de novo sem perder quem eu sou nem onde estou.
 */
let quedaDesde = 0;
function vigiar() {
  const ch = canal;
  if (!ch || !meuId) return;
  const caiu =
    !supabase.getChannels().includes(ch) || ch.state === "closed" || ch.state === "errored";
  if (!caiu) {
    quedaDesde = 0;
    return;
  }
  // dá um tempinho para a própria biblioteca religar sozinha
  if (!quedaDesde) quedaDesde = Date.now();
  if (Date.now() - quedaDesde < 4000 && supabase.getChannels().includes(ch)) return;
  quedaDesde = 0;
  religar();
}

/** Fecha e abre o canal de novo, sem perder quem eu sou nem onde estou. */
function religar() {
  const ch = canal;
  const id = meuId;
  if (!id) return;
  canal = null;
  pronto = false;
  ultimoTrack = "";
  porMensagem.clear();
  avisar({});
  void (ch ? supabase.removeChannel(ch) : Promise.resolve())
    .catch(() => undefined)
    .then(() => {
      if (meuId !== id || canal) return;
      try {
        abrirCanal(id);
      } catch {
        // tenta de novo na próxima batida
      }
    });
}

/** Se quem mandou reiniciar é Founder (guardado para não perguntar ao banco toda hora). */
const founders = new Map<string, Promise<boolean>>();
function ehFounder(id: string) {
  let c = founders.get(id);
  if (!c) {
    // cada um só consegue ler o próprio cargo na tabela; a função has_role do banco responde por qualquer um
    c = Promise.resolve(supabase.rpc("has_role", { _user_id: id, _role: "founder" })).then(
      ({ data, error }) => !error && data === true,
      () => false,
    );
    founders.set(id, c);
  }
  return c;
}

/**
 * Reinício da praça (raio do Founder): todo mundo volta a dormir no berço e
 * religa o canal do zero. Serve para destravar quem ficou fora de sincronia.
 * Só vale se quem mandou for Founder de verdade (conferido no banco).
 */
async function aplicarReinicio(de: unknown) {
  if (typeof de !== "string" || de.length > 64) return;
  if (!(await ehFounder(de))) return;
  ouvintes.reiniciar.forEach((f) => f({ de }));
  lugar = { ...lugar, dorme: true, banco: null, par: null, anim: null };
  // cada um religa num momento um pouco diferente, para não entrarem todos no mesmo instante
  setTimeout(religar, 300 + Math.random() * 2500);
}

/** Raio do Founder: manda todo mundo (inclusive eu) voltar para o berço e sincronizar de novo. */
/** Evento do Founder recebido: confere tudo e entrega para a praça (que monta a coreografia). */
async function aplicarShow(dados: Mensagem & { ids?: unknown; semente?: unknown }) {
  const { de, tipo, ids, semente } = dados;
  if (typeof de !== "string" || de.length > 64) return;
  if (typeof tipo !== "string" || !TIPOS_SHOW.includes(tipo as TipoShow)) return;
  if (typeof semente !== "number" || !Number.isFinite(semente)) return;
  if (
    !Array.isArray(ids) ||
    ids.length > 60 ||
    ids.some((i) => typeof i !== "string" || i.length > 64)
  )
    return;
  if (!(await ehFounder(de))) return;
  const show: Show = { de, tipo: tipo as TipoShow, ids: ids as string[], semente };
  ouvintes.show.forEach((f) => f(show as unknown as Mensagem));
}

/**
 * Evento do Founder (trovão, avião, batata quente…): manda para todo mundo e
 * começa aqui também. Quem recebe confere no banco se veio mesmo de um Founder.
 */
export function enviarShow(tipo: TipoShow, ids: string[]) {
  if (!canal || !meuId) return false;
  const semente = Math.floor(Math.random() * 2 ** 31);
  const payload = { de: meuId, tipo, ids, semente };
  void canal.send({ type: "broadcast", event: "show", payload });
  void aplicarShow(payload);
  return true;
}

export function reiniciarPraca() {
  if (!canal || !meuId) return false;
  void canal.send({ type: "broadcast", event: "reiniciar", payload: { de: meuId } });
  void aplicarReinicio(meuId);
  return true;
}
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // voltou para a aba: confere o canal na hora e manda onde estou
    quedaDesde = quedaDesde ? quedaDesde - 4000 : 0;
    vigiar();
    enviarEstado();
  });

// A conexão da praça vive enquanto a aba estiver aberta: trocar de tela no painel
// (que desmonta e monta os componentes) não desliga nada. Só sair da conta desliga.
if (typeof window !== "undefined")
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") desconectarPresenca();
  });

export function desconectarPresenca() {
  avisarSaida();
  if (batida) clearInterval(batida);
  batida = null;
  if (relogioDeAcesso) clearInterval(relogioDeAcesso);
  relogioDeAcesso = null;
  porMensagem.clear();
  if (envioMarcado) clearTimeout(envioMarcado);
  envioMarcado = null;
  ultimoTrack = "";
  const ch = canal;
  canal = null;
  pronto = false;
  meuId = "";
  identidade = null;
  lugar = NO_BERCO;
  if (ch) void supabase.removeChannel(ch);
  avisar({});
}

/** Quem eu sou na praça (nome, cargo, nome e aparência do HOKI). */
export function definirIdentidade(i: Identidade) {
  identidade = i;
  publicar();
}

/** Onde estou: no berço (dorme) ou acordado, andando ou sentado na praça. */
export function definirLugar(l: Partial<Lugar>) {
  lugar = { ...lugar, ...l };
  publicar();
}

/**
 * Onde estou agora. Ao trocar de tela no painel o HOKI continua na praça do
 * jeito que estava; quando a tela inicial abre de novo, ela começa daqui.
 */
export const meuLugar = (): Lugar => ({ ...lugar });

/** Volta para o berço (ao escolher dormir). */
export const voltarAoBerco = () =>
  definirLugar({ dorme: true, banco: null, par: null, anim: null });

export function enviarNaPraca(evento: Evento, dados: Mensagem) {
  void canal?.send({ type: "broadcast", event: evento, payload: dados });
}

/** Ouve um tipo de mensagem dos outros (falas, truques, convites…). Devolve a função que para de ouvir. */
export function ouvirNaPraca(evento: Evento, f: (dados: Mensagem) => void) {
  ouvintes[evento].add(f);
  return () => void ouvintes[evento].delete(f);
}

const assinar = (f: () => void) => {
  assinantes.add(f);
  return () => void assinantes.delete(f);
};
const ler = () => foto;

/** Meu id neste canal (vazio enquanto não conectou). */
export const meuIdNaPraca = () => meuId;

/** Os outros HOKIs que estão com o site aberto (dormindo ou acordados) e se o canal já ligou. */
export function usePresencaHoki() {
  return useSyncExternalStore(assinar, ler, ler);
}
