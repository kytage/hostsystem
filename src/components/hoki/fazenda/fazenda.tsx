import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  Backpack,
  Gift,
  Hammer,
  Loader2,
  Mail,
  Palette,
  RotateCw,
  ShoppingBasket,
  Store,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Visual } from "@/lib/hoki";
import {
  ANIMAIS,
  ARVORES,
  BATERIAS,
  BONUS_DIARIO,
  BONUS_SEMANAL,
  CONQUISTAS,
  CORES_LEVEL,
  corDoSelo,
  CULTURAS,
  cultura,
  DECORACOES,
  ETAPAS_TUTORIAL,
  expansaoDe,
  FESTIVAL,
  item,
  lucroDe,
  MAESTRIA,
  MATERIAIS,
  MISSOES_DIARIAS,
  MISSOES_SEMANAIS,
  NIVEL_SEMANAIS,
  PRECO_ARAR,
  progressoDoNivel,
  PROJETOS,
  proximaExpansao,
  SOCIAL,
  TRATORES,
  TUTORIAL_FIM,
  type ItemDoCatalogo,
  type Material,
  type QualTrator,
} from "@/lib/fazenda/catalogo";
import {
  chave,
  estadoDoCanteiro,
  festivalAtivo,
  lojaDoFestivalAberta,
  ocupacao,
  objetosContados,
  limiteDeObjetos,
  progressoDoProjeto,
  textoDaRecompensa,
  type Acao,
  type Evento,
  type Ilha,
  type Jogador,
  type Privacidade,
} from "@/lib/fazenda/regras";
import {
  fazendaAcao,
  fazendaAdubar,
  fazendaAmigos,
  fazendaConvidar,
  fazendaCorreio,
  fazendaEntrar,
  fazendaPedirAmizade,
  fazendaPresenca,
  fazendaPresentear,
  fazendaRemoverVisitante,
  fazendaResgatarPresente,
  fazendaResponderAmizade,
  fazendaRevogarConvite,
  fazendaVisitar,
} from "@/lib/fazenda.functions";
import { CHAVE_MEU_NIVEL, useSelos, type MeuNivel } from "@/lib/fazenda/selos";
import { Hoki2D } from "../hoki-2d";
import { centroDoQuadrado, criarCenaDaFazenda, type CenaDaFazenda } from "./fazenda-cena";

export interface PessoaOnline {
  id: string;
  nome: string;
  visual: Visual;
}
interface Props {
  eu: { id: string; nome: string; visual: Visual; tag?: string };
  /** Ilha de outra pessoa (visita); sem isso, abre a minha. */
  visitar?: string | null;
  /** Janela que abre junto (Ilhas de Amigos ou Convites e Presentes, vindos do portal). */
  painelInicial?: Painel | null;
  online: PessoaOnline[];
  onClose: () => void;
}
type Painel =
  "loja" | "inventario" | "missoes" | "conquistas" | "projetos" | "vizinhos" | "correio" | "cor";
type Ferramenta =
  | { t: "mao" }
  | { t: "enxada" }
  | { t: "semente"; cultura: string }
  | { t: "cesto" }
  | { t: "pa" }
  | { t: "regador" }
  | { t: "trator"; qual: QualTrator; modo: "arar" | "plantar" | "colher"; rot: number }
  | { t: "colocar"; id: string; item: string; rot: number }
  | { t: "mover"; id: string; item: string; rot: number }
  | { t: "projeto"; id: string };

const vidro =
  "rounded-2xl border border-white/10 bg-black/75 text-white shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl";
const ouros = (v: number) => Math.floor(v).toLocaleString("pt-BR");
const novoOp = () => crypto.randomUUID();
function tempoRestante(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")} min`;
}
const duracao = (ms: number) => (ms >= 3_600_000 ? `${ms / 3_600_000} h` : `${ms / 60_000} min`);

function Botao({
  children,
  onClick,
  tipo = "normal",
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: "forte" | "normal" | "perigo" | "verde";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12px] font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        tipo === "forte" && "bg-white text-black hover:bg-white/90",
        tipo === "verde" && "bg-emerald-400 text-black hover:bg-emerald-300",
        tipo === "normal" && "border border-white/15 bg-white/[0.06] hover:bg-white/[0.12]",
        tipo === "perigo" &&
          "border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25",
        className,
      )}
    >
      {children}
    </button>
  );
}
function Janela({
  titulo,
  icone,
  onClose,
  children,
  largura = "max-w-[720px]",
}: {
  titulo: string;
  icone: ReactNode;
  onClose: () => void;
  children: ReactNode;
  largura?: string;
}) {
  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-black/45 p-3 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn(vidro, "pf-pop flex max-h-[86vh] w-full flex-col", largura)}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="text-[#ffd23f]">{icone}</span>
          <h3 className="font-display text-[15px] font-semibold">{titulo}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto grid size-8 place-items-center rounded-full hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
function Selo({ nivel, cor, grande }: { nivel: number; cor: string; grande?: boolean }) {
  const c = corDoSelo(cor, nivel);
  return (
    <span
      className={cn(
        "inline-grid place-items-center rounded-full font-extrabold tabular-nums",
        grande ? "h-9 min-w-9 px-2 text-[15px]" : "h-5 min-w-5 px-1.5 text-[10.5px]",
      )}
      style={{ background: c.fundo, color: c.texto }}
    >
      {nivel}
    </span>
  );
}

