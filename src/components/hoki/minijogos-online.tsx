import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Plus, Timer, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buscarJogo, criarJogo, mutarJogo, type Jogo, type Pessoa } from "@/lib/hoki-jogos";
import {
  damaNova,
  entrarNaFesta,
  fecharRodada,
  festaNova,
  jogarDama,
  jogarLigue4,
  jogarPpt,
  lancesDama,
  ligue4Novo,
  MAOS,
  MAX_FESTA,
  NOME_DO_JOGO,
  participantes,
  PERGUNTAS,
  pptNovo,
  proximaRodada,
  responderFesta,
  RODADAS_FESTA,
  sairDaFesta,
  type Dama,
  type Festa,
  type Ligue4,
  type Mao,
  type ModoFesta,
  type Ppt,
} from "@/lib/hoki-minijogos";
import { playSfx } from "@/lib/sfx";

const CHAVE = ["hoki-jogos"];

/** Estado inicial de cada desafio: quem desafia joga primeiro. */
export function novoDesafio(tipo: "dama" | "ligue4" | "ppt", eu: Pessoa, outro: Pessoa): object {
  return tipo === "dama"
    ? damaNova(eu, outro)
    : tipo === "ligue4"
      ? ligue4Novo(eu, outro)
      : pptNovo(eu, outro);
}

