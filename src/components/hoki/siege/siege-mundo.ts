import type * as TH from "three";
import { criarBoneco, type Boneco } from "../boneco";
import type { Reacao } from "../mascote";
import { playSfx } from "@/lib/sfx";
import { velocidadeAtual } from "@/lib/siege/combate";
import {
  KITS_INFO,
  ORIGEM_ARENA,
  PISO,
  SIEGE,
  lado,
  outroTime,
  type Kit,
  type Modo,
  type Time,
} from "@/lib/siege/config";
import {
  acao,
  criarPartida,
  escolherKit,
  escudoDe,
  estaProtegido,
  kitsLivres,
  moverJogador,
  passo,
  type Acao,
  type EventoSiege,
  type Partida,
} from "@/lib/siege/partida";
import { criarArena3D, livreNaArena, regrasDaArena } from "./arena-3d";
import { abrirCanalDaPartida, type InicioPartida } from "@/lib/siege/rede";
import { aplicarEstado, serializar } from "@/lib/siege/partida-rede";

/** Uniformes dos times (o look é aplicado no boneco durante a partida). */
export const UNIFORME: Record<Time, string> = {
  vermelho: "evento:time-vermelho",
  azul: "evento:time-azul",
};

/** O que a tela (HUD) precisa saber do HOST SIEGE, várias vezes por segundo. */
export interface EstadoSiege {
  ativo: boolean;
  modo: Modo;
  fase: Partida["fase"];
  /** Segundos que faltam da fase. */
  restante: number;
  guardioes: Record<Time, { hp: number; exposto: number }>;
  forja: {
    estado: Partida["forja"]["estado"];
    progresso: number;
    time: Time | null;
    contestada: boolean;
    restante: number;
  };
  pontos: Record<Time, number>;
  eu: null | {
    time: Time;
    kit: Kit | null;
    kitPedido: Kit | null;
    hp: number;
    escudo: number;
    morto: boolean;
    renasce: number;
    recarga: { 1: number; 2: number; 3: number };
    pocao: number;
    bebendo: number;
    protegido: boolean;
    pertoDePocao: boolean;
  };
  kitsLivres: Kit[];
  jogadores: {
    id: string;
    nome: string;
    time: Time;
    kit: Kit | null;
    bot: boolean;
    stats: {
      eliminacoes: number;
      assistencias: number;
      danoGuardiao: number;
      capturas: number;
      mortes: number;
    };
  }[];
  resultado: Partida["resultado"];
  alerta: null | { texto: string; ate: number; cor: "vermelho" | "azul" | "amarelo" };
}

export interface AdaptadorSiege {
  /** O meu boneco (coordenadas do mundo). */
  eu(): { id: string; nome: string; x: number; z: number; y: number; rumo: number } | null;
  teleportar(x: number, z: number): void;
  /** Para onde a câmera olha (rumo no chão). */
  mira(): number;
  /** Uniforme por cima do look (null tira). */
  uniforme(id: string, traje: string | null): void;
  /** Sem andar (morto) e fator de velocidade (lentidão). */
  controle(travado: boolean, fator: number): void;
  animar(reacao: Reacao): void;
  aoEstado(e: EstadoSiege): void;
  /** Põe a câmera atrás do boneco, olhando para esse rumo da câmera. */
  virarCamera(giro: number): void;
}

const ANIM_DO_KIT: Record<Kit, Reacao> = {
  vanguarda: "atkEspada",
  atirador: "atkArco",
  alquimista: "atkCajado",
  batedor: "atkAdaga",
};

/** Alvos de treino (bonecos parados na ponte). */
const ALVOS = [
  { id: "alvo:1", x: 10, z: -1.2 },
  { id: "alvo:2", x: 14, z: 1.2 },
  { id: "alvo:3", x: 18, z: 0 },
];

