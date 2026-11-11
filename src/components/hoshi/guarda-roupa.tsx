import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CABELOS,
  comprarItem,
  CORES_CABELO,
  darCoins,
  GRUPOS,
  OLHOS,
  PECAS,
  PELOS,
  tem,
  todosPets,
  type HoshiPet,
  type Opcao,
  type Peca,
  type Visual,
} from "@/lib/hoshi";
import { playSfx } from "@/lib/sfx";
import { Hoshi3D, type Reacao } from "./hoshi-3d";

/** Saldo de Staff Coins, em formato de pílula. */
export function Saldo({ coins, className }: { coins: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-200", className)} title="Staff Coins">
      <Coins className="size-3.5" aria-hidden /> {coins}
      <span className="sr-only"> Staff Coins</span>
    </span>
  );
}

function Amostras({ titulo, opcoes, atual, onEscolher, onPrevia }: { titulo: string; opcoes: Opcao[]; atual: string; onEscolher: (id: string) => void; onPrevia: (id: string | null) => void }) {
  return (
    <section>
      <h3 className="eyebrow">{titulo}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            onClick={() => onEscolher(o.id)}
            onPointerEnter={() => onPrevia(o.id)}
            onPointerLeave={() => onPrevia(null)}
            aria-label={o.nome}
            aria-pressed={atual === o.id}
            title={o.nome}
            className={cn("grid size-9 place-items-center rounded-full border-2 transition-transform duration-200 hover:scale-110", atual === o.id ? "border-white" : "border-white/15")}
            style={{ background: o.cor }}
          >
            {atual === o.id && <Check className="size-4 text-white mix-blend-difference" />}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Guarda-roupa: à esquerda o HOSHI ao vivo com o que você está olhando.
 * "Aparência" (pelo, olhos e cabelo) é de graça; a "Loja" usa Staff Coins.
 */
export function GuardaRoupa({ pet, ocupado, onVestir, onClose }: { pet: HoshiPet; ocupado: boolean; onVestir: (v: Visual) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<"aparencia" | "loja">("aparencia");
  const [previa, setPrevia] = useState<Visual | null>(null);
  const [escolhida, setEscolhida] = useState<Peca | null>(null);
  const [mostra, setMostra] = useState<{ tipo: Reacao; n: number } | null>(null);
  const girar = () => setMostra((m) => ({ tipo: "girar", n: (m?.n ?? 0) + 1 }));
  useEffect(() => setEscolhida(null), [pet.itens.length]);

  const comprar = useMutation({
    mutationFn: comprarItem,
    onSuccess: (_, peca) => {
      playSfx("complete");
      toast.success(`${peca.nome} agora é seu!`);
      setEscolhida(null);
      // Vestir já salva o pet e devolve a linha inteira (com o saldo e as peças novas),
      // então não é preciso buscar de novo: buscar agora poderia trazer o visual antigo.
      onVestir({ ...pet.visual, [peca.grupo]: peca.valor });
      void qc.invalidateQueries({ queryKey: ["hoshi-todos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível comprar."),
  });

  const noBoneco = previa ?? (escolhida ? { ...pet.visual, [escolhida.grupo]: escolhida.valor } : pet.visual);
  const vestir = (campo: keyof Visual, valor: string) => {
    if (pet.visual[campo] === valor) return;
    playSfx("check");
    girar();
    onVestir({ ...pet.visual, [campo]: valor });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-4">
          Guarda-roupa de {pet.nome} <Saldo coins={pet.coins} />
        </DialogTitle>
        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
          {/* prévia */}
          <div className="relative flex flex-col border-b border-white/[0.07] md:border-b-0 md:border-r">
            <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-24 h-24 rounded-full bg-primary/25 blur-3xl" />
            <Hoshi3D humor="feliz" reacao={mostra} visual={noBoneco} className="h-[230px] w-full md:h-[340px]" />
            <div className="min-h-[76px] px-4 pb-4 text-center" aria-live="polite">
              {escolhida ? (
                <>
                  <p className="text-sm font-medium">{escolhida.nome}</p>
                  <button
                    onClick={() => comprar.mutate(escolhida)}
                    disabled={comprar.isPending || pet.coins < escolhida.preco}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {comprar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Coins className="size-3.5" />}
                    {pet.coins < escolhida.preco ? `Faltam ${escolhida.preco - pet.coins} coins` : `Comprar por ${escolhida.preco}`}
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Prévia ao vivo. Passe o mouse para experimentar e clique para vestir.</p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex gap-1 border-b border-white/[0.07] px-5 py-3" role="tablist">
              {(["aparencia", "loja"] as const).map((a) => (
                <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={cn("h-9 rounded-full px-4 text-[13px] font-medium transition-colors", aba === a ? "bg-white/[0.12] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {a === "aparencia" ? "Aparência · grátis" : "Loja · Staff Coins"}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {aba === "aparencia" ? (
                <>
                  <Amostras titulo="Cor do pelo" opcoes={PELOS} atual={pet.visual.pelo} onEscolher={(id) => vestir("pelo", id)} onPrevia={(id) => setPrevia(id ? { ...pet.visual, pelo: id } : null)} />
                  <Amostras titulo="Cor dos olhos" opcoes={OLHOS} atual={pet.visual.olhos} onEscolher={(id) => vestir("olhos", id)} onPrevia={(id) => setPrevia(id ? { ...pet.visual, olhos: id } : null)} />
                  {(["masculino", "feminino"] as const).map((genero) => (
                    <section key={genero}>
                      <h3 className="eyebrow">Cabelo {genero}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {CABELOS.filter((c) => c.genero === genero || c.genero === null).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => vestir("cabelo", c.id)}
                            onPointerEnter={() => setPrevia({ ...pet.visual, cabelo: c.id })}
                            onPointerLeave={() => setPrevia(null)}
                            aria-pressed={pet.visual.cabelo === c.id}
                            className={cn("h-9 rounded-full border px-3.5 text-[13px] transition-colors", pet.visual.cabelo === c.id ? "border-white/40 bg-white/[0.12] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}
                          >
                            {c.nome}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                  <Amostras titulo="Cor do cabelo" opcoes={CORES_CABELO} atual={pet.visual.corCabelo} onEscolher={(id) => vestir("corCabelo", id)} onPrevia={(id) => setPrevia(id ? { ...pet.visual, corCabelo: id } : null)} />
                </>
              ) : (
                GRUPOS.map((g) => (
                  <section key={g.id}>
                    <h3 className="eyebrow">{g.nome}</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PECAS.filter((p) => p.grupo === g.id).map((p) => {
                        const minha = tem(pet, p);
                        const vestida = pet.visual[g.id] === p.valor;
                        return (
                          <button
                            key={p.valor}
                            aria-pressed={vestida}
                            disabled={ocupado}
                            onPointerEnter={() => setPrevia({ ...pet.visual, [g.id]: p.valor })}
                            onPointerLeave={() => setPrevia(null)}
                            onClick={() => {
                              girar();
                              if (minha) {
                                setEscolhida(null);
                                vestir(g.id, p.valor);
                              } else {
                                playSfx("click");
                                setEscolhida(p);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5",
                              vestida ? "border-white/35 bg-white/[0.1]" : escolhida === p ? "border-amber-300/50 bg-amber-300/[0.07]" : "border-white/[0.07] bg-white/[0.03]",
                            )}
                          >
                            <span className="size-7 shrink-0 rounded-full border border-white/15" style={{ background: p.listras ? `linear-gradient(${p.listras.map((c, i, l) => `${c} ${(i / l.length) * 100}% ${((i + 1) / l.length) * 100}%`).join(", ")})` : p.cor }} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">{p.nome}</span>
                              <span className={cn("flex items-center gap-1 text-[11px]", minha ? "text-ink-3" : "text-amber-200")}>
                                {vestida ? "Vestindo" : minha ? "Seu" : (<><Coins className="size-3" aria-hidden /> {p.preco}</>)}
                              </span>
                            </span>
                            {vestida && <Check className="size-4 shrink-0 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Painel de entrega de Staff Coins. Só aparece para o henrique (e o banco confere de novo). */
export function PainelCoins() {
  const qc = useQueryClient();
  const { data: pets = [] } = useQuery({ queryKey: ["hoshi-todos"], queryFn: todosPets, staleTime: 30_000 });
  const [alvo, setAlvo] = useState("");
  const [qtd, setQtd] = useState("50");
  const entregar = useMutation({
    mutationFn: ({ id, n }: { id: string; n: number }) => darCoins(id, n),
    onSuccess: (saldo, { id, n }) => {
      const quem = pets.find((p) => p.user_id === id);
      playSfx("complete");
      toast.success(`${n > 0 ? `+${n}` : n} coins para ${quem?.username || quem?.nome || "o staff"}. Saldo: ${saldo}.`);
      for (const chave of [["hoshi-todos"], ["hoshi-meu"], ["hoshi-ranking"]]) void qc.invalidateQueries({ queryKey: chave });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível entregar."),
  });
  const n = Math.trunc(Number(qtd));
  const valido = !!alvo && Number.isFinite(n) && n !== 0 && Math.abs(n) <= 100000;
  const escolhido = pets.find((p) => p.user_id === alvo);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) entregar.mutate({ id: alvo, n });
      }}
      className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
        <Coins className="size-3.5" /> Entregar Staff Coins
      </p>
      <select value={alvo} onChange={(e) => setAlvo(e.target.value)} aria-label="Staff que vai receber" className="mt-2 h-9 w-full rounded-xl border border-white/[0.1] bg-black/50 px-2 text-[13px] outline-none focus:border-white/30">
        <option value="">Escolha o staff…</option>
        {pets.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.username || p.nome} · {p.coins} coins
          </option>
        ))}
      </select>
      <div className="mt-2 flex gap-1.5">
        <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} aria-label="Quantidade de coins" className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/50 px-3 text-[13px] tabular-nums outline-none focus:border-white/30" />
        <button type="submit" disabled={!valido || entregar.isPending} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-white disabled:opacity-50">
          {entregar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Entregar
        </button>
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink-3">{escolhido ? `${escolhido.username || escolhido.nome} tem ${escolhido.coins} coins. ` : ""}Use número negativo para tirar.</p>
    </form>
  );
}
