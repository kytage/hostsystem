/**
 * HOST SIEGE — as regras da partida (sem desenho e sem rede).
 *
 * Quem é o "dono" da partida (no treino, o próprio jogador; no multijogador, o
 * anfitrião) roda `passo` e aplica as `acao` que chegam; o estado resultante é
 * o que todos veem. Posições vêm dos clientes (cada um anda no seu computador).
 * Fluxo: preparação → partida → prorrogação (se precisar) → resultado.
 */
import {
  aplicarDano,
  aplicarEscudo,
  aplicarLentidao,
  creditoDaMorte,
  criarLutador,
  curar,
  escudoAtivo,
  linhaDeVisao,
  noArco,
  renascer,
  type Lutador,
} from "./combate";
import {
  FORJA,
  HABILIDADES,
  KITS,
  KITS_INFO,
  PEDESTAIS,
  QUEDA,
  SIEGE,
  dentroDe,
  lado,
  outroTime,
  type Kit,
  type Modo,
  type Time,
} from "./config";

export type Fase = "preparacao" | "partida" | "prorrogacao" | "resultado";

export interface JogadorSiege extends Lutador {
  nome: string;
  time: Time;
  kit: Kit | null;
  /** Kit pedido para o próximo respawn (durante a partida). */
  kitPedido: Kit | null;
  bot: boolean;
  x: number;
  z: number;
  y: number;
  rumo: number;
  /** Quando volta (se morto). */
  renasceEm: number;
  /** Proteção de quem acabou de sair da sala de spawn. */
  protegidoAte: number;
  estavaNoSpawn: boolean;
  proximoAtaque: number;
  recarga: { 2: number; 3: number };
  pocao: number;
  /** Bebendo a poção: termina nesse instante (0 = não está bebendo). */
  bebendoAte: number;
  stats: {
    eliminacoes: number;
    assistencias: number;
    danoGuardiao: number;
    capturas: number;
    mortes: number;
  };
}

export interface GuardiaoSiege {
  time: Time;
  hp: number;
  /** Sem barreira até (janela de ataque aberta pela Forja). */
  expostoAte: number;
  ataque: null | {
    tipo: "golpe" | "pisada";
    inicio: number;
    impacto: number;
    x: number;
    z: number;
    rumo: number;
  };
  recargaGolpe: number;
  recargaPisada: number;
}

export interface Projetil {
  id: number;
  de: string;
  time: Time;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  dano: number;
  restante: number;
  gelo: boolean;
  basico: boolean;
}

export interface EventoSiege {
  tipo:
    | "golpe"
    | "disparo"
    | "acerto"
    | "morte"
    | "renasceu"
    | "captura"
    | "exposto"
    | "janelaAcabando"
    | "barreiraVolta"
    | "guardiaoAtaca"
    | "guardiaoImpacto"
    | "pocaoBebida"
    | "pocaoPega"
    | "habilidade"
    | "teleporte"
    | "fase"
    | "fim";
  quem?: string;
  alvo?: string;
  time?: Time;
  qt?: number;
  x?: number;
  z?: number;
  texto?: string;
}

export interface Partida {
  modo: Modo;
  fase: Fase;
  /** Fim da fase atual (ms do relógio de quem roda). */
  fimDaFase: number;
  /** Prorrogação: o limite absoluto (60 s). */
  limiteProrrogacao: number;
  jogadores: Map<string, JogadorSiege>;
  guardioes: Record<Time, GuardiaoSiege>;
  forja: {
    estado: "livre" | "janela" | "recarga";
    progresso: number;
    time: Time | null;
    contestada: boolean;
    ate: number;
    alertou: boolean;
  };
  pontos: Record<Time, number>;
  danoAcumulado: Record<Time, number>;
  pontosDeDano: Record<Time, number>;
  pedestais: { id: string; x: number; z: number; prontoEm: number }[];
  projeteis: Projetil[];
  fumacas: { time: Time; x: number; z: number; ate: number }[];
  resultado: null | { vencedor: Time | "empate"; motivo: string };
  proximoId: number;
  eventos: EventoSiege[];
}

const segundos = (s: number) => s * 1000;

