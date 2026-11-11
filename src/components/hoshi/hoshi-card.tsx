import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Dices, Droplet, Drumstick, Gamepad2, GlassWater, Hand, Heart, Loader2, Moon, Pencil, Shirt, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  aoVivo,
  BARRAS,
  CUIDADOS,
  ENERGIA_POR_JOGO,
  ENTREGADOR_DE_COINS,
  fala,
  humor,
  meuPet,
  nivelDoXp,
  nomeValido,
  progresso,
  rankingPets,
  salvarPet,
  sugerirNome,
  titulo,
  XP_MAX_JOGO,
  type Barra,
  type Cuidado,
  type HoshiPet,
} from "@/lib/hoshi";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { Hoshi3D, type Reacao } from "./hoshi-3d";
import { HoshiJogos, type Resultado } from "./minigames";
import { Praca } from "./praca";
import { GuardaRoupa, PainelCoins, Saldo } from "./guarda-roupa";

const KEY = ["hoshi-meu"];
const ICONES: Record<Cuidado["id"], typeof Hand> = { comida: Drumstick, bebida: GlassWater, carinho: Hand, soneca: Moon };
const ICONE_BARRA: Record<Barra, typeof Hand> = { fome: Drumstick, sede: Droplet, energia: Zap, carinho: Heart };
const COR_BARRA: Record<Barra, string> = { fome: "#f59e0b", sede: "#2dd4bf", energia: "#facc15", carinho: "#fb5c7c" };
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
  useRealtimeTable("hoshi_pets", [["hoshi-ranking"], ["hoshi-todos"], KEY]);
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
      setTimeout(() => {
        reagir("festa");
        playSfx("complete");
        toast.success(`${pet.nome} subiu para o nível ${novoNivel}!`);
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
      <div className="grid lg:grid-cols-[310px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(0,1fr)_236px]">
        {/* ---------- coluna do pet: nome, nível, mascote, status e cuidados ---------- */}
        <div className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Hoshi staff · {titulo(prog.nivel)}</p>
            <Saldo coins={pet.coins} />
          </div>
          {editando ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarNome()}
                maxLength={18}
                autoFocus
                aria-label="Nome do seu HOSHI"
                className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/30 px-3 font-display text-base font-semibold outline-none focus:border-white/25"
              />
              <button onClick={() => setNome(sugerirNome())} aria-label="Sortear um nome" title="Sortear um nome" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-muted-foreground hover:text-foreground">
                <Dices className="size-4" />
              </button>
              <button onClick={salvarNome} aria-label="Salvar nome" className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
                <Check className="size-4" />
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/90 font-display text-sm font-semibold text-white shadow-[0_0_18px_rgba(206,14,14,0.45)]" title={`Nível ${prog.nivel}`}>
                {prog.nivel}
              </span>
              <h2 className="min-w-0 truncate font-display text-xl font-semibold tracking-tight">{pet.nome}</h2>
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
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {prog.noNivel}/{prog.paraSubir} XP
              </span>
            </div>
          )}
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-label="Experiência" aria-valuenow={Math.round(prog.pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${prog.pct}%` }} />
          </div>

          <div className="relative mt-1 flex-1">
            <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-2 h-20 rounded-full bg-primary/25 blur-3xl" />
            <Hoshi3D humor={estado} reacao={reacao} visual={pet.visual} className="h-full min-h-[210px] w-full" />
            <p className="glass-inset absolute left-1/2 top-1 max-w-full -translate-x-1/2 truncate rounded-full px-3 py-1 text-[11px] text-muted-foreground" aria-live="polite">
              {fala(pet)}
            </p>
          </div>

          {/* status com ícone */}
          <div className="grid grid-cols-4 gap-2.5">
            {BARRAS.map((b) => {
              const Icone = ICONE_BARRA[b];
              const baixo = pet[b] < 30;
              return (
                <div key={b} title={`${ROTULO[b]}: ${pet[b]}%`}>
                  <div className={cn("flex items-center justify-center gap-1 text-[11px] tabular-nums text-muted-foreground", baixo && "animate-pulse")}>
                    <Icone className="size-3.5" strokeWidth={2} aria-hidden style={{ color: COR_BARRA[b] }} />
                    {pet[b]}
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-label={ROTULO[b]} aria-valuenow={pet[b]} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pet[b]}%`, background: COR_BARRA[b] }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* cuidados, brincar e guarda-roupa: só ícones */}
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {CUIDADOS.map((c) => {
              const Icone = ICONES[c.id];
              return (
                <button key={c.id} onClick={() => cuidar(c)} aria-label={c.label} title={c.label} className="grid aspect-square place-items-center rounded-2xl bg-white/[0.06] text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-foreground active:scale-90">
                  <Icone className="size-[17px]" strokeWidth={1.7} />
                </button>
              );
            })}
            <button
              onClick={() => (pet.energia < ENERGIA_POR_JOGO ? toast.info(`${pet.nome} está cansado. Uma soneca primeiro.`) : setJogando(true))}
              aria-label="Brincar"
              title="Brincar (mini-games)"
              className="grid aspect-square place-items-center rounded-2xl bg-primary/90 text-white shadow-[0_0_18px_rgba(206,14,14,0.4)] transition-all duration-200 hover:-translate-y-0.5 active:scale-90"
            >
              <Gamepad2 className="size-[17px]" strokeWidth={1.7} />
            </button>
            <button onClick={() => setRoupas(true)} aria-label="Guarda-roupa" title="Guarda-roupa" className="grid aspect-square place-items-center rounded-2xl border border-white/[0.14] bg-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 active:scale-90">
              <Shirt className="size-[17px]" strokeWidth={1.7} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1">
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
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-95"
              >
                {tr.nome}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- praça ---------- */}
        <div className="border-t border-white/[0.06] lg:border-l lg:border-t-0">
          <Praca pet={pet} />
        </div>

        {/* ---------- ranking ---------- */}
        <aside className="border-t border-white/[0.06] p-5 lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold">
            <Trophy className="size-4 text-ink-3" /> Ranking dos HOSHIs
          </h3>
          <ol className="mt-3 grid gap-x-4 gap-y-0.5 sm:grid-cols-2 2xl:grid-cols-1">
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
          {pet.username.toLowerCase() === ENTREGADOR_DE_COINS && <PainelCoins />}
        </aside>
      </div>

      {jogando && <HoshiJogos onFim={fimDoJogo} onClose={() => setJogando(false)} />}
      {roupas && (
        <GuardaRoupa
          pet={pet}
          ocupado={salvar.isPending}
          onVestir={(visual) => salvar.mutate({ pet: salvo, patch: { visual } })}
          onClose={() => setRoupas(false)}
        />
      )}
    </section>
  );
}
