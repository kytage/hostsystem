import type * as TH from "three";
import type { Quadro, Reacao } from "./mascote";
import { gerarPassos } from "./boneco-passos";
import { vestirBoneco } from "./boneco-roupa";
import { vestirAcessorios } from "./boneco-acessorios";
import { VIP_BLACK } from "./boneco-vip";

/**
 * O boneco do jogador: o personagem com esqueleto e animações de verdade, que
 * substituiu o HOKI desenhado à mão (novembro de 2026).
 *
 * Dois corpos oficiais, "padrao" e "feminino" (Quaternius, CC0), que usam as
 * mesmas animações. Arquivos em public/hoki/boneco/:
 * - padrao.glb e feminino.glb: só a malha e o esqueleto (sem animações);
 * - animacoes-2.glb: as 43 animações da "Universal Animation Library 2";
 * - animacoes-1.glb (opcional): o pacote 1, com andar, correr, sentar e dançar
 *   comuns. Quando existir, entra sozinho no lugar dos "quebra-galhos" abaixo.
 *
 * Segue o mesmo contrato do mascote antigo (raiz, atualizar, topo, largura,
 * descartar), então a praça, o cartão da tela inicial, a fazenda e o Magnata
 * usam o boneco sem mudar nada. O arquivo baixa uma vez só; até chegar, o
 * boneco fica invisível (é rápido: ~0,6 MB de malha + 1,9 MB de animações).
 */

export type Corpo = "padrao" | "feminino";
export const CORPOS: { id: Corpo; nome: string }[] = [
  { id: "padrao", nome: "Masculino" },
  { id: "feminino", nome: "Feminino" },
];
const ARQUIVO: Record<Corpo, string> = {
  padrao: "/hoki/boneco/padrao.glb",
  feminino: "/hoki/boneco/feminino.glb",
};
const ANIMACOES = ["/hoki/boneco/animacoes-2.glb", "/hoki/boneco/animacoes-1.glb"];

/**
 * Ritmo das pernas do pacote 1, para o pé não patinar: a passada natural do trote
 * é 5,36 m/s e a da disparada 8,25 m/s (medidas na versão com deslocamento, a _RM).
 * Na praça 1 m do boneco vale ~0,85 bloco (2,5 de altura × 0,62 de escala ÷ 1,83 m),
 * então o trote anda ~4,5 blocos/s e a disparada ~7,0; o jogo usa 4,3 e 6,6.
 */
const RITMO_TROTE = 4.3 / (5.36 * 0.847);
const RITMO_DISPARADA = 6.6 / (8.25 * 0.847);

/** Altura do boneco nas unidades do mascote (o HOKI tinha ~1,75; o boneco é um pouco mais alto). */
const ALTURA = 2.5;
/** Altura do boneco nas unidades do mascote (para a praça calcular a proporção do andar). */
export const ALTURA_BONECO = ALTURA;
/**
 * No mundo o boneco fica um tiquinho acima do chão: as pedras do calçamento são
 * mais altas que o gramado e o pé entrava nelas.
 */
const ACIMA_DO_CHAO = 0.18;

/**
 * Cada situação aceita uma lista de animações, da melhor para a reserva: usa a
 * primeira que existir. Os nomes do pacote 1 vêm primeiro (andar e correr de
 * verdade); sem ele, ficam as do pacote 2.
 */
const SITUACAO = {
  parado: ["Idle_Loop", "Idle_No_Loop"],
  andar: ["Jog_Fwd_Loop", "Proc_Trote", "Walk_Carry_Loop"],
  correr: ["Sprint_Loop", "Proc_Disparada", "Jog_Fwd_Loop", "Walk_Carry_Loop"],
  ar: ["Jump_Loop", "NinjaJump_Idle_Loop"],
  sentado: ["Sitting_Idle_Loop", "Sit_Idle_Loop", "Sitting_Loop"],
  carregando: ["Walk_Carry_Loop"],
  danca: ["Dance_Loop", "Dance", "Yes"],
} as const;