/* ============ desafios de 1 contra 1: dama, ligue 4 e pedra-papel-tesoura ============ */
export function DesafioDialog({
  jogoId,
  eu,
  onClose,
}: {
  jogoId: string;
  eu: Pessoa;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: jogo } = useQuery({
    queryKey: [...CHAVE, jogoId],
    queryFn: () => buscarJogo(jogoId),
  });
  const par = jogo ? participantes(jogo) : null;
  const souJogador = !!par && par.some((p) => p.id === eu.id);
  const atualizar = () => void qc.invalidateQueries({ queryKey: CHAVE });
  const terminou = jogo?.status === "fim" || vencedorDe(jogo) !== null;

  const mudar = async <T extends object>(fn: (e: T) => T | null, fim: (e: T) => boolean) => {
    await mutarJogo<T>(jogoId, (est) => {
      const novo = fn(est);
      return novo && { estado: novo, status: fim(novo) ? "fim" : "jogando" };
    });
    atualizar();
  };
  const revanche = async () => {
    if (!jogo || !par) return;
    const outro = par[0].id === eu.id ? par[1] : par[0];
    await mutarJogo<object>(jogoId, () => ({
      estado: novoDesafio(jogo.tipo as "dama" | "ligue4" | "ppt", eu, outro),
      status: "aberto",
    }));
    atualizar();
  };
  const encerrar = async () => {
    await mutarJogo<object>(jogoId, (est, j) =>
      j.status === "fim" ? null : { estado: est, status: "fim" },
    );
    atualizar();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogTitle className="capitalize">
          {jogo ? NOME_DO_JOGO[jogo.tipo] : "Desafio"}
        </DialogTitle>
        {!jogo ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : jogo.tipo === "dama" ? (
          <TabuleiroDama
            jogo={jogo as Jogo<Dama>}
            eu={eu}
            onJogar={(de, para) => {
              playSfx("check");
              void mudar<Dama>(
                (e) => jogarDama(e, de, para, eu.id),
                (e) => !!e.vencedor,
              );
            }}
          />
        ) : jogo.tipo === "ligue4" ? (
          <TabuleiroLigue4
            jogo={jogo as Jogo<Ligue4>}
            eu={eu}
            onJogar={(col) => {
              playSfx("check");
              void mudar<Ligue4>(
                (e) => jogarLigue4(e, col, eu.id),
                (e) => !!e.vencedor,
              );
            }}
          />
        ) : jogo.tipo === "ppt" ? (
          <MesaPpt
            jogo={jogo as Jogo<Ppt>}
            eu={eu}
            onJogar={(m) => {
              playSfx("tap");
              void mudar<Ppt>(
                (e) => jogarPpt(e, m, eu.id),
                (e) => !!e.vencedor,
              );
            }}
          />
        ) : null}
        {jogo && souJogador && terminou && jogo.status !== "aberto" && (
          <button
            onClick={() => void revanche()}
            className="h-10 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            Pedir revanche
          </button>
        )}
        {jogo && souJogador && jogo.status !== "fim" && !terminou && (
          <button
            onClick={() => void encerrar()}
            className="text-xs text-ink-3 underline-offset-4 hover:text-foreground hover:underline"
          >
            {jogo.status === "aberto" ? "Cancelar convite" : "Desistir da partida"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function vencedorDe(jogo: Jogo | null | undefined): string | null {
  if (!jogo) return null;
  const e = jogo.estado as { vencedor?: string | null };
  return e.vencedor ?? null;
}

/** Linha de cima: os dois jogadores, com destaque para quem joga agora. */
function Jogadores({
  a,
  b,
  vez,
  corA,
  corB,
}: {
  a: Pessoa;
  b: Pessoa;
  vez: "a" | "b" | null;
  corA: string;
  corB: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 truncate",
          vez === "a" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span
          className="size-3 shrink-0 rounded-full border border-white/30"
          style={{ background: corA }}
        />{" "}
        {a.nome}
      </span>
      <span className="text-ink-3">×</span>
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 truncate",
          vez === "b" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {b.nome}{" "}
        <span
          className="size-3 shrink-0 rounded-full border border-white/30"
          style={{ background: corB }}
        />
      </span>
    </div>
  );
}

function TabuleiroDama({
  jogo,
  eu,
  onJogar,
}: {
  jogo: Jogo<Dama>;
  eu: Pessoa;
  onJogar: (de: number, para: number) => void;
}) {
  const e = jogo.estado;
  const minha = e.b.id === eu.id ? "b" : e.p.id === eu.id ? "p" : null;
  const minhaVez = jogo.status === "jogando" && !e.vencedor && minha === e.vez;
  const [sel, setSel] = useState<number | null>(null);
  const lances = useMemo(() => (minhaVez ? lancesDama(e, e.vez) : []), [e, minhaVez]);
  // na captura em sequência, a peça já vem selecionada
  const ativa = e.seguindo ?? sel;
  const destinos = new Set(lances.filter((l) => l.de === ativa).map((l) => l.para));
  const podeMexer = new Set(lances.map((l) => l.de));
  // o tabuleiro aparece do lado de quem joga com as pretas virado ao contrário
  const casas = Array.from({ length: 64 }, (_, i) => (minha === "p" ? 63 - i : i));
  const status =
    jogo.status === "aberto"
      ? `Aguardando ${e.p.nome} aceitar…`
      : e.vencedor
        ? `${e[e.vencedor].nome} venceu!`
        : minhaVez
          ? e.seguindo !== null
            ? "Continue capturando"
            : "Sua vez"
          : `Vez de ${e[e.vez].nome}`;
  return (
    <div className="space-y-3">
      <Jogadores
        a={e.b}
        b={e.p}
        vez={e.vencedor ? null : e.vez === "b" ? "a" : "b"}
        corA="#f4f1ea"
        corB="#1b1b1f"
      />
      <div className="mx-auto grid aspect-square w-full max-w-[340px] grid-cols-8 overflow-hidden rounded-xl border border-white/10">
        {casas.map((i) => {
          const escura = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const peca = e.tab[i] ?? "";
          const destino = destinos.has(i);
          const ultima = e.ultima?.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={!minhaVez || (!destino && !podeMexer.has(i))}
              onClick={() =>
                destino && ativa !== null ? (onJogar(ativa, i), setSel(null)) : setSel(i)
              }
              aria-label={`Casa ${i + 1}${peca ? (peca.toLowerCase() === "b" ? ", peça branca" : ", peça preta") : ""}`}
              className={cn(
                "relative grid place-items-center",
                escura ? "bg-[#6b4526]" : "bg-[#e9d9b8]",
                ultima && escura && "bg-[#8a5a34]",
                ativa === i && "ring-2 ring-inset ring-white",
              )}
            >
              {peca && (
                <span
                  className={cn(
                    "grid size-[78%] place-items-center rounded-full border-2 shadow-[0_3px_6px_rgba(0,0,0,0.5)]",
                    peca.toLowerCase() === "b"
                      ? "border-[#cfc7b8] bg-[#f4f1ea] text-[#b8221a]"
                      : "border-[#3a3a3e] bg-[#1b1b1f] text-[#ffd84a]",
                  )}
                >
                  {(peca === "B" || peca === "P") && (
                    <Crown className="size-[55%]" strokeWidth={2.2} />
                  )}
                </span>
              )}
              {destino && (
                <span className="absolute size-[30%] rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm" aria-live="polite">
        {status}
      </p>
      <p className="text-center text-[11px] text-ink-3">
        Pedra anda 1 casa para a frente e captura para os dois lados. Capturar é obrigatório. Chegou
        do outro lado, vira dama.
      </p>
    </div>
  );
}

function TabuleiroLigue4({
  jogo,
  eu,
  onJogar,
}: {
  jogo: Jogo<Ligue4>;
  eu: Pessoa;
  onJogar: (coluna: number) => void;
}) {
  const e = jogo.estado;
  const minha = e.v.id === eu.id ? "v" : e.a.id === eu.id ? "a" : null;
  const minhaVez = jogo.status === "jogando" && !e.vencedor && minha === e.vez;
  const status =
    jogo.status === "aberto"
      ? `Aguardando ${e.a.nome} aceitar…`
      : e.vencedor === "empate"
        ? "Empate!"
        : e.vencedor
          ? `${e[e.vencedor].nome} venceu!`
          : minhaVez
            ? "Sua vez: escolha uma coluna"
            : `Vez de ${e[e.vez].nome}`;
  return (
    <div className="space-y-3">
      <Jogadores
        a={e.v}
        b={e.a}
        vez={e.vencedor ? null : e.vez === "v" ? "a" : "b"}
        corA="#e5231b"
        corB="#ffd84a"
      />
      <div className="mx-auto grid w-full max-w-[340px] grid-cols-7 gap-1 rounded-2xl bg-[#1a1a1e] p-2">
        {Array.from({ length: 7 }, (_, c) => (
          <button
            key={c}
            type="button"
            disabled={!minhaVez || !!e.tab[c]}
            onClick={() => onJogar(c)}
            aria-label={`Coluna ${c + 1}`}
            className="flex flex-col gap-1 rounded-xl p-0.5 enabled:hover:bg-white/[0.06]"
          >
            {Array.from({ length: 6 }, (_, l) => {
              const v = e.tab[l * 7 + c];
              return (
                <span
                  key={l}
                  className={cn(
                    "aspect-square w-full rounded-full border border-black/40",
                    v === "v" ? "bg-[#e5231b]" : v === "a" ? "bg-[#ffd84a]" : "bg-black/60",
                    e.linha?.includes(l * 7 + c) && "ring-2 ring-white",
                  )}
                />
              );
            })}
          </button>
        ))}
      </div>
      <p className="text-center text-sm" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

function MesaPpt({
  jogo,
  eu,
  onJogar,
}: {
  jogo: Jogo<Ppt>;
  eu: Pessoa;
  onJogar: (m: Mao) => void;
}) {
  const e = jogo.estado;
  const lado = e.a.id === eu.id ? "a" : e.b.id === eu.id ? "b" : null;
  const escolhi = lado ? e.escolhas[lado] : undefined;
  const ultima = e.historico[e.historico.length - 1];
  const emoji = (m: Mao) => MAOS.find((x) => x.id === m)?.emoji ?? "";
  const status =
    jogo.status === "aberto"
      ? `Aguardando ${e.b.nome} aceitar…`
      : e.vencedor
        ? `${e[e.vencedor].nome} venceu!`
        : escolhi
          ? "Esperando a outra pessoa escolher…"
          : `Rodada ${e.rodada}: escolha a sua mão`;
  return (
    <div className="space-y-3">
      <Jogadores a={e.a} b={e.b} vez={null} corA="#e5231b" corB="#f4f1ea" />
      <p className="text-center font-display text-3xl font-semibold tabular-nums">
        {e.placar.a} <span className="text-ink-3">×</span> {e.placar.b}
      </p>
      {ultima && (
        <p className="text-center text-[13px] text-muted-foreground">
          Última: {emoji(ultima.a)} contra {emoji(ultima.b)} ·{" "}
          {ultima.vencedor === "empate" ? "empate" : `ponto para ${e[ultima.vencedor].nome}`}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {MAOS.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!lado || !!escolhi || !!e.vencedor || jogo.status !== "jogando"}
            onClick={() => onJogar(m.id)}
            className={cn(
              "glass-inset flex flex-col items-center gap-1 rounded-2xl border py-3 text-[12px] enabled:hover:border-white/30",
              escolhi === m.id && "!border-white/60",
            )}
          >
            <span className="text-[30px] leading-none">{m.emoji}</span>
            {m.nome}
          </button>
        ))}
      </div>
      <p className="text-center text-sm" aria-live="polite">
        {status}
      </p>
      <p className="text-center text-[11px] text-ink-3">
        Melhor de 3: quem fizer 2 pontos primeiro vence.
      </p>
    </div>
  );
}

/* ============ salas de festa (2 a 20 pessoas): reflexo e quiz ============ */
const NOME_DO_MODO: Record<ModoFesta, string> = { reflexo: "Reflexo", quiz: "Quiz relâmpago" };
const TEMPO_QUIZ = 12_000;
const TEMPO_REFLEXO = 6_000;

export function FestaDialog({
  salas,
  eu,
  onClose,
}: {
  salas: Jogo<Festa>[];
  eu: Pessoa;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const minha = salas.find(
    (s) => s.status !== "fim" && s.estado.jogadores.some((j) => j.id === eu.id),
  );
  const [salaId, setSalaId] = useState<string | null>(minha?.id ?? null);
  const [criando, setCriando] = useState(false);
  const abertas = salas.filter((s) => s.status === "aberto");
  const criar = async (modo: ModoFesta) => {
    setCriando(true);
    try {
      const j = await criarJogo("festa", festaNova(eu, modo));
      setSalaId(j.id);
      void qc.invalidateQueries({ queryKey: CHAVE });
    } catch {
      toast.error("Não foi possível criar a sala.");
    } finally {
      setCriando(false);
    }
  };
  const entrar = async (s: Jogo<Festa>) => {
    const ok = await mutarJogo<Festa>(s.id, (e) => {
      const novo = entrarNaFesta(e, eu);
      return novo && { estado: novo, status: "aberto" };
    });
    if (!ok && !s.estado.jogadores.some((j) => j.id === eu.id))
      toast.info("Essa sala já começou ou está cheia.");
    setSalaId(s.id);
    void qc.invalidateQueries({ queryKey: CHAVE });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          <Users className="size-4" /> Festa da praça
        </DialogTitle>
        {salaId ? (
          <SalaFesta id={salaId} eu={eu} onSair={() => setSalaId(null)} />
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              De 2 a {MAX_FESTA} pessoas, {RODADAS_FESTA} rodadas. Crie uma sala ou entre numa
              aberta.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["reflexo", "quiz"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={criando}
                  onClick={() => void criar(m)}
                  className="glass-inset flex items-center gap-2.5 rounded-2xl border p-3 text-left enabled:hover:border-white/30"
                >
                  <span className="icone-quadro size-9">
                    {m === "reflexo" ? <Zap className="size-4" /> : <Timer className="size-4" />}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[13px] font-medium">{NOME_DO_MODO[m]}</span>
                    <span className="block text-[10.5px] text-muted-foreground">
                      {m === "reflexo"
                        ? "Quem clica primeiro no AGORA!"
                        : "Perguntas rápidas, 12 s cada"}
                    </span>
                  </span>
                  <Plus className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              Salas abertas
            </p>
            {abertas.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">Nenhuma sala aberta agora.</p>
            ) : (
              <ul className="space-y-1.5">
                {abertas.map((s) => (
                  <li
                    key={s.id}
                    className="glass-inset flex items-center gap-3 rounded-2xl border px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[13px] font-medium">
                        {NOME_DO_MODO[s.estado.modo]}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {s.estado.jogadores.length}/{MAX_FESTA} ·{" "}
                        {s.estado.jogadores.map((j) => j.nome).join(", ")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void entrar(s)}
                      className="h-8 rounded-full bg-white px-3.5 text-xs font-semibold text-black"
                    >
                      Entrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SalaFesta({ id, eu, onSair }: { id: string; eu: Pessoa; onSair: () => void }) {
  const qc = useQueryClient();
  const { data: jogo } = useQuery({
    queryKey: [...CHAVE, id],
    queryFn: () => buscarJogo(id) as Promise<Jogo<Festa> | null>,
    refetchInterval: 4000,
  });
  const e = jogo?.estado;
  const souDono = e?.dono === eu.id;
  const atualizar = () => void qc.invalidateQueries({ queryKey: CHAVE });
  const mudar = async (fn: (e: Festa) => Festa | null, status?: Jogo["status"]) => {
    await mutarJogo<Festa>(id, (est, j) => {
      const novo = fn(est);
      return (
        novo && {
          estado: novo,
          status:
            status ??
            (novo.fase === "fim"
              ? "fim"
              : novo.fase === "lobby"
                ? "aberto"
                : j.status === "aberto"
                  ? "jogando"
                  : j.status),
        }
      );
    });
    atualizar();
  };

  // reflexo: espera o atraso, mostra "AGORA!" e mede o tempo até o clique
  const [agoraEm, setAgoraEm] = useState<number | null>(null);
  const rodadaVista = useRef(-1);
  const inicioRodada = useRef(0);
  useEffect(() => {
    if (!e || e.fase !== "rodada" || rodadaVista.current === e.id) return;
    rodadaVista.current = e.id;
    inicioRodada.current = performance.now();
    setAgoraEm(null);
    if (e.modo !== "reflexo") return;
    const t = setTimeout(() => {
      setAgoraEm(performance.now());
      playSfx("pop");
    }, e.atraso);
    return () => clearTimeout(t);
  }, [e]);
  const respondi = !!e?.respostas[eu.id];
  const responder = (op: number) => {
    if (!e || respondi || e.fase !== "rodada") return;
    const t =
      e.modo === "reflexo"
        ? agoraEm === null
          ? -1
          : Math.round(performance.now() - agoraEm)
        : Math.round(performance.now() - inicioRodada.current);
    playSfx(e.modo === "reflexo" && t < 0 ? "error" : "tap");
    const rodada = e.id;
    void mudar((est) => (est.id === rodada ? responderFesta(est, eu.id, { t, op }) : null));
  };

  // fecha a rodada quando todo mundo respondeu ou o tempo acabou (qualquer um pode fechar; vale o primeiro)
  const todosResponderam =
    !!e && e.fase === "rodada" && e.jogadores.every((j) => e.respostas[j.id]);
  useEffect(() => {
    if (!e || e.fase !== "rodada") return;
    const rodada = e.id;
    const limite = todosResponderam
      ? 300
      : e.modo === "reflexo"
        ? e.atraso + TEMPO_REFLEXO
        : TEMPO_QUIZ + 400;
    const t = setTimeout(
      () =>
        void mudar((est) =>
          est.fase === "rodada" && est.id === rodada ? fecharRodada(est) : null,
        ),
      limite,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id, e?.fase, todosResponderam]);
  // o dono passa para a próxima rodada sozinho, depois de mostrar o resultado
  useEffect(() => {
    if (!e || !souDono || e.fase !== "resultado") return;
    const t = setTimeout(
      () => void mudar((est) => (est.fase === "resultado" ? proximaRodada(est) : null)),
      3500,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id, e?.fase, souDono]);

  if (!e || !jogo) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const nome = (pid: string) => e.jogadores.find((j) => j.id === pid)?.nome ?? "alguém";
  const ranking = [...e.jogadores].sort((a, b) => (e.pontos[b.id] ?? 0) - (e.pontos[a.id] ?? 0));
  const pergunta = PERGUNTAS[e.pergunta];
  const sair = () => {
    void mudar((est) => sairDaFesta(est, eu.id), e.jogadores.length <= 1 ? "fim" : undefined);
    onSair();
  };
  const minha = e.respostas[eu.id];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>
          {NOME_DO_MODO[e.modo]} ·{" "}
          {e.fase === "lobby"
            ? `${e.jogadores.length}/${MAX_FESTA} na sala`
            : e.fase === "fim"
              ? "Fim de jogo"
              : `Rodada ${e.rodada} de ${RODADAS_FESTA}`}
        </span>
        <button
          type="button"
          onClick={sair}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Sair da sala
        </button>
      </div>

      {e.fase === "lobby" && (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {e.jogadores.map((j) => (
              <li
                key={j.id}
                className="glass-inset flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]"
              >
                {j.id === e.dono && <Crown className="size-3 text-[#ffd84a]" />} {j.nome}
              </li>
            ))}
          </ul>
          {souDono ? (
            <button
              type="button"
              disabled={e.jogadores.length < 2}
              onClick={() =>
                void mudar(
                  (est) => proximaRodada({ ...est, pontos: {}, rodada: 0, ordem: [] }),
                  "jogando",
                )
              }
              className="h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {e.jogadores.length < 2 ? "Esperando mais alguém entrar…" : "Começar"}
            </button>
          ) : (
            <p className="text-center text-[12.5px] text-muted-foreground">
              Esperando {nome(e.dono)} começar…
            </p>
          )}
        </>
      )}

      {e.fase === "rodada" && e.modo === "reflexo" && (
        <button
          type="button"
          onClick={() => responder(0)}
          disabled={respondi}
          className={cn(
            "grid h-44 w-full place-items-center rounded-2xl border text-center transition-colors",
            agoraEm !== null && !respondi
              ? "border-transparent bg-[#7ee787] text-black"
              : "border-white/10 bg-white/[0.04]",
          )}
        >
          <span className="font-display text-3xl font-semibold">
            {minha
              ? minha.t < 0
                ? "Cedo demais!"
                : `${minha.t} ms`
              : agoraEm !== null
                ? "AGORA!"
                : "Espere…"}
          </span>
        </button>
      )}

      {e.fase === "rodada" && e.modo === "quiz" && pergunta && (
        <div className="space-y-2">
          <p className="text-center font-display text-[17px] font-semibold leading-snug">
            {pergunta.q}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {pergunta.ops.map((op, k) => (
              <button
                key={op}
                type="button"
                disabled={respondi}
                onClick={() => responder(k)}
                className={cn(
                  "glass-inset rounded-2xl border px-3 py-3 text-[13px] enabled:hover:border-white/30",
                  minha?.op === k && "!border-white/60 bg-white/10",
                )}
              >
                {op}
              </button>
            ))}
          </div>
          {respondi && (
            <p className="text-center text-[12px] text-muted-foreground">
              Resposta enviada. Esperando os outros…
            </p>
          )}
        </div>
      )}

      {(e.fase === "resultado" || e.fase === "fim") && e.ultimo && (
        <p className="text-center text-[13px]">
          {e.modo === "quiz" && e.ultimo.certa !== null && pergunta
            ? `Resposta certa: ${pergunta.ops[e.ultimo.certa]}. `
            : ""}
          {e.ultimo.vencedores.length
            ? `${e.modo === "reflexo" ? "Mais rápido" : "Acertaram"}: ${e.ultimo.vencedores.map(nome).join(", ")}`
            : "Ninguém pontuou nesta rodada."}
        </p>
      )}

      {e.fase !== "lobby" && (
        <ol className="space-y-1">
          {ranking.map((j, k) => (
            <li
              key={j.id}
              className={cn(
                "glass-inset flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-[12.5px]",
                j.id === eu.id && "!border-white/30",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                  k === 0 ? "bg-white text-black" : "bg-white/[0.08]",
                )}
              >
                {k + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{j.nome}</span>
              {e.fase === "rodada" && e.respostas[j.id] && (
                <span className="text-[10.5px] text-emerald-300">respondeu</span>
              )}
              <span className="font-display font-semibold tabular-nums">{e.pontos[j.id] ?? 0}</span>
            </li>
          ))}
        </ol>
      )}

      {e.fase === "fim" && souDono && (
        <button
          type="button"
          onClick={() =>
            void mudar(
              (est) => ({
                ...est,
                fase: "lobby",
                rodada: 0,
                pontos: {},
                ordem: [],
                respostas: {},
                ultimo: null,
              }),
              "aberto",
            )
          }
          className="h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          Jogar de novo
        </button>
      )}
    </div>
  );
}
