import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Building2,
  Check,
  Copy,
  Crown,
  Dices,
  Eye,
  Focus,
  History,
  Loader2,
  LogOut,
  Smile,
  Timer,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { copiarTexto } from "@/lib/copiar";
import { playSfx } from "@/lib/sfx";
import type { Visual } from "@/lib/hoki";
import {
  ALUGUEL_DAS_CIAS,
  aluguelDe,
  CASAS,
  CORES,
  daVez,
  dinheiro,
  FIANCA,
  GRUPOS,
  hipotecaDe,
  MAX_JOGADORES,
  MIN_JOGADORES,
  NOTICIAS,
  obraDe,
  patrimonio,
  podeConstruir,
  podeHipotecar,
  podeVender,
  resgateDe,
  SALARIO,
  tabelaDeAluguel,
  trocavel,
  type Acao,
  type Estado,
  type Jogador,
  type Troca,
} from "@/lib/hoki-magnata";
import { guardarSala, useSalaMagnata, type Eu } from "@/lib/hoki-magnata-sala";
import { Hoki2D } from "./hoki-2d";
import { criarCenaMagnata, type CenaMagnata } from "./magnata-cena";

export interface AmigoOnline {
  id: string;
  nome: string;
  visual: Visual;
}
interface Props {
  codigo: string;
  /** Abre uma sala nova (sou o anfitrião) em vez de procurar uma que já existe. */
  criar: boolean;
  eu: Eu;
  /** Quem está online na praça agora, para convidar. */
  amigos: AmigoOnline[];
  onConvidar: (id: string, codigo: string) => void;
  onClose: () => void;
}

const EMOTES: [string, string][] = [
  ["acenar", "👋"],
  ["dancar", "💃"],
  ["festa", "🎉"],
  ["pulinhos", "🦘"],
  ["rebolar", "🕺"],
  ["mortal", "🤸"],
];
const vidro =
  "rounded-2xl border border-white/10 bg-black/75 text-white shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl";
const corDe = (j: Jogador | undefined) => CORES[j?.cor ?? 0]?.hex ?? "#fff";

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(id);
  }, [ativo]);
  return agora;
}

function Avatar({ j, tamanho = 34 }: { j: Jogador; tamanho?: number }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-full bg-black/60"
      style={{ width: tamanho, height: tamanho, boxShadow: `0 0 0 2px ${corDe(j)}` }}
    >
      <Hoki2D visual={j.visual} busto />
    </span>
  );
}
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
  tipo?: "forte" | "normal" | "perigo";
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
        "flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[12.5px] font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        tipo === "forte" && "bg-white text-black hover:bg-white/90",
        tipo === "normal" &&
          "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]",
        tipo === "perigo" &&
          "border border-primary/40 bg-primary/15 text-red-200 hover:bg-primary/25",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Nomes dos imóveis de uma lista de casas, para mostrar numa proposta. */
const nomes = (lista: number[]) => lista.map((c) => CASAS[c]?.nome ?? "?").join(", ");