/** Reação → animação (lista de preferência) e se ela fica repetindo. */
const REACOES: Record<string, { clipes: readonly string[]; repete?: boolean; ritmo?: number }> = {
  // as antigas (cuidados do cartão, shows e emotes de quem ainda está na versão antiga)
  comer: { clipes: ["Consume"] },
  beber: { clipes: ["Consume"] },
  carinho: { clipes: ["Yes"] },
  festa: { clipes: ["NinjaJump_Land", "Yes"] },
  acenar: { clipes: ["Wave", "Idle_Rail_Call"] },
  cumprimentar: { clipes: ["Yes"] },
  correr: { clipes: SITUACAO.correr, repete: true },
  dancar: { clipes: SITUACAO.danca, repete: true },
  dancinha: { clipes: SITUACAO.danca, repete: true },
  rebolar: { clipes: SITUACAO.danca, repete: true },
  disco: { clipes: SITUACAO.danca, repete: true },
  onda: { clipes: SITUACAO.danca, repete: true },
  robo: { clipes: ["Zombie_Idle_Loop"], repete: true },
  pulinhos: { clipes: ["NinjaJump_Start"], ritmo: 1.4 },
  // as novas (menu de interações)
  bracos: { clipes: ["Idle_FoldArms_Loop"], repete: true },
  telefone: { clipes: ["Idle_TalkingPhone_Loop"], repete: true },
  sim: { clipes: ["Yes"] },
  nao: { clipes: ["Idle_No_Loop"], repete: true },
  chamar: { clipes: ["Idle_Rail_Call"] },
  apoiar: { clipes: ["Idle_Rail_Loop"], repete: true },
  lanterna: { clipes: ["Idle_Lantern_Loop"], repete: true },
  zumbi: { clipes: ["Zombie_Walk_Fwd_Loop"], repete: true },
  arranhar: { clipes: ["Zombie_Scratch"] },
  arremessar: { clipes: ["OverhandThrow"] },
  gancho: { clipes: ["Melee_Hook"] },
  espada: { clipes: ["Sword_Regular_Combo"] },
  combo: { clipes: ["Sword_Heavy_Combo"] },
  escudo: { clipes: ["Idle_Shield_Loop"], repete: true },
  bloquear: { clipes: ["Sword_Block"] },
  plantar: { clipes: ["Farm_PlantSeed"] },
  regar: { clipes: ["Farm_Watering"] },
  colher: { clipes: ["Farm_Harvest"] },
  cortar: { clipes: ["TreeChopping_Loop"], repete: true },
  bau: { clipes: ["Chest_Open"] },
  tombo: { clipes: ["Hit_Knockback"] },
  levantar: { clipes: ["LayToIdle"] },
  poseT: { clipes: ["A_TPose"], repete: true },
  soco: { clipes: ["Punch_Jab", "Melee_Hook"], ritmo: 1.3 },
  // do pacote 1
  conversar: { clipes: ["Idle_Talking_Loop"], repete: true },
  agachar: { clipes: ["Crouch_Idle_Loop"], repete: true },
  cambalhota: { clipes: ["Roll"] },
  cair: { clipes: ["Death01"] },
  magia: { clipes: ["Spell_Simple_Shoot"], ritmo: 0.9 },
  consertar: { clipes: ["Fixing_Kneeling"] },
};

/** Quanto dura cada reação (s), para a praça saber quando repetir ou acabar. */
export const DURACAO_REACAO: Partial<Record<Reacao, number>> = {
  comer: 1.33,
  beber: 1.33,
  carinho: 2.5,
  festa: 1.27,
  acenar: 2.5,
  cumprimentar: 2.5,
  pulinhos: 0.7,
  bracos: 2.5,
  telefone: 2.93,
  sim: 2.5,
  nao: 2.5,
  chamar: 2.5,
  apoiar: 2.5,
  lanterna: 2.5,
  zumbi: 1.33,
  arranhar: 1.8,
  arremessar: 1.33,
  gancho: 1.07,
  espada: 3,
  combo: 4.33,
  escudo: 2.5,
  bloquear: 1.23,
  plantar: 2.77,
  regar: 3.8,
  colher: 2.5,
  cortar: 0.97,
  bau: 1.37,
  tombo: 0.83,
  levantar: 1.53,
  poseT: 2.5,
  soco: 0.66,
  dancar: 2,
  dancinha: 2,
  rebolar: 2,
  disco: 2,
  onda: 2,
  conversar: 2.93,
  agachar: 2.93,
  cambalhota: 1.47,
  cair: 2.4,
  magia: 0.56,
  consertar: 5.2,
};

