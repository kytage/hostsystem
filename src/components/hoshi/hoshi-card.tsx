import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Dices, Drumstick, Gamepad2, GlassWater, Hand, Loader2, Lock, Moon, Pencil, Shirt, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  aoVivo,
  BARRAS,
  CUIDADOS,
  ENERGIA_POR_JOGO,
  fala,
  GRUPOS,
  humor,
  meuPet,
  nivelDoXp,
  nomeValido,
  PECAS,
  progresso,
  rankingPets,
  salvarPet,
  sugerirNome,
  titulo,
  XP_MAX_JOGO,
  type Barra,
  type Cuidado,
  type HoshiPet,
  type Visual,
} from "@/lib/hoshi";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { Hoshi3D, type Reacao } from "./hoshi-3d";
import { HoshiJogos, type Resultado } from "./minigames";

const KEY = ["hoshi-meu"];
const ICONES: Record<Cuidado["id"], typeof Hand> = { comida: Drumstick, bebida: GlassWater, carinho: Hand, soneca: Moon };
const ROTULO: Record<Barra, string> = { fome: "Fome", sede: "Sede", energia: "Energia", carinho: "Carinho" };
const REACAO: Record<Cuidado["id"], Reacao> = { comida: "comer", bebida: "beber", carinho: "carinho", soneca: "dormir" };
const TRUQUES: { id: Reacao; nome: string }[] = [
  { id: "acenar", nome: "Acenar" },
  { id: "girar", nome: "Girar" },
  { id: "dancar", nome: "Dançar" },
  { id: "correr", nome: "Correr" },
  { id: "rolar", nome: "Estrelinha" },
  { id: "mortal", nome: "Mortal" },
  { id: "cumprimentar", nome: "Reverência" },
];

