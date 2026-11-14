import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Dices, Loader2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { meuLugar, usePresencaHoki } from "@/lib/hoki-presenca";
import {
  aoVivo,
  CUIDADOS,
  ENERGIA_POR_JOGO,
  ENTREGADOR_DE_COINS,
  humor,
  meuPet,
  NOME_MAX,
  nomeValido,
  rankingPorNivel,
  salvarPet,
  sugerirNome,
  todosPets,
  type Cuidado,
  type HokiPet,
} from "@/lib/hoki";
import { corDoSelo, progressoDoNivel } from "@/lib/fazenda/catalogo";
import { useMeuNivel, useSelos } from "@/lib/fazenda/selos";
import { useMyRole } from "@/lib/permissions";
import { ROLE_TAG } from "@/lib/roles";
import { useSouVisita } from "@/lib/hoki-visita";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { PainelCoins } from "./guarda-roupa";
import { Loja } from "./loja";
import { CORPOS, INTERACOES_BONECO } from "./boneco";
import { EscolhaDeGenero } from "./escolha-genero";
import { HudDoJogador } from "./hud-jogador";
import { Cosmeticos } from "./cosmeticos";
import { Hoki2D } from "./hoki-2d";
import type { Reacao } from "./hoki-3d";
import { HokiJogos, type Resultado } from "./minigames";
import { Praca } from "./praca";
import { InicioDoHoki } from "./inicio-hoki";
import type { PessoaOnlineAgora } from "./online-agora";
import { PerfilHoki } from "./perfil";
import { arrumarMochila, Mochila } from "./mochila";
import { type Item } from "@/lib/hoki-itens";

const KEY = ["hoki-meu"];
const REACAO: Record<Cuidado["id"], Reacao> = {
  comida: "comer",
  bebida: "beber",
  carinho: "carinho",
  soneca: "dormir",
};
/** Menu de interações: as animações do boneco (braços cruzados, telefone, golpes, trabalho…). */
const TRUQUES: { id: Reacao; nome: string }[] = INTERACOES_BONECO;

/**
 * Painel do HOKI, em formato panorâmico: mascote e cuidados à esquerda,
 * a Praça HOST no centro e o ranking (com a entrega de coins) à direita.
 */