/** O menu de interações da praça (e do cartão): nome no botão e a reação. */
export const INTERACOES_BONECO: { id: Reacao; nome: string; grupo: string }[] = [
  // só as que ficam boas sem objeto na mão. Fora do menu por enquanto (a refazer): acenar
  // (nenhum dos dois pacotes tem), chamar, apoiado, lanterna, mortal, pose T, espada, combo,
  // bloquear, escudo, plantar, regar, colher, cortar lenha e abrir baú.
  { id: "bracos", nome: "Braços cruzados", grupo: "Gestos" },
  { id: "sim", nome: "Sim", grupo: "Gestos" },
  { id: "nao", nome: "Não", grupo: "Gestos" },
  { id: "telefone", nome: "No telefone", grupo: "Gestos" },
  { id: "comer", nome: "Comer", grupo: "Gestos" },
  { id: "girar", nome: "Girar", grupo: "Diversão" },
  { id: "zumbi", nome: "Zumbi", grupo: "Diversão" },
  { id: "arranhar", nome: "Arranhar", grupo: "Diversão" },
  { id: "tombo", nome: "Tombo", grupo: "Diversão" },
  { id: "levantar", nome: "Levantar do chão", grupo: "Diversão" },
  { id: "dancar", nome: "Dançar", grupo: "Diversão" },
  { id: "conversar", nome: "Conversando", grupo: "Gestos" },
  { id: "agachar", nome: "Agachar", grupo: "Gestos" },
  { id: "cambalhota", nome: "Cambalhota", grupo: "Diversão" },
  { id: "cair", nome: "Cair", grupo: "Diversão" },
  { id: "magia", nome: "Magia", grupo: "Diversão" },
  { id: "consertar", nome: "Consertar", grupo: "Gestos" },
  { id: "gancho", nome: "Gancho", grupo: "Luta" },
  { id: "arremessar", nome: "Arremessar", grupo: "Luta" },
];

/** As reações que o corpo inteiro faz girando (sem animação no arquivo). */
const GIROS = new Set<string>(["girar", "rolar", "mortal"]);

/* ------------------------------------------------------------------ */
/* arquivos (baixados uma vez só)                                     */
/* ------------------------------------------------------------------ */

interface Pacote {
  cenas: Partial<Record<Corpo, TH.Object3D>>;
  clipes: Map<string, TH.AnimationClip>;
}
let pacote: Pacote | null = null;
let pedido: Promise<Pacote | null> | null = null;
const esperando = new Set<() => void>();

/** Baixa os dois corpos e as animações (uma vez; quem chamar de novo recebe o mesmo). */
export function carregarBonecos(): Promise<Pacote | null> {
  if (pacote) return Promise.resolve(pacote);
  if (!pedido) {
    pedido = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(async ({ GLTFLoader }) => {
        const leitor = new GLTFLoader();
        const pegar = (url: string) => leitor.loadAsync(url).catch(() => null);
        const [padrao, feminino, ...anims] = await Promise.all([
          pegar(ARQUIVO.padrao),
          pegar(ARQUIVO.feminino),
          ...ANIMACOES.map(pegar),
        ]);
        if (!padrao) throw new Error("boneco não baixou");
        const clipes = new Map<string, TH.AnimationClip>();
        for (const g of anims) for (const c of g?.animations ?? []) clipes.set(c.name, c);
        const p: Pacote = {
          cenas: { padrao: padrao.scene, ...(feminino ? { feminino: feminino.scene } : {}) },
          clipes,
        };
        pacote = p;
        for (const f of esperando) f();
        esperando.clear();
        return p;
      })
      .catch(() => {
        pedido = null; // falhou (rede): a próxima tentativa baixa de novo
        return null;
      });
  }
  return pedido;
}

/** O pacote já chegou? (para quem quer esperar antes de mostrar, como as miniaturas) */
export const bonecosProntos = () => !!pacote;

const primeiro = (clipes: Map<string, TH.AnimationClip>, nomes: readonly string[]) => {
  for (const n of nomes) {
    const c = clipes.get(n);
    if (c) return c;
  }
  return null;
};

export interface Boneco {
  raiz: TH.Object3D;
  atualizar(q: Quadro): number;
  topo: number;
  largura: number;
  descartar(): void;
}