export function HoshiCard() {
  const qc = useQueryClient();
  useRealtimeTable("hoshi_pets", [["hoshi-ranking"]]);
  const { data: salvo, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: meuPet, staleTime: Infinity });
  const { data: ranking = [] } = useQuery({ queryKey: ["hoshi-ranking"], queryFn: rankingPets, staleTime: 30_000 });
  const [, tique] = useState(0);
  const [reacao, setReacao] = useState<{ tipo: Reacao; n: number } | null>(null);
  const [jogando, setJogando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [roupas, setRoupas] = useState(false);

  // As barras caem com o tempo: recalcula a cada meio minuto.
  useEffect(() => {
    const id = setInterval(() => tique((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const salvar = useMutation({
    mutationFn: ({ pet, patch }: { pet: HoshiPet; patch: Parameters<typeof salvarPet>[1] }) => salvarPet(pet, patch),
    onSuccess: (novo) => {
      qc.setQueryData(KEY, novo);
      void qc.invalidateQueries({ queryKey: ["hoshi-ranking"] });
    },
    onError: () => toast.error("Não foi possível salvar o HOSHI. Tente de novo."),
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
  const prog = progresso(pet.xp);
  const estado = humor(pet);
  const reagir = (tipo: Reacao) => setReacao((r) => ({ tipo, n: (r?.n ?? 0) + 1 }));

  /** Soma XP e comemora quando sobe de nível (e avisa das peças liberadas). */
  const comXp = (ganho: number) => {
    const xp = pet.xp + ganho;
    const novoNivel = nivelDoXp(xp);
    if (novoNivel > prog.nivel) {
      const liberadas = PECAS.filter((p) => p.nivel > prog.nivel && p.nivel <= novoNivel).map((p) => p.nome);
      setTimeout(() => {
        reagir("festa");
        playSfx("complete");
        toast.success(`${pet.nome} subiu para o nível ${novoNivel}!${liberadas.length ? ` Liberou: ${liberadas.join(", ")}.` : ""}`);
      }, 500);
    }
    return xp;
  };

  const cuidar = (c: Cuidado) => {
    if (salvar.isPending) return;
    if (pet[c.barra] >= 95) {
      toast.info(c.id === "soneca" ? `${pet.nome} está sem sono agora.` : `${pet.nome} já está satisfeito.`);
      return;
    }
    playSfx("add");
    reagir(REACAO[c.id]);
    salvar.mutate({ pet: salvo, patch: { [c.barra]: Math.min(100, pet[c.barra] + c.ganho), xp: comXp(c.xp) } });
  };

  const fimDoJogo = (r: Resultado) => {
    setJogando(false);
    const ganho = Math.min(XP_MAX_JOGO, r.jogo === "petiscos" ? r.valor * 2 : Math.round(Math.max(0, 700 - r.valor) / 14));
    const recordes =
      r.jogo === "petiscos"
        ? { recorde_petiscos: Math.max(pet.recorde_petiscos, r.valor) }
        : { recorde_reflexo: pet.recorde_reflexo === 0 || (r.valor > 0 && r.valor < pet.recorde_reflexo) ? r.valor : pet.recorde_reflexo };
    reagir("carinho");
    toast.success(`+${ganho} XP para ${pet.nome}.`);
    salvar.mutate({
      pet: salvo,
      patch: { energia: Math.max(0, pet.energia - ENERGIA_POR_JOGO), carinho: Math.min(100, pet.carinho + 10), xp: comXp(ganho), ...recordes },
    });
  };

  const salvarNome = () => {
    const n = nome.trim();
    if (!nomeValido(n)) {
      toast.error("Use de 2 a 18 letras ou números no nome.");
      return;
    }
    playSfx("check");
    setEditando(false);
    if (n !== pet.nome) salvar.mutate({ pet: salvo, patch: { nome: n } });
  };

  return (
    <section className="glass animate-rise mt-4 overflow-hidden rounded-[28px]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="grid gap-x-5 gap-y-2 p-5 sm:grid-cols-[250px_minmax(0,1fr)] sm:p-6">
          {/* o pet */}
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-x-4 bottom-3 h-24 rounded-full bg-primary/25 blur-3xl" />
            <Hoshi3D humor={estado} reacao={reacao} visual={pet.visual} className="h-[300px] w-full" />
            <p className="glass-inset absolute left-1/2 top-0 max-w-full -translate-x-1/2 truncate rounded-full px-3 py-1 text-[11px] text-muted-foreground" aria-live="polite">
              {fala(pet)}
            </p>
          </div>

          {/* nome, nível e cuidados */}
          <div className="flex min-w-0 flex-col justify-center">
            <p className="eyebrow">Hoshi staff · {titulo(prog.nivel)}</p>
            {editando ? (
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvarNome()}
                  maxLength={18}
                  autoFocus
                  aria-label="Nome do seu HOSHI"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/30 px-3 font-display text-lg font-semibold outline-none focus:border-white/25"
                />
                <button onClick={() => setNome(sugerirNome())} aria-label="Sortear um nome" title="Sortear um nome" className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-muted-foreground hover:text-foreground">
                  <Dices className="size-4" />
                </button>
                <button onClick={salvarNome} aria-label="Salvar nome" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white">
                  <Check className="size-4" />
                </button>
              </div>
            ) : (
              <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
                <span className="truncate">{pet.nome}</span>
                <button
                  onClick={() => {
                    setNome(pet.nome);
                    setEditando(true);
                  }}
                  aria-label="Mudar o nome do HOSHI"
                  title="Mudar o nome"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/[0.07] hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
              </h2>
            )}

            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-display text-base font-semibold text-white shadow-[0_0_24px_rgba(206,14,14,0.45)]">{prog.nivel}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Nível {prog.nivel}</span>
                  <span className="tabular-nums">
                    {prog.noNivel}/{prog.paraSubir} XP
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${prog.pct}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 xl:grid-cols-4">
              {BARRAS.map((b) => (
                <div key={b}>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{ROTULO[b]}</span>
                    <span className="tabular-nums">{pet[b]}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-label={ROTULO[b]} aria-valuenow={pet[b]} aria-valuemin={0} aria-valuemax={100}>
                    <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", pet[b] < 30 ? "bg-primary" : "bg-white/70")} style={{ width: `${pet[b]}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-2">
              {CUIDADOS.map((c) => {
                const Icone = ICONES[c.id];
                return (
                  <button key={c.id} onClick={() => cuidar(c)} className="group flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                    <span className="grid size-11 place-items-center rounded-full bg-white/[0.06] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-white/[0.12] group-active:scale-90">
                      <Icone className="size-[18px]" strokeWidth={1.7} />
                    </span>
                    {c.label}
                  </button>
                );
              })}
              <button
                onClick={() => (pet.energia < ENERGIA_POR_JOGO ? toast.info(`${pet.nome} está cansado. Uma soneca primeiro.`) : setJogando(true))}
                className="group flex flex-col items-center gap-1.5 text-[11px] text-foreground"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary/90 text-white shadow-[0_0_22px_rgba(206,14,14,0.4)] transition-all duration-200 group-hover:-translate-y-0.5 group-active:scale-90">
                  <Gamepad2 className="size-[18px]" strokeWidth={1.7} />
                </span>
                Brincar
              </button>
              <button onClick={() => setRoupas(true)} className="group flex flex-col items-center gap-1.5 text-[11px] text-foreground">
                <span className="grid size-11 place-items-center rounded-full border border-white/[0.14] bg-white/[0.08] transition-all duration-200 group-hover:-translate-y-0.5 group-active:scale-90">
                  <Shirt className="size-[18px]" strokeWidth={1.7} />
                </span>
                Guarda-roupa
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {TRUQUES.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => {
                    if (estado === "dormindo") {
                      toast.info(`${pet.nome} está dormindo.`);
                      return;
                    }
                    playSfx("click");
                    reagir(tr.id);
                  }}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground active:scale-95"
                >
                  {tr.nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ranking */}
        <aside className="border-t border-white/[0.06] p-5 lg:border-l lg:border-t-0">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold">
            <Trophy className="size-4 text-ink-3" /> Ranking dos HOSHIs
          </h3>
          <ol className="mt-3 space-y-0.5">
            {ranking.map((r, i) => (
              <li key={r.user_id} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.user_id === pet.user_id && "bg-white/[0.05]")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums", i === 0 ? "bg-primary text-white" : "bg-white/[0.07] text-muted-foreground")}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.nome}</span>
                  <span className="block truncate text-[11px] text-ink-3">{r.username || "staff"}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">Nv {nivelDoXp(r.xp)}</span>
              </li>
            ))}
            {ranking.length === 0 && <li className="py-6 text-center text-xs text-ink-3">Ninguém no ranking ainda.</li>}
          </ol>
        </aside>
      </div>

      {jogando && <HoshiJogos onFim={fimDoJogo} onClose={() => setJogando(false)} />}
      {roupas && (
        <GuardaRoupa
          pet={pet}
          nivel={prog.nivel}
          ocupado={salvar.isPending}
          onVestir={(visual) => salvar.mutate({ pet: salvo, patch: { visual } })}
          onClose={() => setRoupas(false)}
        />
      )}
    </section>
  );
}

/**
 * Guarda-roupa: à esquerda, o HOSHI ao vivo com a peça que você está olhando;
 * à direita, todas as peças por grupo. Peça liberada é vestida ao clicar;
 * peça ainda travada só aparece na prévia, com o nível em que libera.
 */
function GuardaRoupa({ pet, nivel, ocupado, onVestir, onClose }: { pet: HoshiPet; nivel: number; ocupado: boolean; onVestir: (v: Visual) => void; onClose: () => void }) {
  const [previa, setPrevia] = useState<Visual>(pet.visual);
  const [travada, setTravada] = useState<{ nome: string; nivel: number } | null>(null);
  const [mostra, setMostra] = useState<{ tipo: Reacao; n: number } | null>(null);
  useEffect(() => setPrevia(pet.visual), [pet.visual]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="border-b border-white/[0.07] px-6 py-4">Guarda-roupa de {pet.nome}</DialogTitle>
        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="relative border-b border-white/[0.07] md:border-b-0 md:border-r">
            <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-10 h-24 rounded-full bg-primary/25 blur-3xl" />
            <Hoshi3D humor="feliz" reacao={mostra} visual={previa} className="h-[240px] w-full md:h-[380px]" />
            <p className="px-4 pb-4 text-center text-xs text-muted-foreground" aria-live="polite">
              {travada ? `${travada.nome}: libera no nível ${travada.nivel}. Você está no ${nivel}.` : "Prévia ao vivo. Clique numa peça para vestir."}
            </p>
          </div>

          <div className="min-h-0 space-y-5 overflow-y-auto p-5">
            {GRUPOS.map((g) => (
              <section key={g.id}>
                <h3 className="eyebrow">{g.nome}</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PECAS.filter((p) => p.grupo === g.id).map((p) => {
                    const liberada = nivel >= p.nivel;
                    const vestida = pet.visual[g.id] === p.valor;
                    const naPrevia = previa[g.id] === p.valor;
                    return (
                      <button
                        key={p.valor}
                        aria-pressed={vestida}
                        disabled={ocupado}
                        onPointerEnter={() => {
                          setPrevia({ ...pet.visual, [g.id]: p.valor });
                          setTravada(liberada ? null : { nome: p.nome, nivel: p.nivel });
                        }}
                        onPointerLeave={() => {
                          setPrevia(pet.visual);
                          setTravada(null);
                        }}
                        onFocus={() => setPrevia({ ...pet.visual, [g.id]: p.valor })}
                        onClick={() => {
                          setMostra((m) => ({ tipo: "girar", n: (m?.n ?? 0) + 1 }));
                          if (!liberada) {
                            playSfx("uncheck");
                            setPrevia({ ...pet.visual, [g.id]: p.valor });
                            setTravada({ nome: p.nome, nivel: p.nivel });
                            return;
                          }
                          if (vestida) return;
                          playSfx("check");
                          onVestir({ ...pet.visual, [g.id]: p.valor });
                        }}
                        className={cn(
                          "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5",
                          vestida ? "border-white/35 bg-white/[0.1]" : naPrevia ? "border-white/20 bg-white/[0.06]" : "border-white/[0.07] bg-white/[0.03]",
                          !liberada && "opacity-55",
                        )}
                      >
                        <span className="size-7 shrink-0 rounded-full border border-white/15" style={{ background: p.cor }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{p.nome}</span>
                          <span className="block text-[11px] text-ink-3">{vestida ? "Vestindo" : liberada ? "Liberada" : `Nível ${p.nivel}`}</span>
                        </span>
                        {vestida ? <Check className="size-4 shrink-0 text-emerald-400" /> : !liberada ? <Lock className="size-3.5 shrink-0 text-ink-3" /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
