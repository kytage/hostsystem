import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type * as TH from "three";
import { cn } from "@/lib/utils";
import { peca, type Visual } from "@/lib/hoki";
import { crescimento, type Cultura } from "@/lib/hoki-itens";
import { criarMosquitos } from "./mosquitos";
import { criarShows, type PoseShow } from "./mundo-show";
import type { Show } from "@/lib/hoki-shows";
import type { Dupla, Par } from "@/lib/hoki-presenca";
import { criarMascote, type Reacao } from "./mascote";
import { ALTURA_BONECO, DURACAO_REACAO } from "./boneco";
/** O boneco de cada pessoa na praça (o HOKI com a roupa dela). */
type Boneco = ReturnType<typeof criarMascote>;
import { modeloLeve, type Modelo } from "./modelo";
import {
  corpoParado,
  criarCorpo,
  MOV,
  passo,
  type CorpoHoki,
  type EntradaMovimento,
  type MapaMovimento,
} from "@/lib/hoki-movimento";
import {
  deveEnviar,
  FLUXO,
  intervaloMinimo,
  prever,
  type AmostraMovimento,
  type TipoAmostra,
  type UltimoEnvio,
} from "@/lib/hoki-fluxo";
import { ASSENTO, criarMundo } from "./mundo-cena";
import { criarSiegeMundo, type EstadoSiege } from "./siege/siege-mundo";
import type { Kit } from "@/lib/siege/config";
import type { InicioPartida } from "@/lib/siege/rede";
import {
  ajustar,
  avancar,
  BANCOS,
  BERCO,
  CORETO,
  FONTE,
  POSTES,
  CANTEIROS,
  CHEGADA,
  CHUVEIRO,
  CENTRO_DO_COMERCIO,
  COMERCIO_NA_PRACA,
  CORREIO,
  AGUA_DA_PISCINA,
  MERGULHO,
  noEscorregador,
  alturaDoChao,
  ILHA_FAZENDAS,
  frenteDoBanco,
  livre,
  planejar,
  beiraDaFonte,
  naFonte,
  TERMOMETRO,
  TOP3,
  vagaDoBerco,
  type Ponto,
  corpoAndando,
  FRENTE_SIEGE,
} from "./mundo-mapa";
import { ALTURA_ARCO, LARGURA_ARCO, PROFUNDIDADE_ARCO, type QuadroRanking } from "./ranking-arco";
import {
  anoitecerLuzes,
  COR_NEVOA,
  COR_NEVOA_NOITE,
  montarLuzes,
  nivelDaNoite,
  prepararDesenho,
  SOL,
  texturaMancha,
} from "./luz";
import { ceu } from "./voxel";
import { mundoPausado } from "./mundo-pausa";
import { playSfx } from "@/lib/sfx";

/** Uma pessoa na praça. (x, z) é para onde ela está indo; `banco` é o banco onde vai sentar. */
export interface PessoaMundo {
  id: string;
  nome: string;
  /** Sigla do cargo (ex.: SUP), depois do nome. */
  tag?: string;
  /** Selo do nível (HOST FAZENDAS), antes do nome, com a cor que a pessoa equipou. */
  selo?: { nivel: number; fundo: string; texto: string } | null;
  status: string;
  visual: Visual;
  x: number;
  z: number;
  banco: number | null;
  /** Está deitado no berço, dormindo (ainda não acordou). */
  dorme?: boolean;
  /** Interação em dupla: esta pessoa acompanha a outra (mãos dadas, cavalinho, corda ou abraço). */
  par?: Par | null;
  /** Animação que fica repetindo até a pessoa parar (dança, aceno…). */
  anim?: Reacao | null;
  /** Sujo: mosquitos zumbindo em cima da cabeça. */
  sujo?: boolean;
  /** Com fome ou sede (10% ou menos): anda devagar. */
  lento?: boolean;
  souEu?: boolean;
}
export interface Mundo3DRef {
  /** Faz o HOKI de alguém executar um truque (acenar, dançar…). */
  truque(id: string, tipo: Reacao): void;
  /** Aproxima (negativo) ou afasta (positivo) a câmera. */
  zoom(delta: number): void;
  /** Começa um evento do Founder daqui a `atrasoMs` (todos na praça participam). */
  iniciarShow(show: Show, atrasoMs: number): void;
  /** Há um evento rodando agora? */
  showRodando(): boolean;
  /** Joystick da tela de toque: -1 a 1 para o lado e para a frente; `correr` com o dedo todo para fora. */
  joystick(lado: number, frente: number, correr: boolean): void;
  /** Botão de pular da tela de toque. */
  pular(): void;
  /** Soco (botão direito ou botão de soco no celular). Ainda sem dano. */
  socar(): void;
  /** HOST SIEGE: começa o treino (este computador é o dono da partida). */
  siegeTreino(): void;
  /** HOST SIEGE: começa uma partida em rede (fila pública ou sala privada). */
  siegeRede(m: InicioPartida): void;
  /** HOST SIEGE: sai da partida e volta para a frente do portal. */
  siegeSair(): void;
  /** HOST SIEGE: escolhe o kit (na preparação na hora; na partida, no próximo respawn). */
  siegeKit(kit: Kit): boolean;
  /** Leva o meu boneco direto para (x, z). Falso se ele estiver dormindo. */
  teleportar(x: number, z: number): boolean;
  /** Uma amostra do movimento contínuo de outra pessoa (andar com o teclado, correr, pular). */
  movimento(id: string, amostra: AmostraMovimento): void;
}
interface Eventos {
  onChao(p: Ponto): void;
  onBanco(i: number): void;
  onPessoa(id: string): void;
  /** Clicou no termômetro (o totem ou o símbolo que pisca em cima dele). */
  onTermometro(): void;
  /** O meu HOKI terminou de andar e parou neste ponto. */
  onParou(p: Ponto): void;
  /** Clicou num lugar da fazenda (canteiro, árvore, bicho ou a mina de água). */
  onCanteiro(i: number): void;
  /** Clicou na caixa do correio (ou no envelope em cima dela). */
  onCorreio(): void;
  /** Clicou na barraca do Comércio (ou na moedinha em cima dela). */
  onComercio?(): void;
  /** Clicou no balanço do letreiro HOST. */
  onBalanco?(): void;
  /** Recado curto de um evento da praça (quem explodiu, quem venceu, "espere acabar"…). */
  onAviso?(texto: string): void;
  /** O meu HOKI começou a andar pelo teclado ou joystick (larga o banco, a dança, a dupla…). */
  onMover?(p: Ponto): void;
  /** Uma amostra do meu movimento para mandar aos outros. */
  onFluxo?(amostra: AmostraMovimento): void;
  /** Dei um soco (para mostrar aos outros). */
  onSoco?(): void;
  /** Uma animação minha que os outros também devem ver (ataques do HOST SIEGE). */
  onTruque?(tipo: Reacao): void;
  /** Estado do HOST SIEGE para a tela (várias vezes por segundo). */
  onSiege?(e: EstadoSiege): void;
  /** Quantos outros estão com a praça aberta (para escolher o ritmo do envio). */
  olhando?(): number;
}

const ESCALA = 0.62; // tamanho do HOKI no mundo (1 = um bloco do chão)
/** Número (na lista de bancos) do primeiro lugar do balanço do letreiro. */
/** Quanto dura cada animação, em segundos (para repetir as que ficam rodando). */
const DURACAO: Partial<Record<Reacao, number>> = {
  acenar: 2,
  girar: 1,
  rolar: 1.2,
  dancar: 3,
  dancinha: 4,
  rebolar: 3.6,
  robo: 3.6,
  onda: 3,
  pulinhos: 2.6,
  disco: 3.8,
  correr: 2.6,
  mortal: 1.1,
  cumprimentar: 1.7,
  festa: 1.6,
};
/**
 * Proporção do andar: o boneco tem 1,83 m e, na praça, ALTURA_BONECO × ESCALA blocos.
 * Assim ele anda, corre e pula exatamente como na aba TESTE (onde 1 unidade = 1 m).
 */
const PROPORCAO = (ALTURA_BONECO * ESCALA) / 1.83;
const VELOCIDADE = MOV.ANDAR * PROPORCAO; // blocos por segundo (o mesmo trote do teclado)
/** Abertura da câmera na vista do RANKING (mais aberta, para caber o arco inteiro de perto). */
const FOV_RANKING = 50;
/** Abertura da câmera de perto, em terceira pessoa (de longe fica a FOV, que mostra a ilha inteira). */
const FOV_PERTO = 70;
/** Quanto a câmera abre a mais quando o HOKI corre (sensação de velocidade). */
const FOV_CORRENDO = 8;
/** Inclinação inicial da câmera de perto (radianos): um pouco acima do ombro. */
const ALTURA_PERTO = 0.3;
/** Quanto a câmera de perto sai para a direita do boneco (por cima do ombro). */
const OMBRO = 0.55;
/** Arredonda como a rede (2 casas), para o destino que volta da praça bater com o do motor. */
const arredonda = (v: number) => Math.round(v * 100) / 100;
/** O mapa da praça para o controle direto (livre para andar e altura do chão). */
const MAPA_MOV: MapaMovimento = { livre, chao: alturaDoChao };
/** Teclas de andar (pela posição física da tecla, vale em qualquer teclado): [frente, lado]. */
const DIRECOES: Record<string, readonly [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};
/** Altura (px, a partir de baixo) dos botões que aparecem na vista do RANKING. */
const BOTOES_DA_VISTA = 96;
// classes dos rótulos (ficam aqui, por extenso, para o Tailwind gerar o CSS)
const CL_ROTULO = "absolute left-0 top-0 flex flex-col items-center will-change-transform";
const CL_FALA =
  "mb-1 w-max max-w-[180px] break-words rounded-2xl rounded-bl-sm bg-white px-2.5 py-1 text-[11px] font-medium leading-snug text-black shadow-[0_6px_16px_rgba(0,0,0,0.45)]";
const CL_NOME = "max-w-[150px] truncate rounded-full px-1.5 py-px text-[10px] font-medium";
const CL_STATUS =
  "mt-0.5 max-w-[130px] truncate rounded-full bg-black/75 px-1.5 py-px text-[9.5px] font-medium text-red-400";

interface Avatar {
  id: string;
  souEu: boolean;
  /** Com fome ou sede: anda devagar. */
  lento: boolean;
  grupo: TH.Group;
  /** O boneco: o HOKI (mascote) ou a figura exclusiva (GLB). */
  mascote: Boneco;
  sombra: TH.Mesh;
  chave: string;
  /** Onde ele está na caminhada. */
  pos: Ponto;
  /** Onde aparece na tela (acompanha `pos`, ou o assento quando está sentado). */
  mostra: { x: number; y: number; z: number };
  rota: Ponto[];
  alvo: { x: number; z: number; banco: number | null };
  sentado: boolean;
  /** Deitado no berço, e em qual vaga. */
  dorme: boolean;
  vaga: number;
  /** Quando começou a acordar (levanta, pula para o escorregador, desce e pousa). */
  acorda: number | null;
  /** Dupla em andamento (esta pessoa é quem acompanha) e se está andando neste quadro. */
  par: Par | null;
  andando: boolean;
  /** Animação em repetição (até parar). */
  anim: Reacao | null;
  /** Já está sentado (colado) num lugar do balanço do letreiro. */
  noBalanco: boolean;
  mosquitos: ReturnType<typeof criarMosquitos> | null;
  rumo: number;
  truque: { tipo: Reacao; inicio: number } | null;
  /** Só o meu: controle direto (teclado/joystick). null quando anda pelo clique. */
  corpo: CorpoHoki | null;
  /** Os outros: última amostra do movimento contínuo e quando chegou (relógio local). */
  fluxo: { a: AmostraMovimento; quando: number } | null;
  /** Para a animação: correndo e no ar (pulo). */
  correndo: boolean;
  noAr: boolean;
  /** Estava no ar no quadro anterior (para o pouso dos outros). */
  noArAntes: boolean;
  /** Segundos que ainda faltam da animação de pouso. */
  pouso: number;
  rotulo: HTMLDivElement;
  nome: HTMLSpanElement;
  /** Plaquinha: [nível] nick [CARGO], e o status embaixo. */
  selo: HTMLSpanElement;
  tag: HTMLSpanElement;
  texto: HTMLSpanElement;
  status: HTMLSpanElement;
  fala: HTMLParagraphElement;
}