/** Um boneco pronto para pôr na cena (aparece assim que os arquivos chegarem). */
/** `mundo`: está num cenário com calçamento (praça, fazenda, Magnata), e não num pódio. */
export function criarBoneco(
  THREE: typeof TH,
  corpo: Corpo = "padrao",
  mundo = false,
  extras: {
    chapeu?: string | undefined;
    costas?: string | undefined;
    traje?: string | undefined;
  } = {},
): Boneco {
  let acessorios: ReturnType<typeof vestirAcessorios> | null = null;
  const raiz = new THREE.Group();
  raiz.name = "boneco";
  const giro = new THREE.Group(); // giros de corpo inteiro (mortal, estrelinha)
  raiz.add(giro);
  let vivo = true;
  let mixer: TH.AnimationMixer | null = null;
  let clipes: Map<string, TH.AnimationClip> = new Map();
  let atual: TH.AnimationAction | null = null;
  let chaveAtual = "";
  let ultimoP = -1;
  const acoes = new Map<TH.AnimationClip, TH.AnimationAction>();

  const montar = async () => {
    const p = pacote ?? (await carregarBonecos());
    if (!vivo || !p) return;
    const { clone } = await import("three/examples/jsm/utils/SkeletonUtils.js");
    if (!vivo) return;
    const molde = p.cenas[corpo] ?? p.cenas.padrao!;
    const figura = clone(molde);
    // o arquivo tem 1,83 m; aqui ele fica com a ALTURA do mascote
    figura.scale.setScalar(ALTURA / 1.83);
    vestirBoneco(THREE, figura, corpo, undefined, extras.traje === VIP_BLACK);
    acessorios = vestirAcessorios(THREE, figura, {
      chapeu: extras.chapeu,
      costas: extras.costas,
      traje: extras.traje,
      alturaCabeca: corpo === "feminino" ? 1.81 : 1.83,
    });
    figura.traverse((o) => {
      const m = o as TH.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
    // corridas feitas por código (uma vez só, medidas no primeiro boneco que chegar)
    if (!p.clipes.has("Proc_Trote")) {
      const base = primeiro(p.clipes, SITUACAO.parado);
      if (base) for (const c of gerarPassos(THREE, figura, base)) p.clipes.set(c.name, c);
    }
    if (mundo) figura.position.y = ACIMA_DO_CHAO;
    giro.add(figura);
    clipes = p.clipes;
    mixer = new THREE.AnimationMixer(figura);
  };
  void montar();

  const acao = (c: TH.AnimationClip) => {
    let a = acoes.get(c);
    if (!a && mixer) {
      a = mixer.clipAction(c);
      acoes.set(c, a);
    }
    return a ?? null;
  };

  /**
   * Toca uma animação. `tempo` fixa o quadro (para as poses paradas, como
   * deitado); `uma` toca uma vez e para no último quadro.
   */
  const tocar = (
    chave: string,
    nomes: readonly string[],
    o: { uma?: boolean; ritmo?: number; tempo?: number; fade?: number; recomeca?: boolean } = {},
  ) => {
    if (!mixer) return;
    const c = primeiro(clipes, nomes);
    if (!c) return;
    const a = acao(c);
    if (!a) return;
    a.timeScale = o.tempo !== undefined ? 0 : (o.ritmo ?? 1);
    if (chave === chaveAtual && !o.recomeca) {
      if (o.tempo !== undefined) a.time = o.tempo * c.duration;
      return;
    }
    a.reset();
    a.setLoop(o.uma ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = true;
    if (o.tempo !== undefined) a.time = o.tempo * c.duration;
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (atual && atual !== a) a.crossFadeFrom(atual, o.fade ?? 0.2, false);
    a.play();
    atual = a;
    chaveAtual = chave;
  };

  let antes = -1;
  const atualizar = (q: Quadro) => {
    const dt = antes < 0 ? 0 : Math.max(0, Math.min(0.1, q.t - antes));
    antes = q.t;
    giro.rotation.set(0, 0, 0);
    giro.position.set(0, 0, 0);

    const r = q.reacao;
    const recomeca = r !== null && q.p < ultimoP; // a mesma reação de novo (p voltou a zero)
    ultimoP = r ? q.p : -1;

    if (q.deitado) {
      // no berço: deitado de costas (primeiro quadro do "levantar do chão")
      tocar("deitado", ["LayToIdle"], { tempo: 0, fade: 0.1 });
    } else if (q.pose === "montado") {
      if (primeiro(clipes, SITUACAO.sentado)) tocar("montado", SITUACAO.sentado);
      else tocar("montado", ["LayToIdle"], { tempo: 0.34 });
    } else if (q.sentado) {
      // sentado no banco: pose de sentar do pacote 1; sem ele, o "sentado no chão" do levantar
      if (primeiro(clipes, SITUACAO.sentado)) {
        tocar("sentado", SITUACAO.sentado);
        // sentado de verdade (pacote 1): o quadril fica a ~0,44 m do pé e um pouco para trás;
        // desce e adianta o corpo para o bumbum ficar no assento, onde a praça põe o boneco
        giro.position.set(0, -0.44 * (ALTURA / 1.83), 0.245 * (ALTURA / 1.83));
      } else tocar("sentado", ["LayToIdle"], { tempo: 0.34 });
    } else if (r === "soco") {
      // soco (botão direito): sai até correndo ou no ar, e é rápido
      tocar("r:soco", ["Punch_Jab", "Melee_Hook"], { uma: true, ritmo: 1.3, fade: 0.06, recomeca });
    } else if (q.noAr) {
      tocar("ar", SITUACAO.ar, { fade: 0.12 });
    } else if (q.andando) {
      if (q.pose === "carrega") tocar("carrega", SITUACAO.carregando, { ritmo: 1.2 });
      else if (q.correndo || q.pose === "turbo")
        tocar("correr", SITUACAO.correr, {
          ritmo: clipes.has("Sprint_Loop")
            ? q.velocidade !== undefined
              ? Math.max(0.5, q.velocidade / 8.25)
              : RITMO_DISPARADA
            : clipes.has("Proc_Disparada")
              ? 1
              : 1.75,
          fade: 0.16,
        });
      else
        tocar("andar", SITUACAO.andar, {
          ritmo: clipes.has("Jog_Fwd_Loop")
            ? q.velocidade !== undefined
              ? Math.max(0.5, q.velocidade / 5.36)
              : RITMO_TROTE
            : clipes.has("Proc_Trote")
              ? 1
              : 1.35,
          fade: 0.18,
        });
    } else if (q.pousando && !r) {
      // acabou de pousar de um pulo
      tocar("pouso", ["Jump_Land", "NinjaJump_Land"], { uma: true, fade: 0.08 });
    } else if (r && GIROS.has(r)) {
      // giros: o corpo inteiro roda (girar = pião, mortal = para trás, rolar = estrelinha)
      tocar("parado", SITUACAO.parado);
      const dur = r === "girar" ? 1 : r === "mortal" ? 1.1 : 1.2;
      const k = Math.min(1, q.p / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const alto = ALTURA * 0.5;
      if (r === "girar") giro.rotation.y = e * Math.PI * 2;
      else {
        const eixo = r === "mortal" ? "x" : "z";
        giro.position.y = Math.sin(k * Math.PI) * ALTURA * 0.45;
        giro.rotation[eixo] = -e * Math.PI * 2;
        // gira em volta da cintura, não dos pés
        giro.position.y += alto - Math.cos(giro.rotation[eixo]) * alto;
        if (eixo === "x") giro.position.z = Math.sin(giro.rotation.x) * alto;
        else giro.position.x = -Math.sin(giro.rotation.z) * alto;
      }
    } else if (r && REACOES[r]) {
      const def = REACOES[r]!;
      tocar(`r:${r}`, def.clipes, {
        uma: !def.repete,
        ritmo: def.ritmo ?? 1,
        fade: 0.2,
        recomeca,
      });
    } else if (q.pose === "carrega") {
      tocar("carrega-parado", SITUACAO.carregando, { tempo: 0.1 });
    } else if (q.pose === "abraco") {
      tocar("abraco", ["Idle_FoldArms_Loop"]);
    } else if (q.pose === "corda") {
      tocar("corda", ["NinjaJump_Start"], { ritmo: 1.5 });
    } else {
      tocar("parado", SITUACAO.parado, { fade: 0.25 });
    }
    mixer?.update(dt);
    acessorios?.atualizar(q.t, q.noAr ? 0.7 : q.andando ? (q.correndo ? 1 : 0.6) : 0, dt);
    return 0;
  };

  return {
    raiz,
    atualizar,
    topo: ALTURA,
    largura: 1.1,
    descartar() {
      vivo = false;
      acessorios?.descartar();
      mixer?.stopAllAction();
      mixer?.uncacheRoot(mixer.getRoot());
      raiz.clear();
    },
  };
}

/** Avisa quando os bonecos chegarem (para telas que desenham uma foto só, sem animar). */
export function quandoBonecosChegarem(f: () => void) {
  if (pacote) f();
  else {
    esperando.add(f);
    void carregarBonecos();
  }
  return () => esperando.delete(f);
}