export function Fazenda({ eu, visitar, painelInicial, online, onClose }: Props) {
  const entrar = useServerFn(fazendaEntrar);
  const acaoFn = useServerFn(fazendaAcao);
  const visitarFn = useServerFn(fazendaVisitar);
  const presencaFn = useServerFn(fazendaPresenca);
  const adubarFn = useServerFn(fazendaAdubar);
  const souVisita = !!visitar && visitar !== eu.id;
  const donoId = souVisita ? visitar! : eu.id;
  const [jogador, setJogador] = useState<Jogador | null>(null);
  const [ilha, setIlha] = useState<Ilha | null>(null);
  const [dono, setDono] = useState<{
    nome: string;
    nivel: number;
    cor: string;
    visitantes: number;
  } | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [painel, setPainel] = useState<Painel | null>(painelInicial ?? null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>({ t: "mao" });
  const [sel, setSel] = useState<
    { tipo: "canteiro"; x: number; z: number } | { tipo: "objeto"; id: string } | null
  >(null);
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const relogio = useRef(0);
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaDaFazenda | null>(null);
  const [cenaPronta, setCenaPronta] = useState(false);
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const pendentes = useRef(0);
  const ultimaSemente = useRef("morango");
  const [outros, setOutros] = useState<
    Record<string, { id: string; nome: string; visual: Visual; x: number; z: number; tag?: string }>
  >({});

  // relógio local acertado com o do servidor
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now() + relogio.current), 500);
    return () => clearInterval(id);
  }, []);
  // o nível da fazenda é o nível do HOKI: cartão, perfil, ranking e plaquinha acompanham na hora
  const qc = useQueryClient();
  const nivelAgora = jogador?.nivel;
  const xpAgora = jogador?.xp;
  const corAgora = jogador?.corLevel;
  useEffect(() => {
    if (nivelAgora === undefined || xpAgora === undefined || corAgora === undefined) return;
    qc.setQueryData<MeuNivel | null>(CHAVE_MEU_NIVEL, (v) => ({
      userId: v?.userId ?? eu.id,
      nivel: nivelAgora,
      xp: xpAgora,
      cor: corAgora,
      temIlha: true,
    }));
  }, [qc, eu.id, nivelAgora, xpAgora, corAgora]);
  useEffect(() => {
    if (nivelAgora === undefined) return;
    void qc.invalidateQueries({ queryKey: ["fazenda-selos"] });
    void qc.invalidateQueries({ queryKey: ["hoki-ranking"] });
  }, [qc, nivelAgora, corAgora]);
  const mostrar = useCallback((ev: Evento[]) => {
    for (const e of ev.slice(0, 6)) {
      if (e.tipo === "nivel") toast.success(e.texto, { icon: "⭐" });
      else if (e.tipo === "conquista" || e.tipo === "missao" || e.tipo === "maestria")
        toast.success(e.texto, { icon: "🏆" });
      else if (e.tipo === "cor") toast(e.texto, { icon: "🎨" });
      else if (e.tipo === "grana" || e.tipo === "presenca") toast(e.texto, { icon: "💎" });
      else if (e.tipo === "item") toast(e.texto, { icon: "🎁" });
      else if (e.tipo === "info") toast(e.texto);
    }
  }, []);
  const avisarMudanca = () =>
    void canal.current?.send({ type: "broadcast", event: "mudou", payload: {} });

  // carrega a minha ilha (e, numa visita, a ilha do amigo)
  const recarregar = useCallback(async () => {
    try {
      const minha = await entrar();
      relogio.current = minha.agora - Date.now();
      setJogador(minha.jogador);
      mostrar(minha.ev);
      if (souVisita) {
        const v = await visitarFn({ data: { dono: donoId } });
        if (v.erro) {
          setErroGeral(v.erro);
          return;
        }
        setIlha(v.ilha);
        setDono({
          nome: v.dono.nome,
          nivel: v.dono.nivel,
          cor: v.dono.cor,
          visitantes: v.visitantes,
        });
      } else {
        setIlha(minha.ilha);
        setDono({
          nome: eu.nome,
          nivel: minha.jogador.nivel,
          cor: minha.jogador.corLevel,
          visitantes: 0,
        });
      }
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Não deu para abrir a fazenda agora.");
    }
  }, [entrar, visitarFn, souVisita, donoId, eu.nome, mostrar]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // cena 3D
  const eventos = useRef<Parameters<typeof criarCenaDaFazenda>[2]>({
    onQuadrado() {},
    onObjeto() {},
    onChao() {},
    onPortal() {},
    onCorreio() {},
  });
  useEffect(() => {
    let morto = false;
    let c: CenaDaFazenda | null = null;
    void import("three").then((THREE) => {
      if (morto || !palco.current) return;
      c = criarCenaDaFazenda(THREE, palco.current, {
        onQuadrado: (x, z) => eventos.current.onQuadrado(x, z),
        onObjeto: (id) => eventos.current.onObjeto(id),
        onChao: (x, z) => eventos.current.onChao(x, z),
        onPortal: () => eventos.current.onPortal(),
        onCorreio: () => eventos.current.onCorreio(),
      });
      cena.current = c;
      c.colocarNaChegada();
      setCenaPronta(true);
    });
    return () => {
      morto = true;
      c?.descartar();
      cena.current = null;
      setCenaPronta(false);
    };
  }, []);
  useEffect(() => {
    if (ilha && cenaPronta) cena.current?.setIlha(ilha, Date.now() + relogio.current);
  }, [ilha, cenaPronta]);

  // pessoas na ilha (eu + quem está na mesma ilha agora), com o selo de nível de cada um
  const { data: selos } = useSelos([eu.id, ...Object.keys(outros)]);
  useEffect(() => {
    if (!cenaPronta) return;
    const meu = cena.current?.meuPos() ?? { x: 0, z: 12 };
    cena.current?.setPessoas([
      {
        id: eu.id,
        nome: eu.nome,
        visual: eu.visual,
        x: meu.x,
        z: meu.z,
        souEu: true,
        tag: eu.tag,
        selo: selos?.[eu.id] ?? null,
      },
      ...Object.values(outros).map((o) => ({ ...o, selo: selos?.[o.id] ?? null })),
    ]);
  }, [outros, selos, eu, cenaPronta]);

  // canal da ilha: posição de quem está aqui e o aviso de "mudou" (para os outros recarregarem)
  useEffect(() => {
    const ch = supabase.channel(`hoki-fazenda-${donoId}`, {
      config: { broadcast: { self: false }, presence: { key: eu.id } },
    });
    canal.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const estado = ch.presenceState() as Record<
        string,
        { id: string; nome: string; visual: Visual; x: number; z: number; tag?: string }[]
      >;
      const lista: typeof outros = {};
      for (const [k, v] of Object.entries(estado))
        if (k !== eu.id && v[v.length - 1]) lista[k] = v[v.length - 1]!;
      setOutros(lista);
    });
    ch.on("broadcast", { event: "mudou" }, () => void recarregar());
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        const p = cena.current?.meuPos() ?? { x: 0, z: 12 };
        void ch.track({ id: eu.id, nome: eu.nome, visual: eu.visual, tag: eu.tag, x: p.x, z: p.z });
      }
    });
    let ultimo = "";
    const id = setInterval(() => {
      const p = cena.current?.meuPos();
      if (!p) return;
      const k = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      if (k === ultimo) return;
      ultimo = k;
      void ch.track({ id: eu.id, nome: eu.nome, visual: eu.visual, tag: eu.tag, x: p.x, z: p.z });
    }, 450);
    return () => {
      clearInterval(id);
      void supabase.removeChannel(ch);
      canal.current = null;
    };
  }, [donoId, eu.id, eu.nome, eu.visual, eu.tag, recarregar]);

  // visita: batida de presença; se o dono mudar a privacidade ou remover, volta ao Mundo HOST
  useEffect(() => {
    if (!souVisita) return;
    const id = setInterval(async () => {
      const r = await presencaFn({ data: { dono: donoId } }).catch(() => ({ ok: true }));
      if (!r.ok) {
        toast.info("Seu acesso a essa ilha terminou. Voltando ao Mundo HOST.");
        onClose();
      }
    }, 25_000);
    return () => clearInterval(id);
  }, [souVisita, donoId, presencaFn, onClose]);

  // ---------------- ações ----------------
  /** As ações entram numa fila (uma de cada vez no servidor), então dá para clicar em vários quadrados seguidos. */
  const agir = useCallback(
    (acao: Acao): Promise<boolean> => {
      if (souVisita) return Promise.resolve(false);
      if (pendentes.current >= 16) {
        toast.info("Calma! Ainda estou fazendo as ações anteriores.");
        return Promise.resolve(false);
      }
      const op = novoOp();
      const pos = cena.current?.meuPos();
      pendentes.current++;
      setOcupado(true);
      const vez = fila.current.then(async () => {
        try {
          const r = await acaoFn({
            data: { op, acao: acao as unknown as { t: string }, ...(pos ? { pos } : {}) },
          });
          relogio.current = r.agora - Date.now();
          setJogador(r.jogador);
          setIlha(r.ilha);
          if (r.erro) {
            toast.error(r.erro);
            return false;
          }
          mostrar(r.ev);
          avisarMudanca();
          return true;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Não deu certo agora.");
          return false;
        } finally {
          pendentes.current--;
          if (!pendentes.current) setOcupado(false);
        }
      });
      fila.current = vez;
      return vez;
    },
    [acaoFn, mostrar, souVisita],
  );
  /** Anda até perto do quadrado (alcance de 3 m) e depois faz a ação. */
  const pertoEDepois = (x: number, z: number, f: () => void) => {
    if (!ilha || !cena.current) return;
    const c = centroDoQuadrado(ilha.tamanho, x, z);
    const p = cena.current.meuPos();
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d <= 2.4) return f();
    const k = (d - 1.6) / d;
    cena.current.irAte(p.x + (c.x - p.x) * k, p.z + (c.z - p.z) * k, f);
  };
  const livre = useCallback(
    (w: number, h: number, exceto?: string) => (x: number, z: number) => {
      if (!ilha) return false;
      const oc = ocupacao(ilha, exceto);
      for (let dx = 0; dx < w; dx++)
        for (let dz = 0; dz < h; dz++) {
          const px = x + dx;
          const pz = z + dz;
          if (
            px >= ilha.tamanho ||
            pz >= ilha.tamanho ||
            oc.has(chave(px, pz)) ||
            ilha.canteiros[chave(px, pz)]
          )
            return false;
        }
      return true;
    },
    [ilha],
  );
  // a ferramenta muda o que a cena mostra (marcação do quadrado, área do trator, fantasma)
  useEffect(() => {
    const c = cena.current;
    if (!c || !cenaPronta) return;
    if (ferramenta.t === "colocar" || ferramenta.t === "mover") {
      c.setFantasma({
        modelo: item(ferramenta.item)?.modelo ?? "caixa",
        w: 1,
        h: 1,
        valido: livre(1, 1, ferramenta.t === "mover" ? ferramenta.id : undefined),
      });
    } else if (ferramenta.t === "projeto") {
      c.setFantasma({
        modelo: PROJETOS.find((p) => p.id === ferramenta.id)?.modelo ?? "garagem",
        w: 2,
        h: 2,
        valido: livre(2, 2),
      });
    } else {
      c.setFantasma(null);
      c.setFerramenta(
        ferramenta.t !== "mao",
        ferramenta.t === "trator"
          ? ferramenta.rot % 2
            ? [TRATORES[ferramenta.qual].area[1], TRATORES[ferramenta.qual].area[0]]
            : TRATORES[ferramenta.qual].area
          : null,
      );
    }
  }, [ferramenta, livre, cenaPronta]);

  eventos.current = {
    onQuadrado: (x, z) => {
      if (!ilha) return;
      const can = ilha.canteiros[chave(x, z)];
      const est = estadoDoCanteiro(can, agora);
      const f = ferramenta;
      if (souVisita) {
        if (f.t === "regador" && can) {
          pertoEDepois(x, z, async () => {
            const r = await adubarFn({
              data: {
                op: novoOp(),
                dono: donoId,
                x,
                z,
                plantioId: can.plantioId,
                pos: cena.current?.meuPos(),
              },
            });
            if (r.erro) return void toast.error(r.erro);
            if (r.ilha) setIlha(r.ilha);
            if (r.jogador) setJogador(r.jogador);
            toast.success(
              `Adubo aplicado: −${Math.round((r.reducao ?? 0) / 60_000)} min para ${dono?.nome ?? "o dono"}.`,
              { icon: "💧" },
            );
            mostrar(r.ev);
            avisarMudanca();
          });
        } else setSel({ tipo: "canteiro", x, z });
        return;
      }
      if (f.t === "mao") return setSel({ tipo: "canteiro", x, z });
      if (f.t === "enxada") return pertoEDepois(x, z, () => void agir({ t: "arar", x, z }));
      if (f.t === "semente")
        return pertoEDepois(x, z, () => void agir({ t: "plantar", x, z, cultura: f.cultura }));
      if (f.t === "cesto") {
        if (est !== "maduro") return setSel({ tipo: "canteiro", x, z });
        return pertoEDepois(
          x,
          z,
          () => void agir({ t: "colher", x, z, plantioId: can?.plantioId }),
        );
      }
      if (f.t === "pa") {
        if (!can) return;
        if (
          can.estado === "crescendo" &&
          !window.confirm(
            `Descartar ${cultura(can.cultura ?? "")?.nome ?? "a cultura"}? Você não recebe nada.`,
          )
        )
          return;
        return pertoEDepois(x, z, () => void agir({ t: "remover", x, z }));
      }
      if (f.t === "trator")
        return void agir({
          t: "trator",
          qual: f.qual,
          modo: f.modo,
          x,
          z,
          rot: f.rot,
          cultura: CULTURAS.find((c) => c.id === ultimaSemente.current)?.id,
        });
      if (f.t === "colocar")
        return void agir({ t: "colocar", id: f.id, x, z, rot: f.rot }).then(
          (ok) => ok && setFerramenta({ t: "mao" }),
        );
      if (f.t === "mover")
        return void agir({ t: "mover", id: f.id, x, z, rot: f.rot }).then(
          (ok) => ok && setFerramenta({ t: "mao" }),
        );
      if (f.t === "projeto")
        return void agir({ t: "projetoColocar", id: f.id, x, z }).then(
          (ok) => ok && setFerramenta({ t: "mao" }),
        );
    },
    onObjeto: (id) => setSel({ tipo: "objeto", id }),
    onChao: (x, z) => cena.current?.irAte(x, z),
    onPortal: () => onClose(),
    onCorreio: () => setPainel("correio"),
  };
  useEffect(() => {
    if (ferramenta.t === "semente") ultimaSemente.current = ferramenta.cultura;
  }, [ferramenta]);

  const prog = jogador ? progressoDoNivel(jogador.xp) : null;
  const tutorialAtivo = !souVisita && jogador && jogador.tutorial < TUTORIAL_FIM;

  // a fazenda ocupa a tela inteira (vai direto para o <body>, fora do quadro da praça)
  if (erroGeral)
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-4 text-white"
      >
        <div className={cn(vidro, "flex max-w-sm flex-col items-center gap-3 p-6 text-center")}>
          <p className="text-sm">{erroGeral}</p>
          <Botao tipo="forte" onClick={onClose}>
            Voltar ao Mundo HOST
          </Botao>
        </div>
      </div>,
      document.body,
    );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HOST FAZENDAS"
      className="fixed inset-0 z-[90] overflow-hidden bg-black text-white"
    >
      <div ref={palco} className="absolute inset-0" />
      {(!jogador || !ilha) && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/60">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Abrindo a ilha…
          </p>
        </div>
      )}
      {jogador && ilha && prog && (
        <>
          {/* painel principal: nível, XP, Ouros e Granas */}
          <div
            className={cn(vidro, "absolute left-3 top-3 z-10 flex items-center gap-3 px-3 py-2")}
          >
            <Selo nivel={jogador.nivel} cor={jogador.corLevel} grande />
            <div className="w-[170px]">
              <div className="flex items-center justify-between text-[11px] text-white/70">
                <span className="font-semibold text-white">Nível {jogador.nivel}</span>
                <span className="tabular-nums">
                  {prog.maximo
                    ? "Nível máximo"
                    : `${ouros(prog.noNivel)} / ${ouros(prog.paraSubir)} XP`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300"
                  style={{ width: `${prog.pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[12px] font-semibold tabular-nums">
                <span title="HOST Ouros">🪙 {ouros(jogador.ouros)}</span>
                <span title="HOST Granas">💎 {jogador.granas}</span>
              </div>
            </div>
            {!souVisita && (
              <button
                onClick={() => setPainel("cor")}
                title="Cor do Level"
                className="grid size-8 place-items-center rounded-full border border-white/10 hover:bg-white/10"
              >
                <Palette className="size-4" />
              </button>
            )}
          </div>
          {/* de quem é a ilha */}
          <div
            className={cn(
              vidro,
              "absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-[12px]",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              HOST FAZENDAS
            </span>
            <span className="text-white/40">·</span>
            {souVisita ? (
              <>
                Ilha de <b>{dono?.nome}</b> {dono && <Selo nivel={dono.nivel} cor={dono.cor} />}
              </>
            ) : (
              <>
                Minha ilha · {ilha.tamanho} × {ilha.tamanho} · {objetosContados(ilha)}/
                {limiteDeObjetos(ilha)} objetos
              </>
            )}
            <span className="text-white/40">·</span>
            <Users className="size-3.5" /> {Object.keys(outros).length + 1}
          </div>
          {/* atalhos */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
            {!souVisita && (
              <>
                <Atalho
                  titulo="Loja"
                  onClick={() => setPainel("loja")}
                  icone={<Store className="size-4" />}
                />
                <Atalho
                  titulo="Inventário"
                  onClick={() => setPainel("inventario")}
                  icone={<Backpack className="size-4" />}
                  aviso={jogador.inventario.length}
                />
                <Atalho
                  titulo="Missões"
                  onClick={() => setPainel("missoes")}
                  icone={<Target className="size-4" />}
                  aviso={jogador.diario.bonusPendente ? 1 : 0}
                />
                <Atalho
                  titulo="Conquistas"
                  onClick={() => setPainel("conquistas")}
                  icone={<Award className="size-4" />}
                  aviso={Object.values(jogador.conquistas).filter((c) => c === "pendente").length}
                />
                <Atalho
                  titulo="Projetos"
                  onClick={() => setPainel("projetos")}
                  icone={<Hammer className="size-4" />}
                />
              </>
            )}
            <Atalho
              titulo="Vizinhos"
              onClick={() => setPainel("vizinhos")}
              icone={<Users className="size-4" />}
            />
            <Atalho
              titulo="Correio"
              onClick={() => setPainel("correio")}
              icone={<Mail className="size-4" />}
            />
            <Atalho
              titulo="Voltar ao Mundo HOST"
              onClick={onClose}
              icone={<ArrowLeft className="size-4" />}
            />
          </div>
          {/* tutorial */}
          {tutorialAtivo && (
            <div className={cn(vidro, "pf-pop absolute left-3 top-[86px] z-10 w-[260px] p-3")}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd23f]">
                Tutorial · {jogador.tutorial} de {ETAPAS_TUTORIAL.length}
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug">
                {ETAPAS_TUTORIAL[jogador.tutorial - 1]}
              </p>
              {(jogador.tutorial === 2 || jogador.tutorial === 4) && (
                <p className="mt-1 text-[11.5px] text-white/60">{jogador.tutorialConta} de 4</p>
              )}
              {jogador.tutorial === 3 && <ProximoMaduro ilha={ilha} agora={agora} />}
              {jogador.tutorial === 1 && (
                <Botao tipo="forte" className="mt-2" onClick={() => setPainel("loja")}>
                  Abrir a Loja
                </Botao>
              )}
              {jogador.tutorial === 5 && (
                <Botao tipo="forte" className="mt-2" onClick={() => setPainel("inventario")}>
                  Abrir o inventário
                </Botao>
              )}
              {jogador.tutorial === 6 && (
                <Botao tipo="forte" className="mt-2" onClick={() => setPainel("correio")}>
                  Abrir o Correio
                </Botao>
              )}
            </div>
          )}
          {/* ferramentas */}
          <Ferramentas
            souVisita={souVisita}
            ferramenta={ferramenta}
            setFerramenta={setFerramenta}
            jogador={jogador}
            ilha={ilha}
            ocupado={ocupado}
          />
          {/* menu do canteiro ou do objeto selecionado */}
          {sel && (
            <PainelDaSelecao
              sel={sel}
              ilha={ilha}
              agora={agora}
              souVisita={souVisita}
              onClose={() => setSel(null)}
              agir={agir}
              setFerramenta={setFerramenta}
              pertoEDepois={pertoEDepois}
            />
          )}
          {painel === "loja" && (
            <Loja
              jogador={jogador}
              ilha={ilha}
              agir={agir}
              onClose={() => setPainel(null)}
              setFerramenta={setFerramenta}
            />
          )}
          {painel === "inventario" && (
            <Inventario
              jogador={jogador}
              agir={agir}
              onClose={() => setPainel(null)}
              setFerramenta={setFerramenta}
            />
          )}
          {painel === "missoes" && (
            <Missoes jogador={jogador} agir={agir} onClose={() => setPainel(null)} agora={agora} />
          )}
          {painel === "conquistas" && (
            <Conquistas
              jogador={jogador}
              agir={agir}
              onClose={() => setPainel(null)}
              agora={agora}
            />
          )}
          {painel === "projetos" && (
            <Projetos
              jogador={jogador}
              ilha={ilha}
              agir={agir}
              onClose={() => setPainel(null)}
              setFerramenta={setFerramenta}
            />
          )}
          {painel === "cor" && (
            <CorDoLevel jogador={jogador} eu={eu} agir={agir} onClose={() => setPainel(null)} />
          )}
          {painel === "vizinhos" && (
            <Vizinhos
              eu={eu}
              online={online}
              ilha={souVisita ? null : ilha}
              visitantes={Object.values(outros)}
              agir={agir}
              onClose={() => setPainel(null)}
              souVisita={souVisita}
              donoId={donoId}
            />
          )}
          {painel === "correio" && (
            <Correio
              jogador={jogador}
              souVisita={souVisita}
              agir={agir}
              onClose={() => setPainel(null)}
              setJogador={setJogador}
            />
          )}
          <p className="pointer-events-none absolute bottom-1 right-3 z-0 text-[9px] text-white/35">
            Modelos de fazenda: “Farm Asset Pack” por CristiniDias (CC-BY-4.0)
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}

function Atalho({
  titulo,
  icone,
  onClick,
  aviso = 0,
}: {
  titulo: string;
  icone: ReactNode;
  onClick: () => void;
  aviso?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="relative grid size-10 place-items-center rounded-full border border-white/10 bg-black/70 text-white/85 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
    >
      {icone}
      {aviso > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#e5231b] px-1 text-[9px] font-bold">
          {aviso}
        </span>
      )}
    </button>
  );
}
function ProximoMaduro({ ilha, agora }: { ilha: Ilha; agora: number }) {
  const prox = Object.values(ilha.canteiros)
    .filter((c) => c.maduroEm)
    .map((c) => c.maduroEm! - agora)
    .sort((a, b) => a - b)[0];
  if (prox === undefined) return null;
  return (
    <p className="mt-1 text-[12px] tabular-nums text-emerald-300">
      {prox > 0 ? `Prontos em ${tempoRestante(prox)}` : "Prontos! Use o cesto para colher."}
    </p>
  );
}

// ---------------- barra de ferramentas ----------------
function Ferramentas({
  souVisita,
  ferramenta,
  setFerramenta,
  jogador,
  ilha,
  ocupado,
}: {
  souVisita: boolean;
  ferramenta: Ferramenta;
  setFerramenta: (f: Ferramenta) => void;
  jogador: Jogador;
  ilha: Ilha;
  ocupado: boolean;
}) {
  const [sementes, setSementes] = useState(false);
  const lista: { f: Ferramenta; icone: string; nome: string }[] = souVisita
    ? [
        { f: { t: "mao" }, icone: "✋", nome: "Andar e inspecionar" },
        { f: { t: "regador" }, icone: "💧", nome: "Adubar (ajudar o amigo)" },
      ]
    : [
        { f: { t: "mao" }, icone: "✋", nome: "Andar e inspecionar" },
        { f: { t: "enxada" }, icone: "⛏️", nome: `Enxada: arar (${PRECO_ARAR} Ouros)` },
        { f: { t: "cesto" }, icone: "🧺", nome: "Cesto: colher" },
        { f: { t: "pa" }, icone: "🧹", nome: "Pá: remover" },
      ];
  const ativa = (f: Ferramenta) => f.t === ferramenta.t;
  const sementeAtual = ferramenta.t === "semente" ? cultura(ferramenta.cultura) : null;
  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
      {(ferramenta.t === "colocar" || ferramenta.t === "mover" || ferramenta.t === "projeto") && (
        <div className={cn(vidro, "flex items-center gap-2 px-3 py-1.5 text-[12px]")}>
          Clique num quadrado livre para {ferramenta.t === "mover" ? "mover" : "colocar"}{" "}
          {ferramenta.t === "projeto" ? "o projeto (2 × 2)" : (item(ferramenta.item)?.nome ?? "")}
          {ferramenta.t !== "projeto" && (
            <Botao onClick={() => setFerramenta({ ...ferramenta, rot: (ferramenta.rot + 1) % 4 })}>
              <RotateCw className="size-3.5" /> Girar
            </Botao>
          )}
          <Botao onClick={() => setFerramenta({ t: "mao" })}>Cancelar</Botao>
        </div>
      )}
      {sementes && !souVisita && (
        <div
          className={cn(vidro, "pf-pop grid max-w-[640px] grid-cols-4 gap-1.5 p-2 sm:grid-cols-6")}
        >
          {CULTURAS.map((c) => {
            const bloqueada = jogador.nivel < c.nivel;
            return (
              <button
                key={c.id}
                disabled={bloqueada}
                onClick={() => {
                  setFerramenta({ t: "semente", cultura: c.id });
                  setSementes(false);
                }}
                className="flex flex-col items-center rounded-xl border border-white/10 px-1.5 py-1 text-[10.5px] hover:bg-white/10 disabled:opacity-35"
                title={
                  bloqueada
                    ? `Libera no nível ${c.nivel}`
                    : `${c.nome}: ${duracao(c.tempoMs)}, semente ${c.semente}`
                }
              >
                <span className="text-lg">{c.icone}</span>
                {c.nome}
                <span className="text-white/50">
                  {bloqueada ? `nv ${c.nivel}` : `🪙${c.semente}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className={cn(vidro, "flex items-center gap-1 p-1.5")}>
        {lista.map((x) => (
          <button
            key={x.f.t}
            onClick={() => setFerramenta(x.f)}
            title={x.nome}
            className={cn(
              "grid size-11 place-items-center rounded-xl text-xl transition",
              ativa(x.f) ? "bg-white/20 ring-2 ring-white" : "hover:bg-white/10",
            )}
          >
            {x.icone}
          </button>
        ))}
        {!souVisita && (
          <button
            onClick={() => setSementes((s) => !s)}
            title="Sementes"
            className={cn(
              "flex h-11 items-center gap-1 rounded-xl px-2 text-[12px] font-semibold transition",
              ferramenta.t === "semente" ? "bg-white/20 ring-2 ring-white" : "hover:bg-white/10",
            )}
          >
            <span className="text-xl">{sementeAtual?.icone ?? "🌱"}</span>
            {sementeAtual?.nome ?? "Sementes"}
          </button>
        )}
        {!souVisita &&
          (Object.keys(TRATORES) as QualTrator[]).map((q) =>
            ilha.maquinas[q] ? (
              <TratorBotao
                key={q}
                qual={q}
                ferramenta={ferramenta}
                setFerramenta={setFerramenta}
                cargas={ilha.maquinas[q]!.cargas}
              />
            ) : null,
          )}
        {ocupado && <Loader2 className="mx-1 size-4 animate-spin text-white/60" />}
      </div>
    </div>
  );
}
function TratorBotao({
  qual,
  ferramenta,
  setFerramenta,
  cargas,
}: {
  qual: QualTrator;
  ferramenta: Ferramenta;
  setFerramenta: (f: Ferramenta) => void;
  cargas: number;
}) {
  const ativo = ferramenta.t === "trator" && ferramenta.qual === qual;
  const modo = ativo ? ferramenta.modo : "arar";
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl px-1.5",
        ativo && "bg-white/15 ring-2 ring-white",
      )}
    >
      <button
        onClick={() => setFerramenta({ t: "trator", qual, modo, rot: 0 })}
        title={`${TRATORES[qual].nome} (${cargas} cargas)`}
        className="flex h-11 items-center gap-1 text-[11px] font-semibold"
      >
        <span className="text-xl">{qual === "trator" ? "🚜" : "🚛"}</span>
        {cargas}⚡
      </button>
      {ativo &&
        (["arar", "plantar", "colher"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setFerramenta({ ...ferramenta, modo: m })}
            className={cn(
              "rounded-full px-2 py-1 text-[10.5px]",
              modo === m ? "bg-white text-black" : "hover:bg-white/10",
            )}
          >
            {m}
          </button>
        ))}
      {ativo && qual === "superTrator" && (
        <button
          onClick={() => setFerramenta({ ...ferramenta, rot: ferramenta.rot ? 0 : 1 })}
          title="Girar a área"
          className="rounded-full p-1 hover:bg-white/10"
        >
          <RotateCw className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------- menu do canteiro / objeto ----------------
function PainelDaSelecao({
  sel,
  ilha,
  agora,
  souVisita,
  onClose,
  agir,
  setFerramenta,
  pertoEDepois,
}: {
  sel: { tipo: "canteiro"; x: number; z: number } | { tipo: "objeto"; id: string };
  ilha: Ilha;
  agora: number;
  souVisita: boolean;
  onClose: () => void;
  agir: (a: Acao) => Promise<boolean>;
  setFerramenta: (f: Ferramenta) => void;
  pertoEDepois: (x: number, z: number, f: () => void) => void;
}) {
  let corpo: ReactNode = null;
  if (sel.tipo === "canteiro") {
    const can = ilha.canteiros[chave(sel.x, sel.z)];
    const est = estadoDoCanteiro(can, agora);
    const c = can?.cultura ? cultura(can.cultura) : null;
    corpo = (
      <>
        <p className="text-[13.5px] font-semibold">
          {c ? `${c.icone} ${c.nome}` : est === "arado" ? "🟫 Terra arada" : "🟩 Quadrado livre"}
        </p>
        <p className="text-[11.5px] text-white/60">
          {est === "livre" && "Use a enxada para arar (30 Ouros, +1 XP)."}
          {est === "arado" && "Pronto para receber uma semente."}
          {est === "crescendo" &&
            can?.maduroEm &&
            `Crescendo · pronto em ${tempoRestante(can.maduroEm - agora)}`}
          {est === "maduro" && "Maduro! Pode colher."}
        </p>
        {can?.valorVenda && (
          <p className="text-[11.5px] text-white/60">
            Venda: 🪙 {can.valorVenda} · {can.xpColheita} XP
          </p>
        )}
        {can?.adubo && (
          <p className="text-[11.5px] text-violet-300">
            💧 Adubado por {can.adubo.nome} (−{Math.round(can.adubo.reducaoMs / 60_000)} min)
          </p>
        )}
        {!souVisita && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {est === "livre" && (
              <Botao
                tipo="forte"
                onClick={() =>
                  pertoEDepois(sel.x, sel.z, () => void agir({ t: "arar", x: sel.x, z: sel.z }))
                }
              >
                Arar
              </Botao>
            )}
            {est === "arado" && (
              <Botao
                tipo="forte"
                onClick={() => setFerramenta({ t: "semente", cultura: "morango" })}
              >
                Plantar…
              </Botao>
            )}
            {est === "maduro" && (
              <Botao
                tipo="verde"
                onClick={() =>
                  pertoEDepois(
                    sel.x,
                    sel.z,
                    () =>
                      void agir({
                        t: "colher",
                        x: sel.x,
                        z: sel.z,
                        plantioId: can?.plantioId,
                      }).then(onClose),
                  )
                }
              >
                Colher
              </Botao>
            )}
            {can && (
              <Botao
                tipo="perigo"
                onClick={() => {
                  if (
                    can.estado === "crescendo" &&
                    !window.confirm("Descartar essa cultura? Você não recebe nada.")
                  )
                    return;
                  pertoEDepois(
                    sel.x,
                    sel.z,
                    () => void agir({ t: "remover", x: sel.x, z: sel.z }).then(onClose),
                  );
                }}
              >
                Remover
              </Botao>
            )}
          </div>
        )}
        {souVisita && est === "crescendo" && !can?.adubo && (
          <p className="mt-2 text-[11.5px] text-emerald-300">
            Use o regador 💧 para adubar este canteiro.
          </p>
        )}
      </>
    );
  } else {
    const projetoId = sel.id.startsWith("projeto:") ? sel.id.slice(8) : null;
    if (projetoId) {
      const p = PROJETOS.find((x) => x.id === projetoId);
      const pi = ilha.projetos.find((x) => x.id === projetoId);
      corpo = (
        <>
          <p className="text-[13.5px] font-semibold">
            {p?.icone} {p?.nome}
          </p>
          <p className="text-[11.5px] text-white/60">
            {pi?.concluido
              ? "Projeto concluído"
              : `Etapa ${(pi?.etapa ?? 0) + 1} de ${p?.etapas.length}`}
          </p>
          {!souVisita &&
            (projetoId === "galinheiro" || projetoId === "aprisco" || projetoId === "pomar") && (
              <Botao
                tipo="verde"
                className="mt-2"
                onClick={() => void agir({ t: "coletarGrupo", projeto: projetoId })}
              >
                Coletar em grupo
              </Botao>
            )}
        </>
      );
    } else {
      const o = ilha.objetos.find((x) => x.id === sel.id);
      const it = o ? item(o.item) : null;
      const pronto = o?.prontoEm !== null && o?.prontoEm !== undefined && agora >= o.prontoEm;
      corpo = o && it && (
        <>
          <p className="text-[13.5px] font-semibold">
            {it.icone} {it.nome}
          </p>
          {it.tempoMs && (
            <p className="text-[11.5px] text-white/60">
              {pronto
                ? `Pronto! ${it.produto ?? "Frutas"}: 🪙 ${it.venda} · ${it.xp} XP`
                : `Próxima coleta em ${tempoRestante((o.prontoEm ?? 0) - agora)}`}
            </p>
          )}
          {!souVisita && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pronto && (
                <Botao
                  tipo="verde"
                  onClick={() =>
                    pertoEDepois(
                      o.x,
                      o.z,
                      () => void agir({ t: "coletar", id: o.id }).then(onClose),
                    )
                  }
                >
                  Coletar
                </Botao>
              )}
              <Botao
                onClick={() => (
                  setFerramenta({ t: "mover", id: o.id, item: o.item, rot: o.rot }),
                  onClose()
                )}
              >
                Mover
              </Botao>
              <Botao
                onClick={() =>
                  void agir({ t: "mover", id: o.id, x: o.x, z: o.z, rot: (o.rot + 1) % 4 })
                }
              >
                <RotateCw className="size-3.5" /> Girar
              </Botao>
              <Botao onClick={() => void agir({ t: "guardar", id: o.id }).then(onClose)}>
                Guardar
              </Botao>
              {o.origem === "loja" && (
                <Botao
                  tipo="perigo"
                  onClick={() =>
                    window.confirm(
                      `Vender ${it.nome} por ${Math.floor(it.compra * 0.25)} Ouros?`,
                    ) && void agir({ t: "vender", id: o.id }).then(onClose)
                  }
                >
                  Vender 🪙{Math.floor(it.compra * 0.25)}
                </Botao>
              )}
            </div>
          )}
        </>
      );
    }
  }
  return (
    <div className={cn(vidro, "pf-pop absolute bottom-24 left-3 z-10 w-[280px] p-3")}>
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full hover:bg-white/10"
      >
        <X className="size-3.5" />
      </button>
      {corpo}
    </div>
  );
}