/** Motor do mundo 3D: cena, câmera, HOKIs andando e os rótulos por cima. */
function criarMotor(
  THREE: typeof TH,
  el: HTMLDivElement,
  camada: HTMLDivElement,
  modelo: Modelo | undefined,
  eventos: Eventos,
) {
  // (com transparência: na vitrine da tela do HOKI só a ilha aparece, por cima da página)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  // resolução que se ajusta sozinha ao FPS (começa em até 1,5x e vai até 1,75x se sobrar desempenho)
  const PR_MAXIMO = Math.min(1.75, window.devicePixelRatio || 1);
  let pixelRatio = Math.min(1.5, PR_MAXIMO);
  renderer.setPixelRatio(pixelRatio);
  prepararDesenho(THREE, renderer);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

  const cena = new THREE.Scene();
  const texCeu = ceu(THREE);
  cena.background = texCeu;
  cena.fog = new THREE.Fog(COR_NEVOA, 70, 190);
  // vitrine (tela do HOKI antes de acordar): só a ilha, flutuando sobre a página — sem céu,
  // nuvens, lua nem nomes; a névoa de baixo da ilha some no escuro da página
  let vitrine = false;
  const corDaVitrine = new THREE.Color(0x060606);
  const FOV = 40;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 260);

  const luzes = montarLuzes(THREE, cena, {
    alvo: { x: 8, y: 1, z: 0 },
    area: [38, 26],
    distancia: 60,
    mapa: 2048,
    maciez: 2.2,
  });

  const mundo = criarMundo(THREE);
  cena.add(mundo.grupo);
  // HOST SIEGE: a arena fica longe (fora da vista); o motor dele roda junto com a praça
  let siegeTravado = false;
  let siegeFator = 1;
  const siege = criarSiegeMundo(THREE, cena, {
    eu: () => {
      const a = [...avatares.values()].find((x) => x.souEu);
      if (!a) return null;
      return {
        id: a.id,
        nome: a.nome.textContent || "",
        x: a.mostra.x,
        z: a.mostra.z,
        y: a.corpo ? a.corpo.y : a.mostra.y,
        rumo: a.grupo.rotation.y,
      };
    },
    teleportar: (x, z) => void teleportarEu(x, z),
    mira: () => giroSuave + Math.PI,
    uniforme: (id, traje) => {
      if (traje) uniformes.set(id, traje);
      else uniformes.delete(id);
      const a = avatares.get(id);
      if (a) a.chave = "";
      setPessoas(ultimaLista);
    },
    controle: (travado, fator) => {
      siegeTravado = travado;
      siegeFator = fator;
    },
    animar: (reacao) => {
      for (const a of avatares.values())
        if (a.souEu) a.truque = { tipo: reacao, inicio: performance.now() };
      eventos.onTruque?.(reacao);
    },
    aoEstado: (e) => eventos.onSiege?.(e),
    virarCamera: (giro) => {
      giroCam = giro;
      giroSuave = giro;
      alturaCam = ALTURA_PERTO;
    },
  });
  let espia: number[] | null = null;

  // ---------------- noite: de tempos em tempos escurece, com estrelas e uma lua grande e clara ----------------
  // (o relógio da noite é o do mundo real e fica em luz.ts, para as duas telas do HOKI andarem juntas)
  const corDaNevoa = { dia: new THREE.Color(COR_NEVOA), noite: new THREE.Color(COR_NEVOA_NOITE) };
  // lua: um disco claro com crateras suaves e um halo grande em volta
  const telaLua = document.createElement("canvas");
  telaLua.width = telaLua.height = 256;
  const pl = telaLua.getContext("2d");
  if (pl) {
    const g = pl.createRadialGradient(108, 100, 10, 128, 128, 124);
    g.addColorStop(0, "#fffdf2");
    g.addColorStop(0.7, "#f3ecd2");
    g.addColorStop(1, "#d9cfae");
    pl.fillStyle = g;
    pl.beginPath();
    pl.arc(128, 128, 122, 0, Math.PI * 2);
    pl.fill();
    pl.fillStyle = "rgba(160,150,120,0.22)";
    for (const [x, y, r] of [
      [92, 88, 22],
      [158, 120, 30],
      [118, 168, 18],
      [176, 70, 12],
      [70, 148, 12],
      [150, 182, 10],
    ] as const) {
      pl.beginPath();
      pl.arc(x, y, r, 0, Math.PI * 2);
      pl.fill();
    }
  }
  const tLua = new THREE.CanvasTexture(telaLua);
  tLua.colorSpace = THREE.SRGBColorSpace;
  const telaHalo = document.createElement("canvas");
  telaHalo.width = telaHalo.height = 128;
  const ph = telaHalo.getContext("2d");
  if (ph) {
    const g = ph.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, "rgba(255,250,225,0.9)");
    g.addColorStop(0.3, "rgba(200,215,255,0.32)");
    g.addColorStop(1, "rgba(160,190,255,0)");
    ph.fillStyle = g;
    ph.fillRect(0, 0, 128, 128);
  }
  const tHalo = new THREE.CanvasTexture(telaHalo);
  const mLua = new THREE.SpriteMaterial({
    map: tLua,
    transparent: true,
    opacity: 0,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  });
  const mHalo = new THREE.SpriteMaterial({
    map: tHalo,
    transparent: true,
    opacity: 0,
    fog: false,
    toneMapped: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lua = new THREE.Sprite(mLua);
  const halo = new THREE.Sprite(mHalo);
  lua.position.set(-33, 8, -62);
  halo.position.set(-33, 8, -62.5);
  lua.scale.setScalar(11);
  halo.scale.setScalar(46);
  // estrelas: pontinhos espalhados no fundo do céu
  const gEstrelas = new THREE.BufferGeometry();
  const pontosDoCeu = new Float32Array(320 * 3);
  for (let i = 0; i < 320; i++) {
    const s1 = Math.sin(i * 127.1) * 43758.5453;
    const s2 = Math.sin(i * 311.7) * 43758.5453;
    const s3 = Math.sin(i * 74.7) * 43758.5453;
    pontosDoCeu[i * 3] = (s1 - Math.floor(s1) - 0.5) * 260;
    pontosDoCeu[i * 3 + 1] = -14 + (s2 - Math.floor(s2)) * 62;
    pontosDoCeu[i * 3 + 2] = -70 - (s3 - Math.floor(s3)) * 60;
  }
  gEstrelas.setAttribute("position", new THREE.BufferAttribute(pontosDoCeu, 3));
  const mEstrelas = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.7,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
    toneMapped: false,
  });
  const estrelas = new THREE.Points(gEstrelas, mEstrelas);
  estrelas.frustumCulled = false;
  estrelas.renderOrder = -2;
  halo.renderOrder = -1;
  cena.add(estrelas, halo, lua);
  let noiteAtual = -1;
  // holofote da noite (fica na cena o tempo todo, apagado de dia, para não recompilar os materiais)
  const holofote = new THREE.SpotLight(0xfff0d2, 0, 0, 0.36, 0.7, 0);
  cena.add(holofote, holofote.target);
  const tPoca = texturaMancha(THREE);
  const mPoca = new THREE.MeshBasicMaterial({
    map: tPoca,
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  // luzes da praça à noite: lampiões de verdade (sem sombra, para não pesar) nos pontos principais.
  // Ficam na cena desde o começo, apagados de dia, para não recompilar os materiais.
  const LAMPIOES: [number, number, number, number][] = [
    // x, altura, z, força
    [FONTE.x, 5.2, FONTE.z, 1.5],
    [FONTE.x + 9.4, 3.6, FONTE.z, 1],
    [FONTE.x - 9.4, 3.6, FONTE.z, 1],
    [FONTE.x, 3.6, FONTE.z + 9.4, 1],
    [FONTE.x, 3.6, FONTE.z - 9.4, 1],
    [FONTE.x, 3.4, FONTE.z + 13.5, 0.8],
    [CORETO.x, 4, CORETO.z, 0.8],
    [BERCO.x, BERCO.y + 3.4, BERCO.z, 0.8],
  ];
  const lampioes = LAMPIOES.map(([x, y, z, forca]) => {
    const luz = new THREE.PointLight(0xffd9a3, 0, 17, 1.6);
    luz.position.set(x, y, z);
    cena.add(luz);
    return { luz, forca };
  });
  // clarão quente no chão embaixo de cada poste (uma mancha de luz, bem leve de desenhar)
  const mClarao = new THREE.MeshBasicMaterial({
    map: tPoca,
    color: 0xffcf8f,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const gClarao = new THREE.PlaneGeometry(6.4, 6.4);
  gClarao.rotateX(-Math.PI / 2);
  const claroes = new THREE.Group();
  for (const p of POSTES) {
    const c = new THREE.Mesh(gClarao, mClarao);
    c.position.set(p.x, 0.05, p.z);
    c.renderOrder = 2;
    claroes.add(c);
  }
  claroes.visible = false;
  cena.add(claroes);
  const poca = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), mPoca);
  poca.rotation.x = -Math.PI / 2;
  poca.renderOrder = 3;
  poca.visible = false;
  cena.add(poca);
  const anoitecer = (v: number) => {
    if (Math.abs(v - noiteAtual) < 0.003) return;
    noiteAtual = v;
    // céu da noite mais claro (antes ficava quase preto)
    cena.backgroundIntensity = 1 - 0.72 * v;
    for (const l of lampioes) l.luz.intensity = v * 26 * l.forca;
    mClarao.opacity = v * 0.5;
    claroes.visible = v > 0.02;
    if (cena.fog) {
      if (vitrine) cena.fog.color.copy(corDaVitrine);
      else cena.fog.color.copy(corDaNevoa.dia).lerp(corDaNevoa.noite, v);
    }
    anoitecerLuzes(luzes, v);
    mLua.opacity = v;
    mHalo.opacity = v * 0.95;
    mEstrelas.opacity = v * 0.9;
    lua.visible = halo.visible = estrelas.visible = v > 0.01 && !vitrine;
    mundo.noite(v);
  };

  // marca no chão para onde você mandou o seu HOKI ir
  const gMarca = new THREE.RingGeometry(0.28, 0.42, 28);
  const mMarca = new THREE.MeshBasicMaterial({
    color: 0xce0e0e,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const marca = new THREE.Mesh(gMarca, mMarca);
  marca.rotation.x = -Math.PI / 2;
  marca.visible = false;
  cena.add(marca);

  // sombra de contato embaixo de cada HOKI (uma mancha macia no chão)
  const tSombra = texturaMancha(THREE);
  const gSombra = new THREE.PlaneGeometry(2, 2);
  gSombra.rotateX(-Math.PI / 2);
  const mSombra = new THREE.MeshBasicMaterial({
    map: tSombra,
    color: 0x1d150c,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // símbolo do termômetro: pisca em cima do totem e mostra para quantas pessoas ainda dá para entregar emoji hoje
  let semBlip = false;
  const blip = document.createElement("div");
  blip.className = CL_ROTULO;
  blip.innerHTML =
    '<span class="relative grid size-6 place-items-center">' +
    '<span class="absolute inset-0 animate-ping rounded-full bg-[#e5231b] opacity-60"></span>' +
    '<span class="relative grid size-6 place-items-center rounded-full border-[1.5px] border-white bg-[#e5231b] text-white shadow-[0_4px_12px_rgba(229,35,27,0.75)]">' +
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>' +
    "</span>" +
    '<span data-n hidden class="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-white px-[3px] text-[8px] font-bold leading-none text-black"></span>' +
    "</span>";
  camada.appendChild(blip);
  const blipN = blip.querySelector<HTMLSpanElement>("[data-n]");
  /** Onde o símbolo está na tela (para o clique). */
  const blipTela = { x: 0, y: 0, visivel: false };
  const noTermometro = (px: number, py: number) =>
    blipTela.visivel && Math.hypot(blipTela.x - px, blipTela.y - 12 - py) < 22;

  // ---------------- fazenda: o que cresce em cada lugar (blocos que brotam, crescem e somem na colheita) ----------------
  // cada cultura são uns poucos blocos: [dx, y, dz, largura, altura, fundura, cor]
  type BlocoDePlanta = [number, number, number, number, number, number, number];
  const VERDE = 0x4f9c35;
  const FRUTA = (cor: number): BlocoDePlanta[] => [
    [0.45, 1.7, 0.4, 0.2, 0.2, 0.2, cor],
    [-0.4, 2.0, 0.45, 0.2, 0.2, 0.2, cor],
    [0.1, 2.3, 0.6, 0.2, 0.2, 0.2, cor],
  ];
  const PLANTAS: Record<Cultura, BlocoDePlanta[]> = {
    milho: [
      [0, 0, 0, 0.14, 1.0, 0.14, VERDE],
      [0.13, 0.5, 0, 0.14, 0.32, 0.14, 0xf4d03f],
    ],
    cenoura: [
      [0, 0, 0, 0.18, 0.16, 0.18, 0xf08a24],
      [0, 0.16, 0, 0.3, 0.26, 0.3, 0x58a83b],
    ],
    tomate: [
      [0, 0, 0, 0.42, 0.5, 0.42, VERDE],
      [0.17, 0.3, 0.15, 0.15, 0.15, 0.15, 0xe5231b],
      [-0.15, 0.16, -0.1, 0.15, 0.15, 0.15, 0xe5231b],
    ],
    batata: [
      [0, 0, 0, 0.44, 0.26, 0.44, 0x58a83b],
      [0.22, 0, 0.2, 0.2, 0.13, 0.16, 0xb98b5a],
    ],
    morango: [
      [0, 0, 0, 0.38, 0.2, 0.38, 0x58a83b],
      [0.15, 0.12, 0.13, 0.11, 0.11, 0.11, 0xe5231b],
      [-0.13, 0.1, -0.1, 0.11, 0.11, 0.11, 0xe5231b],
    ],
    abobora: [
      [0, 0, 0, 0.62, 0.44, 0.62, 0xf08a24],
      [0, 0.44, 0, 0.1, 0.12, 0.1, VERDE],
    ],
    melancia: [
      [0, 0, 0, 0.72, 0.42, 0.52, 0x2f8f3a],
      [0, 0.14, 0, 0.74, 0.1, 0.54, 0x1f6a2a],
    ],
    uva: [
      [0, 0.6, 0, 0.52, 0.3, 0.32, VERDE],
      [0, 0.34, 0.12, 0.22, 0.28, 0.16, 0x7b3fa0],
    ],
    maca: FRUTA(0xe5231b),
    laranja: FRUTA(0xf08a24),
    banana: [
      [0.2, 1.9, 0.2, 0.16, 0.4, 0.16, 0xf4d03f],
      [0.36, 1.85, 0.12, 0.16, 0.4, 0.16, 0xf4d03f],
      [0.28, 1.8, 0.34, 0.16, 0.4, 0.16, 0xf4d03f],
    ],
    coco: [
      [0.22, 2.0, 0.2, 0.26, 0.26, 0.26, 0x7a5230],
      [-0.2, 2.0, 0.22, 0.26, 0.26, 0.26, 0x7a5230],
    ],
    cafe: [
      [0.3, 0.3, 0.3, 0.12, 0.12, 0.12, 0xe5231b],
      [-0.28, 0.45, 0.32, 0.12, 0.12, 0.12, 0xe5231b],
      [0.05, 0.6, 0.38, 0.12, 0.12, 0.12, 0xe5231b],
    ],
    ovo: [
      [0.85, 0, -0.3, 0.16, 0.2, 0.16, 0xfff6e0],
      [1.05, 0, -0.1, 0.16, 0.2, 0.16, 0xfff6e0],
    ],
    leite: [
      [0.2, 0, 0.7, 0.2, 0.36, 0.2, 0xffffff],
      [0.2, 0.36, 0.7, 0.12, 0.07, 0.12, 0xe5231b],
    ],
    agua: [[0, 0.75, 0, 0.26, 0.34, 0.26, 0x7fd0ff]],
    // flores em cima do vaso (o vaso tem 0,44 de altura)
    rosa: [
      [0, 0.44, 0, 0.06, 0.42, 0.06, VERDE],
      [0, 0.82, 0, 0.2, 0.18, 0.2, 0xd8281f],
      [0.12, 0.6, 0, 0.14, 0.06, 0.08, VERDE],
    ],
    girassol: [
      [0, 0.44, 0, 0.07, 0.62, 0.07, VERDE],
      [0, 1.0, 0.02, 0.36, 0.36, 0.08, 0xf4c430],
      [0, 1.08, 0.06, 0.14, 0.14, 0.06, 0x6b4526],
    ],
    tulipa: [
      [0, 0.44, 0, 0.06, 0.38, 0.06, VERDE],
      [0, 0.78, 0, 0.18, 0.22, 0.18, 0xff8fc8],
      [-0.11, 0.56, 0, 0.12, 0.06, 0.08, VERDE],
    ],
    // doces em cima do carrinho (o tampo fica a 0,8)
    chocolate: [
      [-0.15, 0.8, 0, 0.3, 0.08, 0.2, 0x5a3220],
      [0.18, 0.8, 0.05, 0.22, 0.08, 0.16, 0x7a4a2c],
    ],
    bala: [
      [-0.2, 0.8, 0, 0.12, 0.12, 0.12, 0xff5a8a],
      [0, 0.8, 0.08, 0.12, 0.12, 0.12, 0x5ad8ff],
      [0.2, 0.8, -0.04, 0.12, 0.12, 0.12, 0xffd84a],
    ],
    // ursinho sentado na prateleira (o tampo fica a 0,96)
    ursinho: [
      [0, 0.96, 0, 0.3, 0.28, 0.22, 0xb07a4a],
      [0, 1.24, 0, 0.24, 0.22, 0.2, 0xb07a4a],
      [-0.1, 1.44, 0, 0.08, 0.08, 0.06, 0x8a5a34],
      [0.1, 1.44, 0, 0.08, 0.08, 0.06, 0x8a5a34],
    ],
  };
  /** Na horta a planta vai crescendo aos poucos; nas árvores, nos bichos e na mina o fruto só aparece quando está pronto. */
  const DA_HORTA = new Set<Cultura>([
    "milho",
    "cenoura",
    "tomate",
    "batata",
    "morango",
    "abobora",
    "melancia",
    "uva",
    "rosa",
    "girassol",
    "tulipa",
  ]);
  const gPlanta = new THREE.BoxGeometry(1, 1, 1);
  gPlanta.translate(0, 0.5, 0);
  const mPlanta = new THREE.MeshLambertMaterial();
  const totalDeBlocos = CANTEIROS.reduce((n, c) => n + PLANTAS[c.cultura].length, 0);
  const plantas = new THREE.InstancedMesh(gPlanta, mPlanta, totalDeBlocos);
  plantas.frustumCulled = false;
  {
    const tinta = new THREE.Color();
    let k = 0;
    for (const c of CANTEIROS)
      for (const b of PLANTAS[c.cultura]) plantas.setColorAt(k++, tinta.setHex(b[6]));
  }
  cena.add(plantas);
  let colheitas: Record<string, number> = {};
  const tamanhos = new Float32Array(CANTEIROS.length).fill(-1);
  const auxPlanta = new THREE.Object3D();
  let proximaRega = 0;
  /** Recalcula o tamanho de cada planta pelo tempo desde a última colheita (só mexe nas que mudaram). */
  const regar = (agora: number) => {
    if (agora < proximaRega) return;
    proximaRega = agora + 400;
    const relogio = Date.now();
    let mudou = false;
    let k = 0;
    CANTEIROS.forEach((c, i) => {
      const p = crescimento(c.cultura, colheitas[String(i)], relogio);
      const g = DA_HORTA.has(c.cultura)
        ? Math.pow(Math.max(0, (p - 0.1) / 0.9), 0.7)
        : p >= 1
          ? 1
          : 0;
      const blocos = PLANTAS[c.cultura];
      if (Math.abs(g - tamanhos[i]!) > 0.01) {
        tamanhos[i] = g;
        mudou = true;
        blocos.forEach((b, n) => {
          auxPlanta.position.set(c.x + b[0] * g, b[1] * g, c.z + b[2] * g);
          auxPlanta.scale.set(b[3] * g, b[4] * g, b[5] * g);
          auxPlanta.updateMatrix();
          plantas.setMatrixAt(k + n, auxPlanta.matrix);
        });
      }
      k += blocos.length;
    });
    if (mudou) plantas.instanceMatrix.needsUpdate = true;
  };

  // envelope em cima da caixa do correio, com quantas cartas não lidas
  const blipCarta = document.createElement("div");
  blipCarta.className = CL_ROTULO;
  blipCarta.innerHTML =
    '<span class="relative grid size-6 place-items-center">' +
    '<span data-pisca class="absolute inset-0 hidden animate-ping rounded-full bg-[#e5231b] opacity-60"></span>' +
    '<span class="relative grid size-6 place-items-center rounded-full border-[1.5px] border-white bg-[#e5231b] text-white shadow-[0_4px_12px_rgba(229,35,27,0.6)]">' +
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>' +
    "</span>" +
    '<span data-n hidden class="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9.5px] font-bold leading-none text-black shadow-[0_2px_6px_rgba(0,0,0,0.5)]"></span>' +
    "</span>";
  camada.appendChild(blipCarta);
  const cartaN = blipCarta.querySelector<HTMLSpanElement>("[data-n]");
  const cartaPisca = blipCarta.querySelector<HTMLSpanElement>("[data-pisca]");
  const cartaTela = { x: 0, y: 0, visivel: false };
  const noCorreio = (px: number, py: number) =>
    cartaTela.visivel && Math.hypot(cartaTela.x - px, cartaTela.y - 12 - py) < 22;
  // moedinha em cima da barraca do Comércio (clicar leva o HOKI até o balcão)
  const blipComercio = document.createElement("div");
  blipComercio.className = CL_ROTULO;
  blipComercio.innerHTML =
    '<span class="relative grid size-6 place-items-center rounded-full border-[1.5px] border-white bg-black/85 text-white shadow-[0_4px_12px_rgba(0,0,0,0.55)]">' +
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg>' +
    '<span class="absolute -bottom-0.5 -right-1.5 size-2 rounded-full bg-[#e5231b] ring-2 ring-black"></span>' +
    "</span>";
  camada.appendChild(blipComercio);
  const comercioTela = { x: 0, y: 0, visivel: false };
  const noComercio = (px: number, py: number) =>
    COMERCIO_NA_PRACA &&
    comercioTela.visivel &&
    Math.hypot(comercioTela.x - px, comercioTela.y - 12 - py) < 22;

  const avatares = new Map<string, Avatar>();
  let dentro = false;
  // de perto, em terceira pessoa (a roda do mouse afasta até a ilha inteira)
  let zoomUsuario = 0.27;
  let zoom = 1;
  // vista do RANKING: em primeira pessoa, de frente para o arco (0 = normal, 1 = no arco)
  let vistaRanking = false;
  let vista = 0;
  let fovAtual = FOV;
  const posRanking = new THREE.Vector3();
  const miraRanking = new THREE.Vector3();
  const mira = new THREE.Vector3();
  let distMax = 40;
  // câmera: ângulo em volta do HOKI (arrastando o mouse) e altura do olhar
  const ALTURA_PADRAO = 0.512;
  let giroCam = 0;
  let alturaCam = ALTURA_PERTO;
  // a câmera de verdade persegue o giro e a altura pedidos (dá um peso leve, sem atraso grande)
  let giroSuave = 0;
  let alturaSuave = ALTURA_PERTO;
  let correrSuave = 0;

  // ---------------- controle direto: teclado (WASD/setas, Shift, Espaço) e joystick da tela ----------------
  const teclas = new Set<string>();
  let pedidoPulo = false;
  const joy = { lado: 0, frente: 0, correr: false };
  const entrada: EntradaMovimento = { frente: 0, lado: 0, correr: false, pular: false };
  const digitando = (alvo: EventTarget | null) =>
    alvo instanceof HTMLElement &&
    !!alvo.closest("input, textarea, select, [contenteditable='true']");
  /** Teclas valem: dentro da praça, fora da vista do ranking, sem janela aberta e com a praça na tela. */
  const podeTeclar = () =>
    dentro && !vistaRanking && !mundoPausado() && !document.querySelector("[role='dialog']");
  const soltarTudo = () => {
    teclas.clear();
    pedidoPulo = false;
  };
  const aoApertar = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || digitando(e.target)) return;
    if (e.code === "F3") {
      // F3 mostra ou esconde o contador de FPS
      e.preventDefault();
      alternarFps();
      return;
    }
    const dir = DIRECOES[e.code];
    const shift = e.code === "ShiftLeft" || e.code === "ShiftRight";
    const espaco = e.code === "Space";
    if ((!dir && !shift && !espaco) || !podeTeclar()) return;
    // o Espaço não "clica" o último botão apertado e as setas não rolam a página
    if (dir || espaco) e.preventDefault();
    if (espaco && !e.repeat) pedidoPulo = true;
    teclas.add(e.code);
  };
  const aoLargarTecla = (e: KeyboardEvent) => {
    teclas.delete(e.code);
    if (e.code === "Space" && podeTeclar() && !digitando(e.target)) e.preventDefault();
  };
  window.addEventListener("keydown", aoApertar);
  window.addEventListener("keyup", aoLargarTecla);
  // perdeu o foco (Alt+Tab, outra janela): solta tudo, senão a tecla fica "presa"
  window.addEventListener("blur", soltarTudo);
  /** Junta teclado e joystick na entrada deste quadro (o pulo vale uma vez só). */
  const lerEntrada = () => {
    let f = joy.frente;
    let l = joy.lado;
    for (const c of teclas) {
      const d = DIRECOES[c];
      if (d) {
        f += d[0];
        l += d[1];
      }
    }
    entrada.frente = Math.max(-1, Math.min(1, f));
    entrada.lado = Math.max(-1, Math.min(1, l));
    entrada.correr = teclas.has("ShiftLeft") || teclas.has("ShiftRight") || joy.correr;
    entrada.pular = pedidoPulo;
    pedidoPulo = false;
    return entrada;
  };

  // ---------------- movimento contínuo pela rede ----------------
  let ultimoEnvio: UltimoEnvio | null = null;
  let sequencia = 0;
  // quantos estão olhando a praça: lido a cada 2 s (ler a presença a cada quadro custa à toa)
  let olhandoAgora = 0;
  let olhandoLido = -Infinity;
  const quantosOlham = (agoraMs: number) => {
    if (agoraMs - olhandoLido > 2000) {
      olhandoAgora = eventos.olhando?.() ?? 0;
      olhandoLido = agoraMs;
    }
    return olhandoAgora;
  };
  /** Manda uma amostra do meu movimento quando vale a pena (começou, virou, pulou, parou ou passou 1 s). */
  const enviarMovimento = (a: Avatar, k: TipoAmostra, forcar: boolean) => {
    if (!eventos.onFluxo) return;
    const vx = a.corpo?.vx ?? 0;
    const vz = a.corpo?.vz ?? 0;
    const agoraMs = performance.now();
    if (
      !forcar &&
      !deveEnviar(ultimoEnvio, { vx, vz, k }, agoraMs, intervaloMinimo(quantosOlham(agoraMs)))
    )
      return;
    sequencia += 1;
    eventos.onFluxo({
      x: a.pos.x,
      z: a.pos.z,
      y: a.mostra.y,
      r: a.rumo,
      vx: k === "para" ? 0 : vx,
      vz: k === "para" ? 0 : vz,
      vy: k === "pula" ? (a.corpo?.vy ?? 0) : 0,
      k,
      s: sequencia,
    });
    ultimoEnvio = { quando: agoraMs, vx, vz, k };
  };

  // ---------------- contador de FPS (F3) e resolução que se ajusta ----------------
  let mostrarFps = (() => {
    try {
      return localStorage.getItem("hoki-fps") === "1";
    } catch {
      return false;
    }
  })();
  const fpsEl = document.createElement("div");
  fpsEl.className =
    "pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-white";
  fpsEl.hidden = !mostrarFps;
  camada.appendChild(fpsEl);
  function alternarFps() {
    mostrarFps = !mostrarFps;
    fpsEl.hidden = !mostrarFps;
    try {
      localStorage.setItem("hoki-fps", mostrarFps ? "1" : "0");
    } catch {
      // sem armazenamento: vale só nesta tela
    }
  }
  let quadrosContados = 0;
  let inicioDaConta = performance.now();
  let ultimoAjuste = 0;
  /** Conta os quadros desenhados; a cada segundo mostra o FPS e ajusta a resolução se precisar. */
  const contarQuadro = (agora: number) => {
    quadrosContados += 1;
    const passou = agora - inicioDaConta;
    if (passou < 1000) return;
    const fps = (quadrosContados * 1000) / passou;
    quadrosContados = 0;
    inicioDaConta = agora;
    // a praça ficou pausada no meio da conta: não vale para decidir nada
    if (passou > 2500) return;
    if (mostrarFps) fpsEl.textContent = `${Math.round(fps)} FPS · ${pixelRatio.toFixed(2)}x`;
    if (agora - ultimoAjuste < 4000) return;
    if (fps < 48 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
    } else if (fps > 58 && pixelRatio < PR_MAXIMO) {
      pixelRatio = Math.min(PR_MAXIMO, pixelRatio + 0.25);
    } else return;
    ultimoAjuste = agora;
    renderer.setPixelRatio(pixelRatio);
    medir();
  };
  // o centro da vista fica um pouco a leste, para a ilha e o escritório caberem juntos
  const CENTRO = new THREE.Vector3(0, 2.2, 1);
  const olhar = CENTRO.clone();
  const vetor = new THREE.Vector3();

  const medir = () => {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // de longe, a ilha inteira precisa caber na largura
    // (na vitrine ela fica mais longe: a ilha inteira aparece solta, sem encostar nas beiradas)
    distMax =
      Math.max(66, 44 / (Math.tan((FOV * Math.PI) / 360) * camera.aspect)) * (vitrine ? 1.32 : 1);
  };
  const observador = new ResizeObserver(medir);
  observador.observe(el);
  medir();

  // ped exclusivo (traje "Bonne"): a versão leve só é carregada quando alguém na praça usa
  let pedLeve: Modelo | undefined;
  let pedindoPed = false;
  let ultimaLista: PessoaMundo[] = [];
  /** Chave do boneco: muda quando a aparência muda. */
  /** Uniforme do mini-game por cima do look (por pessoa). */
  const uniformes = new Map<string, string>();
  const visualDe = (p: PessoaMundo) => {
    const u = uniformes.get(p.id);
    return u ? { ...p.visual, traje: u } : p.visual;
  };
  const chaveDe = (p: PessoaMundo) => JSON.stringify(visualDe(p));
  const montar = (p: PessoaMundo): Boneco => {
    const visual = visualDe(p);
    if (peca(visual.traje)?.ped && !pedLeve && !pedindoPed) {
      pedindoPed = true;
      void modeloLeve(THREE, "bonne").then((m) => {
        if (!m) return;
        pedLeve = m;
        // refaz quem estava esperando o ped (até aqui apareceu como o HOKI clássico)
        for (const a of avatares.values()) a.chave = "";
        setPessoas(ultimaLista);
      });
    }
    const m = criarMascote(THREE, visual, {
      modelo,
      ped: pedLeve,
      mundo: true,
    });
    m.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.material as TH.Material).transparent) o.castShadow = true;
    });
    return m;
  };
  const assento = (i: number) => {
    const b = BANCOS[i];
    if (!b) return null;
    // lugar do balanço do letreiro: o assento se mexe, então a posição vem do mundo a cada quadro
    return { x: b.x, y: ASSENTO, z: b.z, ang: b.ang, inclina: 0, balanco: false };
  };

  function criarAvatar(p: PessoaMundo): Avatar {
    const grupo = new THREE.Group();
    grupo.scale.setScalar(ESCALA);
    const mascote = montar(p);
    grupo.add(mascote.raiz);
    cena.add(grupo);
    const sombra = new THREE.Mesh(gSombra, mSombra);
    sombra.renderOrder = 2;
    cena.add(sombra);
    const rotulo = document.createElement("div");
    rotulo.className = CL_ROTULO;
    const fala = document.createElement("p");
    fala.className = CL_FALA;
    fala.hidden = true;
    const nome = document.createElement("span");
    nome.className = cn(CL_NOME, p.souEu ? "bg-white text-black" : "bg-black/70 text-white");
    const status = document.createElement("span");
    status.className = CL_STATUS;
    // plaquinha: [nível] nick [CARGO] (o nível é o do HOST FAZENDAS, com a cor que a pessoa equipou)
    const selo = document.createElement("span");
    selo.className = "mr-1 rounded-full px-1 text-[8.5px] font-extrabold tabular-nums";
    selo.hidden = true;
    const tag = document.createElement("span");
    tag.className =
      "ml-1 rounded-full bg-[#ce0e0e] px-1 text-[8.5px] font-bold tracking-wide text-white";
    const texto = document.createElement("span");
    nome.append(selo, texto, tag);
    rotulo.append(fala, nome, status);
    camada.appendChild(rotulo);
    const s = !p.dorme && p.banco !== null ? assento(p.banco) : null;
    const v = p.dorme ? vagaDoBerco(0) : undefined;
    return {
      id: p.id,
      souEu: !!p.souEu,
      lento: !!p.lento,
      grupo,
      mascote,
      sombra,
      chave: chaveDe(p),
      pos: s ? { x: s.x, z: s.z } : { x: p.x, z: p.z },
      mostra: v ? { ...v } : s ? { x: s.x, y: s.y, z: s.z } : { x: p.x, y: 0, z: p.z },
      rota: [],
      alvo: { x: p.x, z: p.z, banco: p.banco },
      sentado: !!s,
      dorme: !!p.dorme,
      vaga: 0,
      acorda: null,
      par: null,
      andando: false,
      anim: null,
      noBalanco: false,
      mosquitos: null,
      rumo: s ? s.ang : 0,
      truque: null,
      corpo: null,
      fluxo: null,
      correndo: false,
      noAr: false,
      noArAntes: false,
      pouso: 0,
      rotulo,
      nome,
      selo,
      tag,
      texto,
      status,
      fala,
    };
  }
  function removerAvatar(a: Avatar) {
    if (a.mosquitos) {
      cena.remove(a.mosquitos.pontos);
      a.mosquitos.descartar();
    }
    cena.remove(a.grupo, a.sombra);
    a.mascote.descartar();
    a.rotulo.remove();
    avatares.delete(a.id);
  }

  /** Recebe quem está na praça. Quem é novo aparece; quem mudou de destino começa a andar. */
  function setPessoas(lista: PessoaMundo[]) {
    ultimaLista = lista;
    const vivos = new Set<string>();
    // cada um que dorme ganha uma vaga do berço, sempre na mesma ordem para todo mundo
    const noBerco = lista
      .filter((p) => p.dorme)
      .map((p) => p.id)
      .sort();
    for (const p of lista) {
      vivos.add(p.id);
      let a = avatares.get(p.id);
      const vaga = Math.max(0, noBerco.indexOf(p.id));
      if (!a) {
        a = criarAvatar(p);
        avatares.set(p.id, a);
        if (a.dorme) {
          a.mostra = vagaDoBerco(vaga);
        }
      } else {
        const chave = chaveDe(p);
        if (chave !== a.chave) {
          a.grupo.remove(a.mascote.raiz);
          a.mascote.descartar();
          a.mascote = montar(p);
          a.grupo.add(a.mascote.raiz);
          a.chave = chave;
        }
        if (p.dorme && !a.dorme) {
          // voltou a dormir: deita de novo no berço
          a.dorme = true;
          a.acorda = null;
          a.rota = [];
          a.sentado = false;
          a.truque = null;
        } else if (!p.dorme && a.dorme) {
          // acordou: levanta, desce o escorregador e só então anda até onde quer ir
          a.dorme = false;
          a.acorda = performance.now();
          a.rota = [];
          a.sentado = false;
          a.alvo = { x: p.x, z: p.z, banco: p.banco };
        } else if (a.dorme || a.acorda !== null) {
          // dormindo ou descendo: só guarda para onde ir depois
          a.alvo = { x: p.x, z: p.z, banco: p.banco };
        } else if (a.alvo.x !== p.x || a.alvo.z !== p.z || a.alvo.banco !== p.banco) {
          const fluxoAndando =
            !a.souEu &&
            !!a.fluxo &&
            a.fluxo.a.k !== "para" &&
            performance.now() - a.fluxo.quando < FLUXO.VALIDADE_MS;
          if (fluxoAndando) {
            // andando pelo movimento contínuo: o destino só fica guardado (o fluxo manda na posição)
            a.alvo = { x: p.x, z: p.z, banco: p.banco };
          } else {
            // um clique no chão vale mais que o teclado: larga o controle direto e segue a rota
            if (a.souEu) a.corpo = null;
            a.fluxo = null;
            const banco = p.banco !== null ? BANCOS[p.banco] : undefined;
            const destino = banco ? frenteDoBanco(banco) : { x: p.x, z: p.z };
            a.pos = { x: a.mostra.x, z: a.mostra.z };
            a.rota = planejar(a.pos, destino);
            if (!a.rota.length) a.pos = destino; // sem caminho possível: aparece direto lá
            a.sentado = false;
            a.alvo = { x: p.x, z: p.z, banco: p.banco };
          }
        }
      }
      a.vaga = vaga;
      a.lento = !!p.lento && !p.dorme;
      a.par = p.dorme ? null : (p.par ?? null);
      // sujo: aparece (ou some) a nuvem de mosquitos
      if (p.sujo && !a.mosquitos) {
        a.mosquitos = criarMosquitos(THREE, 7, 0.36, 0.05);
        cena.add(a.mosquitos.pontos);
      } else if (!p.sujo && a.mosquitos) {
        cena.remove(a.mosquitos.pontos);
        a.mosquitos.descartar();
        a.mosquitos = null;
      }
      // animação em repetição: começa quando chega e para quando some
      const anim = p.dorme ? null : (p.anim ?? null);
      if (anim !== a.anim) {
        a.anim = anim;
        a.truque = anim ? { tipo: anim, inicio: performance.now() } : null;
      }
      a.texto.textContent = p.nome;
      a.tag.textContent = p.tag ?? "";
      a.tag.hidden = !p.tag;
      if (p.selo) {
        a.selo.textContent = String(p.selo.nivel);
        a.selo.style.background = p.selo.fundo;
        a.selo.style.color = p.selo.texto;
      }
      a.selo.hidden = !p.selo;
      a.status.textContent = p.dorme ? "💤 dormindo" : p.status;
      a.status.hidden = !p.dorme && !p.status;
      a.rotulo.style.opacity = p.dorme ? "0.82" : "";
    }
    for (const a of [...avatares.values()]) if (!vivos.has(a.id)) removerAvatar(a);
  }

  // ---------------- clique: escolher alguém, sentar num banco ou andar ----------------
  const raio = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  /** Onde o raio do clique cruza um plano horizontal na altura `y`. */
  const noPlano = (y: number): Ponto | null => {
    const d = raio.ray.direction;
    if (Math.abs(d.y) < 0.0001) return null;
    const t = (y - raio.ray.origin.y) / d.y;
    return t > 0 ? { x: raio.ray.origin.x + d.x * t, z: raio.ray.origin.z + d.z * t } : null;
  };
  /** Onde o clique cai no chão, contando a escadaria e a ilha alta da HOST FAZENDAS (testa do alto para baixo). */
  const noChao = (): Ponto | null => {
    for (let h = ILHA_FAZENDAS.y; h > 0.01; h -= 0.25) {
      const p = noPlano(h);
      if (p && Math.abs(alturaDoChao(p.x, p.z) - h) < 0.2) return p;
    }
    return noPlano(0);
  };
  let baixou: { x: number; y: number } | null = null;
  let ultimo: { x: number; y: number } | null = null;
  const aoBaixar = (e: PointerEvent) => {
    baixou = { x: e.clientX, y: e.clientY };
    ultimo = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
  };
  // soco: o meu boneco dá um gancho (sem dano por enquanto; a arena PvP vem depois)
  let ultimoSoco = 0;
  function teleportarEu(x: number, z: number) {
    for (const a of avatares.values()) {
      if (!a.souEu || a.dorme || a.acorda !== null) continue;
      const y = alturaDoChao(x, z);
      a.par = null;
      a.rota = [];
      a.sentado = false;
      a.truque = null;
      a.pos = { x, z };
      a.mostra.x = x;
      a.mostra.y = y;
      a.mostra.z = z;
      a.corpo = null;
      a.fluxo = null;
      a.alvo = { x, z, banco: null };
      // a câmera vai junto na hora (não atravessa o céu deslizando)
      olhar.set(x, y + 0.9, z);
      eventos.onMover?.({ x, z });
      enviarMovimento(a, "para", true);
      eventos.onParou({ x, z });
      return true;
    }
    return false;
  }

  const socar = () => {
    if (!dentro || siege.ativo()) return;
    const agora = performance.now();
    if (agora - ultimoSoco < 380) return;
    for (const a of avatares.values()) {
      if (!a.souEu || a.dorme || a.acorda !== null || a.sentado || a.par) continue;
      ultimoSoco = agora;
      a.truque = { tipo: "soco", inicio: agora };
      playSfx("soco");
      eventos.onSoco?.();
    }
  };
  // botão direito também gira a câmera: sem o menu do navegador por cima
  const semMenu = (e: MouseEvent) => {
    if (dentro) e.preventDefault();
  };
  // arrastar gira a câmera em volta do seu HOKI (e sobe/desce o olhar)
  const aoArrastar = (e: PointerEvent) => {
    if (!ultimo) {
      // sem arrastar: a mãozinha aparece em cima do termômetro
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      el.style.cursor =
        noTermometro(mx, my) || noCorreio(mx, my) || noComercio(mx, my) ? "pointer" : "";
      return;
    }
    if (!dentro) return;
    giroCam -= (e.clientX - ultimo.x) * 0.007;
    alturaCam = Math.max(0.04, Math.min(1.25, alturaCam + (e.clientY - ultimo.y) * 0.005));
    ultimo = { x: e.clientX, y: e.clientY };
  };
  const aoRolar = (e: WheelEvent) => {
    if (!dentro) return;
    e.preventDefault();
    zoomUsuario = Math.max(0, Math.min(1, zoomUsuario + e.deltaY * 0.001));
  };
  const aoSoltar = (e: PointerEvent) => {
    const inicio = baixou;
    baixou = null;
    ultimo = null;
    // botão direito: clique curto = soco (ainda sem dano); arrastando, continua girando a câmera
    if (e.button === 2) {
      if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) <= 8) socar();
      return;
    }
    // só o botão esquerdo (ou o dedo) clica
    if (e.button !== 0) return;
    // no HOST SIEGE o clique esquerdo é o ataque (não anda até o ponto)
    if (siege.ativo()) {
      if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) <= 8) siege.atacar();
      return;
    }
    if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 8) return;
    // preso num evento (ou congelado na batata quente): não anda até acabar
    for (const a of avatares.values())
      if (a.souEu) {
        const motivo = shows.ocupado(a.id, performance.now());
        if (motivo) {
          eventos.onAviso?.(motivo);
          return;
        }
      }
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    // o termômetro (o símbolo que pisca ou o próprio totem)?
    vetor.set(TERMOMETRO.x, 1.7, TERMOMETRO.z).project(camera);
    if (
      noTermometro(px, py) ||
      (vetor.z < 1 &&
        Math.hypot((vetor.x * 0.5 + 0.5) * r.width - px, (-vetor.y * 0.5 + 0.5) * r.height - py) <
          24)
    ) {
      eventos.onTermometro();
      return;
    }
    // a caixa do correio?
    vetor.set(CORREIO.x, 1.1, CORREIO.z).project(camera);
    if (
      noCorreio(px, py) ||
      (vetor.z < 1 &&
        Math.hypot((vetor.x * 0.5 + 0.5) * r.width - px, (-vetor.y * 0.5 + 0.5) * r.height - py) <
          22)
    ) {
      eventos.onCorreio();
      return;
    }
    // a moedinha em cima da barraca do Comércio?
    if (eventos.onComercio && noComercio(px, py)) {
      eventos.onComercio();
      return;
    }
    // alguém embaixo do clique?
    for (const a of avatares.values()) {
      if (a.souEu) continue;
      vetor.set(a.mostra.x, a.mostra.y + 0.6, a.mostra.z).project(camera);
      if (
        vetor.z < 1 &&
        Math.hypot((vetor.x * 0.5 + 0.5) * r.width - px, (-vetor.y * 0.5 + 0.5) * r.height - py) <
          34
      ) {
        eventos.onPessoa(a.id);
        return;
      }
    }
    // o balcão da barraca do Comércio?
    vetor.set(CENTRO_DO_COMERCIO.x, 1.4, CENTRO_DO_COMERCIO.z).project(camera);
    if (
      COMERCIO_NA_PRACA &&
      eventos.onComercio &&
      vetor.z < 1 &&
      Math.hypot((vetor.x * 0.5 + 0.5) * r.width - px, (-vetor.y * 0.5 + 0.5) * r.height - py) < 26
    ) {
      eventos.onComercio();
      return;
    }
    if (!dentro) return;
    ndc.set((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1);
    raio.setFromCamera(ndc, camera);
    const naAltura = noPlano(ASSENTO);
    if (naAltura) {
      const i = BANCOS.findIndex((b) => Math.hypot(b.x - naAltura.x, b.z - naAltura.z) < 0.85);
      if (i >= 0) {
        eventos.onBanco(i);
        return;
      }
    }
    // um lugar da fazenda (canteiro, árvore, bicho ou a mina)?
    for (let i = 0; i < CANTEIROS.length; i++) {
      const c = CANTEIROS[i]!;
      vetor.set(c.x, 0.5, c.z).project(camera);
      if (
        vetor.z < 1 &&
        Math.hypot((vetor.x * 0.5 + 0.5) * r.width - px, (-vetor.y * 0.5 + 0.5) * r.height - py) <
          20
      ) {
        eventos.onCanteiro(i);
        return;
      }
    }
    const chao = noChao();
    // clicou na fonte: vai até a beira da água pela passagem do canteiro mais perto
    const destino = chao && (naFonte(chao) ? beiraDaFonte(chao) : ajustar(chao));
    if (!destino) return;
    marca.position.set(destino.x, alturaDoChao(destino.x, destino.z) + 0.03, destino.z);
    marca.visible = true;
    eventos.onChao(destino);
  };
  el.addEventListener("pointerdown", aoBaixar);
  el.addEventListener("pointermove", aoArrastar);
  el.addEventListener("pointerup", aoSoltar);
  el.addEventListener("wheel", aoRolar, { passive: false });
  el.addEventListener("contextmenu", semMenu);

  let visivel = true;
  const olheiro = new IntersectionObserver((e) => (visivel = e[0]?.isIntersecting ?? true));
  olheiro.observe(el);
  // ---------------- eventos do Founder (trovão, avião, mergulho, batata quente…) ----------------
  const shows = criarShows(THREE, cena, el, {
    posicao: (id) => {
      const a = avatares.get(id);
      return a && !a.dorme && a.acorda === null ? { ...a.mostra } : null;
    },
    nome: (id) => avatares.get(id)?.texto.textContent || "alguém",
    aviso: (texto) => eventos.onAviso?.(texto),
    truque: (id, tipo) => {
      const a = avatares.get(id);
      if (a && !a.sentado && !a.dorme && a.acorda === null)
        a.truque = { tipo, inicio: performance.now() };
    },
  });
  /** Quem está sendo comandado por um evento neste momento (para devolver a caminhada quando acabar). */
  const noShow = new Set<string>();
  /** Coloca o HOKI na pose que o evento manda. */
  function aplicarShow(a: Avatar, sp: PoseShow, t: number, dt: number) {
    a.mostra.x = sp.x;
    a.mostra.y = sp.y;
    a.mostra.z = sp.z;
    a.pos = { x: sp.x, z: sp.z };
    a.rota = [];
    a.sentado = false;
    a.truque = null;
    a.andando = !!sp.andando;
    const giro = Math.atan2(
      Math.sin(sp.rumo - a.grupo.rotation.y),
      Math.cos(sp.rumo - a.grupo.rotation.y),
    );
    a.grupo.rotation.y += sp.congelado ? 0 : giro * (1 - Math.exp(-dt * 12));
    a.grupo.position.set(sp.x, sp.y, sp.z);
    a.grupo.scale.setScalar(ESCALA);
    if (!sp.congelado)
      a.mascote.atualizar({
        t,
        humor: "normal",
        reacao: sp.reacao ?? null,
        p: sp.p ?? 0,
        mouse: parado,
        calmo,
        andando: !!sp.andando,
        sentado: !!sp.sentado,
      });
    a.sombra.visible = sp.sombra !== false && sp.y < 0.05;
    a.sombra.position.set(sp.x, 0.035, sp.z);
    a.sombra.scale.set(0.5, 1, 0.5);
  }
  /** Fim do evento para esta pessoa: volta andando para onde estava indo. */
  function voltarDoShow(a: Avatar) {
    a.grupo.scale.setScalar(ESCALA);
    const aqui = ajustar({ x: a.mostra.x, z: a.mostra.z }) ?? { x: a.mostra.x, z: a.mostra.z };
    a.pos = aqui;
    const banco = a.alvo.banco !== null ? BANCOS[a.alvo.banco] : undefined;
    const destino = banco ? frenteDoBanco(banco) : { x: a.alvo.x, z: a.alvo.z };
    a.rota = planejar(a.pos, destino);
    if (!a.rota.length) a.pos = destino;
    a.sentado = false;
    a.truque = null;
  }

  const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const parado = { x: 0, y: 0 };
  let antes = performance.now();
  let raf = 0;

  /** O outro da dupla, se der para fazer a interação agora (acordado, na praça e sem acompanhar ninguém). */
  const parceiro = (a: Avatar) => {
    const b = a.par ? avatares.get(a.par.com) : undefined;
    return b && b !== a && !b.dorme && b.acorda === null && !b.par ? b : null;
  };
  /** Quem está sendo acompanhado neste quadro, e em qual interação. */
  const acompanhados = new Map<string, Dupla>();
  const POSE_DO_ACOMPANHADO = {
    maos: "maoD",
    corda: "corda",
    abraco: "abraco",
    cavalinho: "carrega",
    colo: "colo",
  } as const;
  // cordas de pular: uma linha por dupla, refeita a cada quadro
  const PONTOS_DA_CORDA = 18;
  const mCorda = new THREE.LineBasicMaterial({ color: 0xf4f1ea });
  const cordas = new Map<string, TH.Line>();
  const girarCorda = (a: Avatar, b: Avatar, t: number) => {
    let linha = cordas.get(a.id);
    if (!linha) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(PONTOS_DA_CORDA * 3), 3),
      );
      linha = new THREE.Line(g, mCorda);
      linha.frustumCulled = false;
      cena.add(linha);
      cordas.set(a.id, linha);
    }
    const r = b.grupo.rotation.y;
    const dx = Math.cos(r);
    const dz = -Math.sin(r);
    // as pontas ficam nas mãos de fora de cada um; a corda gira em volta dos dois
    const x0 = b.mostra.x - dx * 0.28;
    const z0 = b.mostra.z - dz * 0.28;
    const x1 = a.mostra.x + dx * 0.28;
    const z1 = a.mostra.z + dz * 0.28;
    const giro = t * 9.4;
    const pos = linha.geometry.getAttribute("position") as TH.BufferAttribute;
    for (let i = 0; i < PONTOS_DA_CORDA; i++) {
      const f = i / (PONTOS_DA_CORDA - 1);
      const barriga = Math.sin(f * Math.PI) * 0.95;
      pos.setXYZ(
        i,
        x0 + (x1 - x0) * f + Math.sin(r) * Math.cos(giro) * barriga,
        Math.max(0.04, 0.44 + Math.sin(giro) * barriga),
        z0 + (z1 - z0) * f + Math.cos(r) * Math.cos(giro) * barriga,
      );
    }
    pos.needsUpdate = true;
  };

  // chuveirão: quando alguém para embaixo da ducha, a água cai e sobem bolhas em volta
  const GOTAS_DA_DUCHA = 46;
  const gDucha = new THREE.BufferGeometry();
  const pDucha = new Float32Array(GOTAS_DA_DUCHA * 3);
  gDucha.setAttribute("position", new THREE.BufferAttribute(pDucha, 3));
  const mDucha = new THREE.PointsMaterial({
    color: 0xcfeaff,
    size: 0.07,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const ducha = new THREE.Points(gDucha, mDucha);
  ducha.frustumCulled = false;
  ducha.visible = false;
  cena.add(ducha);
  const regarDucha = (t: number, ligada: boolean) => {
    ducha.visible = ligada;
    if (!ligada) return;
    for (let i = 0; i < GOTAS_DA_DUCHA; i++) {
      const bolha = i >= 34;
      const f = (t * (bolha ? 0.45 : 1.6) + i * 0.137) % 1;
      const ang = i * 2.399;
      const r = bolha ? 0.25 + (i % 4) * 0.06 : (i % 5) * 0.035;
      pDucha[i * 3] = CHUVEIRO.x + Math.cos(ang + (bolha ? t : 0)) * r;
      pDucha[i * 3 + 1] = bolha ? 0.25 + f * 0.9 : 2.2 - f * 2.2;
      pDucha[i * 3 + 2] = CHUVEIRO.z + Math.sin(ang + (bolha ? t : 0)) * r;
    }
    (gDucha.getAttribute("position") as TH.BufferAttribute).needsUpdate = true;
  };

  // tempos do despertar, em segundos: levantar, pular até o escorregador, descer e pousar
  const T_LEVANTA = 0.6;
  const T_PULO = 0.8;
  const T_DESCE = 3.4;
  const T_CAI = 0.55;
  const T_POUSA = 0.6;
  const suave = (x: number) => x * x * (3 - 2 * x);

  /** HOKI no berço: deitado dormindo, ou acordando (levanta, pula para o escorregador, desce e pousa no gramado). */
  function animarBerco(a: Avatar, agora: number, t: number, dt: number) {
    const v = vagaDoBerco(a.vaga);
    a.sombra.visible = false;
    if (a.dorme) {
      const k = 1 - Math.exp(-dt * 6);
      a.mostra.x += (v.x - a.mostra.x) * k;
      a.mostra.y += (v.y - a.mostra.y) * k;
      a.mostra.z += (v.z - a.mostra.z) * k;
      // deitado de costas, com a cabeça para o fundo (no travesseiro)
      a.grupo.position.set(a.mostra.x, a.mostra.y + 0.17, a.mostra.z + 0.3);
      a.grupo.rotation.set(-Math.PI / 2, 0, 0);
      a.mascote.atualizar({
        t: t + a.vaga * 0.7,
        humor: "dormindo",
        reacao: null,
        p: 0,
        mouse: parado,
        calmo,
        deitado: true,
      });
      return;
    }
    const s = (agora - (a.acorda ?? agora)) / 1000;
    const topo = noEscorregador(0);
    const saida = noEscorregador(1);
    const fimPulo = T_LEVANTA + T_PULO;
    const fimDescida = fimPulo + T_DESCE;
    const fimQueda = fimDescida + T_CAI;
    let x = v.x;
    let y = v.y;
    let z = v.z;
    let deita = 0;
    let giro = Math.PI;
    let sentado = false;
    if (s < T_LEVANTA) {
      // levanta da nuvem com um pulinho
      const f = suave(s / T_LEVANTA);
      deita = 1 - f;
      giro = 0;
      y = v.y + Math.sin(f * Math.PI) * 0.45;
    } else if (s < fimPulo) {
      // pula em arco até o topo do escorregador
      const f = (s - T_LEVANTA) / T_PULO;
      giro = Math.atan2(topo.x - v.x, topo.z - v.z);
      x = v.x + (topo.x - v.x) * f;
      z = v.z + (topo.z - v.z) * f;
      y = v.y + (topo.y + 0.12 - v.y) * f + Math.sin(f * Math.PI) * 1.1;
    } else if (s < fimDescida) {
      // desce sentado pela espiral, cada vez mais rápido
      const f = Math.pow((s - fimPulo) / T_DESCE, 1.25);
      const p = noEscorregador(f);
      const q = noEscorregador(Math.min(1, f + 0.012));
      x = p.x;
      y = p.y + 0.12;
      z = p.z;
      if (Math.hypot(q.x - p.x, q.z - p.z) > 0.001) giro = Math.atan2(q.x - p.x, q.z - p.z);
      sentado = true;
    } else if (s < fimQueda) {
      // sai voando da calha e cai na piscina
      const f = (s - fimDescida) / T_CAI;
      giro = Math.atan2(MERGULHO.x - saida.x, MERGULHO.z - saida.z);
      x = saida.x + (MERGULHO.x - saida.x) * f;
      z = saida.z + (MERGULHO.z - saida.z) * f;
      y =
        saida.y +
        0.12 +
        (AGUA_DA_PISCINA - 0.3 - saida.y - 0.12) * f * f +
        Math.sin(f * Math.PI) * 0.35;
      sentado = true;
    } else {
      // sai da piscina com um pulinho e pousa no gramado, do lado da praça
      const f = Math.min(1, (s - fimQueda) / T_POUSA);
      giro = Math.atan2(CHEGADA.x - MERGULHO.x, CHEGADA.z - MERGULHO.z);
      x = MERGULHO.x + (CHEGADA.x - MERGULHO.x) * f;
      z = MERGULHO.z + (CHEGADA.z - MERGULHO.z) * f;
      y = (AGUA_DA_PISCINA - 0.3) * (1 - f) + Math.sin(f * Math.PI) * 0.9;
      if (f >= 1) {
        // acabou: daqui em diante anda normalmente até onde queria ir
        a.acorda = null;
        a.pos = { ...CHEGADA };
        a.rumo = Math.PI;
        const banco = a.alvo.banco !== null ? BANCOS[a.alvo.banco] : undefined;
        a.rota = planejar(a.pos, banco ? frenteDoBanco(banco) : { x: a.alvo.x, z: a.alvo.z });
        a.sombra.visible = true;
      }
    }
    a.mostra.x = x;
    a.mostra.y = y;
    a.mostra.z = z;
    a.grupo.position.set(x, y + deita * 0.17, z + deita * 0.3);
    a.grupo.rotation.set((-deita * Math.PI) / 2, giro, 0);
    a.mascote.atualizar({
      t,
      humor: "feliz",
      reacao: null,
      p: 0,
      mouse: parado,
      calmo,
      sentado,
      deitado: deita > 0.5,
    });
  }

  const quadro = (agora: number) => {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora;
    if (!visivel || document.hidden || mundoPausado()) return;
    const t = agora / 1000;
    // (na vitrine a noite fica só um entardecer: a ilha precisa aparecer no fundo escuro)
    anoitecer(vitrine ? Math.min(nivelDaNoite(), 0.35) : nivelDaNoite());
    regar(agora);
    mundo.atualizar(t);
    shows.quadro(agora, dt);

    let eu: Avatar | undefined;
    acompanhados.clear();
    for (const a of avatares.values()) {
      const b = a.par && !a.dorme && a.acorda === null ? parceiro(a) : null;
      if (b && a.par) acompanhados.set(b.id, a.par.tipo);
    }
    const comCorda = new Set<string>();
    for (const a of avatares.values()) {
      if (a.souEu) eu = a;
      if (a.dorme || a.acorda !== null) {
        if (noShow.delete(a.id)) a.grupo.scale.setScalar(ESCALA);
        animarBerco(a, agora, t, dt);
        continue;
      }
      // num evento do Founder, quem manda na posição e na pose é o evento
      const sp = shows.pose(a.id, agora);
      if (sp) {
        noShow.add(a.id);
        aplicarShow(a, sp, t, dt);
        continue;
      }
      if (noShow.delete(a.id)) voltarDoShow(a);
      let andando = false;
      let vel = 0;
      // eu: controle direto pelo teclado ou joystick (manda enquanto há entrada ou o corpo ainda se mexe)
      if (a.souEu) {
        // em dupla (acompanhando alguém) quem manda é o parceiro
        if (a.corpo && a.par) a.corpo = null;
        const e = podeTeclar() ? lerEntrada() : null;
        if (!e) {
          soltarTudo();
          entrada.frente = entrada.lado = 0;
          entrada.pular = false;
        }
        const ent = siegeTravado
          ? { frente: 0, lado: 0, correr: false, pular: false }
          : (e ?? entrada);
        const temEntrada = ent.frente !== 0 || ent.lado !== 0 || ent.pular;
        if (!a.corpo && temEntrada && !a.par) {
          // começou a andar pelo teclado: larga a rota do clique, levanta do banco e avisa a praça
          a.corpo = criarCorpo(a.pos.x, a.pos.z, a.mostra.y, a.rumo);
          a.rota = [];
          a.sentado = false;
          marca.visible = false;
          const p = { x: arredonda(a.pos.x), z: arredonda(a.pos.z) };
          a.alvo = { x: p.x, z: p.z, banco: null };
          eventos.onMover?.(p);
        }
        if (a.corpo) {
          corpoAndando.y = a.corpo.y;
          const r = passo(a.corpo, ent, giroSuave, dt, MAPA_MOV, a.lento, PROPORCAO * siegeFator);
          vel = r.velocidade;
          if (r.aterrissou) a.pouso = 0.28;
          a.pos = { x: a.corpo.x, z: a.corpo.z };
          a.rumo = a.corpo.rumo;
          andando = r.andando;
          a.correndo = r.correndo;
          a.noAr = !a.corpo.noChao;
          const k: TipoAmostra = a.noAr ? "pula" : "anda";
          enviarMovimento(a, k, r.pulou || r.aterrissou);
          if (r.pulou) playSfx("pulo");
          else if (r.aterrissou) playSfx("pouso");
          if (!temEntrada && corpoParado(a.corpo)) {
            // parou: vira o destino de todo mundo (inclusive quem está com a versão antiga do site)
            const p = { x: arredonda(a.corpo.x), z: arredonda(a.corpo.z) };
            a.pos = p;
            a.alvo = { x: p.x, z: p.z, banco: null };
            a.corpo = null;
            a.correndo = false;
            a.noAr = false;
            enviarMovimento(a, "para", true);
            eventos.onParou(p);
          }
        }
      } else if (a.fluxo) {
        // os outros: o movimento contínuo prevê o caminho pela velocidade e corrige devagar
        const idadeMs = agora - a.fluxo.quando;
        const am = a.fluxo.a;
        if (am.k !== "para" && idadeMs > FLUXO.VALIDADE_MS) {
          // o fluxo parou de chegar no meio do caminho: volta ao jeito antigo (rota até o destino)
          a.fluxo = null;
          a.noAr = false;
          a.correndo = false;
          if (Math.hypot(a.alvo.x - a.pos.x, a.alvo.z - a.pos.z) > 0.3) {
            a.rota = planejar(a.pos, { x: a.alvo.x, z: a.alvo.z });
          }
        } else {
          const prev = prever(am, idadeMs / 1000, MOV.GRAVIDADE * PROPORCAO, alturaDoChao, livre);
          const ex = prev.x - a.pos.x;
          const ez = prev.z - a.pos.z;
          if (Math.hypot(ex, ez) > FLUXO.TELEPORTE) a.pos = { x: prev.x, z: prev.z };
          else {
            const kf = 1 - Math.exp(-dt * 12);
            a.pos = { x: a.pos.x + ex * kf, z: a.pos.z + ez * kf };
          }
          a.rota = [];
          andando = prev.andando;
          a.correndo = Math.hypot(am.vx, am.vz) > MOV.ANDAR * PROPORCAO * 1.2;
          if (prev.andando) vel = Math.hypot(am.vx, am.vz);
          a.noAr = prev.noAr;
          if (prev.noAr) a.mostra.y = prev.y;
          if (andando || prev.noAr) a.rumo = am.r;
          // depois de parado um tempo, o fluxo acaba (a presença já tem o destino final)
          if (am.k === "para" && idadeMs > 3000) a.fluxo = null;
        }
      }
      const proximo = a.rota[0];
      if (proximo) {
        const n = avancar(a.pos, proximo, VELOCIDADE * (a.lento ? 0.45 : 1) * dt);
        if (Math.hypot(n.x - a.pos.x, n.z - a.pos.z) > 0.0005)
          a.rumo = Math.atan2(n.x - a.pos.x, n.z - a.pos.z);
        a.pos = { x: n.x, z: n.z };
        if (n.chegou) a.rota.shift();
        andando = true;
        vel = VELOCIDADE * (a.lento ? 0.45 : 1);
        if (!a.rota.length && a.alvo.banco !== null) a.sentado = true;
        if (!a.rota.length && a.souEu) eventos.onParou(a.pos);
      }
      // dupla: quem acompanha fica colado no outro (de mãos dadas, na corda, no abraço ou de cavalinho)
      const tipoDeAcompanhado = acompanhados.get(a.id);
      let pose:
        | "maoE"
        | "maoD"
        | "abraco"
        | "corda"
        | "carrega"
        | "montado"
        | "colo"
        | "nocolo"
        | undefined = tipoDeAcompanhado ? POSE_DO_ACOMPANHADO[tipoDeAcompanhado] : undefined;
      const outro = a.par ? parceiro(a) : null;
      // a escadaria e a ilha da HOST FAZENDAS ficam no alto
      let chao = alturaDoChao(a.pos.x, a.pos.z);
      if (outro && a.par) {
        const r = outro.grupo.rotation.y;
        const frente = { x: Math.sin(r), z: Math.cos(r) };
        const direita = { x: Math.cos(r), z: -Math.sin(r) };
        let ox = direita.x * 0.6;
        let oz = direita.z * 0.6;
        a.rumo = r;
        pose = "maoE";
        if (a.par.tipo === "corda") {
          ox = direita.x * 1.25;
          oz = direita.z * 1.25;
          pose = "corda";
          comCorda.add(a.id);
        } else if (a.par.tipo === "abraco") {
          ox = frente.x * 0.4;
          oz = frente.z * 0.4;
          a.rumo = r + Math.PI;
          pose = "abraco";
        } else if (a.par.tipo === "cavalinho") {
          // sentado nas costas de quem carrega (o quadril na altura da cintura dele)
          ox = -frente.x * 0.22;
          oz = -frente.z * 0.22;
          chao = outro.mostra.y + 0.8;
          pose = "montado";
        } else if (a.par.tipo === "colo") {
          // deitado nos braços, atravessado na frente do peito de quem carrega
          ox = frente.x * 0.32;
          oz = frente.z * 0.32;
          chao = outro.mostra.y + 0.78;
          a.rumo = r + Math.PI / 2;
          pose = "nocolo";
        }
        a.rota = [];
        a.sentado = false;
        a.pos = { x: outro.mostra.x + ox, z: outro.mostra.z + oz };
        andando = a.par.tipo === "maos" && outro.andando;
      }
      a.andando = andando;
      // pouso: os outros também (quando saem do ar)
      if (a.noArAntes && !a.noAr && !a.souEu) a.pouso = 0.28;
      a.noArAntes = a.noAr;
      a.pouso = Math.max(0, a.pouso - dt);
      // sentado: sobe para o assento e vira para onde o banco olha; senão acompanha a caminhada
      const s = a.sentado && a.alvo.banco !== null ? assento(a.alvo.banco) : null;
      const k = 1 - Math.exp(-dt * 10);
      const cola = s || outro ? k : 1;
      a.mostra.x += ((s ? s.x : a.pos.x) - a.mostra.x) * cola;
      a.mostra.z += ((s ? s.z : a.pos.z) - a.mostra.z) * cola;
      // no controle direto a altura é a do corpo (pulo e queda de verdade); no ar, o remoto já veio da previsão
      if (a.corpo) a.mostra.y = a.corpo.y;
      else if (!a.noAr) a.mostra.y += ((s ? s.y : chao) - a.mostra.y) * k;
      // no balanço: depois de pular para o assento, fica colado nele (senão ficaria sempre um pouco atrás)
      if (s?.balanco) {
        if (a.noBalanco || Math.hypot(s.x - a.mostra.x, s.y - a.mostra.y, s.z - a.mostra.z) < 0.4) {
          a.noBalanco = true;
          a.mostra.x = s.x;
          a.mostra.y = s.y;
          a.mostra.z = s.z;
        }
      } else a.noBalanco = false;
      const alvoRumo = s ? s.ang : a.rumo;
      const giro = Math.atan2(
        Math.sin(alvoRumo - a.grupo.rotation.y),
        Math.cos(alvoRumo - a.grupo.rotation.y),
      );
      a.grupo.rotation.y += giro * k;
      // sentado no balanço, o corpo inclina junto com o banco
      a.grupo.rotation.x = a.noBalanco && s ? s.inclina : 0;
      a.grupo.position.set(a.mostra.x, a.mostra.y, a.mostra.z);
      a.grupo.scale.setScalar(ESCALA * shows.escala(a.id, agora));
      // animação: a avulsa acaba sozinha; a que está em repetição recomeça até a pessoa parar
      if (
        a.truque &&
        agora - a.truque.inicio >
          (DURACAO[a.truque.tipo] ?? DURACAO_REACAO[a.truque.tipo] ?? 3) * 1000
      ) {
        if (a.anim && !andando && !s && !outro) a.truque.inicio = agora;
        else a.truque = null;
      }
      const salto = a.mascote.atualizar({
        t,
        humor: "normal",
        reacao: a.truque?.tipo ?? null,
        p: a.truque ? (agora - a.truque.inicio) / 1000 : 0,
        mouse: parado,
        calmo,
        andando,
        correndo: andando && a.correndo,
        noAr: a.noAr,
        velocidade: vel / PROPORCAO,
        pousando: a.pouso > 0,
        sentado: !!s,
        pose: s && a.alvo.banco !== null && BANCOS[a.alvo.banco]?.trabalho ? "trabalha" : pose,
      });
      a.sombra.visible = pose !== "montado" && pose !== "nocolo";
      // no pulo a sombra fica no chão e encolhe com a altura
      const altura = a.noAr ? Math.max(0, a.mostra.y - chao) : 0;
      const raio = (0.5 * (1 - Math.min(0.5, salto * 0.5))) / (1 + altura * 0.7);
      a.sombra.position.set(a.mostra.x, (a.noAr ? chao : a.mostra.y) + 0.035, a.mostra.z);
      a.sombra.scale.set(raio, 1, raio);
    }
    // mosquitos de quem está sujo e a ducha (ligada se alguém está parado embaixo dela)
    let alguemNaDucha = false;
    for (const a of avatares.values()) {
      if (a.mosquitos)
        a.mosquitos.atualizar(
          t,
          a.grupo.position.x,
          a.grupo.position.y + (a.dorme ? 0.45 : a.mascote.topo * ESCALA * 0.95),
          a.grupo.position.z,
        );
      if (
        !a.dorme &&
        !a.andando &&
        Math.hypot(a.mostra.x - CHUVEIRO.x, a.mostra.z - CHUVEIRO.z) < 0.6
      )
        alguemNaDucha = true;
    }
    regarDucha(t, alguemNaDucha);
    // cordas de pular: gira as que estão em uso e tira as que acabaram
    for (const id of comCorda) {
      const a = avatares.get(id);
      const b = a ? parceiro(a) : null;
      if (a && b) girarCorda(a, b, t);
    }
    for (const [id, linha] of cordas)
      if (!comCorda.has(id)) {
        cena.remove(linha);
        linha.geometry.dispose();
        cordas.delete(id);
      }
    if (eu && !eu.rota.length) marca.visible = false;
    if (marca.visible) marca.scale.setScalar(1 + Math.sin(t * 7) * 0.15);

    // câmera: de longe mostra a ilha toda; dentro da praça, chega perto e acompanha o seu HOKI
    const alvoZoom = dentro && eu ? zoomUsuario : 1;
    const kc = 1 - Math.exp(-dt * 2.6);
    zoom += (alvoZoom - zoom) * kc;
    const peso = zoom * zoom;
    const fx = eu ? eu.mostra.x : 0;
    const fz = eu ? eu.mostra.z : 0;
    // acordado, a vista fica centrada no seu HOKI (na fazenda e no escritório também);
    // só com o zoom quase todo para fora, e perto da ilha, ela volta para o meio da ilha
    const longeDaIlha = Math.min(
      1,
      Math.max(0, (Math.hypot(fx - CENTRO.x, fz - CENTRO.z) - 22) / 12),
    );
    const centra =
      dentro && eu ? Math.pow(Math.max(0, (zoom - 0.8) / 0.2), 2) * (1 - longeDaIlha) : 1;
    // acompanha a altura do chão do HOKI (escada, ilha alta); no pulo a câmera não balança junto
    const alturaDoEu = eu ? (eu.noAr ? alturaDoChao(eu.mostra.x, eu.mostra.z) : eu.mostra.y) : 0;
    vetor.set(
      fx + (CENTRO.x - fx) * centra + (dentro ? 0 : Math.sin(t * 0.12) * 1.2),
      // bem de perto a câmera mira o rosto; de longe, o corpo inteiro
      (zoom < 0.3 ? 0.9 + (1 - zoom / 0.3) * 0.25 : 0.9) +
        // (no HOST SIEGE a arena é bem mais alta: a mira fica sempre na altura do boneco)
        (CENTRO.y - 0.9) * (siege.ativo() ? 0 : peso) +
        alturaDoEu * (siege.ativo() ? 1 : 1 - peso),
      fz + (CENTRO.z - fz) * centra,
    );
    // de perto a vista fica colada no HOKI (correndo não fica para trás); de longe ela desliza
    olhar.lerp(vetor, 1 - Math.exp(-dt * (dentro && zoom < 0.6 ? 14 : 5)));
    // o sol (e a área das sombras) vai junto com a vista, em passos, para a fazenda e o escritório também terem sombra
    const solX = Math.round(olhar.x / 6) * 6;
    const solZ = Math.round(olhar.z / 6) * 6;
    if (solX !== luzes.sol.target.position.x || solZ !== luzes.sol.target.position.z) {
      luzes.sol.target.position.set(solX, 1, solZ);
      luzes.sol.position.set(solX + SOL.x * 60, 1 + SOL.y * 60, solZ + SOL.z * 60);
    }
    // à noite, um holofote acompanha o seu HOKI e deixa uma poça de luz no chão
    const luzDoHoki = eu ? noiteAtual : 0;
    holofote.intensity = luzDoHoki * 5.5;
    poca.visible = luzDoHoki > 0.02;
    if (eu && luzDoHoki > 0.02) {
      holofote.position.set(eu.mostra.x + 0.8, eu.mostra.y + 5.6, eu.mostra.z + 1.6);
      holofote.target.position.set(eu.mostra.x, eu.mostra.y + 0.4, eu.mostra.z);
      poca.position.set(eu.mostra.x, eu.mostra.y + 0.045, eu.mostra.z);
      mPoca.opacity = luzDoHoki * 0.55;
    }
    // do rosto (2,3) até a ilha inteira; a curva deixa o ajuste fino quando está perto
    const dist = 2.3 + (distMax - 2.3) * zoom * zoom;
    // de fora, a vista volta sozinha para a frente da ilha
    if (!dentro) {
      giroCam += (Math.round(giroCam / (Math.PI * 2)) * Math.PI * 2 - giroCam) * kc;
      alturaCam += (ALTURA_PADRAO - alturaCam) * kc;
    }
    // giro e altura da câmera perseguem o pedido (taxa 18/s: responde rápido, sem trancos)
    const kg = 1 - Math.exp(-dt * 18);
    giroSuave += (giroCam - giroSuave) * kg;
    alturaSuave += (alturaCam - alturaSuave) * kg;
    const subida = ALTURA_PADRAO + (alturaSuave - ALTURA_PADRAO) * (1 - peso);
    const plano = Math.cos(subida) * dist;
    camera.position.set(
      olhar.x + Math.sin(giroSuave) * plano,
      olhar.y + Math.sin(subida) * dist,
      olhar.z + Math.cos(giroSuave) * plano,
    );
    // a câmera nunca entra no chão (escadaria, ilha alta, olhando de baixo)
    const chaoDaCamera = alturaDoChao(camera.position.x, camera.position.z) + 0.45;
    if (camera.position.y < chaoDaCamera) camera.position.y = chaoDaCamera;
    // no HOST SIEGE há paredes altas: a câmera chega mais perto em vez de entrar nelas
    if (siege.ativo()) {
      const dx = camera.position.x - olhar.x;
      const dy = camera.position.y - olhar.y;
      const dz = camera.position.z - olhar.z;
      for (let k = 0.08; k <= 1; k += 0.04) {
        const x = olhar.x + dx * k;
        const y = olhar.y + dy * k;
        const z = olhar.z + dz * k;
        if (alturaDoChao(x, z) > y - 0.25) {
          const v = Math.max(0.08, k - 0.06);
          camera.position.set(olhar.x + dx * v, olhar.y + dy * v, olhar.z + dz * v);
          break;
        }
      }
    }
    mira.copy(olhar);
    // de perto, a câmera fica por cima do ombro direito (como nos jogos de tiro em terceira pessoa)
    const ombro = OMBRO * (1 - peso) * (dentro && eu ? 1 : 0);
    if (ombro > 0.001) {
      const dx = Math.cos(giroSuave) * ombro;
      const dz = -Math.sin(giroSuave) * ombro;
      camera.position.x += dx;
      camera.position.z += dz;
      mira.x += dx;
      mira.z += dz;
    }
    // vista do RANKING: a câmera vai para a altura dos olhos, de frente para o arco, com o letreiro inteiro na tela
    vista += ((vistaRanking ? 1 : 0) - vista) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(vista - (vistaRanking ? 1 : 0)) < 0.001) vista = vistaRanking ? 1 : 0;
    // campo de visão: de perto abre (terceira pessoa) e correndo abre mais um pouco; de longe fica o da ilha
    correrSuave += ((eu?.correndo && eu.corpo ? 1 : 0) - correrSuave) * (1 - Math.exp(-dt * 4));
    const fovBase = FOV + (FOV_PERTO - FOV + FOV_CORRENDO * correrSuave) * (1 - peso);
    const fovAlvo = fovBase + (FOV_RANKING - fovBase) * vista;
    if (Math.abs(fovAlvo - fovAtual) > 0.01) {
      fovAtual = fovAlvo;
      camera.fov = fovAtual;
      camera.updateProjectionMatrix();
    }
    if (vista > 0) {
      // o arco inteiro na tela: folga dos lados e em cima, e embaixo o espaço dos botões da vista
      // (abas dos rankings e E/F). As contas valem na frente do arco.
      const meio = Math.tan((FOV_RANKING * Math.PI) / 360);
      const folgaCima = 0.08;
      const folgaLado = 0.1;
      const folgaBaixo = Math.min(0.6, (BOTOES_DA_VISTA + 10) / Math.max(1, el.clientHeight / 2));
      const ate = Math.max(
        ALTURA_ARCO / (2 - folgaCima - folgaBaixo) / meio,
        LARGURA_ARCO / 2 / (1 - folgaLado) / (meio * camera.aspect),
      );
      // meia altura visível na frente do arco; o centro desce para sobrar espaço embaixo
      const meia = ate * meio;
      const centro = ALTURA_ARCO / 2 - (meia * (folgaBaixo - folgaCima)) / 2;
      posRanking.set(TOP3.x, centro, TOP3.z + PROFUNDIDADE_ARCO / 2 + ate);
      miraRanking.set(TOP3.x, centro, TOP3.z);
      const e = vista * vista * (3 - 2 * vista);
      camera.position.lerp(posRanking, e);
      mira.lerp(miraRanking, e);
    }
    // raio, explosões e gigantes: a tela treme
    const tremor = shows.tremor(agora);
    if (tremor > 0) {
      camera.position.x += (Math.random() - 0.5) * tremor;
      camera.position.y += (Math.random() - 0.5) * tremor;
      camera.position.z += (Math.random() - 0.5) * tremor;
    }
    camera.lookAt(mira);
    // em primeira pessoa o próprio HOKI some (senão ficaria na frente da câmera)
    if (eu) {
      const visivel = vista < 0.55;
      eu.grupo.visible = visivel;
      eu.sombra.visible = visivel;
    }
    if (espia) {
      // só para testes: câmera parada num ponto escolhido pelo console
      const [ex = 0, ey = 0, ez = 0, ox = 0, oy = 0, oz = 0, fov = 50] = espia;
      camera.position.set(ex, ey, ez);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.lookAt(ox, oy, oz);
    }
    siege.atualizar(performance.now(), dt, t);
    renderer.render(cena, camera);
    contarQuadro(agora);

    // rótulos (nome, status e balão) por cima de cada HOKI
    const w = el.clientWidth;
    const h = el.clientHeight;
    for (const a of avatares.values()) {
      vetor
        .set(a.mostra.x, a.mostra.y + a.mascote.topo * a.grupo.scale.y + 0.2, a.mostra.z)
        .project(camera);
      const fora =
        vista > 0.5 || vetor.z > 1 || Math.abs(vetor.x) > 1.15 || Math.abs(vetor.y) > 1.25;
      a.rotulo.style.display = fora ? "none" : "";
      if (!fora)
        a.rotulo.style.transform = `translate3d(${((vetor.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-vetor.y * 0.5 + 0.5) * h).toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    vetor.set(TERMOMETRO.x, 4.75, TERMOMETRO.z).project(camera);
    blipTela.visivel = vetor.z < 1 && Math.abs(vetor.x) < 1.05 && Math.abs(vetor.y) < 1.1;
    blipTela.x = (vetor.x * 0.5 + 0.5) * w;
    blipTela.y = (-vetor.y * 0.5 + 0.5) * h;
    vetor.set(CORREIO.x, 2.0, CORREIO.z).project(camera);
    cartaTela.visivel = vetor.z < 1 && Math.abs(vetor.x) < 1.05 && Math.abs(vetor.y) < 1.1;
    cartaTela.x = (vetor.x * 0.5 + 0.5) * w;
    cartaTela.y = (-vetor.y * 0.5 + 0.5) * h;
    blipCarta.style.display = cartaTela.visivel ? "" : "none";
    if (cartaTela.visivel)
      blipCarta.style.transform = `translate3d(${cartaTela.x.toFixed(1)}px, ${cartaTela.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    vetor.set(CENTRO_DO_COMERCIO.x, 4.25, CENTRO_DO_COMERCIO.z).project(camera);
    comercioTela.visivel = vetor.z < 1 && Math.abs(vetor.x) < 1.05 && Math.abs(vetor.y) < 1.1;
    comercioTela.x = (vetor.x * 0.5 + 0.5) * w;
    comercioTela.y = (-vetor.y * 0.5 + 0.5) * h;
    blipComercio.style.display = COMERCIO_NA_PRACA && comercioTela.visivel ? "" : "none";
    if (comercioTela.visivel)
      blipComercio.style.transform = `translate3d(${comercioTela.x.toFixed(1)}px, ${comercioTela.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    blip.style.display = blipTela.visivel && !semBlip ? "" : "none";
    if (blipTela.visivel)
      blip.style.transform = `translate3d(${blipTela.x.toFixed(1)}px, ${blipTela.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
  };
  raf = requestAnimationFrame(quadro);

  return {
    setPessoas,
    /** Só para testes: onde cada HOKI está e para onde vai. */
    estado: () =>
      [...avatares.values()].map((a) => ({
        id: a.id.slice(0, 6),
        eu: a.souEu,
        mostra: [+a.mostra.x.toFixed(2), +a.mostra.z.toFixed(2)],
        y: +a.mostra.y.toFixed(2),
        escala: +a.grupo.scale.y.toFixed(2),
        rota: a.rota.map((r) => [+r.x.toFixed(1), +r.z.toFixed(1)]),
        alvo: a.alvo,
        dorme: a.dorme,
        acorda: a.acorda,
      })),
    camera: () => ({
      olhar: olhar.toArray().map((v) => +v.toFixed(1)),
      zoom: +zoom.toFixed(2),
      dentro,
    }),
    /** Só para testes: prende a câmera em [x, y, z, olhaX, olhaY, olhaZ, fov] (null solta). */
    espiar: (v: number[] | null) => {
      espia = v;
    },
    /** Só para testes: onde um ponto do mundo aparece na página (em pixels). */
    tela: (x: number, y: number, z: number) => {
      const r = el.getBoundingClientRect();
      const v = new THREE.Vector3(x, y, z).project(camera);
      return [
        Math.round(r.left + (v.x * 0.5 + 0.5) * r.width),
        Math.round(r.top + (-v.y * 0.5 + 0.5) * r.height),
      ];
    },
    /** Quando cada lugar da fazenda foi colhido pela última vez (para desenhar o que já cresceu). */
    setColheitas(mapa: Record<string, number>) {
      colheitas = mapa;
      proximaRega = 0;
    },
    /** Cartas não lidas: aparecem no envelope em cima da caixa do correio (e ele pisca). */
    setCartas(n: number) {
      if (cartaN) {
        cartaN.hidden = n <= 0;
        cartaN.textContent = n > 9 ? "9+" : String(n);
      }
      if (cartaPisca) cartaPisca.classList.toggle("hidden", n <= 0);
    },
    setSemTermometro(v: boolean) {
      semBlip = v;
    },
    /** O que está escrito no arco do RANKING. */
    setRanking(q: QuadroRanking) {
      mundo.ranking.definir(q);
    },
    /** Liga/desliga a vista em primeira pessoa de frente para o arco do RANKING. */
    setVistaRanking(v: boolean) {
      vistaRanking = v;
    },
    setPendentes(n: number) {
      if (!blipN) return;
      blipN.hidden = n <= 0;
      blipN.textContent = n > 9 ? "9+" : String(n);
    },
    setFalas(falas: Record<string, string>) {
      for (const a of avatares.values()) {
        const texto = falas[a.id] ?? "";
        a.fala.textContent = texto;
        a.fala.hidden = !texto;
      }
    },
    setDentro(v: boolean) {
      dentro = v;
      if (!v) marca.visible = false;
    },
    /** Liga ou desliga a vitrine: fundo transparente, sem nuvens, lua nem nomes. */
    setVitrine(v: boolean) {
      if (v === vitrine) return;
      vitrine = v;
      cena.background = v ? null : texCeu;
      for (const n of mundo.nuvens) n.visible = !v;
      camada.style.visibility = v ? "hidden" : "";
      const nevoa = cena.fog as TH.Fog | null;
      if (nevoa) {
        nevoa.near = v ? 900 : 70;
        nevoa.far = v ? 2400 : 190;
      }
      noiteAtual = -1; // refaz a cor da névoa, a lua e as luzes na próxima volta
      medir(); // a distância da câmera muda com a vitrine
    },
    truque(id: string, tipo: Reacao) {
      const a = avatares.get(id);
      if (a && !a.sentado && !a.dorme && a.acorda === null)
        a.truque = { tipo, inicio: performance.now() };
    },
    zoom(delta: number) {
      zoomUsuario = Math.max(0, Math.min(1, zoomUsuario + delta));
    },
    iniciarShow(show: Show, atrasoMs: number) {
      shows.iniciar(show, atrasoMs);
    },
    showRodando: () => shows.rodando(performance.now()),
    joystick(lado: number, frente: number, correr: boolean) {
      joy.lado = Math.max(-1, Math.min(1, lado));
      joy.frente = Math.max(-1, Math.min(1, frente));
      joy.correr = correr;
    },
    pular() {
      if (podeTeclar()) pedidoPulo = true;
    },
    socar() {
      socar();
    },
    teleportar(x: number, z: number) {
      return teleportarEu(x, z);
    },
    siegeTreino() {
      const eu = [...avatares.values()].find((a) => a.souEu && !a.dorme && a.acorda === null);
      if (!eu) return;
      siege.iniciar("treino", eu.nome.textContent || "Você", eu.id);
    },
    siegeRede(m: InicioPartida) {
      const eu = [...avatares.values()].find((a) => a.souEu && !a.dorme && a.acorda === null);
      if (!eu) return;
      siege.iniciarRede(m, eu.id);
    },
    siegeSair() {
      siege.sair();
      teleportarEu(FRENTE_SIEGE.x, FRENTE_SIEGE.z);
    },
    siegeKit(kit: Kit) {
      return siege.escolherKit(kit);
    },
    /** Uma amostra do movimento contínuo de outra pessoa (descarta a atrasada e a de quem dorme). */
    movimento(id: string, amostra: AmostraMovimento) {
      const a = avatares.get(id);
      if (!a || a.souEu || a.dorme || a.acorda !== null || a.par) return;
      const agoraMs = performance.now();
      if (a.fluxo && amostra.s <= a.fluxo.a.s && agoraMs - a.fluxo.quando < 5000) return;
      a.fluxo = { a: amostra, quando: agoraMs };
      a.rota = [];
      a.sentado = false;
    },
    descartar() {
      cancelAnimationFrame(raf);
      shows.descartar();
      observador.disconnect();
      olheiro.disconnect();
      el.removeEventListener("pointerdown", aoBaixar);
      el.removeEventListener("pointerup", aoSoltar);
      el.removeEventListener("pointermove", aoArrastar);
      el.removeEventListener("wheel", aoRolar);
      el.removeEventListener("contextmenu", semMenu);
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoLargarTecla);
      window.removeEventListener("blur", soltarTudo);
      fpsEl.remove();
      for (const a of [...avatares.values()]) removerAvatar(a);
      blip.remove();
      blipCarta.remove();
      blipComercio.remove();
      gPlanta.dispose();
      mPlanta.dispose();
      gDucha.dispose();
      mDucha.dispose();
      for (const linha of cordas.values()) linha.geometry.dispose();
      tLua.dispose();
      tPoca.dispose();
      mClarao.dispose();
      gClarao.dispose();
      mPoca.dispose();
      poca.geometry.dispose();
      tHalo.dispose();
      mLua.dispose();
      mHalo.dispose();
      gEstrelas.dispose();
      mEstrelas.dispose();
      mCorda.dispose();
      mundo.descartar();
      siege.descartar();
      texCeu.dispose();
      tSombra.dispose();
      gSombra.dispose();
      mSombra.dispose();
      gMarca.dispose();
      mMarca.dispose();
      // solta o contexto 3D na hora: sem isso, depois de recriar a tela várias vezes o navegador passa do limite
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/**
 * Praça HOST em 3D. Quem só olha vê a ilha inteira; quem entra tem a câmera
 * por perto, acompanhando o próprio HOKI. Clique no chão para andar e num banco para sentar.
 */
export const Mundo3D = forwardRef<
  Mundo3DRef,
  {
    pessoas: PessoaMundo[];
    falas: Record<string, string>;
    dentro: boolean;
    /** Para quantas pessoas ainda dá para entregar emoji hoje (aparece no símbolo do termômetro). */
    pendentes?: number;
    /** Fazenda: quando cada lugar foi colhido pela última vez (o que já cresceu aparece no mundo). */
    colheitas?: Record<string, number>;
    /** Cartas não lidas no correio. */
    cartas?: number;
    /** Esconde o símbolo do termômetro (para visitas, que não usam o queridômetro). */
    semTermometro?: boolean;
    /** O que aparece no arco do RANKING. */
    ranking?: QuadroRanking | null;
    /** Câmera em primeira pessoa, de frente para o arco do RANKING. */
    vistaRanking?: boolean;
    /** Vitrine: só a ilha, com o fundo transparente (tela do HOKI antes de acordar). */
    vitrine?: boolean;
    className?: string;
  } & Eventos
>(function Mundo3D(props, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const motor = useRef<ReturnType<typeof criarMotor> | null>(null);
  const atual = useRef(props);
  atual.current = props;
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");

  useEffect(() => {
    const el = caixa.current;
    const rotulos = camada.current;
    if (!el || !rotulos) return;
    let vivo = true;
    void import("three")
      .then(async (THREE) => {
        // as letras do letreiro são desenhadas com a fonte do site: espera ela chegar
        const [modelo] = await Promise.all([
          modeloLeve(THREE),
          document.fonts?.load("800 40px Manrope").catch(() => undefined),
        ]);
        if (!vivo) return;
        const m = criarMotor(THREE, el, rotulos, modelo, {
          onChao: (p) => atual.current.onChao(p),
          onBanco: (i) => atual.current.onBanco(i),
          onPessoa: (id) => atual.current.onPessoa(id),
          onTermometro: () => atual.current.onTermometro(),
          onParou: (p) => atual.current.onParou(p),
          onCanteiro: (i) => atual.current.onCanteiro(i),
          onCorreio: () => atual.current.onCorreio(),
          onComercio: () => atual.current.onComercio?.(),
          onAviso: (texto) => atual.current.onAviso?.(texto),
          onBalanco: () => atual.current.onBalanco?.(),
          onMover: (p) => atual.current.onMover?.(p),
          onFluxo: (a) => atual.current.onFluxo?.(a),
          onSoco: () => atual.current.onSoco?.(),
          onTruque: (tipo) => atual.current.onTruque?.(tipo),
          onSiege: (e) => atual.current.onSiege?.(e),
          olhando: () => atual.current.olhando?.() ?? 0,
        });
        motor.current = m;
        // em desenvolvimento, o motor fica à mão no console para testes
        if (import.meta.env.DEV) (window as unknown as { __mundo?: typeof m }).__mundo = m;
        m.setVitrine(!!atual.current.vitrine);
        m.setDentro(atual.current.dentro);
        m.setPessoas(atual.current.pessoas);
        m.setFalas(atual.current.falas);
        m.setPendentes(atual.current.pendentes ?? 0);
        m.setColheitas(atual.current.colheitas ?? {});
        m.setCartas(atual.current.cartas ?? 0);
        m.setSemTermometro(!!atual.current.semTermometro);
        if (atual.current.ranking) m.setRanking(atual.current.ranking);
        m.setVistaRanking(!!atual.current.vistaRanking);
        setEstado("pronto");
      })
      .catch(() => vivo && setEstado("falhou"));
    return () => {
      vivo = false;
      motor.current?.descartar();
      motor.current = null;
    };
  }, []);

  useEffect(() => motor.current?.setPessoas(props.pessoas), [props.pessoas]);
  useEffect(() => motor.current?.setFalas(props.falas), [props.falas, props.pessoas]);
  useEffect(() => motor.current?.setDentro(props.dentro), [props.dentro]);
  useEffect(() => motor.current?.setVitrine(!!props.vitrine), [props.vitrine]);
  useEffect(() => motor.current?.setPendentes(props.pendentes ?? 0), [props.pendentes]);
  useEffect(() => motor.current?.setColheitas(props.colheitas ?? {}), [props.colheitas]);
  useEffect(() => motor.current?.setCartas(props.cartas ?? 0), [props.cartas]);
  useEffect(() => motor.current?.setSemTermometro(!!props.semTermometro), [props.semTermometro]);
  useEffect(() => {
    if (props.ranking) motor.current?.setRanking(props.ranking);
  }, [props.ranking]);
  useEffect(() => motor.current?.setVistaRanking(!!props.vistaRanking), [props.vistaRanking]);
  useImperativeHandle(
    ref,
    () => ({
      truque: (id, tipo) => motor.current?.truque(id, tipo),
      zoom: (d) => motor.current?.zoom(d),
      iniciarShow: (show, atraso) => motor.current?.iniciarShow(show, atraso),
      showRodando: () => motor.current?.showRodando() ?? false,
      joystick: (lado, frente, correr) => motor.current?.joystick(lado, frente, correr),
      pular: () => motor.current?.pular(),
      socar: () => motor.current?.socar(),
      siegeTreino: () => motor.current?.siegeTreino(),
      siegeRede: (m) => motor.current?.siegeRede(m),
      siegeSair: () => motor.current?.siegeSair(),
      siegeKit: (k) => motor.current?.siegeKit(k) ?? false,
      teleportar: (x, z) => motor.current?.teleportar(x, z) ?? false,
      movimento: (id, amostra) => motor.current?.movimento(id, amostra),
    }),
    [],
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        props.vitrine ? "bg-transparent" : "bg-[#6fb8f7]",
        props.dentro && "cursor-grab touch-none active:cursor-grabbing",
        props.className,
      )}
    >
      <div ref={caixa} className="absolute inset-0" role="img" aria-label="Praça HOST em 3D" />
      <div ref={camada} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {estado !== "pronto" && (
        <p className="absolute inset-0 grid place-items-center text-sm font-medium text-white/90">
          {estado === "falhou"
            ? "Não foi possível abrir a praça em 3D neste navegador."
            : "Abrindo a praça…"}
        </p>
      )}
    </div>
  );
});