export function criarSiegeMundo(THREE: typeof TH, cena: TH.Scene, ad: AdaptadorSiege) {
  const arena = criarArena3D(THREE);
  cena.add(arena.grupo);
  const raiz = new THREE.Group();
  raiz.position.set(ORIGEM_ARENA.x, 0, ORIGEM_ARENA.z);
  cena.add(raiz);

  let p: Partida | null = null;
  let euId = "";
  let ultimoEstado = 0;
  // em rede: o canal da partida, se sou o anfitrião e o que chegou por último
  let canal: ReturnType<typeof abrirCanalDaPartida> | null = null;
  let souHost = true;
  let ultimoEnvio = 0;
  let ultimoRecebido = 0;
  let pendentes: EventoSiege[] = [];
  let ultimoPasso = 0;
  let alerta: EstadoSiege["alerta"] = null;
  const mundo = (x: number, z: number) => ({ x: x + ORIGEM_ARENA.x, z: z + ORIGEM_ARENA.z });
  const local = (x: number, z: number) => ({ x: x - ORIGEM_ARENA.x, z: z - ORIGEM_ARENA.z });
  const mapa = { livre: livreNaArena };

  // Guardiões: bonecos gigantes com o uniforme do time e uma barreira em volta
  const gBarreira = new THREE.SphereGeometry(3.4, 28, 18);
  const guardioes = (["vermelho", "azul"] as Time[]).map((t) => {
    const b = criarBoneco(THREE, "padrao", true, { traje: UNIFORME[t] });
    const g = lado(t).guardiao;
    b.raiz.position.set(g.x, PISO, g.z);
    b.raiz.scale.setScalar(1.55);
    b.raiz.rotation.y = t === "vermelho" ? Math.PI / 2 : -Math.PI / 2;
    const mB = new THREE.MeshBasicMaterial({
      color: t === "vermelho" ? 0xff4a4a : 0x4a8bff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      toneMapped: false,
    });
    const barreira = new THREE.Mesh(gBarreira, mB);
    barreira.position.set(g.x, PISO + 2.6, g.z);
    // aviso no chão do próximo ataque (círculo da pisada ou cone do golpe)
    const mAviso = new THREE.MeshBasicMaterial({
      color: 0xff2a2a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const aviso = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mAviso);
    aviso.rotation.x = -Math.PI / 2;
    aviso.position.set(g.x, PISO + 0.07, g.z);
    raiz.add(b.raiz, barreira, aviso);
    return {
      time: t,
      boneco: b,
      barreira,
      mB,
      aviso,
      mAviso,
      reacao: null as Reacao | null,
      inicioReacao: 0,
    };
  });

  // alvos de treino e projéteis
  const alvos = new Map<string, Boneco>();
  const gProj = new THREE.SphereGeometry(0.16, 10, 8);
  const mProj = {
    vermelho: new THREE.MeshBasicMaterial({ color: 0xff5a4a, toneMapped: false }),
    azul: new THREE.MeshBasicMaterial({ color: 0x5aa0ff, toneMapped: false }),
  };
  const mGelo = new THREE.MeshBasicMaterial({ color: 0xbff4ff, toneMapped: false });
  const projeteis = new Map<number, TH.Mesh>();
  const gFumaca = new THREE.SphereGeometry(1, 16, 12);
  const mFumaca = new THREE.MeshLambertMaterial({
    color: 0x9aa0a8,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const fumacas: TH.Mesh[] = [];

  const limparAtores = () => {
    for (const b of alvos.values()) {
      raiz.remove(b.raiz);
      b.descartar();
    }
    alvos.clear();
    for (const m of projeteis.values()) raiz.remove(m);
    projeteis.clear();
    for (const f of fumacas) raiz.remove(f);
    fumacas.length = 0;
  };

  const avisar = (texto: string, cor: "vermelho" | "azul" | "amarelo", s = 3) => {
    alerta = { texto, cor, ate: performance.now() + s * 1000 };
  };

  /** Começa uma partida em que este computador é o dono (treino). */
  function iniciar(modo: Modo, nome: string, id: string) {
    limparAtores();
    euId = id;
    const agora = performance.now();
    const time: Time = "vermelho";
    const lista: { id: string; nome: string; time: Time; bot?: boolean }[] = [{ id, nome, time }];
    if (modo === "treino")
      for (const a of ALVOS)
        lista.push({ id: a.id, nome: "Alvo de treino", time: "azul", bot: true });
    p = criarPartida(modo, lista, agora);
    for (const a of ALVOS) {
      const j = p.jogadores.get(a.id);
      if (!j) continue;
      j.x = a.x;
      j.z = a.z;
      j.y = PISO;
      j.kit = "vanguarda";
      const b = criarBoneco(THREE, "padrao", true, { traje: UNIFORME.azul });
      b.raiz.scale.setScalar(0.62);
      b.raiz.position.set(a.x, PISO, a.z);
      b.raiz.rotation.y = -Math.PI / 2;
      raiz.add(b.raiz);
      alvos.set(a.id, b);
    }
    regrasDaArena.meuTime = time;
    regrasDaArena.portoesFechados = true;
    ad.uniforme(id, UNIFORME[time]);
    const r = lado(time).renascer;
    const w = mundo(r.x, r.z);
    ad.teleportar(w.x, w.z);
    // a câmera atrás do boneco, olhando para o portão do castelo (a ponte)
    ad.virarCamera(time === "vermelho" ? -Math.PI / 2 : Math.PI / 2);
    playSfx("toggle");
    avisar("Escolha o seu kit — os portões abrem em 15 s", "amarelo", 4);
  }

  /** Começa uma partida em rede (fila pública ou sala privada). */
  function iniciarRede(m: InicioPartida, id: string) {
    limparAtores();
    euId = id;
    const agora = performance.now();
    p = criarPartida(m.modo, m.jogadores, agora);
    souHost = m.host === id;
    const eu = m.jogadores.find((j) => j.id === id);
    const time: Time = eu?.time ?? "vermelho";
    regrasDaArena.meuTime = time;
    regrasDaArena.portoesFechados = true;
    for (const j of m.jogadores) ad.uniforme(j.id, UNIFORME[j.time]);
    canal = abrirCanalDaPartida(m.id, {
      aoEstado: (snap) => {
        if (!p || souHost) return;
        ultimoRecebido = performance.now();
        tratarEventos(aplicarEstado(p, snap, ultimoRecebido, euId));
      },
      aoPos: (pos) => {
        if (p && souHost && pos.id !== euId) moverJogador(p, pos.id, pos);
      },
      aoAcao: (quem, a) => {
        if (p && souHost) acao(p, quem, a, performance.now(), mapa);
      },
      aoKit: (quem, k) => {
        if (p && souHost) escolherKit(p, quem, k);
      },
    });
    ultimoRecebido = agora;
    const r = lado(time).renascer;
    const w = mundo(r.x, r.z);
    ad.teleportar(w.x, w.z);
    ad.virarCamera(time === "vermelho" ? -Math.PI / 2 : Math.PI / 2);
    playSfx("toggle");
    avisar(`Você é do time ${time === "vermelho" ? "Vermelho" : "Azul"} — escolha o kit`, time, 4);
  }

  function sair() {
    if (!p) return;
    for (const j of p.jogadores.values()) if (!j.bot && j.id !== euId) ad.uniforme(j.id, null);
    canal?.fechar();
    canal = null;
    souHost = true;
    p = null;
    limparAtores();
    regrasDaArena.meuTime = null;
    regrasDaArena.portoesFechados = true;
    ad.uniforme(euId, null);
    ad.controle(false, 1);
    ad.aoEstado(estadoVazio());
  }

  function fazer(a: Acao) {
    if (!p) return false;
    if (canal && !souHost) {
      canal.acao(euId, a);
      const j = p.jogadores.get(euId);
      if (a.tipo === "ataque" && j?.kit && !j.morto && performance.now() >= j.proximoAtaque)
        ad.animar(ANIM_DO_KIT[j.kit]);
      return true;
    }
    const ok = acao(p, euId, a, performance.now(), mapa);
    if (ok && a.tipo === "ataque") {
      const kit = p.jogadores.get(euId)?.kit;
      if (kit) ad.animar(ANIM_DO_KIT[kit]);
    }
    return ok;
  }

  // teclas do mini-game: 1 a 5, E (pegar poção); só enquanto ele está ativo
  const aoTeclar = (e: KeyboardEvent) => {
    if (!p || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const alvo = document.activeElement;
    if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA")) return;
    const rumo = ad.mira();
    let usou = true;
    if (e.code === "Digit1") playSfx("click");
    else if (e.code === "Digit2") {
      if (!fazer({ tipo: "hab2", rumo })) playSfx("error");
    } else if (e.code === "Digit3") {
      if (!fazer({ tipo: "hab3", rumo })) playSfx("error");
    } else if (e.code === "Digit4") {
      if (!fazer({ tipo: "pocao" })) playSfx("error");
    } else if (e.code === "Digit5") playSfx("click");
    else if (e.code === "KeyE") {
      if (!fazer({ tipo: "pegarPocao" })) usou = false;
    } else usou = false;
    if (usou) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener("keydown", aoTeclar, true);

  function tratarEventos(evs: EventoSiege[]) {
    if (!p) return;
    const meu = p.jogadores.get(euId);
    for (const ev of evs) {
      if (ev.tipo === "teleporte" && ev.quem === euId && ev.x !== undefined && ev.z !== undefined) {
        const w = mundo(ev.x, ev.z);
        ad.teleportar(w.x, w.z);
      } else if (ev.tipo === "renasceu" && ev.quem) {
        const j = p.jogadores.get(ev.quem);
        if (ev.quem === euId && ev.x !== undefined && ev.z !== undefined) {
          const w = mundo(ev.x, ev.z);
          ad.teleportar(w.x, w.z);
          playSfx("pop");
        } else if (j?.bot) {
          const casa = ALVOS.find((a) => a.id === j.id);
          if (casa) {
            j.x = casa.x;
            j.z = casa.z;
          }
        }
      } else if (ev.tipo === "acerto") {
        if (ev.quem === euId) playSfx(ev.qt ? "soco" : "tap");
        if (ev.alvo === euId) playSfx("pouso");
      } else if (ev.tipo === "morte") {
        if (ev.alvo === euId) {
          playSfx("error");
          avisar("Você caiu! Volta em 7 s", "vermelho", 3);
        } else if (ev.quem === euId) avisar("Eliminação!", "amarelo", 1.5);
      } else if (ev.tipo === "captura" && ev.time) {
        playSfx("success");
        avisar(
          ev.time === meu?.time
            ? "Forja capturada! Ataquem o Guardião inimigo"
            : "O inimigo capturou a Forja!",
          ev.time,
          3,
        );
      } else if (ev.tipo === "exposto" && ev.time && ev.time === meu?.time) {
        avisar("O nosso Guardião está exposto! Defendam", ev.time, 3);
      } else if (ev.tipo === "janelaAcabando") {
        avisar("Faltam 5 s para a barreira voltar", "amarelo", 2.5);
      } else if (ev.tipo === "guardiaoAtaca") {
        const g = guardioes.find((x) => x.time === ev.time);
        if (g) {
          g.reacao = ev.texto === "pisada" ? "tombo" : "gancho";
          g.inicioReacao = performance.now();
        }
      } else if (ev.tipo === "fase" && ev.texto === "partida") {
        regrasDaArena.portoesFechados = false;
        playSfx("apito");
        avisar("Os portões abriram! Capturem a Forja", "amarelo", 3);
      } else if (ev.tipo === "fase" && ev.texto === "prorrogacao") {
        avisar("Prorrogação!", "amarelo", 3);
      } else if (ev.tipo === "fim") {
        playSfx(ev.time && ev.time === meu?.time ? "vitoria" : "sino");
      } else if (ev.tipo === "pocaoBebida" && ev.quem === euId) playSfx("add");
      else if (ev.tipo === "pocaoPega" && ev.quem === euId) playSfx("pop");
      else if (ev.tipo === "habilidade" && ev.quem === euId) playSfx("toggle");
    }
  }

  function estadoVazio(): EstadoSiege {
    return {
      ativo: false,
      modo: "treino",
      fase: "preparacao",
      restante: 0,
      guardioes: {
        vermelho: { hp: SIEGE.HP_GUARDIAO, exposto: 0 },
        azul: { hp: SIEGE.HP_GUARDIAO, exposto: 0 },
      },
      forja: { estado: "livre", progresso: 0, time: null, contestada: false, restante: 0 },
      pontos: { vermelho: 0, azul: 0 },
      eu: null,
      kitsLivres: [],
      jogadores: [],
      resultado: null,
      alerta: null,
    };
  }

  function montarEstado(agora: number): EstadoSiege {
    if (!p) return estadoVazio();
    const j = p.jogadores.get(euId);
    const seg = (ms: number) => Math.max(0, (ms - agora) / 1000);
    return {
      ativo: true,
      modo: p.modo,
      fase: p.fase,
      restante: seg(p.fimDaFase),
      guardioes: {
        vermelho: { hp: p.guardioes.vermelho.hp, exposto: seg(p.guardioes.vermelho.expostoAte) },
        azul: { hp: p.guardioes.azul.hp, exposto: seg(p.guardioes.azul.expostoAte) },
      },
      forja: {
        estado: p.forja.estado,
        progresso: p.forja.progresso,
        time: p.forja.time,
        contestada: p.forja.contestada,
        restante: seg(p.forja.ate),
      },
      pontos: { ...p.pontos },
      eu: j
        ? {
            time: j.time,
            kit: j.kit,
            kitPedido: j.kitPedido,
            hp: j.hp,
            escudo: escudoDe(j, agora),
            morto: j.morto,
            renasce: seg(j.renasceEm),
            recarga: { 1: seg(j.proximoAtaque), 2: seg(j.recarga[2]), 3: seg(j.recarga[3]) },
            pocao: j.pocao,
            bebendo: seg(j.bebendoAte),
            protegido: estaProtegido(j, agora),
            pertoDePocao: p.pedestais.some(
              (x) =>
                x.prontoEm <= agora && Math.hypot(x.x - j.x, x.z - j.z) <= SIEGE.PEDESTAL_ALCANCE,
            ),
          }
        : null,
      kitsLivres: j ? kitsLivres(p, j.time, j.id) : [],
      jogadores: [...p.jogadores.values()].map((x) => ({
        id: x.id,
        nome: x.nome,
        time: x.time,
        kit: x.kit,
        bot: x.bot,
        stats: { ...x.stats },
      })),
      resultado: p.resultado,
      alerta: alerta && alerta.ate > agora ? alerta : null,
    };
  }

  return {
    ativo: () => !!p,
    iniciar,
    iniciarRede,
    sair,
    /** Clique esquerdo: ataque básico na direção da câmera. */
    atacar() {
      if (!p) return false;
      fazer({ tipo: "ataque", rumo: ad.mira() });
      return true;
    },
    escolherKit(kit: Kit) {
      if (!p) return false;
      if (canal && !souHost) {
        canal.kit(euId, kit);
        playSfx("click");
        return true;
      }
      const ok = escolherKit(p, euId, kit);
      playSfx(ok ? "click" : "error");
      return ok;
    },
    atualizar(agora: number, dt: number, t: number) {
      // a arena só gasta desenho quando alguém está perto dela
      const eu = ad.eu();
      const perto = !!eu && Math.hypot(eu.x - ORIGEM_ARENA.x, eu.z - ORIGEM_ARENA.z) < 260;
      arena.grupo.visible = raiz.visible = perto;
      if (!p) return;
      if (eu) {
        const l = local(eu.x, eu.z);
        moverJogador(p, euId, { x: l.x, z: l.z, y: eu.y, rumo: eu.rumo });
      }
      // o tempo de cada passo sai do relógio (e não do quadro, que fica lento com a aba escondida)
      const passoS = ultimoPasso ? Math.min(0.5, (agora - ultimoPasso) / 1000) : dt;
      ultimoPasso = agora;
      if (!canal || souHost) {
        const evs = passo(p, agora, passoS, mapa);
        tratarEventos(evs);
        if (canal) {
          pendentes.push(...evs);
          if (agora - ultimoEnvio > 100) {
            ultimoEnvio = agora;
            canal.estado(serializar(p, agora, pendentes));
            pendentes = [];
          }
        }
      } else {
        if (eu && agora - ultimoEnvio > 100) {
          ultimoEnvio = agora;
          const l = local(eu.x, eu.z);
          canal.pos({ id: euId, x: l.x, z: l.z, y: eu.y, rumo: eu.rumo });
        }
        // o anfitrião sumiu: a partida acaba para todos
        if (agora - ultimoRecebido > 10000) {
          avisar("O anfitrião saiu: partida encerrada", "amarelo", 3);
          sair();
          return;
        }
      }
      regrasDaArena.portoesFechados = p.fase === "preparacao";
      const j = p.jogadores.get(euId);
      ad.controle(!!j?.morto || p.fase === "resultado", j ? velocidadeAtual(j, agora) : 1);
      // desenho: arena, Guardiões, alvos, projéteis e fumaça
      arena.atualizar({
        t,
        portoesFechados: p.fase === "preparacao",
        forja: p.forja,
        pedestaisProntos: p.pedestais.map((x) => x.prontoEm <= agora),
      });
      for (const g of guardioes) {
        const G = p.guardioes[g.time];
        g.barreira.visible = G.expostoAte <= agora && G.hp > 0;
        g.mB.opacity = 0.14 + Math.sin(t * 3) * 0.04;
        g.boneco.raiz.visible = G.hp > 0;
        const ataque = G.ataque;
        if (ataque) {
          const k = Math.min(
            1,
            (agora - ataque.inicio) / Math.max(1, ataque.impacto - ataque.inicio),
          );
          g.mAviso.opacity = 0.18 + k * 0.4;
          const raio =
            ataque.tipo === "pisada" ? SIEGE.GUARDIAO_PISADA.raio : SIEGE.GUARDIAO_GOLPE.alcance;
          g.aviso.geometry.dispose();
          g.aviso.geometry =
            ataque.tipo === "pisada"
              ? new THREE.CircleGeometry(raio, 40)
              : new THREE.CircleGeometry(
                  raio,
                  24,
                  Math.PI / 2 - ataque.rumo - SIEGE.GUARDIAO_GOLPE.arco / 2,
                  SIEGE.GUARDIAO_GOLPE.arco,
                );
          g.aviso.position.set(ataque.x, PISO + 0.07, ataque.z);
          g.boneco.raiz.rotation.y =
            ataque.tipo === "golpe" ? ataque.rumo : g.boneco.raiz.rotation.y;
        } else g.mAviso.opacity = 0;
        const emReacao = g.reacao && agora - g.inicioReacao < 1200;
        g.boneco.atualizar({
          t,
          humor: "normal",
          reacao: emReacao ? g.reacao : null,
          p: emReacao ? (agora - g.inicioReacao) / 1000 : 0,
          mouse: { x: 0, y: 0 },
          calmo: true,
        });
      }
      for (const [id, b] of alvos) {
        const j = p.jogadores.get(id);
        b.raiz.visible = !!j && !j.morto;
        if (j) b.raiz.position.set(j.x, PISO, j.z);
        b.atualizar({ t, humor: "normal", reacao: null, p: 0, mouse: { x: 0, y: 0 }, calmo: true });
      }
      const vivos = new Set<number>();
      for (const pr of p.projeteis) {
        vivos.add(pr.id);
        let m = projeteis.get(pr.id);
        if (!m) {
          m = new THREE.Mesh(gProj, pr.gelo ? mGelo : mProj[pr.time]);
          raiz.add(m);
          projeteis.set(pr.id, m);
        }
        m.position.set(pr.x, pr.y, pr.z);
      }
      for (const [id, m] of projeteis)
        if (!vivos.has(id)) {
          raiz.remove(m);
          projeteis.delete(id);
        }
      while (fumacas.length < p.fumacas.length) {
        const f = new THREE.Mesh(gFumaca, mFumaca);
        raiz.add(f);
        fumacas.push(f);
      }
      fumacas.forEach((f, i) => {
        const fu = p!.fumacas[i];
        f.visible = !!fu;
        if (fu) {
          f.position.set(fu.x, PISO + 1, fu.z);
          f.scale.setScalar(3 * 0.847 + Math.sin(t * 2 + i) * 0.1);
        }
      });
      // a tela recebe o estado 8 vezes por segundo
      if (agora - ultimoEstado > 125) {
        ultimoEstado = agora;
        ad.aoEstado(montarEstado(agora));
      }
      // fim: depois do resultado, volta sozinho
      if (p.fase === "resultado" && agora >= p.fimDaFase) sair();
    },
    /** Está numa fase em que o jogador não manda o próprio boneco? */
    morto: () => !!p?.jogadores.get(euId)?.morto,
    descartar() {
      window.removeEventListener("keydown", aoTeclar, true);
      limparAtores();
      for (const g of guardioes) g.boneco.descartar();
      arena.descartar();
      gBarreira.dispose();
      gProj.dispose();
      gFumaca.dispose();
      mFumaca.dispose();
      mGelo.dispose();
      mProj.vermelho.dispose();
      mProj.azul.dispose();
      cena.remove(arena.grupo, raiz);
    },
  };
}

/** Nome do kit e dos slots (para a HUD e o tutorial). */
export const slotsDoKit = (kit: Kit | null) => {
  const k = kit ? KITS_INFO[kit] : null;
  return [
    { tecla: 1, nome: k?.arma.nome ?? "Arma" },
    { tecla: 2, nome: k?.hab2.nome ?? "Habilidade" },
    { tecla: 3, nome: k?.hab3.nome ?? "Habilidade" },
    { tecla: 4, nome: "Poção de Cura" },
    { tecla: 5, nome: "Livre" },
  ];
};
export { outroTime };