export function criarPartida(
  modo: Modo,
  jogadores: { id: string; nome: string; time: Time; bot?: boolean }[],
  agora: number,
): Partida {
  const p: Partida = {
    modo,
    fase: "preparacao",
    fimDaFase: agora + segundos(SIEGE.PREPARACAO_S),
    limiteProrrogacao: 0,
    jogadores: new Map(),
    guardioes: {
      vermelho: novoGuardiao("vermelho"),
      azul: novoGuardiao("azul"),
    },
    forja: { estado: "livre", progresso: 0, time: null, contestada: false, ate: 0, alertou: false },
    pontos: { vermelho: 0, azul: 0 },
    danoAcumulado: { vermelho: 0, azul: 0 },
    pontosDeDano: { vermelho: 0, azul: 0 },
    pedestais: PEDESTAIS.map((x) => ({ ...x, prontoEm: 0 })),
    projeteis: [],
    fumacas: [],
    resultado: null,
    proximoId: 1,
    eventos: [],
  };
  for (const j of jogadores) adicionarJogador(p, j);
  return p;
}

function novoGuardiao(time: Time): GuardiaoSiege {
  return {
    time,
    hp: SIEGE.HP_GUARDIAO,
    expostoAte: 0,
    ataque: null,
    recargaGolpe: 0,
    recargaPisada: 0,
  };
}

export function adicionarJogador(
  p: Partida,
  j: { id: string; nome: string; time: Time; bot?: boolean },
) {
  const base = criarLutador(j.id, j.time, SIEGE.HP_JOGADOR);
  const r = lado(j.time).renascer;
  const novo: JogadorSiege = {
    ...base,
    time: j.time,
    nome: j.nome,
    kit: null,
    kitPedido: null,
    bot: !!j.bot,
    x: r.x,
    z: r.z,
    y: 30,
    rumo: j.time === "vermelho" ? Math.PI / 2 : -Math.PI / 2,
    renasceEm: 0,
    protegidoAte: 0,
    estavaNoSpawn: true,
    proximoAtaque: 0,
    recarga: { 2: 0, 3: 0 },
    pocao: 1,
    bebendoAte: 0,
    stats: { eliminacoes: 0, assistencias: 0, danoGuardiao: 0, capturas: 0, mortes: 0 },
  };
  p.jogadores.set(j.id, novo);
  return novo;
}

/* ------------------------------------------------------------------ */
/* kits                                                                */
/* ------------------------------------------------------------------ */

/** Kits ainda livres num time (um jogador por kit em cada time). */
export function kitsLivres(p: Partida, time: Time, exceto?: string) {
  const usados = new Set<Kit>();
  for (const j of p.jogadores.values())
    if (j.time === time && j.id !== exceto && !j.bot) {
      if (j.kit) usados.add(j.kit);
      if (j.kitPedido) usados.add(j.kitPedido);
    }
  return KITS.filter((k) => !usados.has(k));
}

/** Pede um kit. Na preparação vale na hora; na partida, só no próximo respawn. */
export function escolherKit(p: Partida, id: string, kit: Kit) {
  const j = p.jogadores.get(id);
  if (!j || !kitsLivres(p, j.time, id).includes(kit)) return false;
  if (p.fase === "preparacao") {
    j.kit = kit;
    j.kitPedido = null;
  } else j.kitPedido = kit === j.kit ? null : kit;
  return true;
}

/* ------------------------------------------------------------------ */
/* ações do jogador                                                    */
/* ------------------------------------------------------------------ */

export type Acao =
  | { tipo: "ataque"; rumo: number }
  | { tipo: "hab2"; rumo: number }
  | { tipo: "hab3"; rumo: number }
  | { tipo: "pocao" }
  | { tipo: "pegarPocao" };

export interface Mapa {
  /** Dá para estar em (x, z)? (para deslocamentos e linha de visão) */
  livre(x: number, z: number): boolean;
}

const emJogo = (p: Partida) => p.fase === "partida" || p.fase === "prorrogacao";
const noSpawn = (j: JogadorSiege) => dentroDe(lado(j.time).spawn, j.x, j.z);
const protegido = (j: JogadorSiege, agora: number) => j.protegidoAte > agora || noSpawn(j);
const inimigos = (p: Partida, j: JogadorSiege) =>
  [...p.jogadores.values()].filter((o) => o.time !== j.time && !o.morto);

/** Atualiza a posição informada pelo cliente. */
export function moverJogador(
  p: Partida,
  id: string,
  pos: { x: number; z: number; y: number; rumo: number },
) {
  const j = p.jogadores.get(id);
  if (!j || j.morto) return;
  j.x = pos.x;
  j.z = pos.z;
  j.y = pos.y;
  j.rumo = pos.rumo;
}

