import { useEffect, useRef, useState } from "react";
import type * as TH from "three";
import { cn } from "@/lib/utils";
import { MOV, criarCorpo, passo, type MapaMovimento } from "@/lib/hoki-movimento";
import { ControlesDeToque } from "./controles-toque";
import { gerarPassos } from "./boneco-passos";
import { vestirBoneco } from "./boneco-roupa";
import { CAPA_GLITTER, COROA_GLITTER, VIP_BLACK, vestirAcessorios } from "./boneco-acessorios";
import {
  ASAS_ANJO,
  ASAS_FADA,
  AUREOLA_ANJO,
  BONE_HOST,
  CAPACETE_VIKING,
  CHAPEU_COWBOY,
  CHAPEU_PIRATA,
  CORACOES_FLUTUANDO,
  GORRO_INVERNO,
  GORRO_NATAL,
  LACO_FOFO,
  ORELHAS_GATO,
  ORELHAS_URSO,
  URSINHO_COSTAS,
} from "./boneco-enfeites";
import { LOOKS, TRAJE_TIME_AZUL, TRAJE_TIME_VERMELHO } from "./boneco-roupa";
import { peca } from "@/lib/hoki";
import { montarLuzes, prepararDesenho, SOL, COR_NEVOA } from "./luz";
import { MODELOS_NATUREZA, Natureza, type ModeloNatureza } from "./natureza";
import { ceu, sorteador } from "./voxel";

/**
 * Aba TESTE: um campo aberto para experimentar os pacotes novos.
 *
 * - Boneco com esqueleto e 43 animações ("Universal Animation Library 2",
 *   Quaternius, CC0): public/hoki/boneco/padrao.glb (animações em animacoes-2.glb), mais a versão
 *   feminina (Mannequin_F.glb), que usa as mesmas animações.
 * - Natureza ("Ultimate Stylized Nature", Quaternius, CC0): um bosque em volta
 *   e, ao fundo, a vitrine com os 49 modelos lado a lado.
 *
 * Anda com o mesmo controle da praça (WASD, Shift, Espaço), em terceira pessoa.
 */

const BONECOS = {
  padrao: { nome: "Masculino", url: "/hoki/boneco/padrao.glb" },
  feminino: { nome: "Feminino", url: "/hoki/boneco/feminino.glb" },
} as const;
export type QualBoneco = keyof typeof BONECOS;
export const LISTA_BONECOS = Object.entries(BONECOS).map(([id, b]) => ({
  id: id as QualBoneco,
  nome: b.nome,
}));