export function Magnata({ codigo, criar, eu, amigos, onConvidar, onClose }: Props) {
  const sala = useSalaMagnata(codigo, eu, criar);
  const e = sala.estado;
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaMagnata | null>(null);
  const [pronta, setPronta] = useState(false);
  const [casa, setCasa] = useState<number | null>(null);
  const [aba, setAba] = useState<null | "imoveis" | "trocas">(null);
  const [verHistorico, setVerHistorico] = useState(true);
  const [menu, setMenu] = useState<null | "sair" | "emotes">(null);

  useEffect(() => {
    let morto = false;
    let c: CenaMagnata | null = null;
    void import("three").then((THREE) => {
      if (morto || !palco.current) return;
      c = criarCenaMagnata(THREE, palco.current, { onCasa: setCasa });
      cena.current = c;
      setPronta(true);
    });
    return () => {
      morto = true;
      c?.descartar();
      cena.current = null;
    };
  }, []);
  useEffect(() => {
    if (e && pronta) cena.current?.sincronizar(e);
  }, [e, pronta]);
  useEffect(() => {
    if (sala.emote) cena.current?.reagir(sala.emote.id, sala.emote.reacao);
  }, [sala.emote]);
  useEffect(() => {
    cena.current?.selecionar(casa);
  }, [casa, pronta]);

  const eu_ = e?.jogadores.find((j) => j.id === eu.id);
  const vez = e ? daVez(e) : undefined;
  const minhaVez = e?.fase === "jogo" && vez?.id === eu.id;
  const jogando = !!eu_ && !eu_.falido;

  // lembra a sala enquanto eu tiver lugar nela (para voltar pelo portal se cair)
  useEffect(() => {
    if (!e) return;
    guardarSala(e.fase !== "fim" && jogando ? codigo : null);
  }, [e?.fase, jogando, codigo]);

  // sons e câmera nos momentos principais
  const etapa = e ? `${e.fase}:${e.vez}:${e.etapa}` : "";
  useEffect(() => {
    if (!e) return;
    if (e.fase === "fim") {
      playSfx("vitoria");
      setCasa(null);
      setAba(null);
    }
    if (e.fase !== "jogo") return;
    if (e.etapa === "rolando") playSfx("tique");
    else if (e.etapa === "rolar" && minhaVez) playSfx("pop");
    if (e.fase === "jogo" && e.etapa === "rolar") cena.current?.focar({ tipo: "vez" });
  }, [etapa]);

  const sair = (desistir: boolean) => {
    if (desistir || e?.fase === "sala") {
      sala.agir({ t: "sair" });
      guardarSala(null);
    }
    setTimeout(onClose, 160);
  };

  const propostasParaMim = e?.trocas.filter((t) => t.para === eu.id) ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Magnata HOST"
      className="fixed inset-0 z-[90] overflow-hidden bg-black text-white"
    >
      <div ref={palco} className="absolute inset-0" />
      {sala.erro && !e ? (
        <Centro>
          <p className="text-sm text-white/80">{sala.erro}</p>
          <Botao tipo="forte" onClick={onClose} className="mt-4">
            Voltar à praça
          </Botao>
        </Centro>
      ) : !e ? (
        <Centro>
          <p className="flex items-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 animate-spin" /> Procurando a sala {codigo}…
          </p>
          <Botao onClick={onClose} className="mt-4">
            Cancelar
          </Botao>
        </Centro>
      ) : e.fase === "sala" ? (
        <SalaDeEspera
          e={e}
          eu={eu}
          presentes={sala.presentes}
          amigos={amigos}
          agir={sala.agir}
          onConvidar={(id) => onConvidar(id, codigo)}
          onSair={() => sair(false)}
        />
      ) : (
        <>
          <BarraDosJogadores
            e={e}
            meuId={eu.id}
            presentes={sala.presentes}
            onFocar={(id) => cena.current?.focar({ tipo: "jogador", id })}
          />
          {/* botões do canto: câmera, imóveis, trocas, histórico, emotes e sair */}
          <div className="absolute right-3 top-[86px] z-10 flex flex-col items-end gap-1.5">
            <BotaoRedondo
              titulo="Voltar a câmera para quem está jogando"
              onClick={() => (setCasa(null), cena.current?.focar({ tipo: "vez" }))}
            >
              <Focus className="size-4" />
            </BotaoRedondo>
            <BotaoRedondo
              titulo="Ver o tabuleiro inteiro"
              onClick={() => cena.current?.focar({ tipo: "geral" })}
            >
              <Eye className="size-4" />
            </BotaoRedondo>
            {jogando && e.fase === "jogo" && (
              <>
                <BotaoRedondo titulo="Meus imóveis" onClick={() => setAba("imoveis")}>
                  <Building2 className="size-4" />
                </BotaoRedondo>
                <BotaoRedondo
                  titulo="Trocas"
                  onClick={() => setAba("trocas")}
                  aviso={propostasParaMim.length}
                >
                  <ArrowLeftRight className="size-4" />
                </BotaoRedondo>
              </>
            )}
            <BotaoRedondo titulo="Histórico" onClick={() => setVerHistorico((v) => !v)}>
              <History className="size-4" />
            </BotaoRedondo>
            <BotaoRedondo
              titulo="Emotes"
              onClick={() => setMenu((m) => (m === "emotes" ? null : "emotes"))}
            >
              <Smile className="size-4" />
            </BotaoRedondo>
            <BotaoRedondo
              titulo="Sair"
              onClick={() => (e.fase === "fim" ? sair(false) : setMenu("sair"))}
            >
              <LogOut className="size-4" />
            </BotaoRedondo>
            {menu === "emotes" && (
              <div className={cn(vidro, "pf-pop flex gap-1 p-1.5")}>
                {EMOTES.map(([r, emoji]) => (
                  <button
                    key={r}
                    onClick={() => sala.reagir(r)}
                    className="grid size-8 place-items-center rounded-full text-base hover:bg-white/10"
                    title={r}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          {verHistorico && <Historico e={e} />}
          {casa !== null && (
            <PainelDaCasa
              e={e}
              i={casa}
              meuId={eu.id}
              minhaVez={!!minhaVez}
              agir={sala.agir}
              onClose={() => setCasa(null)}
            />
          )}
          {e.fase === "jogo" && (
            <Acoes
              e={e}
              eu={eu_}
              minhaVez={!!minhaVez}
              agir={sala.agir}
              onImoveis={() => setAba("imoveis")}
            />
          )}
          {e.fase === "jogo" && e.carta !== null && (
            <Carta e={e} minhaVez={!!minhaVez} onOk={() => sala.agir({ t: "ok" })} />
          )}
          {e.fase === "jogo" && propostasParaMim.length > 0 && aba !== "trocas" && (
            <button
              onClick={() => setAba("trocas")}
              className={cn(
                vidro,
                "pf-pop absolute left-1/2 top-[92px] z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px]",
              )}
            >
              <ArrowLeftRight className="size-3.5 text-[#ffd23f]" />
              {e.jogadores.find((j) => j.id === propostasParaMim[0]?.de)?.nome} te propôs uma troca
              <b className="text-[#ffd23f]">ver</b>
            </button>
          )}
          {e.fase === "jogo" && !jogando && (
            <div
              className={cn(
                vidro,
                "absolute left-3 top-[86px] z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] text-white/80",
              )}
            >
              <Eye className="size-3.5" /> Você está assistindo
            </div>
          )}
          {aba && jogando && e.fase === "jogo" && (
            <Gestao
              e={e}
              meuId={eu.id}
              minhaVez={!!minhaVez}
              aba={aba}
              setAba={setAba}
              agir={sala.agir}
              onClose={() => setAba(null)}
            />
          )}
          {e.fase === "fim" && (
            <Final
              e={e}
              meuId={eu.id}
              onDeNovo={() => sala.agir({ t: "denovo" })}
              onSair={() => sair(false)}
            />
          )}
          {menu === "sair" && (
            <Centro>
              <h3 className="font-display text-lg font-semibold">Sair da partida?</h3>
              <p className="mt-1 max-w-xs text-center text-xs text-white/65">
                Voltando à praça, seu lugar fica guardado: é só entrar de novo pelo portal. Enquanto
                você estiver fora, o jogo faz as jogadas simples no seu lugar.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Botao tipo="forte" onClick={() => sair(false)}>
                  Voltar à praça
                </Botao>
                {jogando && (
                  <Botao tipo="perigo" onClick={() => sair(true)}>
                    Desistir da partida
                  </Botao>
                )}
                <Botao onClick={() => setMenu(null)}>Continuar jogando</Botao>
              </div>
            </Centro>
          )}
        </>
      )}
    </div>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div className={cn(vidro, "pf-pop flex flex-col items-center p-6")}>{children}</div>
    </div>
  );
}
function BotaoRedondo({
  children,
  titulo,
  onClick,
  aviso = 0,
}: {
  children: ReactNode;
  titulo: string;
  onClick: () => void;
  aviso?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="relative grid size-9 place-items-center rounded-full border border-white/10 bg-black/70 text-white/85 backdrop-blur-xl transition hover:bg-white/10 hover:text-white active:scale-95"
    >
      {children}
      {aviso > 0 && (
        <span className="absolute -right-1 -top-1 grid size-4 animate-pulse place-items-center rounded-full bg-primary text-[9px] font-bold">
          {aviso}
        </span>
      )}
    </button>
  );
}

/* ---------- sala de espera ---------- */
function SalaDeEspera({
  e,
  eu,
  presentes,
  amigos,
  agir,
  onConvidar,
  onSair,
}: {
  e: Estado;
  eu: Eu;
  presentes: Set<string>;
  amigos: AmigoOnline[];
  agir: (a: Acao) => void;
  onConvidar: (id: string) => void;
  onSair: () => void;
}) {
  const [convidados, setConvidados] = useState<Set<string>>(new Set());
  const souAnfitriao = e.anfitriao === eu.id;
  const eu_ = e.jogadores.find((j) => j.id === eu.id);
  const faltam = e.jogadores.filter((j) => !j.pronto && j.id !== e.anfitriao).length;
  const podeIniciar = e.jogadores.length >= MIN_JOGADORES && faltam === 0;
  const livres = amigos.filter((a) => !e.jogadores.some((j) => j.id === a.id));
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]">
      <div className={cn(vidro, "pf-pop w-full max-w-[560px] p-5")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary">
              Sala privada
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight">Magnata HOST</h2>
          </div>
          <button
            onClick={() =>
              void copiarTexto(e.codigo).then((ok) => ok && toast.success("Código copiado."))
            }
            title="Copiar o código da sala"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 hover:bg-white/10"
          >
            <span className="text-[10px] uppercase tracking-widest text-white/50">código</span>
            <span className="font-mono text-lg font-bold tracking-[0.2em]">{e.codigo}</span>
            <Copy className="size-3.5 text-white/60" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {Array.from({ length: MAX_JOGADORES }, (_, k) => {
            const j = e.jogadores[k];
            return (
              <div
                key={k}
                className={cn(
                  "flex h-12 items-center gap-2 rounded-xl border px-2.5",
                  j
                    ? "border-white/10 bg-white/[0.05]"
                    : "border-dashed border-white/10 text-white/30",
                )}
              >
                {j ? (
                  <>
                    <Avatar j={j} tamanho={30} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {j.nome}
                    </span>
                    {j.id === e.anfitriao ? (
                      <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#ffd23f]">
                        <Crown className="size-3" /> anfitrião
                      </span>
                    ) : j.pronto ? (
                      <span className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300">
                        <Check className="size-3" /> pronto
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-white/45">
                        {presentes.has(j.id) ? "entrou" : "conectando…"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[12px]">lugar livre</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-white/45">Modo</span>
          {(["classico", "rapido"] as const).map((m) => (
            <button
              key={m}
              disabled={!souAnfitriao}
              onClick={() => agir({ t: "modo", modo: m })}
              className={cn(
                "h-8 rounded-full border px-3 text-[12px] font-medium transition disabled:cursor-default",
                e.modo === m
                  ? "border-white bg-white text-black"
                  : "border-white/15 text-white/70 enabled:hover:bg-white/10",
              )}
            >
              {m === "classico" ? "Clássico" : "Rápido · 30 min"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-white/50">
          {e.modo === "classico"
            ? "Vence o último jogador que não falir."
            : "Aos 30 minutos o turno atual termina e vence o maior patrimônio."}
        </p>

        {livres.length > 0 && e.jogadores.length < MAX_JOGADORES && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] uppercase tracking-widest text-white/45">
              Convidar quem está online
            </p>
            <div className="flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto">
              {livres.map((a) => {
                const foi = convidados.has(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={foi}
                    onClick={() => {
                      onConvidar(a.id);
                      setConvidados((s) => new Set(s).add(a.id));
                    }}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] pl-1 pr-2.5 text-[12px] hover:bg-white/10 disabled:opacity-50"
                  >
                    <span className="block size-6 overflow-hidden rounded-full bg-black/50">
                      <Hoki2D visual={a.visual} busto />
                    </span>
                    {a.nome}
                    {foi ? (
                      <Check className="size-3 text-emerald-300" />
                    ) : (
                      <UserPlus className="size-3" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Botao onClick={onSair}>
            <LogOut className="size-3.5" /> Sair
          </Botao>
          {souAnfitriao ? (
            <Botao
              tipo="forte"
              disabled={!podeIniciar}
              onClick={() => agir({ t: "iniciar" })}
              title={podeIniciar ? "" : "Precisa de 2 a 6 jogadores, todos prontos"}
            >
              {e.jogadores.length < MIN_JOGADORES
                ? "Aguardando jogadores…"
                : faltam
                  ? `Faltam ${faltam} ficar prontos`
                  : "Iniciar partida"}
            </Botao>
          ) : eu_ ? (
            <Botao
              tipo={eu_.pronto ? "normal" : "forte"}
              onClick={() => agir({ t: "pronto", v: !eu_.pronto })}
            >
              {eu_.pronto ? "Pronto! (clique para desmarcar)" : "Estou pronto"}
            </Botao>
          ) : (
            <span className="flex items-center gap-2 text-[12px] text-white/60">
              <Loader2 className="size-3.5 animate-spin" />
              {e.jogadores.length >= MAX_JOGADORES ? "Sala cheia" : "Entrando…"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- barra da partida: ordem dos turnos, saldo e quem joga ---------- */
function BarraDosJogadores({
  e,
  meuId,
  presentes,
  onFocar,
}: {
  e: Estado;
  meuId: string;
  presentes: Set<string>;
  onFocar: (id: string) => void;
}) {
  const agora = useAgora(e.fase === "jogo" && e.fimEm !== null);
  const resta = e.fimEm !== null ? Math.max(0, e.fimEm - agora) : null;
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-center gap-2 p-3">
      <div className={cn(vidro, "flex max-w-full items-stretch gap-1 overflow-x-auto p-1.5")}>
        {e.jogadores.map((j, k) => {
          const vez = e.fase === "jogo" && k === e.vez;
          return (
            <button
              key={j.id}
              onClick={() => onFocar(j.id)}
              title="Ver este mascote no tabuleiro"
              className={cn(
                "relative flex min-w-[124px] items-center gap-2 rounded-xl px-2 py-1.5 text-left transition",
                vez ? "bg-white/[0.12]" : "hover:bg-white/[0.06]",
                j.falido && "opacity-40",
              )}
              style={vez ? { boxShadow: `inset 0 0 0 1.5px ${corDe(j)}` } : undefined}
            >
              <Avatar j={j} />
              <span className="min-w-0 leading-tight">
                <span className="flex items-center gap-1 text-[12px] font-semibold">
                  <span className="truncate">{j.nome}</span>
                  {j.id === meuId && (
                    <span className="text-[9.5px] font-medium text-white/45">você</span>
                  )}
                  {j.preso > 0 && <span title="Na Delegacia">🚔</span>}
                  {j.habeas > 0 && <span title="Tem habeas corpus">📜</span>}
                </span>
                <span
                  className={cn(
                    "block text-[12px] tabular-nums",
                    j.falido ? "text-white/50" : j.saldo < 0 ? "text-red-300" : "text-emerald-300",
                  )}
                >
                  {j.falido ? "faliu" : dinheiro(j.saldo)}
                </span>
              </span>
              {vez && (
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[8.5px] font-bold uppercase leading-[13px] text-black"
                  style={{ background: corDe(j) }}
                >
                  vez
                </span>
              )}
              {!j.falido && !presentes.has(j.id) && (
                <span
                  className="absolute right-1 top-1 size-2 rounded-full bg-amber-400"
                  title="Fora da sala: o lugar está guardado"
                />
              )}
            </button>
          );
        })}
      </div>
      {resta !== null && e.fase === "jogo" && (
        <div
          className={cn(
            vidro,
            "flex h-[52px] shrink-0 items-center gap-1.5 px-3 text-[13px] font-semibold tabular-nums",
            resta < 60_000 && "text-red-300",
          )}
          title="Modo rápido: quando zerar, o turno atual termina e vence o maior patrimônio"
        >
          <Timer className="size-4" />
          {Math.floor(resta / 60_000)}:
          {String(Math.floor((resta % 60_000) / 1000)).padStart(2, "0")}
        </div>
      )}
    </div>
  );
}

function Historico({ e }: { e: Estado }) {
  const caixa = useRef<HTMLDivElement>(null);
  const ultimo = e.historico[e.historico.length - 1];
  useEffect(() => {
    if (caixa.current) caixa.current.scrollTop = caixa.current.scrollHeight;
  }, [ultimo, e.v]);
  return (
    <div
      ref={caixa}
      className={cn(
        vidro,
        "absolute bottom-3 right-3 z-10 hidden max-h-[190px] w-[270px] overflow-y-auto p-2.5 text-[11.5px] leading-snug md:block",
      )}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
        Histórico
      </p>
      {e.historico.slice(-14).map((h, k) => (
        <p
          key={`${k}-${h}`}
          className="border-t border-white/[0.06] py-1 text-white/80 first:border-0"
        >
          {h}
        </p>
      ))}
    </div>
  );
}

/* ---------- painel da casa selecionada ---------- */
function PainelDaCasa({
  e,
  i,
  meuId,
  minhaVez,
  agir,
  onClose,
}: {
  e: Estado;
  i: number;
  meuId: string;
  minhaVez: boolean;
  agir: (a: Acao) => void;
  onClose: () => void;
}) {
  const casa = CASAS[i];
  if (!casa) return null;
  const posse = e.posses[i];
  const dono = posse ? e.jogadores.find((j) => j.id === posse.dono) : undefined;
  const grupo = casa.tipo === "imovel" ? GRUPOS[casa.grupo ?? 0] : undefined;
  const tabela = casa.tipo === "imovel" ? tabelaDeAluguel(casa.preco ?? 0) : null;
  const compravel = casa.tipo === "imovel" || casa.tipo === "companhia";
  return (
    <div className={cn(vidro, "pf-pop absolute bottom-3 left-3 z-10 w-[268px] overflow-hidden")}>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: grupo?.cor ?? (casa.tipo === "noticia" ? "#7a4fe0" : "#30343c") }}
      >
        <span className="text-xl">{casa.icone}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13.5px] font-bold text-black/85 mix-blend-normal">
            <span className={grupo ? "text-black/85" : "text-white"}>{casa.nome}</span>
          </span>
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider",
              grupo ? "text-black/60" : "text-white/70",
            )}
          >
            {grupo
              ? `Grupo ${grupo.nome}`
              : casa.tipo === "companhia"
                ? "Companhia"
                : "Casa especial"}
          </span>
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className={grupo ? "text-black/70" : "text-white/80"}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-2 p-3 text-[12px]">
        {compravel ? (
          <>
            <Linha nome="Dono">
              {dono ? (
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="size-2 rounded-full" style={{ background: corDe(dono) }} />
                  {dono.nome}
                  {posse?.hip && (
                    <span className="rounded bg-primary/25 px-1 text-[9.5px]">hipotecado</span>
                  )}
                </span>
              ) : (
                <span className="text-emerald-300">Banco · à venda</span>
              )}
            </Linha>
            <Linha nome="Preço">{dinheiro(casa.preco ?? 0)}</Linha>
            <Linha nome="Aluguel agora">
              <b>{dinheiro(posse ? aluguelDe(e, i) : (tabela?.[0] ?? ALUGUEL_DAS_CIAS[0] ?? 0))}</b>
            </Linha>
            {tabela ? (
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1.5 text-center text-[10.5px]">
                {["Terreno", "1 casa", "2 casas", "3 casas", "4 casas", "Hotel"].map((n, k) => (
                  <span
                    key={n}
                    className={cn(
                      "rounded-lg px-1 py-0.5",
                      posse && posse.casas === k && !posse.hip && "bg-white/15 font-semibold",
                    )}
                  >
                    <span className="block text-white/45">{n}</span>
                    {dinheiro(tabela[k] ?? 0)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-white/[0.04] p-2 text-[10.5px] text-white/65">
                Aluguel pelo número de companhias do dono:{" "}
                {ALUGUEL_DAS_CIAS.map((v, k) => `${k + 1} → ${dinheiro(v)}`).join(" · ")}
              </p>
            )}
            <p className="text-[10.5px] text-white/50">
              {tabela && `Cada construção: ${dinheiro(obraDe(i))} · `}Hipoteca:{" "}
              {dinheiro(hipotecaDe(i))}
              {tabela && " · Grupo completo sem construção dobra o aluguel."}
            </p>
            {dono?.id === meuId && (
              <AcoesDoImovel e={e} c={i} meuId={meuId} minhaVez={minhaVez} agir={agir} />
            )}
          </>
        ) : (
          <p className="text-white/75">
            {casa.tipo === "partida" &&
              `Ao passar por aqui você recebe ${dinheiro(SALARIO)} de salário.`}
            {casa.tipo === "delegacia" &&
              `Cair aqui andando é só visita. Preso sai pagando ${dinheiro(FIANCA)}, com habeas corpus ou tirando números iguais (até 3 tentativas).`}
            {casa.tipo === "praca" && "Casa de descanso: nada é cobrado nem pago."}
            {casa.tipo === "blitz" && "Quem cai aqui vai direto para a Delegacia."}
            {casa.tipo === "noticia" && "Tire uma carta do Plantão HOST: pode ser sorte ou azar."}
            {casa.tipo === "taxa" && `Quem cai aqui paga ${dinheiro(casa.valor ?? 0)} ao banco.`}
          </p>
        )}
      </div>
    </div>
  );
}
const Linha = ({ nome, children }: { nome: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-white/50">{nome}</span>
    <span>{children}</span>
  </div>
);

/** Construir, vender, hipotecar e resgatar um imóvel meu (só na minha vez). */
function AcoesDoImovel({
  e,
  c,
  meuId,
  minhaVez,
  agir,
}: {
  e: Estado;
  c: number;
  meuId: string;
  minhaVez: boolean;
  agir: (a: Acao) => void;
}) {
  const posse = e.posses[c];
  if (!posse) return null;
  const livre = minhaVez && (e.etapa === "rolar" || e.etapa === "livre");
  const apuro = minhaVez && e.etapa === "divida";
  const fora = "Só na sua vez (antes de rolar ou depois de resolver a casa)";
  const construir = livre ? podeConstruir(e, c, meuId) : fora;
  const vender = livre || apuro ? podeVender(e, c, meuId) : fora;
  const hipotecar = livre || apuro ? podeHipotecar(e, c, meuId) : fora;
  const saldo = e.jogadores.find((j) => j.id === meuId)?.saldo ?? 0;
  const resgatar = !livre ? fora : saldo < resgateDe(c) ? "Saldo insuficiente." : null;
  const mini = "h-7 px-2.5 text-[11px]";
  return (
    <div className="flex flex-wrap gap-1">
      {CASAS[c]?.tipo === "imovel" && !posse.hip && (
        <>
          <Botao
            className={mini}
            disabled={!!construir}
            title={construir ?? ""}
            onClick={() => agir({ t: "construir", c })}
          >
            {posse.casas === 4 ? "Hotel" : "Construir"} −{dinheiro(obraDe(c))}
          </Botao>
          {posse.casas > 0 && (
            <Botao
              className={mini}
              disabled={!!vender}
              title={vender ?? ""}
              onClick={() => agir({ t: "vender", c })}
            >
              Vender +{dinheiro(obraDe(c) / 2)}
            </Botao>
          )}
        </>
      )}
      {posse.hip ? (
        <Botao
          className={mini}
          disabled={!!resgatar}
          title={resgatar ?? ""}
          onClick={() => agir({ t: "resgatar", c })}
        >
          Resgatar −{dinheiro(resgateDe(c))}
        </Botao>
      ) : (
        posse.casas === 0 && (
          <Botao
            className={mini}
            disabled={!!hipotecar}
            title={hipotecar ?? ""}
            onClick={() => agir({ t: "hipotecar", c })}
          >
            Hipotecar +{dinheiro(hipotecaDe(c))}
          </Botao>
        )
      )}
    </div>
  );
}

/* ---------- ações do turno (embaixo, no centro) ---------- */
function Acoes({
  e,
  eu,
  minhaVez,
  agir,
  onImoveis,
}: {
  e: Estado;
  eu: Jogador | undefined;
  minhaVez: boolean;
  agir: (a: Acao) => void;
  onImoveis: () => void;
}) {
  const agora = useAgora(e.etapa === "leilao");
  const vez = daVez(e);
  if (!vez) return null;
  const casa = CASAS[vez.pos];
  const soma = e.dados ? e.dados[0] + e.dados[1] : 0;
  const caixa = cn(
    vidro,
    "pf-pop absolute bottom-3 left-1/2 z-10 flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-col items-center gap-2 px-4 py-3",
  );
  const titulo = (texto: ReactNode) => (
    <p className="flex items-center gap-2 text-center text-[12.5px] text-white/80">
      <span className="size-2 rounded-full" style={{ background: corDe(vez) }} />
      {texto}
    </p>
  );

  if (e.etapa === "leilao" && e.leilao) {
    const l = e.leilao;
    const lider = e.jogadores.find((j) => j.id === l.de);
    const faltam = Math.max(0, Math.ceil(((e.prazo ?? agora) - agora) / 1000));
    const posso = !!eu && !eu.falido && l.de !== eu.id;
    return (
      <div className={caixa}>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#ffd23f]">
          Leilão · {faltam} s
        </p>
        <p className="text-center text-[13px]">
          <b>
            {CASAS[l.casa]?.icone} {CASAS[l.casa]?.nome}
          </b>{" "}
          <span className="text-white/50">(preço {dinheiro(CASAS[l.casa]?.preco ?? 0)})</span>
        </p>
        <p className="text-[12.5px] text-white/80">
          {lider ? (
            <>
              Maior lance: <b className="text-emerald-300">{dinheiro(l.lance)}</b> de{" "}
              <b style={{ color: corDe(lider) }}>{lider.nome}</b>
            </>
          ) : (
            "Ninguém deu lance ainda"
          )}
        </p>
        {posso ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {[10, 50, 100].map((mais) => (
              <Botao
                key={mais}
                tipo={mais === 10 ? "forte" : "normal"}
                disabled={l.lance + mais > (eu?.saldo ?? 0)}
                onClick={() => agir({ t: "lance", v: l.lance + mais })}
              >
                {dinheiro(l.lance + mais)}
              </Botao>
            ))}
          </div>
        ) : (
          eu &&
          !eu.falido && <p className="text-[11.5px] text-emerald-300">Seu lance está na frente.</p>
        )}
      </div>
    );
  }
  if (e.etapa === "rolando" || e.etapa === "andando")
    return (
      <div className={caixa}>
        {titulo(
          <>
            <b>{vez.nome}</b> tirou{" "}
            <b className="text-base tabular-nums text-white">
              {e.dados?.[0]} + {e.dados?.[1]} = {soma}
            </b>
            {e.dados?.[0] === e.dados?.[1] && <span className="text-[#ffd23f]">iguais!</span>}
          </>,
        )}
      </div>
    );
  if (!minhaVez)
    return (
      <div className={cn(caixa, "py-2")}>
        {titulo(
          <>
            Vez de <b>{vez.nome}</b>
            {e.etapa === "decidir" && ` · decidindo se compra ${casa?.nome}`}
            {e.etapa === "divida" && " · levantando dinheiro para pagar"}
            {e.etapa === "carta" && " · lendo a carta"}
          </>,
        )}
      </div>
    );

  if (e.etapa === "rolar")
    return (
      <div className={caixa}>
        {vez.preso > 0 ? (
          <>
            {titulo(<>Você está na Delegacia · tentativa {vez.preso} de 3</>)}
            <div className="flex flex-wrap justify-center gap-1.5">
              <Botao tipo="forte" onClick={() => agir({ t: "rolar" })}>
                <Dices className="size-4" /> Tentar números iguais
              </Botao>
              <Botao disabled={vez.saldo < FIANCA} onClick={() => agir({ t: "fianca" })}>
                Pagar fiança {dinheiro(FIANCA)}
              </Botao>
              {vez.habeas > 0 && (
                <Botao onClick={() => agir({ t: "habeas" })}>Usar habeas corpus</Botao>
              )}
            </div>
          </>
        ) : (
          <>
            {titulo(e.duplos > 0 ? "Números iguais: jogue de novo!" : "Sua vez!")}
            <div className="flex gap-1.5">
              <Botao
                tipo="forte"
                className="h-11 px-7 text-sm"
                onClick={() => agir({ t: "rolar" })}
              >
                <Dices className="size-5" /> Rolar dados
              </Botao>
              <Botao className="h-11" onClick={onImoveis}>
                <Building2 className="size-4" /> Meus imóveis
              </Botao>
            </div>
          </>
        )}
      </div>
    );
  if (e.etapa === "decidir") {
    const preco = casa?.preco ?? 0;
    const tabela = casa?.tipo === "imovel" ? tabelaDeAluguel(preco) : null;
    return (
      <div className={caixa}>
        <p className="text-center text-[13.5px]">
          <b>
            {casa?.icone} {casa?.nome}
          </b>{" "}
          está à venda
        </p>
        <p className="text-center text-[11.5px] text-white/65">
          Preço <b className="text-white">{dinheiro(preco)}</b> · aluguel{" "}
          <b className="text-white">{dinheiro(tabela?.[0] ?? ALUGUEL_DAS_CIAS[0] ?? 0)}</b>
          {tabela && ` (até ${dinheiro(tabela[5] ?? 0)} com hotel)`} · seu saldo{" "}
          <b className="text-emerald-300">{dinheiro(vez.saldo)}</b>
        </p>
        <div className="flex gap-1.5">
          <Botao tipo="forte" disabled={vez.saldo < preco} onClick={() => agir({ t: "comprar" })}>
            Comprar por {dinheiro(preco)}
          </Botao>
          <Botao onClick={() => agir({ t: "recusar" })}>Recusar (vai a leilão)</Botao>
        </div>
      </div>
    );
  }
  if (e.etapa === "divida")
    return (
      <div className={caixa}>
        <p className="text-center text-[13px]">
          Você está devendo <b className="text-red-300">{dinheiro(-vez.saldo)}</b>
        </p>
        <p className="max-w-sm text-center text-[11.5px] text-white/65">
          Venda construções ou hipoteque imóveis para cobrir. Se não der, a saída é a falência.
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Botao tipo="forte" onClick={onImoveis}>
            <Building2 className="size-4" /> Administrar bens
          </Botao>
          <Botao disabled={vez.saldo < 0} onClick={() => agir({ t: "pagar" })}>
            Dívida quitada: seguir
          </Botao>
          <Botao tipo="perigo" onClick={() => agir({ t: "falir" })}>
            Declarar falência
          </Botao>
        </div>
      </div>
    );
  if (e.etapa === "livre")
    return (
      <div className={caixa}>
        {titulo(<>Casa resolvida. Administre seus imóveis ou encerre o turno.</>)}
        <div className="flex gap-1.5">
          <Botao tipo="forte" className="h-11 px-6 text-sm" onClick={() => agir({ t: "encerrar" })}>
            Encerrar turno
          </Botao>
          <Botao className="h-11" onClick={onImoveis}>
            <Building2 className="size-4" /> Meus imóveis
          </Botao>
        </div>
      </div>
    );
  return null;
}

/** A carta do Plantão HOST vira na tela para todos; quem tirou confirma. */
function Carta({ e, minhaVez, onOk }: { e: Estado; minhaVez: boolean; onOk: () => void }) {
  const carta = NOTICIAS[e.carta ?? -1];
  const vez = daVez(e);
  const [virada, setVirada] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVirada(true), 60);
    return () => clearTimeout(id);
  }, []);
  if (!carta) return null;
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/45 p-4 [perspective:1000px]">
      <div
        className="relative h-[250px] w-[190px] transition-transform duration-700 [transform-style:preserve-3d]"
        style={{ transform: virada ? "rotateY(0deg)" : "rotateY(180deg)" }}
      >
        <div className="absolute inset-0 flex flex-col items-center rounded-2xl border-4 border-[#7a4fe0] bg-[#f6f1e4] p-4 text-center text-black shadow-[0_30px_70px_rgba(0,0,0,0.6)] [backface-visibility:hidden]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a4fe0]">
            Plantão HOST
          </span>
          <span className="mt-2 text-4xl">📰</span>
          <p className="mt-3 flex-1 text-[13.5px] font-semibold leading-snug">{carta.texto}</p>
          {minhaVez ? (
            <button
              onClick={onOk}
              className="h-9 w-full rounded-full bg-black text-[12.5px] font-semibold text-white"
            >
              OK
            </button>
          ) : (
            <span className="text-[11px] text-black/55">{vez?.nome} tirou esta carta</span>
          )}
        </div>
        <div className="absolute inset-0 grid place-items-center rounded-2xl border-4 border-white/20 bg-[#7a4fe0] text-5xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
          📰
        </div>
      </div>
    </div>
  );
}

/* ---------- meus imóveis e trocas ---------- */
function Gestao({
  e,
  meuId,
  minhaVez,
  aba,
  setAba,
  agir,
  onClose,
}: {
  e: Estado;
  meuId: string;
  minhaVez: boolean;
  aba: "imoveis" | "trocas";
  setAba: (a: "imoveis" | "trocas") => void;
  agir: (a: Acao) => void;
  onClose: () => void;
}) {
  const meus = Object.keys(e.posses)
    .map(Number)
    .filter((c) => e.posses[c]?.dono === meuId)
    .sort((a, b) => a - b);
  const eu = e.jogadores.find((j) => j.id === meuId);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/50 p-3 backdrop-blur-[2px]">
      <div className={cn(vidro, "pf-pop flex max-h-[86vh] w-full max-w-[640px] flex-col")}>
        <div className="flex items-center gap-1 border-b border-white/10 p-2">
          {(["imoveis", "trocas"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[12.5px] font-semibold",
                aba === a ? "bg-white text-black" : "text-white/65 hover:bg-white/10",
              )}
            >
              {a === "imoveis" ? "Meus imóveis" : "Trocas"}
              {a === "trocas" && e.trocas.some((t) => t.para === meuId) && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
              )}
            </button>
          ))}
          <span className="ml-auto pr-1 text-[12px] text-white/60">
            Saldo <b className="text-emerald-300">{dinheiro(eu?.saldo ?? 0)}</b> · patrimônio{" "}
            <b className="text-white">{dinheiro(patrimonio(e, meuId))}</b>
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 place-items-center rounded-full hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3">
          {aba === "imoveis" ? (
            meus.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-white/55">
                Você ainda não tem imóveis. Caia numa casa à venda e compre.
              </p>
            ) : (
              <div className="space-y-1.5">
                {meus.map((c) => {
                  const casa = CASAS[c];
                  const p = e.posses[c];
                  if (!casa || !p) return null;
                  const cor =
                    casa.tipo === "imovel" ? (GRUPOS[casa.grupo ?? 0]?.cor ?? "#888") : "#ffd23f";
                  return (
                    <div
                      key={c}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.045] p-2"
                    >
                      <span className="h-8 w-1.5 rounded-full" style={{ background: cor }} />
                      <span className="min-w-[150px] flex-1 leading-tight">
                        <span className="block text-[12.5px] font-semibold">
                          {casa.icone} {casa.nome}
                          {p.hip && (
                            <span className="ml-1.5 rounded bg-primary/25 px-1 text-[9.5px]">
                              hipotecado
                            </span>
                          )}
                        </span>
                        <span className="text-[10.5px] text-white/50">
                          {p.casas === 5
                            ? "🏨 hotel"
                            : p.casas > 0
                              ? `${"🏠".repeat(p.casas)}`
                              : "sem construção"}{" "}
                          · aluguel {dinheiro(aluguelDe(e, c))}
                        </span>
                      </span>
                      <AcoesDoImovel e={e} c={c} meuId={meuId} minhaVez={minhaVez} agir={agir} />
                    </div>
                  );
                })}
                {!minhaVez && (
                  <p className="pt-1 text-center text-[11px] text-white/45">
                    Construir, vender e hipotecar só na sua vez. Trocas podem ser propostas a
                    qualquer hora.
                  </p>
                )}
              </div>
            )
          ) : (
            <Trocas e={e} meuId={meuId} agir={agir} />
          )}
        </div>
      </div>
    </div>
  );
}

function ResumoDaTroca({ e, t, meuId }: { e: Estado; t: Omit<Troca, "id">; meuId: string }) {
  const de = e.jogadores.find((j) => j.id === t.de);
  const para = e.jogadores.find((j) => j.id === t.para);
  const lado = (quem: Jogador | undefined, casas: number[], valor: number) => (
    <div className="flex-1 rounded-xl bg-white/[0.05] p-2">
      <p className="text-[10.5px] text-white/50">
        <b style={{ color: corDe(quem) }}>{quem?.id === meuId ? "Você" : quem?.nome}</b> entrega
      </p>
      <p className="text-[12px] font-medium">
        {[casas.length ? nomes(casas) : null, valor ? dinheiro(valor) : null]
          .filter(Boolean)
          .join(" + ") || "nada"}
      </p>
    </div>
  );
  return (
    <div className="flex items-stretch gap-1.5">
      {lado(de, t.dou, t.douD)}
      <ArrowLeftRight className="size-4 shrink-0 self-center text-white/40" />
      {lado(para, t.quero, t.queroD)}
    </div>
  );
}

function Trocas({ e, meuId, agir }: { e: Estado; meuId: string; agir: (a: Acao) => void }) {
  const outros = e.jogadores.filter((j) => j.id !== meuId && !j.falido);
  const [para, setPara] = useState(outros[0]?.id ?? "");
  const [dou, setDou] = useState<number[]>([]);
  const [quero, setQuero] = useState<number[]>([]);
  const [douD, setDouD] = useState(0);
  const [queroD, setQueroD] = useState(0);
  const eu = e.jogadores.find((j) => j.id === meuId);
  const alvo = e.jogadores.find((j) => j.id === para);
  const casasDe = (id: string) =>
    Object.keys(e.posses)
      .map(Number)
      .filter((c) => trocavel(e, c, id))
      .sort((a, b) => a - b);
  const minhas = useMemo(() => casasDe(meuId), [e.posses, meuId]);
  const dele = useMemo(() => casasDe(para), [e.posses, para]);
  const alterna = (lista: number[], c: number) =>
    lista.includes(c) ? lista.filter((x) => x !== c) : [...lista, c];
  const proposta = {
    de: meuId,
    para,
    dou: dou.filter((c) => minhas.includes(c)),
    quero: quero.filter((c) => dele.includes(c)),
    douD: Math.max(0, Math.min(Math.floor(douD) || 0, eu?.saldo ?? 0)),
    queroD: Math.max(0, Math.floor(queroD) || 0),
  };
  const vazia = !proposta.dou.length && !proposta.quero.length;
  const fichas = (lista: number[], escolhidas: number[], aoClicar: (c: number) => void) =>
    lista.length ? (
      <div className="flex flex-wrap gap-1">
        {lista.map((c) => (
          <button
            key={c}
            onClick={() => aoClicar(c)}
            className={cn(
              "h-7 rounded-full border px-2.5 text-[11px] transition",
              escolhidas.includes(c)
                ? "border-white bg-white font-semibold text-black"
                : "border-white/15 text-white/75 hover:bg-white/10",
            )}
          >
            {CASAS[c]?.icone} {CASAS[c]?.nome}
          </button>
        ))}
      </div>
    ) : (
      <p className="text-[11px] text-white/40">Nenhum imóvel que possa ser trocado.</p>
    );
  const campo = (valor: number, muda: (v: number) => void) => (
    <input
      type="number"
      min={0}
      step={10}
      value={valor || ""}
      placeholder="0"
      onChange={(ev) => muda(Number(ev.target.value))}
      className="h-8 w-24 rounded-lg border border-white/10 bg-black/40 px-2 text-[12px] outline-none focus:border-white/30"
    />
  );
  return (
    <div className="space-y-3">
      {e.trocas
        .filter((t) => t.para === meuId || t.de === meuId)
        .map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border border-[#ffd23f]/30 bg-[#ffd23f]/[0.06] p-2.5"
          >
            <p className="mb-1.5 text-[11.5px] font-semibold text-[#ffd23f]">
              {t.para === meuId
                ? `${e.jogadores.find((j) => j.id === t.de)?.nome} te propôs:`
                : `Sua proposta para ${e.jogadores.find((j) => j.id === t.para)?.nome} (aguardando resposta)`}
            </p>
            <ResumoDaTroca e={e} t={t} meuId={meuId} />
            <div className="mt-2 flex justify-end gap-1.5">
              {t.para === meuId ? (
                <>
                  <Botao
                    className="h-8"
                    onClick={() => agir({ t: "troca", id: t.id, aceita: false })}
                  >
                    Recusar
                  </Botao>
                  <Botao
                    tipo="forte"
                    className="h-8"
                    onClick={() => agir({ t: "troca", id: t.id, aceita: true })}
                  >
                    Aceitar troca
                  </Botao>
                </>
              ) : (
                <Botao
                  className="h-8"
                  onClick={() => agir({ t: "troca", id: t.id, aceita: false })}
                >
                  Cancelar proposta
                </Botao>
              )}
            </div>
          </div>
        ))}
      {outros.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-white/55">Não há com quem trocar.</p>
      ) : (
        <div className="space-y-2.5 rounded-2xl bg-white/[0.035] p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
            Nova proposta
          </p>
          <div className="flex flex-wrap gap-1">
            {outros.map((j) => (
              <button
                key={j.id}
                onClick={() => (setPara(j.id), setQuero([]))}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-[12px]",
                  para === j.id ? "border-white bg-white/15" : "border-white/10 hover:bg-white/10",
                )}
              >
                <Avatar j={j} tamanho={22} /> {j.nome}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1 text-[11px] text-white/55">Você entrega</p>
            {fichas(minhas, dou, (c) => setDou((l) => alterna(l, c)))}
            <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-white/60">
              + dinheiro {campo(douD, setDouD)}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-white/55">Você pede de {alvo?.nome}</p>
            {fichas(dele, quero, (c) => setQuero((l) => alterna(l, c)))}
            <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-white/60">
              + dinheiro {campo(queroD, setQueroD)}
            </div>
          </div>
          <ResumoDaTroca e={e} t={proposta} meuId={meuId} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-white/45">
              Imóveis de um grupo com construções não entram em troca.
            </span>
            <Botao
              tipo="forte"
              disabled={vazia || !para}
              onClick={() => {
                agir({ t: "propor", ...proposta });
                setDou([]);
                setQuero([]);
                setDouD(0);
                setQueroD(0);
                toast.success("Proposta enviada.");
              }}
            >
              Enviar proposta
            </Botao>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- fim: classificação (o pódio fica no 3D, atrás) ---------- */
function Final({
  e,
  meuId,
  onDeNovo,
  onSair,
}: {
  e: Estado;
  meuId: string;
  onDeNovo: () => void;
  onSair: () => void;
}) {
  const medalha = ["🥇", "🥈", "🥉"];
  return (
    <div
      className={cn(
        vidro,
        "pf-pop absolute bottom-4 left-1/2 z-20 w-[min(440px,calc(100vw-24px))] -translate-x-1/2 p-4",
      )}
    >
      <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#ffd23f]">
        Fim da partida
      </p>
      <div className="mt-2 space-y-1">
        {(e.ranking ?? []).map((l) => {
          const j = e.jogadores.find((x) => x.id === l.id);
          if (!j) return null;
          return (
            <div
              key={l.id}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-1.5",
                l.lugar === 1 ? "bg-[#ffd23f]/15" : "bg-white/[0.045]",
              )}
            >
              <span className="w-7 text-center text-base">
                {medalha[l.lugar - 1] ?? `${l.lugar}º`}
              </span>
              <Avatar j={j} tamanho={28} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {j.nome}
                {j.id === meuId && (
                  <span className="ml-1 text-[10px] font-normal text-white/45">você</span>
                )}
              </span>
              <span className="text-right text-[11.5px] leading-tight">
                {j.falido ? (
                  <span className="text-white/45">faliu</span>
                ) : (
                  <>
                    <b className="block tabular-nums text-emerald-300">{dinheiro(l.patrimonio)}</b>
                    <span className="text-[10px] text-white/45">saldo {dinheiro(l.saldo)}</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {e.anfitriao === meuId ? (
          <Botao tipo="forte" onClick={onDeNovo}>
            Jogar novamente
          </Botao>
        ) : (
          <span className="self-center text-[11.5px] text-white/50">
            O anfitrião pode abrir outra partida
          </span>
        )}
        <Botao onClick={onSair}>Voltar à ilha</Botao>
      </div>
    </div>
  );
}