function interromperPocao(j: JogadorSiege) {
  j.bebendoAte = 0;
}

function encerrarProtecao(j: JogadorSiege) {
  j.protegidoAte = 0;
}

/** Dano em jogador (com tudo que vem junto: crédito, interromper poção, morte). */
function machucar(
  p: Partida,
  alvo: JogadorSiege,
  qt: number,
  de: JogadorSiege | null,
  agora: number,
) {
  if (alvo.morto || protegido(alvo, agora)) return 0;
  const r = aplicarDano(alvo, qt, de ? { id: de.id, time: de.time } : null, agora);
  if (r.vida + r.escudo > 0) {
    interromperPocao(alvo);
    p.eventos.push({
      tipo: "acerto",
      ...(de ? { quem: de.id } : {}),
      alvo: alvo.id,
      qt: r.vida + r.escudo,
      x: alvo.x,
      z: alvo.z,
    });
  }
  if (r.morreu) morrer(p, alvo, agora);
  return r.vida + r.escudo;
}

function morrer(p: Partida, j: JogadorSiege, agora: number) {
  j.morto = true;
  j.hp = 0;
  j.bebendoAte = 0;
  j.renasceEm = agora + segundos(j.bot ? 3 : SIEGE.RESPAWN_S);
  j.stats.mortes++;
  const cred = creditoDaMorte(j, agora);
  const elim = cred.elimina ? p.jogadores.get(cred.elimina) : undefined;
  if (elim && elim.time !== j.time) {
    elim.stats.eliminacoes++;
    if (!j.bot) p.pontos[elim.time] += SIEGE.PONTOS_ELIMINACAO;
  }
  for (const a of cred.assistencias) {
    const o = p.jogadores.get(a);
    if (o && o.time !== j.time) o.stats.assistencias++;
  }
  p.eventos.push({ tipo: "morte", alvo: j.id, ...(elim ? { quem: elim.id } : {}), x: j.x, z: j.z });
}

/** Dano no Guardião (só ataques básicos, só exposto). */
function machucarGuardiao(
  p: Partida,
  g: GuardiaoSiege,
  qt: number,
  de: JogadorSiege,
  agora: number,
) {
  if (g.hp <= 0 || g.time === de.time) return 0;
  if (g.expostoAte <= agora) {
    p.eventos.push({ tipo: "acerto", quem: de.id, alvo: `guardiao:${g.time}`, qt: 0 });
    return 0;
  }
  const real = Math.min(g.hp, qt);
  g.hp -= real;
  de.stats.danoGuardiao += real;
  p.danoAcumulado[de.time] += real;
  const devidos = Math.floor(p.danoAcumulado[de.time] / SIEGE.PONTO_POR_DANO_GUARDIAO);
  if (devidos > p.pontosDeDano[de.time]) {
    p.pontos[de.time] += devidos - p.pontosDeDano[de.time];
    p.pontosDeDano[de.time] = devidos;
  }
  p.eventos.push({ tipo: "acerto", quem: de.id, alvo: `guardiao:${g.time}`, qt: real });
  if (g.hp <= 0) terminar(p, de.time, "Guardião derrubado", agora);
  return real;
}

/** Desloca o jogador na direção dada respeitando a colisão (para no primeiro obstáculo). */
function deslocar(p: Partida, j: JogadorSiege, dx: number, dz: number, dist: number, mapa: Mapa) {
  const n = Math.hypot(dx, dz) || 1;
  const ux = dx / n;
  const uz = dz / n;
  let x = j.x;
  let z = j.z;
  for (let d = 0.25; d <= dist; d += 0.25) {
    const nx = j.x + ux * d;
    const nz = j.z + uz * d;
    if (!mapa.livre(nx, nz)) break;
    x = nx;
    z = nz;
  }
  j.x = x;
  j.z = z;
  p.eventos.push({ tipo: "teleporte", quem: j.id, x, z });
}