/** As animações do pacote, agrupadas para o painel. */
export const GRUPOS_ANIMACAO: { nome: string; itens: [string, string][] }[] = [
  {
    nome: "Pacote 1",
    itens: [
      ["Idle_Loop", "Parado"],
      ["Walk_Loop", "Andar"],
      ["Jog_Fwd_Loop", "Trote"],
      ["Sprint_Loop", "Disparada"],
      ["Jump_Start", "Pulo: saída"],
      ["Jump_Loop", "Pulo: no ar"],
      ["Jump_Land", "Pulo: pouso"],
      ["Sitting_Idle_Loop", "Sentado"],
      ["Sitting_Talking_Loop", "Sentado conversando"],
      ["Dance_Loop", "Dançar"],
      ["Idle_Talking_Loop", "Conversando"],
      ["Crouch_Idle_Loop", "Agachado"],
      ["Crouch_Fwd_Loop", "Andar agachado"],
      ["Roll", "Cambalhota"],
      ["Punch_Jab", "Jab"],
      ["Punch_Cross", "Direto"],
      ["Death01", "Cair"],
      ["Spell_Simple_Shoot", "Magia"],
      ["Fixing_Kneeling", "Consertar"],
      ["PickUp_Table", "Pegar"],
      ["Interact", "Interagir"],
      ["Push_Loop", "Empurrar"],
      ["Walk_Formal_Loop", "Andar formal"],
      ["Swim_Fwd_Loop", "Nadar"],
      ["Driving_Loop", "Dirigir"],
    ],
  },
  {
    nome: "Parado",
    itens: [
      ["Idle_No_Loop", "Parado"],
      ["Idle_FoldArms_Loop", "Braços cruzados"],
      ["Idle_TalkingPhone_Loop", "No telefone"],
      ["Idle_Lantern_Loop", "Com lanterna"],
      ["Idle_Rail_Loop", "Apoiado na grade"],
      ["Idle_Rail_Call", "Chamar da grade"],
      ["Yes", "Sim"],
      ["A_TPose", "Pose T"],
    ],
  },
  {
    nome: "Movimento",
    itens: [
      ["Walk_Carry_Loop", "Andar carregando"],
      ["NinjaJump_Start", "Pulo: saída"],
      ["NinjaJump_Idle_Loop", "Pulo: no ar"],
      ["NinjaJump_Land", "Pulo: pouso"],
      ["Slide_Start", "Deslizar: entrada"],
      ["Slide_Loop", "Deslizar"],
      ["Slide_Exit", "Deslizar: saída"],
      ["ClimbUp_1m", "Subir 1 m"],
      ["LayToIdle", "Levantar do chão"],
    ],
  },
  {
    nome: "Fazenda e ações",
    itens: [
      ["Farm_Harvest", "Colher"],
      ["Farm_PlantSeed", "Plantar"],
      ["Farm_Watering", "Regar"],
      ["TreeChopping_Loop", "Cortar árvore"],
      ["Chest_Open", "Abrir baú"],
      ["Consume", "Comer / beber"],
      ["OverhandThrow", "Arremessar"],
    ],
  },
  {
    nome: "Espada e escudo",
    itens: [
      ["Sword_Regular_A", "Golpe A"],
      ["Sword_Regular_A_Rec", "Golpe A (volta)"],
      ["Sword_Regular_B", "Golpe B"],
      ["Sword_Regular_B_Rec", "Golpe B (volta)"],
      ["Sword_Regular_C", "Golpe C"],
      ["Sword_Regular_Combo", "Combo"],
      ["Sword_Heavy_Combo", "Combo pesado"],
      ["Sword_Dash", "Investida"],
      ["Sword_Block", "Bloquear"],
      ["Idle_Shield_Loop", "Escudo em guarda"],
      ["Idle_Shield_Break", "Escudo quebrado"],
      ["Shield_OneShot", "Escudada"],
      ["Shield_Dash", "Avanço de escudo"],
    ],
  },
  {
    nome: "Luta e zumbi",
    itens: [
      ["Melee_Hook", "Gancho"],
      ["Melee_Hook_Rec", "Gancho (volta)"],
      ["Hit_Knockback", "Levar pancada"],
      ["Zombie_Idle_Loop", "Zumbi parado"],
      ["Zombie_Walk_Fwd_Loop", "Zumbi andando"],
      ["Zombie_Scratch", "Zumbi arranhando"],
    ],
  },
];

/** O que toca em cada situação (com o pacote 1, entram parado, trote, disparada e pulo dele). */
const ANIM: Record<"parado" | "andar" | "correr" | "ar" | "pouso" | "desliza", string> = {
  parado: "Idle_No_Loop",
  andar: "Proc_Trote",
  correr: "Proc_Disparada",
  ar: "NinjaJump_Idle_Loop",
  pouso: "NinjaJump_Land",
  desliza: "Slide_Loop",
};

const RAIO_CAMPO = 68;
const DIRECOES: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** O que está sendo provado em cada espaço ("" = nada). */
interface Provando {
  chapeu: string;
  costas: string;
  traje: string;
  efeito: string;
}
const NADA: Provando = { chapeu: "", costas: "", traje: "", efeito: "" };

