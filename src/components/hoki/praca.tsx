import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Gamepad2,
  Gift,
  Mail,
  Hash,
  Layers,
  Maximize2,
  Minimize2,
  Square,
  Store,
  UserRound,
  Users,
  Minus,
  Plus,
  Send,
  Smile,
  Sparkles,
  Sunrise,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Magnata } from "./magnata";
import { SHOWS, infoDoShow, type Show, type TipoShow } from "@/lib/hoki-shows";
import { cn } from "@/lib/utils";
import {
  coresDe,
  SUJO_ABAIXO_DE,
  todosPets,
  VISUAL_PADRAO,
  type HokiPet,
  type Visual,
} from "@/lib/hoki";
import { Hoki2D } from "./hoki-2d";
import { ControlesDeToque } from "./controles-toque";
import { INTERACOES_BONECO } from "./boneco";
import { RodaDeAnimacoes } from "./roda-animacoes";
import { SiegeHud } from "./siege/siege-hud";
import { PortalSiege, SalaSiege } from "./siege/portal-siege";
import {
  entrarNaFila,
  entrarNaSala,
  novoCodigo as novoCodigoDeSala,
  type InicioPartida,
  type NaFila,
} from "@/lib/siege/rede";
import { SIEGE } from "@/lib/siege/config";
import type { EstadoSiege } from "./siege/siege-mundo";
import {
  abrirMovimento,
  definirLugar,
  enviarMovimento,
  enviarNaPraca,
  fecharMovimento,
  olhandoMovimento,
  ouvirMovimento,
  enviarShow,
  ouvirNaPraca,
  reiniciarPraca,
  meuLugar,
  usePresencaHoki,
  DUPLAS,
  STATUS_NA_FAZENDA,
  type Dupla,
  type Par,
  type Mensagem,
  type PresencaHoki,
} from "@/lib/hoki-presenca";
import {
  esquecerConvite,
  novoCodigo,
  pegarPedidoDeAbrir,
  salaGuardada,
  useConvitesMagnata,
} from "@/lib/hoki-magnata-sala";
import {
  criarJogo,
  gravarJogo,
  jogosAtivos,
  type Cartas,
  type Jogo,
  type Pessoa,
} from "@/lib/hoki-jogos";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { CartasDialog, VelhaDialog } from "./jogos-online";
import { DesafioDialog, FestaDialog, novoDesafio } from "./minijogos-online";
import { DESAFIOS, NOME_DO_JOGO, participantes, type Festa } from "@/lib/hoki-minijogos";
import type { Reacao } from "./mascote";
import { Coins, Copy, Link2, Loader2, UserPlus, Zap } from "lucide-react";
import { criarConviteHoki, useSouVisita, type ConviteHoki } from "@/lib/hoki-visita";
import { copiarTexto } from "@/lib/copiar";
import { ROLE_TAG } from "@/lib/roles";
import { isCoordinatorPlus, useMyRole } from "@/lib/permissions";
import { Mundo3D, type Mundo3DRef, type PessoaMundo } from "./mundo-3d";
import { pausarMundo3D } from "./mundo-pausa";
import {
  ajustar,
  BANCOS,
  CANTEIROS,
  CHEGADA,
  CHUVEIRO,
  CENTRO_DO_COMERCIO,
  COMERCIO_NA_PRACA,
  CORREIO,
  FRENTE_DO_COMERCIO,
  FRENTE_DO_CORREIO,
  FRENTE_DO_PORTAL,
  FRENTE_DO_PORTAL_FAZENDAS,
  naPortaDoCeleiro,
  naFrenteDoRanking,
  naBeiraDaFonte,
  PORTAL,
  FRENTE_DO_TERMOMETRO,
  type Ponto,
  FRENTE_SIEGE,
} from "./mundo-mapa";
import { buscarRankings, quadroDoRanking, RANKINGS } from "@/lib/hoki-rankings";
import { Fazenda } from "./fazenda/fazenda";
import { PortalDasFazendas } from "./fazenda/portal-fazendas";
import type { PresenteNaIlha } from "./fazenda/ilhas-de";
import { OnlineAgora, type PessoaOnlineAgora } from "./online-agora";
import { Comercio } from "./comercio";
import { useSelos } from "@/lib/fazenda/selos";
import { CULTURAS, faltaParaCrescer, item, ITENS, quantosCabem } from "@/lib/hoki-itens";
import { Queridometro, useQueridometro } from "./queridometro";
import { EMOJIS_STATUS, STATUS_PRONTOS, useStatusHoki } from "@/lib/hoki-status";
import { PerfilHoki } from "./perfil";
import { Correio, useCorreio } from "./correio";

type Presenca = PresencaHoki;

const FALA_MS = 6500;
const TRUQUES: Reacao[] = [
  "acenar",
  "girar",
  "dancar",
  "correr",
  "rolar",
  "mortal",
  "cumprimentar",
  "festa",
  "dancinha",
  "rebolar",
  "robo",
  "onda",
  "pulinhos",
  "disco",
  ...INTERACOES_BONECO.map((i) => i.id),
  "soco",
  "atkEspada",
  "atkArco",
  "atkCajado",
  "atkAdaga",
];
/** Interações em dupla: o nome no botão, o que aparece no convite e quanto duram (as de tempo certo). */
const INTERACOES: Record<Dupla, { nome: string; convite: string; emoji: string; dura?: number }> = {
  maos: { nome: "Mãos dadas", convite: "andar de mãos dadas", emoji: "🤝" },
  cavalinho: { nome: "Cavalinho", convite: "te carregar de cavalinho", emoji: "🐴" },
  colo: { nome: "Pegar no colo", convite: "te pegar no colo", emoji: "🤗" },
  corda: { nome: "Pular corda", convite: "pular corda", emoji: "✨", dura: 12_000 },
  abraco: { nome: "Abraço", convite: "te dar um abraço", emoji: "💞", dura: 4_500 },
};
const CONVITE_MS = 20_000;
/** Quantas mensagens ficam no canto da praça e por quanto tempo. */
const MAX_CONVERSA = 4;
const CONVERSA_MS = 60_000;
/**
 * Praça HOST: o mundo 3D compartilhado. Quem está com o site aberto aparece
 * dormindo no berço; ao acordar, o HOKI desce o escorregador e aí anda, senta,
 * conversa por balões, desafia os outros e vai até o termômetro (queridômetro).
 */