export function acao(p: Partida, id: string, a: Acao, agora: number, mapa: Mapa) {
  const j = p.jogadores.get(id);
  if (!j || j.morto || !emJogo(p) || !j.kit) return false;
  const kit = KITS_INFO[j.kit];
  if (a.tipo === "pegarPocao") {
    if (j.pocao >= 1) return false;
    const ped = p.pedestais.find(
      (x) => x.prontoEm <= agora && Math.hypot(x.x - j.x, x.z - j.z) <= SIEGE.PEDESTAL_ALCANCE,
    );
    if (!ped) return false;
    j.pocao = 1;
    ped.prontoEm = agora + segundos(SIEGE.PEDESTAL_RECARGA_S);
    p.eventos.push({ tipo: "pocaoPega", quem: j.id });
    return true;
  }
  if (a.tipo === "pocao") {
    if (j.pocao < 1 || j.bebendoAte > 0 || j.hp >= j.hpMax) return false;
    j.bebendoAte = agora + segundos(SIEGE.POCAO_USO_S);
    return true;
  }
  if (a.tipo === "ataque") {
    if (agora < j.proximoAtaque) return false;
    j.proximoAtaque = agora + segundos(kit.arma.intervalo);
    j.rumo = a.rumo;
    interromperPocao(j);
    encerrarProtecao(j);
    if (kit.arma.tipo === "corpo") {
      p.eventos.push({ tipo: "golpe", quem: j.id, x: j.x, z: j.z });
      for (const o of inimigos(p, j))
        if (
          noArco(j, a.rumo, o, kit.arma.alcance, (110 * Math.PI) / 180) &&
          linhaDeVisao(j, o, mapa.livre)
        )
          machucar(p, o, kit.arma.dano, j, agora);
      const g = p.guardioes[outroTime(j.time)];
      const gp = lado(g.time).guardiao;
      if (noArco(j, a.rumo, gp, kit.arma.alcance + 1.4, (110 * Math.PI) / 180))
        machucarGuardiao(p, g, kit.arma.dano, j, agora);
    } else
      disparar(
        p,
        j,
        a.rumo,
        kit.arma.dano,
        kit.arma.velocidade ?? 25,
        kit.arma.alcance,
        false,
        true,
      );
    return true;
  }
  // habilidades (slot 2 e 3)
  const slot = a.tipo === "hab2" ? 2 : 3;
  if (agora < j.recarga[slot]) return false;
  const info = slot === 2 ? kit.hab2 : kit.hab3;
  const fx = Math.sin(a.rumo);
  const fz = Math.cos(a.rumo);
  let usou = true;
  switch (`${j.kit}:${slot}`) {
    case "vanguarda:2":
      aplicarEscudo(j, HABILIDADES.bastiao.escudo, segundos(HABILIDADES.bastiao.dur), agora);
      break;
    case "vanguarda:3": {
      const antes = { x: j.x, z: j.z };
      deslocar(p, j, fx, fz, HABILIDADES.investida.dist, mapa);
      // o primeiro inimigo no caminho leva o dano
      const alvo = inimigos(p, j)
        .map((o) => ({ o, d: distanciaAoSegmento(o, antes, j) }))
        .filter((x) => x.d < 0.9)
        .sort(
          (a1, b1) =>
            Math.hypot(a1.o.x - antes.x, a1.o.z - antes.z) -
            Math.hypot(b1.o.x - antes.x, b1.o.z - antes.z),
        )[0];
      if (alvo) machucar(p, alvo.o, HABILIDADES.investida.dano, j, agora);
      break;
    }
    case "atirador:2":
      disparar(
        p,
        j,
        a.rumo,
        HABILIDADES.gelo.dano,
        HABILIDADES.gelo.velocidade,
        KITS_INFO.atirador.arma.alcance,
        true,
        false,
      );
      break;
    case "atirador:3":
      deslocar(p, j, -fx, -fz, HABILIDADES.recuo.dist, mapa);
      break;
    case "alquimista:2":
      for (const o of p.jogadores.values())
        if (
          o.time === j.time &&
          !o.morto &&
          Math.hypot(o.x - j.x, o.z - j.z) <= HABILIDADES.pulso.raio
        )
          curar(o, HABILIDADES.pulso.cura);
      break;
    case "alquimista:3": {
      const aliado = [...p.jogadores.values()]
        .filter((o) => o.time === j.time && o.id !== j.id && !o.morto && !o.bot)
        .filter((o) =>
          noArco(j, a.rumo, o, HABILIDADES.barreira.alcance, HABILIDADES.barreira.mira * 2),
        )
        .sort(
          (a1, b1) => Math.hypot(a1.x - j.x, a1.z - j.z) - Math.hypot(b1.x - j.x, b1.z - j.z),
        )[0];
      if (aliado)
        aplicarEscudo(
          aliado,
          HABILIDADES.barreira.escudo,
          segundos(HABILIDADES.barreira.dur),
          agora,
        );
      else usou = false;
      break;
    }
    case "batedor:2":
      deslocar(p, j, fx, fz, HABILIDADES.arrancada.dist, mapa);
      break;
    case "batedor:3":
      p.fumacas.push({
        time: j.time,
        x: j.x,
        z: j.z,
        ate: agora + segundos(HABILIDADES.fumaca.dur),
      });
      break;
    default:
      usou = false;
  }
  if (!usou) return false;
  j.recarga[slot] = agora + segundos(info.recarga);
  interromperPocao(j);
  encerrarProtecao(j);
  p.eventos.push({ tipo: "habilidade", quem: j.id, texto: info.nome, x: j.x, z: j.z });
  return true;
}