/** Botões de provar, por espaço (os looks de cada corpo e as roupas dos times do HOST SIEGE). */
const PROVADOR: { espaco: keyof Provando; nome: string; itens: { id: string; nome: string }[] }[] =
  [
    {
      espaco: "traje",
      nome: "Looks e trajes",
      itens: [
        ...Object.keys(LOOKS).map((id) => ({
          id,
          nome: `${peca(id)?.nome ?? id} (${LOOKS[id]!.corpo === "feminino" ? "F" : "M"})`,
        })),
        { id: VIP_BLACK, nome: "VIP BLACK" },
        { id: TRAJE_TIME_VERMELHO, nome: "Time Vermelho" },
        { id: TRAJE_TIME_AZUL, nome: "Time Azul" },
      ],
    },
    {
      espaco: "chapeu",
      nome: "Cabeça",
      itens: [
        COROA_GLITTER,
        BONE_HOST,
        CHAPEU_COWBOY,
        CHAPEU_PIRATA,
        GORRO_INVERNO,
        CAPACETE_VIKING,
        GORRO_NATAL,
        ORELHAS_GATO,
        ORELHAS_URSO,
        LACO_FOFO,
        AUREOLA_ANJO,
      ].map((id) => ({ id, nome: peca(id)?.nome ?? id })),
    },
    {
      espaco: "costas",
      nome: "Costas",
      itens: [CAPA_GLITTER, URSINHO_COSTAS, ASAS_ANJO, ASAS_FADA].map((id) => ({
        id,
        nome: peca(id)?.nome ?? id,
      })),
    },
    {
      espaco: "efeito",
      nome: "Efeitos",
      itens: [{ id: CORACOES_FLUTUANDO, nome: peca(CORACOES_FLUTUANDO)?.nome ?? "Corações" }],
    },
  ];

interface Motor {
  tocar(nome: string): void;
  boneco(qual: QualBoneco): void;
  /** Prova os cosméticos (sem comprar). */
  cosmeticos(p: Provando): void;
  joystick(lado: number, frente: number, correr: boolean): void;
  pular(): void;
  descartar(): void;
}

