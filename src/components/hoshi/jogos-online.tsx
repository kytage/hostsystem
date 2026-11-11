import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  buscarJogo,
  comecarCartas,
  comprarCarta,
  criarJogo,
  jogarCarta,
  jogarVelha,
  linhaVencedora,
  MAX_JOGADORES,
  mutarJogo,
  NAIPES,
  podeJogar,
  sairDasCartas,
  salaNova,
  type Carta,
  type Cartas,
  type Jogo,
  type Naipe,
  type Pessoa,
  type Velha,
} from "@/lib/hoshi-jogos";
import { playSfx } from "@/lib/sfx";

const CHAVE = ["hoshi-jogos"];

/* ====================== Jogo da velha ====================== */

export function VelhaDialog({ jogoId, eu, onClose }: { jogoId: string; eu: Pessoa; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: jogo } = useQuery({ queryKey: [...CHAVE, jogoId], queryFn: () => buscarJogo(jogoId) });
  const e = jogo?.estado as Velha | undefined;
  const minha = e ? (e.x.id === eu.id ? "x" : e.o.id === eu.id ? "o" : null) : null;
  const linha = e ? linhaVencedora(e.tab) : null;
  const atualizar = () => void qc.invalidateQueries({ queryKey: CHAVE });

  const jogar = async (casa: number) => {
    if (!e || e.vencedor || e[e.vez].id !== eu.id || e.tab[casa]) return;
    playSfx("check");
    await mutarJogo<Velha>(jogoId, (est) => {
      const novo = jogarVelha(est, casa, eu.id);
      return novo && { estado: novo, status: novo.vencedor ? "fim" : "jogando" };
    });
    atualizar();
  };
  const revanche = async () => {
    await mutarJogo<Velha>(jogoId, (est) => ({ estado: { ...est, tab: Array<null>(9).fill(null), vez: est.vencedor === "x" ? "o" : "x", vencedor: null }, status: "jogando" }));
    atualizar();
  };

  const status = !e
    ? "Carregando…"
    : jogo?.status === "aberto"
      ? `Aguardando ${e.o.nome} aceitar…`
      : e.vencedor === "empate"
        ? "Deu velha! Empate."
        : e.vencedor
          ? `${e[e.vencedor].nome} venceu!`
          : e[e.vez].id === eu.id
            ? "Sua vez"
            : `Vez de ${e[e.vez].nome}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-sm">
        <DialogTitle>Jogo da velha</DialogTitle>
        {e && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className={cn("truncate", e.vez === "x" && !e.vencedor && "text-foreground")}>✕ {e.x.nome}</span>
            <span className={cn("truncate", e.vez === "o" && !e.vencedor && "text-foreground")}>{e.o.nome} ○</span>
          </div>
        )}
        <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2">
          {(e?.tab ?? Array<null>(9).fill(null)).map((m, i) => (
            <button
              key={i}
              onClick={() => void jogar(i)}
              disabled={!e || jogo?.status !== "jogando" || !!m || !minha || e.vez !== minha}
              aria-label={`Casa ${i + 1}${m ? `, ${m === "x" ? "xis" : "círculo"}` : ", vazia"}`}
              className={cn(
                "glass-inset grid aspect-square place-items-center rounded-2xl font-display text-4xl font-semibold transition-all duration-200 enabled:hover:bg-white/[0.08] enabled:active:scale-95",
                linha?.includes(i) && "border-primary/60 bg-primary/15",
                m === "x" ? "text-primary" : "text-foreground",
              )}
            >
              {m === "x" ? "✕" : m === "o" ? "○" : ""}
            </button>
          ))}
        </div>
        <p className="text-center text-sm" aria-live="polite">
          {status}
        </p>
        {e?.vencedor && minha && (
          <button onClick={() => void revanche()} className="h-10 rounded-full bg-primary text-sm font-semibold text-white">
            Revanche
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ====================== Mau-Mau (cartas) ====================== */

function CartaView({ c, onClick, ativa, pequena }: { c: Carta; onClick?: () => void; ativa?: boolean; pequena?: boolean }) {
  const naipe = NAIPES.find((n) => n.id === c.n);
  const rotulo = c.v === "pula" ? "⊘" : c.v === "volta" ? "⇄" : c.v === "curinga" ? "★" : c.v;
  const nome = `${c.v === "pula" ? "Pula a vez" : c.v === "volta" ? "Inverte o sentido" : c.v === "curinga" ? "Curinga" : c.v === "+4" ? "Curinga mais quatro" : c.v}${naipe ? ` ${naipe.nome}` : ""}`;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      aria-label={nome}
      title={nome}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl border font-display font-semibold shadow-[0_8px_18px_rgba(0,0,0,0.5)] transition-all duration-200",
        pequena ? "h-[76px] w-[52px] text-xl" : "h-[112px] w-[78px] text-3xl",
        onClick && (ativa ? "cursor-pointer border-white/60 hover:-translate-y-2" : "cursor-not-allowed border-white/10 opacity-45"),
        !onClick && "border-white/20",
      )}
      style={naipe ? { background: naipe.cor, color: naipe.texto } : { background: "conic-gradient(#ce0e0e 0 25%, #e0ad3a 0 50%, #e8e8e8 0 75%, #3d3d3d 0)", color: "#fff" }}
    >
      <span className={cn(!naipe && "rounded-full bg-black/75 px-2 py-0.5")}>{rotulo}</span>
    </Tag>
  );
}

export function CartasDialog({ eu, salas, onClose }: { eu: Pessoa; salas: Jogo<Cartas>[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [salaId, setSalaId] = useState<string | null>(() => salas.find((s) => s.estado.jogadores.some((j) => j.id === eu.id))?.id ?? null);
  const [ocupado, setOcupado] = useState(false);
  const [curinga, setCuringa] = useState<Carta | null>(null);
  const { data: sala } = useQuery({ queryKey: [...CHAVE, salaId], queryFn: () => buscarJogo(salaId!), enabled: !!salaId });
  const e = sala?.estado as Cartas | undefined;
  const atualizar = () => void qc.invalidateQueries({ queryKey: CHAVE });

  /** Roda uma ação na sala, com trava para não disparar duas vezes. */
  const agir = async (id: string, fn: Parameters<typeof mutarJogo<Cartas>>[1]) => {
    if (ocupado) return false;
    setOcupado(true);
    try {
      return await mutarJogo<Cartas>(id, fn);
    } catch {
      toast.error("Não foi possível fazer a jogada. Tente de novo.");
      return false;
    } finally {
      setOcupado(false);
      atualizar();
    }
  };

  const criar = async () => {
    setOcupado(true);
    try {
      const nova = await criarJogo("cartas", salaNova(eu));
      setSalaId(nova.id);
    } catch {
      toast.error("Não foi possível criar a sala.");
    } finally {
      setOcupado(false);
      atualizar();
    }
  };
  const entrar = async (id: string) => {
    const ok = await agir(id, (est, j) => {
      if (est.jogadores.some((p) => p.id === eu.id)) return { estado: est, status: j.status };
      if (j.status !== "aberto" || est.jogadores.length >= MAX_JOGADORES) return null;
      return { estado: { ...est, jogadores: [...est.jogadores, eu] }, status: "aberto" };
    });
    if (ok) setSalaId(id);
    else toast.info("Essa sala já começou ou está cheia.");
  };
  const sair = async () => {
    if (!salaId) return;
    await agir(salaId, (est, j) => {
      const novo = sairDasCartas(est, eu.id);
      return { estado: novo, status: novo.jogadores.length === 0 || novo.vencedor ? "fim" : j.status };
    });
    setSalaId(null);
  };
  const comecar = () => salaId && void agir(salaId, (est) => (est.dono === eu.id && est.jogadores.length >= 2 ? { estado: comecarCartas(est), status: "jogando" } : null));
  const jogar = (c: Carta, naipe?: Naipe) => {
    if (!salaId) return;
    playSfx("check");
    setCuringa(null);
    void agir(salaId, (est) => {
      const novo = jogarCarta(est, eu.id, c.id, naipe);
      return novo && { estado: novo, status: novo.vencedor ? "fim" : "jogando" };
    });
  };
  const comprar = () =>
    salaId &&
    void agir(salaId, (est) => {
      const novo = comprarCarta(est, eu.id);
      return novo && { estado: novo, status: "jogando" };
    });

  const naSala = !!e && e.jogadores.some((j) => j.id === eu.id);
  const minhaVez = !!e && sala?.status === "jogando" && e.jogadores[e.vez]?.id === eu.id;
  const mao = e?.maos[eu.id] ?? [];
  const naipeAtual = NAIPES.find((n) => n.id === e?.naipe);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-4 overflow-y-auto">
        <DialogTitle>Mau-Mau · lobby de cartas</DialogTitle>

        {/* ---------- lista de salas ---------- */}
        {(!salaId || !e || !naSala) && (
          <>
            <p className="text-sm text-muted-foreground">Jogo de descarte: jogue uma carta do mesmo naipe ou valor da mesa. Quem ficar sem cartas primeiro vence. De 2 a {MAX_JOGADORES} pessoas por sala.</p>
            <div className="space-y-2">
              {salas.map((s) => (
                <div key={s.id} className="glass-inset flex items-center gap-3 rounded-2xl p-3">
                  <Users className="size-4 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Sala de {s.estado.jogadores[0]?.nome ?? "alguém"}</p>
                    <p className="truncate text-[11px] text-ink-3">
                      {s.estado.jogadores.length}/{MAX_JOGADORES} · {s.status === "aberto" ? "aguardando jogadores" : "em andamento"} · {s.estado.jogadores.map((j) => j.nome).join(", ")}
                    </p>
                  </div>
                  <button disabled={ocupado || s.status !== "aberto"} onClick={() => void entrar(s.id)} className="h-9 shrink-0 rounded-full bg-primary px-4 text-xs font-semibold text-white disabled:opacity-40">
                    {s.status === "aberto" ? "Entrar" : "Em jogo"}
                  </button>
                </div>
              ))}
              {salas.length === 0 && <p className="glass-inset rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma sala aberta. Crie a primeira.</p>}
            </div>
            <button disabled={ocupado} onClick={() => void criar()} className="flex h-10 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-white">
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Criar sala
            </button>
          </>
        )}

        {/* ---------- dentro da sala ---------- */}
        {salaId && e && naSala && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {e.jogadores.map((j, i) => (
                <span key={j.id} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", sala?.status === "jogando" && i === e.vez ? "border-primary/60 bg-primary/15 text-foreground" : "border-white/[0.08] text-muted-foreground")}>
                  {j.id === e.dono && <Crown className="size-3 text-amber-300" />}
                  {j.nome}
                  {sala?.status !== "aberto" && <span className="tabular-nums text-ink-3">· {e.maos[j.id]?.length ?? 0}</span>}
                </span>
              ))}
            </div>

            {sala?.status === "aberto" && (
              <div className="glass-inset rounded-2xl p-5 text-center">
                <p className="text-sm text-muted-foreground">{e.jogadores.length < 2 ? "Aguardando mais alguém entrar na sala…" : e.dono === eu.id ? "Tudo pronto. Comece quando quiser." : "Aguardando o dono da sala começar…"}</p>
                {e.dono === eu.id && (
                  <button disabled={ocupado || e.jogadores.length < 2} onClick={comecar} className="mt-4 h-10 rounded-full bg-primary px-6 text-sm font-semibold text-white disabled:opacity-40">
                    Começar partida
                  </button>
                )}
              </div>
            )}

            {sala?.status !== "aberto" && (
              <>
                <div className="glass-inset flex flex-wrap items-center justify-center gap-5 rounded-2xl p-5">
                  {e.mesa && <CartaView c={e.mesa} />}
                  <div className="text-center">
                    <p className="eyebrow">Naipe da vez</p>
                    <p className="mt-1.5 flex items-center justify-center gap-2 text-sm font-medium">
                      <span className="size-4 rounded-full border border-white/20" style={{ background: naipeAtual?.cor }} /> {naipeAtual?.nome}
                    </p>
                    <p className="mt-3 max-w-[220px] text-xs text-muted-foreground" aria-live="polite">
                      {e.aviso}
                    </p>
                    {e.vencedor ? (
                      e.dono === eu.id && (
                        <button disabled={ocupado} onClick={comecar} className="mt-3 h-9 rounded-full bg-primary px-4 text-xs font-semibold text-white">
                          Nova partida
                        </button>
                      )
                    ) : (
                      <button disabled={!minhaVez || ocupado} onClick={comprar} className="mt-3 h-9 rounded-full border border-white/15 px-4 text-xs font-medium transition-colors enabled:hover:bg-white/[0.07] disabled:opacity-40">
                        Comprar carta
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-center text-sm font-medium" aria-live="polite">
                  {e.vencedor ? (e.vencedor === eu.id ? "Você venceu!" : "Fim de jogo.") : minhaVez ? "Sua vez: escolha uma carta." : `Vez de ${e.jogadores[e.vez]?.nome ?? "…"}`}
                </p>

                {curinga && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-xs text-muted-foreground">Escolha o naipe:</span>
                    {NAIPES.map((n) => (
                      <button key={n.id} onClick={() => jogar(curinga, n.id)} className="h-9 rounded-full border border-white/20 px-4 text-xs font-semibold" style={{ background: n.cor, color: n.texto }}>
                        {n.nome}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-1.5">
                  {mao.map((c) => {
                    const pode = minhaVez && !ocupado && podeJogar(e, c);
                    return <CartaView key={c.id} c={c} pequena ativa={pode} onClick={() => pode && (c.n === "x" ? setCuringa(c) : jogar(c))} />;
                  })}
                </div>
              </>
            )}

            <button onClick={() => void sair()} className="self-center text-xs text-ink-3 underline-offset-4 hover:text-foreground hover:underline">
              Sair da sala
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