function distanciaAoSegmento(
  o: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const l = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((o.x - a.x) * vx + (o.z - a.z) * vz) / l));
  return Math.hypot(o.x - (a.x + vx * t), o.z - (a.z + vz * t));
}

function disparar(
  p: Partida,
  j: JogadorSiege,
  rumo: number,
  dano: number,
  vel: number,
  alcance: number,
  gelo: boolean,
  basico: boolean,
) {
  p.projeteis.push({
    id: p.proximoId++,
    de: j.id,
    time: j.time,
    x: j.x + Math.sin(rumo) * 0.6,
    z: j.z + Math.cos(rumo) * 0.6,
    y: j.y + 1.1,
    vx: Math.sin(rumo) * vel,
    vz: Math.cos(rumo) * vel,
    dano,
    restante: alcance,
    gelo,
    basico,
  });
  p.eventos.push({ tipo: "disparo", quem: j.id, x: j.x, z: j.z });
}

/* ------------------------------------------------------------------ */
/* o relógio da partida                                                */
/* ------------------------------------------------------------------ */

function terminar(p: Partida, vencedor: Time | "empate", motivo: string, agora: number) {
  if (p.fase === "resultado") return;
  p.fase = "resultado";
  p.resultado = { vencedor, motivo };
  p.fimDaFase = agora + segundos(SIEGE.RESULTADO_S);
  p.projeteis = [];
  p.eventos.push({
    tipo: "fim",
    texto: motivo,
    ...(vencedor !== "empate" ? { time: vencedor } : {}),
  });
}

/** Decide no fim do tempo: mais HP no próprio Guardião, depois mais pontos, senão empate. */
function decidirPeloTempo(p: Partida, agora: number) {
  const v = p.guardioes.vermelho.hp;
  const a = p.guardioes.azul.hp;
  if (v !== a) return terminar(p, v > a ? "vermelho" : "azul", "Mais vida no Guardião", agora);
  if (p.pontos.vermelho !== p.pontos.azul)
    return terminar(
      p,
      p.pontos.vermelho > p.pontos.azul ? "vermelho" : "azul",
      "Mais pontos",
      agora,
    );
  terminar(p, "empate", "Empate", agora);
}

const disputaEmAndamento = (p: Partida, agora: number) =>
  p.forja.progresso > 0 ||
  p.forja.contestada ||
  p.guardioes.vermelho.expostoAte > agora ||
  p.guardioes.azul.expostoAte > agora;

