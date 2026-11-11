import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lerVisual, type Visual } from "@/lib/hoki";

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
}
/** Interações em dupla: de mãos dadas, de cavalinho, pulando corda ou num abraço. */
export const DUPLAS = ["maos", "cavalinho", "corda", "abraco"] as const;
export type Dupla = (typeof DUPLAS)[number];
export interface Par {
  /** Com quem (id da outra pessoa). */
  com: string;
  tipo: Dupla;
}
type Identidade = Pick<PresencaHoki, "nome" | "tag" | "pet" | "visual">;
type Lugar = Pick<PresencaHoki, "x" | "z" | "banco" | "status" | "dorme" | "par" | "anim" | "sujo">;
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
  | "presente-entregue";
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
];
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
  /** Presentes: qual item e quantos. */
  item?: unknown;
  n?: unknown;
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
};

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
function publicar() {
  if (!canal || !pronto || !identidade || envioMarcado) return;
  const espera = Math.max(0, 150 - (Date.now() - ultimoEnvio));
  envioMarcado = setTimeout(() => {
    envioMarcado = null;
    if (!canal || !pronto || !identidade) return;
    ultimoEnvio = Date.now();
    void canal.track({ ...identidade, ...lugar });
  }, espera);
}

function lerEstado() {
  if (!canal) return;
  const estado = canal.presenceState() as Record<string, Partial<PresencaHoki>[]>;
  const proximo: Record<string, PresencaHoki> = {};
  for (const [id, lista] of Object.entries(estado)) {
    if (id === meuId) continue;
    // com mais de uma aba aberta, vale a que está acordada na praça
    const p = lista.find((m) => m.dorme === false) ?? lista[lista.length - 1];
    if (!p) continue;
    // quem ainda está na versão antiga só aparece quando entra na praça: conta como acordado
    const dorme = p.dorme === true;
    const x = numero(p.x, -79, 44);
    const z = numero(p.z, -16, 16);
    if (!dorme && (x === null || z === null)) continue;
    const banco = numero(p.banco, 0, 63);
    proximo[id] = {
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
      status: limpar(String(p.status ?? "")),
      dorme,
      par: lerPar(p.par, dorme),
      anim: !dorme && typeof p.anim === "string" && p.anim.length < 24 ? p.anim : null,
      sujo: p.sujo === true,
    };
  }
  avisar(proximo);
}

/** Liga a presença deste usuário (uma vez só; chamar de novo com o mesmo id não faz nada). */
export function conectarPresenca(id: string) {
  if (meuId === id) return;
  desconectarPresenca();
  meuId = id;
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
        // sem presença o resto do site segue funcionando; tenta de novo na próxima entrada
        meuId = "";
      }
    });
}

function abrirCanal(id: string) {
  const ch = supabase.channel(CANAL, { config: { presence: { key: id } } });
  ch.on("presence", { event: "sync" }, lerEstado);
  for (const evento of EVENTOS)
    ch.on("broadcast", { event: evento }, ({ payload }) =>
      ouvintes[evento].forEach((f) => f((payload ?? {}) as Mensagem)),
    );
  canal = ch;
  ch.subscribe((s) => {
    if (canal !== ch) return;
    pronto = s === "SUBSCRIBED";
    if (pronto) publicar();
    avisar(foto.outros);
  });
}

export function desconectarPresenca() {
  if (envioMarcado) clearTimeout(envioMarcado);
  envioMarcado = null;
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

/** Volta para o berço (ao sair da tela inicial ou ao escolher dormir). */
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