export function HokiCard({
  alto = false,
  cabecalho = false,
}: {
  /** Na tela só do HOKI: a praça ocupa a altura da janela. */
  alto?: boolean;
  /**
   * Na tela só do HOKI: antes de acordar aparece a tela de entrada (a ilha flutuando com o nome,
   * o meu perfil e quem está online); a praça só abre, por cima dela, ao acordar.
   */
  cabecalho?: boolean;
} = {}) {
  const qc = useQueryClient();
  useRealtimeTable("hoshi_pets", [["hoki-ranking"], ["hoki-todos"], KEY]);
  const {
    data: salvo,
    isLoading,
    isError,
  } = useQuery({ queryKey: KEY, queryFn: meuPet, staleTime: Infinity });
  const { data: ranking = [] } = useQuery({
    queryKey: ["hoki-ranking"],
    queryFn: rankingPorNivel,
    staleTime: 30_000,
  });
  // o nível do HOKI é o nível do HOST FAZENDAS
  const { data: meuNivel } = useMeuNivel();
  // cabeçalho da tela do HOKI: quem está online (eu incluído), o nível de cada um e os perfis
  const { outros } = usePresencaHoki();
  const { data: cargo } = useMyRole();
  const souVisita = useSouVisita();
  const { data: selos } = useSelos(
    cabecalho && salvo ? [salvo.user_id, ...Object.keys(outros)] : [],
  );
  const { data: todos = [] } = useQuery({
    queryKey: ["hoki-todos"],
    queryFn: todosPets,
    staleTime: 60_000,
    enabled: cabecalho,
  });
  const quadroDaPraca = useRef<HTMLDivElement>(null);
  const secao = useRef<HTMLElement>(null);
  /** A praça abrindo por cima da tela de entrada, ou fechando de volta (um círculo em cima da ilha). */
  const [transicao, setTransicao] = useState<null | "entrando" | "saindo">(null);
  const iris = useRef<{ x: number; y: number; r: number; max: number } | null>(null);
  const [, tique] = useState(0);
  const [reacao, setReacao] = useState<{ tipo: Reacao; n: number } | null>(null);
  const [jogando, setJogando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [lojaAberta, setLojaAberta] = useState(false);
  const [corpoAberto, setCorpoAberto] = useState(false);
  const [cosmeticosAberto, setCosmeticosAberto] = useState(false);
  /** Mochila aberta (e em qual aba: tudo, comidas ou bebidas). */
  const [mochila, setMochila] = useState<"tudo" | "comida" | "bebida" | null>(null);
  const [perfil, setPerfil] = useState<HokiPet | null>(null);
  // aberta a aba, o HOKI fica na praça mesmo trocando de tela: volta acordado se estava acordado
  const [naPraca, setNaPraca] = useState(() => !meuLugar().dorme);
  const [rankingAberto, setRankingAberto] = useState(false);
  const [coinsAberto, setCoinsAberto] = useState(false);
  // tela cheia: o HOKI (cartão e praça) ocupa a janela toda; Esc volta
  const [telaCheia, setTelaCheia] = useState(false);
  useEffect(() => {
    if (!telaCheia) return;
    const tecla = (e: KeyboardEvent) => {
      // só fecha se não houver uma janela aberta por cima (ela é quem recebe o Esc)
      if (e.key === "Escape" && !document.querySelector("[role='dialog']")) setTelaCheia(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [telaCheia]);
  const alternarPraca = () => {
    playSfx("click");
    setNaPraca((v) => !v);
  };
  /** Onde a ilha está na tela de entrada, em relação à seção: o círculo abre e fecha a partir dali. */
  const medirIris = () => {
    const sec = secao.current;
    const ilha = sec?.querySelector<HTMLElement>(".hoki-heroi-fundo");
    if (!sec || !ilha) return null;
    const rs = sec.getBoundingClientRect();
    const ri = ilha.getBoundingClientRect();
    const x = ri.left + ri.width / 2 - rs.left;
    const y = ri.top + ri.height * 0.6 - rs.top;
    const max = Math.hypot(Math.max(x, rs.width - x), Math.max(y, rs.height - y)) + 40;
    return { x, y, r: Math.min(ri.width, ri.height) * 0.4, max };
  };
  /** Acorda: a praça abre por cima da tela de entrada. */
  const entrarNaPraca = () => {
    if (naPraca || transicao) return;
    iris.current = medirIris();
    // a praça ocupa a seção inteira: ela encosta no alto da janela (na tela inicial a seção fica no meio da página)
    secao.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    playSfx("click");
    setTransicao("entrando");
    setNaPraca(true);
  };
  /** Volta a dormir: a praça fecha num círculo em cima da ilha e a tela de entrada reaparece. */
  const sairDaPraca = () => {
    if (!naPraca || transicao) return;
    playSfx("click");
    setTelaCheia(false);
    setTransicao("saindo");
  };
  useLayoutEffect(() => {
    const el = quadroDaPraca.current;
    if (!transicao || !el) return;
    const c = transicao === "entrando" ? iris.current : medirIris();
    const fim = () => {
      if (transicao === "saindo") setNaPraca(false);
      setTransicao(null);
    };
    if (!c || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fim();
      return;
    }
    const aberto = `circle(${c.max}px at ${c.x}px ${c.y}px)`;
    const a =
      transicao === "entrando"
        ? el.animate(
            [{ clipPath: `circle(${c.r}px at ${c.x}px ${c.y}px)` }, { clipPath: aberto }],
            {
              duration: 850,
              easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            },
          )
        : el.animate([{ clipPath: aberto }, { clipPath: `circle(0px at ${c.x}px ${c.y}px)` }], {
            duration: 520,
            easing: "cubic-bezier(0.55, 0, 0.8, 0.2)",
            fill: "forwards",
          });
    let vivo = true;
    a.onfinish = () => {
      if (vivo) fim();
    };
    return () => {
      vivo = false;
      a.cancel();
    };
  }, [transicao]);

  // As barras caem com o tempo: recalcula a cada meio minuto.
  useEffect(() => {
    const id = setInterval(() => tique((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // teclas 1 a 5 (acordado na praça): usam o item que estiver nesse atalho da mochila
  const atalho = useRef<((k: number) => void) | null>(null);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!/^Digit[1-5]$/.test(e.code) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const a = document.activeElement;
      if (
        a &&
        (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable)
      )
        return;
      if (document.querySelector('[role="dialog"]')) return;
      atalho.current?.(Number(e.code.slice(5)) - 1);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const salvar = useMutation({
    mutationFn: ({ pet, patch }: { pet: HokiPet; patch: Parameters<typeof salvarPet>[1] }) =>
      salvarPet(pet, patch),
    onSuccess: (novo) => {
      qc.setQueryData(KEY, novo);
      void qc.invalidateQueries({ queryKey: ["hoki-ranking"] });
    },
    onError: () => toast.error("Não foi possível salvar o HOKI. Tente de novo."),
  });

  if (isLoading) {
    return (
      <section className="glass animate-rise mt-4 grid h-[340px] place-items-center rounded-[28px]">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </section>
    );
  }
  if (isError || !salvo) return null;

  const pet = aoVivo(salvo);
  const prog = progressoDoNivel(meuNivel?.xp ?? 0);
  const selo = corDoSelo(meuNivel?.cor, prog.nivel);
  const entregador = pet.username.toLowerCase() === ENTREGADOR_DE_COINS;
  const estado = humor(pet);
  const reagir = (tipo: Reacao) => setReacao((r) => ({ tipo, n: (r?.n ?? 0) + 1 }));
  /** Quem está online agora (eu primeiro), para o painel do cabeçalho. */
  const pessoasOnline: PessoaOnlineAgora[] = cabecalho
    ? [
        {
          id: pet.user_id,
          nome: pet.username || pet.nome,
          tag: souVisita ? "VIS" : cargo ? ROLE_TAG[cargo] : "",
          visual: pet.visual,
          dorme: !naPraca,
          naFazenda: naPraca && meuLugar().naFazenda,
          souEu: true,
        },
        ...Object.values(outros)
          .filter((o) => o.id !== pet.user_id)
          .map((o) => ({
            id: o.id,
            nome: o.nome,
            tag: o.tag,
            visual: o.visual,
            dorme: o.dorme,
            naFazenda: o.naFazenda,
          })),
      ]
    : [];

  /** Tira uma unidade do item da mochila (some da lista quando acaba). */
  const semUm = (it: Item, n = 1) => {
    const resto = (pet.inventario[it.id] ?? 0) - n;
    if (resto < 0) return null;
    const inventario = { ...pet.inventario, [it.id]: resto };
    if (resto === 0) delete inventario[it.id];
    return inventario;
  };
  /** Come ou bebe um item da mochila: gasta `n` unidades e enche as barras. */
  const usarItem = (it: Item, n = 1) => {
    const inventario = semUm(it, n);
    if (salvar.isPending || !inventario) return;
    const barra = it.tipo === "comida" ? pet.fome : it.tipo === "bebida" ? pet.sede : pet.carinho;
    if (barra >= 95) {
      toast.info(
        it.tipo === "comida"
          ? `${pet.nome} está de barriga cheia.`
          : it.tipo === "bebida"
            ? `${pet.nome} está sem sede.`
            : `${pet.nome} já está cheio de carinho.`,
      );
      return;
    }
    playSfx("add");
    reagir(it.tipo === "comida" ? "comer" : it.tipo === "bebida" ? "beber" : "carinho");
    salvar.mutate({
      pet: salvo,
      patch: {
        inventario,
        fome: Math.min(100, pet.fome + (it.fome ?? 0) * n),
        sede: Math.min(100, pet.sede + (it.sede ?? 0) * n),
        energia: Math.min(100, pet.energia + (it.energia ?? 0) * n),
        carinho: Math.min(100, pet.carinho + (it.carinho ?? 0) * n),
      },
    });
  };
  atalho.current = (k) => {
    if (!naPraca) return;
    const it = arrumarMochila(pet.inventario)[k];
    if (!it) {
      toast.info(`O atalho ${k + 1} está vazio. Arraste um item para ele na mochila.`);
      return;
    }
    usarItem(it, 1);
  };
  const jogarFora = (it: Item, n = 1) => {
    const inventario = semUm(it, n);
    if (salvar.isPending || !inventario) return;
    playSfx("remove");
    salvar.mutate({ pet: salvo, patch: { inventario } });
  };

  const cuidar = (c: Cuidado) => {
    // comida e bebida saem da mochila (colhidas na fazenda); carinho e soneca seguem de graça
    if (c.id === "comida" || c.id === "bebida") {
      playSfx("open");
      setMochila(c.id);
      return;
    }
    if (salvar.isPending) return;
    if (pet[c.barra] >= 95) {
      toast.info(
        c.id === "soneca" ? `${pet.nome} está sem sono agora.` : `${pet.nome} já está satisfeito.`,
      );
      return;
    }
    playSfx("add");
    reagir(REACAO[c.id]);
    salvar.mutate({
      pet: salvo,
      patch: { [c.barra]: Math.min(100, pet[c.barra] + c.ganho) },
    });
  };

  const fimDoJogo = (r: Resultado) => {
    setJogando(false);
    const recordes =
      r.jogo === "petiscos"
        ? { recorde_petiscos: Math.max(pet.recorde_petiscos, r.valor) }
        : {
            recorde_reflexo:
              pet.recorde_reflexo === 0 || (r.valor > 0 && r.valor < pet.recorde_reflexo)
                ? r.valor
                : pet.recorde_reflexo,
          };
    reagir("carinho");
    const recorde =
      r.jogo === "petiscos"
        ? r.valor > pet.recorde_petiscos
        : r.valor > 0 && (pet.recorde_reflexo === 0 || r.valor < pet.recorde_reflexo);
    toast.success(recorde ? `Novo recorde de ${pet.nome}!` : `${pet.nome} adorou brincar!`);
    salvar.mutate({
      pet: salvo,
      patch: {
        energia: Math.max(0, pet.energia - ENERGIA_POR_JOGO),
        carinho: Math.min(100, pet.carinho + 10),
        ...recordes,
      },
    });
  };

  const emote = (id: Reacao) => {
    if (estado === "dormindo") {
      toast.info(`${pet.nome} está dormindo.`);
      return;
    }
    playSfx("click");
    reagir(id);
  };

  const salvarNome = () => {
    const n = nome.trim();
    if (!nomeValido(n)) {
      toast.error("Use de 2 a 6 letras ou números, sem espaço.");
      return;
    }
    playSfx("check");
    setEditando(false);
    if (n !== pet.nome) salvar.mutate({ pet: salvo, patch: { nome: n } });
  };

  /** Tela só do HOKI, antes de acordar: a praça é só a ilha flutuando (sem botões por cima). */
  const vitrine = cabecalho && !naPraca;
  /** O quadro da praça (na tela só do HOKI ele fica dentro da tela de entrada). */
  const palco = (
    <div
      ref={quadroDaPraca}
      className={cn(
        "grid gap-3",
        telaCheia
          ? "min-h-full lg:h-full"
          : cabecalho
            ? vitrine
              ? "hoki-palco hoki-palco-vitrine"
              : "hoki-palco hoki-palco-jogo"
            : alto
              ? "lg:h-[max(420px,calc(100svh-32px))]"
              : "lg:h-[420px]",
      )}
    >
      {/* ---------- praça em 3D, com o ranking abrindo por cima ---------- */}
      <div
        className={cn(
          "hoki-quadro relative overflow-hidden",
          cabecalho && !telaCheia
            ? vitrine
              ? "h-full"
              : "h-full rounded-[22px] border border-white/[0.08]"
            : "h-[420px] rounded-[28px] border border-white/[0.08] lg:h-auto",
        )}
        data-vitrine={vitrine ? "" : undefined}
      >
        <Praca
          pet={pet}
          dentro={naPraca}
          vitrine={vitrine}
          truque={reacao}
          aoAlternar={cabecalho ? (naPraca ? sairDaPraca : entrarNaPraca) : alternarPraca}
          emotes={TRUQUES}
          aoEmote={emote}
          aoRanking={() => {
            setCoinsAberto(false);
            setRankingAberto((v) => !v);
          }}
          aoSolo={() =>
            pet.energia < ENERGIA_POR_JOGO
              ? toast.info(`${pet.nome} está cansado. Uma soneca primeiro.`)
              : setJogando(true)
          }
          aoSalvar={(patch) => salvar.mutate({ pet: salvo, patch })}
          salvando={salvar.isPending}
          telaCheia={telaCheia}
          aoTelaCheia={() => {
            playSfx("toggle");
            setTelaCheia((v) => !v);
          }}
          aoCoins={
            entregador
              ? () => {
                  setRankingAberto(false);
                  setCoinsAberto((v) => !v);
                }
              : undefined
          }
        />
        <HudDoJogador
          dentro={naPraca}
          compacto={!telaCheia}
          nome={pet.nome}
          nivel={prog.nivel}
          corNivel={selo}
          coins={pet.coins}
          fome={pet.fome}
          sede={pet.sede}
          energia={pet.energia}
          higiene={pet.higiene}
          onComer={() => cuidar(CUIDADOS.find((c) => c.id === "comida")!)}
          onBeber={() => cuidar(CUIDADOS.find((c) => c.id === "bebida")!)}
          onDescansar={() => cuidar(CUIDADOS.find((c) => c.id === "soneca")!)}
          onMochila={() => setMochila("tudo")}
          onCorpo={() => {
            setCosmeticosAberto(false);
            setCorpoAberto((v) => !v);
          }}
          onCosmeticos={() => {
            setCorpoAberto(false);
            setCosmeticosAberto((v) => !v);
          }}
          onNome={() => {
            setNome(pet.nome.slice(0, NOME_MAX));
            setEditando((v) => !v);
          }}
          onDormir={naPraca ? (cabecalho ? sairDaPraca : alternarPraca) : undefined}
        />
        {editando && (
          <div className="pf-pop absolute left-3 top-14 z-30 flex w-[214px] items-center gap-1.5 rounded-2xl border border-white/15 bg-black/90 p-2 backdrop-blur-xl">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvarNome()}
              maxLength={NOME_MAX}
              autoFocus
              aria-label="Nome do seu HOKI, até 6 letras"
              placeholder="6 letras"
              className="h-9 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-2.5 font-display text-sm font-semibold uppercase text-white outline-none focus:border-white/40"
            />
            <button
              onClick={() => setNome(sugerirNome())}
              aria-label="Sortear um nome"
              title="Sortear um nome"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80 hover:text-white"
            >
              <Dices className="size-4" />
            </button>
            <button
              onClick={salvarNome}
              aria-label="Salvar nome"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white"
            >
              <Check className="size-4" />
            </button>
          </div>
        )}
        {rankingAberto && (
          <aside className="pf-pop absolute bottom-[68px] right-14 top-3 z-20 flex w-[232px] max-w-[calc(100%-4.5rem)] flex-col rounded-2xl border border-white/15 bg-black/55 p-3 text-white backdrop-blur-xl">
            <button
              onClick={() => setRankingAberto(false)}
              aria-label="Fechar o ranking"
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
            <h3 className="flex shrink-0 items-center gap-2 px-1 font-display text-[14px] font-semibold">
              <Trophy className="size-4 text-ink-3" /> Ranking
            </h3>
            <ol className="mt-2 max-h-[300px] min-h-0 flex-1 space-y-0.5 overflow-y-auto lg:max-h-none">
              {ranking.map((r, i) => (
                <li key={r.user_id}>
                  <button
                    onClick={() => setPerfil(r)}
                    title={`Ver o HOKI de ${r.username || r.nome}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-white/[0.07]",
                      r.user_id === pet.user_id && "bg-white/[0.05]",
                    )}
                  >
                    <span className="relative shrink-0">
                      <span className="block size-9 overflow-hidden rounded-full border border-white/15 bg-black/50">
                        <Hoki2D visual={r.visual} busto />
                      </span>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -left-1 grid size-4 place-items-center rounded-full text-[9px] font-bold tabular-nums",
                          i === 0
                            ? "bg-primary text-white"
                            : "bg-[#1c1c1c] text-muted-foreground ring-1 ring-white/15",
                        )}
                      >
                        {i + 1}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{r.nome}</span>
                      <span className="block truncate text-[10.5px] text-ink-3">
                        {r.username || "staff"}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-full px-1.5 text-[10.5px] font-extrabold leading-[17px] tabular-nums"
                      title="Nível do HOST FAZENDAS"
                      style={{
                        background: corDoSelo(r.corLevel, r.nivelFazenda).fundo,
                        color: corDoSelo(r.corLevel, r.nivelFazenda).texto,
                      }}
                    >
                      {r.nivelFazenda}
                    </span>
                  </button>
                </li>
              ))}
              {ranking.length === 0 && (
                <li className="py-6 text-center text-xs text-ink-3">Ninguém no ranking ainda.</li>
              )}
            </ol>
          </aside>
        )}
        {cosmeticosAberto && (
          <Cosmeticos
            pet={pet}
            salvando={salvar.isPending}
            onUsar={(visual) => salvar.mutate({ pet: salvo, patch: { visual } })}
            onComprado={() => void qc.invalidateQueries({ queryKey: KEY })}
            onClose={() => setCosmeticosAberto(false)}
          />
        )}
        {corpoAberto && (
          <div
            role="menu"
            aria-label="Corpo do boneco"
            className="pf-pop absolute left-3 top-14 z-30 w-[200px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/15 bg-black/80 p-2 text-white backdrop-blur-xl"
          >
            <p className="px-1.5 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Corpo
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {CORPOS.map((c) => {
                const ativo = (pet.visual.corpo ?? "padrao") === c.id;
                return (
                  <button
                    key={c.id}
                    role="menuitemradio"
                    aria-checked={ativo}
                    disabled={salvar.isPending}
                    onClick={() => {
                      setCorpoAberto(false);
                      if (ativo) return;
                      playSfx("click");
                      salvar.mutate({
                        pet: salvo,
                        patch: { visual: { ...pet.visual, corpo: c.id } },
                      });
                    }}
                    className={cn(
                      "h-9 rounded-xl border text-[12.5px] font-medium transition-colors",
                      ativo
                        ? "border-[#CE0E0E] bg-[#CE0E0E]/25 text-white"
                        : "border-white/10 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white",
                    )}
                  >
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {coinsAberto && entregador && (
          <div className="pf-pop absolute right-14 top-[100px] z-20 w-[232px] max-w-[calc(100%-4.5rem)] rounded-2xl border border-white/15 bg-black/60 p-3 text-white backdrop-blur-xl">
            <PainelCoins />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section
      ref={secao}
      className={cn(
        telaCheia
          ? "fixed inset-0 z-40 !m-0 overflow-y-auto bg-black p-3 !animate-none"
          : cabecalho
            ? cn("hoki-tela animate-rise", naPraca && "hoki-tela-jogo")
            : "animate-rise mt-4",
      )}
    >
      {/* primeiro acesso depois da atualização: escolher o gênero do personagem */}
      {!salvo.visual.corpo && (
        <EscolhaDeGenero
          salvando={salvar.isPending}
          onEscolher={(corpo) =>
            salvar.mutate({ pet: salvo, patch: { visual: { ...salvo.visual, corpo } } })
          }
        />
      )}
      {cabecalho ? (
        <InicioDoHoki
          mostrar={!telaCheia && (!naPraca || transicao !== null)}
          palcoCheio={naPraca}
          palco={palco}
          nivel={prog.nivel}
          corNivel={selo}
          aoEntrar={entrarNaPraca}
          fome={pet.fome}
          sede={pet.sede}
          energia={pet.energia}
          higiene={pet.higiene}
          onComer={() => cuidar(CUIDADOS.find((c) => c.id === "comida")!)}
          onBeber={() => cuidar(CUIDADOS.find((c) => c.id === "bebida")!)}
          onDescansar={() => cuidar(CUIDADOS.find((c) => c.id === "soneca")!)}
          pessoas={pessoasOnline}
          selos={selos}
          onPessoa={(id) => {
            const p = id === pet.user_id ? salvo : todos.find((x) => x.user_id === id);
            if (p) setPerfil(p);
          }}
        />
      ) : (
        palco
      )}
      {jogando && <HokiJogos onFim={fimDoJogo} onClose={() => setJogando(false)} />}
      {lojaAberta && (
        <Loja
          pet={pet}
          nivel={prog.nivel}
          salvando={salvar.isPending}
          onUsar={(visual) => salvar.mutate({ pet: salvo, patch: { visual } })}
          onClose={() => setLojaAberta(false)}
        />
      )}
      {mochila && (
        <Mochila
          pet={pet}
          filtro={mochila}
          ocupado={salvar.isPending}
          onUsar={usarItem}
          onJogarFora={jogarFora}
          onClose={() => setMochila(null)}
        />
      )}
      {perfil && (
        <PerfilHoki
          pet={perfil}
          posicao={ranking.findIndex((r) => r.user_id === perfil.user_id) + 1}
          onClose={() => setPerfil(null)}
        />
      )}
    </section>
  );
}