export function passo(p: Partida, agora: number, dt: number, mapa: Mapa) {
  p.eventos = [];
  // fases
  if (p.fase === "preparacao") {
    if (agora >= p.fimDaFase) {
      for (const j of p.jogadores.values())
        if (!j.kit) j.kit = kitsLivres(p, j.time, j.id)[0] ?? "vanguarda";
      p.fase = "partida";
      p.fimDaFase = agora + segundos(SIEGE.PARTIDA_S);
      p.eventos.push({ tipo: "fase", texto: "partida" });
    }
    return p.eventos;
  }
  if (p.fase === "resultado") return p.eventos;
  if (p.fase === "partida" && agora >= p.fimDaFase) {
    if (disputaEmAndamento(p, agora)) {
      p.fase = "prorrogacao";
      p.limiteProrrogacao = agora + segundos(SIEGE.PRORROGACAO_S);
      p.fimDaFase = p.limiteProrrogacao;
      p.eventos.push({ tipo: "fase", texto: "prorrogacao" });
    } else return (decidirPeloTempo(p, agora), p.eventos);
  }
  if (p.fase === "prorrogacao" && (agora >= p.limiteProrrogacao || !disputaEmAndamento(p, agora)))
    return (decidirPeloTempo(p, agora), p.eventos);

  // jogadores: queda, respawn, proteção ao sair do spawn, poção
  for (const j of p.jogadores.values()) {
    if (j.morto) {
      if (agora >= j.renasceEm) {
        renascer(j);
        if (j.kitPedido) {
          j.kit = j.kitPedido;
          j.kitPedido = null;
        }
        const r = lado(j.time).renascer;
        j.x = r.x;
        j.z = r.z;
        j.pocao = Math.max(j.pocao, 1);
        j.estavaNoSpawn = true;
        j.proximoAtaque = 0;
        p.eventos.push({ tipo: "renasceu", quem: j.id, x: r.x, z: r.z });
      }
      continue;
    }
    if (!j.bot && j.y < QUEDA) {
      j.hp = 0;
      morrer(p, j, agora);
      continue;
    }
    const agoraNoSpawn = noSpawn(j);
    if (j.estavaNoSpawn && !agoraNoSpawn) j.protegidoAte = agora + segundos(SIEGE.PROTECAO_SPAWN_S);
    j.estavaNoSpawn = agoraNoSpawn;
    if (j.bebendoAte > 0 && agora >= j.bebendoAte) {
      j.bebendoAte = 0;
      j.pocao = 0;
      curar(j, SIEGE.POCAO_CURA);
      p.eventos.push({ tipo: "pocaoBebida", quem: j.id });
    }
  }

  // projéteis: andam, batem no cenário ou no primeiro alvo válido
  for (const pr of p.projeteis) {
    const passoDist = Math.hypot(pr.vx, pr.vz) * dt;
    const n = Math.max(1, Math.ceil(passoDist / 0.3));
    for (let i = 0; i < n && pr.restante > 0; i++) {
      pr.x += (pr.vx * dt) / n;
      pr.z += (pr.vz * dt) / n;
      pr.restante -= passoDist / n;
      if (!mapa.livre(pr.x, pr.z) && Math.abs(pr.x) > 1) {
        pr.restante = 0;
        break;
      }
      const de = p.jogadores.get(pr.de);
      const alvo = [...p.jogadores.values()].find(
        (o) => o.time !== pr.time && !o.morto && Math.hypot(o.x - pr.x, o.z - pr.z) < 0.55,
      );
      if (alvo && de) {
        machucar(p, alvo, pr.dano, de, agora);
        if (pr.gelo)
          aplicarLentidao(alvo, HABILIDADES.gelo.lento, segundos(HABILIDADES.gelo.dur), agora);
        pr.restante = 0;
        break;
      }
      const g = p.guardioes[outroTime(pr.time)];
      const gp = lado(g.time).guardiao;
      if (de && Math.hypot(gp.x - pr.x, gp.z - pr.z) < 1.4) {
        if (pr.basico) machucarGuardiao(p, g, pr.dano, de, agora);
        pr.restante = 0;
        break;
      }
    }
  }
  p.projeteis = p.projeteis.filter((x) => x.restante > 0);
  p.fumacas = p.fumacas.filter((f) => f.ate > agora);

  // Forja Central
  const F = p.forja;
  if (F.estado === "janela") {
    if (!F.alertou && F.ate - agora <= 5000) {
      F.alertou = true;
      p.eventos.push({ tipo: "janelaAcabando", ...(F.time ? { time: F.time } : {}) });
    }
    if (agora >= F.ate) {
      F.estado = "recarga";
      F.ate = agora + segundos(SIEGE.FORJA_RECARGA_S);
      F.progresso = 0;
      p.eventos.push({ tipo: "barreiraVolta", ...(F.time ? { time: outroTime(F.time) } : {}) });
      F.time = null;
    }
  } else if (F.estado === "recarga") {
    if (agora >= F.ate) F.estado = "livre";
  } else {
    const dentro: Record<Time, JogadorSiege[]> = { vermelho: [], azul: [] };
    for (const j of p.jogadores.values())
      if (
        !j.morto &&
        !j.bot &&
        !protegido(j, agora) &&
        Math.hypot(j.x - FORJA.x, j.z - FORJA.z) <= SIEGE.FORJA_RAIO
      )
        dentro[j.time].push(j);
    const v = dentro.vermelho.length > 0;
    const a = dentro.azul.length > 0;
    F.contestada = v && a;
    if (!v && !a) {
      F.progresso = 0;
      F.time = null;
    } else if (!F.contestada) {
      const t: Time = v ? "vermelho" : "azul";
      if (F.time !== t) {
        F.time = t;
        F.progresso = 0;
      }
      F.progresso += dt;
      if (F.progresso >= SIEGE.FORJA_CAPTURA_S) {
        p.pontos[t] += SIEGE.FORJA_PONTOS;
        for (const j of dentro[t]) j.stats.capturas++;
        F.estado = "janela";
        F.ate = agora + segundos(SIEGE.FORJA_JANELA_S);
        F.alertou = false;
        F.progresso = SIEGE.FORJA_CAPTURA_S;
        p.guardioes[outroTime(t)].expostoAte = F.ate;
        p.eventos.push({ tipo: "captura", time: t });
        p.eventos.push({ tipo: "exposto", time: outroTime(t) });
      }
    }
  }

  // Guardiões: um ataque por vez, sempre avisando no chão antes do impacto
  for (const g of Object.values(p.guardioes)) {
    const L = lado(g.time);
    const invasores = [...p.jogadores.values()].filter(
      (j) => j.time !== g.time && !j.morto && !j.bot && dentroDe(L.patio, j.x, j.z),
    );
    if (g.ataque) {
      if (agora >= g.ataque.impacto) {
        const at = g.ataque;
        for (const j of invasores) {
          const acerta =
            at.tipo === "pisada"
              ? Math.hypot(j.x - at.x, j.z - at.z) <= SIEGE.GUARDIAO_PISADA.raio
              : noArco(
                  L.guardiao,
                  at.rumo,
                  j,
                  SIEGE.GUARDIAO_GOLPE.alcance,
                  SIEGE.GUARDIAO_GOLPE.arco,
                );
          if (acerta)
            machucar(
              p,
              j,
              at.tipo === "pisada" ? SIEGE.GUARDIAO_PISADA.dano : SIEGE.GUARDIAO_GOLPE.dano,
              null,
              agora,
            );
        }
        p.eventos.push({ tipo: "guardiaoImpacto", time: g.time, texto: at.tipo });
        g.ataque = null;
      }
      continue;
    }
    if (!invasores.length) continue;
    const perto = invasores
      .map((j) => ({ j, d: Math.hypot(j.x - L.guardiao.x, j.z - L.guardiao.z) }))
      .sort((a1, b1) => a1.d - b1.d);
    const alvo = perto[0]!;
    if (agora >= g.recargaPisada && alvo.d <= SIEGE.GUARDIAO_PISADA.raio) {
      g.ataque = {
        tipo: "pisada",
        inicio: agora,
        impacto: agora + segundos(SIEGE.GUARDIAO_PISADA.aviso_s),
        x: L.guardiao.x,
        z: L.guardiao.z,
        rumo: 0,
      };
      g.recargaPisada = agora + segundos(SIEGE.GUARDIAO_PISADA.recarga_s);
    } else if (agora >= g.recargaGolpe && alvo.d <= SIEGE.GUARDIAO_GOLPE.alcance) {
      const rumo = Math.atan2(alvo.j.x - L.guardiao.x, alvo.j.z - L.guardiao.z);
      g.ataque = {
        tipo: "golpe",
        inicio: agora,
        impacto: agora + segundos(SIEGE.GUARDIAO_GOLPE.aviso_s),
        x: L.guardiao.x,
        z: L.guardiao.z,
        rumo,
      };
      g.recargaGolpe = agora + segundos(SIEGE.GUARDIAO_GOLPE.recarga_s);
    }
    if (g.ataque) p.eventos.push({ tipo: "guardiaoAtaca", time: g.time, texto: g.ataque.tipo });
  }
  return p.eventos;
}

/** O jogador está protegido (sala de spawn ou acabou de sair)? (para o desenho) */
export const estaProtegido = protegido;
/** Escudo de um jogador agora (para a HUD). */
export const escudoDe = (j: JogadorSiege, agora: number) => escudoAtivo(j, agora);