async function criarMotor(
  el: HTMLDivElement,
  aviso: { anim: (nome: string) => void; fps: (n: number) => void },
): Promise<Motor> {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const lixo: { dispose: () => void }[] = [];

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  prepararDesenho(THREE, renderer);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";

  const cena = new THREE.Scene();
  const texCeu = ceu(THREE);
  cena.background = texCeu;
  cena.fog = new THREE.Fog(COR_NEVOA, 60, 170);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.2, 260);
  const luzes = montarLuzes(THREE, cena, {
    alvo: { x: 0, y: 0, z: 0 },
    area: [26, 26],
    distancia: 60,
    mapa: 2048,
    maciez: 2.2,
  });

  // ---------------- chão ----------------
  const gChao = new THREE.CircleGeometry(RAIO_CAMPO + 6, 72);
  gChao.rotateX(-Math.PI / 2);
  const mChao = new THREE.MeshLambertMaterial({ color: 0x67b23e });
  const chao = new THREE.Mesh(gChao, mChao);
  chao.receiveShadow = true;
  const gPista = new THREE.RingGeometry(8.6, 9.4, 64);
  gPista.rotateX(-Math.PI / 2);
  const mPista = new THREE.MeshLambertMaterial({ color: 0xd9cfae });
  const pista = new THREE.Mesh(gPista, mPista);
  pista.position.y = 0.01;
  pista.receiveShadow = true;
  cena.add(chao, pista);
  lixo.push(gChao, mChao, gPista, mPista, texCeu);

  // ---------------- natureza: bosque em volta e a vitrine ao fundo ----------------
  const mato = new Natureza();
  const troncos: [number, number, number][] = [];
  const r = sorteador(77);
  const tipos = ["copa", "copa", "copinha", "pinheiro", "copa", "palmeira"] as const;
  const cores = ["verde", "verde", "amarelo", "laranja"] as const;
  for (let n = 0; n < 46; n++) {
    const a = r() * Math.PI * 2;
    const d = 14 + r() * 48;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z < -16 && Math.abs(x) < 34) continue; // a vitrine fica livre
    const tipo = tipos[Math.floor(r() * tipos.length)]!;
    mato.arvore(x, z, { tipo, cor: cores[Math.floor(r() * cores.length)]! });
    troncos.push([x, z, 0.55]);
  }
  for (let n = 0; n < 60; n++) {
    const a = r() * Math.PI * 2;
    const d = 11 + r() * 52;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z < -16 && Math.abs(x) < 34) continue;
    if (n % 5 === 0) mato.pedra(x, z, 0.9 + r() * 0.8);
    else mato.arbusto(x, z, 0.9 + r() * 0.5, n % 2 ? { flor: true } : {});
  }
  for (let n = 0; n < 520; n++) {
    const a = r() * Math.PI * 2;
    const d = 2 + Math.sqrt(r()) * 62;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (r() < 0.4) mato.flor(x, 0, z, 1.3);
    else mato.capim(x, 0, z, 1.4);
  }
  // vitrine: os modelos pequenos na frente, as árvores atrás, em fileiras
  const grandes = MODELOS_NATUREZA.filter((m) => /Tree/.test(m));
  const pequenos = MODELOS_NATUREZA.filter((m) => !/Tree/.test(m));
  const corDe = (m: ModeloNatureza) =>
    m.startsWith("Maple")
      ? 0xee7b2c
      : m.startsWith("Birch")
        ? 0xf2c230
        : /Normal|Bush/.test(m)
          ? 0x6fb734
          : 0xffffff;
  pequenos.forEach((m, i) => {
    const col = i % 9;
    const lin = Math.floor(i / 9);
    mato.por(
      m,
      (col - 4) * 2.6,
      0,
      -19 - lin * 2.8,
      1.5,
      0.4,
      corDe(m),
      m.startsWith("Bush") ? 1 : 1,
    );
  });
  grandes.forEach((m, i) => {
    const col = i % 6;
    const lin = Math.floor(i / 6);
    const x = (col - 2.5) * 10 + (lin % 2 ? 4 : 0);
    const z = -31 - lin * 9;
    mato.por(m, x, 0, z, 1.25, 0.6, corDe(m), m.startsWith("Maple") ? 1.3 : 1);
    troncos.push([x, z, 0.6]);
  });
  const natureza = mato.construir(THREE);
  cena.add(natureza.grupo);
  lixo.push({ dispose: natureza.descartar });

  const mapa: MapaMovimento = {
    livre: (x, z) =>
      Math.hypot(x, z) < RAIO_CAMPO &&
      !troncos.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr),
    chao: () => 0,
  };

  // ---------------- boneco ----------------
  const carregador = new GLTFLoader();
  const arquivos = new Map<
    string,
    Promise<{ scene: TH.Object3D; animations: TH.AnimationClip[] }>
  >();
  const baixar = (url: string) => {
    let p = arquivos.get(url);
    if (!p) {
      p = carregador.loadAsync(url);
      arquivos.set(url, p);
    }
    return p;
  };
  const raiz = new THREE.Group();
  cena.add(raiz);
  let clipes: TH.AnimationClip[] = [];
  let mixer: TH.AnimationMixer | null = null;
  let figura: TH.Object3D | null = null;
  let atual: TH.AnimationAction | null = null;
  let nomeAtual = "";
  /** Animação escolhida no painel (fica até acabar, ou até andar). */
  let escolhida: string | null = null;
  let vivo = true;

  const tocarClipe = (nome: string, o: { uma?: boolean; fade?: number; ritmo?: number } = {}) => {
    if (!mixer || !figura) return;
    const clipe = clipes.find((c) => c.name === nome);
    if (!clipe) return;
    const acao = mixer.clipAction(clipe);
    acao.timeScale = o.ritmo ?? 1;
    if (nomeAtual === nome && atual === acao && acao.isRunning()) return;
    acao.reset();
    acao.setLoop(o.uma ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    acao.clampWhenFinished = true;
    if (atual && atual !== acao) acao.crossFadeFrom(atual, o.fade ?? 0.18, false);
    acao.play();
    atual = acao;
    nomeAtual = nome;
    aviso.anim(nome);
  };

  let acessorios: ReturnType<typeof vestirAcessorios> | null = null;
  let provando: Provando = { ...NADA };
  let qualAtual: QualBoneco = "padrao";
  const montarBoneco = async (qual: QualBoneco) => {
    const [base, pacote1, modelo] = await Promise.all([
      baixar("/hoki/boneco/animacoes-2.glb"),
      baixar("/hoki/boneco/animacoes-1.glb").catch(() => null),
      baixar(BONECOS[qual].url),
    ]);
    if (!vivo) return;
    clipes = [...base.animations, ...(pacote1?.animations ?? [])];
    const tem = (n: string) => clipes.some((c) => c.name === n);
    if (tem("Idle_Loop")) ANIM.parado = "Idle_Loop";
    if (tem("Jog_Fwd_Loop")) ANIM.andar = "Jog_Fwd_Loop";
    if (tem("Sprint_Loop")) ANIM.correr = "Sprint_Loop";
    if (tem("Jump_Loop")) ANIM.ar = "Jump_Loop";
    if (tem("Jump_Land")) ANIM.pouso = "Jump_Land";
    if (figura) raiz.remove(figura);
    mixer?.stopAllAction();
    figura = modelo.scene;
    figura.traverse((o) => {
      const m = o as TH.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });
    vestirBoneco(THREE, figura, qual, provando.traje, provando.traje === VIP_BLACK);
    acessorios = vestirAcessorios(THREE, figura, {
      ...provando,
      alturaCabeca: qual === "feminino" ? 1.81 : 1.83,
    });
    qualAtual = qual;
    // corridas feitas por código (as mesmas da praça)
    const idle = clipes.find((c) => c.name === ANIM.parado);
    if (idle && !clipes.some((c) => c.name === ANIM.andar))
      clipes = [...clipes, ...gerarPassos(THREE, figura, idle)];
    raiz.add(figura);
    mixer = new THREE.AnimationMixer(figura);
    mixer.addEventListener("finished", () => {
      escolhida = null;
    });
    atual = null;
    nomeAtual = "";
    tocarClipe(escolhida ?? ANIM.parado, { fade: 0 });
  };
  void montarBoneco("padrao");

  // ---------------- controle ----------------
  const corpo = criarCorpo(0, 4, 0, Math.PI);
  const teclas = new Set<string>();
  const toque = { lado: 0, frente: 0, correr: false };
  let querPular = false;
  let giro = 0;
  let inclina = 0.32;
  let distancia = 6.2;
  let rumo = Math.PI;
  let pousando = 0;

  const digitando = () => {
    const a = document.activeElement;
    return (
      !!a &&
      (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable)
    );
  };
  const aoApertar = (e: KeyboardEvent) => {
    if (digitando() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (
      e.code in DIRECOES ||
      e.code === "Space" ||
      e.code.startsWith("Shift") ||
      e.code === "KeyC"
    ) {
      e.preventDefault();
      teclas.add(e.code);
      if (e.code === "Space" && !e.repeat) querPular = true;
    }
  };
  const aoSoltar = (e: KeyboardEvent) => teclas.delete(e.code);
  const limpar = () => teclas.clear();
  window.addEventListener("keydown", aoApertar);
  window.addEventListener("keyup", aoSoltar);
  window.addEventListener("blur", limpar);

  const tela = renderer.domElement;
  let arrasto: { id: number; x: number; y: number } | null = null;
  const aoPegar = (e: PointerEvent) => {
    arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY };
    tela.setPointerCapture(e.pointerId);
  };
  const aoArrastar = (e: PointerEvent) => {
    if (!arrasto || arrasto.id !== e.pointerId) return;
    giro -= (e.clientX - arrasto.x) * 0.006;
    inclina = Math.max(0.05, Math.min(1.25, inclina + (e.clientY - arrasto.y) * 0.004));
    arrasto.x = e.clientX;
    arrasto.y = e.clientY;
  };
  const aoLargar = () => (arrasto = null);
  const aoRolar = (e: WheelEvent) => {
    e.preventDefault();
    distancia = Math.max(2.4, Math.min(22, distancia * (e.deltaY > 0 ? 1.12 : 0.89)));
  };
  const semMenu = (e: Event) => e.preventDefault();
  tela.addEventListener("pointerdown", aoPegar);
  tela.addEventListener("pointermove", aoArrastar);
  tela.addEventListener("pointerup", aoLargar);
  tela.addEventListener("pointercancel", aoLargar);
  tela.addEventListener("wheel", aoRolar, { passive: false });
  tela.addEventListener("contextmenu", semMenu);

  const medir = () => {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(medir);
  observador.observe(el);
  medir();

  // ---------------- quadro a quadro ----------------
  const olhar = new THREE.Vector3(0, 1.2, 4);
  let antes = performance.now();
  let quadro = 0;
  let conta = 0;
  let desde = antes;
  const laco = (agora: number) => {
    if (!vivo) return;
    quadro = requestAnimationFrame(laco);
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora;
    conta++;
    if (agora - desde >= 500) {
      aviso.fps(Math.round((conta * 1000) / (agora - desde)));
      conta = 0;
      desde = agora;
    }

    let lado = toque.lado;
    let frente = toque.frente;
    for (const t of teclas) {
      const d = DIRECOES[t];
      if (d) {
        lado += d[0];
        frente += d[1];
      }
    }
    const correr = toque.correr || teclas.has("ShiftLeft") || teclas.has("ShiftRight");
    const res = passo(corpo, { frente, lado, correr, pular: querPular }, giro, dt, mapa);
    querPular = false;
    const mexendo = res.andando || !corpo.noChao;
    if (mexendo) escolhida = null;
    if (res.aterrissou) pousando = 0.28;
    pousando = Math.max(0, pousando - dt);

    // qual animação: a do painel, ou a do que o boneco está fazendo
    if (escolhida) {
      /* fica a escolhida até acabar */
    } else if (!corpo.noChao) tocarClipe(ANIM.ar, { fade: 0.12 });
    else if (res.andando && teclas.has("KeyC") && res.velocidade > MOV.ANDAR * 0.8)
      tocarClipe(ANIM.desliza, { fade: 0.12 });
    else if (res.andando)
      tocarClipe(res.correndo ? ANIM.correr : ANIM.andar, {
        // a passada acompanha a velocidade de verdade (aqui 1 unidade = 1 m do boneco):
        // trote do pacote 1 = 5,36 m/s, disparada = 8,25 m/s
        ritmo: Math.max(
          0.5,
          res.velocidade /
            (ANIM.andar === "Jog_Fwd_Loop"
              ? res.correndo
                ? 8.25
                : 5.36
              : res.correndo
                ? MOV.CORRER
                : MOV.ANDAR),
        ),
        fade: 0.16,
      });
    else if (pousando > 0) tocarClipe(ANIM.pouso, { uma: true, fade: 0.08 });
    else tocarClipe(ANIM.parado, { fade: 0.22 });

    if (res.velocidade > 0.3) {
      const alvo = Math.atan2(corpo.vx, corpo.vz);
      let dif = alvo - rumo;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      rumo += dif * Math.min(1, dt * 12);
    }
    raiz.position.set(corpo.x, corpo.y, corpo.z);
    raiz.rotation.y = rumo;
    mixer?.update(dt);
    acessorios?.atualizar(
      agora / 1000,
      !corpo.noChao ? 0.7 : res.andando ? (res.correndo ? 1 : 0.6) : 0,
      dt,
    );
    natureza.atualizar(agora / 1000);

    // câmera em terceira pessoa, e o sol (com a sombra) acompanhando o boneco
    olhar.lerp(new THREE.Vector3(corpo.x, corpo.y + 1.25, corpo.z), Math.min(1, dt * 12));
    const plano = Math.cos(inclina) * distancia;
    camera.position.set(
      olhar.x + Math.sin(giro) * plano,
      Math.max(0.35, olhar.y + Math.sin(inclina) * distancia),
      olhar.z + Math.cos(giro) * plano,
    );
    camera.fov += (56 + (res.correndo ? 7 : 0) - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();
    camera.lookAt(olhar);
    luzes.sol.position.set(corpo.x + SOL.x * 60, SOL.y * 60, corpo.z + SOL.z * 60);
    luzes.sol.target.position.set(corpo.x, 0, corpo.z);
    renderer.render(cena, camera);
  };
  quadro = requestAnimationFrame(laco);
  // só em desenvolvimento: câmera pelo console (giro, inclinação, distância)
  if (import.meta.env.DEV)
    (window as unknown as { __teste?: unknown }).__teste = {
      camera: (g: number, i: number, d: number) => {
        giro = g;
        inclina = i;
        distancia = d;
      },
    };

  return {
    tocar(nome) {
      escolhida = nome;
      tocarClipe(nome, { uma: !nome.endsWith("_Loop"), fade: 0.2 });
      // de novo a mesma animação: recomeça do início
      atual?.reset().play();
    },
    cosmeticos(p) {
      provando = { ...p };
      void montarBoneco(qualAtual);
    },
    boneco(qual) {
      void montarBoneco(qual);
    },
    joystick(lado, frente, correr) {
      toque.lado = lado;
      toque.frente = frente;
      toque.correr = correr;
    },
    pular() {
      querPular = true;
    },
    descartar() {
      vivo = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoSoltar);
      window.removeEventListener("blur", limpar);
      mixer?.stopAllAction();
      for (const l of lixo) l.dispose();
      renderer.dispose();
      tela.remove();
    },
  };
}

/** O campo de teste em 3D, com o painel das animações por cima. */
export function Teste3D({ className }: { className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [anim, setAnim] = useState("");
  const [fps, setFps] = useState(0);
  const [boneco, setBoneco] = useState<QualBoneco>("padrao");
  const [aberto, setAberto] = useState(true);
  const [prova, setProva] = useState<Provando>(NADA);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let vivo = true;
    criarMotor(el, { anim: (n) => vivo && setAnim(n), fps: (n) => vivo && setFps(n) })
      .then((m) => {
        if (!vivo) return m.descartar();
        motor.current = m;
        setEstado("pronto");
      })
      .catch(() => vivo && setEstado("falhou"));
    return () => {
      vivo = false;
      motor.current?.descartar();
      motor.current = null;
    };
  }, []);

  const tecla =
    "rounded-md border border-white/25 bg-white/15 px-1.5 py-px font-mono text-[10.5px] font-semibold";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-black",
        className,
      )}
    >
      <div ref={caixa} className="absolute inset-0" />
      {estado !== "pronto" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
          {estado === "falhou"
            ? "Não consegui abrir o 3D neste aparelho."
            : "Carregando o campo de teste…"}
        </div>
      )}

      {/* dica das teclas e o que está tocando */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1.5 text-[11.5px] text-white backdrop-blur-md">
        <span className="hidden items-center gap-1 sm:flex">
          <span className={tecla}>W A S D</span> andar
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <span className={tecla}>Shift</span> correr
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <span className={tecla}>Espaço</span> pular
        </span>
        <span className="hidden items-center gap-1 md:flex">
          <span className={tecla}>C</span> deslizar
        </span>
        <span className="text-white/60">{anim || "…"}</span>
        <span className="font-mono text-white/50">{fps} fps</span>
      </div>

      {/* painel: bonecos e animações */}
      <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[min(17rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/75 text-white backdrop-blur-md">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] font-semibold"
        >
          Bonecos e animações
          <span className="text-white/50">{aberto ? "–" : "+"}</span>
        </button>
        {aberto && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {LISTA_BONECOS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBoneco(b.id);
                    motor.current?.boneco(b.id);
                  }}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors",
                    boneco === b.id
                      ? "border-[#CE0E0E] bg-[#CE0E0E]/25 text-white"
                      : "border-white/12 bg-white/5 text-white/75 hover:bg-white/10",
                  )}
                >
                  {b.nome}
                </button>
              ))}
            </div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Provar cosméticos
            </p>
            {PROVADOR.map((g) => (
              <div key={g.espaco} className="mb-2">
                <p className="mb-1 text-[10px] text-white/40">{g.nome}</p>
                <div className="flex flex-wrap gap-1">
                  {g.itens.map((c) => {
                    const ativo = prova[g.espaco] === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={c.id}
                        onClick={() => {
                          const nova = { ...prova, [g.espaco]: ativo ? "" : c.id };
                          setProva(nova);
                          motor.current?.cosmeticos(nova);
                        }}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11.5px] transition-colors",
                          ativo
                            ? "border-amber-300 bg-amber-300/20 text-white"
                            : "border-white/10 bg-white/5 text-white/80 hover:bg-white/12",
                        )}
                      >
                        {c.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mb-3" />
            {GRUPOS_ANIMACAO.map((g) => (
              <div key={g.nome} className="mb-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {g.nome}
                </p>
                <div className="flex flex-wrap gap-1">
                  {g.itens.map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      title={id}
                      onClick={() => motor.current?.tocar(id)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11.5px] transition-colors",
                        anim === id
                          ? "border-[#CE0E0E] bg-[#CE0E0E]/25 text-white"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/12",
                      )}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ControlesDeToque
        ativo={estado === "pronto"}
        onJoystick={(lado, frente, correr) => motor.current?.joystick(lado, frente, correr)}
        onPular={() => motor.current?.pular()}
      />
    </div>
  );
}