// ---------------- loja ----------------
function Loja({
  jogador,
  ilha,
  agir,
  onClose,
  setFerramenta,
}: {
  jogador: Jogador;
  ilha: Ilha;
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  setFerramenta: (f: Ferramenta) => void;
}) {
  const [aba, setAba] = useState<
    "sementes" | "arvores" | "animais" | "decoracao" | "expansao" | "maquinas"
  >("sementes");
  const linhaDoItem = (it: ItemDoCatalogo) => {
    const bloqueado = jogador.nivel < it.nivel;
    const preco = it.granas ? `💎 ${it.granas}` : `🪙 ${ouros(it.compra)}`;
    const falta = it.granas ? jogador.granas < it.granas : jogador.ouros < it.compra;
    return (
      <div key={it.id} className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2">
        <span className="text-2xl">{it.icone}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold">{it.nome}</p>
          <p className="text-[11px] text-white/55">
            {bloqueado
              ? `Libera no nível ${it.nivel}`
              : it.tempoMs
                ? `${it.produto ?? "Frutas"} a cada ${duracao(it.tempoMs)} · 🪙 ${it.venda} · ${it.xp} XP`
                : "Decoração"}
          </p>
        </div>
        <Botao
          tipo="forte"
          disabled={bloqueado || falta}
          onClick={() => void agir({ t: "comprar", item: it.id })}
        >
          {preco}
        </Botao>
      </div>
    );
  };
  const prox = proximaExpansao(ilha.tamanho);
  return (
    <Janela titulo="Loja" icone={<Store className="size-4" />} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-1">
        {(
          [
            ["sementes", "Sementes"],
            ["arvores", "Árvores"],
            ["animais", "Animais"],
            ["decoracao", "Decoração"],
            ["expansao", "Expansão"],
            ["maquinas", "Máquinas"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={cn(
              "h-8 rounded-full px-3.5 text-[12px] font-semibold",
              aba === id ? "bg-white text-black" : "text-white/65 hover:bg-white/10",
            )}
          >
            {nome}
          </button>
        ))}
      </div>
      {aba === "sementes" && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CULTURAS.map((c) => {
            const bloqueada = jogador.nivel < c.nivel;
            return (
              <button
                key={c.id}
                disabled={bloqueada}
                onClick={() => {
                  setFerramenta({ t: "semente", cultura: c.id });
                  if (jogador.tutorial === 1 && c.id === "morango")
                    void agir({ t: "tutorialLoja" });
                  onClose();
                }}
                className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2 text-left hover:bg-white/10 disabled:opacity-45"
              >
                <span className="text-2xl">{c.icone}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13px] font-semibold">{c.nome}</span>
                  <span className="text-[11px] text-white/55">
                    {bloqueada
                      ? `Libera no nível ${c.nivel}`
                      : `${duracao(c.tempoMs)} · semente 🪙${c.semente} · venda 🪙${c.venda} · lucro 🪙${lucroDe(c)} · ${c.xpPlantar}+${c.xpColher} XP`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {aba === "arvores" && <div className="grid gap-1.5">{ARVORES.map(linhaDoItem)}</div>}
      {aba === "animais" && <div className="grid gap-1.5">{ANIMAIS.map(linhaDoItem)}</div>}
      {aba === "decoracao" && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {DECORACOES.filter((d) => !d.premio).map(linhaDoItem)}
        </div>
      )}
      {aba === "expansao" &&
        (prox ? (
          <div className="space-y-2 rounded-xl bg-white/[0.05] p-3 text-[12.5px]">
            <p className="text-[14px] font-semibold">
              Ampliar para {prox.tamanho} × {prox.tamanho}
            </p>
            <p className="text-white/65">
              Limite de objetos: {expansaoDe(ilha.tamanho).objetos} →{" "}
              <b className="text-white">{prox.objetos}</b> · requer nível {prox.nivel}
              {jogador.nivel >= prox.nivel ? " ✓" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao
                tipo="forte"
                disabled={jogador.nivel < prox.nivel || jogador.ouros < prox.ouros}
                onClick={() =>
                  window.confirm(
                    `Pagar ${ouros(prox.ouros)} Ouros? (precisa de ${prox.vizinhos} vizinho(s) com ilha)`,
                  ) && void agir({ t: "expandir", rota: "ouros" })
                }
              >
                🪙 {ouros(prox.ouros)} + {prox.vizinhos} vizinho(s)
              </Botao>
              <Botao
                disabled={jogador.nivel < prox.nivel || jogador.granas < prox.granas}
                onClick={() =>
                  window.confirm(`Pagar ${prox.granas} Granas?`) &&
                  void agir({ t: "expandir", rota: "granas" })
                }
              >
                💎 {prox.granas}
              </Botao>
            </div>
            <p className="text-[11px] text-white/45">
              Saldo depois: 🪙 {ouros(Math.max(0, jogador.ouros - prox.ouros))} ou 💎{" "}
              {Math.max(0, jogador.granas - prox.granas)}
            </p>
          </div>
        ) : (
          <p className="text-[12.5px] text-white/60">
            Sua ilha já está no tamanho máximo (20 × 20).
          </p>
        ))}
      {aba === "maquinas" && (
        <div className="space-y-2">
          {(Object.keys(TRATORES) as QualTrator[]).map((q) => {
            const t = TRATORES[q];
            const tem = ilha.maquinas[q];
            return (
              <div key={q} className="rounded-xl bg-white/[0.05] p-3 text-[12.5px]">
                <p className="text-[14px] font-semibold">
                  {q === "trator" ? "🚜" : "🚛"} {t.nome} · área {t.area[0]} × {t.area[1]}
                </p>
                <p className="text-white/60">
                  Libera no nível {t.nivel}
                  {q === "superTrator" ? " (depois de concluir a Garagem)" : ""} · vem com 20 cargas
                  · arar, plantar e colher
                </p>
                {tem ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-white/70">Cargas: {tem.cargas}/100</span>
                    {BATERIAS.map((b) => (
                      <span key={b.id} className="flex gap-1">
                        <Botao
                          disabled={tem.cargas + b.cargas > 100}
                          onClick={() =>
                            void agir({ t: "bateria", qual: q, pacote: b.id, moeda: "ouros" })
                          }
                        >
                          +{b.cargas}⚡ 🪙{ouros(b.ouros)}
                        </Botao>
                        <Botao
                          disabled={tem.cargas + b.cargas > 100}
                          onClick={() =>
                            void agir({ t: "bateria", qual: q, pacote: b.id, moeda: "granas" })
                          }
                        >
                          💎{b.granas}
                        </Botao>
                      </span>
                    ))}
                  </div>
                ) : (
                  <Botao
                    tipo="forte"
                    className="mt-2"
                    disabled={jogador.nivel < t.nivel || jogador.ouros < t.compra}
                    onClick={() => void agir({ t: "comprarTrator", qual: q })}
                  >
                    Comprar 🪙 {ouros(t.compra)}
                  </Botao>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Janela>
  );
}

// ---------------- inventário ----------------
function Inventario({
  jogador,
  agir,
  onClose,
  setFerramenta,
}: {
  jogador: Jogador;
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  setFerramenta: (f: Ferramenta) => void;
}) {
  return (
    <Janela titulo="Inventário" icone={<Backpack className="size-4" />} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
        {MATERIAIS.map((m) => (
          <span key={m.id} className="rounded-full bg-white/[0.07] px-2.5 py-1">
            {m.icone} {m.nome}: <b>{jogador.materiais[m.id]}</b>
          </span>
        ))}
      </div>
      {jogador.inventario.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-white/55">
          Nada guardado. Compre árvores, animais e decorações na Loja.
        </p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {jogador.inventario.map((g) => {
            const it = item(g.item);
            return (
              <div key={g.id} className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2">
                <span className="text-2xl">{it?.icone}</span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-[13px] font-semibold">{it?.nome}</p>
                  <p className="text-[11px] text-white/55">
                    {g.origem === "tutorial"
                      ? "Presente do tutorial"
                      : g.origem === "premio"
                        ? "Prêmio"
                        : g.restanteMs !== null
                          ? `Produção pausada (${tempoRestante(g.restanteMs)})`
                          : it?.tempoMs
                            ? "Novo"
                            : "Decoração"}
                  </p>
                </div>
                <Botao
                  tipo="forte"
                  onClick={() => (
                    setFerramenta({ t: "colocar", id: g.id, item: g.item, rot: 0 }),
                    onClose()
                  )}
                >
                  Colocar
                </Botao>
                {g.origem === "loja" && (
                  <Botao
                    onClick={() =>
                      window.confirm(
                        `Vender ${it?.nome} por ${Math.floor((it?.compra ?? 0) * 0.25)} Ouros?`,
                      ) && void agir({ t: "vender", id: g.id })
                    }
                  >
                    Vender
                  </Botao>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Janela>
  );
}

// ---------------- missões ----------------
function Missoes({
  jogador,
  agir,
  onClose,
  agora,
}: {
  jogador: Jogador;
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  agora: number;
}) {
  void agora;
  const [material, setMaterial] = useState<Material>("tabua");
  const d = jogador.diario;
  const s = jogador.semanal;
  const barra = (v: number, alvo: number) => (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-emerald-400"
        style={{ width: `${Math.min(100, (v / alvo) * 100)}%` }}
      />
    </div>
  );
  if (jogador.tutorial < TUTORIAL_FIM)
    return (
      <Janela
        titulo="Missões"
        icone={<Target className="size-4" />}
        onClose={onClose}
        largura="max-w-[520px]"
      >
        <p className="text-[12.5px] text-white/65">As missões aparecem depois do tutorial.</p>
      </Janela>
    );
  return (
    <Janela titulo="Missões" icone={<Target className="size-4" />} onClose={onClose}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
        Diárias · reiniciam à meia-noite (Brasília)
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {MISSOES_DIARIAS.map((m) => {
          const v = d[m.contador];
          const feita = d.feitas.includes(m.id);
          return (
            <div
              key={m.id}
              className={cn(
                "rounded-xl p-2.5 text-[12px]",
                feita ? "bg-emerald-500/15" : "bg-white/[0.05]",
              )}
            >
              <p className="font-semibold">
                {feita ? "✓ " : ""}
                {m.nome}
              </p>
              <p className="text-[11px] text-white/55">{textoDaRecompensa(m.recompensa)}</p>
              {barra(Math.min(v, m.alvo), m.alvo)}
              <p className="mt-0.5 text-right text-[10.5px] tabular-nums text-white/50">
                {Math.min(v, m.alvo)}/{m.alvo}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-2 rounded-xl bg-[#ffd23f]/10 p-2.5 text-[12px]">
        <p className="font-semibold text-[#ffd23f]">{BONUS_DIARIO.nome}</p>
        <p className="text-[11px] text-white/60">
          {textoDaRecompensa(BONUS_DIARIO.recompensa)} e 1 material à escolha
        </p>
        {d.bonusPendente ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {MATERIAIS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMaterial(m.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px]",
                  material === m.id ? "bg-white text-black" : "bg-white/10",
                )}
              >
                {m.icone} {m.nome}
              </button>
            ))}
            <Botao tipo="verde" onClick={() => void agir({ t: "bonusDiario", material })}>
              Resgatar
            </Botao>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-white/50">
            {d.feitas.includes(BONUS_DIARIO.id)
              ? "✓ Resgatado hoje"
              : `${d.feitas.filter((f) => f !== BONUS_DIARIO.id).length}/3 diárias`}
          </p>
        )}
      </div>
      <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/45">
        Semanais · reiniciam na segunda-feira
      </p>
      {jogador.nivel < NIVEL_SEMANAIS ? (
        <p className="text-[12px] text-white/55">Liberam no nível {NIVEL_SEMANAIS}.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {MISSOES_SEMANAIS.map((m) => {
            const v =
              m.id === "s-colher"
                ? s.colheitas
                : m.id === "s-coletar"
                  ? s.coletas
                  : m.id === "s-dias"
                    ? s.dias.length
                    : Math.max(s.adubacoes, Math.floor((s.colheitasExtra / 80) * 12));
            const feita = s.feitas.includes(m.id);
            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl p-2.5 text-[12px]",
                  feita ? "bg-emerald-500/15" : "bg-white/[0.05]",
                )}
              >
                <p className="font-semibold">
                  {feita ? "✓ " : ""}
                  {m.nome}
                </p>
                <p className="text-[11px] text-white/55">{textoDaRecompensa(m.recompensa)}</p>
                {barra(Math.min(v, m.alvo), m.alvo)}
              </div>
            );
          })}
          <div
            className={cn(
              "rounded-xl p-2.5 text-[12px]",
              s.feitas.includes(BONUS_SEMANAL.id) ? "bg-emerald-500/15" : "bg-[#ffd23f]/10",
            )}
          >
            <p className="font-semibold text-[#ffd23f]">{BONUS_SEMANAL.nome}</p>
            <p className="text-[11px] text-white/55">
              {textoDaRecompensa(BONUS_SEMANAL.recompensa)}
            </p>
          </div>
        </div>
      )}
      <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/45">
        Frequência
      </p>
      <div className="flex gap-1">
        {Array.from({ length: 7 }, (_, k) => (
          <span
            key={k}
            className={cn(
              "grid size-8 place-items-center rounded-lg text-[12px] font-bold",
              k < jogador.presenca.sequencia
                ? "bg-emerald-400 text-black"
                : "bg-white/10 text-white/40",
            )}
          >
            {k + 1}
          </span>
        ))}
        <span className="ml-2 self-center text-[11px] text-white/55">
          7 dias seguidos: +3 Granas
        </span>
      </div>
    </Janela>
  );
}

// ---------------- conquistas, maestria e festival ----------------
function Conquistas({
  jogador,
  agir,
  onClose,
  agora,
}: {
  jogador: Jogador;
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  agora: number;
}) {
  return (
    <Janela titulo="Conquistas e Maestria" icone={<Award className="size-4" />} onClose={onClose}>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {CONQUISTAS.map((c) => {
          const st = jogador.conquistas[c.id];
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-xl p-2.5 text-[12px]",
                st === "resgatada"
                  ? "bg-emerald-500/15"
                  : st
                    ? "bg-[#ffd23f]/12"
                    : "bg-white/[0.05]",
              )}
            >
              <p className="font-semibold">🏆 {c.nome}</p>
              <p className="text-[11px] text-white/55">
                {c.condicao} · {textoDaRecompensa(c.recompensa)}
              </p>
              {st === "pendente" && (
                <Botao
                  tipo="verde"
                  className="mt-1.5"
                  disabled={c.id === "primeira-colheita" && jogador.tutorial < TUTORIAL_FIM}
                  onClick={() => void agir({ t: "conquista", id: c.id })}
                >
                  Resgatar
                </Botao>
              )}
              {st === "resgatada" && (
                <p className="mt-1 text-[11px] text-emerald-300">✓ Resgatada</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/45">
        Maestria por cultura
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {CULTURAS.map((c) => {
          const n = jogador.maestrias[c.id] ?? 0;
          const medalha = [...MAESTRIA].reverse().find((m) => n >= m.colheitas);
          const prox = MAESTRIA.find((m) => n < m.colheitas);
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-[12px]"
            >
              <span className="text-lg">{c.icone}</span>
              <span className="flex-1">{c.nome}</span>
              <span className="text-[11px] text-white/60">
                {medalha
                  ? `${medalha.medalha === "Ouro" ? "🥇" : medalha.medalha === "Prata" ? "🥈" : "🥉"} `
                  : ""}
                {n}
                {prox ? `/${prox.colheitas}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {lojaDoFestivalAberta(agora) && (
        <div className="mt-4 rounded-xl bg-orange-500/12 p-3 text-[12px]">
          <p className="text-[14px] font-semibold">🎪 {FESTIVAL.nome}</p>
          <p className="text-white/60">
            {festivalAtivo(agora)
              ? `Cada 5 colheitas = 1 ficha (até 20 por dia). Termina em ${tempoRestante(FESTIVAL.inicio + FESTIVAL.duracaoMs - agora)}.`
              : "O festival acabou: a loja fica aberta por mais 48 h."}
          </p>
          <p className="mt-1 font-semibold">Fichas: {jogador.festival.fichas}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FESTIVAL.trocas.map((t) => (
              <Botao
                key={t.id}
                disabled={
                  jogador.recompensas.includes(`festival:${t.id}`) ||
                  jogador.festival.fichas < t.fichas
                }
                onClick={() => void agir({ t: "festival", troca: t.id })}
              >
                {jogador.recompensas.includes(`festival:${t.id}`) ? "✓ " : ""}
                {t.nome} · {t.fichas} fichas
              </Botao>
            ))}
          </div>
        </div>
      )}
    </Janela>
  );
}

// ---------------- projetos ----------------
function Projetos({
  jogador,
  ilha,
  agir,
  onClose,
  setFerramenta,
}: {
  jogador: Jogador;
  ilha: Ilha;
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  setFerramenta: (f: Ferramenta) => void;
}) {
  return (
    <Janela titulo="Projetos da ilha" icone={<Hammer className="size-4" />} onClose={onClose}>
      <div className="space-y-2">
        {PROJETOS.map((p) => {
          const pi = ilha.projetos.find((x) => x.id === p.id);
          const bloqueado = jogador.nivel < p.nivel;
          const etapa = pi && !pi.concluido ? p.etapas[pi.etapa] : p.etapas[0];
          const progresso = pi ? progressoDoProjeto(ilha, pi) : [];
          const metasOk =
            pi && !pi.concluido && etapa
              ? etapa.metas.every((m, k) => (progresso[k] ?? 0) >= m.quantidade)
              : false;
          const materiaisOk = etapa
            ? Object.entries(etapa.materiais).every(
                ([m, q]) => jogador.materiais[m as Material] >= (q ?? 0),
              )
            : false;
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-xl p-3 text-[12px]",
                pi?.concluido ? "bg-emerald-500/12" : "bg-white/[0.05]",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.icone}</span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold">{p.nome}</p>
                  <p className="text-[11px] text-white/55">
                    Nível {p.nivel} · ocupa 2 × 2
                    {pi
                      ? pi.concluido
                        ? " · concluído"
                        : ` · etapa ${pi.etapa + 1} de ${p.etapas.length}`
                      : ""}
                  </p>
                </div>
                {!pi && (
                  <Botao
                    tipo="forte"
                    disabled={bloqueado}
                    onClick={() => (setFerramenta({ t: "projeto", id: p.id }), onClose())}
                  >
                    {bloqueado ? `Nível ${p.nivel}` : "Colocar a planta"}
                  </Botao>
                )}
              </div>
              {etapa && !pi?.concluido && (
                <div className="mt-2 space-y-1">
                  <p className="text-white/70">
                    Materiais:{" "}
                    {Object.entries(etapa.materiais)
                      .map(
                        ([m, q]) =>
                          `${q} ${MATERIAIS.find((x) => x.id === m)?.nome}${(q ?? 0) > 1 ? "s" : ""} (${jogador.materiais[m as Material]})`,
                      )
                      .join(" · ")}
                  </p>
                  {etapa.metas.map((m, k) => (
                    <p key={k} className="text-white/70">
                      •{" "}
                      {m.tipo === "coletas"
                        ? `Coletas de ${m.produto === "ovos" ? "ovos" : m.produto === "la" ? "lã" : "árvores"}`
                        : m.tipo === "trator"
                          ? "Operações de Trator"
                          : m.tipo === "adubacoes"
                            ? "Adubações em ilhas de amigos"
                            : m.tipo === "colocados"
                              ? `${item(m.item)?.nome} colocadas`
                              : `Colheitas de ${cultura(m.cultura ?? "")?.nome ?? "canteiros"}`}
                      : {pi ? Math.min(progresso[k] ?? 0, m.quantidade) : 0}/{m.quantidade}
                    </p>
                  ))}
                  <p className="text-[11px] text-white/50">
                    Recompensa: {textoDaRecompensa(etapa.recompensa)} · {etapa.beneficio}
                  </p>
                  {pi && (
                    <Botao
                      tipo="verde"
                      disabled={!metasOk || !materiaisOk}
                      onClick={() => void agir({ t: "projetoConcluir", id: p.id })}
                    >
                      Concluir etapa
                    </Botao>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Janela>
  );
}

// ---------------- cor do level ----------------
function CorDoLevel({
  jogador,
  eu,
  agir,
  onClose,
}: {
  jogador: Jogador;
  eu: { nome: string; tag?: string; visual: Visual };
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
}) {
  const atual = corDoSelo(jogador.corLevel, jogador.nivel);
  return (
    <Janela
      titulo="Cor do Level"
      icone={<Palette className="size-4" />}
      onClose={onClose}
      largura="max-w-[560px]"
    >
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/[0.05] p-3">
        <span className="block size-14 overflow-hidden rounded-full bg-black/40">
          <Hoki2D visual={eu.visual} busto />
        </span>
        <span className="flex items-center rounded-full bg-black/60 py-0.5 pl-0.5 pr-2 text-[13px] font-semibold">
          <span
            className="mr-1.5 rounded-full px-2 text-[12px] font-extrabold leading-[20px]"
            style={{ background: atual.fundo, color: atual.texto }}
          >
            {jogador.nivel}
          </span>
          {eu.nome}
          {eu.tag && (
            <span className="ml-1.5 rounded-full bg-[#ce0e0e] px-1.5 text-[9.5px] font-bold leading-[15px]">
              {eu.tag}
            </span>
          )}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {CORES_LEVEL.map((c) => {
          const liberada = jogador.nivel >= c.nivel;
          const emUso = jogador.corLevel === c.id;
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2">
              <span
                className="grid h-7 min-w-9 place-items-center rounded-full px-2 text-[12px] font-extrabold"
                style={{ background: c.fundo, color: c.texto }}
              >
                {jogador.nivel}
              </span>
              <span className="flex-1 text-[12.5px]">{c.nome}</span>
              {!liberada ? (
                <span className="text-[11px] text-white/50">Libera no nível {c.nivel}</span>
              ) : emUso ? (
                <span className="text-[11px] font-semibold text-emerald-300">Em uso</span>
              ) : (
                <Botao onClick={() => void agir({ t: "cor", id: c.id })}>Equipar</Botao>
              )}
            </div>
          );
        })}
      </div>
    </Janela>
  );
}

// ---------------- vizinhos (amigos, convites, visitas, presentes, privacidade) ----------------
type ListaDeAmigos = Awaited<ReturnType<typeof fazendaAmigos>>;
function Vizinhos({
  eu,
  online,
  ilha,
  visitantes,
  agir,
  onClose,
  souVisita,
  donoId,
}: {
  eu: { id: string };
  online: PessoaOnline[];
  ilha: Ilha | null;
  visitantes: { id: string; nome: string }[];
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  souVisita: boolean;
  donoId: string;
}) {
  const listar = useServerFn(fazendaAmigos);
  const pedir = useServerFn(fazendaPedirAmizade);
  const responder = useServerFn(fazendaResponderAmizade);
  const convidar = useServerFn(fazendaConvidar);
  const revogar = useServerFn(fazendaRevogarConvite);
  const presentear = useServerFn(fazendaPresentear);
  const remover = useServerFn(fazendaRemoverVisitante);
  const [dados, setDados] = useState<ListaDeAmigos | null>(null);
  const [material, setMaterial] = useState<Material>("tabua");
  const carregar = useCallback(async () => setDados(await listar()), [listar]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  const visitar = (id: string) =>
    window.dispatchEvent(new CustomEvent("hoki-fazenda-visitar", { detail: id }));
  const jaRelacionados = new Set(
    [...(dados?.amigos ?? []), ...(dados?.enviados ?? []), ...(dados?.recebidos ?? [])].map(
      (a) => a.id,
    ),
  );
  const resposta = (r: { erro?: string; ok?: boolean }, ok: string) =>
    r.erro ? toast.error(r.erro) : toast.success(ok);
  return (
    <Janela titulo="Vizinhos" icone={<Users className="size-4" />} onClose={onClose}>
      {!dados ? (
        <p className="flex items-center gap-2 text-[12.5px]">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="space-y-4">
          {ilha && (
            <div className="rounded-xl bg-white/[0.05] p-3 text-[12px]">
              <p className="mb-1.5 font-semibold">Privacidade da sua ilha</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["amigos", "Somente Amigos"],
                    ["convite", "Por Convite"],
                    ["privada", "Privada"],
                  ] as [Privacidade, string][]
                ).map(([id, nome]) => (
                  <button
                    key={id}
                    onClick={() => void agir({ t: "privacidade", modo: id })}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11.5px] font-semibold",
                      ilha.privacidade === id
                        ? "bg-white text-black"
                        : "bg-white/10 hover:bg-white/15",
                    )}
                  >
                    {nome}
                  </button>
                ))}
              </div>
              {visitantes.length > 0 && (
                <div className="mt-2">
                  <p className="text-white/55">Na ilha agora:</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {visitantes.map((v) => (
                      <span
                        key={v.id}
                        className="flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2 pr-0.5"
                      >
                        {v.nome}
                        <button
                          onClick={async () => (
                            await remover({ data: { visitante: v.id } }),
                            toast.success(`${v.nome} foi removido da ilha.`)
                          )}
                          className="rounded-full px-1.5 text-[10.5px] text-red-300 hover:bg-white/10"
                        >
                          remover
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {dados.convitesRecebidos.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#ffd23f]">
                Convites para visitar
              </p>
              {dados.convitesRecebidos.map((c) => (
                <div
                  key={c.convite}
                  className="flex items-center gap-2 rounded-xl bg-[#ffd23f]/10 p-2 text-[12px]"
                >
                  <span className="flex-1">
                    <b>{c.nome}</b> te convidou · vale por {tempoRestante(c.expiraEm - Date.now())}
                  </span>
                  <Botao tipo="forte" onClick={() => visitar(c.id)}>
                    Visitar
                  </Botao>
                </div>
              ))}
            </div>
          )}
          {dados.recebidos.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Pedidos de amizade
              </p>
              {dados.recebidos.map((a) => (
                <div
                  key={a.relacao}
                  className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2 text-[12px]"
                >
                  <span className="flex-1 font-semibold">{a.nome}</span>
                  <Botao
                    tipo="verde"
                    onClick={async () => (
                      resposta(
                        await responder({ data: { relacao: a.relacao, aceitar: true } }),
                        "Agora vocês são vizinhos!",
                      ),
                      void carregar()
                    )}
                  >
                    Aceitar
                  </Botao>
                  <Botao
                    onClick={async () => (
                      await responder({ data: { relacao: a.relacao, aceitar: false } }),
                      void carregar()
                    )}
                  >
                    Recusar
                  </Botao>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
              Ilhas de Amigos
            </p>
            {dados.amigos.length === 0 ? (
              <p className="text-[12px] text-white/55">
                Você ainda não tem vizinhos. Adicione quem está online abaixo.
              </p>
            ) : (
              <div className="space-y-1">
                {dados.amigos.map((a) => (
                  <div
                    key={a.relacao}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.05] p-2 text-[12px]"
                  >
                    {a.nivel !== null && <Selo nivel={a.nivel} cor={a.cor} />}
                    <span className="flex-1 font-semibold">{a.nome}</span>
                    <span className="text-[11px] text-white/45">
                      {!a.temIlha
                        ? "sem ilha"
                        : a.privacidade === "privada"
                          ? "privada"
                          : a.privacidade === "convite"
                            ? "por convite"
                            : "aberta a amigos"}
                    </span>
                    {a.temIlha && a.id !== donoId && (
                      <Botao tipo="forte" onClick={() => visitar(a.id)}>
                        Visitar
                      </Botao>
                    )}
                    {!souVisita && (
                      <Botao
                        onClick={async () =>
                          resposta(
                            await convidar({ data: { convidado: a.id } }),
                            `Convite enviado para ${a.nome} (vale 15 min).`,
                          )
                        }
                      >
                        Convidar
                      </Botao>
                    )}
                    <span className="flex items-center gap-1">
                      <select
                        value={material}
                        onChange={(e) => setMaterial(e.target.value as Material)}
                        className="h-8 rounded-full border border-white/15 bg-black/60 px-2 text-[11px]"
                      >
                        {MATERIAIS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.icone} {m.nome}
                          </option>
                        ))}
                      </select>
                      <Botao
                        onClick={async () =>
                          resposta(
                            await presentear({ data: { op: novoOp(), para: a.id, material } }),
                            `Presente enviado para ${a.nome}!`,
                          )
                        }
                      >
                        <Gift className="size-3.5" /> Presentear
                      </Botao>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {dados.convitesEnviados.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Convites enviados
              </p>
              {dados.convitesEnviados.map((c) => (
                <div
                  key={c.convite}
                  className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2 text-[12px]"
                >
                  <span className="flex-1">
                    {c.nome} · {tempoRestante(c.expiraEm - Date.now())}
                  </span>
                  <Botao
                    onClick={async () => (
                      await revogar({ data: { id: c.convite } }),
                      void carregar()
                    )}
                  >
                    Revogar
                  </Botao>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
              Adicionar vizinho (quem está online)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {online
                .filter((p) => p.id !== eu.id && !jaRelacionados.has(p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => (
                      resposta(
                        await pedir({ data: { para: p.id } }),
                        `Pedido enviado para ${p.nome}.`,
                      ),
                      void carregar()
                    )}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] pl-1 pr-2.5 text-[12px] hover:bg-white/10"
                  >
                    <span className="block size-6 overflow-hidden rounded-full bg-black/50">
                      <Hoki2D visual={p.visual} busto />
                    </span>
                    {p.nome} +
                  </button>
                ))}
              {dados.enviados.map((a) => (
                <span
                  key={a.relacao}
                  className="flex h-8 items-center rounded-full bg-white/[0.04] px-2.5 text-[11.5px] text-white/50"
                >
                  {a.nome} · pedido enviado
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10.5px] text-white/40">
            Visitantes podem adubar até {SOCIAL.adubosPorIlha} canteiros por ilha e{" "}
            {SOCIAL.adubosPorDia} por dia; presentes: {SOCIAL.presentesEnviarDia} enviados e{" "}
            {SOCIAL.presentesReceberDia} recebidos por dia.
          </p>
        </div>
      )}
    </Janela>
  );
}

// ---------------- correio (kit do tutorial, presentes e registro) ----------------
function Correio({
  jogador,
  souVisita,
  agir,
  onClose,
  setJogador,
}: {
  jogador: Jogador;
  souVisita: boolean;
  agir: (a: Acao) => Promise<boolean>;
  onClose: () => void;
  setJogador: (j: Jogador) => void;
}) {
  const ler = useServerFn(fazendaCorreio);
  const resgatar = useServerFn(fazendaResgatarPresente);
  const [dados, setDados] = useState<Awaited<ReturnType<typeof fazendaCorreio>> | null>(null);
  const carregar = useCallback(async () => setDados(await ler()), [ler]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  const nomeMat = useMemo(
    () => Object.fromEntries(MATERIAIS.map((m) => [m.id, `${m.icone} ${m.nome}`])),
    [],
  );
  return (
    <Janela
      titulo="Correio"
      icone={<Mail className="size-4" />}
      onClose={onClose}
      largura="max-w-[560px]"
    >
      {!souVisita && jogador.tutorial === 6 && (
        <div className="mb-3 rounded-xl bg-emerald-500/15 p-3 text-[12.5px]">
          <p className="text-[14px] font-semibold">📦 Kit do Fazendeiro</p>
          <p className="text-white/65">
            200 Ouros, 15 XP, 2 Tábuas, 2 Tijolos e 2 Sacos de Cimento.
          </p>
          <Botao tipo="verde" className="mt-2" onClick={() => void agir({ t: "kit" })}>
            Coletar o kit
          </Botao>
        </div>
      )}
      {!dados ? (
        <p className="flex items-center gap-2 text-[12.5px]">
          <Loader2 className="size-4 animate-spin" /> Abrindo…
        </p>
      ) : (
        <>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
            Presentes
          </p>
          {dados.presentes.length === 0 ? (
            <p className="text-[12px] text-white/55">Nenhum presente esperando.</p>
          ) : (
            dados.presentes.map((p) => (
              <div
                key={p.id}
                className="mb-1 flex items-center gap-2 rounded-xl bg-white/[0.05] p-2 text-[12px]"
              >
                <span className="flex-1">
                  <b>{p.de}</b> enviou {nomeMat[p.material]} ·{" "}
                  {new Date(p.enviadoEm).toLocaleDateString("pt-BR")} · vence{" "}
                  {new Date(p.expiraEm).toLocaleDateString("pt-BR")}
                </span>
                <Botao
                  tipo="verde"
                  onClick={async () => {
                    const r = await resgatar({ data: { op: novoOp(), id: p.id } });
                    if (r.erro) return void toast.error(r.erro);
                    if (r.jogador) setJogador(r.jogador);
                    toast.success("Presente resgatado!");
                    void carregar();
                  }}
                >
                  Resgatar
                </Botao>
              </div>
            ))
          )}
          <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/45">
            Registro da ilha
          </p>
          {dados.registro.length === 0 ? (
            <p className="text-[12px] text-white/55">Ninguém visitou ainda.</p>
          ) : (
            dados.registro.map((r, k) => (
              <p
                key={k}
                className="border-t border-white/[0.06] py-1 text-[11.5px] text-white/75 first:border-0"
              >
                <b>{r.ator_nome}</b> {r.detalhe} ·{" "}
                {new Date(r.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            ))
          )}
        </>
      )}
    </Janela>
  );
}