export function Praca({
  pet,
  dentro,
  truque,
  aoAlternar,
  emotes,
  aoEmote,
  aoRanking,
  aoCoins,
  aoSolo,
  aoSalvar,
  salvando,
  telaCheia,
  aoTelaCheia,
}: {
  pet: HokiPet;
  dentro: boolean;
  truque: { tipo: Reacao; n: number } | null;
  aoAlternar: () => void;
  emotes: { id: Reacao; nome: string }[];
  aoEmote: (id: Reacao) => void;
  aoRanking: () => void;
  /** Só para quem entrega Staff Coins: mostra o botão de moedas. */
  aoCoins?: (() => void) | undefined;
  /** Abre os mini-games de jogar sozinho (petiscos e reflexo). */
  aoSolo: () => void;
  /** Grava mudanças no pet (aqui: o que foi colhido na fazenda). `salvando` segura cliques repetidos. */
  aoSalvar: (patch: Partial<Pick<HokiPet, "inventario" | "colheitas" | "higiene">>) => void;
  salvando: boolean;
  /** O HOKI está ocupando a tela inteira? E o botão que alterna. */
  telaCheia: boolean;
  aoTelaCheia: () => void;
}) {
  const { data: cargo } = useMyRole();
  const souVisita = useSouVisita();
  const minhaTag = souVisita ? "VIS" : cargo ? ROLE_TAG[cargo] : "";
  const [emotesAberto, setEmotesAberto] = useState(false);
  useEffect(() => setEmotesAberto(false), [dentro]);
  const qc = useQueryClient();
  const euPessoa = useMemo<Pessoa>(
    () => ({ id: pet.user_id, nome: pet.username || pet.nome }),
    [pet.user_id, pet.username, pet.nome],
  );
  // Texto estável do visual: só muda (e só reenvia a presença) quando o pet troca de aparência.
  const visualTxt = JSON.stringify(pet.visual);
  const meuVisual = useMemo(() => JSON.parse(visualTxt) as Visual, [visualTxt]);
  /** Com 10% ou menos de fome ou de sede, o HOKI anda devagar (todos veem). */
  const lento = pet.fome <= 10 || pet.sede <= 10;

  const { outros } = usePresencaHoki();
  // voltando de outra tela do painel: o HOKI continua de onde estava (andando ou sentado)
  const [eu, setEu] = useState<{ x: number; z: number; banco: number | null }>(() => {
    const l = meuLugar();
    return l.dorme ? { ...CHEGADA, banco: null } : { x: l.x, z: l.z, banco: l.banco };
  });
  const [falas, setFalas] = useState<Record<string, { texto: string; ate: number }>>({});
  const [texto, setTexto] = useState("");
  // O status fica guardado neste navegador e é o mesmo do Perfil & Agenda.
  const [status, gravarStatus] = useStatusHoki();
  const [editandoStatus, setEditandoStatus] = useState(false);
  const [rascunho, setRascunho] = useState({ emoji: "📘", texto: "" });
  const salvarStatus = (novo: string) => {
    gravarStatus(novo);
    setEditandoStatus(false);
  };
  const [alvo, setAlvo] = useState<Presenca | null>(null);
  const [indoAoTermometro, setIndoAoTermometro] = useState(false);
  const [indoAoCorreio, setIndoAoCorreio] = useState(false);
  const [queridometro, setQueridometro] = useState(false);
  /** Indo até alguém para abrir as ações (o id da pessoa). */
  const [indoAte, setIndoAte] = useState<string | null>(null);
  /** Animação em repetição: fica rodando até apertar parar. */
  const [animacao, setAnimacao] = useState<Reacao | null>(null);
  /** Minha dupla: quem eu estou acompanhando (mãos dadas, cavalinho, corda ou abraço). */
  const [par, setPar] = useState<Par | null>(null);
  /** Convite que mandei e ainda não foi respondido, e os que recebi. */
  const [pedido, setPedido] = useState<{ para: string; nome: string; tipo: Dupla } | null>(null);
  const [convites, setConvites] = useState<
    { de: string; nome: string; tipo: Dupla; ate: number }[]
  >([]);
  const [perfilDe, setPerfilDe] = useState<string | null>(null);
  /** HOST FAZENDAS: o portal do celeiro e a ilha aberta (a minha ou a de um amigo). */
  const [portalFazendas, setPortalFazendas] = useState(false);
  /** HOST SIEGE: o painel do portal e o estado da partida (para a tela do jogo). */
  const [siegeAberto, setSiegeAberto] = useState(false);
  const [estadoSiege, setEstadoSiege] = useState<EstadoSiege | null>(null);
  /** Fila pública: quem está nela e quando a partida começa. */
  const [fila, setFila] = useState<{ lista: NaFila[]; comecaEm: number | null } | null>(null);
  const filaRef = useRef<{ sair: () => void } | null>(null);
  /** Sala privada: código, quem entrou e quem é o anfitrião. */
  const [sala, setSala] = useState<{
    codigo: string;
    lista: NaFila[];
    anfitriao: string | null;
  } | null>(null);
  const salaRef = useRef<ReturnType<typeof entrarNaSala> | null>(null);
  const [, setTiqueFila] = useState(0);
  const [fazenda, setFazenda] = useState<{
    visitar: string | null;
    painel: "vizinhos" | "correio" | null;
    vez: number;
  } | null>(null);
  const [jogosAberto, setJogosAberto] = useState(false);
  const [correioAberto, setCorreioAberto] = useState(false);
  /** Comércio do lobby: a barraca de feira (vender e comprar itens com Staff Coins). */
  const [comercioAberto, setComercioAberto] = useState(false);
  const [indoAoComercio, setIndoAoComercio] = useState(false);
  /** Presentes que me ofereceram (cada um vence em 30 segundos). */
  const [ofertas, setOfertas] = useState<
    { de: string; nome: string; item: string; n: number; ate: number }[]
  >([]);
  /** O que está ao alcance do meu HOKI agora (para a tecla E): termômetro, parkour ou uma cadeira do escritório. */
  const [perto, setPerto] = useState<
    | {
        tipo:
          | "termometro"
          | "chuveiro"
          | "correio"
          | "portal"
          | "fazendas"
          | "comercio"
          | "ranking"
          | "fonte"
          | "siege";
      }
    | { tipo: "cadeira" | "canteiro"; i: number }
    | null
  >(null);
  const [indoAoCanteiro, setIndoAoCanteiro] = useState<number | null>(null);
  /** Arco do RANKING: câmera em primeira pessoa de frente para o letreiro, e qual ranking está nele. */
  const [vistaRanking, setVistaRanking] = useState(false);
  const [paginaRanking, setPaginaRanking] = useState(0);
  /** Depois de sair com F, só abre sozinho de novo quando a pessoa sair da frente do arco. */
  const rankingArmado = useRef(true);
  /** Correio aberto direto em "escrever", para mandar comida/bebida a alguém. */
  const [escreverPara, setEscreverPara] = useState<{ id: string; nome: string } | null>(null);
  /** Sentado numa cadeira do escritório: o status vira "Trabalhando" até levantar. */
  const [trabalhando, setTrabalhando] = useState(() => {
    const l = meuLugar();
    return !l.dorme && l.banco !== null && l.status === "💻 Trabalhando";
  });
  // trabalhando no escritório ou dentro do HOST FAZENDAS, o status mostra isso para todos
  const statusAtual = fazenda ? STATUS_NA_FAZENDA : trabalhando ? "💻 Trabalhando" : status;
  const [velhaId, setVelhaId] = useState<string | null>(null);
  /** Partida aberta de dama, ligue 4 ou pedra-papel-tesoura. */
  const [desafioId, setDesafioId] = useState<string | null>(null);
  const [festaAberta, setFestaAberta] = useState(false);
  /** Escolhendo qual jogo mandar para alguém. */
  const [escolhendoDesafio, setEscolhendoDesafio] = useState<Presenca | null>(null);
  const [cartas, setCartas] = useState(false);
  const mundo = useRef<Mundo3DRef>(null);
  const ultimaFala = useRef(0);
  const vistas = useRef(new Set<string>());

  /* ---------- mensagens da praça: as últimas aparecem no canto, com o nome e a fotinha de quem mandou ---------- */
  const [conversa, setConversa] = useState<
    { chave: string; nome: string; tag: string; visual: Visual; texto: string; em: number }[]
  >([]);
  const outrosRef = useRef(outros);
  outrosRef.current = outros;
  const anotarFala = useRef((quem: { nome: string; tag: string; visual: Visual }, texto: string) =>
    setConversa((l) =>
      [
        ...l,
        {
          ...quem,
          texto,
          em: Date.now(),
          chave: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      ].slice(-MAX_CONVERSA),
    ),
  ).current;
  // cada mensagem some do canto depois de um minuto
  const temConversa = conversa.length > 0;
  useEffect(() => {
    if (!temConversa) return;
    const id = setInterval(
      () => setConversa((l) => l.filter((m) => Date.now() - m.em < CONVERSA_MS)),
      2000,
    );
    return () => clearInterval(id);
  }, [temConversa]);

  /* ---------- ao vivo: falas e truques dos outros (a presença vem do canal único do site) ---------- */
  useEffect(() => {
    const pararFala = ouvirNaPraca("fala", (p) => {
      const { id, texto } = p;
      if (typeof id !== "string" || typeof texto !== "string") return;
      setFalas((f) => ({ ...f, [id]: { texto: texto.slice(0, 90), ate: Date.now() + FALA_MS } }));
      const quem = outrosRef.current[id];
      anotarFala(
        {
          nome: quem?.nome ?? "alguém",
          tag: quem?.tag ?? "",
          visual: quem?.visual ?? VISUAL_PADRAO,
        },
        texto.slice(0, 90),
      );
    });
    const pararTruque = ouvirNaPraca("truque", (p) => {
      const { id } = p;
      const tipo = TRUQUES.find((t) => t === p.tipo);
      if (typeof id === "string" && tipo) mundo.current?.truque(id, tipo);
    });
    return () => {
      pararFala();
      pararTruque();
    };
  }, [anotarFala]);

  /* ---------- movimento contínuo dos outros (andar com o teclado, correr, pular) ---------- */
  useEffect(() => {
    abrirMovimento();
    const parar = ouvirMovimento((m) => mundo.current?.movimento(m.id, m));
    return () => {
      parar();
      fecharMovimento();
    };
  }, []);

  /* ---------- HOST SIEGE: fila pública, sala privada e aviso para todos ---------- */
  const comecarPartidaSiege = (m: InicioPartida) => {
    filaRef.current?.sair();
    filaRef.current = null;
    setFila(null);
    salaRef.current?.sair();
    salaRef.current = null;
    setSala(null);
    setSiegeAberto(false);
    mundo.current?.siegeRede(m);
  };
  const alternarFila = () => {
    if (filaRef.current) {
      filaRef.current.sair();
      filaRef.current = null;
      setFila(null);
      return;
    }
    if (!dentro) {
      toast.info("Acorde o seu HOKI primeiro.");
      return;
    }
    filaRef.current = entrarNaFila(
      { id: euPessoa.id, nome: euPessoa.nome },
      {
        aoMudar: (lista, comecaEm) => setFila({ lista, comecaEm }),
        aoPartida: comecarPartidaSiege,
        aoAvisarTodos: () =>
          enviarNaPraca("siege", {
            texto: "HOST SIEGE começa em 2 minutos! Entre na fila pelo portal da ilha EM BREVE.",
          }),
      },
    );
    setFila({ lista: [], comecaEm: null });
    setSiegeAberto(false);
    toast.success("Você entrou na fila do HOST SIEGE. Pode continuar andando pelo lobby.");
  };
  const abrirSala = (codigo: string) => {
    salaRef.current?.sair();
    const c = codigo.trim().toUpperCase();
    if (c.length !== 4) {
      toast.info("O código tem 4 letras.");
      return;
    }
    salaRef.current = entrarNaSala(
      c,
      { id: euPessoa.id, nome: euPessoa.nome },
      {
        aoMudar: (lista, anfitriao) => setSala({ codigo: c, lista, anfitriao }),
        aoPartida: comecarPartidaSiege,
      },
    );
    setSala({ codigo: c, lista: [], anfitriao: null });
  };
  // a contagem da fila anda na tela, e sair da praça tira da fila e da sala
  useEffect(() => {
    if (!fila?.comecaEm) return;
    const t = setInterval(() => setTiqueFila((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [fila?.comecaEm]);
  useEffect(
    () => () => {
      filaRef.current?.sair();
      salaRef.current?.sair();
    },
    [],
  );
  // aviso para todo mundo online quando uma partida vai começar
  useEffect(
    () =>
      ouvirNaPraca("siege", (m) => {
        if (typeof m.texto === "string") toast.info(m.texto, { duration: 8000 });
      }),
    [],
  );

  /* ---------- interações em dupla: convite, resposta e soltar ---------- */
  useEffect(() => {
    const meu = euPessoa.id;
    const pararConvite = ouvirNaPraca("convite", (m) => {
      const tipo = DUPLAS.find((d) => d === m.tipo);
      if (m.para !== meu || typeof m.de !== "string" || !tipo) return;
      const de = m.de;
      const nome = String(m.nome ?? "alguém").slice(0, 24);
      playSfx("pop");
      setConvites((l) => [
        ...l.filter((c) => c.de !== de),
        { de, nome, tipo, ate: Date.now() + CONVITE_MS },
      ]);
    });
    const pararResposta = ouvirNaPraca("resposta", (m) => {
      const tipo = DUPLAS.find((d) => d === m.tipo);
      if (m.para !== meu || typeof m.de !== "string" || !tipo) return;
      const de = m.de;
      setPedido((atual) => {
        if (!atual || atual.para !== de || atual.tipo !== tipo) return atual;
        if (m.aceita === true) {
          playSfx("success");
          setAnimacao(null);
          setPar({ com: de, tipo });
        } else toast.info(`${atual.nome} não quis agora.`);
        return null;
      });
    });
    const pararSoltar = ouvirNaPraca("soltar", (m) => {
      if (m.para !== meu || typeof m.de !== "string") return;
      const de = m.de;
      setPar((atual) => (atual && atual.com === de ? null : atual));
    });
    return () => {
      pararConvite();
      pararResposta();
      pararSoltar();
    };
  }, [euPessoa.id]);
  // convites vencem sozinhos; as interações de tempo certo (corda, abraço) acabam sozinhas
  const temConvites = convites.length > 0 || !!pedido || ofertas.length > 0;
  useEffect(() => {
    if (!temConvites) return;
    const id = setInterval(() => {
      setConvites((l) => l.filter((c) => c.ate > Date.now()));
      setOfertas((l) => l.filter((o) => o.ate > Date.now()));
    }, 1000);
    const vence = setTimeout(() => setPedido(null), CONVITE_MS);
    return () => {
      clearInterval(id);
      clearTimeout(vence);
    };
  }, [temConvites]);
  useEffect(() => {
    const dura = par ? INTERACOES[par.tipo].dura : undefined;
    if (!dura) return;
    const id = setTimeout(() => setPar(null), dura);
    return () => clearTimeout(id);
  }, [par]);

  /* ---------- presentes: dar um item da mochila para quem está perto (a pessoa precisa aceitar) ---------- */
  // as mensagens chegam fora do ciclo do React: os ouvintes leem sempre o pet e o salvar mais novos
  const petRef = useRef(pet);
  petRef.current = pet;
  const salvandoRef = useRef(salvando);
  salvandoRef.current = salvando;
  const aoSalvarRef = useRef(aoSalvar);
  aoSalvarRef.current = aoSalvar;
  const [darPara, setDarPara] = useState<Presenca | null>(null);
  const ofertando = useRef<{ para: string; nome: string; item: string; n: number } | null>(null);
  const aguardando = useRef(new Map<string, { item: string; n: number }>());
  /** Grava a mochila nova quando o salvamento anterior terminar (dois juntos podiam se atropelar). */
  const guardarMochila = useRef(
    (muda: (inv: Record<string, number>) => Record<string, number> | null, tentativas = 14) => {
      const tentar = (resto: number) => {
        if (salvandoRef.current && resto > 0) {
          setTimeout(() => tentar(resto - 1), 350);
          return;
        }
        const nova = muda(petRef.current.inventario);
        if (nova) aoSalvarRef.current({ inventario: nova });
      };
      tentar(tentativas);
    },
  ).current;
  const comMais = (inv: Record<string, number>, id: string, n: number) => ({
    ...inv,
    [id]: (inv[id] ?? 0) + n,
  });
  const comMenos = (inv: Record<string, number>, id: string, n: number) => {
    const resto = (inv[id] ?? 0) - n;
    if (resto < 0) return null;
    const novo = { ...inv, [id]: resto };
    if (resto === 0) delete novo[id];
    return novo;
  };
  useEffect(() => {
    const meu = euPessoa.id;
    const lerItem = (m: Mensagem) => {
      const id = typeof m.item === "string" ? m.item : "";
      const n = typeof m.n === "number" && Number.isInteger(m.n) ? m.n : 0;
      return item(id) && n > 0 && n <= 99 ? { id, n } : null;
    };
    const nomeDo = (id: string) => `${item(id)?.emoji ?? ""} ${item(id)?.nome ?? id}`;
    const pararOferta = ouvirNaPraca("presente", (m) => {
      const it = lerItem(m);
      if (m.para !== meu || typeof m.de !== "string" || !it) return;
      const de = m.de;
      const nome = String(m.nome ?? "alguém").slice(0, 24);
      playSfx("pop");
      setOfertas((l) => [
        ...l.filter((o) => o.de !== de),
        { de, nome, item: it.id, n: it.n, ate: Date.now() + 30_000 },
      ]);
    });
    const pararResposta = ouvirNaPraca("presente-resposta", (m) => {
      const o = ofertando.current;
      const it = lerItem(m);
      if (m.para !== meu || !o || m.de !== o.para || !it || it.id !== o.item || it.n !== o.n)
        return;
      ofertando.current = null;
      if (m.aceita !== true) {
        toast.info(`${o.nome} não aceitou o presente.`);
        return;
      }
      if ((petRef.current.inventario[o.item] ?? 0) < o.n) {
        toast.error("Você não tem mais esse item na mochila.");
        enviarNaPraca("presente-entregue", { de: meu, para: o.para, item: o.item, n: 0 });
        return;
      }
      guardarMochila((inv) => comMenos(inv, o.item, o.n));
      enviarNaPraca("presente-entregue", { de: meu, para: o.para, item: o.item, n: o.n });
      playSfx("success");
      toast.success(`Você deu ${o.n} ${nomeDo(o.item)} para ${o.nome}.`);
    });
    const pararEntrega = ouvirNaPraca("presente-entregue", (m) => {
      if (m.para !== meu || typeof m.de !== "string") return;
      const esperado = aguardando.current.get(m.de);
      aguardando.current.delete(m.de);
      const it = lerItem(m);
      if (!esperado) return;
      if (!it || it.id !== esperado.item || it.n !== esperado.n) {
        toast.info("O presente não chegou: quem ia dar não tinha mais o item.");
        return;
      }
      guardarMochila((inv) => comMais(inv, it.id, it.n));
      playSfx("complete");
      toast.success(`Você ganhou ${it.n} ${nomeDo(it.id)}!`);
    });
    return () => {
      pararOferta();
      pararResposta();
      pararEntrega();
    };
  }, [euPessoa.id, guardarMochila]);
  const oferecer = (p: Presenca, id: string, n: number) => {
    setDarPara(null);
    const it = item(id);
    if (ofertando.current) {
      toast.info("Espere a resposta do presente que você já ofereceu.");
      return;
    }
    if (!it || (pet.inventario[id] ?? 0) < n) return;
    const oferta = { para: p.id, nome: p.nome, item: id, n };
    ofertando.current = oferta;
    setTimeout(() => {
      if (ofertando.current === oferta) ofertando.current = null;
    }, 30_000);
    enviarNaPraca("presente", { de: euPessoa.id, para: p.id, item: id, n, nome: euPessoa.nome });
    toast.success(`Você ofereceu ${n} ${it.emoji} ${it.nome} para ${p.nome}.`);
  };
  const responderPresente = (o: { de: string; item: string; n: number }, quer: boolean) => {
    setOfertas((l) => l.filter((x) => x.de !== o.de));
    let aceita = quer;
    if (aceita && quantosCabem(pet.inventario, o.item) < o.n) {
      toast.info("Sua mochila não aguenta esse peso (50 kg). Libere espaço e peça de novo.");
      aceita = false;
    }
    if (aceita) aguardando.current.set(o.de, { item: o.item, n: o.n });
    enviarNaPraca("presente-resposta", {
      de: euPessoa.id,
      para: o.de,
      item: o.item,
      n: o.n,
      aceita,
    });
  };

  // se a outra pessoa foi dormir ou saiu, a dupla acaba
  const parceiroSumiu = !!par && (!outros[par.com] || outros[par.com]?.dorme === true);
  useEffect(() => {
    if (parceiroSumiu) setPar(null);
  }, [parceiroSumiu]);

  // Ao acordar, o HOKI desce o escorregador e pousa no gramado (cada um num ponto um pouco diferente).
  // Se a tela abriu com o HOKI já acordado (voltou de outra tela), não desce o escorregador de novo.
  const jaAcordado = useRef(dentro);
  useEffect(() => {
    if (dentro && jaAcordado.current) jaAcordado.current = false;
    else if (dentro)
      setEu({
        x: CHEGADA.x + (Math.random() - 0.5) * 1.2,
        z: CHEGADA.z - Math.random() * 0.8,
        banco: null,
      });
    else {
      setAlvo(null);
      setIndoAoTermometro(false);
      setIndoAte(null);
      setAnimacao(null);
      setPar(null);
    }
  }, [dentro]);

  // Publica onde estou: dormindo no berço ou, acordado, para onde estou indo (ando ou sento).
  useEffect(() => {
    definirLugar({
      x: eu.x,
      z: eu.z,
      banco: dentro ? eu.banco : null,
      status: statusAtual,
      dorme: !dentro,
      par: dentro ? par : null,
      anim: dentro ? animacao : null,
      sujo: pet.higiene < SUJO_ABAIXO_DE,
      lento: dentro && lento,
      naFazenda: !!fazenda,
    });
  }, [dentro, eu, statusAtual, par, animacao, pet.higiene, lento, fazenda]);
  // Raio do Founder: todo mundo volta a dormir no berço e a praça sincroniza do zero.
  const dentroRef = useRef(dentro);
  dentroRef.current = dentro;
  const aoAlternarRef = useRef(aoAlternar);
  aoAlternarRef.current = aoAlternar;
  useEffect(
    () =>
      ouvirNaPraca("reiniciar", () => {
        setAlvo(null);
        setIndoAte(null);
        setAnimacao(null);
        setPar(null);
        setTrabalhando(false);
        if (dentroRef.current) aoAlternarRef.current();
        playSfx("pop");
        toast("A praça foi reiniciada: todo mundo voltou para o berço.", { icon: "⚡" });
      }),
    [],
  );
  const souFounder = cargo === "founder";

  /* ---------- eventos do Founder: chegam pelo canal (já conferidos) e começam em 1,5 s em todas as telas ---------- */
  const [poderesAberto, setPoderesAberto] = useState(false);
  useEffect(
    () =>
      ouvirNaPraca("show", (m) => {
        const show = m as unknown as Show;
        const info = infoDoShow(show.tipo);
        mundo.current?.iniciarShow(show, 1500);
        if (info) {
          playSfx("pop");
          toast(`${info.emoji} ${info.nome}!`, { description: info.texto, duration: 4000 });
        }
      }),
    [],
  );
  // quem participa: todo mundo acordado no lobby (e eu, se estou acordado). Quem está dentro
  // da HOST FAZENDAS não está na praça: fica de fora (não veria o evento e "brotaria" lá do alto).
  const participantesDoShow = useMemo(
    () => [
      ...(dentro && !fazenda ? [euPessoa.id] : []),
      ...Object.values(outros)
        .filter((o) => !o.dorme && !o.naFazenda)
        .map((o) => o.id),
    ],
    [outros, dentro, euPessoa.id, fazenda],
  );
  const dispararShow = (tipo: TipoShow) => {
    if (mundo.current?.showRodando()) {
      toast.info("Já tem um evento rodando. Espere ele acabar.");
      return;
    }
    if (!enviarShow(tipo, participantesDoShow)) {
      toast.error("A praça ainda está conectando. Tente de novo.");
      return;
    }
    setPoderesAberto(false);
  };
  const [conviteVisita, setConviteVisita] = useState<ConviteHoki | null>(null);
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const gerarConvite = async () => {
    if (gerandoConvite) return;
    setGerandoConvite(true);
    try {
      setConviteVisita(await criarConviteHoki());
      playSfx("pop");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para gerar o convite agora.");
    } finally {
      setGerandoConvite(false);
    }
  };
  const copiar = async (texto: string, oque: string) => {
    if (await copiarTexto(texto)) toast.success(`${oque} copiado.`);
    else toast.error("Não deu para copiar. Selecione e copie à mão.");
  };
  const raio = () =>
    toast("Mandar todo mundo de volta para o berço?", {
      description: "Todos os HOKIs voltam a dormir e a praça sincroniza de novo.",
      icon: "⚡",
      duration: 8000,
      action: {
        label: "Reiniciar",
        onClick: () => {
          if (!reiniciarPraca()) toast.error("A praça ainda está conectando. Tente de novo.");
        },
      },
    });
  // Ao sair desta tela o HOKI continua onde está: aba aberta = HOKI na praça (só fechar a aba tira ele).

  // Emotes escolhidos aqui ficam rodando no mundo, para todos, até parar.
  const nTruque = truque?.n;
  useEffect(() => {
    if (!truque || !dentro || !TRUQUES.includes(truque.tipo)) return;
    // a animação fica repetindo até apertar parar (ou andar); os outros veem pela presença
    setPar(null);
    setAnimacao(truque.tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nTruque]);

  // Apaga os balões vencidos.
  const temFalas = Object.keys(falas).length > 0;
  useEffect(() => {
    if (!temFalas) return;
    const id = setInterval(
      () =>
        setFalas((f) =>
          Object.fromEntries(Object.entries(f).filter(([, v]) => v.ate > Date.now())),
        ),
      1000,
    );
    return () => clearInterval(id);
  }, [temFalas]);

  /* ---------- partidas (convites e salas) ---------- */
  useRealtimeTable("hoshi_jogos", [["hoki-jogos"]]);
  const { data: jogos = [] } = useQuery({
    queryKey: ["hoki-jogos", "ativos"],
    queryFn: jogosAtivos,
    staleTime: 15_000,
  });
  const salas = jogos.filter(
    (j): j is Jogo<Cartas> => j.tipo === "cartas" && (j.estado as Cartas).jogadores.length > 0,
  );
  const festas = jogos.filter((j): j is Jogo<Festa> => j.tipo === "festa");
  const desafios = jogos.filter((j) => participantes(j) !== null);
  const convite = desafios.find(
    (j) => j.status === "aberto" && participantes(j)?.[1].id === euPessoa.id,
  );
  const enviado = desafios.find(
    (j) => j.status === "aberto" && participantes(j)?.[0].id === euPessoa.id,
  );
  const emJogo = desafios.find(
    (j) => j.status === "jogando" && !!participantes(j)?.some((x) => x.id === euPessoa.id),
  );
  /** Abre a partida na janela certa (a velha tem a dela). */
  const abrirPartida = (j: Pick<Jogo, "id" | "tipo">) =>
    j.tipo === "velha" ? setVelhaId(j.id) : setDesafioId(j.id);

  // A partida só abre sozinha quando um desafio que EU mandei nesta visita é aceito.
  const meusConvites = useRef(new Set<string>());
  useEffect(() => {
    if (enviado) meusConvites.current.add(enviado.id);
  }, [enviado]);
  useEffect(() => {
    if (emJogo && meusConvites.current.has(emJogo.id) && !vistas.current.has(emJogo.id)) {
      vistas.current.add(emJogo.id);
      abrirPartida(emJogo);
    }
  }, [emJogo]);

  const desafiar = async (p: Presenca, tipo: (typeof DESAFIOS)[number]["tipo"]) => {
    setAlvo(null);
    setEscolhendoDesafio(null);
    if (enviado || emJogo) {
      toast.info("Você já tem um desafio em andamento.");
      return;
    }
    const outro = { id: p.id, nome: p.nome };
    try {
      await criarJogo(
        tipo,
        tipo === "velha"
          ? { x: euPessoa, o: outro, tab: Array<null>(9).fill(null), vez: "x", vencedor: null }
          : novoDesafio(tipo, euPessoa, outro),
      );
      toast.success(`Desafio de ${NOME_DO_JOGO[tipo]} enviado para ${p.nome}.`);
    } catch {
      toast.error("Não foi possível enviar o desafio.");
    }
    void qc.invalidateQueries({ queryKey: ["hoki-jogos"] });
  };
  const responder = async (j: Jogo, aceita: boolean) => {
    const ok = await gravarJogo(j, j.estado as object, aceita ? "jogando" : "fim").catch(
      () => false,
    );
    void qc.invalidateQueries({ queryKey: ["hoki-jogos"] });
    if (ok && aceita) {
      vistas.current.add(j.id);
      abrirPartida(j);
    }
  };

  /* ---------- andar, sentar e falar ---------- */
  /** Qualquer movimento meu encerra o que estava em andamento (animação, dupla, ida até alguém). */
  /** Foi pela tecla E na entrada do braço: chegando na frente do portal, abre a escolha da partida. */
  const abrirPortalAoChegar = useRef(false);
  const largarTudo = () => {
    abrirPortalAoChegar.current = false;
    setIndoAoTermometro(false);
    setIndoAoCorreio(false);
    setIndoAoComercio(false);
    setIndoAoCanteiro(null);
    setIndoAte(null);
    setAnimacao(null);
    setPar(null);
    setPerto(null);
    setTrabalhando(false);
  };
  /** O que fica ao alcance de quem está parado neste ponto. */
  const pertoDe = (p: Ponto) => {
    if (naFrenteDoRanking(p.x, p.z)) return { tipo: "ranking" as const };
    if (!souVisita && Math.hypot(p.x - FRENTE_DO_TERMOMETRO.x, p.z - FRENTE_DO_TERMOMETRO.z) < 1.7)
      return { tipo: "termometro" as const };
    if (Math.hypot(p.x - CHUVEIRO.x, p.z - CHUVEIRO.z) < 1.2) return { tipo: "chuveiro" as const };
    if (Math.hypot(p.x - CORREIO.x, p.z - CORREIO.z) < 1.5) return { tipo: "correio" as const };
    // só encostado na água da fonte (no fim de uma das passagens do canteiro): dá para pegar água
    if (naBeiraDaFonte(p)) return { tipo: "fonte" as const };
    // na frente do balcão do Comércio
    if (
      COMERCIO_NA_PRACA &&
      (Math.hypot(p.x - FRENTE_DO_COMERCIO.x, p.z - FRENTE_DO_COMERCIO.z) < 1.9 ||
        Math.hypot(p.x - CENTRO_DO_COMERCIO.x, p.z - CENTRO_DO_COMERCIO.z) < 2.6)
    )
      return { tipo: "comercio" as const };
    // na frente do portal do Magnata
    if (Math.hypot(p.x - FRENTE_DO_PORTAL.x, p.z - FRENTE_DO_PORTAL.z) < 3)
      return { tipo: "portal" as const };
    // na frente da porta do celeiro (portal do HOST FAZENDAS)
    if (
      Math.hypot(p.x - FRENTE_DO_PORTAL_FAZENDAS.x, p.z - FRENTE_DO_PORTAL_FAZENDAS.z) < 2.6 ||
      naPortaDoCeleiro(p.x, p.z)
    )
      return { tipo: "fazendas" as const };
    // na frente do prédio da ilha EM BREVE (portal do HOST SIEGE)
    if (Math.hypot(p.x - FRENTE_SIEGE.x, p.z - FRENTE_SIEGE.z) < 2.8)
      return { tipo: "siege" as const };
    const i = BANCOS.findIndex((b) => b.trabalho && Math.hypot(b.x - p.x, b.z - p.z) < 1.6);
    if (i >= 0) return { tipo: "cadeira" as const, i };
    // na fazenda: o lugar de colher mais perto
    let melhor = -1;
    let menor = 1.7;
    CANTEIROS.forEach((c, n) => {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < menor) {
        menor = d;
        melhor = n;
      }
    });
    return melhor >= 0 ? { tipo: "canteiro" as const, i: melhor } : null;
  };

  /* ---------- fazenda: colher o que está pronto (vai para a mochila, que aguenta 50 kg) ---------- */
  const colher = (i: number) => {
    const c = CANTEIROS[i];
    const receita = c ? CULTURAS[c.cultura] : undefined;
    const oQue = receita ? item(receita.item) : undefined;
    if (!c || !receita || !oQue) return;
    const falta = faltaParaCrescer(c.cultura, pet.colheitas[String(i)]);
    if (falta) {
      toast.info(`${oQue.nome}: fica pronto de novo em ${falta}.`);
      return;
    }
    if (salvando) return;
    const cabem = quantosCabem(pet.inventario, oQue.id);
    if (cabem <= 0) {
      toast.info("A mochila está cheia (50 kg). Coma, beba ou jogue algo fora.");
      return;
    }
    const n = Math.min(receita.quantos, cabem);
    playSfx("add");
    toast.success(`+${n} ${oQue.emoji} ${oQue.nome}`);
    aoSalvar({
      inventario: { ...pet.inventario, [oQue.id]: (pet.inventario[oQue.id] ?? 0) + n },
      colheitas: { ...pet.colheitas, [String(i)]: Date.now() },
      // mexer na terra suja um pouquinho
      higiene: Math.max(0, pet.higiene - 2),
    });
  };
  const irAoCanteiro = (i: number) => {
    const c = CANTEIROS[i];
    if (!c) return;
    if (!dentro) {
      toast.info("Acorde o seu HOKI para ir até a fazenda.");
      return;
    }
    if (Math.hypot(eu.x - c.x, eu.z - c.z) < 1.7 && eu.banco === null) {
      colher(i);
      return;
    }
    const ao = ajustar({ x: c.x + 0.7, z: c.z + 0.7 }) ?? ajustar({ x: c.x - 0.7, z: c.z - 0.7 });
    if (!ao) return;
    largarTudo();
    setAlvo(null);
    setIndoAoCanteiro(i);
    setEu({ ...ao, banco: null });
  };
  const tomarBanho = () => {
    if (salvando) return;
    if (Math.hypot(eu.x - CHUVEIRO.x, eu.z - CHUVEIRO.z) > 0.3) {
      // vai para baixo da ducha antes
      setEu({ ...CHUVEIRO, banco: null });
    }
    if (pet.higiene >= 98) {
      toast.info(`${pet.nome} já está limpinho.`);
      return;
    }
    playSfx("success");
    toast.success(`${pet.nome} tomou banho. Limpinho de novo!`);
    aoSalvar({ higiene: 100 });
  };
  /** Fonte do meio da praça: enche uma garrafa de água (vai para a mochila; uma a cada 30 segundos). */
  const pegarAgua = () => {
    const agua = item("agua");
    if (!agua || salvando) return;
    const falta = faltaParaCrescer("agua", pet.colheitas["fonte"]);
    if (falta) {
      toast.info(`A garrafa enche de novo em ${falta}.`);
      return;
    }
    if (quantosCabem(pet.inventario, "agua") <= 0) {
      toast.info("A mochila está cheia (50 kg). Coma, beba ou jogue algo fora.");
      return;
    }
    playSfx("add");
    toast.success(
      `+1 ${agua.emoji} ${agua.nome}. Para beber, abra a mochila (ou o botão de bebida do HOKI).`,
    );
    aoSalvar({
      inventario: { ...pet.inventario, agua: (pet.inventario["agua"] ?? 0) + 1 },
      colheitas: { ...pet.colheitas, fonte: Date.now() },
    });
  };
  /** O que a tecla E faz num lugar da fazenda: "colher Milho" ou quanto falta para ficar pronto. */
  const textoDoCanteiro = (i: number) => {
    const c = CANTEIROS[i];
    const receita = c ? CULTURAS[c.cultura] : undefined;
    const nome = receita ? (item(receita.item)?.nome ?? "") : "";
    const falta = c ? faltaParaCrescer(c.cultura, pet.colheitas[String(i)]) : "";
    return falta ? `${nome}: pronto em ${falta}` : `${receita?.verbo ?? "colher"} ${nome}`;
  };
  const andar = (clicado: Ponto) => {
    const p = clicado;
    largarTudo();
    setEu({ x: p.x, z: p.z, banco: null });
    setAlvo(null);
  };
  const { pendentes } = useQueridometro(euPessoa.id);
  const { naoLidas } = useCorreio();
  const naoLidasAntes = useRef<number | null>(null);
  useEffect(() => {
    if (naoLidasAntes.current !== null && naoLidas > naoLidasAntes.current) {
      playSfx("pop");
      toast("Chegou carta para você. Vá até a caixa do correio, ao lado da fonte.", { icon: "✉️" });
    }
    naoLidasAntes.current = naoLidas;
  }, [naoLidas]);
  const { data: pets = [] } = useQuery({
    queryKey: ["hoki-todos"],
    queryFn: todosPets,
    staleTime: 60_000,
  });
  const petDoPerfil = perfilDe ? pets.find((x) => x.user_id === perfilDe) : undefined;
  /** Correio: só abre na caixa. Clicar nela (ou no aviso de carta nova) leva o HOKI até lá. */
  const irAoCorreio = () => {
    if (!dentro) {
      toast.info("Acorde o seu HOKI para ir até o correio.");
      return;
    }
    // já estou em frente à caixa: abre direto
    if (
      Math.hypot(eu.x - FRENTE_DO_CORREIO.x, eu.z - FRENTE_DO_CORREIO.z) < 0.3 &&
      eu.banco === null
    ) {
      if (!indoAoCorreio) {
        playSfx("open");
        setCorreioAberto(true);
      }
      return;
    }
    largarTudo();
    setAlvo(null);
    setIndoAoCorreio(true);
    setEu({ ...FRENTE_DO_CORREIO, banco: null });
  };
  /** Comércio: abre no balcão da barraca. Clicar nela (ou no atalho) leva o HOKI até lá. */
  const irAoComercio = () => {
    if (!dentro) {
      toast.info("Acorde o seu HOKI para ir até o Comércio.");
      return;
    }
    if (
      Math.hypot(eu.x - FRENTE_DO_COMERCIO.x, eu.z - FRENTE_DO_COMERCIO.z) < 0.6 &&
      eu.banco === null
    ) {
      if (!indoAoComercio) {
        playSfx("open");
        setComercioAberto(true);
      }
      return;
    }
    largarTudo();
    setAlvo(null);
    setIndoAoComercio(true);
    setEu({ ...FRENTE_DO_COMERCIO, banco: null });
  };
  // só para testes: abre o Comércio direto, sem andar até a barraca
  if (import.meta.env.DEV)
    (window as unknown as { __comercio?: () => void }).__comercio = () => setComercioAberto(true);
  const irAoTermometro = () => {
    // o queridômetro é só da equipe
    if (souVisita) {
      toast.info("O queridômetro é só para a equipe.");
      return;
    }
    if (!dentro) {
      toast.info("Acorde o seu HOKI para ir até o termômetro.");
      return;
    }
    // já estou (ou já estou indo) em frente ao totem: abre direto
    if (
      Math.hypot(eu.x - FRENTE_DO_TERMOMETRO.x, eu.z - FRENTE_DO_TERMOMETRO.z) < 0.3 &&
      eu.banco === null
    ) {
      if (!indoAoTermometro) {
        playSfx("open");
        setQueridometro(true);
      }
      return;
    }
    largarTudo();
    setAlvo(null);
    setIndoAoTermometro(true);
    setEu({ ...FRENTE_DO_TERMOMETRO, banco: null });
  };

  // A barra de fala fica escondida: T abre, Enter envia (e fecha), Esc fecha.
  const [falando, setFalando] = useState(false);
  const abrirFala = useRef<() => boolean>(() => false);
  abrirFala.current = () => {
    // na vista do RANKING a barra de fala fica escondida
    if (!dentro || vistaRanking) return false;
    setFalando(true);
    return true;
  };
  useEffect(() => {
    if (!dentro) setFalando(false);
  }, [dentro]);
  /* ---------- arco do RANKING: parar na frente põe a câmera em primeira pessoa ---------- */
  const sairDoRanking = () => {
    setVistaRanking(false);
    rankingArmado.current = false;
  };
  useEffect(() => {
    if (dentro && perto?.tipo === "ranking") {
      if (rankingArmado.current) setVistaRanking(true);
      return;
    }
    rankingArmado.current = true;
    setVistaRanking(false);
  }, [perto, dentro]);
  // sem ninguém olhando de perto, o arco vai trocando de ranking sozinho
  useEffect(() => {
    if (vistaRanking) return;
    const t = setInterval(() => setPaginaRanking((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, [vistaRanking]);
  const { data: rankings } = useQuery({
    queryKey: ["hoki-rankings"],
    queryFn: buscarRankings,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const quadroRanking = useMemo(
    () => quadroDoRanking(rankings, paginaRanking),
    [rankings, paginaRanking],
  );
  // só para testes: simula parar num ponto (o que fica "ao alcance") sem andar com o HOKI
  if (import.meta.env.DEV)
    Object.assign(window, { __chegar: (x: number, z: number) => setPerto(pertoDe({ x, z })) });
  // Teclas: E usa o que está ao alcance; R abre o ranking do parkour. Não valem enquanto se digita ou com uma janela aberta.
  const usar = useRef<(tecla: "e" | "r" | "f") => void>(() => undefined);
  usar.current = (tecla) => {
    // no arco do RANKING: E troca o ranking, F sai da primeira pessoa
    if (vistaRanking) {
      if (tecla === "e") setPaginaRanking((n) => n + 1);
      if (tecla === "f") sairDoRanking();
      return;
    }
    if (!dentro || !perto || eu.banco !== null || tecla !== "e") return;
    if (perto.tipo === "ranking") {
      setVistaRanking(true);
      return;
    }
    if (perto.tipo === "fonte") {
      pegarAgua();
      return;
    }
    if (perto.tipo === "cadeira") sentar(perto.i);
    else if (perto.tipo === "canteiro") colher(perto.i);
    else if (perto.tipo === "chuveiro") tomarBanho();
    else if (perto.tipo === "correio") setCorreioAberto(true);
    else if (perto.tipo === "comercio") setComercioAberto(true);
    else if (perto.tipo === "portal") setPortalAberto(true);
    else if (perto.tipo === "fazendas") setPortalFazendas(true);
    else if (perto.tipo === "siege") setSiegeAberto(true);
    else setQueridometro(true);
  };
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k !== "e" && k !== "r" && k !== "t" && k !== "f") || e.ctrlKey || e.metaKey || e.altKey)
        return;
      const alvoDaTecla = e.target as HTMLElement | null;
      if (
        alvoDaTecla?.closest("input, textarea, [contenteditable='true']") ||
        document.querySelector("[role='dialog']")
      )
        return;
      // T abre a barra de fala (o campo já recebe o foco; a própria letra não entra no texto)
      if (k === "t") {
        if (abrirFala.current()) e.preventDefault();
        return;
      }
      usar.current(k);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  /* ---------- clicar em alguém: perto, abre as ações; longe, vai até a pessoa ---------- */
  const aoClicarPessoa = (id: string) => {
    const o = outros[id];
    if (!o) return;
    // dormindo (eu ou a pessoa) não dá para chegar perto: só o perfil e o "chamar"
    if (!dentro || o.dorme) {
      setAlvo(o);
      return;
    }
    if (Math.hypot(eu.x - o.x, eu.z - o.z) <= 3.2) {
      setAlvo(o);
      return;
    }
    // longe: anda até um ponto ao lado da pessoa e abre as ações ao chegar
    const dist = Math.hypot(eu.x - o.x, eu.z - o.z) || 1;
    const perto = ajustar({
      x: o.x + ((eu.x - o.x) / dist) * 1.1,
      z: o.z + ((eu.z - o.z) / dist) * 1.1,
    });
    if (!perto) {
      toast.info(`Não dá para chegar até ${o.nome} agora.`);
      return;
    }
    largarTudo();
    setAlvo(null);
    setIndoAte(id);
    setEu({ ...perto, banco: null });
  };
  const convidar = (p: Presenca, tipo: Dupla) => {
    setAlvo(null);
    if (pedido) {
      toast.info("Espere a resposta do convite que você já mandou.");
      return;
    }
    setPedido({ para: p.id, nome: p.nome, tipo });
    enviarNaPraca("convite", { de: euPessoa.id, para: p.id, tipo, nome: euPessoa.nome });
    toast.success(`Convite enviado para ${p.nome}.`);
  };
  const responderConvite = (c: { de: string; tipo: Dupla }, aceita: boolean) => {
    setConvites((l) => l.filter((x) => x.de !== c.de));
    enviarNaPraca("resposta", { de: euPessoa.id, para: c.de, tipo: c.tipo, aceita });
    if (aceita) {
      playSfx("success");
      setAnimacao(null);
    }
  };
  /** "Toc toc": avisa a pessoa (na tela dela toca e aparece o chamado), onde quer que ela esteja no site. */
  const ultimoChamado = useRef(0);
  const chamar = (p: Presenca) => {
    setAlvo(null);
    if (Date.now() - ultimoChamado.current < 8000) {
      toast.info("Espere um pouquinho antes de chamar de novo.");
      return;
    }
    ultimoChamado.current = Date.now();
    enviarNaPraca("chamar", { de: euPessoa.id, para: p.id, nome: euPessoa.nome });
    playSfx("pop");
    toast.success(`Toc toc! Você chamou ${p.nome}.`);
  };
  // quem está me acompanhando (alguém de mãos dadas comigo, nas minhas costas…)
  const comigo = Object.values(outros).find((o) => o.par?.com === euPessoa.id) ?? null;
  const soltar = () => {
    if (par) setPar(null);
    else if (comigo) enviarNaPraca("soltar", { de: euPessoa.id, para: comigo.id });
  };
  const sentar = (i: number) => {
    if (Object.values(outros).some((o) => o.banco === i)) {
      toast.info("Esse banco já está ocupado.");
      return;
    }
    playSfx("click");
    largarTudo();
    if (BANCOS[i]?.trabalho) setTrabalhando(true);
    setEu((e) => ({ ...e, banco: i }));
  };
  /* ---------- Magnata HOST: portal, convites e a partida aberta ---------- */
  const [portalAberto, setPortalAberto] = useState(false);
  const [magnata, setMagnata] = useState<{ codigo: string; criar: boolean } | null>(null);
  const { convites: convitesMagnata, pedido: pedidoMagnata } = useConvitesMagnata();
  const [minhaSalaMagnata, setMinhaSalaMagnata] = useState<string | null>(null);
  useEffect(() => {
    if (portalAberto) setMinhaSalaMagnata(salaGuardada());
  }, [portalAberto]);
  const abrirMagnata = (codigo: string, criar: boolean) => {
    playSfx("open");
    setPortalAberto(false);
    esquecerConvite(codigo);
    setMagnata({ codigo, criar });
  };
  // só para testes: abre uma sala direto, sem andar até o portal
  if (import.meta.env.DEV)
    (window as unknown as { __magnata?: typeof abrirMagnata }).__magnata = abrirMagnata;
  // convite aceito em outra tela (pelo aviso do sino): abre a sala assim que a praça aparece
  useEffect(() => {
    if (!pedidoMagnata || magnata) return;
    const codigo = pegarPedidoDeAbrir();
    if (codigo) abrirMagnata(codigo, false);
  }, [pedidoMagnata]);
  /** Ao sair da partida, o HOKI volta para a frente do portal. */
  const fecharMagnata = () => {
    setMagnata(null);
    if (dentro) {
      largarTudo();
      setAlvo(null);
      setEu({ ...FRENTE_DO_PORTAL, banco: null });
    }
  };
  const euNoMagnata = useMemo(
    () => ({ id: euPessoa.id, nome: euPessoa.nome, visual: meuVisual }),
    [euPessoa.id, euPessoa.nome, meuVisual],
  );
  /* ---------- HOST FAZENDAS: portal do celeiro, a minha ilha e as visitas ---------- */
  const euNaFazenda = useMemo(
    () => ({
      id: euPessoa.id,
      nome: euPessoa.nome,
      visual: meuVisual,
      ...(minhaTag ? { tag: minhaTag } : {}),
    }),
    [euPessoa.id, euPessoa.nome, meuVisual, minhaTag],
  );
  const abrirFazenda = (visitar: string | null, painel: "vizinhos" | "correio" | null = null) => {
    playSfx("open");
    setPortalFazendas(false);
    setFazenda({ visitar, painel, vez: Date.now() });
  };
  /** Ao sair da fazenda, o HOKI volta para a frente da porta do celeiro. */
  const fecharFazenda = () => {
    setFazenda(null);
    if (dentro) {
      largarTudo();
      setAlvo(null);
      setEu({ ...FRENTE_DO_PORTAL_FAZENDAS, banco: null });
    }
  };
  // a praça para de desenhar enquanto a fazenda ocupa a tela
  useEffect(() => {
    pausarMundo3D(!!fazenda);
    return () => pausarMundo3D(false);
  }, [fazenda]);
  // "Visitar" dentro da fazenda (lista de vizinhos ou convite): troca de ilha sem voltar à praça
  useEffect(() => {
    const aoVisitar = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string" && id)
        setFazenda({ visitar: id === euPessoa.id ? null : id, painel: null, vez: Date.now() });
    };
    window.addEventListener("hoki-fazenda-visitar", aoVisitar);
    return () => window.removeEventListener("hoki-fazenda-visitar", aoVisitar);
  }, [euPessoa.id]);
  // só para testes: abre a fazenda (ou o painel do portal) direto, sem andar até o celeiro
  if (import.meta.env.DEV)
    Object.assign(window, {
      __fazenda: abrirFazenda,
      __portalFazendas: () => setPortalFazendas(true),
    });
  const amigosOnline = useMemo(
    () => Object.values(outros).map((o) => ({ id: o.id, nome: o.nome, visual: o.visual })),
    [outros],
  );
  /** Quem está na ilha agora (sem contar eu): para visitar a fazenda sem precisar de aceite. */
  const presentes = useMemo<PresenteNaIlha[]>(
    () =>
      Object.values(outros).map((o) => ({
        id: o.id,
        nome: o.nome,
        visual: o.visual,
        tag: o.tag,
        dorme: o.dorme,
        naFazenda: o.naFazenda,
      })),
    [outros],
  );
  /**
   * HOST FAZENDAS → mochila: cada colheita e cada coleta manda uma unidade do produto.
   * Junta o que chega e grava de uma vez só quando nenhum outro salvamento está no meio
   * (e só depois que o anterior voltou do banco), até onde couber nos 50 kg.
   */
  const entregas = useRef<{
    fila: Record<string, number>;
    inv: Record<string, number> | null;
    desde: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ fila: {}, inv: null, desde: 0, timer: null });
  const entregarNaMochila = useRef(function entregar() {
    const e = entregas.current;
    e.timer = null;
    if (!Object.keys(e.fila).length) return;
    const antes = petRef.current.inventario;
    const esperando = e.inv !== null && antes === e.inv && Date.now() - e.desde < 6000;
    if (salvandoRef.current || esperando) {
      e.timer = setTimeout(entregar, 300);
      return;
    }
    let nova = { ...antes };
    const entrou: string[] = [];
    let sobrou = false;
    for (const [id, n] of Object.entries(e.fila)) {
      const cabe = Math.min(n, quantosCabem(nova, id));
      if (cabe < n) sobrou = true;
      if (cabe <= 0) continue;
      nova = { ...nova, [id]: (nova[id] ?? 0) + cabe };
      const it = item(id);
      entrou.push(`+${cabe} ${it?.emoji ?? ""} ${it?.nome ?? id}`);
    }
    e.fila = {};
    if (sobrou)
      toast.info("A mochila do HOKI está cheia (50 kg): coma, beba ou jogue algo fora.", {
        id: "mochila-cheia",
      });
    if (!entrou.length) return;
    e.inv = antes;
    e.desde = Date.now();
    aoSalvarRef.current({ inventario: nova });
    toast(`${entrou.join(" · ")} na mochila do HOKI`, { icon: "🎒", id: "fazenda-mochila" });
  }).current;
  const receberProdutos = useRef((itens: Record<string, number>) => {
    const e = entregas.current;
    for (const [id, n] of Object.entries(itens)) e.fila[id] = (e.fila[id] ?? 0) + n;
    if (!e.timer) e.timer = setTimeout(entregarNaMochila, 150);
  }).current;
  useEffect(
    () => () => {
      const e = entregas.current;
      if (e.timer) clearTimeout(e.timer);
    },
    [],
  );

  const falar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim().slice(0, 90);
    // Enter com o campo vazio só fecha a barra
    if (!t) setFalando(false);
    if (!t || !dentro || Date.now() - ultimaFala.current < 700) return;
    // comandos (não vão para o chat): /praca volta para a praça
    const comando = t.toLowerCase();
    if (comando === "/praca" || comando === "/praça") {
      setTexto("");
      setFalando(false);
      if (mundo.current?.teleportar(0, 14)) {
        playSfx("toggle");
        toast.success("De volta à praça.");
      } else toast.info("Acorde o seu HOKI primeiro.");
      return;
    }
    ultimaFala.current = Date.now();
    setTexto("");
    setFalando(false);
    setFalas((f) => ({ ...f, [euPessoa.id]: { texto: t, ate: Date.now() + FALA_MS } }));
    anotarFala({ nome: euPessoa.nome, tag: minhaTag, visual: meuVisual }, t);
    enviarNaPraca("fala", { id: euPessoa.id, texto: t });
  };

  // plaquinha: o nível (HOST FAZENDAS) e a cor que cada um equipou
  const { data: selos } = useSelos([euPessoa.id, ...Object.keys(outros)]);
  const pessoas = useMemo<PessoaMundo[]>(
    () => [
      // dos outros, só vale a animação que este site conhece
      ...Object.values(outros).map((o) => ({
        ...o,
        anim: TRUQUES.find((t) => t === o.anim) ?? null,
        selo: selos?.[o.id] ?? null,
      })),
      // eu apareço sempre: no berço enquanto durmo, na praça depois de acordar
      {
        id: euPessoa.id,
        nome: euPessoa.nome,
        tag: minhaTag,
        visual: meuVisual,
        ...eu,
        status: statusAtual,
        dorme: !dentro,
        par: dentro ? par : null,
        anim: dentro ? animacao : null,
        sujo: pet.higiene < SUJO_ABAIXO_DE,
        lento: dentro && lento,
        souEu: true,
        selo: selos?.[euPessoa.id] ?? null,
      },
    ],
    [
      outros,
      dentro,
      euPessoa,
      meuVisual,
      eu,
      statusAtual,
      minhaTag,
      par,
      animacao,
      pet.higiene,
      lento,
      selos,
    ],
  );
  const baloes = useMemo(
    () => Object.fromEntries(Object.entries(falas).map(([id, f]) => [id, f.texto])),
    [falas],
  );
  /** Quem está online agora (eu incluído), para a pílula do total e o menu por lugar. */
  const pessoasOnline = useMemo<PessoaOnlineAgora[]>(
    () => [
      {
        id: euPessoa.id,
        nome: euPessoa.nome,
        tag: minhaTag,
        visual: meuVisual,
        dorme: !dentro,
        naFazenda: !!fazenda,
        souEu: true,
      },
      ...Object.values(outros).map((o) => ({
        id: o.id,
        nome: o.nome,
        tag: o.tag,
        visual: o.visual,
        dorme: o.dorme,
        naFazenda: o.naFazenda,
      })),
    ],
    [euPessoa, minhaTag, meuVisual, dentro, fazenda, outros],
  );
  const acaoSobre =
    "flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 font-medium hover:bg-white/[0.14]";
  const flutuante =
    "grid size-9 place-items-center rounded-xl border border-white/15 bg-black/70 text-white backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5 active:scale-95";
  // convite de visita: só Coordinator+ gera (código e link que só abrem o HOKI)
  const botaoConvidar =
    !souVisita && isCoordinatorPlus(cargo) ? (
      <button
        onClick={() => (conviteVisita ? setConviteVisita(null) : void gerarConvite())}
        aria-label="Convidar visita para o HOKI"
        title="Convidar visita (só o HOKI)"
        className={cn(flutuante, conviteVisita && "border-white/40")}
      >
        {gerandoConvite ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UserPlus className="size-4" />
        )}
      </button>
    ) : null;
  // raio do Founder: só aparece para quem é Founder
  const botaoRaio = souFounder ? (
    <button
      onClick={raio}
      aria-label="Reiniciar a praça para todos"
      title="Reiniciar a praça: todos voltam ao berço e sincronizam"
      className={cn(flutuante, "text-amber-300")}
    >
      <Zap className="size-4" fill="currentColor" />
    </button>
  ) : null;

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden">
      <Mundo3D
        ref={mundo}
        pessoas={pessoas}
        falas={baloes}
        dentro={dentro}
        onChao={andar}
        onBanco={sentar}
        onPessoa={aoClicarPessoa}
        pendentes={souVisita ? 0 : pendentes}
        semTermometro={souVisita}
        onTermometro={irAoTermometro}
        colheitas={pet.colheitas}
        cartas={naoLidas}
        ranking={quadroRanking}
        vistaRanking={vistaRanking}
        onAviso={(texto) => toast(texto, { id: `aviso-${texto.slice(0, 12)}`, duration: 4500 })}
        onCorreio={irAoCorreio}
        {...(COMERCIO_NA_PRACA ? { onComercio: irAoComercio } : {})}
        onCanteiro={irAoCanteiro}
        onMover={(p) => {
          // começou a andar pelo teclado ou joystick: larga o que estava fazendo e levanta do banco
          largarTudo();
          setAlvo(null);
          setEu({ x: p.x, z: p.z, banco: null });
        }}
        onFluxo={enviarMovimento}
        onSoco={() => enviarNaPraca("truque", { id: euPessoa.id, tipo: "soco" })}
        onTruque={(tipo) => enviarNaPraca("truque", { id: euPessoa.id, tipo })}
        onSiege={(e) => setEstadoSiege(e.ativo ? e : null)}
        olhando={olhandoMovimento}
        onParou={(p) => {
          // parou depois de andar pelo teclado: o lugar onde parou vira o destino (todos veem, até a versão antiga)
          if (eu.banco === null && (Math.abs(eu.x - p.x) > 0.001 || Math.abs(eu.z - p.z) > 0.001))
            setEu({ x: p.x, z: p.z, banco: null });
          // cheguei perto de quem eu queria: abre as ações
          const quem = indoAte ? outros[indoAte] : undefined;
          if (indoAte) setIndoAte(null);
          if (quem && !quem.dorme) setAlvo(quem);
          // o que ficou ao alcance (tecla E): termômetro, parkour ou uma cadeira do escritório
          setPerto(pertoDe(p));
          if (
            abrirPortalAoChegar.current &&
            Math.hypot(p.x - FRENTE_DO_PORTAL.x, p.z - FRENTE_DO_PORTAL.z) < 1.2
          ) {
            abrirPortalAoChegar.current = false;
            setPortalAberto(true);
          }
          // entrou na abertura do portal do Magnata: abre a escolha (criar ou entrar numa partida)
          if (
            p.x < PORTAL.x + 0.9 &&
            Math.abs(p.z - PORTAL.z) < 1.5 &&
            Math.abs(p.x - PORTAL.x) < 2
          )
            setPortalAberto(true);
          // entrou na porta do celeiro: abre o portal do HOST FAZENDAS
          if (naPortaDoCeleiro(p.x, p.z) && !fazenda) setPortalFazendas(true);
          if (indoAoCanteiro !== null) {
            const i = indoAoCanteiro;
            const c = CANTEIROS[i];
            setIndoAoCanteiro(null);
            if (c && Math.hypot(p.x - c.x, p.z - c.z) < 1.9) colher(i);
          }
          if (indoAoCorreio) {
            setIndoAoCorreio(false);
            if (Math.hypot(p.x - FRENTE_DO_CORREIO.x, p.z - FRENTE_DO_CORREIO.z) < 1.6) {
              playSfx("open");
              setCorreioAberto(true);
            }
          }
          if (indoAoComercio) {
            setIndoAoComercio(false);
            if (Math.hypot(p.x - FRENTE_DO_COMERCIO.x, p.z - FRENTE_DO_COMERCIO.z) < 1.6) {
              playSfx("open");
              setComercioAberto(true);
            }
          }
          if (!indoAoTermometro) return;
          setIndoAoTermometro(false);
          if (Math.hypot(p.x - FRENTE_DO_TERMOMETRO.x, p.z - FRENTE_DO_TERMOMETRO.z) < 1.6) {
            playSfx("open");
            setQueridometro(true);
          }
        }}
        className="absolute inset-0"
      />
      {/* no celular: joystick para andar (e correr) e botão de pular */}
      <ControlesDeToque
        ativo={dentro && !vistaRanking && !fazenda}
        onJoystick={(lado, frente, correr) => mundo.current?.joystick(lado, frente, correr)}
        onPular={() => mundo.current?.pular()}
        onSocar={() => mundo.current?.socar()}
      />
      <DicaDeTeclas ativo={dentro && !vistaRanking && !fazenda} />
      {/* HOST SIEGE: a tela do jogo durante a partida e o painel do portal */}
      {estadoSiege && (
        <SiegeHud
          e={estadoSiege}
          onKit={(k) => mundo.current?.siegeKit(k)}
          onSair={() => mundo.current?.siegeSair()}
        />
      )}
      {fila && !estadoSiege && (
        <div className="absolute left-1/2 top-12 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-[12px] text-white backdrop-blur-md">
          <span className="font-semibold text-[#CE0E0E]">HOST SIEGE</span>
          <span>
            na fila ({fila.lista.length}/{SIEGE.FILA_MAX})
            {fila.comecaEm
              ? ` · começa em ${Math.max(0, Math.ceil((fila.comecaEm - Date.now()) / 1000))} s`
              : ` · esperando ${Math.max(0, SIEGE.FILA_MIN - fila.lista.length)} jogador(es)`}
          </span>
          <button
            type="button"
            onClick={alternarFila}
            className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
          >
            Cancelar
          </button>
        </div>
      )}
      {sala && (
        <SalaSiege
          sala={sala}
          euId={euPessoa.id}
          onComecar={() => {
            if (!salaRef.current?.comecar())
              toast.info("Precisa de 4, 6 ou 8 jogadores (times do mesmo tamanho).");
          }}
          onSair={() => {
            salaRef.current?.sair();
            salaRef.current = null;
            setSala(null);
          }}
        />
      )}
      {siegeAberto && (
        <PortalSiege
          naFila={!!fila}
          onClose={() => setSiegeAberto(false)}
          onTreinar={() => {
            setSiegeAberto(false);
            mundo.current?.siegeTreino();
          }}
          onBuscar={alternarFila}
          onPrivada={(codigo) => {
            setSiegeAberto(false);
            abrirSala(codigo ?? novoCodigoDeSala());
          }}
        />
      )}
      {/* B: roda de animações */}
      <RodaDeAnimacoes
        ativo={dentro && !vistaRanking && !fazenda}
        emotes={emotes}
        tocando={animacao}
        onEscolher={aoEmote}
        onParar={() => setAnimacao(null)}
      />

      {/* jogos (só ícones, sem textos no topo) */}
      {/* poderes do Founder: eventos com todo mundo que está na praça */}
      {souFounder && (
        <button
          onClick={() => setPoderesAberto((v) => !v)}
          aria-label="Eventos do Founder"
          title="Eventos do Founder (todos na praça participam)"
          className={cn(
            flutuante,
            "absolute right-[54px] top-3 z-10 text-amber-200",
            poderesAberto && "border-amber-300/60 bg-amber-500/20",
          )}
        >
          <Sparkles className="size-4" />
        </button>
      )}
      {souFounder && poderesAberto && (
        <div className="pf-pop absolute right-[54px] top-[52px] z-20 w-[310px] rounded-2xl border border-white/15 bg-[#0d0d0d]/95 p-2 text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
            <div>
              <p className="text-[13px] font-semibold">Eventos do Founder</p>
              <p className="text-[11px] text-white/55">
                {participantesDoShow.length} acordado(s) na praça participam
              </p>
            </div>
            <button
              onClick={() => setPoderesAberto(false)}
              aria-label="Fechar"
              className="grid size-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="max-h-[300px] space-y-0.5 overflow-y-auto pr-0.5">
            {SHOWS.map((sh) => {
              const falta = sh.minimo - participantesDoShow.length;
              return (
                <button
                  key={sh.id}
                  disabled={falta > 0}
                  onClick={() => dispararShow(sh.id)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="mt-0.5 text-[18px] leading-none">{sh.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold">{sh.nome}</span>
                    <span className="block text-[11px] leading-snug text-white/55">
                      {falta > 0 ? `Precisa de ${sh.minimo} acordado(s) na praça.` : sh.texto}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="absolute right-3 top-3 flex flex-col-reverse gap-1.5">
        {aoCoins && (
          <button
            onClick={aoCoins}
            aria-label="Entregar Staff Coins"
            title="Entregar Staff Coins"
            className={cn(flutuante, "text-amber-300")}
          >
            <Coins className="size-4" />
          </button>
        )}
        {emJogo && (
          <button
            onClick={() => abrirPartida(emJogo)}
            aria-label="Voltar ao jogo da velha"
            title="Voltar ao jogo da velha"
            className={cn(flutuante, "border-primary/60 bg-primary/80")}
          >
            <Hash className="size-4" />
          </button>
        )}
        <button
          onClick={() => setJogosAberto((v) => !v)}
          aria-label="Mini-games"
          aria-expanded={jogosAberto}
          title="Mini-games"
          className={cn(flutuante, "relative")}
        >
          <Gamepad2 className="size-4" />
          {salas.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold">
              {salas.length}
            </span>
          )}
        </button>
        <button
          onClick={aoRanking}
          aria-label="Ranking dos HOKIs"
          title="Ranking"
          className={flutuante}
        >
          <Trophy className="size-4" />
        </button>
        {/* (o correio só abre indo até a caixa, na beira do anel da fonte) */}
        <button
          onClick={aoTelaCheia}
          aria-label={telaCheia ? "Sair da tela cheia" : "Abrir o HOKI em tela cheia"}
          aria-pressed={telaCheia}
          title={telaCheia ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          className={flutuante}
        >
          {telaCheia ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>

      {/* mini-games: um ícone só, com os de jogar sozinho e os de lobby */}
      {jogosAberto && (
        <div
          className="pf-pop absolute right-14 top-3 z-20 w-[248px] rounded-2xl border border-white/15 bg-black/80 p-3 text-white backdrop-blur-xl"
          role="menu"
          aria-label="Mini-games"
        >
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Mini-games solo
          </p>
          <button
            role="menuitem"
            onClick={() => {
              setJogosAberto(false);
              aoSolo();
            }}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl bg-white/[0.07] p-2 text-left hover:bg-white/[0.14]"
          >
            <span className="icone-quadro size-8">
              <Gamepad2 className="size-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[12.5px] font-medium">Petiscos e Reflexo</span>
              <span className="block text-[10.5px] text-white/55">
                Você joga sozinho e bate recordes
              </span>
            </span>
          </button>
          <p className="mt-3 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Mini-games lobby
          </p>
          <button
            role="menuitem"
            onClick={() => {
              setJogosAberto(false);
              setCartas(true);
            }}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl bg-white/[0.07] p-2 text-left hover:bg-white/[0.14]"
          >
            <span className="icone-quadro size-8">
              <Layers className="size-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[12.5px] font-medium">Mau-Mau</span>
              <span className="block text-[10.5px] text-white/55">
                Salas abertas: todo mundo pode entrar
              </span>
            </span>
            {salas.length > 0 && (
              <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-black">
                {salas.length}
              </span>
            )}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setJogosAberto(false);
              setFestaAberta(true);
            }}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl bg-white/[0.07] p-2 text-left hover:bg-white/[0.14]"
          >
            <span className="icone-quadro size-8">
              <Users className="size-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[12.5px] font-medium">Festa: Reflexo e Quiz</span>
              <span className="block text-[10.5px] text-white/55">
                De 2 a 20 pessoas, 5 rodadas
              </span>
            </span>
            {festas.filter((f) => f.status === "aberto").length > 0 && (
              <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-black">
                {festas.filter((f) => f.status === "aberto").length}
              </span>
            )}
          </button>
          <p className="mt-2.5 text-[10.5px] leading-snug text-white/50">
            Desafios de 1 contra 1: chegue perto de alguém na praça e clique nele.
          </p>
        </div>
      )}

      {/* convites de dupla que recebi */}
      {convites.length > 0 && (
        <div className="absolute left-1/2 top-14 z-10 flex w-[min(92%,26rem)] -translate-x-1/2 flex-col gap-1.5">
          {convites.map((c) => (
            <div
              key={c.de}
              role="status"
              className="pf-pop flex items-center gap-2 rounded-2xl border border-white/15 bg-black/85 px-3 py-2 text-xs text-white backdrop-blur-md"
            >
              <span className="text-base leading-none">{INTERACOES[c.tipo].emoji}</span>
              <span className="min-w-0 flex-1">
                <b className="font-semibold">{c.nome}</b> quer {INTERACOES[c.tipo].convite}
                {c.tipo === "corda" ? " com você" : ""}.
              </span>
              <button
                onClick={() => responderConvite(c, true)}
                className="h-7 rounded-full bg-white px-3 font-semibold text-black"
              >
                Aceitar
              </button>
              <button
                onClick={() => responderConvite(c, false)}
                className="h-7 rounded-full border border-white/20 px-3"
              >
                Agora não
              </button>
            </div>
          ))}
        </div>
      )}

      {/* presentes que me ofereceram */}
      {ofertas.length > 0 && (
        <div className="absolute left-1/2 top-[104px] z-10 flex w-[min(92%,26rem)] -translate-x-1/2 flex-col gap-1.5">
          {ofertas.map((o) => (
            <div
              key={o.de}
              role="status"
              className="pf-pop flex items-center gap-2 rounded-2xl border border-white/15 bg-black/85 px-3 py-2 text-xs text-white backdrop-blur-md"
            >
              <span className="text-base leading-none">{item(o.item)?.emoji ?? "🎁"}</span>
              <span className="min-w-0 flex-1">
                <b className="font-semibold">{o.nome}</b> quer te dar {o.n}{" "}
                {item(o.item)?.nome ?? o.item}.
              </span>
              <button
                onClick={() => responderPresente(o, true)}
                className="h-7 rounded-full bg-white px-3 font-semibold text-black"
              >
                Aceitar
              </button>
              <button
                onClick={() => responderPresente(o, false)}
                className="h-7 rounded-full border border-white/20 px-3"
              >
                Recusar
              </button>
            </div>
          ))}
        </div>
      )}
      {darPara && (
        <EscolherPresente
          pet={pet}
          para={darPara}
          onDar={(id, n) => oferecer(darPara, id, n)}
          onClose={() => setDarPara(null)}
        />
      )}

      {/* dupla em andamento: com quem, e o botão de soltar */}
      {dentro && (par || comigo) && (
        <div className="absolute left-[92px] top-3 flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-black/70 pl-3 pr-1 text-[12px] text-white backdrop-blur-md">
          <span>
            {INTERACOES[(par ?? comigo?.par)?.tipo ?? "maos"].emoji}{" "}
            {INTERACOES[(par ?? comigo?.par)?.tipo ?? "maos"].nome} com{" "}
            <b className="font-semibold">{par ? (outros[par.com]?.nome ?? "…") : comigo?.nome}</b>
          </span>
          <button
            onClick={soltar}
            className="h-7 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-black"
          >
            Soltar
          </button>
        </div>
      )}

      {/* emotes: um botão só, que abre a lista */}
      {emotesAberto && (
        <div
          className={cn(
            "pf-pop absolute z-10 grid max-h-[min(340px,calc(100%-90px))] w-[264px] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/80 p-2 text-white backdrop-blur-xl",
            dentro ? "bottom-[68px] right-[150px]" : "bottom-[66px] left-3",
          )}
          role="menu"
          aria-label="Emotes"
        >
          {emotes.map((e) => (
            <button
              key={e.id}
              role="menuitem"
              onClick={() => {
                aoEmote(e.id);
                setEmotesAberto(false);
              }}
              className="h-8 rounded-xl bg-white/10 px-2 text-[12px] text-white/85 transition-colors hover:bg-white/20 hover:text-white active:scale-95"
            >
              {e.nome}
            </button>
          ))}
        </div>
      )}

      {/* convites de jogo da velha */}
      {(convite || enviado) && (
        <div
          className="absolute left-1/2 top-3 flex max-w-[calc(100%-7rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-xs text-white backdrop-blur-md"
          role="status"
        >
          <Swords className="size-3.5 text-red-300" />
          {convite ? (
            <>
              <span className="min-w-0 flex-1 truncate">
                {participantes(convite)?.[0].nome} te desafiou: {NOME_DO_JOGO[convite.tipo]}.
              </span>
              <button
                onClick={() => void responder(convite, true)}
                className="h-7 rounded-full bg-primary px-3 font-semibold text-white"
              >
                Aceitar
              </button>
              <button
                onClick={() => void responder(convite, false)}
                className="h-7 rounded-full border border-white/20 px-3"
              >
                Recusar
              </button>
            </>
          ) : (
            enviado && (
              <>
                <span className="min-w-0 flex-1 truncate">
                  Aguardando {participantes(enviado)?.[1].nome} aceitar o desafio…
                </span>
                <button
                  onClick={() => void responder(enviado, false)}
                  className="h-7 rounded-full border border-white/20 px-3"
                >
                  Cancelar
                </button>
              </>
            )
          )}
        </div>
      )}

      {/* dormindo: quantos estão acordados e no berço, e o botão de acordar */}
      {!dentro && (botaoRaio || botaoConvidar) && (
        <div className="absolute bottom-[68px] right-3 flex flex-col gap-1.5">
          {botaoConvidar}
          {botaoRaio}
        </div>
      )}
      {conviteVisita && (
        <div className="pf-pop absolute bottom-[68px] right-14 z-20 w-[300px] rounded-2xl border border-white/15 bg-[#0d0d0d]/95 p-3.5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold">Convite de visita</p>
              <p className="mt-0.5 text-[11px] text-white/60">
                Só dá acesso ao HOKI. Vale 7 dias e até {conviteVisita.maxUsos} contas.
              </p>
            </div>
            <button
              onClick={() => setConviteVisita(null)}
              aria-label="Fechar"
              className="grid size-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/50">Código</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 select-all rounded-lg bg-white/[0.06] px-2.5 py-1.5 font-mono text-[15px] tracking-[0.12em]">
              {conviteVisita.token}
            </code>
            <button
              onClick={() => void copiar(conviteVisita.token, "Código")}
              aria-label="Copiar código"
              className="grid size-8 place-items-center rounded-lg border border-white/15 hover:bg-white/10"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/50">Link</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 select-all truncate rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[12px] text-white/80">
              {conviteVisita.link}
            </span>
            <button
              onClick={() => void copiar(conviteVisita.link, "Link")}
              aria-label="Copiar link"
              className="grid size-8 place-items-center rounded-lg border border-white/15 hover:bg-white/10"
            >
              <Link2 className="size-3.5" />
            </button>
          </div>
          <p className="mt-3 text-[11px] text-white/55">
            Quem tiver só o código entra em <span className="text-white/80">/visita</span> no site e
            cola ele lá.
          </p>
        </div>
      )}
      {!dentro && (
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEmotesAberto((v) => !v)}
              aria-label="Emotes"
              aria-expanded={emotesAberto}
              title="Emotes"
              className={flutuante}
            >
              <Smile className="size-4" />
            </button>
            <OnlineAgora
              pessoas={pessoasOnline}
              selos={selos}
              onPessoa={setPerfilDe}
              alinhar="esquerda"
              className="rounded-full bg-black/70 backdrop-blur-md"
            />
          </div>
          <button
            onClick={aoAlternar}
            className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(206,14,14,0.45)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            <Sunrise className="size-4" strokeWidth={2} /> Acordar
          </button>
        </div>
      )}
      {/* chat: no canto de cima, logo abaixo da HUD (mensagens e, falando, o campo de escrever) */}
      {(conversa.length > 0 || (falando && dentro && !vistaRanking)) && (
        <div className="absolute left-3 top-[52px] z-20 flex pointer-coarse:top-[150px] w-[min(360px,calc(100%-1.5rem))] flex-col items-start gap-1.5">
          {conversa.length > 0 && (
            <div className="pointer-events-none flex max-w-full flex-col items-start gap-1">
              {conversa.map((m) => (
                <div
                  key={m.chave}
                  className="pf-pop flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/60 py-0.5 pl-0.5 pr-2.5 text-[11.5px] text-white backdrop-blur-md"
                >
                  <span className="block size-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/50">
                    <Hoki2D visual={m.visual} busto />
                  </span>
                  {m.tag && (
                    <span className="shrink-0 rounded bg-primary px-1 text-[8.5px] font-bold leading-[13px]">
                      {m.tag}
                    </span>
                  )}
                  <span className="shrink-0 font-semibold">{m.nome}</span>
                  <span className="truncate text-white/85">{m.texto}</span>
                </div>
              ))}
            </div>
          )}
          {falando && dentro && !vistaRanking && (
            <form
              onSubmit={falar}
              className="pf-pop flex w-full items-center gap-1.5 rounded-xl border border-white/15 bg-black/80 p-1 pl-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              <kbd className="shrink-0 rounded-md bg-white px-1.5 py-px font-sans text-[10.5px] font-bold text-black">
                T
              </kbd>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setFalando(false);
                  }
                }}
                onBlur={() => {
                  if (!texto.trim()) setFalando(false);
                }}
                autoFocus
                maxLength={90}
                placeholder="Fale algo e aperte Enter (Esc fecha)"
                aria-label="Mensagem para a praça"
                className="h-8 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-white outline-none placeholder:text-white/45"
              />
              <button
                type="submit"
                disabled={!texto.trim()}
                className="h-8 shrink-0 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white transition-opacity disabled:opacity-35"
              >
                Enviar
              </button>
            </form>
          )}
        </div>
      )}
      {/* (o botão de dormir fica na divisa, junto do lápis, da mochila e da loja) */}

      {/* na vista do RANKING (câmera parada de frente para o arco) o zoom e o chat saem da frente */}
      {dentro && !vistaRanking && (
        <>
          {/* zoom da câmera */}
          <div className="absolute bottom-[68px] right-3 flex flex-col gap-1.5">
            {botaoConvidar}
            {botaoRaio}
            <button
              onClick={() => mundo.current?.zoom(-0.12)}
              aria-label="Aproximar a câmera"
              title="Aproximar"
              className={flutuante}
            >
              <Plus className="size-4" />
            </button>
            <button
              onClick={() => mundo.current?.zoom(0.12)}
              aria-label="Afastar a câmera"
              title="Afastar"
              className={flutuante}
            >
              <Minus className="size-4" />
            </button>
          </div>

          {/* chat e status */}
          <form
            onSubmit={falar}
            className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/75 p-1.5 backdrop-blur-xl"
          >
            {!falando && (
              <button
                type="button"
                onClick={() => setFalando(true)}
                title="Falar na praça (tecla T)"
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] text-white/60 transition-colors hover:text-white"
              >
                <kbd className="rounded-md bg-white px-1.5 py-px font-sans text-[10.5px] font-bold text-black">
                  T
                </kbd>
                falar
              </button>
            )}
            {/* total online: clica e abre quem está online, dormindo, no lobby ou na HOST FAZENDAS */}
            <OnlineAgora pessoas={pessoasOnline} selos={selos} onPessoa={setPerfilDe} />
            {/* comércio do lobby: atalho que leva o HOKI até a barraca (desligado: COMERCIO_NA_PRACA) */}
            {COMERCIO_NA_PRACA && (
              <button
                type="button"
                onClick={irAoComercio}
                aria-label="Ir ao Comércio do lobby"
                title="Comércio: vender e comprar itens"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:text-white"
              >
                <Store className="size-4" />
              </button>
            )}
            {animacao ? (
              <button
                type="button"
                onClick={() => setAnimacao(null)}
                aria-label="Parar a animação"
                title="Parar a animação"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e5231b] text-white shadow-[0_0_14px_rgba(229,35,27,0.6)]"
              >
                <Square className="size-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEmotesAberto((v) => !v)}
                aria-label="Emotes"
                aria-expanded={emotesAberto}
                title="Emotes"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:text-white"
              >
                <Smile className="size-4" />
              </button>
            )}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  // o status salvo é "emoji texto": separa no primeiro espaço para editar
                  const espaco = status.indexOf(" ");
                  setRascunho(
                    espaco > 0
                      ? { emoji: status.slice(0, espaco), texto: status.slice(espaco + 1) }
                      : { emoji: "📘", texto: "" },
                  );
                  setEditandoStatus((v) => !v);
                }}
                aria-expanded={editandoStatus}
                title="Seu status na praça"
                className={cn(
                  "flex h-9 max-w-[150px] items-center rounded-full border px-3 text-[12px] transition-colors",
                  status
                    ? "border-primary/50 bg-primary/15 text-red-300"
                    : "border-white/15 text-white/60 hover:text-white",
                )}
              >
                <span className="truncate">{status || "＋ Status"}</span>
              </button>
              {editandoStatus && (
                <div className="pf-pop absolute bottom-12 right-0 z-10 w-[290px] rounded-2xl border border-white/15 bg-[#0d0d0d]/95 p-3 text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                  <p className="eyebrow">Seu status</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {EMOJIS_STATUS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setRascunho((r) => ({ ...r, emoji: e }))}
                        aria-label={`Emoji ${e}`}
                        className={cn(
                          "grid size-8 place-items-center rounded-lg text-base transition-colors",
                          rascunho.emoji === e ? "bg-white/15" : "hover:bg-white/[0.08]",
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-base">
                      {rascunho.emoji}
                    </span>
                    <input
                      value={rascunho.texto}
                      onChange={(e) => setRascunho((r) => ({ ...r, texto: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          salvarStatus(
                            rascunho.texto.trim() ? `${rascunho.emoji} ${rascunho.texto}` : "",
                          );
                        }
                      }}
                      maxLength={28}
                      autoFocus
                      placeholder="Lendo, no café…"
                      aria-label="Texto do status"
                      className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/40 px-3 text-[13px] outline-none focus:border-white/30"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {STATUS_PRONTOS.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => salvarStatus(sp)}
                        className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => salvarStatus("")}
                      className="h-8 flex-1 rounded-full border border-white/[0.1] text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        salvarStatus(
                          rascunho.texto.trim() ? `${rascunho.emoji} ${rascunho.texto}` : "",
                        )
                      }
                      className="h-8 flex-1 rounded-full bg-primary text-[11px] font-semibold text-white"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
            {falando && (
              <button
                type="submit"
                disabled={!texto.trim()}
                aria-label="Enviar"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            )}
          </form>
        </>
      )}

      {/* ações sobre a pessoa clicada: perfil e chamar sempre; interações e desafio só acordado e perto */}
      {alvo && (
        <div className="pf-pop absolute inset-x-3 bottom-[68px] z-10 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/15 bg-black/85 p-2 text-xs text-white backdrop-blur-md">
          <div className="flex items-center gap-2 px-1">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
              {alvo.tag && (
                <span className="rounded-full bg-[#ce0e0e] px-1.5 py-px text-[8.5px] font-bold tracking-wide">
                  {alvo.tag}
                </span>
              )}
              <b className="truncate font-semibold">{alvo.nome}</b>
              <span className="truncate text-white/55">
                {alvo.pet ? `· ${alvo.pet}` : ""}
                {alvo.dorme ? " · dormindo" : ""}
              </span>
            </span>
            <button
              onClick={() => setAlvo(null)}
              aria-label="Fechar"
              className="grid size-7 place-items-center rounded-full text-white/70 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setPerfilDe(alvo.id);
                setAlvo(null);
              }}
              className={acaoSobre}
            >
              <UserRound className="size-3.5" /> Perfil
            </button>
            <button onClick={() => chamar(alvo)} className={acaoSobre}>
              <BellRing className="size-3.5" /> Chamar
            </button>
            <button
              onClick={() => {
                setEscreverPara({ id: alvo.id, nome: alvo.nome });
                setCorreioAberto(true);
                setAlvo(null);
              }}
              title="Manda pelo correio: chega mesmo se a pessoa estiver dormindo"
              className={acaoSobre}
            >
              <span className="text-[13px] leading-none">🍎</span> Mandar comida/bebida
            </button>
            {dentro && !alvo.dorme && (
              <>
                <button
                  onClick={() => {
                    setDarPara(alvo);
                    setAlvo(null);
                  }}
                  className={acaoSobre}
                >
                  <Gift className="size-3.5" /> Dar presente
                </button>
                {DUPLAS.map((t) => (
                  <button key={t} onClick={() => convidar(alvo, t)} className={acaoSobre}>
                    <span className="text-[13px] leading-none">{INTERACOES[t].emoji}</span>{" "}
                    {INTERACOES[t].nome}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setEscolhendoDesafio(alvo);
                    setAlvo(null);
                  }}
                  className={cn(acaoSobre, "!border-transparent !bg-white !text-black")}
                >
                  <Swords className="size-3.5" /> Desafiar
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* arco do RANKING em primeira pessoa: trocar de ranking e sair */}
      {vistaRanking && (
        <div className="pf-pop absolute inset-x-3 bottom-4 z-20 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-1 rounded-full border border-white/15 bg-black/70 p-1 backdrop-blur-md">
            {RANKINGS.map((r, i) => (
              <button
                key={r.chave}
                onClick={() => setPaginaRanking(i)}
                aria-pressed={quadroRanking.pagina === i}
                title={r.titulo}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  quadroRanking.pagina === i
                    ? "bg-[#ffd84a] text-black"
                    : "text-white/75 hover:text-white",
                )}
              >
                {/* o título grande no arco já diz "TOP …": aqui fica só o nome, para caber numa linha */}
                {r.titulo.replace(/^Top /, "")}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPaginaRanking((n) => n + 1)}
              className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/75 pl-1.5 pr-4 text-[12px] font-semibold text-white backdrop-blur-md hover:border-white/30"
            >
              <kbd className="rounded-md bg-white px-1.5 py-px font-sans text-[11px] font-bold text-black">
                E
              </kbd>
              Próximo
            </button>
            <button
              onClick={sairDoRanking}
              className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/75 pl-1.5 pr-4 text-[12px] font-semibold text-white backdrop-blur-md hover:border-white/30"
            >
              <kbd className="rounded-md bg-white px-1.5 py-px font-sans text-[11px] font-bold text-black">
                F
              </kbd>
              Sair
            </button>
          </div>
        </div>
      )}
      {/* com fome ou sede (10% ou menos): o HOKI anda devagar */}
      {dentro && lento && !vistaRanking && (
        <div className="pf-pop pointer-events-none absolute left-1/2 top-12 z-10 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-2 rounded-2xl border border-amber-300/30 bg-black/75 px-3 py-1 text-center text-[11.5px] text-amber-100 backdrop-blur-md">
          <span className="text-[13px] leading-none">🐢</span>
          <span className="whitespace-nowrap">
            {pet.fome <= 10 && pet.sede <= 10
              ? "Com fome e sede: andando devagar"
              : pet.fome <= 10
                ? "Com fome: andando devagar"
                : "Com sede: andando devagar"}
          </span>
          <span className="whitespace-nowrap text-amber-100/60">
            {pet.sede <= 10 ? "· água grátis na fonte" : "· coma algo da mochila"}
          </span>
        </div>
      )}
      {/* carta nova: aviso discreto no topo (clicar leva o HOKI até a caixa) */}
      {naoLidas > 0 && !correioAberto && (
        <button
          onClick={irAoCorreio}
          title="Ir até a caixa do correio"
          className="pf-pop absolute left-1/2 top-3 z-10 flex h-7 -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 pl-2 pr-3 text-[11.5px] text-white/90 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white"
        >
          <span className="relative grid size-4 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#e5231b] opacity-60" />
            <Mail className="relative size-3 text-[#ff6a57]" strokeWidth={2.2} />
          </span>
          {naoLidas === 1 ? "1 carta nova" : `${naoLidas} cartas novas`} · leia na caixa do correio
        </button>
      )}
      {/* portal do Magnata: criar uma sala ou entrar numa (convite, código ou a partida em que eu já estava) */}
      {portalAberto && !magnata && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Portal do Magnata HOST"
          className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(ev) => ev.target === ev.currentTarget && setPortalAberto(false)}
        >
          <div className="pf-pop w-full max-w-[420px] rounded-2xl border border-white/10 bg-black/85 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary">
              Portal
            </p>
            <h3 className="font-display text-2xl font-semibold leading-tight">Magnata HOST</h3>
            <p className="mt-1 text-[12px] text-white/60">
              Jogo de tabuleiro de imóveis para 2 a 6 amigos: compre lugares da cidade, cobre
              aluguel e seja o último de pé.
            </p>
            <button
              onClick={() => abrirMagnata(novoCodigo(), true)}
              className="mt-4 flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left text-black transition hover:bg-white/90 active:scale-[0.99]"
            >
              <span className="text-2xl">🎲</span>
              <span className="leading-tight">
                <span className="block text-[13.5px] font-bold">Criar partida</span>
                <span className="text-[11.5px] text-black/60">
                  Abre uma sala privada e convida quem está online
                </span>
              </span>
            </button>
            <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[13.5px] font-bold">Entrar em partida</p>
              {convitesMagnata.map((c) => (
                <button
                  key={c.codigo}
                  onClick={() => abrirMagnata(c.codigo, false)}
                  className="mt-2 flex h-9 w-full items-center justify-between rounded-full border border-[#ffd23f]/40 bg-[#ffd23f]/10 px-3 text-[12px] hover:bg-[#ffd23f]/20"
                >
                  <span className="flex items-center gap-1.5">
                    🔔 <b>{c.nome}</b> te chamou
                  </span>
                  <b className="text-[#ffd23f]">entrar</b>
                </button>
              ))}
              {minhaSalaMagnata && (
                <button
                  onClick={() => abrirMagnata(minhaSalaMagnata, false)}
                  className="mt-2 flex h-9 w-full items-center justify-between rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 text-[12px] hover:bg-emerald-400/20"
                >
                  <span>Voltar para a sua partida</span>
                  <b className="text-emerald-300">voltar</b>
                </button>
              )}
              {!convitesMagnata.length && !minhaSalaMagnata && (
                <p className="mt-1 text-[11.5px] leading-snug text-white/50">
                  Nenhum chamado ainda. Quando alguém tocar o sino 🔔 na sala dele, o convite
                  aparece aqui e no seu computador.
                </p>
              )}
            </div>
            <button
              onClick={() => setPortalAberto(false)}
              className="mt-3 w-full text-center text-[12px] text-white/50 hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {magnata && (
        <Magnata
          codigo={magnata.codigo}
          criar={magnata.criar}
          eu={euNoMagnata}
          amigos={amigosOnline}
          onConvidar={(id, codigo) =>
            enviarNaPraca("magnata", { para: id, de: euPessoa.id, nome: euPessoa.nome, codigo })
          }
          onClose={fecharMagnata}
        />
      )}
      {/* HOST FAZENDAS: portal da porta do celeiro e a ilha aberta */}
      {portalFazendas && !fazenda && (
        <PortalDasFazendas
          onMinhaIlha={() => abrirFazenda(null)}
          onVisitar={(id) => abrirFazenda(id)}
          onAbrirNaIlha={(painel) => abrirFazenda(null, painel)}
          naIlha={presentes}
          onClose={() => setPortalFazendas(false)}
        />
      )}
      {fazenda && (
        <Fazenda
          key={`${fazenda.visitar ?? "minha"}-${fazenda.vez}`}
          eu={euNaFazenda}
          visitar={fazenda.visitar}
          painelInicial={fazenda.painel}
          online={presentes}
          onProdutos={receberProdutos}
          onClose={fecharFazenda}
        />
      )}
      {/* ao alcance: o que a tecla E faz aqui */}
      {dentro && perto && eu.banco === null && !vistaRanking && (
        <div className="pf-pop pointer-events-none absolute bottom-[68px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-[12px] text-white backdrop-blur-md">
          <kbd className="rounded-md bg-white px-1.5 py-px font-sans text-[11px] font-bold text-black">
            E
          </kbd>
          {perto.tipo === "cadeira"
            ? "sentar e trabalhar"
            : perto.tipo === "canteiro"
              ? textoDoCanteiro(perto.i)
              : perto.tipo === "chuveiro"
                ? `tomar banho (higiene ${pet.higiene}%)`
                : perto.tipo === "correio"
                  ? "abrir a caixa postal"
                  : perto.tipo === "comercio"
                    ? "abrir o Comércio"
                    : perto.tipo === "portal"
                      ? "entrar no portal do Magnata"
                      : perto.tipo === "fazendas"
                        ? "entrar no HOST FAZENDAS"
                        : perto.tipo === "siege"
                          ? "entrar no HOST SIEGE"
                          : perto.tipo === "ranking"
                            ? "ver o ranking"
                            : perto.tipo === "fonte"
                              ? "pegar água na fonte"
                              : "abrir o queridômetro"}
        </div>
      )}
      {correioAberto && (
        <Correio
          pet={pet}
          escreverPara={escreverPara}
          podeDirecao={isCoordinatorPlus(cargo)}
          onFlor={(id, n) =>
            guardarMochila((inv) => (n > 0 ? comMais(inv, id, n) : comMenos(inv, id, -n)))
          }
          onClose={() => {
            setCorreioAberto(false);
            setEscreverPara(null);
          }}
        />
      )}
      {comercioAberto && (
        <Comercio pet={pet} eu={euPessoa} onClose={() => setComercioAberto(false)} />
      )}
      {escolhendoDesafio && (
        <div className="pf-pop absolute inset-x-3 bottom-[68px] z-20 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/15 bg-black/90 p-2.5 text-xs text-white backdrop-blur-md">
          <div className="flex items-center gap-2 px-1">
            <Swords className="size-3.5 text-white/70" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              Desafiar {escolhendoDesafio.nome} em…
            </span>
            <button
              onClick={() => setEscolhendoDesafio(null)}
              aria-label="Fechar"
              className="grid size-7 place-items-center rounded-full text-white/70 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {DESAFIOS.map((d) => (
              <button
                key={d.tipo}
                onClick={() => void desafiar(escolhendoDesafio, d.tipo)}
                className={cn(acaoSobre, "justify-start")}
              >
                <span className="text-[13px] leading-none">{d.emoji}</span> {d.nome}
              </button>
            ))}
          </div>
        </div>
      )}
      {perfilDe && petDoPerfil && (
        <PerfilHoki pet={petDoPerfil} onClose={() => setPerfilDe(null)} />
      )}

      {velhaId && <VelhaDialog jogoId={velhaId} eu={euPessoa} onClose={() => setVelhaId(null)} />}
      {desafioId && (
        <DesafioDialog jogoId={desafioId} eu={euPessoa} onClose={() => setDesafioId(null)} />
      )}
      {festaAberta && (
        <FestaDialog salas={festas} eu={euPessoa} onClose={() => setFestaAberta(false)} />
      )}
      {cartas && <CartasDialog eu={euPessoa} salas={salas} onClose={() => setCartas(false)} />}
      {queridometro && !souVisita && (
        <Queridometro euId={euPessoa.id} onClose={() => setQueridometro(false)} />
      )}
    </div>
  );
}

/** Escolher o que dar para alguém: os itens da mochila e a quantidade. */
function EscolherPresente({
  pet,
  para,
  onDar,
  onClose,
}: {
  pet: HokiPet;
  para: Presenca;
  onDar: (id: string, n: number) => void;
  onClose: () => void;
}) {
  const meus = ITENS.filter((i) => (pet.inventario[i.id] ?? 0) > 0);
  // presentes primeiro, depois comida e bebida
  meus.sort((a, b) => Number(b.tipo === "presente") - Number(a.tipo === "presente"));
  const [id, setId] = useState(meus[0]?.id ?? "");
  const [n, setN] = useState(1);
  const tenho = pet.inventario[id] ?? 0;
  const escolhido = item(id);
  return (
    <div className="pf-pop absolute inset-x-3 bottom-[68px] z-20 mx-auto w-[min(100%,440px)] rounded-2xl border border-white/15 bg-black/90 p-3 text-xs text-white backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Gift className="size-3.5 text-white/70" />
        <p className="min-w-0 flex-1 truncate font-semibold">Dar um presente para {para.nome}</p>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="grid size-7 place-items-center rounded-full text-white/70 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {meus.length === 0 ? (
        <p className="mt-2 text-white/60">
          Sua mochila está vazia. Colha na HOST FAZENDAS (cada colheita manda um pouco para a
          mochila) ou compre no Comércio do lobby.
        </p>
      ) : (
        <>
          <div className="mt-2 grid max-h-[132px] grid-cols-7 gap-1.5 overflow-y-auto">
            {meus.map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  setId(i.id);
                  setN(1);
                }}
                title={i.nome}
                aria-pressed={id === i.id}
                className={cn(
                  "relative grid h-11 place-items-center rounded-xl border text-[20px] leading-none",
                  id === i.id
                    ? "border-white/60 bg-white/15"
                    : "border-white/10 bg-white/[0.05] hover:bg-white/[0.1]",
                )}
              >
                {i.emoji}
                <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold tabular-nums text-white/80">
                  {pet.inventario[i.id]}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-white/80">
              {escolhido ? `${escolhido.emoji} ${escolhido.nome}` : ""}
            </span>
            <button
              onClick={() => setN((v) => Math.max(1, v - 1))}
              aria-label="Menos um"
              className="grid size-7 place-items-center rounded-full border border-white/15"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-6 text-center font-semibold tabular-nums">{n}</span>
            <button
              onClick={() => setN((v) => Math.min(tenho, v + 1))}
              aria-label="Mais um"
              className="grid size-7 place-items-center rounded-full border border-white/15"
            >
              <Plus className="size-3" />
            </button>
            <button
              disabled={!escolhido || tenho < 1}
              onClick={() => onDar(id, Math.min(n, tenho))}
              className="h-8 rounded-full bg-white px-3.5 font-semibold text-black disabled:opacity-50"
            >
              Oferecer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Dica das teclas no computador: aparece ao entrar na praça (nas 6 primeiras vezes) e some
 * sozinha depois de alguns segundos ou na primeira tecla de andar.
 */
function DicaDeTeclas({ ativo }: { ativo: boolean }) {
  const [mostra, setMostra] = useState(false);
  useEffect(() => {
    if (!ativo) return setMostra(false);
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let vezes = 0;
    try {
      vezes = Number(localStorage.getItem("hoki-dica-teclas") ?? "0") || 0;
      if (vezes >= 6) return;
      localStorage.setItem("hoki-dica-teclas", String(vezes + 1));
    } catch {
      // sem armazenamento: mostra mesmo assim
    }
    setMostra(true);
    const fim = setTimeout(() => setMostra(false), 9000);
    const aoTeclar = (e: KeyboardEvent) => {
      if (/^(Key[WASD]|Arrow|Space)/.test(e.code)) setMostra(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      clearTimeout(fim);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [ativo]);
  if (!mostra) return null;
  const tecla =
    "rounded-md border border-white/25 bg-white/15 px-1.5 py-px font-mono text-[10.5px] font-semibold";
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-3.5 py-1.5 text-[11.5px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <span className="flex items-center gap-1">
        <span className={tecla}>W A S D</span> andar
      </span>
      <span className="flex items-center gap-1">
        <span className={tecla}>Shift</span> correr
      </span>
      <span className="flex items-center gap-1">
        <span className={tecla}>Espaço</span> pular
      </span>
      <span className="flex items-center gap-1">
        <span className={tecla}>Botão direito</span> soco
      </span>
      <span className="flex items-center gap-1">
        <span className={tecla}>B</span> animações
      </span>
      <span className="hidden items-center gap-1 sm:flex">
        arraste para girar · roda para afastar
      </span>
    </div>
  );
}
